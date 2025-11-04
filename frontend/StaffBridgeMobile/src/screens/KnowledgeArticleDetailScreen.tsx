import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const KnowledgeArticleDetailScreen: React.FC = () => {
  const route = useRoute();
  const { theme } = useTheme();
  const { articleId } = route.params as { articleId: string };
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [helpful, setHelpful] = useState<boolean | null>(null);

  useEffect(() => {
    fetchArticle();
  }, [articleId]);

  const fetchArticle = async () => {
    setLoading(true);
    try {
      const data = await apiService.getKnowledgeArticle(articleId);
      setArticle(data);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (isHelpful: boolean) => {
    if (helpful !== null) {
      Alert.alert('Already Rated', 'You have already rated this article');
      return;
    }
    try {
      await apiService.rateKnowledgeArticle(articleId, isHelpful);
      setHelpful(isHelpful);
      fetchArticle(); // Refresh to show updated ratings
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to rate article');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ textAlign: 'center', marginTop: 32, color: theme.colors.text }}>Article not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.header}>
          {article.isFeatured && (
            <View style={styles.featuredBadge}>
              <Icon name="star" size={16} color={theme.colors.orange} />
              <Text style={{ color: theme.colors.orange, fontSize: 12, marginLeft: 4 }}>Featured</Text>
            </View>
          )}
          <Title style={[styles.title, { color: theme.colors.text }]}>{article.title}</Title>
          {article.summary && (
            <Paragraph style={[styles.summary, { color: theme.colors.textSecondary }]}>
              {article.summary}
            </Paragraph>
          )}
        </View>

        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            {article.type && (
              <Chip
                style={{
                  backgroundColor: theme.colors.primary + '20',
                  marginRight: 8,
                }}
                textStyle={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}
              >
                {article.type.toUpperCase()}
              </Chip>
            )}
            {article.difficulty && (
              <Chip
                style={{
                  backgroundColor: theme.colors.border,
                  marginRight: 8,
                }}
                textStyle={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' }}
              >
                {article.difficulty.toUpperCase()}
              </Chip>
            )}
            {article.category?.name && (
              <Chip
                style={{
                  backgroundColor: theme.colors.border,
                }}
                textStyle={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' }}
              >
                {article.category.name}
              </Chip>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="eye" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
                {article.views || 0} views
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="thumb-up" size={16} color={theme.colors.success} />
              <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
                {article.helpful || 0} helpful
              </Text>
            </View>
            <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
              {formatDate(article.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.contentSection}>
          <Text style={[styles.content, { color: theme.colors.text }]}>{article.content}</Text>
        </View>

        {article.tags && article.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tags</Text>
            <View style={styles.tagsContainer}>
              {article.tags.map((tag: string, index: number) => (
                <Chip key={index} style={styles.tagChip} textStyle={{ fontSize: 12 }}>
                  {tag}
                </Chip>
              ))}
            </View>
          </View>
        )}

        <View style={styles.ratingSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Was this article helpful?</Text>
          <View style={styles.ratingButtons}>
            <Button
              mode={helpful === true ? 'contained' : 'outlined'}
              onPress={() => handleRate(true)}
              disabled={helpful !== null}
              style={{ marginRight: 12 }}
              buttonColor={theme.colors.success}
              textColor={helpful === true ? '#FFF' : theme.colors.success}
            >
              <Icon name="thumb-up" size={18} style={{ marginRight: 4 }} />
              Yes ({article.helpful || 0})
            </Button>
            <Button
              mode={helpful === false ? 'contained' : 'outlined'}
              onPress={() => handleRate(false)}
              disabled={helpful !== null}
              buttonColor={theme.colors.error}
              textColor={helpful === false ? '#FFF' : theme.colors.error}
            >
              <Icon name="thumb-down" size={18} style={{ marginRight: 4 }} />
              No ({article.notHelpful || 0})
            </Button>
          </View>
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
    marginBottom: 16,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  summary: {
    fontSize: 16,
    lineHeight: 24,
  },
  metaSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  dateText: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  contentSection: {
    marginBottom: 20,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
  tagsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    height: 28,
  },
  ratingSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  ratingButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
});

export default KnowledgeArticleDetailScreen;


