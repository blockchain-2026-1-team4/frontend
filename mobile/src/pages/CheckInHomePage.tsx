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
      rank: 2,
      section: isToday ? '오늘 일정' : '향후 일정',
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
      rank: 3,
      section: '종료된 이벤트',
      actionable: false,
      ticketCount,
      usedCount,
      startTime,
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
        section: '오늘 일정',
        actionable: false,
        ticketCount,
        usedCount,
        startTime,
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
      startTime,
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
    startTime,
    startSummary,
    buttonLabel: '체크인 예정',
    buttonDanger: true,
  };
}

export default function CheckInHomePage({ navigation }: any) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [items, setItems] = useState<CheckInEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await backendApi.getMyEvents({ page: 0, size: 30 });
      const publishedEvents = (page.items ?? []).filter((event) => event.status === 'PUBLISHED');
      const withTickets = await Promise.all(
        publishedEvents.map(async (event) => ({
          event,
          tickets: await backendApi.getEventTickets(event.id).catch(() => [] as TicketDetail[]),
        })),
      );
      setItems(withTickets);
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

  const groupedEvents = useMemo<Record<CheckInSection, CheckInEvent[]>>(() => {
    const groups: Record<CheckInSection, CheckInEvent[]> = {
      '오늘 일정': [],
      '향후 일정': [],
      '종료된 이벤트': [],
    };

    sortedEvents.forEach((item) => {
      const status = checkInStatus(item);
      groups[status.section].push(item);
    });

    return groups;
  }, [sortedEvents]);

  const sectionSummaries = useMemo(() => {
    const sections: CheckInSection[] = ['오늘 일정', '향후 일정', '종료된 이벤트'];

    return sections.map((section) => {
      const events = groupedEvents[section];
      const ticketMissing = events.filter((item) => checkInStatus(item).ticketCount === 0).length;
      return {
        section,
        events,
        ticketMissing,
        preview: section === '오늘 일정' ? events.slice(0, 2) : [],
      };
    });
  }, [groupedEvents]);

  const openSection = (section: CheckInSection) => {
    navigation.navigate('CheckInEventList', { section });
  };

  const renderEventCard = (item: CheckInEvent) => {
    const status = checkInStatus(item);
    return (
      <View key={item.event.id} style={styles.eventCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.eventTitle}>{eventTitle(item.event)}</Text>
          <Text style={styles.badge}>{status.label}</Text>
        </View>
        <Text style={styles.eventMeta}>{status.startSummary}</Text>
        <Text style={styles.eventMeta}>입장 완료 {status.usedCount} / {status.ticketCount}</Text>
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
  };

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
        {sectionSummaries.map(({ section, events, ticketMissing, preview }) => (
          <View key={section} style={styles.dashboardCard}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section}</Text>
              <Text style={styles.sectionHint}>{events.length}건</Text>
            </View>

            {section === '오늘 일정' ? (
              <Text style={styles.summaryMeta}>오늘 실제 운영해야 하는 이벤트를 먼저 보여줍니다.</Text>
            ) : section === '향후 일정' ? (
              <Text style={styles.summaryMeta}>체크인 예정 이벤트 {events.length}건 · 티켓 미발행 {ticketMissing}건</Text>
            ) : (
              <Text style={styles.summaryMeta}>종료된 체크인 이벤트 {events.length}건</Text>
            )}

            {section === '오늘 일정' ? (
              preview.length > 0 ? (
                <View style={styles.previewList}>{preview.map((item) => renderEventCard(item))}</View>
              ) : (
                <Text style={styles.emptyText}>오늘 예정된 이벤트가 없습니다.</Text>
              )
            ) : null}

            <TouchableOpacity style={styles.overviewButton} onPress={() => openSection(section)}>
              <Text style={styles.overviewButtonText}>전체 보기</Text>
            </TouchableOpacity>
          </View>
        ))}
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
  dashboardGrid: { marginTop: 14, gap: 10 },
  dashboardCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 16, backgroundColor: '#FFFFFF' },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  sectionHint: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  summaryMeta: { marginTop: 6, color: '#64748B', fontSize: 12, lineHeight: 18 },
  previewList: { marginTop: 10, gap: 8 },
  eventCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 16, backgroundColor: '#FFFFFF', gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eventTitle: { color: '#0F172A', fontWeight: '900', fontSize: 14, flex: 1 },
  eventMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  eventActions: { marginTop: 4, gap: 8 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, minWidth: 74, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  primaryActionButton: { borderRadius: 8, paddingVertical: 13, alignItems: 'center', backgroundColor: '#2563EB' },
  primaryActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  dangerButton: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  dangerButtonText: { color: '#B91C1C' },
  secondaryActionButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 13, alignItems: 'center', backgroundColor: '#FFFFFF' },
  secondaryActionText: { color: '#0F172A', fontWeight: '900', fontSize: 12 },
  overviewButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  overviewButtonText: { color: '#0F172A', fontWeight: '900', fontSize: 13 },
  emptyText: { color: '#94A3B8', paddingVertical: 12, textAlign: 'center' },
  disabledButton: { opacity: 0.55 },
  linkText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
});