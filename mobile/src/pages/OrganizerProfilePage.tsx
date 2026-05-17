import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { UserProfile } from '../types/api';

export default function OrganizerProfilePage({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await backendApi.getMe();
      setProfile(me);
      setDisplayName(me.displayName || '');
    } catch (error: any) {
      Alert.alert('내 정보 로드 실패', errorMessage(error, '내 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const save = async () => {
    setSaving(true);
    try {
      const updated = await backendApi.updateMe({ displayName: displayName.trim() || undefined });
      setProfile(updated);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>My Profile</Text>
      <Text style={styles.title}>내 정보 보기</Text>
      <Text style={styles.subtitle}>주최자 계정 정보와 세션 상태를 관리합니다.</Text>

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(profile?.displayName || profile?.email || 'O').slice(0, 1).toUpperCase()}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>이메일</Text>
        <Text style={styles.value}>{profile?.email || '-'}</Text>

        <Text style={styles.label}>권한</Text>
        <Text style={styles.value}>{profile?.roles?.join(', ') || '-'}</Text>

        <Text style={styles.label}>표시 이름</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="표시 이름" />

        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={save}>
          <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '정보 수정'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.navigate('OrganizerLogout')}>
        <Text style={styles.logoutButtonText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  avatar: { marginTop: 22, alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#2563EB', fontSize: 28, fontWeight: '900' },
  card: { marginTop: 18, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { marginTop: 10, color: '#64748B', fontSize: 12, fontWeight: '800' },
  value: { marginTop: 5, color: '#0F172A', fontSize: 15, fontWeight: '800' },
  input: { marginTop: 7, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  logoutButton: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  logoutButtonText: { color: '#DC2626', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
