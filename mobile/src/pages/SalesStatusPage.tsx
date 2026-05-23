import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;
const MAX_VISIBLE_PAGES = 4;
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

export default function SalesStatusPage({ route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [seatQuery, setSeatQuery] = useState('');
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
      setPage(1);
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

  const filteredTickets = useMemo(() => {
    const query = seatQuery.trim().toUpperCase();
    const base = tickets.filter((ticket) => {
      const seatInfo = String(ticket.seatInfo || '').toUpperCase();
      const matchesSection = selectedSeatSection === '전체' || seatSectionOf(ticket.seatInfo) === selectedSeatSection;
      const matchesStatus = selectedStatus === 'ALL' || String(ticket.status).toUpperCase() === selectedStatus;
      const matchesQuery = !query || seatInfo.includes(query);
      return matchesSection && matchesStatus && matchesQuery;
    });
    return [...base].sort((a, b) => {
      if (sortMode === 'seat') return String(a.seatInfo || '').localeCompare(String(b.seatInfo || ''), 'ko-KR', { numeric: true });
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [seatQuery, selectedSeatSection, selectedStatus, sortMode, tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={pagedTickets}
      keyExtractor={ticketId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={
        <>
          <Text style={styles.eyebrow}>Sales Status</Text>
          <Text style={styles.title}>판매 현황</Text>
          <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'} · {weiToEth(event?.ticketPriceWei)}</Text>
          <View style={styles.metricGrid}>
            <Metric label="판매 완료 티켓" value={sold} />
            <Metric label="잔여 좌석" value={available} />
            <Metric label="사용 완료 티켓" value={used} />
          </View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>티켓별 상태</Text>
            <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={seatQuery}
            onChangeText={(value) => {
              setSeatQuery(value);
              setPage(1);
            }}
            placeholder="좌석 검색: VIP-12, A-103"
            autoCapitalize="characters"
            returnKeyType="search"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
            {seatFilters.map((section) => (
              <TouchableOpacity
                key={section}
                style={[styles.filterChip, selectedSeatSection === section && styles.activeFilterChip]}
                onPress={() => {
                  setSelectedSeatSection(section);
                  setPage(1);
                }}
              >
                <Text style={[styles.filterChipText, selectedSeatSection === section && styles.activeFilterChipText]}>{section}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
            {STATUS_FILTERS.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.filterChip, selectedStatus === item.value && styles.activeFilterChip]}
                onPress={() => {
                  setSelectedStatus(item.value);
                  setPage(1);
                }}
              >
                <Text style={[styles.filterChipText, selectedStatus === item.value && styles.activeFilterChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.sortRow}>
            <TouchableOpacity style={[styles.sortButton, sortMode === 'latest' && styles.activeSortButton]} onPress={() => setSortMode('latest')}>
              <Text style={[styles.sortButtonText, sortMode === 'latest' && styles.activeSortButtonText]}>최신순</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortButton, sortMode === 'seat' && styles.activeSortButton]} onPress={() => setSortMode('seat')}>
              <Text style={[styles.sortButtonText, sortMode === 'seat' && styles.activeSortButtonText]}>좌석순</Text>
            </TouchableOpacity>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{item.seatInfo || '-'}</Text>
            <Text style={styles.rowMeta}>{item.ownerWalletAddress || item.ownerAddress || '미판매'}</Text>
          </View>
          <Text style={styles.badge}>{formatTicketStatus(item.status)}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>조건에 맞는 티켓이 없습니다.</Text>}
      ListFooterComponent={
        filteredTickets.length > PAGE_SIZE ? (
          <View style={styles.pagination}>
            <TouchableOpacity style={[styles.pageButton, currentPage === 1 && styles.disabledButton]} disabled={currentPage === 1} onPress={() => setPage((value) => Math.max(value - 1, 1))}>
              <Text style={styles.pageButtonText}>이전</Text>
            </TouchableOpacity>
            {pageNumbers.map((pageNumber) => (
              <TouchableOpacity key={pageNumber} style={[styles.pageNumberButton, currentPage === pageNumber && styles.activePageNumberButton]} onPress={() => setPage(pageNumber)}>
                <Text style={[styles.pageNumberText, currentPage === pageNumber && styles.activePageNumberText]}>{pageNumber}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.pageButton, currentPage >= totalPages && styles.disabledButton]} disabled={currentPage >= totalPages} onPress={() => setPage((value) => Math.min(value + 1, totalPages))}>
              <Text style={styles.pageButtonText}>다음</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
    />
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
  pageText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
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
  pagination: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  pageNumberButton: { minWidth: 36, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activePageNumberButton: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  pageNumberText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  activePageNumberText: { color: '#FFFFFF' },
  disabledButton: { opacity: 0.55 },
  emptyText: { color: '#94A3B8', paddingVertical: 48, textAlign: 'center' },
});
