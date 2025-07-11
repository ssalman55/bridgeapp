import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager, Animated } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, TextInput, HelperText, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import { Linking } from 'react-native';

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currency, setCurrency] = useState('QAR');
  const { theme } = useTheme();
  const navigation = useNavigation();

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
    apiService.getSystemSettings().then(settings => {
      if (settings && settings.currency) setCurrency(settings.currency);
    });
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
        {/* Sticky Header */}
        <View style={styles.stickyHeader}>
          <Title style={styles.headerTitle}>My Training Requests</Title>
        </View>
        {/* Collapsible Filters */}
        <TouchableOpacity
          style={styles.filterAccordion}
          onPress={() => setFiltersOpen((open) => !open)}
          accessibilityLabel="Toggle filters"
        >
          <Text style={styles.filterAccordionLabel}>Filters</Text>
          <Icon name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#1976D2" />
        </TouchableOpacity>
        {filtersOpen && (
          <View style={styles.filterSection}>
            <TextInput
              mode="outlined"
              placeholder="Search by title or type..."
              value={search}
              onChangeText={setSearch}
              style={styles.input}
              left={<TextInput.Icon icon="magnify" />}
            />
            {/* Status Pills Row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusPillsRow} contentContainerStyle={{paddingRight: 4}}>
              {STATUS_OPTIONS.map((opt, idx) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.statusPill, status === opt.value && styles.statusPillSelected, idx !== STATUS_OPTIONS.length - 1 && { marginRight: 8 }]}
                  onPress={() => setStatus(opt.value)}
                >
                  <Text style={[styles.statusPillText, status === opt.value && styles.statusPillTextSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.datePickersRow}>
              <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateInput}>
                <Icon name="calendar" size={18} color="#1976D2" style={{ marginRight: 6 }} />
                <Text style={styles.dateLabel}>From:</Text>
                <Text style={styles.dateValue}>{startDate ? startDate.toLocaleDateString() : 'mm/dd/yyyy'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateInput}>
                <Icon name="calendar" size={18} color="#1976D2" style={{ marginRight: 6 }} />
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
            <Button mode="contained" onPress={fetchRequests} style={styles.applyFiltersBtn}>
              Apply Filters
            </Button>
          </View>
        )}
        {/* List Section: Modern Cards */}
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
              <View key={req._id || idx} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  activeOpacity={0.7}
                  onPress={() => handleExpand(req._id || idx.toString())}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand details for ${req.trainingTitle}`}
                >
                  <Text style={styles.cardTitle}>{req.trainingTitle || '-'}</Text>
                  <View style={[styles.badge, req.status === 'Approved' ? styles.badgeApproved : req.status === 'Rejected' ? styles.badgeRejected : styles.badgePending]}>
                    <Text style={[styles.badgeText, req.status === 'Approved' ? styles.badgeTextApproved : req.status === 'Rejected' ? styles.badgeTextRejected : styles.badgeTextPending]}>
                      {typeof req.status === 'string' ? req.status : '-'}
                    </Text>
                  </View>
                  <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#1976D2" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Hosted By:</Text><Text style={styles.detailValue}>{req.hostedBy || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Location:</Text><Text style={styles.detailValue}>{req.location || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Number of Days:</Text><Text style={styles.detailValue}>{req.numberOfDays || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Requested At:</Text><Text style={styles.detailValue}>{formatDate(req.requestedDate)}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Admin Comment:</Text><Text style={styles.detailValue}>{req.adminComment || '-'}</Text></View>
                    {/* Cost Breakdown */}
                    {req.costBreakdown && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailLabel, { marginBottom: 2 }]}>Cost Breakdown:</Text>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Registration Fee:</Text><Text style={styles.detailValue}>{currency} {req.costBreakdown.registrationFee ?? '-'}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Travel Cost:</Text><Text style={styles.detailValue}>{currency} {req.costBreakdown.travelCost ?? '-'}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Accommodation Cost:</Text><Text style={styles.detailValue}>{currency} {req.costBreakdown.accommodationCost ?? '-'}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Meal Cost:</Text><Text style={styles.detailValue}>{currency} {req.costBreakdown.mealCost ?? '-'}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Other Cost:</Text><Text style={styles.detailValue}>{currency} {req.costBreakdown.otherCost ?? '-'}</Text></View>
                        {req.costBreakdown.otherCostDescription && (
                          <View style={styles.detailRow}><Text style={styles.detailLabel}>Other Cost Desc:</Text><Text style={styles.detailValue}>{req.costBreakdown.otherCostDescription}</Text></View>
                        )}
                      </View>
                    )}
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Justification:</Text><Text style={styles.detailValue}>{req.justification || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Expected Outcomes:</Text><Text style={styles.detailValue}>{req.expectedOutcomes || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Benefit to Org:</Text><Text style={styles.detailValue}>{req.benefitToOrg || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Cover Requirements:</Text><Text style={styles.detailValue}>{req.coverRequirements || '-'}</Text></View>
                    {req.additionalNotes && (
                      <View style={styles.detailRow}><Text style={styles.detailLabel}>Additional Notes:</Text><Text style={styles.detailValue}>{req.additionalNotes}</Text></View>
                    )}
                    {/* Attachment/Document Info */}
                    {Array.isArray(req.documents) && req.documents.length > 0 && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Documents:</Text>
                        <View style={{ flex: 1 }}>
                          {req.documents.map((doc: any, i: number) => (
                            <TouchableOpacity
                              key={doc._id || i}
                              onPress={async () => {
                                try {
                                  const url = await apiService.getDocumentDownloadUrl(doc._id);
                                  const fileExt = doc.originalname ? doc.originalname.split('.').pop() : 'pdf';
                                  const fileName = doc.originalname || `document.${fileExt}`;
                                  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
                                  const downloadRes = await FileSystem.downloadAsync(url, fileUri);
                                  await Sharing.shareAsync(downloadRes.uri);
                                } catch (err) {
                                  alert('Failed to download or open document.');
                                }
                              }}
                              style={{ marginBottom: 4 }}
                            >
                              <Text style={[styles.detailValue, { color: '#1976D2', textDecorationLine: 'underline' }]}>{doc.title || doc.originalname || 'View Document'}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                    {req.attachment && req.attachment.url && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Attachment:</Text>
                        <TouchableOpacity onPress={() => {/* TODO: implement download/open logic */}}>
                          <Text style={[styles.detailValue, { color: '#1976D2', textDecorationLine: 'underline' }]}>{req.attachment.originalname || 'View Attachment'}</Text>
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
  stickyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, backgroundColor: '#fff', zIndex: 10 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#222' },
  filterAccordion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7F9FB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginBottom: 8, marginTop: 8, elevation: 1 },
  filterAccordionLabel: { fontWeight: 'bold', fontSize: 16, color: '#1976D2' },
  filterSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12, gap: 12, elevation: 2 },
  input: { marginBottom: 8 },
  statusPillsRow: { flexDirection: 'row', marginBottom: 8 },
  statusPill: { borderRadius: 16, borderWidth: 1, borderColor: '#1976D2', paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, backgroundColor: '#fff' },
  statusPillSelected: { backgroundColor: '#1976D2' },
  statusPillText: { color: '#1976D2', fontWeight: 'bold' },
  statusPillTextSelected: { color: '#fff' },
  datePickersRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dateInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 8, marginRight: 8, backgroundColor: '#F7F9FB', flex: 1 },
  dateLabel: { marginRight: 4, color: '#888', fontWeight: '500' },
  dateValue: { color: '#222', fontWeight: 'bold' },
  applyFiltersBtn: { marginTop: 8, alignSelf: 'flex-end', borderRadius: 8 },
  card: { borderRadius: 16, backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1976D2', flex: 1 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginLeft: 8 },
  badgeApproved: { backgroundColor: '#B9F6CA' },
  badgePending: { backgroundColor: '#FFF9C4' },
  badgeRejected: { backgroundColor: '#FFCDD2' },
  badgeText: { fontWeight: 'bold', fontSize: 13 },
  badgeTextApproved: { color: '#388E3C' },
  badgeTextPending: { color: '#8D6E63' },
  badgeTextRejected: { color: '#C62828' },
  cardDetails: { marginTop: 10, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  detailLabel: { color: '#888', fontWeight: '500', fontSize: 14 },
  detailValue: { color: '#222', fontWeight: 'bold', fontSize: 14 },
});

export default TrainingHistoryScreen;