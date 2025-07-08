import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Avatar, Title, Paragraph, Divider } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DrawerContent = (props: DrawerContentComponentProps) => {
  const { state, logout } = useAuth();
  const { theme } = useTheme();
  const user = state.user;

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}> 
        <Avatar.Text 
          size={56} 
          label={`${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`} 
          style={{ backgroundColor: theme.colors.surface }} 
        /> 
        <Title style={[styles.name, { color: theme.colors.surface }]}>{user?.firstName} {user?.lastName}</Title> 
        <Paragraph style={[styles.email, { color: theme.colors.surface }]}>{user?.email}</Paragraph> 
      </View>
      <Divider />
      <DrawerItemList {...props} />
      <DrawerItem
        label="Settings"
        onPress={() => props.navigation.navigate('Settings')}
        icon={({ color, size }: { color: string; size: number }) => <Avatar.Icon size={size} icon="cog" color={color} style={{ backgroundColor: 'transparent' }} />}
      />
      <DrawerItem
        label="Logout"
        onPress={logout}
        icon={({ color, size }: { color: string; size: number }) => <Avatar.Icon size={size} icon="logout" color={color} style={{ backgroundColor: 'transparent' }} />}
      />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  email: {
    fontSize: 14,
    marginTop: 4,
  },
});

export default DrawerContent; 