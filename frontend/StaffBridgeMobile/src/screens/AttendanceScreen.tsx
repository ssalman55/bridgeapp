import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  List,
  Divider,
  ActivityIndicator,
  Portal,
  Modal,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import apiService from '../services/api';

interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: 'present' | 'absent' | 'late' | 'half-day';
  location?: {
    latitude: number;
    longitude: number;
  };
  photo?: string;
}

interface AttendanceStatus {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  lastCheckIn?: string;
  lastCheckOut?: string;
  geofenceStatus?: 'inside' | 'outside' | 'not_applicable' | null;
}

const AttendanceScreen: React.FC = () => {
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [attendanceType, setAttendanceType] = useState<'in' | 'out'>('in');
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const { state } = useAuth();
  const { theme } = useTheme();

  const loadAttendanceHistory = async () => {
    try {
      // TODO: Replace with actual API call
      const mockData: AttendanceRecord[] = [
        {
          id: '1',
          date: '2024-01-15',
          checkInTime: '09:00 AM',
          checkOutTime: '05:30 PM',
          status: 'present',
        },
        {
          id: '2',
          date: '2024-01-14',
          checkInTime: '09:15 AM',
          checkOutTime: '05:00 PM',
          status: 'late',
        },
        {
          id: '3',
          date: '2024-01-13',
          checkInTime: '08:45 AM',
          checkOutTime: '05:30 PM',
          status: 'present',
        },
      ];
      setAttendanceHistory(mockData);
    } catch (error) {
      console.error('Error loading attendance history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAttendanceStatus = async () => {
    setStatusLoading(true);
    try {
      const status = await apiService.getAttendanceStatus();
      setAttendanceStatus(status);
    } catch (error) {
      console.error('Error fetching attendance status:', error);
      setAttendanceStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceHistory();
    fetchAttendanceStatus();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAttendanceHistory();
    fetchAttendanceStatus();
  };

  const getCurrentLocation = async () => {
    try {
      // Check if location services are enabled
      const locationEnabled = await Location.hasServicesEnabledAsync();
      if (!locationEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Location services are disabled on your device. Please enable location services in your device settings to mark attendance.\n\nSince geofencing is enabled, location is required for attendance check-in.',
          [{ text: 'OK' }]
        );
        return null;
      }

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Location permission is required for check-in, especially when geofencing is enabled. Please grant location permission in your device settings.',
          [{ text: 'OK' }]
        );
        return null;
      }

      // Get current location with progressive accuracy and retry logic
      let currentLocation;
      let lastError: any = null;
      
      // Strategy: Try multiple accuracy levels, starting with lowest (fastest, most likely to work)
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
          return lastKnown;
        }
      } catch (err) {
        console.log('Last known position not available, will try fresh location');
      }
      
      // If we don't have location yet, try getting fresh location with progressive accuracy
      for (let accuracyIndex = 0; accuracyIndex < accuracyLevels.length; accuracyIndex++) {
        const accuracy = accuracyLevels[accuracyIndex];
        const maxRetries = 2; // 2 retries per accuracy level
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`Location attempt ${attempt}/${maxRetries} with accuracy: ${Location.Accuracy[accuracy] || accuracy}`);
            
            currentLocation = await Location.getCurrentPositionAsync({
              accuracy: accuracy,
              timeout: accuracy === Location.Accuracy.Lowest ? 10000 : 20000, // Lower accuracy gets shorter timeout
              maximumAge: accuracy === Location.Accuracy.Lowest ? 30000 : 10000, // Accept older locations for lower accuracy
            });
            
            if (currentLocation && currentLocation.coords) {
              console.log('Location retrieved successfully:', {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                accuracy: currentLocation.coords.accuracy,
                accuracyLevel: Location.Accuracy[accuracy] || accuracy
              });
              return currentLocation;
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
        if (currentLocation && currentLocation.coords) {
          break;
        }
        
        // Wait before trying next accuracy level
        if (accuracyIndex < accuracyLevels.length - 1) {
          console.log('Trying next accuracy level...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // If all retries failed
      const errorMessage = lastError?.message || 'Unable to get your location after multiple attempts';
      console.error('Location error after retries:', lastError);
      
      Alert.alert(
        'Location Unavailable',
        `${errorMessage}\n\nPlease ensure:\n• Location services are enabled in device settings\n• GPS/Wi-Fi location is turned on\n• You're in an area with good signal\n• Try moving to an area with better GPS reception`,
        [{ text: 'OK' }]
      );
      return null;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unable to get your current location';
      console.error('Error getting location:', error);
      
      Alert.alert(
        'Location Unavailable',
        `${errorMessage}\n\nPlease ensure:\n• Location services are enabled\n• GPS/Wi-Fi location is turned on\n• You're in an area with good signal\n• Try again in a few seconds`,
        [{ text: 'OK' }]
      );
      return null;
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Camera permission is required to take attendance photo.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Camera Error', 'Unable to take photo.');
      return null;
    }
  };

  const markAttendance = async (type: 'in' | 'out') => {
    setAttendanceType(type);
    setModalVisible(true);
  };

  const confirmAttendance = async () => {
    setMarkingAttendance(true);
    try {
      if (attendanceType === 'in') {
        // Check In with location
        const currentLocation = await getCurrentLocation();
        if (!currentLocation) {
          setMarkingAttendance(false);
          return;
        }

        try {
          await apiService.checkIn({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
          
          Alert.alert('Success', 'Successfully checked in!');
        } catch (error: any) {
          // Handle geofencing errors
          if (error.message && error.message.includes('must be at')) {
            Alert.alert('Location Restriction', error.message);
          } else {
            Alert.alert('Error', error.message || 'Failed to check in. Please try again.');
          }
          setMarkingAttendance(false);
          return;
        }
      } else {
        // Check Out (no location needed)
        await apiService.checkOut();
        Alert.alert('Success', 'Successfully checked out!');
      }

      setModalVisible(false);
      await fetchAttendanceStatus(); // Refresh the status
      loadAttendanceHistory(); // Refresh the list
    } catch (error) {
      console.error('Error marking attendance:', error);
      Alert.alert('Error', 'Failed to mark attendance. Please try again.');
    } finally {
      setMarkingAttendance(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return theme.colors.success;
      case 'late':
        return theme.colors.warning;
      case 'absent':
        return theme.colors.error;
      case 'half-day':
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAttendanceStatusText = () => {
    if (!attendanceStatus) return 'Not Checked In';
    
    if (attendanceStatus.isCheckedOut) {
      return 'Checked Out';
    }
    
    if (attendanceStatus.isCheckedIn) {
      switch (attendanceStatus.geofenceStatus) {
        case 'inside':
          return 'Checked In (Geofence Location)';
        case 'outside':
          return 'Checked In (Remotely)';
        case 'not_applicable':
        case null:
        default:
          return 'Checked In (Location Not Tracked)';
      }
    }
    
    return 'Not Checked In';
  };

  const getAttendanceStatusColor = () => {
    if (!attendanceStatus) return theme.colors.error;
    
    if (attendanceStatus.isCheckedOut) {
      return theme.colors.warning;
    }
    
    if (attendanceStatus.isCheckedIn) {
      switch (attendanceStatus.geofenceStatus) {
        case 'inside':
          return theme.colors.success;
        case 'outside':
          return theme.colors.warning;
        case 'not_applicable':
        case null:
        default:
          return theme.colors.info;
      }
    }
    
    return theme.colors.error;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Today's Status */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.colors.text }]}>
              Today&apos;s Attendance
            </Title>
            <View style={styles.todayStatus}>
              {statusLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Chip
                  mode="outlined"
                  textStyle={{ color: getAttendanceStatusColor() }}
                  style={[styles.statusChip, { borderColor: getAttendanceStatusColor() }]}
                >
                  {getAttendanceStatusText()}
                </Chip>
              )}
              <Paragraph style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Paragraph>
              {attendanceStatus && attendanceStatus.isCheckedIn && attendanceStatus.lastCheckIn && (
                <Paragraph style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                  Check-in: {new Date(attendanceStatus.lastCheckIn).toLocaleTimeString()}
                </Paragraph>
              )}
              {attendanceStatus && attendanceStatus.isCheckedOut && attendanceStatus.lastCheckOut && (
                <Paragraph style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                  Check-out: {new Date(attendanceStatus.lastCheckOut).toLocaleTimeString()}
                </Paragraph>
              )}
            </View>
            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                icon="login"
                onPress={() => markAttendance('in')}
                disabled={attendanceStatus?.isCheckedIn && !attendanceStatus?.isCheckedOut}
                style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                contentStyle={styles.actionButtonContent}
              >
                Check In
              </Button>
              <Button
                mode="contained"
                icon="logout"
                onPress={() => markAttendance('out')}
                disabled={!attendanceStatus?.isCheckedIn || attendanceStatus?.isCheckedOut}
                style={[styles.actionButton, { backgroundColor: theme.colors.warning }]}
                contentStyle={styles.actionButtonContent}
              >
                Check Out
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Attendance History */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.colors.text }]}>
              Attendance History
            </Title>
            {attendanceHistory.map((record, index) => (
              <React.Fragment key={record.id}>
                <List.Item
                  title={formatDate(record.date)}
                  description={
                    <View>
                      <Paragraph style={[styles.recordText, { color: theme.colors.textSecondary }]}>
                        {record.checkInTime && `Check-in: ${record.checkInTime}`}
                        {record.checkOutTime && ` | Check-out: ${record.checkOutTime}`}
                      </Paragraph>
                      <Chip
                        mode="outlined"
                        textStyle={{ color: getStatusColor(record.status) }}
                        style={[
                          styles.statusChip,
                          { borderColor: getStatusColor(record.status) },
                        ]}
                      >
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </Chip>
                    </View>
                  }
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={record.status === 'present' ? 'check-circle' : 'clock-outline'}
                      color={getStatusColor(record.status)}
                    />
                  )}
                  titleStyle={[styles.recordTitle, { color: theme.colors.text }]}
                />
                {index < attendanceHistory.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Attendance Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Title style={[styles.modalTitle, { color: theme.colors.text }]}>
            Mark {attendanceType === 'in' ? 'Check-in' : 'Check-out'}
          </Title>
          <Paragraph style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
            {attendanceType === 'in' 
              ? 'Please confirm your check-in. Your location will be recorded and geofencing rules will be applied.'
              : 'Please confirm your check-out.'
            }
          </Paragraph>
          
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmAttendance}
              loading={markingAttendance}
              disabled={markingAttendance}
              style={styles.modalButton}
            >
              Confirm
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    marginBottom: 16,
  },
  todayStatus: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusChip: {
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  actionButtonContent: {
    paddingVertical: 8,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordText: {
    fontSize: 14,
    marginBottom: 8,
  },
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});

export default AttendanceScreen; 