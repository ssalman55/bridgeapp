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
} from 'react-native';
import { Card, Title, Button, Checkbox, ActivityIndicator } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

const CATEGORY_OPTIONS = [
  'Travel',
  'Meals',
  'Office Supplies',
  'Training',
  'Accommodation',
  'Other',
];

const CURRENCY_OPTIONS = ['USD', 'QAR', 'EUR', 'GBP'];

const ExpenseClaimScreen: React.FC = () => {
  const { state } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [currency, setCurrency] = useState('QAR');
  const [title, setTitle] = useState('');
  const [expenseDate, setExpenseDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [category, setCategory] = useState('');
  const [itemizedExpenses, setItemizedExpenses] = useState([
    { description: '', amount: '', currency: 'QAR', notes: '' },
  ]);
  const [documents, setDocuments] = useState<any[]>([]); // { _id, title, fileUrl }
  const [showDocModal, setShowDocModal] = useState(false);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [declaration, setDeclaration] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const totalAmount = itemizedExpenses.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);

  useEffect(() => {
    apiService.getSystemSettings().then(settings => {
      if (settings && settings.currency) {
        setCurrency(settings.currency);
        setItemizedExpenses(expenses => expenses.map(row => ({ ...row, currency: settings.currency })));
      }
    });
  }, []);

  // Fetch user documents when modal opens
  useEffect(() => {
    if (showDocModal) {
      setLoadingDocs(true);
      setDocError(null);
      apiService.getDocuments({ type: 'document' })
        .then((docs) => {
          setUserDocuments(Array.isArray(docs) ? docs : []);
        })
        .catch((err) => {
          setDocError('Failed to fetch documents');
        })
        .finally(() => setLoadingDocs(false));
    }
  }, [showDocModal]);

  const handleAddRow = () => {
    setItemizedExpenses([...itemizedExpenses, { description: '', amount: '', currency, notes: '' }]);
  };

  const handleRemoveRow = (idx: number) => {
    setItemizedExpenses(itemizedExpenses.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, value: string) => {
    setItemizedExpenses(itemizedExpenses.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleDocUpload = async (file: any) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'document');
      const uploaded = await apiService.uploadDocument(formData);
      setDocuments([...documents, uploaded]);
    } catch (err) {
      Alert.alert('Upload Failed', 'Could not upload document.');
    }
  };

  const validate = () => {
    if (!title.trim()) return 'Claim Title is required.';
    if (!expenseDate) return 'Expense Date is required.';
    if (!category) return 'Category is required.';
    if (!itemizedExpenses.length || itemizedExpenses.some(row => !row.description || !row.amount)) return 'All itemized expenses must be filled.';
    if (!declaration) return 'You must confirm these are valid business expenses.';
    return null;
  };

  const handleSubmit = async (status: 'Submitted' | 'Draft') => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        title: title.trim(),
        expenseDate: expenseDate?.toISOString().split('T')[0],
        category,
        itemizedExpenses: itemizedExpenses.map(row => ({ ...row, amount: parseFloat(row.amount) })),
        totalAmount,
        justification: justification.trim(),
        declaration,
        status: status === 'Submitted' ? 'Pending' : 'Draft',
        documents: documents.map(doc => doc._id),
      };
      await apiService.createExpenseClaim(payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        (navigation as any).navigate('Requests', { screen: 'ClaimsHistory', params: { refresh: true } });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>New Expense Claim</Title>
          {error && <Text style={styles.error}>{error}</Text>}
          <TextInput
            style={styles.input}
            placeholder="Claim Title *"
            value={title}
            onChangeText={setTitle}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.input, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
              <Text style={{ color: expenseDate ? theme.colors.text : theme.colors.placeholder }}>
                {expenseDate ? expenseDate.toISOString().split('T')[0] : 'Expense Date *'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={expenseDate || new Date()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setExpenseDate(date);
                }}
              />
            )}
            <View style={[styles.input, { flex: 1, justifyContent: 'center' }]}> 
              <Text>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORY_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt} onPress={() => setCategory(opt)} style={[styles.chip, category === opt && styles.chipSelected]}>
                    <Text style={{ color: category === opt ? '#fff' : theme.colors.text }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Itemized Expenses *</Text>
          {itemizedExpenses.map((row, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="Description"
                value={row.description}
                onChangeText={val => handleItemChange(idx, 'description', val)}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={`Amount (${currency})`}
                keyboardType="numeric"
                value={row.amount}
                onChangeText={val => handleItemChange(idx, 'amount', val)}
              />
              <View style={{ flex: 0.7, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{currency}</Text>
              </View>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="Notes"
                value={row.notes}
                onChangeText={val => handleItemChange(idx, 'notes', val)}
              />
              <TouchableOpacity onPress={() => handleRemoveRow(idx)}>
                <Icon name="delete" size={22} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={handleAddRow} style={styles.addRowBtn}>
            <Icon name="plus" size={20} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, marginLeft: 4 }}>Add Row</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Total Amount</Text>
          <Text>{currency} {totalAmount.toLocaleString()}</Text>
          <Text style={styles.sectionTitle}>Attach Documents</Text>
          <TouchableOpacity style={styles.attachBtn} onPress={() => setShowDocModal(true)}>
            <Icon name="paperclip" size={20} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, marginLeft: 4 }}>My Documents</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 4 }}>
            {documents.map((doc, idx) => (
              <View key={doc._id || idx} style={styles.docChip}>
                <Text style={{ color: theme.colors.primary }}>{doc.title || doc.name || 'Document'}</Text>
                <TouchableOpacity onPress={() => setDocuments(docs => docs.filter((_, i) => i !== idx))}>
                  <Icon name="close" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Justification / Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            placeholder="Justification / Notes"
            value={justification}
            onChangeText={setJustification}
            multiline
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
            <Checkbox
              status={declaration ? 'checked' : 'unchecked'}
              onPress={() => setDeclaration(!declaration)}
              color={theme.colors.primary}
            />
            <Text style={{ marginLeft: 8 }}>I confirm these are valid business expenses.</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button mode="outlined" onPress={() => handleSubmit('Draft')} disabled={submitting} style={{ marginRight: 8 }}>Save as Draft</Button>
            <Button mode="contained" onPress={() => handleSubmit('Submitted')} loading={submitting} disabled={submitting}>
              Submit Claim
            </Button>
          </View>
          {success && <Text style={styles.success}>Claim submitted!</Text>}
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
                    <Icon name={alreadyAttached ? 'check-circle' : 'file-document'} size={22} color={alreadyAttached ? theme.colors.primary : theme.colors.text} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold' }}>{doc.title || doc.name || 'Document'}</Text>
                      {doc.uploadedAt && <Text style={{ fontSize: 12, color: '#888' }}>{new Date(doc.uploadedAt).toLocaleDateString()}</Text>}
                    </View>
                    {alreadyAttached && <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Attached</Text>}
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
  chip: { borderWidth: 1, borderColor: '#1976D2', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 },
  chipSelected: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  attachBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  docChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 },
  error: { color: '#D32F2F', marginBottom: 8 },
  success: { color: '#388E3C', marginTop: 8, fontWeight: 'bold' },
});

export default ExpenseClaimScreen; 