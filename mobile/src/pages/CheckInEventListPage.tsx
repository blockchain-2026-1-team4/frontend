import React, { useCallback, useMemo, useState } from 'react';
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
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, TicketDetail } from '../types/api';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

type CheckInEvent = { event: EventSummary; tickets: TicketDetail[] };
type CheckInSection = '오늘 일정' | '향후 일정' | '종료된 이벤트';

type CheckInState = {
  label: string;
  rank: number;
  section: CheckInSection;
  actionable: boolean;
  ticketCount: number;
  usedCount: number;
  startSummary: string;
  buttonLabel: string;
};

const PAGE_SIZE = 8;

function eventTitle(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function formatStartSummary(startTime: number, now = new Date()) {
  if (Number.isNaN(startTime)) return '-';
  const start = new Date(startTime);
  const pad = (value: number) => String(value).padStart(2, '0');
  const timeText = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  if (now.toDateString() === start.toDateString()) return `오늘 ${timeText} 시작`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.toDateString() === start.toDateString()) return `내일 ${timeText} 시작`;
  return `${start.getMonth() + 1}/${start.getDate()} ${timeText} 시작`;
}

function checkInStatus(item: CheckInEvent, now = new Date()): CheckInState {
  const eventStatus = String(item.event.status ?? '').toUpperCase();
  if (eventStatus === 'CANCELLED') {
    return { label: '이벤트 취소', rank: 0, section: '종료된 이벤트', actionable: false, ticketCount: 0, usedCount: 0, startSummary: '-', buttonLabel: '체크인 하기' };
  }
  const ticketCount = item.event.totalTicketCount && item.event.totalTicketCount > 0 ? item.event.totalTicketCount : item.tickets.length;
  const usedCount = item.tickets.filter((ticket) => ticket.status === 'USED').length;
  const startTime = getNextRoundTime(item.event, now);
  const startSummary = formatStartSummary(startTime, now);
  if (ticketCount === 0) {
    const isToday = !Number.isNaN(startTime) && new Date(startTime).toDateString() === now.toDateString();
    return { label: '티켓 미발행', rank: 2, section: isToday ? '오늘 일정' : '향후 일정', actionable: false, ticketCount, usedCount, startSummary, buttonLabel: '티켓 미발행' };
  }
  const end = new Date(item.event.eventEndAt || item.event.endsAt || '').getTime();
  if (!Number.isNaN(end) && now.getTime() > end) {
    return { label: '종료', rank: 4, section: '종료된 이벤트', actionable: false, ticketCount, usedCount, startSummary, buttonLabel: '종료' };
  }
  if (!Number.isNaN(startTime)) {
    const diff = startTime - now.getTime();
    const isToday = new Date(startTime).toDateString() === now.toDateString();
    const isSoon = diff > 0 && diff <= 3 * 60 * 60 * 1000;
    if (now.getTime() >= startTime) {
      const elapsed = now.getTime() - startTime;
      if (elapsed <= 30 * 60 * 1000) return { label: '입장 진행중', rank: 0, section: '오늘 일정', actionable: true, ticketCount, usedCount, startSummary, buttonLabel: '입장 처리' };
      return { label: '지연 입장', rank: 1, section: '오늘 일정', actionable: true, ticketCount, usedCount, startSummary, buttonLabel: '입장 처리' };
    }
    if (isSoon || isToday) return { label: '체크인 예정', rank: 2, section: '오늘 일정', actionable: true, ticketCount, usedCount, startSummary, buttonLabel: '체크인 하기' };
  }
  return { label: '체크인 예정', rank: 3, section: '향후 일정', actionable: false, ticketCount, usedCount, startSummary, buttonLabel: '체크인 예정' };
}

const SECTION_SUBTITLE: Record<CheckInSection, string> = {
  '오늘 일정': '오늘 체크인 예정 이벤트를 확인합니다.',
  '향후 일정': '예정된 체크인 이벤트를 확인합니다.',
  '종료된 이벤트': '종료된 체크인 이벤트를 확인합니다.',
};

