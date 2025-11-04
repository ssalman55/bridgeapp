import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TextInput, TouchableOpacity, Linking, Image } from 'react-native';
import { Card, Title, ActivityIndicator, HelperText, Menu, Button } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
// @ts-ignore
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const getInitials = (user: any) => {
  // Check if user has a valid profile image URL (not an S3 key)
  const hasProfileImage = user?.profileImage || user?.profilePicture;
  if (hasProfileImage && typeof hasProfileImage === 'string' && 
      (hasProfileImage.startsWith('http://') || hasProfileImage.startsWith('https://'))) {
    return null; // Will show image instead
  }
  
  // Get initials from fullName, firstName/lastName, or email
  const fullName = user?.fullName || '';
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const email = user?.email || '';
  
  if (fullName) {
    const parts = fullName.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  
  if (firstName || lastName) {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  }
  
  if (email) {
    return email[0].toUpperCase();
  }
  
  return 'U';
};

interface StaffMember {
  _id?: string;
  id?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  department?: string;
  role?: string;
  phone?: string;
  phoneNumber?: string;
  profileImage?: string;
  profilePicture?: string;
  status?: string; // Attendance status: 'Present', 'Checked Out', 'Not Checked In'
  checkInTime?: string | Date;
  checkOutTime?: string | Date;
  organization?: any;
}

const StaffDirectoryScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<StaffMember[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [role, setRole] = useState('All');
  const [deptMenuVisible, setDeptMenuVisible] = useState(false);
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const [profileImageUrls, setProfileImageUrls] = useState<Record<string, string | null>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const { state } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch signed URLs for S3 keys and handle profile images
  useEffect(() => {
    const fetchProfileImageUrls = async () => {
      const urlMap: Record<string, string | null> = {};
      
      for (const user of users) {
        const userId = user.id || user._id || '';
        const profilePic = user.profileImage || user.profilePicture;
        
        if (!profilePic) {
          urlMap[userId] = null;
          continue;
        }

        // If it's already a full URL (signed URL), use it directly
        if (typeof profilePic === 'string' && 
            (profilePic.startsWith('http://') || profilePic.startsWith('https://'))) {
          urlMap[userId] = profilePic;
          continue;
        }

        // If it's an S3 key, fetch signed URL
        if (typeof profilePic === 'string' && profilePic.startsWith('profile-images/')) {
          try {
            const signedUrl = await apiService.getProfileImageSignedUrl(profilePic);
            urlMap[userId] = signedUrl;
          } catch (error) {
            console.warn(`[StaffDirectory] Failed to fetch signed URL for ${user.fullName}:`, error);
            urlMap[userId] = null;
          }
          continue;
        }

        urlMap[userId] = null;
      }
      
      setProfileImageUrls(urlMap);
    };

    if (users.length > 0) {
      fetchProfileImageUrls();
    }
  }, [users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Try to get staff with attendance status first
      let data: StaffMember[];
      let usingAttendanceEndpoint = false;
      
      try {
        const responseData = await apiService.getAllStaffAttendanceStatus();
        console.log('[StaffDirectory] Raw response data type:', typeof responseData);
        console.log('[StaffDirectory] Raw response data:', responseData);
        
        // Ensure we have an array
        if (!Array.isArray(responseData)) {
          console.warn('[StaffDirectory] Response is not an array:', responseData);
          throw new Error('Invalid response format');
        }
        
        data = responseData;
        usingAttendanceEndpoint = true;
        
        // Normalize the data - convert ObjectId to string if needed
        const normalizedUsers = data.map((u: any) => {
          // Convert id/_id to string if it's an ObjectId
          const userId = u.id ? String(u.id) : (u._id ? String(u._id) : null);
          
          return {
            ...u,
            id: userId,
            _id: userId, // Also set _id for compatibility
            // Ensure checkInTime/checkOutTime are Date objects or strings
            checkInTime: u.checkInTime ? (typeof u.checkInTime === 'string' ? u.checkInTime : new Date(u.checkInTime).toISOString()) : undefined,
            checkOutTime: u.checkOutTime ? (typeof u.checkOutTime === 'string' ? u.checkOutTime : new Date(u.checkOutTime).toISOString()) : undefined,
          };
        });
        
        // Filter to ensure we have valid user data
        const validUsers = normalizedUsers.filter((u: any) => {
          const hasValidData = u && (u.fullName || u.email);
          if (!hasValidData) {
            console.warn('[StaffDirectory] Filtered out invalid user:', u);
          }
          return hasValidData;
        });
        
        console.log('[StaffDirectory] Total fetched:', data.length);
        console.log('[StaffDirectory] Valid users after validation:', validUsers.length);
        if (validUsers.length > 0) {
          console.log('[StaffDirectory] Sample user (first):', JSON.stringify(validUsers[0], null, 2));
        } else {
          console.warn('[StaffDirectory] No valid users found!');
        }
        
        setUsers(validUsers);
        setFilteredUsers(validUsers);
        setImageErrors({});
        return;
      } catch (attendanceError) {
        // Fallback to regular staff directory
        console.warn('[StaffDirectory] Could not fetch attendance status, using regular directory:', attendanceError);
        data = await apiService.getStaffDirectory();
        usingAttendanceEndpoint = false;
      }

      // Only filter by organization if using regular staff directory
      // (attendance endpoint already filters by organization)
      if (!usingAttendanceEndpoint) {
        const orgId = (state.user as any)?.organization?._id || (state.user as any)?.organization || (state.user as any)?.orgId || (state.user as any)?.id;
        console.log('[StaffDirectory] Filtering by organization:', orgId);
        console.log('[StaffDirectory] Raw data before filter:', data.length, data);
        
        const filtered = data.filter((u: any) => {
          const userOrg = u.organization?._id || u.organization || u.orgId || u.org || '';
          const matchesOrg = String(userOrg) === String(orgId);
          const isActive = u.status === 'active' || !u.status || u.status !== 'archived';
          const hasValidData = u && (u.fullName || u.email);
          
          console.log('[StaffDirectory] User filter check:', {
            fullName: u.fullName,
            userOrg,
            matchesOrg,
            status: u.status,
            isActive,
            hasValidData,
            result: matchesOrg && isActive && hasValidData
          });
          
          return matchesOrg && isActive && hasValidData;
        });
        
        console.log('[StaffDirectory] After organization filter:', filtered.length);
        setUsers(filtered);
        setFilteredUsers(filtered);
      } else {
        setUsers(data);
        setFilteredUsers(data);
      }
      
      setImageErrors({}); // Reset image errors on refresh
    } catch (err: any) {
      console.error('[StaffDirectory] Error fetching users:', err);
      console.error('[StaffDirectory] Error details:', err.response?.data || err.message);
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleImageError = (userId: string) => {
    setImageErrors(prev => ({ ...prev, [userId]: true }));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Present':
        return '#4CAF50'; // Green
      case 'Checked Out':
        return '#FF9800'; // Orange
      case 'Not Checked In':
        return '#9E9E9E'; // Grey
      default:
        return '#9E9E9E';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'Present':
        return 'checkbox-marked-circle';
      case 'Checked Out':
        return 'logout';
      case 'Not Checked In':
        return 'checkbox-blank-circle-outline';
      default:
        return 'help-circle-outline';
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
          {filteredUsers.map((user, idx) => {
            // Use 'id' first since attendance endpoint returns 'id' not '_id'
            const userId = String(user.id || user._id || idx);
            const profileImageUrl = profileImageUrls[userId];
            const hasImageError = imageErrors[userId];
            const shouldShowImage = profileImageUrl && !hasImageError;
            const userInitials = getInitials(user);

            return (
              <View key={userId} style={[styles.row, { backgroundColor: theme.colors.surface }]}> 
                <View style={styles.avatarContainer}>
                  {shouldShowImage ? (
                    <Image 
                      source={{ uri: profileImageUrl! }} 
                      style={styles.avatarImg}
                      onError={() => handleImageError(userId)}
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}> 
                      <Text style={styles.avatarText}>{userInitials}</Text>
                    </View>
                  )}
                  {/* Status indicator dot */}
                  {user.status && (
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(user.status) }]} />
                  )}
                </View>
                <View style={styles.infoCol}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: theme.colors.text }]}>{user.fullName}</Text>
                    {user.status && (
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(user.status) + '20' }]}>
                        <Icon 
                          name={getStatusIcon(user.status)} 
                          size={12} 
                          color={getStatusColor(user.status)} 
                          style={styles.statusIcon}
                        />
                        <Text style={[styles.statusText, { color: getStatusColor(user.status) }]}>
                          {user.status}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
                    {user.department || 'N/A'} | {user.role || 'N/A'}
                  </Text>
                  {user.checkInTime && (
                    <Text style={[styles.meta, { color: theme.colors.textSecondary, fontSize: 12 }]}>
                      Check-in: {new Date(user.checkInTime).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => Linking.openURL(`mailto:${user.email}`)}>
                    <Text style={[styles.email, { color: theme.colors.primary }]}>{user.email}</Text>
                  </TouchableOpacity>
                  {(user.phone || user.phoneNumber) && (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${user.phone || user.phoneNumber}`)}>
                      <Text style={[styles.meta, { color: theme.colors.primary, textDecorationLine: 'underline' }]}>Ext: {user.phone || user.phoneNumber}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
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
  avatarContainer: { position: 'relative', marginRight: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontWeight: 'bold', fontSize: 18, color: '#FFFFFF' },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  infoCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  name: { fontWeight: 'bold', fontSize: 16, flex: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusIcon: { marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 2 },
  email: { fontSize: 14, marginTop: 2, textDecorationLine: 'underline' },
});

export default StaffDirectoryScreen; 