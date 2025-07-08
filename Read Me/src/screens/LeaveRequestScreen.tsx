import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Card, ActivityIndicator } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiService from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography } from '../theme/theme';
import { useNavigation } from '@react-navigation/native';

const LEAVE_TYPES = [
  { label: 'Annual', icon: 'calendar-blank' },
  { label: 'Sick', icon: 'emoticon-sick-outline' },
  { label: 'Maternity', icon: 'baby-face-outline' },
  { label: 'Paternity', icon: 'account-tie-outline' },
  { label: 'Unpaid', icon: 'cash-remove' },
  { label: 'Other', icon: 'dots-horizontal' },
];

const MAX_REASON_LENGTH = 300;

const LeaveRequestScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [leaveType, setLeaveType] = useState('Annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [success, setSuccess] = useState(false);

  const calcTotalDays = () => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff.toString() : '';
  };

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!leaveType) errs.leaveType = 'Leave type is required.';
    if (!startDate) errs.startDate = 'Start date is required.';
    if (!endDate) errs.endDate = 'End date is required.';
    if (startDate && endDate && endDate < startDate) errs.endDate = 'End date must be after start date.';
    if (!reason.trim()) errs.reason = 'Reason is required.';
    if (reason.length > MAX_REASON_LENGTH) errs.reason = 'Reason is too long.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await apiService.requestLeave({
        type: leaveType,
        startDate: startDate,
        endDate: endDate,
        reason: reason.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        navigation.navigate('LeaveHistory' as never);
      }, 1500);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={[typography.h2, { color: theme.colors.primary, marginBottom: spacing.md }]}>New Leave Request</Text>

          {/* Leave Details */}
          <View style={styles.sectionHeader}>
            <Icon name="file-document-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Leave Details</Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <TouchableOpacity style={[styles.dropdown, ...(errors.leaveType ? [styles.inputError] : [])]} onPress={() => setShowStartPicker(false)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={LEAVE_TYPES.find(t => t.label === leaveType)?.icon || 'calendar-blank'} size={20} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.colors.text }}>{leaveType}</Text>
                </View>
              </TouchableOpacity>
              {/* Dropdown options */}
              <View style={styles.dropdownOptionsContainer}>
                {LEAVE_TYPES.map(type => (
                  <TouchableOpacity key={type.label} style={styles.dropdownOption} onPress={() => setLeaveType(type.label)}>
                    <Icon name={type.icon} size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: theme.colors.text }}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.leaveType && <Text style={styles.errorText}>{errors.leaveType}</Text>}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <TextInput
                style={[styles.input, theme.colors.disabled ? { backgroundColor: theme.colors.disabled } : undefined]}
                value={typeof calcTotalDays() === 'string' ? calcTotalDays() : ''}
                editable={false}
                placeholder="Total Days"
                placeholderTextColor={theme.colors.placeholder}
              />
            </View>
          </View>

          {/* Dates */}
          <View style={styles.sectionHeader}>
            <Icon name="calendar-month-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Dates</Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <TextInput
                style={[styles.input, errors.startDate ? styles.inputError : undefined, theme.colors.disabled ? { backgroundColor: theme.colors.disabled } : undefined]}
                value={typeof startDate === 'string' ? startDate : ''}
                onChangeText={text => setStartDate(text)}
                placeholder="Start Date (YYYY-MM-DD)"
                placeholderTextColor={theme.colors.placeholder}
              />
              {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <TextInput
                style={[styles.input, errors.endDate ? styles.inputError : undefined, theme.colors.disabled ? { backgroundColor: theme.colors.disabled } : undefined]}
                value={typeof endDate === 'string' ? endDate : ''}
                onChangeText={text => setEndDate(text)}
                placeholder="End Date (YYYY-MM-DD)"
                placeholderTextColor={theme.colors.placeholder}
              />
              {errors.endDate && <Text style={styles.errorText}>{errors.endDate}</Text>}
            </View>
          </View>

          {/* Reason */}
          <View style={styles.sectionHeader}>
            <Icon name="file-document-edit-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Reason</Text>
          </View>
          <View style={{ marginBottom: spacing.md }}>
            <TextInput
              style={[styles.input, styles.textArea, errors.reason ? styles.inputError : undefined]}
              value={reason}
              onChangeText={text => setReason(text.slice(0, MAX_REASON_LENGTH))}
              placeholder="Enter your reason (max 300 characters)"
              placeholderTextColor={theme.colors.placeholder}
              multiline
              numberOfLines={4}
              maxLength={MAX_REASON_LENGTH}
            />
            <Text style={styles.charCount}>{reason.length}/{MAX_REASON_LENGTH} characters</Text>
            {errors.reason && <Text style={styles.errorText}>{errors.reason}</Text>}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.7 }, success && { backgroundColor: theme.colors.success }]}
            onPress={handleSubmit}
            disabled={submitting || success}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : success ? (
              <Icon name="check-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
            ) : (
              <Icon name="check" size={22} color="#fff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.submitButtonText}>{success ? 'Submitted!' : 'Submit Request'}</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: spacing.lg,
    backgroundColor: '#fff',
    shadowColor: '#1976D2',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F7F9FB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    marginBottom: 4,
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  dropdown: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F7F9FB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownOptionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 2,
    marginBottom: 8,
    zIndex: 10,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#757575',
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    marginBottom: 2,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976D2',
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: spacing.md,
    marginBottom: 4,
    shadowColor: '#1976D2',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 0.5,
  },
});

export default LeaveRequestScreen; 