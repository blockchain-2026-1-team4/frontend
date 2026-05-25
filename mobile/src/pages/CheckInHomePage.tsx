import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatCompactDateTime, getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, TicketDetail } from '../types/api';

type CheckInEvent = {
  event: EventSummary;
  tickets: TicketDetail[];
};

type RecentCheckInItem = {
  eventId: string;
  eventName: string;
  seatInfo: string;
  usedAt: string;
};

type CheckInState = {
  label: string;
  rank: number;
  section: '오늘 예정' | '이후 일정' | '종료된 이벤트';
  actionable: boolean;
  ticketCount: number;
  usedCount: number;
  startTime: number;
  startSummary: string;
  buttonLabel: string;
  buttonDanger: boolean;
};

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
  const ticketCount = item.event.totalTicketCount && item.event.totalTicketCount > 0 ? item.event.totalTicketCount : item.tickets.length;
  const usedCount = item.tickets.filter((ticket) => ticket.status === 'USED').length;
  const startTime = getNextRoundTime(item.event, now);
  const startSummary = formatStartSummary(startTime, now);

  if (ticketCount === 0) {
    const isToday = !Number.isNaN(startTime) && new Date(startTime).toDateString() === now.toDateString();
    return {
      label: '티켓 미발행',
      rank: 4,
      section: isToday ? '오늘 예정' : '이후 일정',
      actionable: false,
      ticketCount,
      usedCount,
      startTime,
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
      rank: 4,
      section: '종료된 이벤트',
      actionable: false,
      ticketCount,
      usedCount,
      startTime,
      startSummary,
      buttonLabel: '체크인 불가',
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
      if (elapsed <= 30 * 60 * 1000) {
        return {
          label: '입장 진행중',
          rank: 0,
          section: '오늘 예정',
          actionable: true,
          ticketCount,
          usedCount,
          startTime,
          startSummary,
          buttonLabel: '입장 처리',
          buttonDanger: false,
        };
      }
      if (elapsed <= 90 * 60 * 1000) {
        return {
          label: '입장 마감',
          rank: 0,
          section: '오늘 예정',
          actionable: true,
          ticketCount,
          usedCount,
          startTime,
          startSummary,
          buttonLabel: '입장 처리',
          buttonDanger: false,
        };
      }
      return {
        label: '공연 중',
        rank: 0,
        section: '오늘 예정',
        actionable: true,
        ticketCount,
        usedCount,
        startTime,
        startSummary,
        buttonLabel: '입장 처리',
        buttonDanger: false,
      };
    }

    if (isSoon || isToday) {
      return {
        label: '체크인 예정',
        rank: 1,
        section: '오늘 예정',
        actionable: false,
        ticketCount,
        usedCount,
        startTime,
        startSummary,
        buttonLabel: '체크인 불가',
        buttonDanger: true,
      };
    }

    return {
      label: '체크인 예정',
      rank: 2,
      section: '이후 일정',
      actionable: false,
      ticketCount,
      usedCount,
      startTime,
      startSummary,
      buttonLabel: '체크인 불가',
      buttonDanger: true,
    };
  }

  return {
    label: '체크인 예정',
    rank: 2,
    section: '이후 일정',
    actionable: false,
    ticketCount,
    usedCount,
    startTime,
    startSummary,
    buttonLabel: '체크인 불가',
    buttonDanger: true,
  };
}

