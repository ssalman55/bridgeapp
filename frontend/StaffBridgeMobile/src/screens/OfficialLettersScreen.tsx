import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { Card, Title, ActivityIndicator, HelperText, Button, TextInput as PaperTextInput, Chip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import LetterFilterBar from '../components/LetterFilterBar';

interface LetterTemplate {
  _id: string;
  name: string;
  description?: string;
  category?: {
    _id: string;
    name: string;
    color?: string;
    icon?: string;
  };
  requiresApproval?: boolean;
}

interface LetterRequest {
  _id: string;
  requestNumber: string;
  template: {
    _id: string;
    name: string;
    description?: string;
  };
  category?: {
    name: string;
    color?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'generated';
  requestMessage?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  isUrgent?: boolean;
  dueDate?: string;
  createdAt: string;
  generatedDocument?: {
    filename?: string;
    originalName?: string;
    s3Key?: string;
    fileUrl?: string;
  };
  approvalDetails?: {
    approvedBy?: { fullName: string };
    approvedAt?: string;
    rejectedBy?: { fullName: string };
    rejectedAt?: string;
    rejectionReason?: string;
  };
}

const OfficialLettersScreen: React.FC = ({ route }: any) => {
  const { state } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<LetterRequest[]>([]);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Request form state
  const [requestMessage, setRequestMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isUrgent, setIsUrgent] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Listen for navigation params to open template selection
  useEffect(() => {
    if (route.params?.openRequestModal) {
      setShowTemplateModal(true);
      fetchTemplates();
      navigation.setParams({ openRequestModal: undefined });
    }
  }, [route.params]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getMyLetterRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[OfficialLetters] Error fetching requests:', err);
      Alert.alert('Error', err.message || 'Failed to fetch letter requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await apiService.getLetterTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[OfficialLetters] Error fetching templates:', err);
      Alert.alert('Error', err.message || 'Failed to fetch letter templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleRequestTemplate = (template: LetterTemplate) => {
    setSelectedTemplate(template);
    // Reset form
    setRequestMessage('');
    setPriority('medium');
    setIsUrgent(false);
    setDueDate(null);
    setShowTemplateModal(false);
    setShowRequestModal(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedTemplate) return;

    setSubmitting(true);
    try {
      console.log('[OfficialLetters] Submitting request:', {
        template: selectedTemplate._id,
        employee: state.user?._id || state.user?.id,
        requestMessage: requestMessage.trim() || undefined,
        priority,
        isUrgent,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
      });

      const response = await apiService.createLetterRequest({
        template: selectedTemplate._id,
        employee: state.user?._id || state.user?.id,
        requestMessage: requestMessage.trim() || undefined,
        priority,
        isUrgent,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
      });

      console.log('[OfficialLetters] Request submitted successfully:', response);

      Alert.alert(
        'Success',
        'Letter request submitted successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowRequestModal(false);
              setSelectedTemplate(null);
              fetchRequests();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('[OfficialLetters] Error submitting request:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to submit letter request';
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (request: LetterRequest) => {
    if (!request.generatedDocument) {
      Alert.alert('Info', 'Document not yet generated. Please wait for approval and generation.');
      return;
    }

    if (request.status !== 'generated') {
      Alert.alert('Info', 'Document is not yet available for download. Status: ' + getStatusLabel(request.status));
      return;
    }

    try {
      Alert.alert(
        'Download',
        'This will download the letter document. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download',
            onPress: async () => {
              try {
                const downloadData = await apiService.downloadLetterDocument(request._id);
                const downloadUrl = downloadData.downloadUrl;
                const fileName = downloadData.fileName || `letter-${request.requestNumber}.pdf`;

                // Download file
                const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
                const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);

                // Share/Open file
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(downloadResult.uri);
                } else {
                  await Linking.openURL(downloadUrl);
                }
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to download document');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to download document');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generated':
        return '#4CAF50'; // Green
      case 'approved':
        return '#2196F3'; // Blue
      case 'pending':
        return '#FF9800'; // Orange
      case 'rejected':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Grey
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'generated':
        return 'Generated';
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const filteredRequests = requests.filter((req) => {
    const search = searchQuery.toLowerCase();
    const matchesSearch = 
      req.template?.name?.toLowerCase().includes(search) ||
      req.requestNumber?.toLowerCase().includes(search) ||
      req.requestMessage?.toLowerCase().includes(search);
    
    const matchesStatus = statusFilter ? req.status === statusFilter : true;
    
    return matchesSearch && matchesStatus;
  });

  const filteredTemplates = templates.filter((template) => {
    const search = searchQuery.toLowerCase();
    return (
      template.name?.toLowerCase().includes(search) ||
      template.description?.toLowerCase().includes(search)
    );
  });

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
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
          <Title style={[styles.screenTitle, { color: theme.colors.text }]}>My Official Letters</Title>
        </View>

        <LetterFilterBar
          activeStatus={statusFilter}
          onStatusChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterPress={handleFilterPress}
        />

        {/* List Section */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : filteredRequests.length === 0 ? (
          <HelperText type="info" visible style={{ textAlign: 'center', marginTop: 32, marginHorizontal: 16 }}>
            {searchQuery || statusFilter ? 'No requests found matching your filters.' : 'No letter requests found.'}
          </HelperText>
        ) : (
          filteredRequests.map((request) => (
            <Card
              key={request._id}
              style={[styles.requestCard, { backgroundColor: theme.colors.surface }]}
            >
              <Card.Content>
                <View style={styles.requestHeader}>
                  <View style={styles.requestTitleRow}>
                    <Icon name="file-document" size={24} color={theme.colors.primary} />
                    <View style={styles.requestTitleContainer}>
                      <Text style={[styles.requestTitle, { color: theme.colors.text }]}>
                        {request.template?.name || 'Unknown Template'}
                      </Text>
                      <Text style={[styles.requestNumber, { color: theme.colors.textSecondary }]}>
                        {request.template?.name} • {request.requestNumber}
                      </Text>
                    </View>
                  </View>
                  <Chip
                    style={[
                      styles.statusChip,
                      { backgroundColor: getStatusColor(request.status) + '20' },
                    ]}
                    textStyle={{ color: getStatusColor(request.status), fontSize: 12, fontWeight: '600' }}
                  >
                    {getStatusLabel(request.status)}
                  </Chip>
                </View>

                <Text style={[styles.requestDate, { color: theme.colors.textSecondary }]}>
                  Requested on {formatDate(request.createdAt)}
                </Text>

                {request.requestMessage && (
                  <Text style={[styles.requestMessage, { color: theme.colors.text }]} numberOfLines={2}>
                    {request.requestMessage}
                  </Text>
                )}

                {request.dueDate && (
                  <View style={styles.dueDateRow}>
                    <Icon name="calendar-clock" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.dueDateText, { color: theme.colors.textSecondary }]}>
                      Due: {formatDate(request.dueDate)}
                    </Text>
                  </View>
                )}

                {request.status === 'generated' && request.generatedDocument && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: theme.colors.primary }]}
                      onPress={() => handleDownload(request)}
                    >
                      <Icon name="download" size={20} color={theme.colors.primary} />
                      <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
                        Download
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {request.status === 'approved' && (
                  <View style={[styles.infoBox, { backgroundColor: theme.colors.warning + '10' }]}>
                    <Icon name="information" size={16} color={theme.colors.warning} />
                    <Text style={[styles.infoText, { color: theme.colors.text }]}>
                      {request.generatedDocument 
                        ? 'Your request has been approved. Document generation is in progress.'
                        : 'Your request has been approved. Please wait for document generation.'}
                    </Text>
                  </View>
                )}

                {request.approvalDetails?.rejectionReason && (
                  <View style={[styles.rejectionBox, { backgroundColor: theme.colors.error + '10' }]}>
                    <Text style={[styles.rejectionLabel, { color: theme.colors.error }]}>
                      Rejection Reason:
                    </Text>
                    <Text style={[styles.rejectionText, { color: theme.colors.text }]}>
                      {request.approvalDetails.rejectionReason}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Template Selection Modal */}
      <Modal
        visible={showTemplateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Letter Template</Text>
            <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {loadingTemplates ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
            ) : filteredTemplates.length === 0 ? (
              <HelperText type="info" visible style={{ textAlign: 'center', marginTop: 32 }}>
                No letter templates available.
              </HelperText>
            ) : (
              filteredTemplates.map((template) => (
                <Card
                  key={template._id}
                  style={[styles.templateCard, { backgroundColor: theme.colors.surface }]}
                >
                  <Card.Content>
                    <View style={styles.templateHeader}>
                      <View style={[styles.templateIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                        <Icon name="file-document" size={32} color={theme.colors.primary} />
                      </View>
                      <View style={styles.templateInfo}>
                        <Text style={[styles.templateName, { color: theme.colors.text }]}>
                          {template.name}
                        </Text>
                        {template.description && (
                          <Text style={[styles.templateDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                            {template.description}
                          </Text>
                        )}
                        {template.requiresApproval && (
                          <Chip
                            style={[styles.approvalChip, { backgroundColor: theme.colors.warning + '20' }]}
                            textStyle={{ color: theme.colors.warning, fontSize: 11 }}
                          >
                            Requires approval
                          </Chip>
                        )}
                      </View>
                    </View>
                    <Button
                      mode="contained"
                      onPress={() => handleRequestTemplate(template)}
                      style={[styles.requestButton, { backgroundColor: theme.colors.primary }]}
                      labelStyle={{ color: '#fff' }}
                    >
                      Request
                    </Button>
                  </Card.Content>
                </Card>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Request Form Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowRequestModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Request {selectedTemplate?.name}
            </Text>
            <TouchableOpacity onPress={() => setShowRequestModal(false)}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
            {/* Employee Info (Read-only for staff) */}
            <PaperTextInput
              mode="outlined"
              label="Employee"
              value={
                state.user?.firstName && state.user?.lastName
                  ? `${state.user.firstName} ${state.user.lastName}`
                  : state.user?.email || 'Unknown'
              }
              editable={false}
              style={styles.modalInput}
              outlineColor={theme.colors.border}
            />
            <HelperText type="info" visible style={styles.helperText}>
              You can only request letters for yourself
            </HelperText>

            {/* Request Message */}
            <PaperTextInput
              mode="outlined"
              label="Request Message"
              placeholder="Please provide any additional information or purpose for this letter..."
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
              numberOfLines={4}
              style={styles.modalInput}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

            {/* Priority */}
            <Text style={[styles.modalLabel, { color: theme.colors.text }]}>Priority</Text>
            <View style={styles.priorityContainer}>
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    {
                      backgroundColor: priority === p ? theme.colors.primary + '20' : theme.colors.surface,
                      borderColor: priority === p ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      {
                        color: priority === p ? theme.colors.primary : theme.colors.text,
                        fontWeight: priority === p ? '600' : '400',
                      },
                    ]}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Due Date */}
            <Text style={[styles.modalLabel, { color: theme.colors.text }]}>Due Date (Optional)</Text>
            <TouchableOpacity
              style={[styles.datePickerButton, { borderColor: theme.colors.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.datePickerText, { color: theme.colors.text }]}>
                {dueDate ? formatDate(dueDate.toISOString()) : 'Select date'}
              </Text>
              <Icon name="calendar" size={20} color={theme.colors.primary} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setDueDate(selectedDate);
                  }
                }}
                minimumDate={new Date()}
              />
            )}

            {/* Urgent Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsUrgent(!isUrgent)}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isUrgent ? theme.colors.primary : 'transparent',
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                {isUrgent && <Icon name="check" size={16} color="#fff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>
                Mark as urgent request
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Modal Footer */}
          <View style={[styles.modalFooter, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <Button
              mode="outlined"
              onPress={() => setShowRequestModal(false)}
              style={[styles.modalButton, { borderColor: theme.colors.primary }]}
              labelStyle={{ color: theme.colors.primary }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmitRequest}
              loading={submitting}
              disabled={submitting}
              style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
            >
              Submit Request
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  requestCard: {
    marginBottom: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  requestTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  requestNumber: {
    fontSize: 13,
  },
  statusChip: {
    height: 28,
  },
  requestDate: {
    fontSize: 13,
    marginBottom: 8,
  },
  requestMessage: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  dueDateText: {
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rejectionBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  rejectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
  },
  templateCard: {
    marginBottom: 12,
    borderRadius: 16,
    elevation: 2,
  },
  templateHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  templateIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  approvalChip: {
    alignSelf: 'flex-start',
    height: 24,
  },
  requestButton: {
    borderRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
  },
  modalInput: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  helperText: {
    marginBottom: 16,
    marginTop: -8,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 14,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  datePickerText: {
    fontSize: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default OfficialLettersScreen;
