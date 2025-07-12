import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Card, Title, Button, ActivityIndicator, TextInput as PaperTextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import { useNavigation } from '@react-navigation/native';

const TrainingRequestScreen: React.FC = () => {
  const { state } = useAuth();
  const { theme } = useTheme();
  const [form, setForm] = useState({
    trainingTitle: '',
    hostedBy: '',
    location: '',
    numberOfDays: '',
    trainingFee: '',
    travelCost: '',
    hotelCost: '',
    mealCost: '',
    otherCost: '',
    otherCostDesc: '',
    justification: '',
    expectedOutcomes: '',
    benefitToOrg: '',
    coverRequirements: '',
    additionalNotes: '',
  });
  const [documents, setDocuments] = useState<any[]>([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currency, setCurrency] = useState('QAR');
  const navigation = useNavigation();

  useEffect(() => {
    apiService.getSystemSettings().then(settings => {
      if (settings && settings.currency) setCurrency(settings.currency);
    });
  }, []);

  useEffect(() => {
    if (showDocModal) {
      setLoadingDocs(true);
      setDocError(null);
      apiService.getDocuments({ type: 'document' })
        .then((docs) => {
          setUserDocuments(Array.isArray(docs) ? docs : []);
        })
        .catch(() => {
          setDocError('Failed to fetch documents');
        })
        .finally(() => setLoadingDocs(false));
    }
  }, [showDocModal]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.trainingTitle.trim()) return 'Training Title is required.';
    if (!form.hostedBy.trim()) return 'Hosted By is required.';
    if (!form.location.trim()) return 'Training Location is required.';
    if (!form.numberOfDays.trim() || isNaN(Number(form.numberOfDays))) return 'Number of Days is required and must be a number.';
    if (!form.justification.trim()) return 'Training Justification is required.';
    if (!form.expectedOutcomes.trim()) return 'Expected Training Outcomes is required.';
    if (!form.benefitToOrg.trim()) return 'Benefit to the Organization is required.';
    if (!form.coverRequirements.trim()) return 'Cover Requirements is required.';
    return null;
  };

  const handleSubmit = async (status: 'Pending' | 'Draft') => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        trainingTitle: form.trainingTitle.trim(),
        hostedBy: form.hostedBy.trim(),
        location: form.location.trim(),
        numberOfDays: Number(form.numberOfDays),
        costBreakdown: {
          registrationFee: form.trainingFee ? Number(form.trainingFee) : undefined,
          travelCost: form.travelCost ? Number(form.travelCost) : undefined,
          accommodationCost: form.hotelCost ? Number(form.hotelCost) : undefined,
          mealCost: form.mealCost ? Number(form.mealCost) : undefined,
          otherCost: form.otherCost ? Number(form.otherCost) : undefined,
          otherCostDescription: form.otherCostDesc || undefined,
        },
        justification: form.justification.trim(),
        expectedOutcomes: form.expectedOutcomes.trim(),
        benefitToOrg: form.benefitToOrg.trim(),
        coverRequirements: form.coverRequirements.trim(),
        additionalNotes: form.additionalNotes.trim(),
        documents: documents.map(doc => doc._id),
        staffId: state.user?._id,
        organization: state.user?.organization,
        status,
      };
      await apiService.submitTrainingRequest(payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        (navigation as any).navigate('Requests', { screen: 'TrainingHistory', params: { refresh: true } });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit training request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'file-pdf-box';
      case 'jpg':
      case 'jpeg':
      case 'png': return 'file-image-box';
      case 'doc':
      case 'docx': return 'file-word-box';
      case 'xls':
      case 'xlsx': return 'file-excel-box';
      default: return 'file-document';
    }
  };

  const calculateTotalCost = () => {
    const costs = [
      parseFloat(form.trainingFee) || 0,
      parseFloat(form.travelCost) || 0,
      parseFloat(form.hotelCost) || 0,
      parseFloat(form.mealCost) || 0,
      parseFloat(form.otherCost) || 0,
    ];
    return costs.reduce((sum, cost) => sum + cost, 0);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Title style={[styles.title, { color: theme.colors.text }]}>Training Request</Title>
          {error && (
            <Card style={[styles.errorCard, { backgroundColor: theme.colors.error + '10' }]}>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            </Card>
          )}
        </View>

        {/* Section 1: Training Details */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Training Details</Text>

            <PaperTextInput
              mode="outlined"
              label="Training Title *"
              value={form.trainingTitle}
              onChangeText={v => handleChange('trainingTitle', v)}
              style={styles.input}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

            <View style={styles.row}>
              <PaperTextInput
                mode="outlined"
                label="Hosted By *"
                value={form.hostedBy}
                onChangeText={v => handleChange('hostedBy', v)}
                style={[styles.input, { flex: 1 }]}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
              <PaperTextInput
                mode="outlined"
                label="Training Location *"
                value={form.location}
                onChangeText={v => handleChange('location', v)}
                style={[styles.input, { flex: 1 }]}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
          </View>

            <PaperTextInput
              mode="outlined"
              label="Number of Days *"
              value={form.numberOfDays}
              onChangeText={v => handleChange('numberOfDays', v)}
              keyboardType="numeric"
              style={styles.input}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />
          </Card.Content>
        </Card>

        {/* Section 2: Cost Breakdown */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Cost Breakdown</Text>

            <View style={styles.row}>
              <PaperTextInput
                mode="outlined"
                label={`Training Fee (${currency})`}
                value={form.trainingFee}
                onChangeText={v => handleChange('trainingFee', v)}
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
              <PaperTextInput
                mode="outlined"
                label={`Travel Cost (${currency})`}
                value={form.travelCost}
                onChangeText={v => handleChange('travelCost', v)}
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
          </View>

            <View style={styles.row}>
              <PaperTextInput
                mode="outlined"
                label={`Accommodation (${currency})`}
                value={form.hotelCost}
                onChangeText={v => handleChange('hotelCost', v)}
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
              <PaperTextInput
                mode="outlined"
                label={`Meal Cost (${currency})`}
                value={form.mealCost}
                onChangeText={v => handleChange('mealCost', v)}
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
          </View>

            <View style={styles.row}>
              <PaperTextInput
                mode="outlined"
                label={`Other Costs (${currency})`}
                value={form.otherCost}
                onChangeText={v => handleChange('otherCost', v)}
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
              <PaperTextInput
                mode="outlined"
                label="Other Cost Description"
                value={form.otherCostDesc}
                onChangeText={v => handleChange('otherCostDesc', v)}
                style={[styles.input, { flex: 1 }]}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
          </View>

            <Card style={[styles.totalCard, { backgroundColor: theme.colors.primary + '10' }]}>
              <Card.Content>
                <Text style={[styles.totalLabel, { color: theme.colors.primary }]}>Total Estimated Cost</Text>
                <Text style={[styles.totalAmount, { color: theme.colors.primary }]}>
                  {currency} {calculateTotalCost().toLocaleString()}
                </Text>
              </Card.Content>
            </Card>
          </Card.Content>
        </Card>

        {/* Section 3: Justification & Requirements */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Justification & Requirements</Text>

            <PaperTextInput
              mode="outlined"
              label="Training Justification *"
              value={form.justification}
              onChangeText={v => handleChange('justification', v)}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

            <PaperTextInput
              mode="outlined"
              label="Expected Training Outcomes *"
              value={form.expectedOutcomes}
              onChangeText={v => handleChange('expectedOutcomes', v)}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

            <PaperTextInput
              mode="outlined"
              label="Benefit to the Organization *"
              value={form.benefitToOrg}
              onChangeText={v => handleChange('benefitToOrg', v)}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

            <PaperTextInput
              mode="outlined"
              label="Cover Requirements *"
              value={form.coverRequirements}
              onChangeText={v => handleChange('coverRequirements', v)}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

            <PaperTextInput
              mode="outlined"
              label="Additional Notes"
              value={form.additionalNotes}
              onChangeText={v => handleChange('additionalNotes', v)}
              multiline
              numberOfLines={3}
              style={styles.textArea}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />
          </Card.Content>
        </Card>

        {/* Section 4: Attachments */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Supporting Documents</Text>

            <TouchableOpacity
              style={[styles.attachButton, { borderColor: theme.colors.primary }]}
              onPress={() => setShowDocModal(true)}
            >
              <Icon name="paperclip" size={24} color={theme.colors.primary} />
              <Text style={[styles.attachButtonText, { color: theme.colors.primary }]}>Attach Documents</Text>
          </TouchableOpacity>

            {documents.length > 0 && (
              <View style={styles.documentsList}>
            {documents.map((doc, idx) => (
                  <Card key={doc._id || idx} style={[styles.documentCard, { backgroundColor: theme.colors.background }]}>
                    <Card.Content style={styles.documentContent}>
                      <Icon
                        name={getFileIcon(doc.title || doc.name || 'document')}
                        size={24}
                        color={theme.colors.primary}
                      />
                      <View style={styles.documentInfo}>
                        <Text style={[styles.documentName, { color: theme.colors.text }]}>
                          {doc.title || doc.name || 'Document'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setDocuments(docs => docs.filter((_, i) => i !== idx))}
                        style={styles.removeDocument}
                      >
                        <Icon name="close" size={20} color={theme.colors.error} />
                </TouchableOpacity>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            )}
        </Card.Content>
      </Card>

        {success && (
          <Card style={[styles.successCard, { backgroundColor: theme.colors.success + '10' }]}>
            <Text style={[styles.successText, { color: theme.colors.success }]}>Training request submitted successfully!</Text>
          </Card>
        )}
      </ScrollView>

      {/* Sticky Footer */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <Button
          mode="outlined"
          onPress={() => handleSubmit('Draft')}
          disabled={submitting}
          style={[styles.footerButton, { borderColor: theme.colors.primary }]}
          labelStyle={{ color: theme.colors.primary }}
        >
          Save as Draft
        </Button>
        <Button
          mode="contained"
          onPress={() => handleSubmit('Pending')}
          loading={submitting}
          disabled={submitting}
          style={[styles.footerButton, { backgroundColor: theme.colors.primary }]}
        >
          Submit Request
        </Button>
      </View>

      {/* Document Picker Modal */}
      <Modal visible={showDocModal} animationType="slide" onRequestClose={() => setShowDocModal(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Attach Documents</Text>
            <TouchableOpacity onPress={() => setShowDocModal(false)}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {loadingDocs ? (
            <View style={styles.modalContent}>
              <ActivityIndicator animating size="large" color={theme.colors.primary} />
            </View>
          ) : docError ? (
            <View style={styles.modalContent}>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{docError}</Text>
            </View>
          ) : userDocuments.length === 0 ? (
            <View style={styles.modalContent}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No documents found.</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalContent}>
              {userDocuments.map((doc) => {
                const alreadyAttached = documents.some((d) => d._id === doc._id);
                return (
                  <TouchableOpacity
                    key={doc._id}
                    style={[
                      styles.documentItem,
                      {
                        backgroundColor: alreadyAttached ? theme.colors.primary + '10' : theme.colors.surface,
                        borderColor: theme.colors.border
                      }
                    ]}
                    disabled={alreadyAttached}
                    onPress={() => {
                      if (!alreadyAttached) setDocuments((prev) => [...prev, doc]);
                    }}
                  >
                    <Icon
                      name={alreadyAttached ? 'check-circle' : getFileIcon(doc.title || doc.name || 'document')}
                      size={24}
                      color={alreadyAttached ? theme.colors.primary : theme.colors.text}
                    />
                    <View style={styles.documentItemInfo}>
                      <Text style={[styles.documentItemName, { color: theme.colors.text }]}>
                        {doc.title || doc.name || 'Document'}
                      </Text>
                      {doc.uploadedAt && (
                        <Text style={[styles.documentItemDate, { color: theme.colors.textSecondary }]}>
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    {alreadyAttached && (
                      <Text style={[styles.attachedText, { color: theme.colors.primary }]}>Attached</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.modalFooter}>
            <Button
              mode="contained"
              onPress={() => setShowDocModal(false)}
              style={{ backgroundColor: theme.colors.primary }}
            >
              Done
            </Button>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  errorCard: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  textArea: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  totalCard: {
    marginTop: 16,
    borderRadius: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  attachButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  documentsList: {
    marginBottom: 16,
  },
  documentCard: {
    marginBottom: 8,
    borderRadius: 8,
  },
  documentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeDocument: {
    padding: 4,
  },
  successCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    gap: 12,
  },
  footerButton: {
    flex: 1,
    borderRadius: 12,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  documentItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  documentItemDate: {
    fontSize: 12,
    marginTop: 2,
  },
  attachedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 32,
  },
});

export default TrainingRequestScreen; 