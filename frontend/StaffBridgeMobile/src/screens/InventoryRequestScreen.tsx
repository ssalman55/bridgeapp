import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Card, Title, Button } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [itemOptions, setItemOptions] = useState<any[]>([]);

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
      setTimeout(() => setSuccess(false), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit inventory request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Request Inventory</Title>
          {error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.label}>Item Name *</Text>
          <View style={styles.dropdownContainer}>
            {itemOptions.map((item) => (
              <TouchableOpacity
                key={item.name}
                style={[styles.dropdownItem, form.itemName === item.name && styles.dropdownItemSelected]}
                onPress={() => handleItemSelect(item.name)}
              >
                <Text style={{ color: form.itemName === item.name ? '#fff' : theme.colors.text }}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Category *"
            value={form.category}
            onChangeText={v => handleChange('category', v)}
          />
          <TextInput
            style={styles.input}
            placeholder="Quantity *"
            value={form.quantity}
            keyboardType="numeric"
            onChangeText={v => handleChange('quantity', v)}
          />
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            placeholder="Justification *"
            value={form.justification}
            onChangeText={v => handleChange('justification', v)}
            multiline
          />
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={{ color: form.requiredDate ? theme.colors.text : theme.colors.placeholder }}>
              {form.requiredDate ? form.requiredDate : 'Required Date *'}
            </Text>
          </TouchableOpacity>
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
          <Button mode="contained" onPress={handleSubmit} loading={submitting} disabled={submitting} style={{ marginTop: 16 }}>
            Submit Request
          </Button>
          {success && <Text style={styles.success}>Inventory request submitted!</Text>}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  label: { fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 8, marginBottom: 8, backgroundColor: '#F7F9FB', fontSize: 16 },
  dropdownContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  dropdownItem: { borderWidth: 1, borderColor: '#1976D2', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 },
  dropdownItemSelected: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  error: { color: '#D32F2F', marginBottom: 8 },
  success: { color: '#388E3C', marginTop: 8, fontWeight: 'bold' },
});

export default InventoryRequestScreen; 