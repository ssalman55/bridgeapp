import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, HelperText, Button } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
// @ts-ignore
import apiService from '../services/api';
// @ts-ignore
import DateTimePicker from '@react-native-community/datetimepicker';

interface LeaveRequest {
  _id: string;
  startDate: string;
  endDate: string;
  leaveType?: string;
  reason: string;
  status: string;
  adminComment?: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  Pending: '#FFEB3B',
  Approved: '#4CAF50',
  Rejected: '#F44336',
  Cancelled: '#BDBDBD',
};

const statusTextColors: Record<string, string> = {
  Pending: '#795548',
  Approved: '#fff',
  Rejected: '#fff',
  Cancelled: '#fff',
};

const statusOptions = ['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'];

const LeaveHistoryScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const { state } = useAuth();
  const { theme } = useTheme();

  const fetchLeaveHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getLeaveHistory();
      setLeaveRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load leave history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaveHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaveHistory();
  };

  // Filtering logic
  const filteredRequests = leaveRequests.filter((req) => {
    const statusMatch = statusFilter === 'All' || req.status === statusFilter;
    const startMatch = !startDate || new Date(req.startDate) >= startDate;
    const endMatch = !endDate || new Date(req.endDate) <= endDate;
    return statusMatch && startMatch && endMatch;
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
        <Card.Content>
          <Title style={[styles.cardTitle, { color: theme.colors.text }]}>My Leave Requests</Title>
          <Paragraph style={[styles.description, { color: theme.colors.textSecondary }]}>View your past leave requests and their status</Paragraph>
        </Card.Content>
      </Card>
      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {statusOptions.map((status) => (
            <Chip
              key={status}
              selected={statusFilter === status}
              onPress={() => setStatusFilter(status)}
              style={{ marginRight: 8, backgroundColor: statusFilter === status ? theme.colors.primary : theme.colors.surface }}
              textStyle={{ color: statusFilter === status ? '#fff' : theme.colors.text }}
            >
              {status}
            </Chip>
          ))}
        </ScrollView>
      </View>
      <View style={styles.filtersRow}>
        <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateInput}>
          <Text style={{ color: theme.colors.textSecondary }}>{startDate ? startDate.toLocaleDateString() : 'Start Date'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateInput}>
          <Text style={{ color: theme.colors.textSecondary }}>{endDate ? endDate.toLocaleDateString() : 'End Date'}</Text>
        </TouchableOpacity>
        {(startDate || endDate) && (
          <Button onPress={() => { setStartDate(null); setEndDate(null); }} compact>Clear</Button>
        )}
      </View>
      {showStartPicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display="default"
          onChange={(_: any, date: any) => { setShowStartPicker(false); if (date) setStartDate(date); }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display="default"
          onChange={(_: any, date: any) => { setShowEndPicker(false); if (date) setEndDate(date); }}
        />
      )}
      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : error ? (
        <HelperText type="error" visible>{error}</HelperText>
      ) : filteredRequests.length === 0 ? (
        <View style={styles.emptyState}><Text style={{ color: theme.colors.textSecondary }}>No leave requests found.</Text></View>
      ) : (
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Start Date</Text>
            <Text style={styles.tableHeaderText}>End Date</Text>
            <Text style={styles.tableHeaderText}>Type</Text>
            <Text style={styles.tableHeaderText}>Reason</Text>
            <Text style={styles.tableHeaderText}>Status</Text>
            <Text style={styles.tableHeaderText}>Admin</Text>
            <Text style={styles.tableHeaderText}>Requested At</Text>
          </View>
          {filteredRequests.map((req) => (
            <View key={req._id} style={styles.tableRow}>
              <Text style={styles.tableCell}>{new Date(req.startDate).toLocaleDateString()}</Text>
              <Text style={styles.tableCell}>{new Date(req.endDate).toLocaleDateString()}</Text>
              <Text style={styles.tableCell}>{req.leaveType || '-'}</Text>
              <Text style={styles.tableCell}>{req.reason}</Text>
              <View style={styles.tableCell}>
                <View style={{ backgroundColor: statusColors[req.status] || '#BDBDBD', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
                  <Text style={{ color: statusTextColors[req.status] || '#222', fontWeight: 'bold', fontSize: 12 }}>{req.status}</Text>
                </View>
              </View>
              <Text style={styles.tableCell}>{req.adminComment || '-'}</Text>
              <Text style={styles.tableCell}>{new Date(req.createdAt).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { margin: 16, marginTop: 8, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  description: { fontSize: 14 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  dateInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 8, marginRight: 8, minWidth: 100, alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  emptyState: { alignItems: 'center', marginTop: 32 },
  tableContainer: { margin: 16, borderRadius: 12, backgroundColor: '#fff', elevation: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F5F5F5', paddingVertical: 8, paddingHorizontal: 4 },
  tableHeaderText: { flex: 1, fontWeight: 'bold', fontSize: 12, color: '#333', textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 8, paddingHorizontal: 4 },
  tableCell: { flex: 1, fontSize: 12, color: '#222', textAlign: 'center', justifyContent: 'center' },
});

export default LeaveHistoryScreen; 