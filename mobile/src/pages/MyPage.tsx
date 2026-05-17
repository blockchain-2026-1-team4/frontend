import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { backendApi } from '../lib/backend';
import { clearAccessToken } from '../lib/auth';
import type { UserProfile } from '../types/api';

export default function MyPage({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await backendApi.getMe();
      setProfile(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearAccessToken();
    navigation.replace('Landing');
  };

  const menuItems = [
    { id: 'tickets', label: '내 티켓 관리', icon: '🎟️', screen: 'MyTickets' },
    { id: 'resale', label: '내 리셀 판매 내역', icon: '🔄', screen: 'ResaleList' },
    { id: 'organizer', label: '주최자 신청 / 관리', icon: '🏢', screen: 'Organizer' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{profile?.displayName?.[0] || 'U'}</Text>
        </View>
        <Text style={styles.userName}>{profile?.displayName || '사용자'}</Text>
        <Text style={styles.userEmail}>{profile?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{profile?.roles?.join(', ')}</Text>
        </View>
      </View>

      {/* Menu List */}
      <View style={styles.menuSection}>
        {menuItems.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.arrow}>〉</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  profileHeader: { backgroundColor: '#fff', padding: 30, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#212529' },
  userEmail: { fontSize: 14, color: '#868E96', marginTop: 4 },
  roleBadge: { backgroundColor: '#E7F1FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  roleText: { color: '#007AFF', fontSize: 12, fontWeight: 'bold' },
  menuSection: { marginTop: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuIcon: { fontSize: 20, marginRight: 15 },
  menuLabel: { flex: 1, fontSize: 16, color: '#495057' },
  arrow: { color: '#ADB5BD', fontSize: 18 },
  logoutButton: { marginTop: 40, marginHorizontal: 20, padding: 15, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FA5252' },
  logoutText: { color: '#FA5252', fontWeight: 'bold' },
});
