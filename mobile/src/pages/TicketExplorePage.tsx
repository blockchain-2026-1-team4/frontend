import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatTicketStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: 'ALL', label: '전체' },
  { value: 'AVAILABLE', label: '판매 가능' },
  { value: 'LISTED', label: '리셀 중' },
  { value: 'SOLD', label: '판매 완료' },
  { value: 'USED', label: '사용 완료' },
  { value: 'CANCELED', label: '취소' },
] as const;

type SortMode = 'latest' | 'priceAsc' | 'priceDesc' | 'seat';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'priceAsc', label: '가격 낮은순' },
  { value: 'priceDesc', label: '가격 높은순' },
  { value: 'latest', label: '최신 등록순' },
  { value: 'seat', label: '좌석순' },
];

function sectionOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split(/[-\s]/)[0] || 'GENERAL';
}

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.seatInfo);
}

function priceValue(ticket: TicketDetail) {
  try {
    return BigInt(ticket.originalPriceWei ?? ticket.priceWei ?? '0');
  } catch {
    return BigInt(0);
  }
}

export default function TicketExplorePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('전체');
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_FILTERS)[number]['value']>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('latest');

  const load = useCallback(async () => {
    if (!eventId) {
      setLoadError('이벤트 정보가 없어 티켓 발행 현황을 열 수 없습니다.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setLoadError('');
      const [detail, list] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => []),
      ]);
      setEvent(detail);
      setTickets(list);
      setPage(1);
    } catch (error: any) {
      const message = errorMessage(error, '발행된 티켓을 불러오지 못했습니다.');
      setLoadError(message);
      Alert.alert('티켓 탐색 로드 실패', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sold = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(ticket.status)).length;
  const available = tickets.filter((ticket) => ticket.status === 'AVAILABLE').length;
  const listed = tickets.filter((ticket) => ticket.status === 'LISTED').length;
  const sectionFilters = useMemo(() => {
    const sections = Array.from(new Set(tickets.map(sectionOf))).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
    return ['전체', ...sections];
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    const base = tickets.filter((ticket) => {
      const matchesSection = selectedSection === '전체' || sectionOf(ticket) === selectedSection;
      const matchesStatus = selectedStatus === 'ALL' || String(ticket.status).toUpperCase() === selectedStatus;
      const haystack = `${ticket.seatInfo || ''} ${sectionOf(ticket)} ${ticket.ownerWalletAddress || ticket.ownerAddress || ''}`.toUpperCase();
      return matchesSection && matchesStatus && (!normalized || haystack.includes(normalized));
    });
    return [...base].sort((a, b) => {
      if (sortMode === 'priceAsc') return priceValue(a) < priceValue(b) ? -1 : priceValue(a) > priceValue(b) ? 1 : 0;
      if (sortMode === 'priceDesc') return priceValue(a) > priceValue(b) ? -1 : priceValue(a) < priceValue(b) ? 1 : 0;
      if (sortMode === 'seat') return String(a.seatInfo || '').localeCompare(String(b.seatInfo || ''), 'ko-KR', { numeric: true });
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [query, selectedSection, selectedStatus, sortMode, tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTickets = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (loadError && !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>티켓 발행 현황을 열 수 없습니다.</Text>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('MyEvents')}>
          <Text style={styles.primaryButtonText}>이벤트 목록으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={pagedTickets}
      keyExtractor={ticketId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={(
        <>
          <TouchableOpacity style={styles.backButton} onPress={() => eventId ? navigation.navigate('OrganizerEventDetail', { eventId }) : navigation.navigate('MyEvents')}>
            <Text style={styles.backButtonText}>이벤트 상세로 돌아가기</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>Ticket Explore</Text>
          <Text style={styles.title}>전체 발행 티켓 보기</Text>
          <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'}의 가격, 판매 여부, 소유자, 리셀 상태를 확인합니다.</Text>
          <View style={styles.metricGrid}>
            <Metric label="판매 완료" value={sold} />
            <Metric label="판매 가능" value={available} />
            <Metric label="리셀 중" value={listed} />
          </View>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="좌석, 구역, 소유자 검색"
            autoCapitalize="characters"
            returnKeyType="search"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
            {sectionFilters.map((section) => (
              <TouchableOpacity key={section} style={[styles.filterChip, selectedSection === section && styles.activeFilterChip]} onPress={() => { setSelectedSection(section); setPage(1); }}>
                <Text style={[styles.filterChipText, selectedSection === section && styles.activeFilterChipText]}>{section}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
            {STATUS_FILTERS.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.filterChip, selectedStatus === item.value && styles.activeFilterChip]} onPress={() => { setSelectedStatus(item.value); setPage(1); }}>
                <Text style={[styles.filterChipText, selectedStatus === item.value && styles.activeFilterChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.sortButton, sortMode === item.value && styles.activeSortButton]} onPress={() => { setSortMode(item.value); setPage(1); }}>
                <Text style={[styles.sortButtonText, sortMode === item.value && styles.activeSortButtonText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>검색 결과</Text>
            <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
          </View>
        </>
      )}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{item.seatInfo || '-'}</Text>
            <Text style={styles.rowMeta}>구역 {sectionOf(item)} · 가격 {weiToEth(item.originalPriceWei || item.priceWei)}</Text>
            <Text style={styles.rowMeta}>소유자 {item.ownerWalletAddress || item.ownerAddress || '미판매'}</Text>
            <Text style={styles.rowMeta}>리셀 {item.resaleEnabled ? `허용 · 상한 ${(item.resaleCapRate ?? 10000) / 100}%` : '비허용'}</Text>
          </View>
          <Text style={styles.badge}>{formatTicketStatus(item.status)}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>조건에 맞는 티켓이 없습니다.</Text>}
      ListFooterComponent={filteredTickets.length > PAGE_SIZE ? (
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
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: '#94A3B8', paddingVertical: 48, textAlign: 'center' },
  errorText: { marginTop: 8, color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  backButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 14 },
  backButtonText: { color: '#2563EB', fontWeight: '900' },
  primaryButton: { marginTop: 14, backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  input: { marginTop: 14, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  filterList: { gap: 8, marginTop: 10, paddingBottom: 8 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterChipText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  activeFilterChipText: { color: '#2563EB' },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2, marginBottom: 10 },
  sortButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeSortButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  sortButtonText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  activeSortButtonText: { color: '#2563EB' },
  sectionHead: { marginTop: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  pageText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  rowInfo: { flex: 1, paddingRight: 10 },
  rowTitle: { color: '#0F172A', fontWeight: '900' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
