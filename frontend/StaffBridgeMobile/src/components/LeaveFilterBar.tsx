import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { TextInput, Card, IconButton } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';

interface LeaveFilterBarProps {
  activeStatus: string;
  onStatusChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterPress?: () => void;
}

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
];

const LeaveFilterBar: React.FC<LeaveFilterBarProps> = ({
  activeStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  onFilterPress,
}) => {
  const { theme } = useTheme();

  return (
    <Card style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            mode="outlined"
            placeholder="Search leave requests..."
            value={searchQuery}
            onChangeText={onSearchChange}
            style={[styles.searchInput, { backgroundColor: theme.colors.background }]}
            left={<TextInput.Icon icon="magnify" color={theme.colors.primary} />}
            right={
              onFilterPress ? (
                <TextInput.Icon 
                  icon="filter-variant" 
                  color={theme.colors.primary}
                  onPress={onFilterPress}
                />
              ) : undefined
            }
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />
        </View>

        {/* Status Filter Chips */}
        <View style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  {
                    backgroundColor: activeStatus === option.value 
                      ? theme.colors.primary 
                      : theme.colors.background,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => onStatusChange(option.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: activeStatus === option.value 
                        ? theme.colors.surface 
                        : theme.colors.text,
                      fontWeight: activeStatus === option.value ? '600' : '400',
                    }
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginTop: 8,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    padding: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    borderRadius: 12,
  },
  filterContainer: {
    marginBottom: 8,
  },
  chipContainer: {
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default LeaveFilterBar; 