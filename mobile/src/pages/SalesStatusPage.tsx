import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const STATUS_FILTERS = [
  { value: 'ALL', label: '전체' },
  { value: 'AVAILABLE', label: '예매 가능' },
  { value: 'LISTED', label: '판매중' },
  { value: 'SOLD', label: '판매완료' },
  { value: 'USED', label: '사용완료' },
  { value: 'CANCELED', label: '취소됨' },
] as const;

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

export default function SalesStatusPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSeatSection, setSelectedSeatSection] = useState('전체');
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_FILTERS)[number]['value']>('ALL');
  const [sortMode, setSortMode] = useState<'latest' | 'seat'>('latest');

  const load = useCallback(async () => {
    try {
      const [detail, list] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => []),
      ]);
      setEvent(detail);
      setTickets(list);
    } catch (error: any) {
      Alert.alert('판매 현황 로드 실패', errorMessage(error, '판매 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sold = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(ticket.status)).length;
  const used = tickets.filter((ticket) => ticket.status === 'USED').length;
  const available = tickets.filter((ticket) => ticket.status === 'AVAILABLE').length;
  const seatFilters = useMemo(() => {
    const sections = Array.from(new Set(tickets.map((ticket) => seatSectionOf(ticket.seatInfo)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'ko-KR', { numeric: true }),
    );
    return ['전체', ...sections];
  }, [tickets]);

  const previewTickets = useMemo(() => {
    const base = tickets.filter((ticket) => {
      const matchesSection = selectedSeatSection === '전체' || seatSectionOf(ticket.seatInfo) === selectedSeatSection;
      const matchesStatus = selectedStatus === 'ALL' || String(ticket.status).toUpperCase() === selectedStatus;
      return matchesSection && matchesStatus;
    });
    return [...base].sort((a, b) => {
      if (sortMode === 'seat') return String(a.seatInfo || '').localeCompare(String(b.seatInfo || ''), 'ko-KR', { numeric: true });
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    }).slice(0, 5);
  }, [selectedSeatSection, selectedStatus, sortMode, tickets]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Sales Status</Text>
      <Text style={styles.title}>판매 현황</Text>
      <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'} · {weiToEth(event?.ticketPriceWei)}</Text>
      <View style={styles.metricGrid}>
        <Metric label="판매 완료 티켓" value={sold} />
        <Metric label="잔여 좌석" value={available} />
        <Metric label="사용 완료 티켓" value={used} />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>최근 티켓 미리보기</Text>
          <TouchableOpacity onPress={() => navigation?.navigate?.('TicketExplore', { eventId })}>
            <Text style={styles.linkText}>전체 티켓 탐색</Text>
          </TouchableOpacity>
        </View>
        {previewTickets.length === 0 ? (
          <Text style={styles.emptyText}>최근 발행된 티켓이 없습니다.</Text>
        ) : (
          previewTickets.map((item) => (
            <View key={ticketId(item)} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{item.seatInfo || '-'}</Text>
                <Text style={styles.rowMeta}>{item.ownerWalletAddress || item.ownerAddress || '미판매'}</Text>
              </View>
              <Text style={styles.badge}>{formatTicketStatus(item.status)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  sectionHead: { marginTop: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  linkText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  filterList: { gap: 8, marginTop: 10, paddingBottom: 8 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterChipText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  activeFilterChipText: { color: '#2563EB' },
  sortRow: { flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 10 },
  sortButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeSortButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  sortButtonText: { color: '#475569', fontWeight: '900' },
  activeSortButtonText: { color: '#2563EB' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowInfo: { flex: 1, paddingRight: 10 },
  rowTitle: { color: '#0F172A', fontWeight: '900' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 48, textAlign: 'center' },
});
