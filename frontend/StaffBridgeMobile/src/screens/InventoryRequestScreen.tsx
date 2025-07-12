import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  Platform,
  KeyboardAvoidingView 
} from 'react-native';
import { Card, Title, Button, TextInput as PaperTextInput, Menu } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import { useNavigation } from '@react-navigation/native';

const InventoryRequestScreen: React.FC = () => {
  const { state } = useAuth();
  const { theme } = useTheme();
  const [form, setForm] = useState({
    itemName: '',
    category: '',
    quantity: '1',
    justification: '',
    requiredDate: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [itemOptions, setItemOptions] = useState<any[]>([]);
  const navigation = useNavigation();

  useEffect(() => {
    apiService.getInventoryItemNames().then((data) => {
      setItemOptions(Array.isArray(data) ? data : []);
    });
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemSelect = (itemName: string) => {
    handleChange('itemName', itemName);
    const found = itemOptions.find((item) => item.name === itemName);
    if (found && found.category) {
      handleChange('category', found.category);
    }
  };

  const validate = () => {
    if (!form.itemName) return 'Item Name is required.';
    if (!form.category) return 'Category is required.';
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) < 1) return 'Quantity must be a positive number.';
    if (!form.justification.trim()) return 'Justification is required.';
    if (!form.requiredDate) return 'Required Date is required.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        itemName: form.itemName,
        category: form.category,
        quantity: Number(form.quantity),
        justification: form.justification.trim(),
        requiredDate: form.requiredDate,
        status: 'Pending',
        organization: state.user?.organization,
        staff: state.user?._id,
      };
      await apiService.submitInventoryRequest(payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        (navigation as any).navigate('Requests', { screen: 'CurrentInventory', params: { refresh: true } });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit inventory request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'electronics': return 'laptop';
      case 'furniture': return 'seat';
      case 'office supplies': return 'pencil';
      case 'tools': return 'wrench';
      case 'uniforms': return 'tshirt-crew';
      default: return 'package-variant';
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
          <Title style={[styles.title, { color: theme.colors.text }]}>Request Inventory</Title>
          {error && (
            <Card style={[styles.errorCard, { backgroundColor: theme.colors.error + '10' }]}>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            </Card>
          )}
        </View>

        {/* Section 1: Item Details */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Item Details</Text>
            
            <Menu
              visible={showItemMenu}
              onDismiss={() => setShowItemMenu(false)}
              anchor={
                <TouchableOpacity 
                  style={[styles.itemInput, { borderColor: theme.colors.border }]}
                  onPress={() => setShowItemMenu(true)}
                >
                  <Icon name="package-variant" size={20} color={theme.colors.primary} style={styles.inputIcon} />
                  <Text style={[styles.itemText, { color: form.itemName ? theme.colors.text : theme.colors.placeholder }]}>
                    {form.itemName || 'Select Item *'}
                  </Text>
                  <Icon name="chevron-down" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              }
            >
              {itemOptions.map((item) => (
                <Menu.Item
                  key={item.name}
                  onPress={() => {
                    handleItemSelect(item.name);
                    setShowItemMenu(false);
                  }}
                  title={item.name}
                  leadingIcon={getCategoryIcon(item.category || '')}
                />
              ))}
            </Menu>

            <PaperTextInput
              mode="outlined"
              label="Category *"
              value={form.category}
              onChangeText={v => handleChange('category', v)}
              style={styles.input}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
              left={<PaperTextInput.Icon icon="tag" />}
            />

            <PaperTextInput
              mode="outlined"
              label="Quantity *"
              value={form.quantity}
              onChangeText={v => handleChange('quantity', v)}
              keyboardType="numeric"
              style={styles.input}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
              left={<PaperTextInput.Icon icon="numeric" />}
            />
          </Card.Content>
        </Card>

        {/* Section 2: Request Details */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Request Details</Text>

            <TouchableOpacity 
              style={[styles.dateInput, { borderColor: theme.colors.border }]} 
              onPress={() => setShowDatePicker(true)}
            >
              <Icon name="calendar" size={20} color={theme.colors.primary} style={styles.inputIcon} />
              <Text style={[styles.dateText, { color: form.requiredDate ? theme.colors.text : theme.colors.placeholder }]}>
                {form.requiredDate ? form.requiredDate : 'Required Date *'}
              </Text>
            </TouchableOpacity>

            <PaperTextInput
              mode="outlined"
              label="Justification *"
              value={form.justification}
              onChangeText={v => handleChange('justification', v)}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />

            {showDatePicker && (
              <DateTimePicker
                value={form.requiredDate ? new Date(form.requiredDate) : new Date()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) handleChange('requiredDate', date.toISOString().split('T')[0]);
                }}
              />
            )}
          </Card.Content>
        </Card>

        {/* Section 3: Request Summary */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Request Summary</Text>
            
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Icon name="package-variant" size={20} color={theme.colors.primary} />
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Item:</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{form.itemName || 'Not selected'}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Icon name="tag" size={20} color={theme.colors.primary} />
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Category:</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{form.category || 'Not specified'}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Icon name="numeric" size={20} color={theme.colors.primary} />
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Quantity:</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{form.quantity}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Icon name="calendar" size={20} color={theme.colors.primary} />
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Required Date:</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{form.requiredDate || 'Not set'}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {success && (
          <Card style={[styles.successCard, { backgroundColor: theme.colors.success + '10' }]}>
            <Text style={[styles.successText, { color: theme.colors.success }]}>Inventory request submitted successfully!</Text>
          </Card>
        )}
      </ScrollView>

      {/* Sticky Footer */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={[styles.footerButton, { backgroundColor: theme.colors.primary }]}
        >
          Submit Request
        </Button>
      </View>
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
  itemInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  inputIcon: {
    marginRight: 8,
  },
  itemText: {
    fontSize: 16,
    flex: 1,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  textArea: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  summaryContainer: {
    backgroundColor: 'transparent',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 80,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
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
  },
  footerButton: {
    flex: 1,
    borderRadius: 12,
  },
});

export default InventoryRequestScreen; 