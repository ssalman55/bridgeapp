import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { Card, Title, Button, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';

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
      setTimeout(() => setSuccess(false), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit training request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Training Request</Title>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Training Title *" value={form.trainingTitle} onChangeText={v => handleChange('trainingTitle', v)} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Hosted By *" value={form.hostedBy} onChangeText={v => handleChange('hostedBy', v)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Training Location *" value={form.location} onChangeText={v => handleChange('location', v)} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Number of Days *" value={form.numberOfDays} keyboardType="numeric" onChangeText={v => handleChange('numberOfDays', v)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Training/Registration Fee" value={form.trainingFee} keyboardType="numeric" onChangeText={v => handleChange('trainingFee', v)} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Travel Cost" value={form.travelCost} keyboardType="numeric" onChangeText={v => handleChange('travelCost', v)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Hotel/Accommodation Cost" value={form.hotelCost} keyboardType="numeric" onChangeText={v => handleChange('hotelCost', v)} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Meal/Per Diem Cost" value={form.mealCost} keyboardType="numeric" onChangeText={v => handleChange('mealCost', v)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Other Costs" value={form.otherCost} keyboardType="numeric" onChangeText={v => handleChange('otherCost', v)} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Describe other costs" value={form.otherCostDesc} onChangeText={v => handleChange('otherCostDesc', v)} />
          </View>
          <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Training Justification *" value={form.justification} onChangeText={v => handleChange('justification', v)} multiline />
          <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Expected Training Outcomes *" value={form.expectedOutcomes} onChangeText={v => handleChange('expectedOutcomes', v)} multiline />
          <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Benefit to the Organization *" value={form.benefitToOrg} onChangeText={v => handleChange('benefitToOrg', v)} multiline />
          <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Cover Requirements *" value={form.coverRequirements} onChangeText={v => handleChange('coverRequirements', v)} multiline />
          <TextInput style={[styles.input, { minHeight: 40 }]} placeholder="Additional Notes" value={form.additionalNotes} onChangeText={v => handleChange('additionalNotes', v)} multiline />
          <Text style={styles.sectionTitle}>Attach Documents</Text>
          <TouchableOpacity style={styles.attachBtn} onPress={() => setShowDocModal(true)}>
            <Text style={{ color: theme.colors.primary, marginLeft: 4 }}>My Documents</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 4 }}>
            {documents.map((doc, idx) => (
              <View key={doc._id || idx} style={styles.docChip}>
                <Text style={{ color: theme.colors.primary }}>{doc.title || doc.name || 'Document'}</Text>
                <TouchableOpacity onPress={() => setDocuments(docs => docs.filter((_, i) => i !== idx))}>
                  <Text style={{ color: theme.colors.error, marginLeft: 4 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button mode="outlined" onPress={() => handleSubmit('Draft')} disabled={submitting} style={{ marginRight: 8 }}>Save as Draft</Button>
            <Button mode="contained" onPress={() => handleSubmit('Pending')} loading={submitting} disabled={submitting}>Submit Request</Button>
          </View>
          {success && <Text style={styles.success}>Training request submitted!</Text>}
        </Card.Content>
      </Card>
      {/* Document Picker Modal */}
      <Modal visible={showDocModal} animationType="slide" onRequestClose={() => setShowDocModal(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Attach Documents</Text>
          {loadingDocs ? (
            <ActivityIndicator animating size="large" style={{ marginVertical: 20 }} />
          ) : docError ? (
            <Text style={{ color: theme.colors.error }}>{docError}</Text>
          ) : userDocuments.length === 0 ? (
            <Text>No documents found.</Text>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {userDocuments.map((doc) => {
                const alreadyAttached = documents.some((d) => d._id === doc._id);
                return (
                  <TouchableOpacity
                    key={doc._id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      borderBottomWidth: 1,
                      borderColor: '#eee',
                      backgroundColor: alreadyAttached ? '#E3F2FD' : 'transparent',
                    }}
                    disabled={alreadyAttached}
                    onPress={() => {
                      if (!alreadyAttached) setDocuments((prev) => [...prev, doc]);
                    }}
                  >
                    <Text style={{ fontWeight: 'bold', color: alreadyAttached ? theme.colors.primary : theme.colors.text }}>{doc.title || doc.name || 'Document'}</Text>
                    {alreadyAttached && <Text style={{ color: theme.colors.primary, fontWeight: 'bold', marginLeft: 8 }}>Attached</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <Button onPress={() => setShowDocModal(false)} style={{ marginTop: 16 }}>Close</Button>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 8, marginBottom: 8, backgroundColor: '#F7F9FB', fontSize: 16 },
  sectionTitle: { fontWeight: 'bold', marginTop: 12, marginBottom: 4 },
  attachBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  docChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 },
  error: { color: '#D32F2F', marginBottom: 8 },
  success: { color: '#388E3C', marginTop: 8, fontWeight: 'bold' },
});

export default TrainingRequestScreen; 