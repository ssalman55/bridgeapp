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
  KeyboardAvoidingView,
} from 'react-native';
import { Card, Title, Button, Checkbox, ActivityIndicator, TextInput as PaperTextInput, Menu, Divider } from 'react-native-paper';
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
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
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
    if (itemizedExpenses.length > 1) {
      setItemizedExpenses(itemizedExpenses.filter((_, i) => i !== idx));
    }
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
          <Title style={[styles.title, { color: theme.colors.text }]}>New Expense Claim</Title>
          {error && (
            <Card style={[styles.errorCard, { backgroundColor: theme.colors.error + '10' }]}>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            </Card>
          )}
        </View>

        {/* Section 1: Claim Details */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Claim Details</Text>
            
            <PaperTextInput
              mode="outlined"
              label="Claim Title *"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

            <View style={styles.row}>
              <TouchableOpacity 
                style={[styles.dateInput, { borderColor: theme.colors.border }]} 
                onPress={() => setShowDatePicker(true)}
              >
                <Icon name="calendar" size={20} color={theme.colors.primary} style={styles.inputIcon} />
                <Text style={[styles.dateText, { color: expenseDate ? theme.colors.text : theme.colors.placeholder }]}>
                  {expenseDate ? expenseDate.toISOString().split('T')[0] : 'Expense Date *'}
                </Text>
              </TouchableOpacity>

              <Menu
                visible={showCategoryMenu}
                onDismiss={() => setShowCategoryMenu(false)}
                anchor={
                  <TouchableOpacity 
                    style={[styles.categoryInput, { borderColor: theme.colors.border }]}
                    onPress={() => setShowCategoryMenu(true)}
                  >
                    <Icon name="tag" size={20} color={theme.colors.primary} style={styles.inputIcon} />
                    <Text style={[styles.categoryText, { color: category ? theme.colors.text : theme.colors.placeholder }]}>
                      {category || 'Category *'}
                    </Text>
                    <Icon name="chevron-down" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                }
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option}
                    onPress={() => {
                      setCategory(option);
                      setShowCategoryMenu(false);
                    }}
                    title={option}
                  />
                ))}
              </Menu>
            </View>

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
          </Card.Content>
        </Card>

        {/* Section 2: Itemized Expenses */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Itemized Expenses</Text>
              <TouchableOpacity onPress={handleAddRow} style={styles.addButton}>
                <Icon name="plus" size={20} color={theme.colors.primary} />
                <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {itemizedExpenses.map((row, idx) => (
              <Card key={idx} style={[styles.expenseCard, { backgroundColor: theme.colors.background }]}>
                <Card.Content>
                  <View style={styles.expenseHeader}>
                    <Text style={[styles.expenseNumber, { color: theme.colors.primary }]}>Item {idx + 1}</Text>
                    {itemizedExpenses.length > 1 && (
                      <TouchableOpacity onPress={() => handleRemoveRow(idx)} style={styles.deleteButton}>
                        <Icon name="delete" size={20} color={theme.colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <PaperTextInput
                    mode="outlined"
                    label="Description *"
                    value={row.description}
                    onChangeText={val => handleItemChange(idx, 'description', val)}
                    style={styles.expenseInput}
                    outlineColor={theme.colors.border}
                    activeOutlineColor={theme.colors.primary}
                  />

                  <View style={styles.amountRow}>
                    <PaperTextInput
                      mode="outlined"
                      label={`Amount (${currency}) *`}
                      value={row.amount}
                      onChangeText={val => handleItemChange(idx, 'amount', val)}
                      keyboardType="numeric"
                      style={[styles.expenseInput, { flex: 1 }]}
                      outlineColor={theme.colors.border}
                      activeOutlineColor={theme.colors.primary}
                    />
                  </View>

                  <PaperTextInput
                    mode="outlined"
                    label="Notes (Optional)"
                    value={row.notes}
                    onChangeText={val => handleItemChange(idx, 'notes', val)}
                    style={styles.expenseInput}
                    outlineColor={theme.colors.border}
                    activeOutlineColor={theme.colors.primary}
                  />
                </Card.Content>
              </Card>
            ))}

            <Card style={[styles.totalCard, { backgroundColor: theme.colors.primary + '10' }]}>
              <Card.Content>
                <Text style={[styles.totalLabel, { color: theme.colors.primary }]}>Total Amount</Text>
                <Text style={[styles.totalAmount, { color: theme.colors.primary }]}>
                  {currency} {totalAmount.toLocaleString()}
                </Text>
              </Card.Content>
            </Card>
          </Card.Content>
        </Card>

        {/* Section 3: Justification and Attachments */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Justification & Attachments</Text>

            <PaperTextInput
              mode="outlined"
              label="Justification / Notes"
              value={justification}
              onChangeText={setJustification}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

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

            <View style={styles.declarationContainer}>
              <Checkbox
                status={declaration ? 'checked' : 'unchecked'}
                onPress={() => setDeclaration(!declaration)}
                color={theme.colors.primary}
              />
              <Text style={[styles.declarationText, { color: theme.colors.text }]}>
                I confirm these are valid business expenses and all information provided is accurate.
              </Text>
            </View>
          </Card.Content>
        </Card>

        {success && (
          <Card style={[styles.successCard, { backgroundColor: theme.colors.success + '10' }]}>
            <Text style={[styles.successText, { color: theme.colors.success }]}>Claim submitted successfully!</Text>
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
          onPress={() => handleSubmit('Submitted')}
          loading={submitting}
          disabled={submitting}
          style={[styles.footerButton, { backgroundColor: theme.colors.primary }]}
        >
          Submit Claim
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'transparent',
  },
  categoryInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'transparent',
  },
  inputIcon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  categoryText: {
    fontSize: 16,
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  expenseCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 1,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  expenseInput: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
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
  textArea: {
    marginBottom: 16,
    backgroundColor: 'transparent',
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
  declarationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  declarationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
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

export default ExpenseClaimScreen; 