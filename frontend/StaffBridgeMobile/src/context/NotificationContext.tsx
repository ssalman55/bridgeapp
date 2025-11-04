import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, AppState, AppStateStatus } from 'react-native';
import apiService from '../services/api';

interface Notification {
  _id: string;
  message: string;
  type: string;
  link?: string;
  read: boolean;
  timestamp: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = async () => {
    try {
      // Fetch notifications without limit to get all notifications
      const data = await apiService.getNotifications({ limit: 100 });
      // Ensure data is always an array
      const notificationsArray = Array.isArray(data) ? data : (Array.isArray(data?.notifications) ? data.notifications : []);
      setNotifications(notificationsArray);
      
      // Always calculate unread count from notifications array (most reliable)
      const unreadNotifications = notificationsArray.filter((notif: Notification) => {
        // Explicitly check for false, null, or undefined to catch any edge cases
        const isUnread = notif.read === false || notif.read === null || notif.read === undefined;
        return isUnread;
      });
      const calculatedCount = unreadNotifications.length;
      
      console.log('[NotificationContext] Total notifications:', notificationsArray.length);
      console.log('[NotificationContext] Unread notifications:', calculatedCount);
      console.log('[NotificationContext] Unread notification IDs:', unreadNotifications.map(n => n._id));
      console.log('[NotificationContext] All notifications read status:', notificationsArray.map(n => ({ id: n._id, read: n.read })));
      
      // Set unread count immediately from array (most reliable)
      setUnreadCount(calculatedCount);
      
      // Try to get count from API as well for verification
      try {
        const apiCount = await apiService.getNotificationCount();
        console.log('[NotificationContext] API count:', apiCount);
        
        // Use the higher of the two counts to ensure we don't miss any
        if (typeof apiCount === 'number' && apiCount >= 0) {
          const finalCount = Math.max(calculatedCount, apiCount);
          if (finalCount !== calculatedCount) {
            console.log('[NotificationContext] API count differs, using higher value:', finalCount);
            setUnreadCount(finalCount);
          }
        }
      } catch (countError) {
        // If count endpoint fails, use array-based count (already set above)
        console.log('[NotificationContext] Count endpoint not available, using array-based count:', calculatedCount);
      }
      
      console.log('[NotificationContext] ✅ Final unreadCount set to:', calculatedCount);
    } catch (error) {
      console.error('[NotificationContext] Error refreshing notifications:', error);
      // On error, keep empty array instead of undefined
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    // Initial fetch
    refreshNotifications();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000); // 30 seconds
    
    // Refresh when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshNotifications();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      clearInterval(interval);
      subscription?.remove();
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiService.markNotificationAsRead(id);
      // Update local state immediately for better UX
      setNotifications(prev => prev.map(notif => 
        notif._id === id ? { ...notif, read: true } : notif
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
      // Refresh to ensure consistency
      await refreshNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      // Update local state immediately for better UX
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      setUnreadCount(0);
      // Refresh to ensure consistency
      await refreshNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}; 