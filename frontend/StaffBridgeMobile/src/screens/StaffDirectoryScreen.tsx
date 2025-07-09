import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TextInput, TouchableOpacity, Linking, Image } from 'react-native';
import { Card, Title, ActivityIndicator, HelperText, Menu, Button } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0][0];
  return parts[0][0] + parts[parts.length - 1][0];
};

const StaffDirectoryScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [role, setRole] = useState('All');
  const [deptMenuVisible, setDeptMenuVisible] = useState(false);
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const { state } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiService.getStaffDirectory();
      console.log('Logged-in user:', state.user);
      console.log('Fetched users (raw):', data);
      console.log('Logged-in user organization:', (state.user as any)?.organization);
      if (data.length > 0) {
        console.log('First fetched user organization:', data[0].organization);
      }
      // Only show users from the same organization and with status 'active'
      const orgId = (state.user as any)?.organization?._id || (state.user as any)?.organization || (state.user as any)?.orgId || (state.user as any)?.id;
      const filtered = data.filter((u: any) => {
        const userOrg = u.organization?._id || u.organization || u.orgId || u.org || '';
        return String(userOrg) === String(orgId) && u.status === 'active';
      });
      setUsers(filtered);
      setFilteredUsers(filtered);
    } catch (err: any) {
      console.log('Error fetching users:', err);
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let result = users;
    if (department !== 'All') result = result.filter(u => u.department === department);
    if (role !== 'All') result = result.filter(u => u.role === role);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter(u =>
        (u.fullName && u.fullName.toLowerCase().includes(s)) ||
        (u.email && u.email.toLowerCase().includes(s))
      );
    }
    setFilteredUsers(result);
  }, [search, department, role, users]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const departments = ['All', ...Array.from(new Set(users.map(u => u.department).filter(Boolean)))];
  const roles = ['All', ...Array.from(new Set(users.map(u => u.role).filter(Boolean)))];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.headerRow}>
        <Title style={[styles.header, { color: theme.colors.text }]}>Staff Directory</Title>
      </View>
      <View style={styles.filterRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
          placeholder="Search by name or email"
          placeholderTextColor={theme.colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        <Menu
          visible={deptMenuVisible}
          onDismiss={() => setDeptMenuVisible(false)}
          anchor={<Button mode="outlined" onPress={() => setDeptMenuVisible(true)} style={styles.filterBtn}>{department}</Button>}
        >
          {departments.map((d, idx) => (
            <Menu.Item key={d + idx} onPress={() => { setDepartment(d); setDeptMenuVisible(false); }} title={d} />
          ))}
        </Menu>
        <Menu
          visible={roleMenuVisible}
          onDismiss={() => setRoleMenuVisible(false)}
          anchor={<Button mode="outlined" onPress={() => setRoleMenuVisible(true)} style={styles.filterBtn}>{role}</Button>}
        >
          {roles.map((r, idx) => (
            <Menu.Item key={r + idx} onPress={() => { setRole(r); setRoleMenuVisible(false); }} title={r} />
          ))}
        </Menu>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : filteredUsers.length === 0 ? (
        <HelperText type="info" visible style={{ textAlign: 'center', marginTop: 32 }}>No staff found.</HelperText>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredUsers.map((user, idx) => (
            <View key={user._id || idx} style={[styles.row, { backgroundColor: theme.colors.surface }]}> 
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#e0e0e0' }]}> 
                  <Text style={styles.avatarText}>{getInitials(user.fullName)}</Text>
                </View>
              )}
              <View style={styles.infoCol}>
                <Text style={[styles.name, { color: theme.colors.text }]}>{user.fullName}</Text>
                <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>{user.department} | {user.role}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${user.email}`)}>
                  <Text style={[styles.email, { color: theme.colors.primary }]}>{user.email}</Text>
                </TouchableOpacity>
                {user.phone && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${user.phone}`)}>
                    <Text style={[styles.meta, { color: theme.colors.primary, textDecorationLine: 'underline' }]}>Ext: {user.phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, marginHorizontal: 16 },
  header: { fontSize: 22, fontWeight: 'bold' },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8 },
  searchInput: { flex: 1, marginRight: 8, borderRadius: 8, paddingHorizontal: 12, height: 40, fontSize: 15 },
  filterBtn: { marginRight: 8, borderRadius: 8, height: 40, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 12, elevation: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarImg: { width: 44, height: 44, borderRadius: 22, marginRight: 14 },
  avatarText: { fontWeight: 'bold', fontSize: 18, color: '#555' },
  infoCol: { flex: 1 },
  name: { fontWeight: 'bold', fontSize: 16 },
  meta: { fontSize: 13, marginTop: 2 },
  email: { fontSize: 14, marginTop: 2, textDecorationLine: 'underline' },
});

export default StaffDirectoryScreen; 