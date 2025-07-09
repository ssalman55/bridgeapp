import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text } from 'react-native';
import { Card, Title, ActivityIndicator, HelperText } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import { decode } from 'html-entities';

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
};

const stripHtml = (html: string) => {
  if (!html) return '';
  // Decode HTML entities first, then remove all HTML tags
  const decoded = decode(html);
  const text = decoded.replace(/<[^>]*>/gi, '');
  return text.trim();
};

const BulletinsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulletins, setBulletins] = useState<any[]>([]);
  const { state } = useAuth();
  const { theme } = useTheme();

  const fetchBulletins = async () => {
    setLoading(true);
    try {
      const data = await apiService.getBulletins();
      // Only show bulletins from the same organization
      const orgId = (state.user as any)?.organization?._id || (state.user as any)?.organization || (state.user as any)?.orgId;
      const filtered = data.filter((b: any) => {
        const bulletinOrg = b.organization?._id || b.organization || b.orgId;
        return String(bulletinOrg) === String(orgId);
      });
      // Debug: log raw and stripped body for first bulletin
      if (filtered.length > 0) {
        console.log('Raw body:', filtered[0].body, 'Stripped:', stripHtml(filtered[0].body));
      }
      setBulletins(filtered);
    } catch (err) {
      setBulletins([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBulletins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBulletins();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.headerRow}>
        <Title style={[styles.header, { color: theme.colors.text }]}>Bulletin Board</Title>
        <Text style={[styles.subheader, { color: theme.colors.textSecondary }]}>Stay up to date with the latest announcements and updates across the organization.</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : bulletins.length === 0 ? (
        <HelperText type="info" visible style={{ textAlign: 'center', marginTop: 32 }}>No bulletins found.</HelperText>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
        >
          {bulletins.map((b, idx) => (
            <View key={b._id || idx} style={styles.cardWrap}>
              <Card style={styles.bulletinCard}>
                <Card.Content>
                  <View style={styles.titleRow}>
                    <Text style={styles.icon}>📰</Text>
                    <Text style={[styles.title, { color: theme.colors.primary }]}>{b.title}</Text>
                  </View>
                  <Text style={styles.date}>{formatDate(b.createdAt)}</Text>
                  <Text style={styles.body}>{stripHtml(b.body)}</Text>
                </Card.Content>
              </Card>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { marginTop: 16, marginBottom: 8, marginHorizontal: 16 },
  header: { fontSize: 22, fontWeight: 'bold' },
  subheader: { fontSize: 15, marginTop: 2, marginBottom: 8 },
  list: { paddingHorizontal: 8, paddingBottom: 16 },
  cardWrap: { width: '100%', marginBottom: 16 },
  bulletinCard: { borderRadius: 16, elevation: 2, padding: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  icon: { fontSize: 22, marginRight: 8 },
  title: { fontWeight: 'bold', fontSize: 16, flex: 1 },
  date: { fontSize: 12, color: '#888', marginBottom: 6 },
  body: { fontSize: 14, color: '#333' },
});

export default BulletinsScreen; 