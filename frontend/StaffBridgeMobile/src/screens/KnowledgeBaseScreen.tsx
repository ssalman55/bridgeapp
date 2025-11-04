import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, TextInput } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, HelperText } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getTypeColor = (type: string, theme: any) => {
  switch (type?.toLowerCase()) {
    case 'faq':
      return theme.colors.info;
    case 'guide':
      return theme.colors.success;
    case 'policy':
      return theme.colors.warning;
    case 'troubleshooting':
      return theme.colors.error;
    case 'announcement':
      return theme.colors.orange;
    default:
      return theme.colors.textSecondary;
  }
};

const KnowledgeBaseScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const { theme } = useTheme();

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: 1, limit: 50, status: 'published' };
      if (selectedCategory) params.category = selectedCategory;
      if (selectedType) params.type = selectedType;
      if (search) params.search = search;
      
      const data = await apiService.getKnowledgeArticles(params);
      const articlesList = data?.articles || data || [];
      setArticles(Array.isArray(articlesList) ? articlesList : []);
    } catch (err: any) {
      console.warn('Error fetching knowledge articles:', err);
      setError(err.message || 'Failed to fetch articles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, selectedType, search]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchArticles();
  };

  const handleArticlePress = (articleId: string) => {
    navigation.navigate('KnowledgeArticleDetail' as never, { articleId } as never);
  };

  const filteredArticles = articles.filter((article) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        article.title?.toLowerCase().includes(searchLower) ||
        article.summary?.toLowerCase().includes(searchLower) ||
        article.content?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const uniqueTypes = Array.from(new Set(articles.map(a => a.type).filter(Boolean)));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search knowledge base..."
            placeholderTextColor={theme.colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
          <TouchableOpacity
            onPress={() => setSelectedType('')}
            style={[
              styles.filterChip,
              { backgroundColor: !selectedType ? theme.colors.primary : theme.colors.surface },
              { borderColor: !selectedType ? theme.colors.primary : theme.colors.border }
            ]}
          >
            <Text style={{ color: !selectedType ? '#FFF' : theme.colors.text, fontSize: 12 }}>All Types</Text>
          </TouchableOpacity>
          {uniqueTypes.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setSelectedType(selectedType === type ? '' : type)}
              style={[
                styles.filterChip,
                { backgroundColor: selectedType === type ? theme.colors.primary : theme.colors.surface },
                { borderColor: selectedType === type ? theme.colors.primary : theme.colors.border }
              ]}
            >
              <Text style={{ color: selectedType === type ? '#FFF' : theme.colors.text, fontSize: 12 }}>
                {type ? type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Title style={[styles.screenTitle, { color: theme.colors.text }]}>Knowledge Base</Title>
          <Paragraph style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
            Find answers and solutions to common questions
          </Paragraph>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <HelperText type="error" visible style={{ textAlign: 'center', marginTop: 32 }}>{error}</HelperText>
        ) : filteredArticles.length === 0 ? (
          <Paragraph style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary, padding: 16 }}>
            No articles found.
          </Paragraph>
        ) : (
          filteredArticles.map((article, idx) => {
            const typeColor = getTypeColor(article.type, theme);
            
            return (
              <Card
                key={article._id || idx}
                style={[styles.card, { backgroundColor: theme.colors.surface }]}
                onPress={() => handleArticlePress(article._id)}
              >
                <TouchableOpacity activeOpacity={0.7} onPress={() => handleArticlePress(article._id)}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      {article.isFeatured && (
                        <Icon name="star" size={16} color={theme.colors.orange} style={{ marginRight: 4 }} />
                      )}
                      <Text style={[styles.articleTitle, { color: theme.colors.text }]} numberOfLines={2}>
                        {article.title || 'Untitled Article'}
                      </Text>
                    </View>
                  </View>
                  
                  {article.summary && (
                    <Text style={[styles.articleSummary, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                      {article.summary}
                    </Text>
                  )}
                  
                  <View style={styles.cardMeta}>
                    {article.type && (
                      <Chip
                        style={{
                          backgroundColor: typeColor + '20',
                          borderWidth: 1,
                          borderColor: typeColor,
                          height: 24,
                          marginRight: 8,
                        }}
                        textStyle={{ color: typeColor, fontSize: 10, fontWeight: '600' }}
                      >
                        {article.type.toUpperCase()}
                      </Chip>
                    )}
                    {article.difficulty && (
                      <Chip
                        style={{
                          backgroundColor: theme.colors.border,
                          height: 24,
                          marginRight: 8,
                        }}
                        textStyle={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}
                      >
                        {article.difficulty.toUpperCase()}
                      </Chip>
                    )}
                    {article.category?.name && (
                      <Chip
                        style={{
                          backgroundColor: theme.colors.border,
                          height: 24,
                        }}
                        textStyle={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}
                      >
                        {article.category.name}
                      </Chip>
                    )}
                  </View>
                  
                  <View style={styles.cardFooter}>
                    <View style={styles.metaItem}>
                      <Icon name="eye" size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                        {article.views || 0}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Icon name="thumb-up" size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                        {article.helpful || 0}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Icon name="calendar" size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                        {formatDate(article.createdAt)}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterChips: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  articleSummary: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
});

export default KnowledgeBaseScreen;


