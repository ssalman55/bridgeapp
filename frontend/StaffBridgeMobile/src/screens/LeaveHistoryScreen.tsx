import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, HelperText } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import LeaveFilterBar from '../components/LeaveFilterBar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}



const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const LeaveHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false); // Set to true if fetching from API
  const [refreshing, setRefreshing] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { theme } = useTheme();

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
  };

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getLeaveHistory();
      console.log('Fetched leaves:', data); // Debug log
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.log('Error fetching leaves:', err); // Log error
      setError(err.message || 'Failed to fetch leaves');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves();
  };

  const filteredLeaves = leaves.filter((leave) => {
    const matchesTitle = leave.leaveType?.toLowerCase().includes(search.toLowerCase()) || leave.reason?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status ? (leave.status?.toLowerCase() === status.toLowerCase()) : true;
    return matchesTitle && matchesStatus;
  });

  const handleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Title style={[styles.screenTitle, { color: theme.colors.text }]}>My Leave History</Title>
        </View>

        <LeaveFilterBar
          activeStatus={status}
          onStatusChange={setStatus}
          searchQuery={search}
          onSearchChange={setSearch}
          onFilterPress={handleFilterPress}
        />
        <View style={[styles.tableHeader, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.headerCell, { flex: 3, color: theme.colors.text }]}>Leave Type</Text>
          <Text style={[styles.headerCell, { flex: 1, color: theme.colors.text }]}>Status</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <HelperText type="error" visible style={{ textAlign: 'center', marginTop: 32 }}>{error}</HelperText>
        ) : filteredLeaves.length === 0 ? (
          <Paragraph style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary }}>
            No leave records found.
          </Paragraph>
        ) : (
          filteredLeaves.map((leave, idx) => {
            const expanded = expandedId === (leave._id || idx.toString());
            return (
              <View key={leave._id || idx}>
                <TouchableOpacity
                  style={[
                    styles.tableRow, 
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                    idx % 2 === 0 && { backgroundColor: theme.colors.background }
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleExpand(leave._id || idx.toString())}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand details for ${leave.leaveType}`}
                >
                  <Text style={[styles.cell, { flex: 3, color: theme.colors.text }]} numberOfLines={2}>{leave.leaveType || '-'}</Text>
                  <View style={[styles.cell, { flex: 1 }]}> 
                    <Chip
                      style={{ 
                        backgroundColor: leave.status === 'Approved' ? theme.colors.success + '20' : 
                                     leave.status === 'Rejected' ? theme.colors.error + '20' : 
                                     theme.colors.warning + '20',
                        minWidth: 70, 
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: leave.status === 'Approved' ? theme.colors.success : 
                                   leave.status === 'Rejected' ? theme.colors.error : 
                                   theme.colors.warning,
                      }}
                      textStyle={{ 
                        color: leave.status === 'Approved' ? theme.colors.success : 
                               leave.status === 'Rejected' ? theme.colors.error : 
                               theme.colors.warning, 
                        fontWeight: '600', 
                        textAlign: 'center' 
                      }}
                    >
                      {typeof leave.status === 'string' ? leave.status : '-'}
                    </Chip>
                  </View>
                </TouchableOpacity>
                {expanded && (
                  <View style={[styles.expandedSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Leave Type:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{leave.leaveType || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Start Date:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{formatDate(leave.startDate)}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>End Date:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{formatDate(leave.endDate)}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Admin Comment:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{leave.adminComment || '-'}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  headerCell: {
    fontWeight: '600',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  cell: {
    fontSize: 15,
    marginRight: 8,
  },
  expandedSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  expandedRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  expandedLabel: {
    fontWeight: '600',
    width: 120,
  },
  expandedValue: {
    flex: 1,
    flexWrap: 'wrap',
  },
});

export default LeaveHistoryScreen; 