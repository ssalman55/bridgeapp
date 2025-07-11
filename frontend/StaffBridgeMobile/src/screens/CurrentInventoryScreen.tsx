import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, TextInput, HelperText } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import apiService from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'assigned', value: 'assigned' },
  { label: 'in stock', value: 'In Stock' },
];

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const CurrentInventoryScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getMyInventory();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useFocusEffect(
    React.useCallback(() => {
      // If navigated with refresh param, reload and clear param
      if ((route as any).params?.refresh) {
        fetchInventory();
        // Clear the param so it doesn't keep refreshing
        (navigation as any).setParams({ refresh: undefined });
      }
    }, [route, fetchInventory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const filteredItems = items.filter((item) => {
    const matchesName = item.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status ? (item.status?.toLowerCase() === status.toLowerCase()) : true;
    return matchesName && matchesStatus;
  });

  const handleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.colors.text }]}>My Inventory Items</Title>
            <TextInput
              mode="outlined"
              placeholder="Search by name or description"
              value={search}
              onChangeText={setSearch}
              style={styles.input}
              left={<TextInput.Icon icon="magnify" />}
            />
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Status:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {STATUS_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    selected={status === opt.value}
                    onPress={() => setStatus(opt.value)}
                    style={styles.chip}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          </Card.Content>
        </Card>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 3 }]}>Name</Text>
          <Text style={[styles.headerCell, { flex: 1 }]}>Status</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <HelperText type="error" visible style={{ textAlign: 'center', marginTop: 32 }}>{error}</HelperText>
        ) : filteredItems.length === 0 ? (
          <Paragraph style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary }}>
            No inventory items found.
          </Paragraph>
        ) : (
          filteredItems.map((item, idx) => {
            const expanded = expandedId === (item._id || idx.toString());
            return (
              <View key={item._id || idx}>
                <TouchableOpacity
                  style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}
                  activeOpacity={0.7}
                  onPress={() => handleExpand(item._id || idx.toString())}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand details for ${item.name}`}
                >
                  <Text style={[styles.cell, { flex: 3 }]} numberOfLines={2}>{item.name || '-'}</Text>
                  <View style={[styles.cell, { flex: 1 }]}> 
                    <Chip
                      style={{ backgroundColor: item.status === 'assigned' ? '#FFF9C4' : '#E0E0E0', minWidth: 70, justifyContent: 'center' }}
                      textStyle={{ color: '#8D6E63', fontWeight: 'bold', textAlign: 'center' }}
                    >
                      {typeof item.status === 'string' ? item.status : '-'}
                    </Chip>
                  </View>
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Description:</Text>
                      <Text style={styles.expandedValue}>{item.description || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={styles.expandedLabel}>Assigned Date:</Text>
                      <Text style={styles.expandedValue}>{formatDate(item.assignedDate)}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    marginRight: 8,
    fontWeight: 'bold',
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  headerCell: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  cell: {
    fontSize: 15,
    color: '#222',
    marginRight: 4,
  },
  expandedSection: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderTopWidth: 0,
    marginBottom: 8,
  },
  expandedRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  expandedLabel: {
    fontWeight: 'bold',
    color: '#666',
    width: 120,
  },
  expandedValue: {
    color: '#222',
    flex: 1,
    flexWrap: 'wrap',
  },
});

export default CurrentInventoryScreen; 