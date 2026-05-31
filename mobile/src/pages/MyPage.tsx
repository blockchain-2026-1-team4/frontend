import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TextInput } from '../components/TextInput';
import { backendApi } from '../lib/backend';
import { clearAccessToken } from '../lib/auth';
import { errorMessage } from '../lib/account';
import { formatRoles } from '../lib/roles';
import type { UserProfile } from '../types/api';

function compactWalletAddress(address?: string | null) {
  const value = address?.trim();
  if (!value) return '-';
  if (value.length <= 16) return value;
  return `${value.slice(0, 6)}...${value.slice(-7)}`;
}

function profileInitial(name?: string | null) {
  const value = name?.trim();
  return value ? Array.from(value)[0] : 'T';
}

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

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

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

  const handleLogout = async () => {
    try {
      await clearAccessToken();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error: any) {
      Alert.alert('로그아웃 실패', errorMessage(error, '세션을 종료하지 못했습니다.'));
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProfile(); }} />}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profileInitial(profile?.displayName)}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>My account</Text>
          <Text style={styles.title}>내 정보</Text>
          <Text style={styles.subtitle}>계정 정보를 확인하고 닉네임을 관리합니다.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>닉네임</Text>
        {editing ? (
          <TextInput style={styles.input} value={displayNameDraft} onChangeText={setDisplayNameDraft} placeholder="닉네임" />
        ) : (
          <Text style={styles.displayName}>{profile?.displayName || '-'}</Text>
        )}

        <View style={styles.divider} />

        <Text style={styles.label}>지갑 주소</Text>
        <Text style={styles.value} numberOfLines={1}>{compactWalletAddress(profile?.walletAddress)}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>역할</Text>
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
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('ResaleList')}>
          <Text style={styles.menuButtonText}>리셀 티켓 보기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('MyDisputes')}>
          <Text style={styles.menuButtonText}>내 분쟁 신고</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Organizer')}>
          <Text style={styles.menuButtonText}>주최자 홈으로</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuButton, styles.logoutMenuButton]} onPress={handleLogout}>
          <Text style={[styles.menuButtonText, styles.logoutMenuText]}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#2563EB', fontSize: 24, fontWeight: '900' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 3, fontSize: 25, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 5, color: '#64748B', fontSize: 13, lineHeight: 19 },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  label: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  displayName: { marginTop: 6, color: '#0F172A', fontSize: 22, fontWeight: '900' },
  value: { marginTop: 6, color: '#0F172A', fontSize: 15, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
  helpText: { marginTop: 4, color: '#94A3B8', fontSize: 12, lineHeight: 17 },
  input: { marginTop: 7, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  primaryButton: { marginTop: 16, backgroundColor: '#2563EB', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editButton: { flex: 1, marginTop: 0 },
  menuButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  menuButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  logoutMenuButton: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  logoutMenuText: { color: '#DC2626' },
});
