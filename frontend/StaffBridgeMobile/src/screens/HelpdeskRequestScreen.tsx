import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { Card, ActivityIndicator } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiService from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography } from '../theme/theme';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#4CAF50' },
  { value: 'medium', label: 'Medium', color: '#2196F3' },
  { value: 'high', label: 'High', color: '#FF6B35' },
  { value: 'urgent', label: 'Urgent', color: '#E53E3E' },
];

const HelpdeskRequestScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [categories, setCategories] = useState<Array<{ _id: string; name: string; icon?: string; color?: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [subcategory, setSubcategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const data = await apiService.getHelpdeskCategories();
        const cats = Array.isArray(data) ? data : [];
        setCategories(cats);
        if (cats.length > 0) {
          setSelectedCategory(cats[0]._id);
          setSelectedCategoryName(cats[0].name);
        }
      } catch (error) {
        console.warn('Failed to fetch helpdesk categories:', error);
        Alert.alert('Error', 'Failed to load categories. Please try again.');
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && trimmedTag.length <= 50) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to attach files.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newAttachments = result.assets.map(asset => ({
        uri: asset.uri,
        type: asset.type === 'image' ? 'image/jpeg' : asset.mimeType || 'application/octet-stream',
        name: asset.fileName || `attachment_${Date.now()}.${asset.uri.split('.').pop()}`,
      }));
      setAttachments([...attachments, ...newAttachments]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (title.length > MAX_TITLE_LENGTH) errs.title = `Title must be less than ${MAX_TITLE_LENGTH} characters.`;
    if (!description.trim()) errs.description = 'Description is required.';
    if (description.length > MAX_DESCRIPTION_LENGTH) errs.description = `Description must be less than ${MAX_DESCRIPTION_LENGTH} characters.`;
    if (!selectedCategory) errs.category = 'Category is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await apiService.createHelpdeskTicket(
        {
          title: title.trim(),
          description: description.trim(),
          category: selectedCategory,
          priority,
          subcategory: subcategory.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        },
        attachments.length > 0 ? attachments : undefined
      );
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        navigation.navigate('HelpdeskHistory' as never);
      }, 1500);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || error?.message || 'Failed to submit helpdesk request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={[typography.h2, { color: theme.colors.primary, marginBottom: spacing.md }]}>New Helpdesk Request</Text>

          {/* Category */}
          <View style={styles.sectionHeader}>
            <Icon name="tag-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Category *</Text>
          </View>
          <View style={{ marginBottom: spacing.sm }}>
            {loadingCategories ? (
              <View style={[styles.input, { justifyContent: 'center' }]}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.input, styles.dropdown, errors.category ? styles.inputError : undefined]}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <Text style={{ color: selectedCategoryName ? theme.colors.text : theme.colors.placeholder }}>
                    {selectedCategoryName || 'Select a category'}
                  </Text>
                  <Icon name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
              </>
            )}
          </View>

          {/* Title */}
          <View style={styles.sectionHeader}>
            <Icon name="format-title" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Title *</Text>
          </View>
          <View style={{ marginBottom: spacing.sm }}>
            <TextInput
              style={[styles.input, errors.title ? styles.inputError : undefined]}
              value={title}
              onChangeText={text => setTitle(text.slice(0, MAX_TITLE_LENGTH))}
              placeholder="Brief description of your request"
              placeholderTextColor={theme.colors.placeholder}
              maxLength={MAX_TITLE_LENGTH}
            />
            <Text style={styles.charCount}>{title.length}/{MAX_TITLE_LENGTH} characters</Text>
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          </View>

          {/* Priority */}
          <View style={styles.sectionHeader}>
            <Icon name="flag-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Priority</Text>
          </View>
          <View style={{ marginBottom: spacing.sm }}>
            <TouchableOpacity
              style={[styles.input, styles.dropdown]}
              onPress={() => setShowPriorityModal(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.priorityDot, { backgroundColor: PRIORITIES.find(p => p.value === priority)?.color }]} />
                <Text style={{ color: theme.colors.text }}>
                  {PRIORITIES.find(p => p.value === priority)?.label || 'Medium'}
                </Text>
              </View>
              <Icon name="chevron-down" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.sectionHeader}>
            <Icon name="file-document-edit-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Description *</Text>
          </View>
          <View style={{ marginBottom: spacing.sm }}>
            <TextInput
              style={[styles.input, styles.textArea, errors.description ? styles.inputError : undefined]}
              value={description}
              onChangeText={text => setDescription(text.slice(0, MAX_DESCRIPTION_LENGTH))}
              placeholder="Please provide detailed information about your request..."
              placeholderTextColor={theme.colors.placeholder}
              multiline
              numberOfLines={6}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
            <Text style={styles.charCount}>{description.length}/{MAX_DESCRIPTION_LENGTH} characters</Text>
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
          </View>

          {/* Subcategory (Optional) */}
          <View style={styles.sectionHeader}>
            <Icon name="tag-multiple-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Subcategory (Optional)</Text>
          </View>
          <View style={{ marginBottom: spacing.sm }}>
            <TextInput
              style={styles.input}
              value={subcategory}
              onChangeText={setSubcategory}
              placeholder="Add subcategory if applicable"
              placeholderTextColor={theme.colors.placeholder}
              maxLength={100}
            />
          </View>

          {/* Tags */}
          <View style={styles.sectionHeader}>
            <Icon name="tag-multiple" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Tags (Optional)</Text>
          </View>
          <View style={{ marginBottom: spacing.sm }}>
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a tag and press Enter"
                placeholderTextColor={theme.colors.placeholder}
                onSubmitEditing={handleAddTag}
                maxLength={50}
              />
              <TouchableOpacity onPress={handleAddTag} style={styles.tagAddButton}>
                <Icon name="plus" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {tags.map((tag, index) => (
                  <View key={index} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                    <TouchableOpacity onPress={() => handleRemoveTag(tag)}>
                      <Icon name="close" size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Attachments */}
          <View style={styles.sectionHeader}>
            <Icon name="paperclip" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[typography.h4, { color: theme.colors.primary }]}>Attachments (Optional)</Text>
          </View>
          <View style={{ marginBottom: spacing.md }}>
            <TouchableOpacity style={styles.attachButton} onPress={handlePickImage}>
              <Icon name="paperclip" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ color: theme.colors.primary }}>Add Files</Text>
            </TouchableOpacity>
            {attachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                {attachments.map((attachment, index) => (
                  <View key={index} style={styles.attachmentItem}>
                    <Icon name="file" size={20} color={theme.colors.textSecondary} />
                    <Text style={[styles.attachmentName, { color: theme.colors.text }]} numberOfLines={1}>
                      {attachment.name}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveAttachment(index)}>
                      <Icon name="close-circle" size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
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

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categories.map(category => (
                <TouchableOpacity
                  key={category._id}
                  style={[
                    styles.modalOption,
                    selectedCategory === category._id && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setSelectedCategory(category._id);
                    setSelectedCategoryName(category.name);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>{category.name}</Text>
                  {selectedCategory === category._id && (
                    <Icon name="check" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Priority Modal */}
      <Modal
        visible={showPriorityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPriorityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Priority</Text>
              <TouchableOpacity onPress={() => setShowPriorityModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.modalOption,
                    priority === p.value && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setPriority(p.value);
                    setShowPriorityModal(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>{p.label}</Text>
                  </View>
                  {priority === p.value && (
                    <Icon name="check" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textArea: {
    minHeight: 120,
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
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#F7F9FB',
    paddingHorizontal: 12,
  },
  tagInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
  },
  tagAddButton: {
    padding: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    fontSize: 13,
    color: '#1976D2',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#F7F9FB',
  },
  attachmentsContainer: {
    marginTop: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F7F9FB',
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 16,
  },
});

export default HelpdeskRequestScreen;


