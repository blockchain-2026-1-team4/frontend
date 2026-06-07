import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  OrganizerSectionHead,
  OrganizerTopBar,
  organizerColors,
  organizerTabStyles,
} from '../components/OrganizerTabKit';
import { TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { clearAccessToken } from '../lib/auth';
import { backendApi } from '../lib/backend';
import { showDialog } from '../lib/dialog';
import { formatRoles } from '../lib/roles';
import type { EventSummary, TicketDetail, UserProfile } from '../types/api';

function compactWalletAddress(address?: string | null) {
  const value = address?.trim();
  if (!value) return '연결된 지갑 없음';
  if (value.length <= 16) return value;
  return `${value.slice(0, 6)}...${value.slice(-7)}`;
}

function profileInitial(name?: string | null) {
  const value = name?.trim();
  return value ? Array.from(value)[0] : 'T';
}

function RolePill({ label }: { label: string }) {
  return <View style={styles.rolePill}><Text style={styles.rolePillText}>{label}</Text></View>;
}

export default function OrganizerProfilePage({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
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
      const eventPage = await backendApi.getMyEvents({ page: 0, size: 100 }).catch(() => ({ items: [] as EventSummary[] }));
      const myEvents = eventPage.items ?? [];
      setEvents(myEvents);
      const ticketLists = await Promise.all(myEvents.map((event) => backendApi.getEventTickets(event.id).catch(() => [])));
      setTickets(ticketLists.flat());
    } catch (error: any) {
      Alert.alert('내 정보 로드 실패', errorMessage(error, '내 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const metrics = useMemo(() => ({
    operating: events.filter((event) => String(event.status ?? '').toUpperCase() === 'PUBLISHED').length,
    issued: tickets.length || events.reduce((sum, event) => sum + Number(event.totalTicketCount ?? 0), 0),
  }), [events, tickets]);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={organizerColors.purple} />
        <Text style={styles.loadingText}>내 정보를 불러오고 있습니다.</Text>
      </View>
    );
  }

  const name = profile?.displayName || '닉네임 없음';

  return (
    <ScrollView
      style={organizerTabStyles.container}
      contentContainerStyle={organizerTabStyles.content}
      stickyHeaderIndices={[0]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <OrganizerTopBar
        eyebrow="My Account"
        title="내 정보"
        rightIcon="settings"
        rightLabel="계정 설정"
        onRightPress={() => showDialog('계정 설정', '닉네임과 알림 설정을 아래 메뉴에서 관리할 수 있습니다.')}
      />

      <View style={styles.profileCard}>
        <View style={styles.profileGlow} />
        <View style={styles.profileTop}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{profileInitial(name)}</Text></View>
          <View style={styles.profileCopy}>
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
              <Text style={styles.profileName} numberOfLines={1}>{name}</Text>
            )}
            <View style={styles.roleRow}>
              <RolePill label={formatRoles(profile?.roles)} />
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
          <Text style={[styles.walletValue, !profile?.walletAddress && styles.walletEmpty]} numberOfLines={1}>
            {compactWalletAddress(profile?.walletAddress)}
          </Text>
        </View>
        <View style={styles.profileDivider} />
      </View>

      <OrganizerSectionHead title="운영 현황" subtitle="내 계정 기준 요약" />
      <View style={styles.metricGrid}>
        <Metric value={metrics.operating} label="운영중 이벤트" />
        <Metric value={metrics.issued} label="발급 티켓" tone="green" />
      </View>

      <OrganizerSectionHead title="계정 메뉴" subtitle="계정과 알림 관리" />
      <View style={styles.menuList}>
        <MenuCard icon="user" label="사용자 홈으로" subtitle="일반 사용자 화면으로 이동합니다." onPress={() => navigation.navigate('Main')} />
        <MenuCard icon="bell" label="알림 설정" subtitle="운영 알림을 관리합니다." onPress={() => showDialog('알림 설정', '알림 설정 화면은 준비 중입니다.')} />
        <MenuCard icon="arrowLeft" label="로그아웃" subtitle="현재 계정에서 로그아웃합니다." danger onPress={handleLogout} />
      </View>
    </ScrollView>
  );
}

function Metric({ value, label, tone = 'purple' }: { value: number; label: string; tone?: 'purple' | 'green' }) {
  const colors = {
    purple: '#534AB7',
    green: '#0F6E56',
  };
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color: colors[tone] }]}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function MenuCard({
  icon,
  label,
  subtitle,
  danger,
  onPress,
}: {
  icon: 'user' | 'bell' | 'arrowLeft';
  label: string;
  subtitle: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuCard} onPress={onPress}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <TicketIcon name={icon} color={danger ? '#A32D2D' : organizerColors.purple} size={19} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <TicketIcon name="chevron" color="#B4B2A9" size={17} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: organizerColors.background },
  loadingText: { marginTop: 12, color: organizerColors.muted, fontSize: 14 },
  profileCard: { marginHorizontal: 16, marginVertical: 14, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, borderRadius: 30, overflow: 'hidden', backgroundColor: '#1A1A2E', ...flowShadow },
  profileGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -68, top: -62, backgroundColor: 'rgba(83,74,183,0.58)' },
  profileTop: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: 'rgba(168,156,247,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#A89CF7', fontSize: 22, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: '#FFFFFF', fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.7, marginBottom: 5 },
  nameInput: { height: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.12)', color: '#FFFFFF', paddingHorizontal: 12, fontSize: 16, fontWeight: '900', marginBottom: 5 },
  roleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rolePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  rolePillText: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.78)' },
  editIconButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', flexShrink: 0 },
  walletRow: { position: 'relative', gap: 5 },
  walletLabel: { color: 'rgba(255,255,255,0.42)', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  walletValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  walletEmpty: { color: 'rgba(255,255,255,0.38)', fontWeight: '700' },
  profileDivider: { position: 'relative', height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 14 },
  metricGrid: { paddingHorizontal: 16, flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, minHeight: 92, padding: 15, justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: organizerColors.border, ...flowShadow },
  metricValue: { fontSize: 24, fontWeight: '900' },
  metricLabel: { color: organizerColors.muted, fontSize: 10, fontWeight: '800', marginTop: 5 },
  menuList: { paddingHorizontal: 16, gap: 10 },
  menuCard: { minHeight: 72, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: organizerColors.border, ...flowShadow },
  menuIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE' },
  menuIconDanger: { backgroundColor: '#FCEBEB' },
  menuCopy: { flex: 1 },
  menuLabel: { color: organizerColors.ink, fontSize: 13, fontWeight: '900' },
  menuLabelDanger: { color: '#A32D2D' },
  menuSubtitle: { color: organizerColors.muted, fontSize: 9, fontWeight: '700', marginTop: 3 },
});
