import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getStatusColor = (status: string, theme: any) => {
  switch (status?.toLowerCase()) {
    case 'open':
      return { bg: theme.colors.info + '20', border: theme.colors.info, text: theme.colors.info };
    case 'in_progress':
      return { bg: theme.colors.warning + '20', border: theme.colors.warning, text: theme.colors.warning };
    case 'on_hold':
      return { bg: theme.colors.textSecondary + '20', border: theme.colors.textSecondary, text: theme.colors.textSecondary };
    case 'resolved':
      return { bg: theme.colors.success + '20', border: theme.colors.success, text: theme.colors.success };
    case 'closed':
      return { bg: theme.colors.textTertiary + '20', border: theme.colors.textTertiary, text: theme.colors.textTertiary };
    default:
      return { bg: theme.colors.border, border: theme.colors.textSecondary, text: theme.colors.textSecondary };
  }
};

const HelpdeskTicketDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { ticketId } = route.params as { ticketId: string };
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  const fetchTicket = async () => {
    setLoading(true);
    try {
      const data = await apiService.getHelpdeskTicket(ticketId);
      setTicket(data);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load ticket details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }
    setSubmittingComment(true);
    try {
      await apiService.addTicketComment(ticketId, comment.trim(), false);
      setComment('');
      fetchTicket(); // Refresh ticket to show new comment
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ textAlign: 'center', marginTop: 32, color: theme.colors.text }}>Ticket not found</Text>
      </View>
    );
  }

  const statusColors = getStatusColor(ticket.status, theme);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.ticketNumber, { color: theme.colors.textSecondary }]}>
              {ticket.ticketNumber}
            </Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>{ticket.title}</Text>
          </View>
          <Chip
            style={{
              backgroundColor: statusColors.bg,
              borderWidth: 1,
              borderColor: statusColors.border,
            }}
            textStyle={{ color: statusColors.text, fontWeight: '600' }}
          >
            {ticket.status ? ticket.status.replace('_', ' ').toUpperCase() : 'OPEN'}
          </Chip>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Description</Text>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{ticket.description}</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Category</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {ticket.category?.name || 'Uncategorized'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Priority</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {ticket.priority ? ticket.priority.toUpperCase() : 'MEDIUM'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Created</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {formatDate(ticket.createdAt)}
            </Text>
          </View>
          {ticket.assignedTo && (
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Assigned To</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {typeof ticket.assignedTo === 'object' ? ticket.assignedTo.fullName : ticket.assignedTo}
              </Text>
            </View>
          )}
        </View>

        {ticket.tags && ticket.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tags</Text>
            <View style={styles.tagsContainer}>
              {ticket.tags.map((tag: string, index: number) => (
                <Chip key={index} style={styles.tagChip} textStyle={{ fontSize: 12 }}>
                  {tag}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {ticket.comments && ticket.comments.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Comments ({ticket.comments.length})
            </Text>
            {ticket.comments.map((comment: any, index: number) => (
              <Card key={index} style={[styles.commentCard, { backgroundColor: theme.colors.background }]}>
                <View style={styles.commentHeader}>
                  <Text style={[styles.commentAuthor, { color: theme.colors.text }]}>
                    {comment.author?.fullName || 'Unknown'}
                  </Text>
                  <Text style={[styles.commentDate, { color: theme.colors.textSecondary }]}>
                    {formatDate(comment.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.commentContent, { color: theme.colors.textSecondary }]}>
                  {comment.content}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Add Comment</Text>
          <TextInput
            style={[styles.commentInput, { backgroundColor: theme.colors.background, color: theme.colors.text }]}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment..."
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={4}
          />
          <Button
            mode="contained"
            onPress={handleAddComment}
            loading={submittingComment}
            disabled={submittingComment || !comment.trim()}
            style={{ marginTop: 8 }}
            buttonColor={theme.colors.primary}
          >
            Post Comment
          </Button>
        </View>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  ticketNumber: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  infoItem: {
    width: '50%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    height: 28,
  },
  commentCard: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentDate: {
    fontSize: 12,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});

export default HelpdeskTicketDetailScreen;


