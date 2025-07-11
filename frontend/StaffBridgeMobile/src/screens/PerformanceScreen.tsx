import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, Modal, TextStyle, Image, TextInput, Alert } from 'react-native';
import { Card, Title, ActivityIndicator, Button } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { User } from '../types/auth';

const getStatusBadgeStyle = (status: string) => ({ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: status === 'Completed' ? '#B9F6CA' : status === 'In Progress' ? '#FFF9C4' : '#FFCDD2' });
const getStatusTextStyle = (status: string) => ({ fontWeight: 'bold', fontSize: 13, color: status === 'Completed' ? '#388E3C' : status === 'In Progress' ? '#8D6E63' : '#C62828' });

const getInitials = (user: Partial<User> | undefined) => {
  if (!user) return '';
  if (user.firstName && user.lastName) {
    return (user.firstName[0] + user.lastName[0]).toUpperCase();
  }
  const fullName = (user as any).fullName;
  if (fullName) {
    const parts = fullName.split(' ');
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }
  return '';
};

const PerformanceScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedEval, setSelectedEval] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalEval, setModalEval] = useState<any | null>(null);
  const [reflectionEdits, setReflectionEdits] = useState<any>({});
  const [docPickerGoalIdx, setDocPickerGoalIdx] = useState<number | null>(null);
  const [docPickerField, setDocPickerField] = useState<string | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const { state } = useAuth();
  const { theme } = useTheme();

  const fetchEvaluations = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch evaluations for the logged-in user, filtered by org and staff
      const data = await apiService.getPerformanceEvaluations();
      setEvaluations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch evaluations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, []);

  // Fetch user documents when doc picker is opened
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

  // Handle reflection edit
  const handleReflectionEdit = (goalIdx: number, field: string, value: string) => {
    setReflectionEdits((prev: any) => ({
      ...prev,
      [goalIdx]: {
        ...prev[goalIdx],
        [field]: value,
      },
    }));
  };

  // Handle document attach/remove
  const handleAttachDoc = (goalIdx: number, field: string, doc: any) => {
    setModalEval((prev: any) => {
      const newGoals = [...prev.goals];
      const docsField = `${field}Docs`;
      const docs = Array.isArray(newGoals[goalIdx][docsField]) ? [...newGoals[goalIdx][docsField]] : [];
      if (!docs.some((d: any) => d._id === doc._id)) docs.push(doc);
      newGoals[goalIdx][docsField] = docs;
      return { ...prev, goals: newGoals };
    });
  };
  const handleRemoveDoc = (goalIdx: number, field: string, docId: string) => {
    setModalEval((prev: any) => {
      const newGoals = [...prev.goals];
      const docsField = `${field}Docs`;
      newGoals[goalIdx][docsField] = (newGoals[goalIdx][docsField] || []).filter((d: any) => d._id !== docId);
      return { ...prev, goals: newGoals };
    });
  };

  // Save handler
  const handleSave = async () => {
    if (!modalEval) return;
    try {
      // Prepare payload: reflections and document IDs for each goal/field
      const updatedGoals = modalEval.goals.map((goal: any, idx: number) => {
        const edits = reflectionEdits[idx] || {};
        const updated: any = { ...goal };
        ['specific','measurable','achievable','relevant','timeBound'].forEach((field) => {
          if (edits[`${field}Reflection`] !== undefined) updated[`${field}Reflection`] = edits[`${field}Reflection`];
          // Only send document IDs, filter out null/undefined
          if (Array.isArray(updated[`${field}Docs`])) {
            updated[`${field}Docs`] = updated[`${field}Docs`]
              .filter((d: any) => d && d._id)
              .map((d: any) => d._id);
          }
        });
        return updated;
      });
      await apiService.updatePerformanceEvaluation(modalEval._id, { goals: updatedGoals });
      // Reload the updated evaluation from backend
      const freshEval = await apiService.getPerformanceEvaluation(modalEval._id);
      setModalEval(freshEval);
      Alert.alert('Success', 'Reflections and attachments saved.');
      setTimeout(() => {
        setSelectedEval(null);
        setModalEval(null);
      }, 500);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save.');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvaluations();
  };

  const handleOpenModal = async (evalItem: any) => {
    setSelectedEval(evalItem);
    setModalLoading(true);
    setModalError(null);
    try {
      const data = await apiService.getPerformanceEvaluation(evalItem._id);
      setModalEval(data);
    } catch (err: any) {
      setModalError(err.message || 'Failed to load evaluation details');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Title style={styles.headerTitle}>My Performance Evaluations</Title>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <Text style={{ color: 'red', textAlign: 'center', marginTop: 32 }}>{error}</Text>
        ) : evaluations.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary }}>
            No performance evaluations found.
          </Text>
        ) : (
          evaluations.map((evalItem, idx) => (
            <Card key={evalItem._id || idx} style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.evaluatorLabel}>Evaluator</Text>
                    <Text style={styles.evaluatorName}>
                      {evalItem.evaluator?.firstName && evalItem.evaluator?.lastName
                        ? `${evalItem.evaluator.firstName} ${evalItem.evaluator.lastName}`
                        : evalItem.evaluator?.fullName || '-'}
                    </Text>
                  </View>
                  <View style={getStatusBadgeStyle(evalItem.status)}>
                    <Text style={getStatusTextStyle(evalItem.status) as TextStyle}>{evalItem.status}</Text>
                  </View>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.evalDateLabel}>Date</Text>
                  <Text style={styles.evalDateValue}>{evalItem.evaluationDate ? new Date(evalItem.evaluationDate).toLocaleDateString() : '-'}</Text>
                </View>
                <Button mode="outlined" style={styles.viewBtn} onPress={() => handleOpenModal(evalItem)}>
                  View
                </Button>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
      {/* Modal for Evaluation Details */}
      <Modal visible={!!selectedEval} animationType="slide" onRequestClose={() => { setSelectedEval(null); setModalEval(null); }}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {/* Close Button */}
          <TouchableOpacity
            onPress={() => { setSelectedEval(null); setModalEval(null); }}
            style={{ position: 'absolute', top: 18, right: 18, zIndex: 10, backgroundColor: '#F7F9FB', borderRadius: 18, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', elevation: 2 }}
            accessibilityLabel="Close modal"
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 22, color: '#1976D2', fontWeight: 'bold' }}>×</Text>
          </TouchableOpacity>
          {modalLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : modalError ? (
            <Text style={{ color: 'red', textAlign: 'center', marginTop: 32 }}>{modalError}</Text>
          ) : modalEval ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 32 }}>
              {/* Header: Staff & Evaluator */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                {/* Staff Avatar */}
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  {modalEval.staff?.profilePicture ? (
                    <Image source={{ uri: modalEval.staff.profilePicture }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                  ) : (
                    <Text style={{ fontWeight: 'bold', fontSize: 20, color: '#1976D2' }}>{getInitials(modalEval.staff)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{modalEval.staff?.firstName} {modalEval.staff?.lastName}</Text>
                  <Text style={{ color: '#888', fontSize: 13 }}>Staff</Text>
                </View>
                {/* Evaluator Avatar */}
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginLeft: 12 }}>
                  {modalEval.evaluator?.profilePicture ? (
                    <Image source={{ uri: modalEval.evaluator.profilePicture }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                  ) : (
                    <Text style={{ fontWeight: 'bold', fontSize: 20, color: '#F57C00' }}>{getInitials(modalEval.evaluator)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{modalEval.evaluator?.firstName} {modalEval.evaluator?.lastName}</Text>
                  <Text style={{ color: '#888', fontSize: 13 }}>Evaluator</Text>
                </View>
              </View>
              {/* Metadata */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 15 }}>Title: Performance Evaluation</Text>
                <Text style={{ color: '#888', fontSize: 13 }}>Period: {modalEval.period || '-'}</Text>
                <Text style={{ color: '#888', fontSize: 13 }}>Created: {modalEval.createdAt ? new Date(modalEval.createdAt).toLocaleString() : '-'}</Text>
                <Text style={{ color: '#888', fontSize: 13 }}>Last Updated: {modalEval.updatedAt ? new Date(modalEval.updatedAt).toLocaleString() : '-'}</Text>
                <Text style={{ color: '#888', fontSize: 13 }}>Status: {modalEval.status}</Text>
              </View>
              {/* SMART Goals */}
              <View style={{ marginBottom: 18 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>SMART Goals</Text>
                {modalEval?.goals && Array.isArray(modalEval.goals) && modalEval.goals.length > 0 ? (
                  modalEval.goals.map((goal: any, idx: number) => (
                    <View key={idx} style={{ marginBottom: 18, backgroundColor: '#F7F9FB', borderRadius: 12, padding: 12 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>SMART Goal {idx + 1}</Text>
                      {/* Each SMART field */}
                      {['specific','measurable','achievable','relevant','timeBound'].map((field) => (
                        <View key={field} style={{ marginBottom: 8 }}>
                          <Text style={{ fontWeight: 'bold', color: '#1976D2' }}>{field.charAt(0).toUpperCase() + field.slice(1)}:</Text>
                          <Text style={{ color: '#222', marginBottom: 2 }}>{goal?.[field] ?? '-'}</Text>
                          {/* Reflection input (editable) */}
                          <Text style={{ color: '#888', fontSize: 13, marginBottom: 2 }}>Reflection:</Text>
                          <TextInput
                            style={{ color: '#333', backgroundColor: '#fff', borderRadius: 6, padding: 6, minHeight: 32, borderWidth: 1, borderColor: '#E0E0E0' }}
                            value={reflectionEdits?.[idx]?.[`${field}Reflection`] ?? goal?.[`${field}Reflection`] ?? ''}
                            onChangeText={v => handleReflectionEdit(idx, `${field}Reflection`, v)}
                            placeholder="Write your reflection..."
                            multiline
                          />
                          {/* Attachments */}
                          <Text style={{ color: '#888', fontSize: 13, marginTop: 2 }}>Attachments:</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 2 }}>
                            {Array.isArray(goal?.[`${field}Docs`]) && goal[`${field}Docs`].filter((doc: any) => doc && doc._id).map((doc: any, dIdx: number) =>
                              doc ? (
                                <View key={doc._id || dIdx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 }}>
                                  <Text style={{ color: '#1976D2' }}>{doc?.title || doc?.name || 'Document'}</Text>
                                  <TouchableOpacity onPress={() => handleRemoveDoc(idx, field, doc._id)}>
                                    <Text style={{ color: '#D32F2F', marginLeft: 4 }}>Remove</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : null
                            )}
                            <TouchableOpacity onPress={() => { setDocPickerGoalIdx(idx); setDocPickerField(field); setShowDocModal(true); }} style={{ backgroundColor: '#E3F2FD', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 }}>
                              <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>+ Attach</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#888' }}>No SMART goals found.</Text>
                )}
              </View>
              {/* Structured Feedback */}
              <View style={{ marginBottom: 18 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Structured Feedback</Text>
                <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Initial Feedback:</Text>
                <Text style={{ color: '#333', marginBottom: 6 }}>{modalEval.initialFeedback || 'No feedback provided yet.'}</Text>
                <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Midyear Feedback:</Text>
                <Text style={{ color: '#333', marginBottom: 6 }}>{modalEval.midyearFeedback || 'No feedback provided yet.'}</Text>
                <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Yearend Feedback:</Text>
                <Text style={{ color: '#333', marginBottom: 6 }}>{modalEval.yearendFeedback || 'No feedback provided yet.'}</Text>
              </View>
              <Button mode="contained" onPress={handleSave} style={{ marginTop: 12, borderRadius: 8 }}>Save</Button>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
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
                // Check if already attached to this goal/field
                const attachedDocs =
                  doc &&
                  docPickerGoalIdx !== null &&
                  docPickerField &&
                  modalEval &&
                  Array.isArray(modalEval.goals) &&
                  Array.isArray(modalEval.goals[docPickerGoalIdx]?.[`${docPickerField}Docs`])
                    ? modalEval.goals[docPickerGoalIdx][`${docPickerField}Docs`].filter((d: any) => d && d._id)
                    : [];
                const alreadyAttached = attachedDocs.some((d: any) => d._id === doc._id);
                return (
                  <TouchableOpacity
                    key={doc?._id || Math.random()}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: alreadyAttached ? '#E3F2FD' : 'transparent' }}
                    disabled={alreadyAttached}
                    onPress={() => {
                      if (doc && docPickerGoalIdx !== null && docPickerField && modalEval && Array.isArray(modalEval.goals)) {
                        handleAttachDoc(docPickerGoalIdx, docPickerField, doc);
                      }
                    }}
                  >
                    <Text style={{ fontWeight: 'bold', color: alreadyAttached ? theme.colors.primary : theme.colors.text }}>{doc?.title || doc?.name || 'Document'}</Text>
                    {alreadyAttached && <Text style={{ color: theme.colors.primary, fontWeight: 'bold', marginLeft: 8 }}>Attached</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <Button onPress={() => setShowDocModal(false)} style={{ marginTop: 16 }}>Close</Button>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#222', marginTop: 18, marginBottom: 8, alignSelf: 'center' },
  card: { borderRadius: 16, backgroundColor: '#fff', padding: 0, marginHorizontal: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardContent: { paddingVertical: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  evaluatorLabel: { color: '#888', fontWeight: '500', fontSize: 13 },
  evaluatorName: { color: '#1976D2', fontWeight: 'bold', fontSize: 16 },
  evalDateLabel: { color: '#888', fontWeight: '500', fontSize: 13 },
  evalDateValue: { color: '#222', fontWeight: 'bold', fontSize: 15 },
  viewBtn: { marginTop: 8, borderRadius: 8, alignSelf: 'flex-end' },
});

export default PerformanceScreen; 