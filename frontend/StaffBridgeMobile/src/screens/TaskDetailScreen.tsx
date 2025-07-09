import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { Card, Title, Paragraph, Chip, Button, TextInput, HelperText, Menu } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiService from '../services/api';

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'Pending' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Completed', value: 'Completed' },
];

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

const TaskDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const task = route.params?.task;

  const [status, setStatus] = useState(task?.status || 'Pending');
  const [note, setNote] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiService.updateTaskStatus(task._id, { status, note });
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) {
    return <HelperText type="error" visible>No task data found.</HelperText>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={styles.scrollContent}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Task Details</Title>
          <View style={styles.detailRow}><Text style={styles.label}>Title:</Text><Text style={styles.value}>{task.title || '-'}</Text></View>
          <View style={styles.detailRow}><Text style={styles.label}>Description:</Text><Text style={styles.value}>{task.description || '-'}</Text></View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Priority:</Text>
            <Chip style={{ backgroundColor: PRIORITY_COLORS[task.priority] || '#E0E0E0', marginLeft: 4 }} textStyle={{ color: PRIORITY_TEXT_COLORS[task.priority] || '#222', fontWeight: 'bold' }} compact>{task.priority}</Chip>
          </View>
          <View style={styles.detailRow}><Text style={styles.label}>Due:</Text><Text style={styles.value}>{formatDate(task.endDate)}</Text></View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Status:</Text>
            <Chip style={{ backgroundColor: STATUS_COLORS[task.status] || '#E0E0E0', marginLeft: 4 }} textStyle={{ color: STATUS_TEXT_COLORS[task.status] || '#222', fontWeight: 'bold' }} compact>{task.status}</Chip>
          </View>
          {/* Attachment functionality not implemented yet */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>Status Notes:</Text>
            <View style={[styles.value, styles.notesContainer]}>
              {Array.isArray(task.statusNotes) && task.statusNotes.length > 0 ? (
                task.statusNotes.slice().reverse().map((noteObj: any, idx: number) => (
                  <Text key={idx} style={styles.noteLine}>
                    {noteObj.note}
                    {noteObj.date ? ` (${formatDate(noteObj.date)})` : ''}
                  </Text>
                ))
              ) : (
                <Text>-</Text>
              )}
            </View>
          </View>
          <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Update Status</Text></View>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={<Button mode="outlined" onPress={() => setMenuVisible(true)} style={styles.dropdownBtn}>{status}</Button>}
          >
            {STATUS_OPTIONS.map(opt => (
              <Menu.Item key={opt.value} onPress={() => { setStatus(opt.value); setMenuVisible(false); }} title={opt.label} />
            ))}
          </Menu>
          <TextInput
            label="Add a note (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            style={styles.noteInput}
            mode="outlined"
          />
          {error && <HelperText type="error" visible>{error}</HelperText>}
          <Button mode="contained" onPress={handleUpdate} loading={submitting} disabled={submitting} style={styles.updateBtn}>
            Update Status
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: { borderRadius: 12, backgroundColor: '#fff', elevation: 2 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  detailRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
  label: { fontWeight: 'bold', color: '#666', width: 110 },
  value: { color: '#222', flex: 1, flexWrap: 'wrap', alignItems: 'flex-start', maxWidth: '100%' },
  sectionHeader: { marginTop: 18, marginBottom: 6 },
  sectionHeaderText: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  dropdownBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  noteInput: { marginBottom: 12 },
  updateBtn: { borderRadius: 8, marginTop: 8 },
  noteLine: { color: '#444', fontSize: 13, marginBottom: 2, flexShrink: 1, flexWrap: 'wrap', width: '100%' },
  notesContainer: { flexDirection: 'column', flexWrap: 'wrap', width: '100%' },
});

export default TaskDetailScreen; 