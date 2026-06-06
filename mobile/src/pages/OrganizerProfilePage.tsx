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
    operating: events.filter((event) => String(event.status ?? '').toUpperCase() === 'ACTIVE').length,
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
        onRightPress={() => showDialog('계정 설정', '닉네임, 지갑, 알림 설정을 아래 메뉴에서 관리할 수 있습니다.')}
      />

      <View style={styles.profileCard}>
        <View style={styles.profileGlow} />
        <View style={styles.profileTop}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{profileInitial(name)}</Text></View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileRole}>{formatRoles(profile?.roles)}{'\n'}계정 정상</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>지갑 주소</Text>
            <Text style={[styles.infoValue, styles.walletText]} numberOfLines={1}>{compactWalletAddress(profile?.walletAddress)}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>권한</Text>
            <Text style={styles.infoValue}>{formatRoles(profile?.roles)}</Text>
          </View>
        </View>

        <View style={styles.profileActions}>
          <TouchableOpacity style={styles.profileAction} onPress={() => setEditing(true)}>
            <Text style={styles.profileActionText}>닉네임 수정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.profileAction, styles.profileActionSecondary]} onPress={() => navigation.navigate('Auth', { initialRole: 'ORGANIZER' })}>
            <Text style={[styles.profileActionText, styles.profileActionTextSecondary]}>지갑 관리</Text>
          </TouchableOpacity>
        </View>
      </View>

      {editing ? (
        <View style={styles.editCard}>
          <Text style={styles.editTitle}>닉네임 수정</Text>
          <TextInput style={styles.input} value={displayNameDraft} onChangeText={setDisplayNameDraft} placeholder="닉네임" />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setDisplayNameDraft(profile?.displayName || ''); setEditing(false); }} disabled={saving}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

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
  profileCard: { minHeight: 218, marginHorizontal: 16, marginVertical: 14, padding: 20, borderRadius: 30, overflow: 'hidden', backgroundColor: '#1A1A2E', ...flowShadow },
  profileGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -68, top: -62, backgroundColor: 'rgba(83,74,183,0.58)' },
  profileTop: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 58, height: 58, borderRadius: 21, backgroundColor: 'rgba(168,156,247,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#3C3489', fontSize: 23, fontWeight: '900' },
  profileCopy: { flex: 1 },
  profileName: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  profileRole: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  infoGrid: { position: 'relative', flexDirection: 'row', gap: 8, marginBottom: 14 },
  infoCell: { flex: 1, minWidth: 0, padding: 11, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  infoLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800' },
  infoValue: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', marginTop: 4 },
  walletText: { fontFamily: 'monospace', fontSize: 10 },
  profileActions: { position: 'relative', flexDirection: 'row', gap: 9 },
  profileAction: { flex: 1, paddingVertical: 11, borderRadius: 14, alignItems: 'center', backgroundColor: '#FFFFFF' },
  profileActionText: { color: organizerColors.ink, fontSize: 11, fontWeight: '900' },
  profileActionSecondary: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  profileActionTextSecondary: { color: '#FFFFFF' },
  editCard: { marginHorizontal: 16, marginBottom: 8, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: organizerColors.border, ...flowShadow },
  editTitle: { color: organizerColors.ink, fontSize: 14, fontWeight: '900', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: organizerColors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, color: organizerColors.ink, fontSize: 13 },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  saveButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 13, backgroundColor: organizerColors.ink },
  saveButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  cancelButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 13, backgroundColor: '#F3F4F6' },
  cancelButtonText: { color: '#6B7280', fontSize: 12, fontWeight: '900' },
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
