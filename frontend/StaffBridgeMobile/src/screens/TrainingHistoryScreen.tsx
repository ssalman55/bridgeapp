import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager, Animated } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, HelperText, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import { Linking } from 'react-native';
import TrainingFilterBar from '../components/TrainingFilterBar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}



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

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
  };

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
        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Title style={[styles.screenTitle, { color: theme.colors.text }]}>My Training Requests</Title>
        </View>

        <TrainingFilterBar
          activeStatus={status}
          onStatusChange={setStatus}
          searchQuery={search}
          onSearchChange={setSearch}
          onFilterPress={handleFilterPress}
        />
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
              <View key={req._id || idx} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  activeOpacity={0.7}
                  onPress={() => handleExpand(req._id || idx.toString())}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand details for ${req.trainingTitle}`}
                >
                  <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>{req.trainingTitle || '-'}</Text>
                  <View style={[
                    styles.badge, 
                    { 
                      backgroundColor: req.status === 'Approved' ? theme.colors.success + '20' : 
                                     req.status === 'Rejected' ? theme.colors.error + '20' : 
                                     theme.colors.warning + '20',
                      borderWidth: 1,
                      borderColor: req.status === 'Approved' ? theme.colors.success : 
                                 req.status === 'Rejected' ? theme.colors.error : 
                                 theme.colors.warning,
                    }
                  ]}>
                    <Text style={[
                      styles.badgeText, 
                      { 
                        color: req.status === 'Approved' ? theme.colors.success : 
                               req.status === 'Rejected' ? theme.colors.error : 
                               theme.colors.warning,
                      }
                    ]}>
                      {typeof req.status === 'string' ? req.status : '-'}
                    </Text>
                  </View>
                  <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.primary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Hosted By:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.hostedBy || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Location:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.location || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Number of Days:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.numberOfDays || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Requested At:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{formatDate(req.requestedDate)}</Text></View>
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Admin Comment:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.adminComment || '-'}</Text></View>
                    {/* Cost Breakdown */}
                    {req.costBreakdown && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailLabel, { marginBottom: 2, color: theme.colors.textSecondary }]}>Cost Breakdown:</Text>
                        <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Registration Fee:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{currency} {req.costBreakdown.registrationFee ?? '-'}</Text></View>
                        <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Travel Cost:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{currency} {req.costBreakdown.travelCost ?? '-'}</Text></View>
                        <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Accommodation Cost:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{currency} {req.costBreakdown.accommodationCost ?? '-'}</Text></View>
                        <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Meal Cost:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{currency} {req.costBreakdown.mealCost ?? '-'}</Text></View>
                        <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Other Cost:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{currency} {req.costBreakdown.otherCost ?? '-'}</Text></View>
                        {req.costBreakdown.otherCostDescription && (
                          <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Other Cost Desc:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.costBreakdown.otherCostDescription}</Text></View>
                        )}
                      </View>
                    )}
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Justification:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.justification || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Expected Outcomes:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.expectedOutcomes || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Benefit to Org:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.benefitToOrg || '-'}</Text></View>
                    <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Cover Requirements:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.coverRequirements || '-'}</Text></View>
                    {req.additionalNotes && (
                      <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Additional Notes:</Text><Text style={[styles.detailValue, { color: theme.colors.text }]}>{req.additionalNotes}</Text></View>
                    )}
                    {/* Attachment/Document Info */}
                    {Array.isArray(req.documents) && req.documents.length > 0 && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Documents:</Text>
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
                              <Text style={[styles.detailValue, { color: theme.colors.primary, textDecorationLine: 'underline' }]}>{doc.title || doc.originalname || 'View Document'}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                    {req.attachment && req.attachment.url && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Attachment:</Text>
                        <TouchableOpacity onPress={() => {/* TODO: implement download/open logic */}}>
                          <Text style={[styles.detailValue, { color: theme.colors.primary, textDecorationLine: 'underline' }]}>{req.attachment.originalname || 'View Attachment'}</Text>
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
  card: { borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', flex: 1 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginLeft: 8 },
  badgeText: { fontWeight: 'bold', fontSize: 13 },
  cardDetails: { marginTop: 10, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  detailLabel: { fontWeight: '500', fontSize: 14 },
  detailValue: { fontWeight: 'bold', fontSize: 14 },
});

export default TrainingHistoryScreen;