import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Card } from 'react-native-paper';
import apiService from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography } from '../theme/theme';

interface AttendanceRecord {
  _id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
}

const AttendanceHistoryScreen: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await apiService.getAttendanceHistory();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusLabel = (rec: AttendanceRecord) => {
    if (rec.status === 'absent') return 'Absent';
    if (!rec.checkIn && !rec.checkOut) return 'Not a workday';
    if (!rec.checkIn) return 'No Check In';
    if (!rec.checkOut) return 'No Check Out';
    return rec.status ? rec.status.charAt(0).toUpperCase() + rec.status.slice(1) : 'Present';
  };

  const getStatusStyle = (rec: AttendanceRecord) => {
    if (rec.status === 'absent') return { color: theme.colors.error, fontStyle: 'italic' as const };
    if (!rec.checkIn && !rec.checkOut) return { color: theme.colors.textSecondary, fontStyle: 'italic' as const };
    if (!rec.checkIn || !rec.checkOut) return { color: theme.colors.placeholder };
    if (rec.status === 'late') return { color: theme.colors.warning };
    return { color: theme.colors.success };
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Text style={[typography.h2, styles.header, { color: theme.colors.primary }]}>Attendance History</Text>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>No attendance records found.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2, color: theme.colors.primary }]}>Date</Text>
            <Text style={[styles.th, { flex: 2, color: theme.colors.primary }]}>Check In</Text>
            <Text style={[styles.th, { flex: 2, color: theme.colors.primary }]}>Check Out</Text>
            <Text style={[styles.th, { flex: 1.5, color: theme.colors.primary }]}>Status</Text>
          </View>
          {records.map((rec, idx) => {
            const isEven = idx % 2 === 0;
            return (
              <View
                key={rec._id || idx}
                style={[styles.row, {
                  backgroundColor: isEven ? theme.colors.surface : theme.colors.background,
                  borderRadius: 12,
                  marginBottom: 8,
                  shadowColor: theme.colors.primary,
                  shadowOpacity: 0.04,
                  shadowRadius: 2,
                  elevation: 1,
                }]}
              >
                <Text style={[styles.td, { flex: 2 }]}>{formatDate(rec.date)}</Text>
                <Text style={[styles.td, { flex: 2, color: rec.checkIn ? theme.colors.text : theme.colors.placeholder, fontStyle: rec.checkIn ? 'normal' as const : 'italic' as const }]}>
                  {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </Text>
                <Text style={[styles.td, { flex: 2, color: rec.checkOut ? theme.colors.text : theme.colors.placeholder, fontStyle: rec.checkOut ? 'normal' as const : 'italic' as const }]}>
                  {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </Text>
                <Text style={[styles.td, { flex: 1.5 }, getStatusStyle(rec)]}>{getStatusLabel(rec)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 48,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: '#F0F4FA',
    borderRadius: 10,
    marginBottom: 8,
    marginHorizontal: spacing.md,
  },
  th: {
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'left',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
  },
  td: {
    fontSize: 15,
    textAlign: 'left',
  },
});

export default AttendanceHistoryScreen; 