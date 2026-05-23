import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { backendApi } from '../lib/backend';
import { clearAccessToken } from '../lib/auth';
import { errorMessage } from '../lib/account';
import type { UserProfile } from '../types/api';

export default function MyPage({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const me = await backendApi.getMe();
      setProfile(me);
      setDisplayNameDraft(me.displayName || '');
    } catch (error: any) {
      Alert.alert('내 정보 로드 실패', errorMessage(error, '내 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const save = async () => {
    setSaving(true);
    try {
      const updated = await backendApi.updateMe({ displayName: displayNameDraft.trim() || undefined });
      setProfile(updated);
      setDisplayNameDraft(updated.displayName || '');
      setEditing(false);
      Alert.alert('저장 완료', '내 정보가 수정되었습니다.');
    } catch (error: any) {
      Alert.alert('저장 실패', errorMessage(error, '내 정보를 수정하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setDisplayNameDraft(profile?.displayName || '');
    setEditing(false);
  };

  const handleLogout = async () => {
    await clearAccessToken();
    navigation.replace('Landing');
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  const quickLinks = [
    { id: 'home', label: '이벤트 메인 이동', screen: 'Main' },
    { id: 'resale', label: '내 리셀 티켓', screen: 'ResaleList', params: { scope: 'mine' } },
    { id: 'tickets', label: '내 티켓 목록', screen: 'MyTickets' },
    { id: 'disputes', label: '내 분쟁 신고', screen: 'MyDisputes' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProfile(); }} />}
    >
      <Text style={styles.eyebrow}>My Account</Text>
      <Text style={styles.title}>내 정보</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>계정 정보</Text>
        <Text style={styles.label}>이메일 또는 지갑</Text>
        <Text style={styles.value}>{profile?.email || profile?.walletAddress || '-'}</Text>

        <Text style={styles.label}>권한</Text>
        <Text style={styles.value}>{profile?.roles?.join(', ') || 'USER'}</Text>

        <Text style={styles.label}>표시 이름</Text>
        {editing ? (
          <TextInput style={styles.input} value={displayNameDraft} onChangeText={setDisplayNameDraft} placeholder="표시 이름" />
        ) : (
          <Text style={styles.value}>{profile?.displayName || '-'}</Text>
        )}

        {!editing ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => setEditing(true)}>
            <Text style={styles.primaryButtonText}>정보 수정</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editRow}>
            <TouchableOpacity style={[styles.primaryButton, styles.editButton]} onPress={save} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.editButton]} onPress={cancelEdit} disabled={saving}>
              <Text style={styles.secondaryButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>내 활동</Text>
        {quickLinks.map((item) => (
          <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => navigation.navigate(item.screen, item.params)}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Organizer')}>
        <Text style={styles.secondaryButtonText}>주최자 센터로 이동</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  label: { marginTop: 10, color: '#64748B', fontSize: 12, fontWeight: '800' },
  value: { marginTop: 5, color: '#0F172A', fontSize: 15, fontWeight: '800' },
  input: { marginTop: 7, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  primaryButton: { marginTop: 12, backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editButton: { flex: 1, marginTop: 0 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  menuLabel: { flex: 1, fontSize: 15, color: '#0F172A', fontWeight: '800' },
  arrow: { color: '#94A3B8', fontSize: 22 },
  logoutButton: { marginTop: 20, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#FEF2F2' },
  logoutText: { color: '#DC2626', fontWeight: '900', fontSize: 15 },
});
