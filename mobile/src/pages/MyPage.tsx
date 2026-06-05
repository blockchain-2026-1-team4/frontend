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
import { IconButton, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { clearAccessToken } from '../lib/auth';
import { backendApi } from '../lib/backend';
import type { UserProfile } from '../types/api';

type ProfileStats = {
  tickets: number;
  resellable: number;
  disputes: number;
};

const ACTIVE_DISPUTE_STATUSES = new Set(['OPEN', 'RECEIVED', 'REVIEWING', 'PROCESSING']);

function profileName(profile?: UserProfile | null) {
  return profile?.displayName?.trim() || '블록체인 4트';
}

function MenuButton({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: 'refresh' | 'alert';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menu} onPress={onPress} activeOpacity={0.86}>
      <View style={styles.menuIcon}>
        <TicketIcon name={icon} size={21} color="#534AB7" />
      </View>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>
      <TicketIcon name="chevron" size={17} color="#94A3B8" />
    </TouchableOpacity>
  );
}

function StatTile({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.stat} onPress={onPress} activeOpacity={0.86}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MyPage({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [stats, setStats] = useState<ProfileStats>({ tickets: 0, resellable: 0, disputes: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const me = await backendApi.getMe();
      setProfile(me);
      setDisplayNameDraft(me.displayName || '');

      const [tickets, disputes] = await Promise.all([
        backendApi.getMyTickets().catch(() => []),
        backendApi.getMyDisputes({ size: 50 }).catch(() => ({ items: [] })),
      ]);

      setStats({
        tickets: tickets.length,
        resellable: tickets.filter((ticket) => String(ticket.status ?? '').toUpperCase() === 'SOLD' && ticket.resaleEnabled !== false).length,
        disputes: (disputes.items ?? []).filter((item) => ACTIVE_DISPUTE_STATUSES.has(String(item.status ?? 'OPEN').toUpperCase())).length,
      });
    } catch (cause: any) {
      Alert.alert('내 정보 로드 실패', errorMessage(cause, '내 정보를 불러오지 못했습니다.'));
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
    } catch (cause: any) {
      Alert.alert('저장 실패', errorMessage(cause, '내 정보를 수정하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await clearAccessToken();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (cause: any) {
      Alert.alert('로그아웃 실패', errorMessage(cause, '세션을 종료하지 못했습니다.'));
    }
  };

  const openAccountActions = () => {
    Alert.alert('계정 설정', '계정 작업을 선택하세요.', [
      { text: '로그아웃', style: 'destructive', onPress: handleLogout },
      { text: '취소', style: 'cancel' },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>My Account</Text>
          <Text style={styles.title}>내 정보</Text>
        </View>
        <TouchableOpacity onPress={openAccountActions} activeOpacity={0.84}>
          <IconButton>
            <TicketIcon name="settings" size={21} />
          </IconButton>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProfile(); }} />}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileOrb} />
          <View style={styles.avatar}>
            <TicketIcon name="user" size={29} color="#A89CF7" />
          </View>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={displayNameDraft}
              onChangeText={setDisplayNameDraft}
              placeholder="닉네임"
              placeholderTextColor="#94A3B8"
            />
          ) : (
            <Text style={styles.profileName} numberOfLines={1}>{profileName(profile)}</Text>
          )}
          <Text style={styles.profileSub}>
            티켓, 리셀, 분쟁 신고를 한 곳에서 관리합니다.
          </Text>

          <View style={styles.profileActions}>
            {editing ? (
              <>
                <TouchableOpacity style={styles.actionPrimary} onPress={save} disabled={saving} activeOpacity={0.86}>
                  <Text style={styles.actionPrimaryText}>{saving ? '저장 중' : '저장'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionSecondary}
                  onPress={() => { setDisplayNameDraft(profile?.displayName || ''); setEditing(false); }}
                  disabled={saving}
                  activeOpacity={0.86}
                >
                  <Text style={styles.actionSecondaryText}>취소</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.actionPrimary} onPress={() => setEditing(true)} activeOpacity={0.86}>
                  <Text style={styles.actionPrimaryText}>닉네임 수정</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionSecondary} onPress={() => navigation.navigate('Auth', { initialRole: 'USER' })} activeOpacity={0.86}>
                  <Text style={styles.actionSecondaryText}>지갑 관리</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.stats}>
          <StatTile value={stats.tickets} label="보유 티켓" onPress={() => navigation.navigate('MyTicketFlow')} />
          <StatTile value={stats.resellable} label="리셀 가능" onPress={() => navigation.navigate('MyTicketFlow')} />
          <StatTile value={stats.disputes} label="분쟁 접수" onPress={() => navigation.navigate('MyDisputes')} />
        </View>

        <View style={styles.section}>
          <View style={styles.head}>
            <View>
              <Text style={styles.headTitle}>계정 메뉴</Text>
              <Text style={styles.headSub}>필요한 작업을 바로 시작하세요.</Text>
            </View>
          </View>
          <View style={styles.menuList}>
            <MenuButton
              title="리셀 티켓 보기"
              subtitle="공식 리셀 마켓에서 티켓을 탐색합니다."
              icon="refresh"
              onPress={() => navigation.navigate('ResaleList')}
            />
            <MenuButton
              title="내 분쟁 신고"
              subtitle="접수한 신고 상태를 확인합니다."
              icon="alert"
              onPress={() => navigation.navigate('MyDisputes')}
            />
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
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  profileCard: {
    height: 210,
    margin: 16,
    borderRadius: 30,
    backgroundColor: '#1A1A2E',
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  profileOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(83,74,183,0.58)',
    right: -68,
    top: -62,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: 'rgba(168,156,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  profileName: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: 0, marginBottom: 6 },
  profileSub: { color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 19, fontWeight: '700' },
  nameInput: {
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  profileActions: { marginTop: 18, flexDirection: 'row', gap: 9 },
  actionPrimary: { flex: 1, height: 40, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  actionPrimaryText: { color: '#1A1A2E', fontSize: 12, fontWeight: '900' },
  actionSecondary: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSecondaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, padding: 13, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '900', color: '#1A1A2E' },
  statLabel: { fontSize: 10, color: '#64748B', fontWeight: '900', marginTop: 3 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  headTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  headSub: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '700' },
  menuList: { gap: 10 },
  menu: {
    minHeight: 72,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...flowShadow,
  },
  menuIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  menuSub: { fontSize: 10, color: '#64748B', lineHeight: 15, fontWeight: '700' },
});
