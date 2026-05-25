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
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatRoles } from '../lib/roles';
import type { UserProfile } from '../types/api';

export default function OrganizerProfilePage({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
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

  useFocusEffect(useCallback(() => { void load(); }, [load]));

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>내 정보를 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>My Account</Text>
      <Text style={styles.title}>내 정보</Text>
      <Text style={styles.subtitle}>내 정보와 역할을 확인합니다.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>닉네임</Text>
        {editing ? (
          <TextInput style={styles.input} value={displayNameDraft} onChangeText={setDisplayNameDraft} placeholder="닉네임" />
        ) : (
          <Text style={styles.displayName}>{profile?.displayName || '-'}</Text>
        )}

        <Text style={styles.label}>이메일/지갑</Text>
        <Text style={styles.value}>{profile?.email || profile?.walletAddress || '-'}</Text>

        <Text style={styles.label}>내 역할</Text>
        <Text style={styles.value}>{formatRoles(profile?.roles)}</Text>

        {!editing ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => setEditing(true)}>
            <Text style={styles.primaryButtonText}>닉네임 수정</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editRow}>
            <TouchableOpacity style={[styles.primaryButton, styles.editButton]} onPress={save} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.editButton]} onPress={() => { setDisplayNameDraft(profile?.displayName || ''); setEditing(false); }} disabled={saving}>
              <Text style={styles.secondaryButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>계정 메뉴</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.secondaryButtonText}>사용자 홈</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.navigate('OrganizerLogout')}>
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  label: { marginTop: 10, color: '#64748B', fontSize: 12, fontWeight: '800' },
  displayName: { marginTop: 5, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  value: { marginTop: 5, color: '#0F172A', fontSize: 15, fontWeight: '800' },
  input: { marginTop: 7, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  editButton: { flex: 1, marginTop: 0 },
  logoutButton: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  logoutButtonText: { color: '#DC2626', fontSize: 16, fontWeight: '900' },
});
