import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate, formatEventStatus, formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const PAGE_SIZE = 12;
const MAX_VISIBLE_PAGES = 4;

function seatSectionOf(seatInfo?: string) {
  const normalized = String(seatInfo ?? '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.startsWith('VIP')) return 'VIP';
  return normalized.split(/[-\s]/)[0];
}

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? '');
}

function weiToEth(wei?: string) {
  if (!wei) return '-';
  const value = BigInt(wei);
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = String(value % 1_000_000_000_000_000_000n).padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction} ETH` : `${whole} ETH`;
}

export default function OrganizerEventDetailPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ticketPage, setTicketPage] = useState(1);
  const [seatQuery, setSeatQuery] = useState('');
  const [selectedSeatSection, setSelectedSeatSection] = useState('전체');
  const [sortMode, setSortMode] = useState<'latest' | 'seat'>('latest');

  const soldTickets = tickets.filter((ticket) => ticket.status === 'SOLD' || ticket.status === 'LISTED' || ticket.status === 'USED').length;
  const usedTickets = tickets.filter((ticket) => ticket.status === 'USED').length;
  const availableTickets = tickets.filter((ticket) => ticket.status === 'AVAILABLE').length;
  const recentTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 4),
    [tickets],
  );
  const seatFilters = useMemo(() => {
    const sections = Array.from(new Set(tickets.map((ticket) => seatSectionOf(ticket.seatInfo)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'ko-KR', { numeric: true }),
    );
    return ['전체', ...sections];
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const query = seatQuery.trim().toUpperCase();
    const base = tickets.filter((ticket) => {
      const seatInfo = String(ticket.seatInfo || '').toUpperCase();
      const matchesSection = selectedSeatSection === '전체' || seatSectionOf(ticket.seatInfo) === selectedSeatSection;
      const matchesQuery = !query || seatInfo.includes(query);
      return matchesSection && matchesQuery;
    });

    return [...base].sort((a, b) => {
      if (sortMode === 'seat') {
        return String(a.seatInfo || '').localeCompare(String(b.seatInfo || ''), 'ko-KR', { numeric: true });
      }
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [seatQuery, selectedSeatSection, sortMode, tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(ticketPage, totalPages);
  const pagedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredTickets.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredTickets]);

  const pageNumbers = useMemo(() => {
    const half = Math.floor(MAX_VISIBLE_PAGES / 2);
    const start = Math.max(1, Math.min(currentPage - half, totalPages - MAX_VISIBLE_PAGES + 1));
    const end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('이벤트 관리 불가', statusMessage);
        navigation.goBack();
        return;
      }

      const detail = await backendApi.getEvent(eventId);
      const eventTickets = await backendApi.getEventTickets(eventId).catch(() => []);

      setEvent(detail);
      setTickets(eventTickets);
      setTicketPage(1);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const changeStatus = async (status: string) => {
    if (!event) return;
    setSaving(true);
    try {
      await backendApi.updateEventStatus(event.id, { status });
      await load();
    } catch (error: any) {
      Alert.alert('상태 변경 실패', errorMessage(error, '상태를 변경하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const cancelEvent = () => {
    if (!event || event.status === 'CANCELED') return;
    const message = '이 이벤트를 취소 처리하시겠습니까? 취소된 이벤트는 목록에는 남고 상태가 취소로 변경됩니다.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void changeStatus('CANCELED');
      return;
    }

    Alert.alert('이벤트 취소', message, [
      { text: '아니요', style: 'cancel' },
      { text: '취소 처리', style: 'destructive', onPress: () => void changeStatus('CANCELED') },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>이벤트 운영 정보를 불러오고 있습니다.</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>이벤트를 찾지 못했습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.eyebrow}>Event Operations</Text>
      <Text style={styles.title}>{event.name || event.title || '이벤트 운영'}</Text>
      <Text style={styles.subtitle}>{event.venue} · {formatEventDate(event.eventAt || event.eventDateTime)}</Text>

      <View style={styles.metricGrid}>
        <Metric label="총 발행 티켓" value={tickets.length} />
        <Metric label="판매 완료 티켓" value={soldTickets} />
        <Metric label="사용 완료 티켓" value={usedTickets} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id })}>
          <Text style={styles.primaryButtonText}>티켓 발행</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => changeStatus(event.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} disabled={saving || event.status === 'CANCELED'}>
          <Text style={styles.secondaryButtonText}>{event.status === 'ACTIVE' ? '운영중지' : '운영 재개'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerButton} onPress={cancelEvent} disabled={saving || event.status === 'CANCELED'}>
          <Text style={styles.dangerButtonText}>{event.status === 'CANCELED' ? '이벤트 취소됨' : '이벤트 취소'}</Text>
        </TouchableOpacity>
        <Text style={styles.statusHint}>현재 상태 {formatEventStatus(event.status)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>운영 메뉴</Text>
        <MenuCard
          title="판매 현황"
          text={`판매 완료 ${soldTickets} · 잔여 좌석 ${availableTickets} · 가격 ${weiToEth(event.ticketPriceWei)}`}
          onPress={() => navigation.navigate('SalesStatus', { eventId: event.id })}
        />
        <MenuCard
          title="체크인 현황"
          text={`체크인 완료 ${usedTickets}건 · 총 발행 티켓 ${tickets.length}장`}
          onPress={() => navigation.navigate('CheckInStatus', { eventId: event.id })}
        />
        <MenuCard
          title="이벤트 설정"
          text="기본 정보, 리셀 정책, 이벤트 상태를 관리합니다."
          onPress={() => navigation.navigate('EventSettings', { eventId: event.id })}
        />
        <MenuCard
          title="체크인 관리"
          text="QR 스캔 후 검증 결과를 확인하고 단계적으로 입장 처리합니다."
          onPress={() => navigation.navigate('CheckInManage', { eventId: event.id })}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>최근 발행 티켓 미리보기</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TicketExplore', { eventId: event.id })}>
            <Text style={styles.linkText}>전체 발행 좌석 보기</Text>
          </TouchableOpacity>
        </View>
        {recentTickets.length === 0 ? (
          <Text style={styles.emptyText}>최근 발행 티켓이 없습니다.</Text>
        ) : (
          recentTickets.map((ticket) => (
            <View key={ticketId(ticket)} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketTitle}>{ticket.seatInfo || '-'}</Text>
                <Text style={styles.ticketMeta}>{ticket.ownerWalletAddress || ticket.ownerAddress || '미판매'}</Text>
              </View>
              <Text style={styles.badge}>{formatTicketStatus(ticket.status)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function MenuCard({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuText}>{text}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  actions: { marginTop: 6 },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  menuButton: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingVertical: 14 },
  menuCopy: { flex: 1, paddingRight: 12 },
  menuTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  menuText: { marginTop: 4, color: '#64748B', fontSize: 12, lineHeight: 18 },
  chevron: { color: '#94A3B8', fontSize: 26, fontWeight: '300' },
  linkText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  dangerButton: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  dangerButtonText: { color: '#DC2626', fontSize: 16, fontWeight: '900' },
  statusHint: { marginTop: 10, color: '#64748B', fontSize: 12, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  input: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  filterList: { gap: 8, marginTop: 10, paddingBottom: 8 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterChipText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  activeFilterChipText: { color: '#2563EB' },
  sortRow: { flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 4 },
  sortButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeSortButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  sortButtonText: { color: '#475569', fontWeight: '900' },
  activeSortButtonText: { color: '#2563EB' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketInfo: { flex: 1, paddingRight: 10 },
  ticketTitle: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  pageNumberButton: { minWidth: 36, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activePageNumberButton: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  pageNumberText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  activePageNumberText: { color: '#FFFFFF' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
});
