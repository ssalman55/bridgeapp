import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, TextInput, HelperText, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const TrainingHistoryScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { theme } = useTheme();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (status) params.status = status;
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      const data = await apiService.getMyTrainingRequests(params);
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch training requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, startDate, endDate]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const filteredRequests = requests.filter((req) =>
    req.trainingTitle?.toLowerCase().includes(search.toLowerCase())
  );

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
            <Title style={[styles.cardTitle, { color: theme.colors.text }]}>My Training Requests</Title>
            <TextInput
              mode="outlined"
              placeholder="Search by title or type..."
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
            <View style={styles.dateRow}>
              <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateInput}>
                <Text style={styles.dateLabel}>From:</Text>
                <Text style={styles.dateValue}>{startDate ? startDate.toLocaleDateString() : 'mm/dd/yyyy'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateInput}>
                <Text style={styles.dateLabel}>To:</Text>
                <Text style={styles.dateValue}>{endDate ? endDate.toLocaleDateString() : 'mm/dd/yyyy'}</Text>
              </TouchableOpacity>
            </View>
            {showStartPicker && (
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                display="default"
                onChange={(_, date) => {
                  setShowStartPicker(false);
                  if (date) setStartDate(date);
                }}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                display="default"
                onChange={(_, date) => {
                  setShowEndPicker(false);
                  if (date) setEndDate(date);
                }}
              />
            )}
            <Button mode="outlined" onPress={fetchRequests} style={styles.filterBtn}>
              Apply Filters
            </Button>
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
        ) : filteredRequests.length === 0 ? (
          <Paragraph style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary }}>
            No training requests found.
          </Paragraph>
        ) : (
          filteredRequests.map((req, idx) => {
            const expanded = expandedId === (req._id || idx.toString());
            return (
              <View key={req._id || idx}>
                <TouchableOpacity
                  style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}
                  activeOpacity={0.7}
                  onPress={() => handleExpand(req._id || idx.toString())}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand details for ${req.trainingTitle}`}
                >
                  <Text style={[styles.cell, { flex: 3 }]} numberOfLines={2}>{req.trainingTitle || '-'}</Text>
                  <View style={[styles.cell, { flex: 1 }]}> 
                    <Chip
                      style={{ backgroundColor: req.status === 'Approved' ? '#B9F6CA' : req.status === 'Rejected' ? '#FF8A80' : '#FFF9C4', minWidth: 70, justifyContent: 'center' }}
                      textStyle={{ color: req.status === 'Approved' ? '#388E3C' : req.status === 'Rejected' ? '#C62828' : '#8D6E63', fontWeight: 'bold', textAlign: 'center' }}
                    >
                      {typeof req.status === 'string' ? req.status : '-'}
                    </Chip>
                  </View>
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Title:</Text>
                      <Text style={styles.expandedValue}>{req.trainingTitle || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Hosted By:</Text>
                      <Text style={styles.expandedValue}>{req.hostedBy || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Location:</Text>
                      <Text style={styles.expandedValue}>{req.location || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Number of Days:</Text>
                      <Text style={styles.expandedValue}>{req.numberOfDays || '-'}</Text>
                    </View>
                    {req.costBreakdown && (
                      <>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Training Fee:</Text>
                          <Text style={styles.expandedValue}>{req.costBreakdown.trainingFee || '-'}</Text>
                        </View>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Travel Cost:</Text>
                          <Text style={styles.expandedValue}>{req.costBreakdown.travelCost || '-'}</Text>
                        </View>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Hotel Cost:</Text>
                          <Text style={styles.expandedValue}>{req.costBreakdown.hotelCost || '-'}</Text>
                        </View>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Meal Cost:</Text>
                          <Text style={styles.expandedValue}>{req.costBreakdown.mealCost || '-'}</Text>
                        </View>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Other Cost:</Text>
                          <Text style={styles.expandedValue}>{req.costBreakdown.otherCost || '-'}</Text>
                        </View>
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Other Cost Desc:</Text>
                          <Text style={styles.expandedValue}>{req.costBreakdown.otherCostDesc || '-'}</Text>
                        </View>
                      </>
                    )}
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Justification:</Text>
                      <Text style={styles.expandedValue}>{req.justification || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Expected Outcomes:</Text>
                      <Text style={styles.expandedValue}>{req.expectedOutcomes || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Benefit to Org:</Text>
                      <Text style={styles.expandedValue}>{req.benefitToOrg || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Cover Requirements:</Text>
                      <Text style={styles.expandedValue}>{req.coverRequirements || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Additional Notes:</Text>
                      <Text style={styles.expandedValue}>{req.additionalNotes || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Status:</Text>
                      <Text style={styles.expandedValue}>{req.status || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Requested At:</Text>
                      <Text style={styles.expandedValue}>{formatDate(req.requestedDate)}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Admin Comment:</Text>
                      <Text style={styles.expandedValue}>{req.adminComment || '-'}</Text>
                    </View>
                    {/* Document Link */}
                    {Array.isArray(req.documents) && req.documents.length > 0 && req.documents[0] && (
                      <View style={styles.expandedRow}>
                        <Text style={styles.expandedLabel}>Document:</Text>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              const doc = req.documents[0];
                              const API_BASE_URL = 'http://10.0.2.2:5000/api';
                              const url = `${API_BASE_URL}/documents/${doc._id}/download`;
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
                          <Text style={[styles.expandedValue, { color: '#1976D2', textDecorationLine: 'underline' }]}>View Document</Text>
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
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginRight: 8,
    flex: 1,
  },
  dateLabel: {
    marginRight: 4,
    color: '#888',
  },
  dateValue: {
    color: '#222',
  },
  filterBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
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

export default TrainingHistoryScreen; 