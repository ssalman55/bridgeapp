import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Text,
  Image,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import {
  Card,
  ActivityIndicator,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
// @ts-ignore
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainTabParamList, SubmenuStackParamList } from '../navigation/MainNavigator';
// @ts-ignore
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { decode } from 'html-entities';

import { theme, spacing, typography, shadows, colors } from '../theme/theme';

interface DashboardData {
  attendance: {
    todayStatus: string;
    checkInTime?: string;
    checkOutTime?: string;
    thisWeek: number;
    thisMonth: number;
  };
  leave: {
    pending: number;
    approved: number;
    totalDays: number;
  };
  notifications: {
    unread: number;
    recent: Array<{
      id: string;
      title: string;
      message: string;
      timestamp: string;
    }>;
  };
  upcoming: {
    leaves: Array<{
      id: string;
      type: string;
      startDate: string;
      endDate: string;
    }>;
    trainings: Array<{
      id: string;
      title: string;
      date: string;
    }>;
  };
}

interface Bulletin {
  _id: string;
  title: string;
  content: string;
  postedBy: string | {
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  postedDate: string;
}

// Helper function to strip HTML tags
const stripHtml = (html: string) => {
  if (!html) return '';
  const decoded = decode(html);
  const text = decoded.replace(/<[^>]*>/gi, '').replace(/&nbsp;/gi, ' ').trim();
  return text;
};

// Get user initials for avatar
const getUserInitials = (user: any) => {
  // Check if user has a profile image (either profilePicture or profileImage)
  const hasProfileImage = user?.profilePicture || user?.profileImage;
  // Only return null if there's a valid image URL, not if it's an S3 key
  if (hasProfileImage && (hasProfileImage.startsWith('http://') || hasProfileImage.startsWith('https://'))) {
    return null;
  }
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  if (firstName || lastName) {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  }
  const email = user?.email || '';
  return email[0]?.toUpperCase() || 'U';
};

const DashboardScreen: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState<boolean>(false);
  const [attendance, setAttendance] = useState<{
    isCheckedIn: boolean;
    isCheckedOut: boolean;
    lastCheckIn?: string;
    lastCheckOut?: string;
    geofenceStatus?: 'inside' | 'outside' | 'not_applicable' | null;
  } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(true);
  const [attendanceActionLoading, setAttendanceActionLoading] = useState<boolean>(false);
  const [peerRecognitions, setPeerRecognitions] = useState<Array<{
    _id: string;
    submitter?: { fullName: string };
    recognized?: { fullName: string; email?: string };
    comment: string;
    createdAt?: string;
  }>>([]);
  const [recognitionsLoading, setRecognitionsLoading] = useState<boolean>(true);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [bulletinsLoading, setBulletinsLoading] = useState<boolean>(true);
  const [leaveBalances, setLeaveBalances] = useState<Array<{
    leaveType: {
      _id: string;
      name: string;
      allocation: number;
      color?: string;
      icon?: string;
    };
    balance: {
      total: number;
      used: number;
      available: number;
      percentage: number;
    };
  }>>([]);
  const [leaveBalancesLoading, setLeaveBalancesLoading] = useState<boolean>(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const { state } = useAuth();
  const { theme: appTheme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainTabParamList & SubmenuStackParamList>>();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadDashboardData = async () => {
    try {
      const mockData: DashboardData = {
        attendance: {
          todayStatus: 'checked-in',
          checkInTime: '09:00 AM',
          thisWeek: 5,
          thisMonth: 22,
        },
        leave: {
          pending: 2,
          approved: 15,
          totalDays: 25,
        },
        notifications: {
          unread: 3,
          recent: [],
        },
        upcoming: {
          leaves: [],
          trainings: [],
        },
      };
      setDashboardData(mockData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const data = await apiService.getAttendanceStatus();
      setAttendance(data);
      return data; // Return data for use in handleAttendanceAction
    } catch (error) {
      setAttendance(null);
      return null;
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchPeerRecognitions = async () => {
    setRecognitionsLoading(true);
    try {
      const data = await apiService.getPeerRecognitions(2);
      setPeerRecognitions(Array.isArray(data) ? data.slice(0, 2) : []);
    } catch (error: any) {
      setPeerRecognitions([]);
    } finally {
      setRecognitionsLoading(false);
    }
  };

  const fetchBulletins = async () => {
    setBulletinsLoading(true);
    try {
      const data = await apiService.getBulletins({ limit: 3 });
      const sorted = (Array.isArray(data) ? data : [])
        .filter(b => b)
        .sort((a, b) => {
          if (!a.postedDate && !b.postedDate) return 0;
          if (!a.postedDate) return 1;
          if (!b.postedDate) return -1;
          return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
        })
        .slice(0, 2);
      setBulletins(sorted);
    } catch (error: any) {
      setBulletins([]);
    } finally {
      setBulletinsLoading(false);
    }
  };

  const fetchLeaveBalances = async () => {
    setLeaveBalancesLoading(true);
    try {
      const data = await apiService.getUserLeaveBalances();
      // Filter to show only Annual/Vacation and Sick leave types, limit to 2 most common
      const filtered = (Array.isArray(data) ? data : [])
        .filter((balance: any) => {
          const name = balance.leaveType?.name?.toLowerCase() || '';
          return name.includes('annual') || name.includes('vacation') || name.includes('sick');
        })
        .sort((a: any, b: any) => {
          // Prioritize Annual/Vacation first, then Sick
          const aName = a.leaveType?.name?.toLowerCase() || '';
          const bName = b.leaveType?.name?.toLowerCase() || '';
          if (aName.includes('annual') || aName.includes('vacation')) return -1;
          if (bName.includes('annual') || bName.includes('vacation')) return 1;
          if (aName.includes('sick')) return -1;
          if (bName.includes('sick')) return 1;
          return 0;
        })
        .slice(0, 2);
      setLeaveBalances(filtered);
    } catch (error: any) {
      console.warn('Error fetching leave balances:', error);
      setLeaveBalances([]);
    } finally {
      setLeaveBalancesLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    fetchAttendance();
    fetchPeerRecognitions();
    fetchBulletins();
    fetchLeaveBalances();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
    fetchAttendance();
    fetchPeerRecognitions();
    fetchBulletins();
    fetchLeaveBalances();
  };

  const handleAttendanceAction = async () => {
    setAttendanceActionLoading(true);
    try {
      // Always refresh attendance status first to get the latest state
      const currentAttendance = await fetchAttendance();
      
      // Determine action based on latest attendance status
      // canCheckOut means: isCheckedIn AND NOT isCheckedOut (has active check-in without checkout)
      const canCheckOut = currentAttendance?.isCheckedIn && !currentAttendance?.isCheckedOut;
      
      if (!canCheckOut) {
        // User needs to check in (either no record, already checked out, or no active check-in)
        // Check if location services are enabled
        const locationEnabled = await Location.hasServicesEnabledAsync();
        console.log('Location services enabled:', locationEnabled);
        
        if (!locationEnabled) {
          Alert.alert(
            'Location Services Disabled',
            'Location services are disabled on your device. Please enable location services in your device settings to check in.\n\nNote: Location services cannot be enabled programmatically - you must enable them manually in your device Settings.\n\nSince geofencing may be enabled, location is required for attendance check-in.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          setAttendanceActionLoading(false);
          return;
        }
        
        // Check current permission status
        const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
        console.log('Current location permission status:', currentStatus);

        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission Required',
            'Location permission is required for check-in, especially when geofencing is enabled. Please grant location permission in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          setAttendanceActionLoading(false);
          return;
        }

        // Get current location with progressive accuracy and retry logic
        let location;
        let lastError: any = null;
        
        // Strategy: Try multiple accuracy levels, starting with lowest (fastest, most likely to work)
        // If that fails, progressively try higher accuracy
        const accuracyLevels = [
          Location.Accuracy.Lowest,      // Fastest, least accurate (good for initial fix)
          Location.Accuracy.Low,        // Low accuracy
          Location.Accuracy.Balanced,   // Balanced (default)
        ];
        
        // First, try to get last known position as a fallback
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maximumAge: 60000, // Accept up to 1 minute old
          });
          if (lastKnown && lastKnown.coords) {
            console.log('Using last known position:', {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
              accuracy: lastKnown.coords.accuracy
            });
            location = lastKnown;
          }
        } catch (err) {
          console.log('Last known position not available, will try fresh location');
        }
        
        // If we don't have location yet, try getting fresh location with progressive accuracy
        if (!location) {
          for (let accuracyIndex = 0; accuracyIndex < accuracyLevels.length; accuracyIndex++) {
            const accuracy = accuracyLevels[accuracyIndex];
            const maxRetries = 2; // 2 retries per accuracy level
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                console.log(`Location attempt ${attempt}/${maxRetries} with accuracy: ${Location.Accuracy[accuracy] || accuracy}`);
                
                location = await Location.getCurrentPositionAsync({
                  accuracy: accuracy,
                  timeout: accuracy === Location.Accuracy.Lowest ? 10000 : 20000, // Lower accuracy gets shorter timeout
                  maximumAge: accuracy === Location.Accuracy.Lowest ? 30000 : 10000, // Accept older locations for lower accuracy
                });
                
                if (location && location.coords) {
                  console.log('Location retrieved successfully:', {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    accuracy: location.coords.accuracy,
                    accuracyLevel: Location.Accuracy[accuracy] || accuracy
                  });
                  break; // Success, exit both loops
                }
              } catch (locationError: any) {
                lastError = locationError;
                console.warn(`Location attempt ${attempt} failed with accuracy ${Location.Accuracy[accuracy] || accuracy}:`, locationError?.message);
                
                // If not the last attempt for this accuracy level, wait before retrying
                if (attempt < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                }
              }
            }
            
            // If we got location, break out of accuracy loop
            if (location && location.coords) {
              break;
            }
            
            // Wait before trying next accuracy level
            if (accuracyIndex < accuracyLevels.length - 1) {
              console.log('Trying next accuracy level...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        // If all retries failed, show error
        if (!location || !location.coords) {
          const errorMessage = lastError?.message || 'Unable to get your location after multiple attempts';
          console.error('Location error after retries:', lastError);
          
          Alert.alert(
            'Location Unavailable',
            `${errorMessage}\n\nTroubleshooting steps:\n• Check that Location Services are enabled in device Settings\n• Ensure the app has location permission (Settings > App Permissions)\n• Make sure GPS/Wi-Fi location is turned on in device settings\n• Try moving to an area with better GPS reception or near a window\n• If using an emulator, location may not work - use a physical device\n• Restart the app and try again`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              },
              { 
                text: 'Try Again', 
                onPress: () => {
                  // Retry the check-in process
                  setTimeout(() => handleAttendanceAction(), 2000);
                }
              }
            ]
          );
          setAttendanceActionLoading(false);
          return;
        }

        // Send check-in request to backend
        // Backend will handle geofencing validation:
        // - If allowCheckInOutside is enabled, it will accept check-in regardless of location
        // - If allowCheckInOutside is disabled, it will only accept if within geofence
        try {
          await apiService.checkIn({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          Alert.alert('Success', 'Checked in successfully!');
        } catch (checkInError: any) {
          // Backend handles geofencing validation and returns appropriate errors
          const errorMessage = checkInError?.message || 'Failed to check in';
          throw checkInError; // Re-throw to be handled by outer catch block
        }
      } else {
        // User can check out - they have an active check-in without checkout
        await apiService.checkOut();
        Alert.alert('Success', 'Checked out successfully!');
      }
      // Refresh attendance status after action
      await fetchAttendance();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update attendance.';
      console.error('Attendance action error:', error);
      
      // Handle geofencing errors from backend
      if (message.includes('must be at') || 
          message.includes('You must be at') || 
          message.includes('not within an authorized') ||
          message.includes('Location')) {
        Alert.alert('Location Restriction', message);
      } else if (message.includes('No active check-in found')) {
        Alert.alert(
          'Cannot Check Out', 
          'You need to check in first before you can check out. Please check in and try again.'
        );
        // Refresh to update UI
        await fetchAttendance();
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setAttendanceActionLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
    });
  };

  const getUserName = () => {
    const user = state.user;
    if (user?.firstName) {
      return user.firstName;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  // Fetch signed URL for S3 key and cache it
  useEffect(() => {
    const fetchProfileImageUrl = async () => {
      const profilePic = state.user?.profilePicture || state.user?.profileImage;
      
      console.log('[DashboardScreen] Profile image check:', {
        hasUser: !!state.user,
        profilePicture: state.user?.profilePicture,
        profileImage: state.user?.profileImage,
        profilePic: profilePic,
        profilePicType: typeof profilePic
      });
      
      // Reset error state when profile image changes
      setProfileImageError(false);
      
      // If no profile image, clear cached URL
      if (!profilePic) {
        console.log('[DashboardScreen] No profile image found');
        setProfileImageUrl(null);
        return;
      }

      // If it's already a full URL (signed URL from S3), use it directly
      if (typeof profilePic === 'string' && (profilePic.startsWith('http://') || profilePic.startsWith('https://'))) {
        console.log('[DashboardScreen] Using existing signed URL:', profilePic.substring(0, 100) + '...');
        setProfileImageUrl(profilePic);
        return;
      }

      // If it's an S3 key (starts with 'profile-images/'), fetch signed URL
      if (typeof profilePic === 'string' && profilePic.startsWith('profile-images/')) {
        console.log('[DashboardScreen] Detected S3 key, fetching signed URL:', profilePic);
        try {
          const signedUrl = await apiService.getProfileImageSignedUrl(profilePic);
          if (signedUrl) {
            console.log('[DashboardScreen] Got signed URL:', signedUrl.substring(0, 100) + '...');
            setProfileImageUrl(signedUrl);
          } else {
            console.warn('[DashboardScreen] No signed URL returned from API');
            setProfileImageUrl(null);
          }
        } catch (error) {
          console.warn('[DashboardScreen] Failed to fetch profile image signed URL:', error);
          setProfileImageUrl(null);
        }
        return;
      }

      // Legacy: if it's a relative path, construct full URL
      if (typeof profilePic === 'string' && profilePic.startsWith('/')) {
        const baseUrl = 'https://sbapp.onrender.com';
        const legacyUrl = `${baseUrl}${profilePic}`;
        console.log('[DashboardScreen] Using legacy URL:', legacyUrl);
        setProfileImageUrl(legacyUrl);
        return;
      }

      console.warn('[DashboardScreen] Unknown profile image format:', profilePic);
      setProfileImageUrl(null);
    };

    fetchProfileImageUrl();
  }, [state.user?.profilePicture, state.user?.profileImage]);

  const getProfileImageUri = () => {
    // If image failed to load, return null to show initials
    if (profileImageError) {
      return null;
    }
    return profileImageUrl;
  };

  const handleImageError = () => {
    setProfileImageError(true);
    setProfileImageUrl(null);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: appTheme.colors.background }]}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: appTheme.colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Hero Card Section */}
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={styles.heroCard}>
          {/* Subtle abstract shapes for visual appeal */}
          <View style={styles.abstractShape} />
          <View style={styles.abstractShape2} />
          
          <View style={styles.heroContent}>
            {/* User Avatar & Greeting Row */}
            <View style={styles.heroHeader}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroGreeting}>Welcome, {getUserName()}</Text>
                <Text style={styles.heroDate}>
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.avatarWrapper}
                onPress={() => navigation.navigate('More', { screen: 'Profile' } as never)}
                activeOpacity={0.8}
              >
                {getProfileImageUri() && !profileImageError ? (
                  <Image 
                    source={{ uri: getProfileImageUri()! }} 
                    style={styles.avatarImage}
                    onError={handleImageError}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>{getUserInitials(state.user)}</Text>
                  </View>
                )}
                {/* Subtle ring around avatar */}
                <View style={styles.avatarRing} />
              </TouchableOpacity>
            </View>

            {/* Attendance Action - Prominently Displayed */}
            <View style={styles.attendanceSection}>
              {attendanceLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <TouchableOpacity
                    onPress={handleAttendanceAction}
                    disabled={attendanceActionLoading}
                    style={[
                      styles.heroAttendanceButton,
                      // Show "Check Out" button (secondary color) only if: isCheckedIn AND NOT isCheckedOut
                      (attendance?.isCheckedIn && !attendance?.isCheckedOut)
                        ? { backgroundColor: colors.secondary } 
                        : { backgroundColor: colors.primary }
                    ]}
                    activeOpacity={0.8}
                  >
                    {attendanceActionLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Icon
                          name={(attendance?.isCheckedIn && !attendance?.isCheckedOut) ? 'logout' : 'login'}
                          size={24}
                          color="#fff"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.heroAttendanceButtonText}>
                          {(attendance?.isCheckedIn && !attendance?.isCheckedOut) ? 'Check Out' : 'Check In'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {attendance && attendance.lastCheckIn && (
                    <Text style={styles.attendanceTime}>
                      Check-in: {new Date(attendance.lastCheckIn).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Leave Balance Section */}
      {leaveBalances.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Icon name="calendar-clock" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Leave Balance</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Requests', { screen: 'LeaveHistory' } as never)}
            >
              <Text style={styles.viewAllLinkText}>View History</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.leaveBalanceContainer}>
            {leaveBalances.map((balance, index) => {
              const isAnnual = balance.leaveType.name.toLowerCase().includes('annual') || 
                              balance.leaveType.name.toLowerCase().includes('vacation');
              const cardColor = isAnnual ? colors.primary : colors.orange;
              const iconName = isAnnual ? 'calendar-star' : 'heart-pulse';
              
              return (
                <Card key={balance.leaveType._id || index} style={styles.leaveBalanceCard}>
                  <View style={styles.leaveBalanceCardHeader}>
                    <View style={styles.leaveBalanceIconContainer}>
                      <Icon name={iconName} size={24} color={cardColor} />
                    </View>
                    <View style={styles.leaveBalanceHeaderText}>
                      <Text style={styles.leaveBalanceTypeName}>
                        {balance.leaveType.name}
                      </Text>
                      <Text style={styles.leaveBalanceSubtext}>days booked</Text>
                    </View>
                    <Text style={[styles.leaveBalanceStatus, { color: colors.success }]}>
                      Good
                    </Text>
                  </View>
                  <View style={styles.leaveBalanceContent}>
                    <View style={styles.leaveBalanceValues}>
                      <View style={styles.leaveBalanceMainValue}>
                        <Text style={styles.leaveBalanceNumber}>
                          {balance.balance.available.toFixed(2)}
                        </Text>
                        <Text style={styles.leaveBalanceDivider}>/</Text>
                        <Text style={styles.leaveBalanceTotal}>
                          {balance.balance.total.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.leaveBalanceUnit}>Days</Text>
                    </View>
                    <View style={styles.leaveBalanceStats}>
                      <View style={[styles.leaveBalanceStatBox, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.leaveBalanceStatValue, { color: colors.success }]}>
                          {balance.balance.available.toFixed(0)} Available
                        </Text>
                      </View>
                      <View style={[styles.leaveBalanceStatBox, { backgroundColor: cardColor + '15' }]}>
                        <Text style={[styles.leaveBalanceStatValue, { color: cardColor }]}>
                          {balance.balance.percentage}% Used
                        </Text>
                      </View>
                    </View>
                    <View style={styles.leaveBalanceProgressBar}>
                      <View 
                        style={[
                          styles.leaveBalanceProgressFill,
                          { 
                            width: `${balance.balance.percentage}%`,
                            backgroundColor: cardColor
                          }
                        ]} 
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      )}

      {/* Peer Recognitions - Simplified */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Peer Recognitions</Text>
          {peerRecognitions.length > 0 && (
            <TouchableOpacity 
              onPress={() => navigation.navigate('Requests', { screen: 'RecognizePeer' } as never)}
              style={styles.viewAllLink}
            >
              <Text style={styles.viewAllLinkText}>View All</Text>
              <Icon name="chevron-right" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        {recognitionsLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
        ) : peerRecognitions.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="trophy-outline" size={32} color={appTheme.colors.textTertiary} />
            <Text style={[styles.emptyStateText, { color: appTheme.colors.textSecondary }]}>
              No recognitions yet
            </Text>
          </View>
        ) : (
          <View style={styles.recognitionsContainer}>
            {peerRecognitions.map((rec) => (
              <Card key={rec._id} style={styles.recognitionCard}>
                <View style={styles.recognitionContent}>
                  <View style={styles.recognitionHeader}>
                    {/* Avatar flow: sender → receiver */}
                    <View style={styles.avatarFlow}>
                      <View style={[styles.smallAvatar, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.smallAvatarText, { color: colors.primary }]}>
                          {rec.submitter?.fullName?.[0] || 'A'}
                        </Text>
                      </View>
                      <Icon name="arrow-right" size={16} color={colors.orange} style={{ marginHorizontal: 4 }} />
                      <View style={[styles.smallAvatar, { backgroundColor: '#FFF9E6' }]}>
                        <Icon name="trophy" size={16} color={colors.orange} />
                      </View>
                      <Text style={styles.recognitionNames}>
                        {rec.submitter?.fullName} → {rec.recognized?.fullName}
                      </Text>
                    </View>
                    <Text style={styles.recognitionDate}>{formatDate(rec.createdAt)}</Text>
                  </View>
                  <Text style={styles.recognitionComment} numberOfLines={1}>
                    "{rec.comment}"
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* Bulletin Board - Simplified with HTML Parsing */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bulletin Board</Text>
          {bulletins.length > 0 && (
            <TouchableOpacity 
              onPress={() => navigation.navigate('More', { screen: 'BulletinBoard' } as never)}
              style={styles.viewAllLink}
            >
              <Text style={styles.viewAllLinkText}>View All</Text>
              <Icon name="chevron-right" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        {bulletinsLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
        ) : bulletins.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="bullhorn-outline" size={32} color={appTheme.colors.textTertiary} />
            <Text style={[styles.emptyStateText, { color: appTheme.colors.textSecondary }]}>
              No announcements yet
            </Text>
          </View>
        ) : (
          <View style={styles.bulletinsContainer}>
            {bulletins.map((bulletin, idx) => {
              const isEvent = bulletin.title.toLowerCase().includes('event') || 
                             bulletin.title.toLowerCase().includes('meeting');
              const cardColor = isEvent ? colors.orange : colors.primary;
              
              return (
                <Card key={bulletin._id} style={styles.bulletinCard}>
                  <View style={[styles.bulletinBanner, { backgroundColor: cardColor + '15' }]}>
                    <Icon 
                      name={isEvent ? 'calendar-star' : 'information'} 
                      size={20} 
                      color={cardColor} 
                    />
                    <Text style={[styles.bulletinTitle, { color: appTheme.colors.text }]} numberOfLines={2}>
                      {bulletin.title}
                    </Text>
                  </View>
                  <View style={styles.bulletinBody}>
                    <Text style={styles.bulletinPreview} numberOfLines={2}>
                      {stripHtml(bulletin.content || '')}
                    </Text>
                    <View style={styles.bulletinMeta}>
                      <Icon name="calendar-outline" size={12} color={appTheme.colors.textSecondary} />
                      <Text style={styles.bulletinMetaText}>{formatDate(bulletin.postedDate)}</Text>
                      <Text style={styles.bulletinMetaSeparator}>•</Text>
                      <Text style={styles.bulletinMetaText}>
                        {typeof bulletin.postedBy === 'string' 
                          ? bulletin.postedBy
                          : (bulletin.postedBy?.firstName && bulletin.postedBy?.lastName
                            ? `${bulletin.postedBy.firstName} ${bulletin.postedBy.lastName}`.trim()
                            : bulletin.postedBy?.fullName || 'Admin')}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>

      {/* Quick Actions - 3x2 Grid with Larger Icons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What would you like to do?</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Requests', { screen: 'HelpdeskHistory' } as never)}
            style={[styles.quickActionButton, { backgroundColor: '#E3F2FD' }]}
          >
            <Icon name="help-circle" size={40} color={colors.primary} />
            <Text style={styles.quickActionLabel}>Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Requests', { screen: 'TrainingRequest' } as never)}
            style={[styles.quickActionButton, { backgroundColor: '#FFF3E0' }]}
          >
            <Icon name="school" size={40} color={colors.orange} />
            <Text style={styles.quickActionLabel}>Training</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Requests', { screen: 'ExpenseClaim' } as never)}
            style={[styles.quickActionButton, { backgroundColor: '#F3E5F5' }]}
          >
            <Icon name="cash-multiple" size={40} color={colors.purple} />
            <Text style={styles.quickActionLabel}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Requests', { screen: 'AttendanceHistory' } as never)}
            style={[styles.quickActionButton, { backgroundColor: '#FFEBEE' }]}
          >
            <Icon name="calendar-check" size={40} color="#E91E63" />
            <Text style={styles.quickActionLabel}>Attendance</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Calendar')}
            style={[styles.quickActionButton, { backgroundColor: '#E8F5E9' }]}
          >
            <Icon name="calendar-month" size={40} color={colors.success} />
            <Text style={styles.quickActionLabel}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Requests', { screen: 'Payslip' } as never)}
            style={[styles.quickActionButton, { backgroundColor: '#FFF9E6' }]}
          >
            <Icon name="file-document" size={40} color="#FF9800" />
            <Text style={styles.quickActionLabel}>Payslip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF2',
    ...shadows.card,
  },
  abstractShape: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primary + '0A',
  },
  abstractShape2: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.orange + '08',
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  heroLeft: {
    flex: 1,
    marginRight: 16,
  },
  heroGreeting: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  heroDate: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarRing: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: colors.primary + '20',
    top: -3,
    left: -3,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  attendanceSection: {
    alignItems: 'center',
    width: '100%',
  },
  heroAttendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 36,
    minWidth: 220,
    ...shadows.medium,
  },
  heroAttendanceButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  attendanceTime: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    marginTop: 8,
    fontSize: 14,
  },
  recognitionsContainer: {
    gap: 12,
  },
  recognitionCard: {
    borderRadius: 16,
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: colors.orange + '20',
    ...shadows.small,
  },
  recognitionContent: {
    padding: 16,
  },
  recognitionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  recognitionNames: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  recognitionDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  recognitionComment: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  bulletinsContainer: {
    gap: 12,
  },
  bulletinCard: {
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.small,
  },
  bulletinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  bulletinTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  bulletinBody: {
    padding: 16,
  },
  bulletinPreview: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  bulletinMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulletinMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bulletinMetaSeparator: {
    fontSize: 12,
    color: colors.textTertiary,
    marginHorizontal: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  quickActionButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    ...shadows.small,
  },
  quickActionLabel: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  leaveBalanceContainer: {
    gap: 12,
  },
  leaveBalanceCard: {
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.small,
  },
  leaveBalanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
  },
  leaveBalanceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  leaveBalanceHeaderText: {
    flex: 1,
  },
  leaveBalanceTypeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  leaveBalanceSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  leaveBalanceStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  leaveBalanceContent: {
    padding: 16,
  },
  leaveBalanceValues: {
    alignItems: 'center',
    marginBottom: 16,
  },
  leaveBalanceMainValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  leaveBalanceNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  leaveBalanceDivider: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.textSecondary,
    marginHorizontal: 6,
  },
  leaveBalanceTotal: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  leaveBalanceUnit: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  leaveBalanceStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  leaveBalanceStatBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  leaveBalanceStatValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  leaveBalanceProgressBar: {
    height: 6,
    backgroundColor: '#E8EDF2',
    borderRadius: 3,
    overflow: 'hidden',
  },
  leaveBalanceProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default DashboardScreen;
