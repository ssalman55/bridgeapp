import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, HelperText, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

const getPriorityColor = (priority: string, theme: any) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return { bg: theme.colors.error + '20', border: theme.colors.error, text: theme.colors.error };
    case 'high':
      return { bg: theme.colors.orange + '20', border: theme.colors.orange, text: theme.colors.orange };
    case 'medium':
      return { bg: theme.colors.info + '20', border: theme.colors.info, text: theme.colors.info };
    case 'low':
      return { bg: theme.colors.success + '20', border: theme.colors.success, text: theme.colors.success };
    default:
      return { bg: theme.colors.border, border: theme.colors.textSecondary, text: theme.colors.textSecondary };
  }
};

const HelpdeskHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { theme } = useTheme();

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: 1, limit: 50 };
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (search) params.search = search;
      
      const data = await apiService.getHelpdeskTickets(params);
      const ticketsList = data?.tickets || data || [];
      setTickets(Array.isArray(ticketsList) ? ticketsList : []);
    } catch (err: any) {
      console.warn('Error fetching helpdesk tickets:', err);
      setError(err.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, priority, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const handleViewDetails = (ticketId: string) => {
    navigation.navigate('HelpdeskTicketDetail' as never, { ticketId } as never);
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (status && ticket.status?.toLowerCase() !== status.toLowerCase()) return false;
    if (priority && ticket.priority?.toLowerCase() !== priority.toLowerCase()) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        ticket.title?.toLowerCase().includes(searchLower) ||
        ticket.ticketNumber?.toLowerCase().includes(searchLower) ||
        ticket.description?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Filter Bar */}
      <View style={[styles.filterBar, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search tickets..."
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
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
          <TouchableOpacity
            onPress={() => setStatus('')}
            style={[
              styles.filterChip,
              { backgroundColor: !status ? theme.colors.primary : theme.colors.surface },
              { borderColor: !status ? theme.colors.primary : theme.colors.border }
            ]}
          >
            <Text style={{ color: !status ? '#FFF' : theme.colors.text, fontSize: 12 }}>All Status</Text>
          </TouchableOpacity>
          {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatus(status === s ? '' : s)}
              style={[
                styles.filterChip,
                { backgroundColor: status === s ? theme.colors.primary : theme.colors.surface },
                { borderColor: status === s ? theme.colors.primary : theme.colors.border }
              ]}
            >
              <Text style={{ color: status === s ? '#FFF' : theme.colors.text, fontSize: 12 }}>
                {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
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
          <Title style={[styles.screenTitle, { color: theme.colors.text }]}>Helpdesk Requests</Title>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <HelperText type="error" visible style={{ textAlign: 'center', marginTop: 32 }}>{error}</HelperText>
        ) : filteredTickets.length === 0 ? (
          <Paragraph style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary, padding: 16 }}>
            No helpdesk tickets found.
          </Paragraph>
        ) : (
          filteredTickets.map((ticket, idx) => {
            const expanded = expandedId === (ticket._id || idx.toString());
            const statusColors = getStatusColor(ticket.status, theme);
            const priorityColors = getPriorityColor(ticket.priority, theme);
            
            return (
              <Card key={ticket._id || idx} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleExpand(ticket._id || idx.toString())}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={[styles.ticketNumber, { color: theme.colors.textSecondary }]}>
                        {ticket.ticketNumber || `#${idx + 1}`}
                      </Text>
                      <Text style={[styles.ticketTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {ticket.title || 'Untitled Ticket'}
                      </Text>
                    </View>
                    <View style={styles.badges}>
                      <View
                        style={[
                          styles.statusChip,
                          {
                            backgroundColor: statusColors.bg,
                            borderColor: statusColors.border,
                          }
                        ]}
                      >
                        <Text style={[styles.statusChipText, { color: statusColors.text }]}>
                          {ticket.status ? ticket.status.replace('_', ' ').toUpperCase() : 'OPEN'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusChip,
                          {
                            backgroundColor: priorityColors.bg,
                            borderColor: priorityColors.border,
                          }
                        ]}
                      >
                        <Text style={[styles.statusChipText, { color: priorityColors.text }]}>
                          {ticket.priority ? ticket.priority.toUpperCase() : 'MEDIUM'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.cardMeta}>
                    <View style={styles.metaItem}>
                      <Icon name="tag" size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                        {ticket.category?.name || 'Uncategorized'}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Icon name="calendar" size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                        {formatDate(ticket.createdAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                
                {expanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Description:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{ticket.description || '-'}</Text>
                    </View>
                    {ticket.assignedTo && (
                      <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Assigned To:</Text>
                        <Text style={[styles.expandedValue, { color: theme.colors.text }]}>
                          {typeof ticket.assignedTo === 'object' ? ticket.assignedTo.fullName : ticket.assignedTo}
                        </Text>
                      </View>
                    )}
                    {ticket.dueDate && (
                      <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Due Date:</Text>
                        <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{formatDate(ticket.dueDate)}</Text>
                      </View>
                    )}
                    {ticket.tags && ticket.tags.length > 0 && (
                      <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Tags:</Text>
                        <View style={styles.tagsContainer}>
                          {ticket.tags.map((tag: string, tagIdx: number) => (
                            <Chip key={tagIdx} style={styles.tagChip} textStyle={{ fontSize: 10 }}>
                              {tag}
                            </Chip>
                          ))}
                        </View>
                      </View>
                    )}
                    <Button
                      mode="contained"
                      onPress={() => handleViewDetails(ticket._id)}
                      style={{ marginTop: 12 }}
                      buttonColor={theme.colors.primary}
                    >
                      View Details
                    </Button>
                  </View>
                )}
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
  filterBar: {
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
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  ticketNumber: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardMeta: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  expandedSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 8,
    paddingTop: 16,
  },
  expandedRow: {
    marginBottom: 12,
  },
  expandedLabel: {
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 4,
  },
  expandedValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    height: 24,
  },
});

export default HelpdeskHistoryScreen;

