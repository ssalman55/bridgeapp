import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Text,
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

import { theme, spacing, typography } from '../theme/theme';

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
  postedBy: {
    firstName: string;
    lastName: string;
  };
  postedDate: string;
}

const DashboardScreen: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendance, setAttendance] = useState<{ checkIn?: string; checkOut?: string } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(true);
  const [attendanceActionLoading, setAttendanceActionLoading] = useState<boolean>(false);
  const [peerRecognitions, setPeerRecognitions] = useState<Array<{
    _id: string;
    submitter?: { fullName: string };
    recognized?: { fullName: string };
    comment: string;
    createdAt?: string;
  }>>([]);
  const [recognitionsLoading, setRecognitionsLoading] = useState<boolean>(true);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [bulletinsLoading, setBulletinsLoading] = useState<boolean>(true);

  const { state } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainTabParamList & SubmenuStackParamList>>();

  const loadDashboardData = async () => {
    try {
      // TODO: Replace with actual API calls
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
          recent: [
            {
              id: '1',
              title: 'Leave Approved',
              message: 'Your leave request for next week has been approved.',
              timestamp: '2 hours ago',
            },
            {
              id: '2',
              title: 'New Bulletin',
              message: 'Important company announcement has been posted.',
              timestamp: '1 day ago',
            },
          ],
        },
        upcoming: {
          leaves: [
            {
              id: '1',
              type: 'Annual Leave',
              startDate: '2024-01-15',
              endDate: '2024-01-17',
            },
          ],
          trainings: [
            {
              id: '1',
              title: 'Safety Training',
              date: '2024-01-20',
            },
          ],
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
      const data = await apiService.getTodayAttendance();
      console.log('Today attendance data:', data);
      setAttendance(data);
    } catch (error) {
      setAttendance(null);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchPeerRecognitions = async () => {
    setRecognitionsLoading(true);
    try {
      const data = await apiService.getPeerRecognitions(3);
      console.log('Peer recognitions data:', data);
      setPeerRecognitions(data);
    } catch (error) {
      setPeerRecognitions([]);
    } finally {
      setRecognitionsLoading(false);
    }
  };

  const fetchBulletins = async () => {
    setBulletinsLoading(true);
    try {
      const data = await apiService.getBulletins({ limit: 3 });
      // Defensive: sort by postedDate descending (missing dates go last), take only 3
      const sorted = (Array.isArray(data) ? data : [])
        .filter(b => b) // allow bulletins even if postedDate is missing
        .sort((a, b) => {
          if (!a.postedDate && !b.postedDate) return 0;
          if (!a.postedDate) return 1;
          if (!b.postedDate) return -1;
          return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
        })
        .slice(0, 3);
      setBulletins(sorted);
    } catch (error) {
      setBulletins([]);
    } finally {
      setBulletinsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    fetchAttendance();
    fetchPeerRecognitions();
    fetchBulletins();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
    fetchAttendance();
    fetchPeerRecognitions();
    fetchBulletins();
  };

  const handleAttendanceAction = async () => {
    setAttendanceActionLoading(true);
    try {
      if (!attendance || attendance.checkOut) {
        // Check In
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Location permission is required.');
          setAttendanceActionLoading(false);
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        await apiService.checkIn({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } else {
        // Check Out
        await apiService.checkOut();
      }
      await fetchAttendance();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update attendance.';
      Alert.alert('Error', message);
    } finally {
      setAttendanceActionLoading(false);
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    
    // Try to find the first sentence
    const firstSentence = content.match(/[^.!?]+[.!?]/);
    if (firstSentence && firstSentence[0].length <= maxLength) {
      return firstSentence[0].trim();
    }
    
    // Otherwise truncate at word boundary
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown date';
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={true}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={[styles.header, { flex: undefined }]}>
        <View>
          <Text style={[styles.greeting, { color: theme.colors.text }]}>
            {(() => {
              const user = state.user;
              if (user) {
                const fullName = (user.firstName && user.lastName)
                  ? `${user.firstName} ${user.lastName}`
                  : user.firstName || user.lastName || user.email || 'User';
                return `Welcome, ${fullName}`;
              }
              return 'Welcome, User';
            })()}
          </Text>
          <Text style={[styles.date, { color: theme.colors.textSecondary }]}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>
              {`${state.user?.firstName?.[0] || ''}${state.user?.lastName?.[0] || ''}`}
            </Text>
          </View>
        </View>
      </View>

      {dashboardData && (
        <>
          {/* Attendance Card */}
          <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Icon name="calendar-check" size={22} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={[typography.h3, { color: theme.colors.primary }]}>Today&apos;s Attendance</Text>
              </View>
              {attendanceLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <View style={styles.attendanceRow}>
                  <TouchableOpacity
                    onPress={handleAttendanceAction}
                    disabled={attendanceActionLoading}
                    style={[styles.attendanceButton, attendance && !attendance.checkOut ? styles.attendanceButtonCheckedIn : styles.attendanceButtonDefault]}
                  >
                    <Icon
                      name={attendance && !attendance.checkOut ? 'logout' : 'login'}
                      size={20}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.attendanceButtonText}>
                      {attendance && !attendance.checkOut ? 'Check Out' : 'Check In'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.attendanceInfo}>
                    {attendance && (
                      <>
                        <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>Check-in: {attendance.checkIn ? new Date(attendance.checkIn).toLocaleTimeString() : '--'}</Text>
                        {attendance.checkOut && (
                          <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>Check-out: {new Date(attendance.checkOut).toLocaleTimeString()}</Text>
                        )}
                        <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>Status: {attendance.checkOut ? 'Checked out' : 'Currently checked in'}</Text>
                      </>
                    )}
                    {!attendance && (
                      <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>Status: Not checked in</Text>
                    )}
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Peer Recognitions */}
          <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Icon name="account-star-outline" size={22} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={[typography.h3, { color: theme.colors.primary }]}>Peer Recognitions</Text>
              </View>
              {recognitionsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <View>
                  {peerRecognitions.length === 0 && (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>No recognitions yet.</Text>
                  )}
                  {peerRecognitions.map((rec, idx) => (
                    <View key={rec._id} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: idx < peerRecognitions.length - 1 ? 12 : 0 }}>
                      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>{rec.submitter?.fullName}</Text>
                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}> → </Text>
                        <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>{rec.recognized?.fullName}</Text>
                        <Text style={{ color: theme.colors.text, marginLeft: 4 }}>{rec.comment}</Text>
                      </View>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginLeft: 8, minWidth: 70, textAlign: 'right' }}>
                        {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-US') : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Bulletin Board */}
          <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="bullhorn" size={22} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[typography.h3, { color: theme.colors.primary }]}>📢 Bulletin Board</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('More', { screen: 'BulletinBoard' })}
                  style={styles.viewAllButton}
                >
                  <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
                </TouchableOpacity>
              </View>
              {bulletinsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <View>
                  {Array.isArray(bulletins) && bulletins.length === 0 ? (
                    <Text style={[styles.noBulletinsText, { color: theme.colors.textSecondary }]}>No bulletins yet.</Text>
                  ) : (
                    (bulletins || []).map((bulletin, idx) => {
                      const isLast = idx >= ((bulletins?.length || 0) - 1);
                      return (
                        <TouchableOpacity
                          key={bulletin._id}
                          style={[styles.bulletinCard, !isLast && { marginBottom: 12 }]}
                          onPress={() => navigation.navigate('More', { screen: 'BulletinBoard' })}
                        >
                          <View style={styles.bulletinHeader}>
                            <Text style={[styles.bulletinTitle, { color: theme.colors.text }]} numberOfLines={2}>
                              {bulletin.title}
                            </Text>
                            <Text style={[styles.bulletinDate, { color: theme.colors.textSecondary }]}>
                              {formatDate(bulletin.postedDate)}
                            </Text>
                          </View>
                          <Text style={[styles.bulletinAuthor, { color: theme.colors.textSecondary }]}>
                            Posted by {bulletin.postedBy
                              ? `${bulletin.postedBy.firstName || ''} ${bulletin.postedBy.lastName || ''}`.trim() || 'Admin'
                              : 'Admin'}
                          </Text>
                          <Text style={[styles.bulletinContent, { color: theme.colors.text }]} numberOfLines={3}>
                            {truncateContent(bulletin.content || '')}
                            {(bulletin.content || '').length > 100 && (
                              <Text style={[styles.readMoreText, { color: theme.colors.primary }]}>... Read More</Text>
                            )}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Quick Actions */}
          <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
            <Card.Content>
              <Text style={[typography.h3, { color: theme.colors.primary, marginBottom: 8 }]}>Quick Actions</Text>
              <View style={[styles.quickActions, { flexWrap: 'wrap', alignItems: 'flex-start' }]}>
                <TouchableOpacity onPress={() => navigation.navigate('Requests', { screen: 'TrainingRequest' })} style={styles.quickActionButtonModern}>
                  <Icon name="school" size={28} color={theme.colors.primary} />
                  <Text style={styles.quickActionLabel}>Training Request</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Requests', { screen: 'InventoryRequest' })} style={styles.quickActionButtonModern}>
                  <Icon name="cube-send" size={28} color={theme.colors.warning} />
                  <Text style={styles.quickActionLabel}>Inventory Request</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Requests', { screen: 'Payslip' })} style={styles.quickActionButtonModern}>
                  <Icon name="file-document" size={28} color={theme.colors.info} />
                  <Text style={styles.quickActionLabel}>Payslip</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Requests', { screen: 'ExpenseClaim' })} style={styles.quickActionButtonModern}>
                  <Icon name="cash-multiple" size={28} color={theme.colors.accent} />
                  <Text style={styles.quickActionLabel}>Expense Claim</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold' as const,
  },
  date: {
    fontSize: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold' as const,
  },
  sectionCard: {
    borderRadius: 16,
    elevation: 3,
    shadowColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginRight: 16,
    minWidth: 140,
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  attendanceButtonDefault: {
    backgroundColor: theme.colors.primary,
  },
  attendanceButtonCheckedIn: {
    backgroundColor: theme.colors.warning,
  },
  attendanceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  timeText: {
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButtonModern: {
    alignItems: 'center',
    margin: 8,
    minWidth: 100,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  quickActionLabel: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '10',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noBulletinsText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bulletinCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  bulletinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletinTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  bulletinDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  bulletinAuthor: {
    fontSize: 12,
    marginBottom: 8,
  },
  bulletinContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  readMoreText: {
    fontWeight: '600',
  },
});

export default DashboardScreen; 