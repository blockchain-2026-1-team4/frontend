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
import { TicketIcon, TicketIconName, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { clearAccessToken } from '../lib/auth';
import { backendApi } from '../lib/backend';
import { hasOrganizerAccess } from '../lib/roles';
import type { UserProfile } from '../types/api';

type ProfileStats = {
  tickets: number;
  reselling: number;
  disputes: number;
};

const ACTIVE_DISPUTE_STATUSES = new Set(['OPEN', 'RECEIVED', 'REVIEWING', 'PROCESSING']);

function shortenAddress(addr?: string | null) {
  if (!addr || addr.length < 12) return addr ?? '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function RolePill({ label }: { label: string }) {
  return <View style={styles.rolePill}><Text style={styles.rolePillText}>{label}</Text></View>;
}

function StatCard({
  icon,
  value,
  label,
  sub,
  onPress,
}: {
  icon: TicketIconName;
  value: number;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.statOrb} />
      <TicketIcon name={icon} size={20} color="#534AB7" />
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
}: {
  icon: TicketIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menu} onPress={onPress} activeOpacity={0.86}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <TicketIcon name={icon} size={21} color={danger ? '#DC2626' : '#534AB7'} />
      </View>
      <View style={styles.menuBody}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>
      <TicketIcon name="chevron" size={17} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

export default function MyPage({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [stats, setStats] = useState<ProfileStats>({ tickets: 0, reselling: 0, disputes: 0 });
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
        reselling: tickets.filter((t) => String(t.status ?? '').toUpperCase() === 'LISTED').length,
        disputes: (disputes.items ?? []).filter((item) =>
          ACTIVE_DISPUTE_STATUSES.has(String(item.status ?? 'OPEN').toUpperCase()),
        ).length,
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

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAccessToken();
            navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
          } catch (cause: any) {
            Alert.alert('로그아웃 실패', errorMessage(cause, '세션을 종료하지 못했습니다.'));
          }
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;
  }

  const isOrganizer = hasOrganizerAccess(profile?.roles);
  const displayName = profile?.displayName?.trim() || '블록체인 4호';

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>My Account</Text>
          <Text style={styles.title}>내 정보</Text>
        </View>
        <View style={styles.topbarSpacer} />
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void loadProfile(); }}
          />
        }
      >
        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileOrb} />

          {/* 아바타 + 이름/역할 가로 배치 */}
          <View style={styles.profileMain}>
            <View style={styles.avatar}>
              <TicketIcon name="user" size={28} color="#A89CF7" />
            </View>
            <View style={styles.profileId}>
              {editing ? (
                <TextInput
                  style={styles.nameInput}
                  value={displayNameDraft}
                  onChangeText={setDisplayNameDraft}
                  placeholder="닉네임"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  returnKeyType="done"
                  onSubmitEditing={() => void save()}
                />
              ) : (
                <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              )}
              <View style={styles.roleRow}>
                <RolePill label="사용자" />
                {isOrganizer && <RolePill label="주최자 권한 보유" />}
              </View>
            </View>
            <TouchableOpacity
              style={styles.editIconButton}
              onPress={() => editing ? void save() : setEditing(true)}
              disabled={saving}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={editing ? '닉네임 저장' : '닉네임 수정'}
            >
              {saving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <TicketIcon name={editing ? 'check' : 'edit'} size={17} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          <View style={styles.walletRow}>
            <Text style={styles.walletLabel}>연결된 지갑</Text>
            <Text
              style={[styles.walletValue, !profile?.walletAddress && styles.walletEmpty]}
              numberOfLines={1}
            >
              {profile?.walletAddress ? shortenAddress(profile.walletAddress) : '지갑이 연결되지 않았습니다'}
            </Text>
          </View>
          <View style={styles.profileDivider} />
        </View>

        {/* 빠른 통계 */}
        <View style={styles.statsRow}>
          <StatCard
            icon="ticket"
            value={stats.tickets}
            label="보유 티켓"
            sub="내 티켓으로 이동"
            onPress={() => navigation.navigate('MyTicketFlow')}
          />
          <StatCard
            icon="refresh"
            value={stats.reselling}
            label="판매 중 리셀"
            sub="등록한 리셀 목록"
            onPress={() => navigation.navigate('MyTicketFlow')}
          />
          <StatCard
            icon="alert"
            value={stats.disputes}
            label="진행 중 분쟁"
            sub="분쟁 내역 확인"
            onPress={() => navigation.navigate('MyDisputes')}
          />
        </View>

        {/* 계정 메뉴 */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>계정 메뉴</Text>
            <Text style={styles.sectionSub}>티켓과 계정 정보를 관리하세요.</Text>
          </View>
          <View style={styles.menuList}>
            <MenuItem
              icon="ticket"
              title="내 티켓"
              subtitle="보유 티켓, QR, 리셀 등록을 확인합니다."
              onPress={() => navigation.navigate('MyTicketFlow')}
            />
            <MenuItem
              icon="refresh"
              title="리셀 마켓"
              subtitle="공식 리셀 티켓을 탐색하고 구매합니다."
              onPress={() => navigation.navigate('ResaleList')}
            />
            <MenuItem
              icon="alert"
              title="내 분쟁 신고"
              subtitle="접수한 신고 상태 및 수정 가능 여부를 확인합니다."
              onPress={() => navigation.navigate('MyDisputes')}
            />
            {isOrganizer && (
              <MenuItem
                icon="store"
                title="주최자 센터"
                subtitle="별도 로그인 없이 주최자 화면으로 이동합니다."
                onPress={() => navigation.navigate('Organizer')}
              />
            )}
            <MenuItem
              icon="logout"
              title="로그아웃"
              subtitle="선택 시 확인 모달을 표시합니다."
              onPress={handleLogout}
              danger
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
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  topbarSpacer: { width: 38 },

  /* 프로필 카드 */
  profileCard: {
    margin: 16,
    borderRadius: 30,
    backgroundColor: '#1A1A2E',
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  profileOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(83,74,183,0.58)',
    right: -82,
    top: -74,
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(168,156,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileId: { flex: 1, minWidth: 0 },
  profileName: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 25,
    marginBottom: 5,
  },
  editIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  roleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rolePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  rolePillText: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.78)' },

  /* 닉네임 수정 input */
  nameInput: {
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 5,
  },

  /* 지갑 정보 */
  walletRow: { gap: 5 },
  walletLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.42)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  walletValue: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  walletEmpty: { color: 'rgba(255,255,255,0.38)', fontWeight: '700' },
  profileDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 14,
  },

  /* 빠른 통계 */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 22,
    padding: 13,
    overflow: 'hidden',
    ...flowShadow,
  },
  statOrb: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EEEDFE',
    right: -18,
    top: -20,
  },
  statNum: { fontSize: 19, fontWeight: '900', color: '#1A1A2E', marginTop: 8, letterSpacing: -0.4 },
  statLabel: { fontSize: 10, color: '#64748B', fontWeight: '900', marginTop: 3, lineHeight: 13 },
  statSub: { fontSize: 9, color: '#94A3B8', fontWeight: '700', marginTop: 5, lineHeight: 12 },

  section: { paddingHorizontal: 16, paddingBottom: 14 },

  /* 섹션 헤더 */
  sectionHead: { marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  sectionSub: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '700' },

  /* 메뉴 목록 */
  menuList: { gap: 10 },
  menu: {
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
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuIconDanger: { backgroundColor: '#FFF1F2' },
  menuBody: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  menuTitleDanger: { color: '#DC2626' },
  menuSub: { fontSize: 10, color: '#64748B', lineHeight: 15, fontWeight: '700' },
});
