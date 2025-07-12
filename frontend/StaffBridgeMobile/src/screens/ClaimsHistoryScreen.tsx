import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager, Linking } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, HelperText } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ClaimsFilterBar from '../components/ClaimsFilterBar';
const API_BASE_URL = 'http://10.0.2.2:5000/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Mock data for demonstration. Replace with API data.
const mockClaims = [
  {
    _id: '1',
    title: 'Travel Reimbursement',
    status: 'Approved',
    amount: 120.5,
    submittedAt: '2025-07-01T10:00:00Z',
    adminComment: 'Approved, good documentation.',
  },
  {
    _id: '2',
    title: 'Office Supplies',
    status: 'Pending',
    amount: 45.0,
    submittedAt: '2025-07-03T14:30:00Z',
    adminComment: '',
  },
  {
    _id: '3',
    title: 'Conference Fee',
    status: 'Rejected',
    amount: 300.0,
    submittedAt: '2025-06-28T09:15:00Z',
    adminComment: 'Not eligible for this period.',
  },
];



const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
};

const ClaimsHistoryScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claims, setClaims] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { theme } = useTheme();
  const [currency, setCurrency] = useState('QAR');

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
  };

  const fetchClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getMyExpenseClaims();
      setClaims(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch claims');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClaims();
    apiService.getSystemSettings().then(settings => {
      if (settings && settings.currency) setCurrency(settings.currency);
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClaims();
  };

  const filteredClaims = claims.filter((claim) => {
    const matchesTitle = claim.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status ? (claim.status?.toLowerCase() === status.toLowerCase()) : true;
    return matchesTitle && matchesStatus;
  });

  const handleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const getLatestAdminComment = (claim: any) => {
    if (Array.isArray(claim.approvalLogs) && claim.approvalLogs.length > 0) {
      // Get the latest log with a comment
      const latest = [...claim.approvalLogs].reverse().find((log) => log.comment);
      return latest?.comment || '';
    }
    return '';
  };

  const getAmount = (claim: any) => {
    if (typeof claim.totalAmount === 'number') return claim.totalAmount;
    if (Array.isArray(claim.itemizedExpenses)) {
      return claim.itemizedExpenses.reduce((sum: any, row: any) => sum + (parseFloat(row.amount) || 0), 0);
    }
    return 0;
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
          <Title style={[styles.screenTitle, { color: theme.colors.text }]}>My Claims History</Title>
        </View>

        <ClaimsFilterBar
          activeStatus={status}
          onStatusChange={setStatus}
          searchQuery={search}
          onSearchChange={setSearch}
          onFilterPress={handleFilterPress}
        />
        <View style={[styles.tableHeader, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.headerCell, { flex: 3, color: theme.colors.text }]}>Title</Text>
          <Text style={[styles.headerCell, { flex: 1, color: theme.colors.text }]}>Status</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <HelperText type="error" visible style={{ textAlign: 'center', marginTop: 32 }}>{error}</HelperText>
        ) : filteredClaims.length === 0 ? (
          <Paragraph style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary }}>
            No claims found.
          </Paragraph>
        ) : (
          filteredClaims.map((claim, idx) => {
            const expanded = expandedId === (claim._id || idx.toString());
            return (
              <View key={claim._id || idx}>
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
                  onPress={() => handleExpand(claim._id || idx.toString())}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand details for ${claim.title}`}
                >
                  <Text style={[styles.cell, { flex: 3, color: theme.colors.text }]} numberOfLines={2}>{claim.title || '-'}</Text>
                  <View style={[styles.cell, { flex: 1 }]}> 
                    <Chip
                      style={{ 
                        backgroundColor: claim.status === 'Approved' ? theme.colors.success + '20' : 
                                     claim.status === 'Rejected' ? theme.colors.error + '20' : 
                                     theme.colors.warning + '20',
                        minWidth: 70, 
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: claim.status === 'Approved' ? theme.colors.success : 
                                   claim.status === 'Rejected' ? theme.colors.error : 
                                   theme.colors.warning,
                      }}
                      textStyle={{ 
                        color: claim.status === 'Approved' ? theme.colors.success : 
                               claim.status === 'Rejected' ? theme.colors.error : 
                               theme.colors.warning, 
                        fontWeight: '600', 
                        textAlign: 'center' 
                      }}
                    >
                      {typeof claim.status === 'string' ? claim.status : '-'}
                    </Chip>
                  </View>
                </TouchableOpacity>
                {expanded && (
                  <View style={[styles.expandedSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Amount:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{getAmount(claim) != null ? `${currency} ${getAmount(claim).toLocaleString()}` : '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Submitted At:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{formatDate(claim.submittedAt)}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Admin Comment:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{getLatestAdminComment(claim) || '-'}</Text>
                    </View>
                    {/* Document Link */}
                    {Array.isArray(claim.documents) && claim.documents.length > 0 && claim.documents[0] && (
                      <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Document:</Text>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              const doc = claim.documents[0];
                              const url = `${API_BASE_URL}/documents/${doc._id}/download`;
                              // Get JWT token from SecureStore
                              const token = await (await import('expo-secure-store')).getItemAsync('auth_token');
                              const fileExt = doc.originalname ? doc.originalname.split('.').pop() : 'pdf';
                              const fileName = doc.originalname || `document.${fileExt}`;
                              const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
                              const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
                                headers: token ? { Authorization: `Bearer ${token}` } : {},
                              });
                              await Sharing.shareAsync(downloadRes.uri);
                            } catch (err) {
                              alert('Failed to download or open document.');
                            }
                          }}
                        >
                          <Text style={[styles.expandedValue, { color: theme.colors.primary, textDecorationLine: 'underline' }]}>View Document</Text>
                        </TouchableOpacity>
                      </View>
                    )}
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

export default ClaimsHistoryScreen; 