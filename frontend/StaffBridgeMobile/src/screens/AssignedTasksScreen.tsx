import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Chip, ActivityIndicator, Button, HelperText } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const PRIORITY_COLORS: Record<string, string> = {
  High: '#FF5252',
  Medium: '#FFD600',
  Low: '#00C853',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: '#42A5F5',
  'In Progress': '#FFD600',
  Completed: '#00C853',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  Pending: '#fff',
  'In Progress': '#795548',
  Completed: '#fff',
};

const PRIORITY_TEXT_COLORS: Record<string, string> = {
  High: '#fff',
  Medium: '#222',
  Low: '#fff',
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const AssignedTasksScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const navigation = useNavigation();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getMyTasks();
      // Sort tasks by creation date (most recent first)
      const sortedTasks = Array.isArray(data) ? data.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime(); // Most recent first
      }) : [];
      setTasks(sortedTasks);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);
  useFocusEffect(
    React.useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Title style={[styles.header, { color: theme.colors.text }]}>My Tasks</Title>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <HelperText type="error" visible style={{ textAlign: 'center', marginTop: 32 }}>{error}</HelperText>
        ) : tasks.length === 0 ? (
          <Paragraph style={{ textAlign: 'center', marginTop: 32, color: theme.colors.textSecondary }}>
            No tasks assigned to you.
          </Paragraph>
        ) : (
          <View style={styles.cardGrid}>
            {tasks.map((task, idx) => (
              <Card key={task._id || idx} style={styles.taskCard} elevation={2}>
                <Card.Content>
                  <View style={styles.cardHeaderRow}>
                    <Title style={styles.cardTitle}>{task.title || '-'}</Title>
                    {task.priority && (
                      <Chip
                        style={{ backgroundColor: PRIORITY_COLORS[task.priority] || '#E0E0E0', marginLeft: 8 }}
                        textStyle={{ color: PRIORITY_TEXT_COLORS[task.priority] || '#222', fontWeight: 'bold' }}
                        compact
                      >
                        {task.priority}
                      </Chip>
                    )}
                  </View>
                  <Text style={styles.dueDate}>Due: {formatDate(task.endDate)}</Text>
                  <Paragraph style={styles.description}>{task.description || '-'}</Paragraph>
                  <View style={styles.statusRow}>
                    {task.status && (
                      <Chip
                        style={{ backgroundColor: STATUS_COLORS[task.status] || '#E0E0E0', marginRight: 8 }}
                        textStyle={{ color: STATUS_TEXT_COLORS[task.status] || '#222', fontWeight: 'bold' }}
                        compact
                      >
                        {task.status}
                      </Chip>
                    )}
                    {task.attachment && (
                      <Chip style={styles.attachmentChip} icon="paperclip" compact>
                        Attachment
                      </Chip>
                    )}
                  </View>
                  <Button
                    mode="contained"
                    style={styles.viewBtn}
                    onPress={() => (navigation as any).navigate('TaskDetail', { task })}
                  >
                    View / Update
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 32 },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, marginLeft: 4 },
  cardGrid: { flexDirection: 'column', flexWrap: 'nowrap', justifyContent: 'flex-start' },
  taskCard: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    minHeight: 180,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  dueDate: { fontSize: 13, color: '#888', marginBottom: 4 },
  description: { fontSize: 14, color: '#333', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  attachmentChip: { backgroundColor: '#E3F2FD', color: '#1976D2', marginRight: 8 },
  viewBtn: { alignSelf: 'flex-end', borderRadius: 8, marginTop: 4 },
});

export default AssignedTasksScreen; 