import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, TextInput, HelperText } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
// import apiService from '../services/api'; // Uncomment and use when backend is ready

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

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
];

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
};

const ClaimsHistoryScreen: React.FC = () => {
  const [loading, setLoading] = useState(false); // Set to true if fetching from API
  const [refreshing, setRefreshing] = useState(false);
  const [claims, setClaims] = useState<any[]>(mockClaims); // Replace with API data
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { theme } = useTheme();

  // Uncomment and use when backend is ready
  // const fetchClaims = useCallback(async () => {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const data = await apiService.getMyClaims();
  //     setClaims(data);
  //   } catch (err: any) {
  //     setError(err.message || 'Failed to fetch claims');
  //   } finally {
  //     setLoading(false);
  //     setRefreshing(false);
  //   }
  // }, []);

  // useEffect(() => {
  //   fetchClaims();
  // }, [fetchClaims]);

  const onRefresh = () => {
    setRefreshing(true);
    // fetchClaims();
    setTimeout(() => setRefreshing(false), 800);
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.colors.text }]}>My Claims History</Title>
            <TextInput
              mode="outlined"
              placeholder="Search by title..."
              value={search}
              onChangeText={setSearch}
              style={styles.input}
              left={<TextInput.Icon icon="magnify" />}
            />
            <View style={styles.filterRow}>
              <View style={styles.statusFilter}>
                <Text style={styles.filterLabel}>Status:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {STATUS_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.value}
                      selected={status === opt.value}
                      onPress={() => setStatus(opt.value)}
                      style={styles.chip}
                    >
                      {opt.label}
                    </Chip>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Card.Content>
        </Card>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 3 }]}>Title</Text>
          <Text style={[styles.headerCell, { flex: 1 }]}>Status</Text>
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
                  style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}
                  activeOpacity={0.7}
                  onPress={() => handleExpand(claim._id || idx.toString())}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand details for ${claim.title}`}
                >
                  <Text style={[styles.cell, { flex: 3 }]} numberOfLines={2}>{claim.title || '-'}</Text>
                  <View style={[styles.cell, { flex: 1 }]}> 
                    <Chip
                      style={{ backgroundColor: claim.status === 'Approved' ? '#B9F6CA' : claim.status === 'Rejected' ? '#FF8A80' : '#FFF9C4', minWidth: 70, justifyContent: 'center' }}
                      textStyle={{ color: claim.status === 'Approved' ? '#388E3C' : claim.status === 'Rejected' ? '#C62828' : '#8D6E63', fontWeight: 'bold', textAlign: 'center' }}
                    >
                      {typeof claim.status === 'string' ? claim.status : '-'}
                    </Chip>
                  </View>
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Amount:</Text>
                      <Text style={styles.expandedValue}>{claim.amount != null ? `$${claim.amount}` : '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Submitted At:</Text>
                      <Text style={styles.expandedValue}>{formatDate(claim.submittedAt)}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Admin Comment:</Text>
                      <Text style={styles.expandedValue}>{claim.adminComment || '-'}</Text>
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
  input: {
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusFilter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    marginRight: 8,
    fontWeight: 'bold',
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  headerCell: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  cell: {
    fontSize: 15,
    color: '#222',
    marginRight: 4,
  },
  expandedSection: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderTopWidth: 0,
    marginBottom: 8,
  },
  expandedRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  expandedLabel: {
    fontWeight: 'bold',
    color: '#666',
    width: 120,
  },
  expandedValue: {
    color: '#222',
    flex: 1,
    flexWrap: 'wrap',
  },
});

export default ClaimsHistoryScreen; 