export default function CheckInHomePage({ navigation }: any) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [items, setItems] = useState<CheckInEvent[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckInItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<CheckInState['section'] | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await backendApi.getMyEvents({ page: 0, size: 30 });
      const activeEvents = (page.items ?? []).filter((event) => event.status === 'PUBLISHED');
      const withTickets = await Promise.all(
        activeEvents.map(async (event) => ({
          event,
          tickets: await backendApi.getEventTickets(event.id).catch(() => [] as TicketDetail[]),
        })),
      );
      setItems(withTickets);

      const flattened = withTickets
        .flatMap((item) =>
          item.tickets
            .filter((ticket) => ticket.status === 'USED' && ticket.usedAt)
            .map((ticket) => ({
              eventId: item.event.id,
              eventName: eventTitle(item.event),
              seatInfo: ticket.seatInfo || '-',
              usedAt: String(ticket.usedAt),
            })),
        )
        .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
        .slice(0, 8);

      setRecentCheckIns(flattened);
    } catch (error: any) {
      Alert.alert('체크인 홈 로드 실패', errorMessage(error, '체크인 운영 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sortedEvents = useMemo(() => {
    return [...items].sort((a, b) => {
      const aStatus = checkInStatus(a);
      const bStatus = checkInStatus(b);
      if (aStatus.rank !== bStatus.rank) return aStatus.rank - bStatus.rank;
      const aTime = getNextRoundTime(a.event);
      const bTime = getNextRoundTime(b.event);
      return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
    });
  }, [items]);

  const groupedEvents = useMemo(() => {
    const groups: Record<CheckInState['section'], CheckInEvent[]> = {
      '오늘 예정': [],
      '이후 일정': [],
      '종료된 이벤트': [],
    };

    sortedEvents.forEach((item) => {
      const status = checkInStatus(item);
      groups[status.section].push(item);
    });

    return groups;
  }, [sortedEvents]);

  const sectionSummaries = useMemo(() => {
    const sections: Array<CheckInState['section']> = ['오늘 예정', '이후 일정', '종료된 이벤트'];

    return sections.map((section) => {
      const events = groupedEvents[section];
      const summary = events.reduce(
        (acc, item) => {
          const meta = checkInStatus(item);
          acc.used += meta.usedCount;
          acc.total += meta.ticketCount;
          acc.actionable += meta.actionable ? 1 : 0;
          acc.ticketMissing += meta.ticketCount === 0 ? 1 : 0;
          return acc;
        },
        { used: 0, total: 0, actionable: 0, ticketMissing: 0 },
      );

      return { section, events, summary };
    });
  }, [groupedEvents]);

  const openSection = (section: CheckInState['section']) => {
    setActiveSection(section);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const activeEvents = activeSection ? groupedEvents[activeSection] : [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>체크인 운영 화면을 준비하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Check-in Operations</Text>
      <Text style={styles.title}>체크인</Text>
      <Text style={styles.subtitle}>체크인 운영 현황을 한눈에 확인하고 바로 처리합니다.</Text>

      <View style={styles.dashboardGrid}>
        {sectionSummaries.map(({ section, events, summary }) => (
          <View key={section} style={styles.dashboardCard}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section}</Text>
              <Text style={styles.sectionHint}>{events.length}건</Text>
            </View>
            <Text style={styles.summaryText}>체크인 {summary.used} / {summary.total}</Text>
            <Text style={styles.summaryMeta}>운영 가능 {summary.actionable}건 · 티켓 미발행 {summary.ticketMissing}건</Text>
            <TouchableOpacity style={styles.overviewButton} onPress={() => openSection(section)}>
              <Text style={styles.overviewButtonText}>전체 보기</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {activeSection ? (
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.cardTitle}>{activeSection}</Text>
            <TouchableOpacity onPress={() => setActiveSection(null)}>
              <Text style={styles.linkText}>대시보드로</Text>
            </TouchableOpacity>
          </View>
          {activeEvents.length === 0 ? (
            <Text style={styles.emptyText}>조건에 맞는 이벤트가 없습니다.</Text>
          ) : (
            activeEvents.map((item) => {
              const status = checkInStatus(item);
              return (
                <View key={item.event.id} style={styles.eventCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.eventTitle}>{eventTitle(item.event)}</Text>
                    <Text style={styles.badge}>{status.label}</Text>
                  </View>
                  <Text style={styles.eventMeta}>{status.startSummary}</Text>
                  <Text style={styles.eventMeta}>체크인 {status.usedCount} / {status.ticketCount}</Text>
                  <View style={styles.eventActions}>
                    <TouchableOpacity
                      style={[styles.primaryActionButton, status.buttonDanger && styles.dangerButton, !status.actionable && styles.disabledButton]}
                      disabled={!status.actionable}
                      onPress={() => navigation.navigate('CheckInManage', { eventId: item.event.id })}
                    >
                      <Text style={[styles.primaryActionText, status.buttonDanger && styles.dangerButtonText]}>{status.buttonLabel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryActionButton} onPress={() => navigation.navigate('CheckInStatus', { eventId: item.event.id })}>
                      <Text style={styles.secondaryActionText}>체크인 현황</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>최근 입장 처리</Text>
          <Text style={styles.sectionHint}>{recentCheckIns.length}건</Text>
        </View>
        {recentCheckIns.length === 0 ? (
          <Text style={styles.emptyText}>최근 입장 처리 기록이 없습니다.</Text>
        ) : (
          recentCheckIns.map((item, index) => (
            <TouchableOpacity key={`${item.eventId}-${item.seatInfo}-${index}`} style={styles.checkInRow} onPress={() => navigation.navigate('CheckInStatus', { eventId: item.eventId })}>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{item.eventName}</Text>
                <Text style={styles.eventMeta}>좌석 {item.seatInfo}</Text>
                <Text style={styles.eventMeta}>처리 시각 {formatCompactDateTime(item.usedAt)}</Text>
              </View>
              <Text style={styles.linkText}>기록 보기</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  sectionHint: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
  dashboardGrid: { marginTop: 14, gap: 10 },
  dashboardCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, backgroundColor: '#FFFFFF' },
  summaryText: { marginTop: 10, color: '#0F172A', fontSize: 16, fontWeight: '900' },
  summaryMeta: { marginTop: 6, color: '#64748B', fontSize: 12, lineHeight: 18 },
  overviewButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  overviewButtonText: { color: '#0F172A', fontWeight: '900', fontSize: 13 },
  eventCard: { marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', gap: 8 },
  checkInRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  eventInfo: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eventTitle: { color: '#0F172A', fontWeight: '900', fontSize: 14, flex: 1 },
  eventMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  eventActions: { marginTop: 4, gap: 8 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, minWidth: 74, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  primaryActionButton: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#2563EB' },
  primaryActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  dangerButton: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  dangerButtonText: { color: '#B91C1C' },
  secondaryActionButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: '#FFFFFF' },
  secondaryActionText: { color: '#0F172A', fontWeight: '900', fontSize: 12 },
  disabledButton: { opacity: 0.55 },
  linkText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
});
