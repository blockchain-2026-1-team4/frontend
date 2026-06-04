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
import { FlowHero, IconButton, TicketIcon, flowShadow } from '../components/TicketFlowKit';
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

function MenuButton({
  label,
  icon,
  danger,
  onPress,
}: {
  label: string;
  icon: 'ticket' | 'refresh' | 'alert' | 'shield';
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.menuButton, danger && styles.dangerButton]} onPress={onPress} activeOpacity={0.86}>
      <View style={[styles.menuIcon, danger && styles.dangerIcon]}>
        <TicketIcon name={icon} size={20} color={danger ? '#DC2626' : '#534AB7'} />
      </View>
      <Text style={[styles.menuText, danger && styles.dangerText]}>{label}</Text>
      <TicketIcon name="chevron" size={17} color={danger ? '#DC2626' : '#94A3B8'} />
    </TouchableOpacity>
  );
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
      navigation.navigate('Auth', { initialRole: 'USER' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>My Account</Text>
          <Text style={styles.topTitle}>내 정보</Text>
        </View>
        <IconButton>
          <TicketIcon name="wallet" size={21} />
        </IconButton>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProfile(); }} />}
      >
        <FlowHero
          height={166}
          style={styles.hero}
          badge="계정 관리"
          title={'내 계정과 티켓 활동을\n한 곳에서 관리하세요'}
          meta="지갑 주소, 닉네임, 내 티켓과 분쟁 신고 메뉴를 확인합니다."
        />

        <View style={styles.section}>
          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profileInitial(profile?.displayName)}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileLabel}>닉네임</Text>
                {editing ? (
                  <TextInput style={styles.input} value={displayNameDraft} onChangeText={setDisplayNameDraft} placeholder="닉네임" />
                ) : (
                  <Text style={styles.displayName}>{profile?.displayName || '-'}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>지갑 주소</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{compactWalletAddress(profile?.walletAddress)}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>역할</Text>
                <Text style={styles.infoValue}>{formatRoles(profile?.roles)}</Text>
              </View>
            </View>

            {!editing ? (
              <TouchableOpacity style={styles.primaryButton} onPress={() => setEditing(true)} activeOpacity={0.88}>
                <Text style={styles.primaryButtonText}>닉네임 수정</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editRow}>
                <TouchableOpacity style={[styles.primaryButton, styles.editButton]} onPress={save} disabled={saving} activeOpacity={0.88}>
                  <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '저장'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.editButton]}
                  onPress={() => { setDisplayNameDraft(profile?.displayName || ''); setEditing(false); }}
                  disabled={saving}
                  activeOpacity={0.88}
                >
                  <Text style={styles.secondaryButtonText}>취소</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <Text style={styles.cardTitle}>계정 메뉴</Text>
            <MenuButton label="내 티켓 보기" icon="ticket" onPress={() => navigation.navigate('MyTicketFlow')} />
            <MenuButton label="리셀 티켓 보기" icon="refresh" onPress={() => navigation.navigate('ResaleList')} />
            <MenuButton label="내 분쟁 신고" icon="alert" onPress={() => navigation.navigate('MyDisputes')} />
            <MenuButton label="주최자 홈으로" icon="shield" onPress={() => navigation.navigate('Organizer')} />
            <MenuButton label="로그아웃" icon="alert" danger onPress={handleLogout} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  screen: { flex: 1 },
  content: { paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  topbar: {
    backgroundColor: 'rgba(246,247,251,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 2 },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  hero: { marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  profileCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 16, ...flowShadow },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#534AB7', fontSize: 25, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileLabel: { color: '#64748B', fontSize: 11, fontWeight: '900', marginBottom: 5 },
  displayName: { color: '#0F172A', fontSize: 22, fontWeight: '900', letterSpacing: 0 },
  input: { borderWidth: 1, borderColor: '#D9E1EE', borderRadius: 17, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: '#FFFFFF', color: '#0F172A', fontWeight: '900' },
  infoGrid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  infoBox: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EDF2F7', borderRadius: 17, padding: 12 },
  infoLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '900', marginBottom: 5 },
  infoValue: { color: '#0F172A', fontSize: 13, fontWeight: '900', lineHeight: 18 },
  primaryButton: { marginTop: 16, minHeight: 52, borderRadius: 17, backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center', ...flowShadow },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CECBF6', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#534AB7', fontSize: 15, fontWeight: '900' },
  editRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editButton: { flex: 1, marginTop: 0 },
  menuCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 16, ...flowShadow },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900', letterSpacing: 0, marginBottom: 10 },
  menuButton: { minHeight: 54, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 18, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, marginTop: 10 },
  menuIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  menuText: { flex: 1, color: '#0F172A', fontSize: 14, fontWeight: '900' },
  dangerButton: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  dangerIcon: { backgroundColor: '#FEE2E2' },
  dangerText: { color: '#DC2626' },
});
