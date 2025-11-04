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
  Linking,
} from 'react-native';
import { Card, Title, ActivityIndicator, HelperText, Button, TextInput as PaperTextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface OrganizationDocument {
  _id: string;
  title: string;
  description?: string;
  category: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  version?: string;
  tags?: string[];
  uploadedBy: {
    _id: string;
    fullName: string;
    email?: string;
  };
  uploadedAt: string;
  effectiveDate?: string;
  expiryDate?: string;
  downloadCount: number;
  viewCount: number;
  downloadUrl?: string;
}

interface DocumentStats {
  totalDocuments: number;
  categoryStats: Array<{
    _id: string;
    count: number;
    totalSize: number;
    totalDownloads: number;
    totalViews: number;
  }>;
}

const DocumentsLibraryScreen: React.FC = () => {
  const { state } = useAuth();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<OrganizationDocument[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [selectedDocument, setSelectedDocument] = useState<OrganizationDocument | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page: 1,
        limit: 50,
        status: 'active',
      };
      
      if (categoryFilter) {
        params.category = categoryFilter;
      }
      
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const data = await apiService.getOrganizationDocuments(params);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (err: any) {
      console.error('[DocumentsLibrary] Error fetching documents:', err);
      Alert.alert('Error', err.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiService.getOrganizationDocumentStats();
      setStats(data);
    } catch (err: any) {
      console.error('[DocumentsLibrary] Error fetching stats:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiService.getOrganizationDocumentCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[DocumentsLibrary] Error fetching categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchStats();
    fetchCategories();
  }, [fetchDocuments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
    fetchStats();
    fetchCategories();
  };

  const handleDocumentPress = async (document: OrganizationDocument) => {
    try {
      // Fetch full document details to get signed URL
      const fullDocument = await apiService.getOrganizationDocument(document._id);
      setSelectedDocument(fullDocument);
      setShowDocumentModal(true);
    } catch (err: any) {
      console.error('[DocumentsLibrary] Error fetching document details:', err);
      Alert.alert('Error', err.message || 'Failed to fetch document details');
    }
  };

  const handleDownload = async (document: OrganizationDocument) => {
    if (!document._id) return;

    setDownloading(true);
    try {
      Alert.alert(
        'Download',
        `Download ${document.title}?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setDownloading(false) },
          {
            text: 'Download',
            onPress: async () => {
              try {
                const downloadData = await apiService.downloadOrganizationDocument(document._id);
                const downloadUrl = downloadData.downloadUrl;
                const fileName = downloadData.fileName || document.originalFileName || `document-${document._id}.pdf`;

                // Download file
                const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
                const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);

                // Share/Open file
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(downloadResult.uri);
                } else {
                  await Linking.openURL(downloadUrl);
                }

                Alert.alert('Success', 'Document downloaded successfully');
                
                // Refresh documents to update download count
                fetchDocuments();
                fetchStats();
              } catch (err: any) {
                console.error('[DocumentsLibrary] Download error:', err);
                Alert.alert('Error', err.message || 'Failed to download document');
              } finally {
                setDownloading(false);
              }
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('[DocumentsLibrary] Download error:', err);
      Alert.alert('Error', err.message || 'Failed to download document');
      setDownloading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Policy': '#F44336',
      'Guideline': '#2196F3',
      'Handbook': '#4CAF50',
      'Procedure': '#FF9800',
      'Form': '#9C27B0',
      'Template': '#00BCD4',
      'Announcement': '#E91E63',
      'Compliance': '#FF5722',
      'Training Material': '#3F51B5',
      'Other': '#9E9E9E',
    };
    return colors[category] || '#9E9E9E';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'file-pdf-box';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file-word-box';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-excel-box';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'file-powerpoint-box';
    if (mimeType.includes('image')) return 'file-image';
    if (mimeType.includes('text')) return 'file-document';
    return 'file-document-outline';
  };

  const filteredDocuments = documents.filter((doc) => {
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      return (
        doc.title?.toLowerCase().includes(search) ||
        doc.description?.toLowerCase().includes(search) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Title style={[styles.screenTitle, { color: theme.colors.text }]}>
            Documents Library
          </Title>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Organization policies, guidelines, and documents
          </Text>
        </View>

        {/* Statistics Cards */}
        {stats && (
          <View style={styles.statsContainer}>
            <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <View style={styles.statContent}>
                  <Icon name="file-document" size={24} color={theme.colors.primary} />
                  <View style={styles.statText}>
                    <Text style={[styles.statValue, { color: theme.colors.text }]}>
                      {stats.totalDocuments || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                      Total Documents
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
            <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <View style={styles.statContent}>
                  <Icon name="folder" size={24} color="#4CAF50" />
                  <View style={styles.statText}>
                    <Text style={[styles.statValue, { color: theme.colors.text }]}>
                      {categories.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                      Categories
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Search and Filter Bar */}
        <View style={styles.filterContainer}>
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
            <Icon name="magnify" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
            <PaperTextInput
              mode="flat"
              placeholder="Search documents..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { backgroundColor: 'transparent' }]}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
            />
          </View>
          
          <TouchableOpacity
            style={[styles.categoryFilter, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowCategoryFilter(!showCategoryFilter)}
          >
            <Icon name="filter" size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.categoryFilterText, { color: theme.colors.text }]}>
              {categoryFilter ? categories.find(c => c.category === categoryFilter)?.category || 'All Categories' : 'All Categories'}
            </Text>
            <Icon name={showCategoryFilter ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Category Filter Dropdown */}
        {showCategoryFilter && (
          <Card style={[styles.categoryDropdown, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <TouchableOpacity
                style={styles.categoryOption}
                onPress={() => {
                  setCategoryFilter('');
                  setShowCategoryFilter(false);
                }}
              >
                <Text style={[styles.categoryOptionText, { color: !categoryFilter ? theme.colors.primary : theme.colors.text }]}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.category}
                  style={styles.categoryOption}
                  onPress={() => {
                    setCategoryFilter(cat.category);
                    setShowCategoryFilter(false);
                  }}
                >
                  <Text style={[styles.categoryOptionText, { color: categoryFilter === cat.category ? theme.colors.primary : theme.colors.text }]}>
                    {cat.category} ({cat.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Documents List */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : filteredDocuments.length === 0 ? (
          <HelperText type="info" visible style={{ textAlign: 'center', marginTop: 32, marginHorizontal: 16 }}>
            {searchQuery || categoryFilter ? 'No documents found matching your filters.' : 'No documents available.'}
          </HelperText>
        ) : (
          filteredDocuments.map((document) => (
            <TouchableOpacity
              key={document._id}
              onPress={() => handleDocumentPress(document)}
              activeOpacity={0.7}
            >
              <Card style={[styles.documentCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                <View style={styles.documentHeader}>
                  <View style={styles.documentIconContainer}>
                    <Icon 
                      name={getFileIcon(document.mimeType)} 
                      size={32} 
                      color={getCategoryColor(document.category)} 
                    />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={[styles.documentTitle, { color: theme.colors.text }]} numberOfLines={2}>
                      {document.title}
                    </Text>
                    <View style={styles.documentMeta}>
                      <View
                        style={[
                          styles.categoryChip,
                          { backgroundColor: getCategoryColor(document.category) + '20' }
                        ]}
                      >
                        <Text style={[styles.categoryChipText, { color: getCategoryColor(document.category) }]}>
                          {document.category}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {document.description && (
                  <Text style={[styles.documentDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                    {document.description}
                  </Text>
                )}

                <View style={styles.documentFooter}>
                  <View style={styles.documentFooterRow}>
                    <Icon name="account" size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.documentFooterText, { color: theme.colors.textSecondary }]}>
                      {document.uploadedBy?.fullName || 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.documentFooterRow}>
                    <Icon name="calendar" size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.documentFooterText, { color: theme.colors.textSecondary }]}>
                      {formatDate(document.uploadedAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.documentStats}>
                  <View style={styles.documentStatsRow}>
                    <Icon name="download" size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.documentStatsText, { color: theme.colors.textSecondary }]}>
                      {document.downloadCount || 0} downloads
                    </Text>
                  </View>
                  <View style={styles.documentStatsRow}>
                    <Icon name="eye" size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.documentStatsText, { color: theme.colors.textSecondary }]}>
                      {document.viewCount || 0} views
                    </Text>
                  </View>
                  <Text style={[styles.documentStatsText, { color: theme.colors.textSecondary }]}>
                    {formatFileSize(document.fileSize)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.downloadButton, { backgroundColor: theme.colors.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDownload(document);
                  }}
                  disabled={downloading}
                >
                  <Icon name="download" size={20} color="#fff" />
                  <Text style={styles.downloadButtonText}>Download</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Document Detail Modal */}
      <Modal
        visible={showDocumentModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDocumentModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeaderLeft}>
              <Icon 
                name={selectedDocument ? getFileIcon(selectedDocument.mimeType) : 'file-document'} 
                size={24} 
                color={theme.colors.primary} 
              />
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {selectedDocument?.title || 'Document Details'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowDocumentModal(false)}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {selectedDocument ? (
              <>
                <View style={styles.modalTags}>
                  <View
                    style={[
                      styles.modalCategoryChip,
                      { backgroundColor: getCategoryColor(selectedDocument.category) + '20' }
                    ]}
                  >
                    <Text style={[styles.modalCategoryChipText, { color: getCategoryColor(selectedDocument.category) }]}>
                      {selectedDocument.category}
                    </Text>
                  </View>
                  {selectedDocument.version && (
                    <View
                      style={[
                        styles.modalVersionChip,
                        { backgroundColor: theme.colors.surface }
                      ]}
                    >
                      <Text style={[styles.modalVersionChipText, { color: theme.colors.textSecondary }]}>
                        v{selectedDocument.version}
                      </Text>
                    </View>
                  )}
                </View>

                {selectedDocument.description && (
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>Description</Text>
                    <Text style={[styles.modalSectionContent, { color: theme.colors.textSecondary }]}>
                      {selectedDocument.description}
                    </Text>
                  </View>
                )}

                {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>Tags</Text>
                    <View style={styles.modalTagsContainer}>
                      {selectedDocument.tags.map((tag, index) => (
                        <View key={index} style={styles.modalTagChip}>
                          <Text style={styles.modalTagChipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.modalDetailsGrid}>
                  <View style={styles.modalDetailItem}>
                    <Text style={[styles.modalDetailLabel, { color: theme.colors.textSecondary }]}>File Size</Text>
                    <Text style={[styles.modalDetailValue, { color: theme.colors.text }]}>
                      {formatFileSize(selectedDocument.fileSize)}
                    </Text>
                  </View>
                  <View style={styles.modalDetailItem}>
                    <Text style={[styles.modalDetailLabel, { color: theme.colors.textSecondary }]}>File Type</Text>
                    <Text style={[styles.modalDetailValue, { color: theme.colors.text }]}>
                      {selectedDocument.mimeType?.split('/')[1]?.toUpperCase() || 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.modalDetailItem}>
                    <Text style={[styles.modalDetailLabel, { color: theme.colors.textSecondary }]}>Uploaded By</Text>
                    <Text style={[styles.modalDetailValue, { color: theme.colors.text }]}>
                      {selectedDocument.uploadedBy?.fullName || 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.modalDetailItem}>
                    <Text style={[styles.modalDetailLabel, { color: theme.colors.textSecondary }]}>Upload Date</Text>
                    <Text style={[styles.modalDetailValue, { color: theme.colors.text }]}>
                      {formatDate(selectedDocument.uploadedAt)}
                    </Text>
                  </View>
                  {selectedDocument.effectiveDate && (
                    <View style={styles.modalDetailItem}>
                      <Text style={[styles.modalDetailLabel, { color: theme.colors.textSecondary }]}>Effective Date</Text>
                      <Text style={[styles.modalDetailValue, { color: theme.colors.text }]}>
                        {formatDate(selectedDocument.effectiveDate)}
                      </Text>
                    </View>
                  )}
                  {selectedDocument.expiryDate && (
                    <View style={styles.modalDetailItem}>
                      <Text style={[styles.modalDetailLabel, { color: theme.colors.textSecondary }]}>Expiry Date</Text>
                      <Text style={[styles.modalDetailValue, { color: theme.colors.text }]}>
                        {formatDate(selectedDocument.expiryDate)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modalDetailItem}>
                    <Text style={[styles.modalDetailLabel, { color: theme.colors.textSecondary }]}>Downloads</Text>
                    <Text style={[styles.modalDetailValue, { color: theme.colors.text }]}>
                      {selectedDocument.downloadCount || 0}
                    </Text>
                  </View>
                  <View style={styles.modalDetailItem}>
                    <Text style={[styles.modalDetailLabel, { color: theme.colors.textSecondary }]}>Views</Text>
                    <Text style={[styles.modalDetailValue, { color: theme.colors.text }]}>
                      {selectedDocument.viewCount || 0}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            )}
          </ScrollView>

          {/* Modal Footer */}
          {selectedDocument && (
            <View style={[styles.modalFooter, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
              <Button
                mode="contained"
                onPress={() => {
                  handleDownload(selectedDocument);
                  setShowDocumentModal(false);
                }}
                loading={downloading}
                disabled={downloading}
                style={[styles.modalDownloadButton, { backgroundColor: theme.colors.primary }]}
                icon="download"
              >
                Download
              </Button>
            </View>
          )}
        </View>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    elevation: 2,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statText: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
  },
  categoryFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    elevation: 1,
  },
  categoryFilterText: {
    flex: 1,
    fontSize: 14,
  },
  categoryDropdown: {
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 2,
  },
  categoryOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  categoryOptionText: {
    fontSize: 14,
  },
  documentCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  documentMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  documentDescription: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  documentFooter: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  documentFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  documentFooterText: {
    fontSize: 12,
  },
  documentStats: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
    flexWrap: 'wrap',
  },
  documentStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  documentStatsText: {
    fontSize: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalTags: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  modalCategoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCategoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalVersionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalVersionChipText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalSectionContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  modalTagChipText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  modalDetailItem: {
    width: '48%',
    marginBottom: 16,
  },
  modalDetailLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  modalDownloadButton: {
    borderRadius: 8,
  },
});

export default DocumentsLibraryScreen;

