import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Avatar, Button } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const ProfileScreen: React.FC = () => {
  const { state } = useAuth();
  const { theme } = useTheme();
  const user = state.user;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
        <Card.Content style={styles.content}> 
          <Avatar.Text 
            size={80} 
            label={`${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`} 
            style={{ backgroundColor: theme.colors.primary, marginBottom: 16 }} 
          /> 
          <Title style={[styles.name, { color: theme.colors.text }]}>{user?.firstName} {user?.lastName}</Title> 
          <Paragraph style={[styles.email, { color: theme.colors.textSecondary }]}>{user?.email}</Paragraph> 
          <Paragraph style={[styles.info, { color: theme.colors.textSecondary }]}>Employee ID: {user?.employeeId}</Paragraph> 
          <Paragraph style={[styles.info, { color: theme.colors.textSecondary }]}>Department: {user?.department}</Paragraph> 
          <Paragraph style={[styles.info, { color: theme.colors.textSecondary }]}>Position: {user?.position}</Paragraph> 
          <Button mode="contained" style={styles.editButton}>Edit Profile</Button> 
        </Card.Content> 
      </Card> 
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    margin: 16,
    marginTop: 32,
    elevation: 2,
  },
  content: {
    alignItems: 'center',
    padding: 24,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
    marginBottom: 4,
  },
  editButton: {
    marginTop: 16,
    borderRadius: 8,
    width: 160,
  },
});

export default ProfileScreen; 