export default function CheckInEventListPage({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const section = (route?.params?.section as CheckInSection | undefined) || '오늘 일정';
  const [items, setItems] = useState<CheckInEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const pageData = await backendApi.getMyEvents({ page: 0, size: 30 });
      const publishedEvents = (pageData.items ?? []).filter((event) => event.status === 'PUBLISHED');
      const withTickets = await Promise.all(
        publishedEvents.map(async (event) => ({
          event,
          tickets: await backendApi.getEventTickets(event.id).catch(() => [] as TicketDetail[]),
        })),
      );
      setItems(withTickets);
      setPage(1);
    } catch (error: any) {
      Alert.alert('체크인 목록 로드 실패', errorMessage(error, '체크인 이벤트 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filteredEvents = useMemo(() => {
    return [...items]
      .map((item) => ({ item, status: checkInStatus(item) }))
      .filter(({ status }) => status.section === section)
      .sort((a, b) => {
        if (a.status.rank !== b.status.rank) return a.status.rank - b.status.rank;
        const aTime = getNextRoundTime(a.item.event);
        const bTime = getNextRoundTime(b.item.event);
        return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
      });
  }, [items, section]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEvents = filteredEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
    '입장 진행중': { bg: '#E1F5EE', text: '#0F6E56' },
    '지연 입장': { bg: '#FAEEDA', text: '#854F0B' },
    '체크인 예정': { bg: '#EEEDFE', text: '#534AB7' },
    '티켓 미발행': { bg: '#FEE2E2', text: '#B91C1C' },
    '종료': { bg: '#F3F4F6', text: '#6B7280' },
    '이벤트 취소': { bg: '#F3F4F6', text: '#6B7280' },
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
        <Text style={styles.loadingText}>체크인 이벤트 목록을 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 14, 36) }]}>
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={() => navigation.goBack()}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.eyebrow}>CHECK-IN EVENTS</Text>
        </View>
        <Text style={styles.heroTitle}>{section}</Text>
        <Text style={styles.heroSub}>{SECTION_SUBTITLE[section]}</Text>
        <View style={styles.heroChip}>
          <View style={styles.heroDot} />
          <Text style={styles.heroChipText}>{filteredEvents.length}개 이벤트</Text>
        </View>
      </HeroGradient>

      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#534AB7' }]}>{filteredEvents.length}</Text>
          <Text style={styles.statLabel}>전체</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#854F0B' }]}>{filteredEvents.filter(({ status }) => !status.actionable && status.label === '티켓 미발행').length}</Text>
          <Text style={styles.statLabel}>티켓 미발행</Text>
        </View>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultHint}>결과 {filteredEvents.length}건</Text>
        {filteredEvents.length > PAGE_SIZE && (
          <Text style={styles.resultHint}>{currentPage} / {totalPages} 페이지</Text>
        )}
      </View>

      {pagedEvents.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>표시할 이벤트가 없습니다.</Text>
        </View>
      ) : (
        pagedEvents.map(({ item, status }) => {
          const badge = STATUS_BADGE[status.label] ?? { bg: '#F3F4F6', text: '#6B7280' };
          return (
            <View key={item.event.id} style={styles.eventCard}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.eventName} numberOfLines={1}>{eventTitle(item.event)}</Text>
                  <Text style={styles.eventMeta}>{status.startSummary} · {item.event.venue || '장소 미정'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: badge.text }]}>{status.label}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaItemLabel}>입장 완료</Text>
                  <Text style={[styles.metaItemValue, { color: '#0F6E56' }]}>{status.usedCount}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaItemLabel}>전체 티켓</Text>
                  <Text style={styles.metaItemValue}>{status.ticketCount > 0 ? status.ticketCount : '–'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaItemLabel}>판매 완료</Text>
                  <Text style={styles.metaItemValue}>{status.ticketCount > 0 ? status.usedCount : '–'}</Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => navigation.navigate('CheckInManage', { eventId: item.event.id })}
                >
                  <Text style={styles.primaryBtnText}>체크인 관리</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('CheckInStatus', { eventId: item.event.id })}>
                  <Text style={styles.secondaryBtnText}>체크인 현황</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {filteredEvents.length > PAGE_SIZE && (
        <View style={styles.pagination}>
          <TouchableOpacity style={[styles.pageButton, currentPage === 1 && styles.disabledButton]} disabled={currentPage === 1} onPress={() => setPage((v) => Math.max(v - 1, 1))}>
            <Text style={styles.pageButtonText}>이전</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pageButton, currentPage >= totalPages && styles.disabledButton]} disabled={currentPage >= totalPages} onPress={() => setPage((v) => Math.min(v + 1, totalPages))}>
            <Text style={styles.pageButtonText}>다음</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  backButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  statGrid: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, marginTop: -14, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#E5E7EB', paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', lineHeight: 20 },
  statLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 8 },
  resultHint: { fontSize: 10, color: '#9CA3AF', fontWeight: '700' },
  eventCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, marginBottom: 8, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  eventName: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  eventMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, flexShrink: 0, marginLeft: 8 },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  metaItem: { gap: 1 },
  metaItemLabel: { fontSize: 9, color: '#9CA3AF' },
  metaItemValue: { fontSize: 11, fontWeight: '700', color: '#1A1A2E' },
  actionRow: { flexDirection: 'row', gap: 7, padding: 12 },
  primaryBtn: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: '#F5F5F5', borderWidth: 0.5, borderColor: '#E5E7EB' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  primaryBtnTextDisabled: { color: '#B4B2A9' },
  secondaryBtn: { flex: 1, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 9, paddingVertical: 9, alignItems: 'center', backgroundColor: '#F5F5F5' },
  secondaryBtnText: { color: '#534AB7', fontWeight: '700', fontSize: 11 },
  emptyBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, alignItems: 'center' },
  emptyTitle: { color: '#6B7280', fontSize: 13, fontWeight: '800' },
  pagination: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 8 },
  pageButton: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  pageButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  disabledButton: { opacity: 0.35 },
});
