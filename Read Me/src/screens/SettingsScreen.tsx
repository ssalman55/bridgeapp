import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, List, Switch, Divider } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';

const SettingsScreen: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
        <Card.Content> 
          <Title style={[styles.title, { color: theme.colors.text }]}>Settings</Title> 
          <List.Section>
            <List.Subheader>Appearance</List.Subheader>
            <List.Item
              title="Dark Mode"
              right={() => (
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
                />
              )}
            />
            <Divider />
            <List.Subheader>Notifications</List.Subheader>
            <List.Item
              title="Enable Push Notifications"
              right={() => <Switch value={true} disabled />}
            />
          </List.Section>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});

export default SettingsScreen; 