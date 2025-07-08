import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';

const NotFoundScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <Text style={[styles.title, { color: theme.colors.error }]}>404</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Page Not Found</Text>
      <Button mode="contained" onPress={() => navigation?.goBack?.()} style={styles.button}>Go Back</Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 24,
  },
  button: {
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
});

export default NotFoundScreen; 