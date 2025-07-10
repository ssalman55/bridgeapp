import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, Alert, Linking } from 'react-native';
import { Card, Title, ActivityIndicator, HelperText, IconButton } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
};

// Add Document type for type safety
interface Document {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: string;
  organization: string | { _id: string };
  uploadedBy: string | { _id: string };
  createdAt: string;
  updatedAt: string;
}

const DocumentsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const { state } = useAuth();
  const { theme } = useTheme();

  const fetchDocuments = async (): Promise<void> => {
    setLoading(true);
    try {
      const params = { uploadedBy: (state.user as any)?.id || (state.user as any)?._id } as any;
      const data = await apiService.getDocuments(params);
      // Only show documents from the same organization and uploaded by the user
      const orgId = (state.user as any)?.organization?._id || (state.user as any)?.organization || (state.user as any)?.orgId;
      const filtered = (data as Document[]).filter((d) => {
        const docOrg = (d.organization as any)?._id || d.organization;
        const uploadedBy = (d.uploadedBy as any)?._id || d.uploadedBy;
        return String(docOrg) === String(orgId) && String(uploadedBy) === String(params.uploadedBy);
      });
      setDocuments(filtered);
    } catch (err) {
      setDocuments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  const handleView = async (doc: Document) => {
    if (!doc._id) return;
    try {
      console.log('Attempting to fetch document link for ID:', doc._id);
      const response = await apiService.downloadDocument(doc._id);
      console.log('Document link response:', response);
      if (response.url) {
        Linking.openURL(response.url);
      } else {
        console.error('No URL in response:', response);
        Alert.alert('Error', 'Unable to get document link.');
      }
    } catch (err) {
      console.error('Error fetching document link:', err);
      Alert.alert('Error', 'Unable to get document link.');
    }
  };

  const handleEdit = (doc: Document) => {
    Alert.alert('Edit', 'Edit functionality not implemented in this demo.');
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiService.deleteDocument(id);
          await fetchDocuments();
        } catch (err) {
          Alert.alert('Error', 'Failed to delete document.');
        }
      }}
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.headerRow}>
        <Title style={[styles.header, { color: theme.colors.text }]}>My Documents</Title>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : documents.length === 0 ? (
        <HelperText type="info" visible style={{ textAlign: 'center', marginTop: 32 }}>No documents found.</HelperText>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
        >
          {documents.map((doc, idx) => (
            <Card key={doc._id || idx} style={styles.docCard}>
              <Card.Content style={styles.docContent}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: theme.colors.primary }]}>{doc.title}</Text>
                  <Text style={styles.desc}>{doc.description}</Text>
                  <Text style={styles.date}>Uploaded: {formatDate(doc.createdAt)}</Text>
                </View>
                <View style={styles.actions}>
                  <IconButton icon="eye" iconColor={theme.colors.primary} onPress={() => handleView(doc)} />
                  <IconButton icon="pencil" iconColor={theme.colors.primary} onPress={() => handleEdit(doc)} />
                  <IconButton icon="delete" iconColor={theme.colors.error} onPress={() => handleDelete(doc._id)} />
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { marginTop: 16, marginBottom: 8, marginHorizontal: 16 },
  header: { fontSize: 22, fontWeight: 'bold' },
  list: { paddingHorizontal: 8, paddingBottom: 16 },
  docCard: { borderRadius: 16, elevation: 2, marginBottom: 16 },
  docContent: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: 'bold', fontSize: 16 },
  desc: { fontSize: 14, color: '#333', marginTop: 2 },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
});

export default DocumentsScreen; 