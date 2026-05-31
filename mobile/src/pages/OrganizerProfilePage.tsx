import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { clearAccessToken } from '../lib/auth';
import { backendApi } from '../lib/backend';
import { formatRoles } from '../lib/roles';
import type { EventSummary, TicketDetail, UserProfile } from '../types/api';

type IconName = 'chart' | 'user' | 'wallet' | 'shield' | 'home' | 'bell' | 'logout' | 'chevron';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

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

function AppIcon({ name, color = '#534AB7', size = 18 }: { name: IconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'chart' ? <Path {...common} d="M4 19V5m5 14V9m5 10V4m5 15v-7" /> : null}
      {name === 'user' ? (
        <>
          <Circle {...common} cx={12} cy={8} r={4} />
          <Path {...common} d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      ) : null}
      {name === 'wallet' ? <Path {...common} d="M4 7h16v12H4zM4 7l3-3h10l3 3M16 13h4" /> : null}
      {name === 'shield' ? <Path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4" /> : null}
      {name === 'home' ? <Path {...common} d="M3 10.8 12 3l9 7.8M5.5 10v10h13V10" /> : null}
      {name === 'bell' ? <Path {...common} d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2ZM9.5 20a2.5 2.5 0 0 0 5 0" /> : null}
      {name === 'logout' ? <Path {...common} d="M10 17 15 12l-5-5M15 12H3M21 4v16" /> : null}
      {name === 'chevron' ? <Path {...common} d="m9 18 6-6-6-6" /> : null}
    </Svg>
  );
}

export default function OrganizerProfilePage({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);

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

  const metrics = useMemo(() => {
    const operating = events.filter((event) => String(event.status ?? '').toUpperCase() === 'PUBLISHED').length;
    const issued = tickets.length || events.reduce((sum, event) => sum + Number(event.totalTicketCount ?? 0), 0);
    const checkedIn = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
    const resale = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'LISTED').length;
    const missing = events.filter((event) => Number(event.totalTicketCount ?? 0) <= 0).length;
    const today = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED' && ticket.usedAt && new Date(ticket.usedAt).toDateString() === new Date().toDateString()).length;
    return { operating, issued, checkedIn, resale, missing, today };
  }, [events, tickets]);

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

  const name = profile?.displayName || '닉네임 없음';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 18, 40) }]}>
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>My Account</Text>
          <TouchableOpacity style={styles.heroAction} onPress={() => setOpsOpen((value) => !value)} accessibilityRole="button" accessibilityLabel="운영 현황">
            <AppIcon name="chart" color="rgba(255,255,255,0.88)" size={18} />
          </TouchableOpacity>
        </View>
        <View style={styles.heroProfile}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{profileInitial(name)}</Text></View>
          <View>
            <Text style={styles.heroTitle}>{name}</Text>
            <Text style={styles.heroSub}>{formatRoles(profile?.roles)}</Text>
          </View>
        </View>
        <View style={styles.heroChip}><View style={styles.heroDot} /><Text style={styles.heroChipText}>계정 정상</Text></View>
      </HeroGradient>

      <View style={styles.opsPanel}>
        <TouchableOpacity style={styles.opsHead} onPress={() => setOpsOpen((value) => !value)}>
          <View style={styles.opsTitleWrap}><AppIcon name="chart" color="#534AB7" size={15} /><Text style={styles.opsTitle}>운영 현황</Text></View>
          <Text style={styles.opsArrow}>{opsOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {opsOpen ? (
          <View style={styles.opsGrid}>
            <OpsItem value={metrics.operating} label="운영 이벤트" />
            <OpsItem value={metrics.issued} label="발급 티켓" />
            <OpsItem value={metrics.checkedIn} label="누적 체크인" />
            <OpsItem value={metrics.resale} label="리셀 중" />
            <OpsItem value={metrics.missing} label="미발행" color="#854F0B" />
            <OpsItem value={metrics.today} label="오늘 체크인" color="#1D9E75" />
          </View>
        ) : null}
      </View>

      <View style={styles.infoCard}>
        <InfoRow icon="user" iconBg="#EEEDFE" iconColor="#534AB7" label="닉네임">
          {editing ? <TextInput style={styles.input} value={displayNameDraft} onChangeText={setDisplayNameDraft} placeholder="닉네임" /> : <Text style={styles.infoValue}>{name}</Text>}
        </InfoRow>
        <InfoRow icon="wallet" iconBg="#E6F1FB" iconColor="#185FA5" label="지갑 주소">
          <Text style={[styles.infoValue, styles.walletText]} numberOfLines={1}>{compactWalletAddress(profile?.walletAddress)}</Text>
        </InfoRow>
        <InfoRow icon="shield" iconBg="#E1F5EE" iconColor="#0F6E56" label="역할">
          <Text style={styles.infoValue}>{formatRoles(profile?.roles)}</Text>
        </InfoRow>
      </View>

      {!editing ? (
        <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}><Text style={styles.editButtonText}>닉네임 수정</Text></TouchableOpacity>
      ) : (
        <View style={styles.editRow}>
          <TouchableOpacity style={[styles.editButton, styles.editHalf]} onPress={save} disabled={saving}><Text style={styles.editButtonText}>{saving ? '저장 중...' : '저장'}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.cancelButton, styles.editHalf]} onPress={() => { setDisplayNameDraft(profile?.displayName || ''); setEditing(false); }} disabled={saving}><Text style={styles.cancelButtonText}>취소</Text></TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionLabel}>계정 메뉴</Text>
      <View style={styles.menuCard}>
        <MenuRow icon="home" iconBg="#EEEDFE" iconColor="#534AB7" label="사용자 홈으로" onPress={() => navigation.navigate('Main')} />
        <MenuRow icon="bell" iconBg="#F3F4F6" iconColor="#6B7280" label="알림 설정" onPress={() => Alert.alert('알림 설정', '알림 설정 화면은 준비 중입니다.')} />
        <MenuRow icon="logout" iconBg="#FCEBEB" iconColor="#A32D2D" label="로그아웃" danger onPress={handleLogout} />
      </View>
    </ScrollView>
  );
}

