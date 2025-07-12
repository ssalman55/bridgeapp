import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Chip, HelperText } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import apiService from '../services/api';
import InventoryFilterBar from '../components/InventoryFilterBar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}



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

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
  };

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
        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Title style={[styles.screenTitle, { color: theme.colors.text }]}>My Inventory Items</Title>
        </View>

        <InventoryFilterBar
          activeStatus={status}
          onStatusChange={setStatus}
          searchQuery={search}
          onSearchChange={setSearch}
          onFilterPress={handleFilterPress}
        />
        <View style={[styles.tableHeader, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.headerCell, { flex: 3, color: theme.colors.text }]}>Name</Text>
          <Text style={[styles.headerCell, { flex: 1, color: theme.colors.text }]}>Status</Text>
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
                  style={[
                    styles.tableRow, 
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                    idx % 2 === 0 && { backgroundColor: theme.colors.background }
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleExpand(item._id || idx.toString())}
                  accessibilityRole="button"
                  accessibilityLabel={`Expand details for ${item.name}`}
                >
                  <Text style={[styles.cell, { flex: 3, color: theme.colors.text }]} numberOfLines={2}>{item.name || '-'}</Text>
                  <View style={[styles.cell, { flex: 1 }]}> 
                    <Chip
                      style={{ 
                        backgroundColor: item.status === 'assigned' ? theme.colors.warning + '20' : theme.colors.disabled + '20',
                        minWidth: 70, 
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: item.status === 'assigned' ? theme.colors.warning : theme.colors.disabled,
                      }}
                      textStyle={{ 
                        color: item.status === 'assigned' ? theme.colors.warning : theme.colors.disabled, 
                        fontWeight: '600', 
                        textAlign: 'center' 
                      }}
                    >
                      {typeof item.status === 'string' ? item.status : '-'}
                    </Chip>
                  </View>
                </TouchableOpacity>
                {expanded && (
                  <View style={[styles.expandedSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Description:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{item.description || '-'}</Text>
                    </View>
                    <View style={styles.expandedRow}>
                      <Text style={[styles.expandedLabel, { color: theme.colors.textSecondary }]}>Assigned Date:</Text>
                      <Text style={[styles.expandedValue, { color: theme.colors.text }]}>{formatDate(item.assignedDate)}</Text>
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
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  headerCell: {
    fontWeight: '600',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  cell: {
    fontSize: 15,
    marginRight: 8,
  },
  expandedSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  expandedRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  expandedLabel: {
    fontWeight: '600',
    width: 120,
  },
  expandedValue: {
    flex: 1,
    flexWrap: 'wrap',
  },
});

export default CurrentInventoryScreen; 