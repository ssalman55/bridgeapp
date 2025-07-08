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

const AttendanceScreen: React.FC = () => {
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [attendanceType, setAttendanceType] = useState<'in' | 'out'>('in');

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

  useEffect(() => {
    loadAttendanceHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAttendanceHistory();
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to mark attendance.');
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      return currentLocation;
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Unable to get your current location.');
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
      const currentLocation = await getCurrentLocation();
      const attendancePhoto = await takePhoto();

      if (!currentLocation) {
        setMarkingAttendance(false);
        return;
      }

      Alert.alert(
        'Success',
        `Successfully marked ${attendanceType === 'in' ? 'check-in' : 'check-out'}!`
      );

      setModalVisible(false);
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
              <Chip
                mode="outlined"
                textStyle={{ color: theme.colors.primary }}
                style={[styles.statusChip, { borderColor: theme.colors.primary }]}
              >
                Not Checked In
              </Chip>
              <Paragraph style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Paragraph>
            </View>
            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                icon="login"
                onPress={() => markAttendance('in')}
                style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                contentStyle={styles.actionButtonContent}
              >
                Check In
              </Button>
              <Button
                mode="contained"
                icon="logout"
                onPress={() => markAttendance('out')}
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
            Please confirm your {attendanceType === 'in' ? 'check-in' : 'check-out'} with location and photo.
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