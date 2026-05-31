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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { clearAccessToken } from '../lib/auth';
import { formatRoles } from '../lib/roles';
import type { UserProfile } from '../types/api';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

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

export default function OrganizerProfilePage({ navigation }: any) {
  const insets = useSafeAreaInsets();
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

  const handleLogout = async () => {
    try {
      await clearAccessToken();
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
    } catch (error: any) {
      Alert.alert('로그아웃 실패', errorMessage(error, '세션을 종료하지 못했습니다.'));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
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
      <HeroGradient
        colors={['#1A1A2E', '#2D2B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}
      >
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={() => navigation.goBack()}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <View style={styles.heroProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profileInitial(profile?.displayName)}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>MY ACCOUNT</Text>
            <Text style={styles.heroTitle}>{profile?.displayName || '닉네임 없음'}</Text>
            <Text style={styles.heroSub}>{formatRoles(profile?.roles)}</Text>
          </View>
        </View>
      </HeroGradient>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>닉네임</Text>
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
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.menuButtonText}>사용자 홈으로</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuButton, styles.logoutMenuButton]} onPress={handleLogout}>
          <Text style={[styles.menuButtonText, styles.logoutMenuText]}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroProfile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 3 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 11, marginTop: 3 },
  card: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  label: { color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  displayName: { marginTop: 5, color: '#1A1A2E', fontSize: 20, fontWeight: '800' },
  value: { marginTop: 5, color: '#1A1A2E', fontSize: 14, fontWeight: '700' },
  divider: { height: 0.5, backgroundColor: '#E5E7EB', marginVertical: 12 },
  input: { marginTop: 7, borderWidth: 0.5, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, backgroundColor: '#FFFFFF', color: '#1A1A2E' },
  primaryButton: { backgroundColor: '#1A1A2E', borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { borderWidth: 0.5, borderColor: '#CBD5E1', borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#1A1A2E', fontSize: 14, fontWeight: '700' },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  editButton: { flex: 1, marginTop: 0 },
  menuButton: { marginTop: 10, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  menuButtonText: { color: '#1A1A2E', fontSize: 14, fontWeight: '700' },
  logoutMenuButton: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  logoutMenuText: { color: '#DC2626' },
});
