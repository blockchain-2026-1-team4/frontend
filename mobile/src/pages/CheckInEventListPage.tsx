import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, TicketDetail } from '../types/api';

type CheckInEvent = {
  event: EventSummary;
  tickets: TicketDetail[];
};

type CheckInSection = '오늘 일정' | '향후 일정' | '종료된 이벤트';

type CheckInState = {
  label: string;
  rank: number;
  section: CheckInSection;
  actionable: boolean;
  ticketCount: number;
  usedCount: number;
  startTime?: number;
  startSummary: string;
  buttonLabel: string;
  buttonDanger: boolean;
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
  const today = now.toDateString() === start.toDateString();
  if (today) return `오늘 ${timeText} 시작`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.toDateString() === start.toDateString()) return `내일 ${timeText} 시작`;
  return `${start.getMonth() + 1}/${start.getDate()} ${timeText} 시작`;
}

function checkInStatus(item: CheckInEvent, now = new Date()): CheckInState {
  // cancelled events should show cancelled label first
  const eventStatus = String(item.event.status ?? '').toUpperCase();
  if (eventStatus === 'CANCELLED') {
    return {
      label: '이벤트 취소',
      rank: 0,
      section: '종료된 이벤트',
      actionable: false,
      ticketCount: 0,
      usedCount: 0,
      startSummary: '-',
      buttonLabel: '체크인 하기',
      buttonDanger: true,
    };
  }

  const ticketCount = item.event.totalTicketCount && item.event.totalTicketCount > 0 ? item.event.totalTicketCount : item.tickets.length;
  const usedCount = item.tickets.filter((ticket) => ticket.status === 'USED').length;
  const startTime = getNextRoundTime(item.event, now);
  const startSummary = formatStartSummary(startTime, now);

  if (ticketCount === 0) {
    const isToday = !Number.isNaN(startTime) && new Date(startTime).toDateString() === now.toDateString();
    return {
      label: '티켓 미발행',
      rank: 2,
      section: isToday ? '오늘 일정' : '향후 일정',
      actionable: false,
      ticketCount,
      usedCount,
      startSummary,
      buttonLabel: '티켓 미발행',
      buttonDanger: true,
    };
  }

  const end = new Date(item.event.eventEndAt || item.event.endsAt || item.event.eventAt || item.event.eventDateTime || '').getTime();
  const current = now.getTime();
  if (!Number.isNaN(end) && current > end) {
    return {
      label: '종료',
      rank: 3,
      section: '종료된 이벤트',
      actionable: false,
      ticketCount,
      usedCount,
      startSummary,
      buttonLabel: '종료',
      buttonDanger: true,
    };
  }

  if (!Number.isNaN(startTime)) {
    const diff = startTime - current;
    const startDate = new Date(startTime);
    const isToday = startDate.toDateString() === now.toDateString();
    const isSoon = diff > 0 && diff <= 3 * 60 * 60 * 1000;
    const isActive = current >= startTime && (Number.isNaN(end) || current <= end);

    if (isActive) {
      const elapsed = current - startTime;
      const label = elapsed <= 30 * 60 * 1000 ? '입장 진행중' : elapsed <= 90 * 60 * 1000 ? '입장 마감' : '공연 중';
      return {
        label,
        rank: 0,
        section: '오늘 일정',
        actionable: true,
        ticketCount,
        usedCount,
        startSummary,
        buttonLabel: '입장 처리',
        buttonDanger: false,
      };
    }

    if (isSoon || isToday) {
      return {
        label: '체크인 예정',
        rank: 1,
        section: '오늘 일정',
        actionable: false,
        ticketCount,
        usedCount,
        startSummary,
        buttonLabel: '체크인 예정',
        buttonDanger: true,
      };
    }

    return {
      label: '체크인 예정',
      rank: 2,
      section: '향후 일정',
      actionable: false,
      ticketCount,
      usedCount,
      startSummary,
      buttonLabel: '체크인 예정',
      buttonDanger: true,
    };
  }

  return {
    label: '체크인 예정',
    rank: 2,
    section: '향후 일정',
    actionable: false,
    ticketCount,
    usedCount,
    startSummary,
    buttonLabel: '체크인 예정',
    buttonDanger: true,
  };
}

export default function CheckInEventListPage({ navigation, route }: any) {
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
      })
      .map(({ item, status }) => ({ item, status }));
  }, [items, section]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEvents = filteredEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>체크인 이벤트 목록을 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Check-in Events</Text>
          <Text style={styles.title}>{section}</Text>
          <Text style={styles.subtitle}>{section === '오늘 일정' ? '오늘 체크인 예정 이벤트를 확인합니다.' : section === '향후 일정' ? '예정된 체크인 이벤트를 확인합니다.' : '종료된 체크인 이벤트를 확인합니다.'}</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>뒤로</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={pagedEvents}
        keyExtractor={(entry) => entry.item.event.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        renderItem={({ item }) => {
          const { item: event, status } = item;
          return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: event.event.id })}>
              <View style={styles.cardHead}>
                <Text style={styles.category}>{status.label}</Text>
                <Text style={styles.salesBadge}>{status.label}</Text>
              </View>
              <Text style={styles.eventTitle}>{eventTitle(event.event)}</Text>
              <Text style={styles.eventMeta}>{status.startSummary}</Text>
              <Text style={styles.eventMeta}>입장 완료 {status.usedCount} / {status.ticketCount}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.primaryButton]}
                  onPress={() => navigation.navigate('CheckInManage', { eventId: event.event.id })}
                >
                  <Text style={styles.primaryButtonText}>체크인 하기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CheckInStatus', { eventId: event.event.id })}>
                  <Text style={styles.secondaryButtonText}>체크인 현황</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>표시할 이벤트가 없습니다.</Text>
          </View>
        )}
        ListFooterComponent={filteredEvents.length > PAGE_SIZE ? (
          <View style={styles.pagination}>
            <TouchableOpacity style={[styles.pageButton, currentPage === 1 && styles.disabledButton]} disabled={currentPage === 1} onPress={() => setPage((value) => Math.max(value - 1, 1))}>
              <Text style={styles.pageButtonText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pageButton, currentPage >= totalPages && styles.disabledButton]} disabled={currentPage >= totalPages} onPress={() => setPage((value) => Math.min(value + 1, totalPages))}>
              <Text style={styles.pageButtonText}>다음</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  header: { padding: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  backButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  backButtonText: { color: '#0F172A', fontWeight: '900' },
  list: { padding: 18, paddingTop: 8, paddingBottom: 96 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  category: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  salesBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, minWidth: 78, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  eventTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  eventMeta: { marginTop: 4, color: '#64748B', fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryButton: { flex: 1, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 13, alignItems: 'center', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  dangerButton: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  dangerButtonText: { color: '#B91C1C' },
  disabledButton: { opacity: 0.55 },
});
