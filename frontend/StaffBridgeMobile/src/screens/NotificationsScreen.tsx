import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, List, Divider, ActivityIndicator, Button, Chip } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';

const NotificationsScreen: React.FC = () => {
  const { notifications, refreshNotifications, markAllAsRead, markAsRead } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const { theme } = useTheme();
  const navigation = useNavigation();

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshNotifications();
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  // Function to handle navigation based on notification type and link
  const handleNotificationPress = async (notif: any) => {
    console.log('Notification clicked:', notif); // Debug log
    
    if (!notif.read) {
      await markAsRead(notif._id);
    }

    // Handle case where type might be missing
    const notificationType = notif.type || 'unknown';
    console.log('Notification type:', notificationType, 'Link:', notif.link);

    // Navigate based on notification type and link
    switch (notificationType) {
      case 'task':
        console.log('Task notification - navigating to AssignedTasks');
        (navigation as any).navigate('Tasks', { screen: 'AssignedTasks' });
        break;
      case 'leave':
        if (notif.link === '/my-leave-requests') {
          (navigation as any).navigate('Requests', { screen: 'LeaveHistory' });
        } else if (notif.link === '/leave-management') {
          // For admin notifications about leave requests
          (navigation as any).navigate('Requests', { screen: 'LeaveHistory' });
        } else {
          // Default navigation for leave notifications
          (navigation as any).navigate('Requests', { screen: 'LeaveHistory' });
        }
        break;
      case 'expense':
        if (notif.link === '/expense-claims') {
          (navigation as any).navigate('Requests', { screen: 'ClaimsHistory' });
        } else if (notif.link === '/admin/expense-claims/pending') {
          // For admin notifications about expense claims
          (navigation as any).navigate('Requests', { screen: 'ClaimsHistory' });
        } else {
          // Default navigation for expense notifications
          (navigation as any).navigate('Requests', { screen: 'ClaimsHistory' });
        }
        break;
      case 'training':
        if (notif.link === '/my-training-requests') {
          (navigation as any).navigate('Requests', { screen: 'TrainingHistory' });
        } else if (notif.link === '/admin/training-requests') {
          // For admin notifications about training requests
          (navigation as any).navigate('Requests', { screen: 'TrainingHistory' });
        } else {
          // Default navigation for training notifications
          (navigation as any).navigate('Requests', { screen: 'TrainingHistory' });
        }
        break;
      case 'inventory':
        if (notif.link === '/inventory/requests') {
          (navigation as any).navigate('Requests', { screen: 'CurrentInventory' });
        } else if (notif.link && notif.link.startsWith('/my-inventory/')) {
          // For specific inventory item assignment
          (navigation as any).navigate('Requests', { screen: 'CurrentInventory' });
        } else {
          // Default navigation for inventory notifications
          (navigation as any).navigate('Requests', { screen: 'CurrentInventory' });
        }
        break;
      case 'payroll':
        if (notif.link === '/my-payroll') {
          (navigation as any).navigate('Requests', { screen: 'Payslip' });
        } else {
          // Default navigation for payroll notifications
          (navigation as any).navigate('Requests', { screen: 'Payslip' });
        }
        break;
      case 'bulletin':
        if (notif.link === '/bulletin-board') {
          (navigation as any).navigate('More', { screen: 'BulletinBoard' });
        } else {
          // Default navigation for bulletin notifications
          (navigation as any).navigate('More', { screen: 'BulletinBoard' });
        }
        break;
      case 'calendar':
        if (notif.link === '/admin-calendar') {
          (navigation as any).navigate('Calendar');
        } else {
          // Default navigation for calendar notifications
          (navigation as any).navigate('Calendar');
        }
        break;
      case 'attendance':
        if (notif.link === '/attendance-history') {
          (navigation as any).navigate('Requests', { screen: 'AttendanceHistory' });
        } else {
          // Default navigation for attendance notifications
          (navigation as any).navigate('Requests', { screen: 'AttendanceHistory' });
        }
        break;
      case 'file':
        if (notif.link === '/admin/documents') {
          (navigation as any).navigate('More', { screen: 'MyDocuments' });
        } else {
          // Default navigation for file notifications
          (navigation as any).navigate('More', { screen: 'MyDocuments' });
        }
        break;
      case 'peer':
        if (notif.link === '/admin/peer-recognitions') {
          // Navigate to performance screen for peer recognitions
          (navigation as any).navigate('Tasks', { screen: 'PerformanceEvaluation' });
        } else {
          // Default navigation for peer notifications
          (navigation as any).navigate('Tasks', { screen: 'PerformanceEvaluation' });
        }
        break;
      case 'performance':
        if (notif.link && notif.link.startsWith('/my-evaluations')) {
          (navigation as any).navigate('Tasks', { screen: 'PerformanceEvaluation' });
        } else {
          // Default navigation for performance notifications
          (navigation as any).navigate('Tasks', { screen: 'PerformanceEvaluation' });
        }
        break;
      case 'unknown':
      default:
        console.log('Unknown notification type:', notificationType, 'with link:', notif.link);
        // Try to infer type from message content
        const message = notif.message?.toLowerCase() || '';
        if (message.includes('task')) {
          console.log('Inferring task notification from message');
          (navigation as any).navigate('Tasks', { screen: 'AssignedTasks' });
        } else if (message.includes('leave')) {
          console.log('Inferring leave notification from message');
          (navigation as any).navigate('Requests', { screen: 'LeaveHistory' });
        } else if (message.includes('expense') || message.includes('claim')) {
          console.log('Inferring expense notification from message');
          (navigation as any).navigate('Requests', { screen: 'ClaimsHistory' });
        } else if (message.includes('training')) {
          console.log('Inferring training notification from message');
          (navigation as any).navigate('Requests', { screen: 'TrainingHistory' });
        } else if (message.includes('inventory')) {
          console.log('Inferring inventory notification from message');
          (navigation as any).navigate('Requests', { screen: 'CurrentInventory' });
        } else if (message.includes('payroll') || message.includes('salary')) {
          console.log('Inferring payroll notification from message');
          (navigation as any).navigate('Requests', { screen: 'Payslip' });
        } else {
          // If no specific mapping, try to use the link directly
          if (notif.link) {
            try {
              (navigation as any).navigate(notif.link as never);
            } catch (error) {
              console.log('Navigation failed for link:', notif.link, error);
            }
          }
        }
        break;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  // Debug log to see notifications structure
  useEffect(() => {
    console.log('All notifications:', notifications);
    console.log('Filtered notifications:', filteredNotifications);
  }, [notifications, filteredNotifications]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}> 
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title style={[styles.cardTitle, { color: theme.colors.text }]}>Notifications</Title>
            <Button onPress={async () => { await markAllAsRead(); await refreshNotifications(); }} compact>Mark all as read</Button>
          </View>
          <View style={{ flexDirection: 'row', marginVertical: 8 }}>
            <Chip selected={filter === 'all'} onPress={() => setFilter('all')} style={{ marginRight: 8 }}>All</Chip>
            <Chip selected={filter === 'unread'} onPress={() => setFilter('unread')} style={{ marginRight: 8 }}>Unread</Chip>
            <Chip selected={filter === 'read'} onPress={() => setFilter('read')}>Read</Chip>
          </View>
        </Card.Content>
      </Card>
      <View style={{ marginHorizontal: 16 }}>
        {filteredNotifications.length === 0 ? (
          <Paragraph style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 32 }}>No notifications found.</Paragraph>
        ) : (
          filteredNotifications.map((notif) => (
            <TouchableOpacity
              key={notif._id}
              style={{ backgroundColor: notif.read ? theme.colors.surface : '#E3F2FD', borderRadius: 10, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: '#eee' }}
              onPress={() => handleNotificationPress(notif)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Title style={{ fontSize: 16, fontWeight: notif.read ? 'normal' : 'bold', color: theme.colors.text }}>{notif.message}</Title>
              </View>
              <Paragraph style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{new Date(notif.timestamp).toLocaleString()}</Paragraph>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
  },
});

export default NotificationsScreen; 