function OpsItem({ value, label, color = '#1A1A2E' }: { value: number; label: string; color?: string }) {
  return (
    <View style={styles.opsItem}><Text style={[styles.opsValue, { color }]}>{value.toLocaleString()}</Text><Text style={styles.opsLabel}>{label}</Text></View>
  );
}

function InfoRow({ icon, iconBg, iconColor, label, children }: { icon: IconName; iconBg: string; iconColor: string; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: iconBg }]}><AppIcon name={icon} color={iconColor} size={16} /></View>
      <View style={styles.infoCopy}><Text style={styles.infoLabel}>{label}</Text>{children}</View>
    </View>
  );
}

function MenuRow({ icon, iconBg, iconColor, label, danger, onPress }: { icon: IconName; iconBg: string; iconColor: string; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}><AppIcon name={icon} color={iconColor} size={16} /></View>
      <Text style={[styles.menuLabel, danger && styles.menuDanger]}>{label}</Text>
      <AppIcon name="chevron" color="#B4B2A9" size={15} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  hero: { paddingHorizontal: 18, paddingBottom: 30 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroProfile: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '900', color: '#3C3489' },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', lineHeight: 25 },
  heroSub: { color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 2 },
  heroChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },
  opsPanel: { marginHorizontal: 14, marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', overflow: 'hidden' },
  opsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  opsTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  opsTitle: { fontSize: 12, fontWeight: '900', color: '#1A1A2E' },
  opsArrow: { color: '#9CA3AF', fontSize: 11, fontWeight: '900' },
  opsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  opsItem: { width: '33.333%', paddingVertical: 12, alignItems: 'center', borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#F3F4F6' },
  opsValue: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  opsLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 3, fontWeight: '700' },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, marginTop: 8, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 9, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  infoIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1, minWidth: 0 },
  infoLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '800' },
  infoValue: { fontSize: 12, fontWeight: '900', color: '#1A1A2E', marginTop: 2 },
  walletText: { fontFamily: 'monospace', fontSize: 10 },
  input: { marginTop: 4, borderWidth: 0.5, borderColor: '#CBD5E1', borderRadius: 8, padding: 9, backgroundColor: '#FFFFFF', color: '#1A1A2E', fontSize: 12 },
  editButton: { marginHorizontal: 14, marginTop: 8, backgroundColor: '#1A1A2E', borderRadius: 11, padding: 12, alignItems: 'center' },
  editButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  editRow: { flexDirection: 'row', gap: 8, marginHorizontal: 14, marginTop: 8 },
  editHalf: { flex: 1, marginHorizontal: 0, marginTop: 0 },
  cancelButton: { flex: 1, borderWidth: 0.5, borderColor: '#CBD5E1', borderRadius: 11, padding: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  cancelButtonText: { color: '#1A1A2E', fontSize: 13, fontWeight: '900' },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 9, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  menuIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 12, fontWeight: '900', color: '#1A1A2E' },
  menuDanger: { color: '#A32D2D' },
});
