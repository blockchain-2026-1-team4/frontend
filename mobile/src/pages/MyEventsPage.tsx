import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventStatus } from '../lib/ticketDisplay';
import type { EventSummary } from '../types/api';

const STATUS_FILTERS = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '운영중' },
  { value: 'INACTIVE', label: '운영중지' },
  { value: 'CANCELED', label: '취소됨' },
] as const;

const SORT_MODES = [
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
] as const;

const PAGE_SIZE = 8;
const MAX_VISIBLE_PAGES = 4;

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

function eventDate(event: EventSummary) {
  const value = event.eventAt || event.eventDateTime;
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

function sortCanceledLast<T extends { status?: string; eventAt?: string; eventDateTime?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.status === 'CANCELED' && b.status !== 'CANCELED') return 1;
    if (a.status !== 'CANCELED' && b.status === 'CANCELED') return -1;
    const aTime = new Date(a.eventAt || a.eventDateTime || '').getTime();
    const bTime = new Date(b.eventAt || b.eventDateTime || '').getTime();
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

export default function MyEventsPage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('ALL');
  const [sortMode, setSortMode] = useState<(typeof SORT_MODES)[number]['value']>('latest');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showSortOptions, setShowSortOptions] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await backendApi.getMyEvents({ page: 0, size: 100 });
      setEvents(sortCanceledLast(data.items ?? []));
      setPage(1);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '내 이벤트를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = events.filter((event) => {
      const matchesStatus = statusFilter === 'ALL' || event.status === statusFilter;
      const haystack = `${eventTitle(event)} ${event.venue || ''} ${event.description || ''}`.toLowerCase();
      const matchesQuery = !normalized || haystack.includes(normalized);
      return matchesStatus && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.eventAt || a.eventDateTime || '').getTime();
      const bTime = new Date(b.eventAt || b.eventDateTime || '').getTime();
      return sortMode === 'latest'
        ? (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
        : (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
    });
  }, [events, query, sortMode, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEvents = useMemo(() => visibleEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [currentPage, visibleEvents]);
  const pageNumbers = useMemo(() => {
    const half = Math.floor(MAX_VISIBLE_PAGES / 2);
    const start = Math.max(1, Math.min(currentPage - half, totalPages - MAX_VISIBLE_PAGES + 1));
    const end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const renderItem = ({ item }: { item: EventSummary }) => {
    const sold = item.soldTicketCount ?? 0;
    const total = item.totalTicketCount ?? 0;
    const remaining = item.remainingTicketCount ?? Math.max(total - sold, 0);

    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: item.id })}>
        <View style={styles.cardHead}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.eventTitle}>{eventTitle(item)}</Text>
            <Text style={styles.eventMeta}>장소 {item.venue || '-'}</Text>
            <Text style={styles.eventMeta}>일시 {eventDate(item)}</Text>
          </View>
          <Text style={styles.statusBadge}>{formatEventStatus(item.status)}</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>판매 완료 티켓</Text>
            <Text style={styles.statValue}>{sold}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>잔여 좌석</Text>
            <Text style={styles.statValue}>{remaining}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>총 발행 티켓</Text>
            <Text style={styles.statValue}>{total || '-'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && events.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>내 이벤트를 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>My Events</Text>
          <Text style={styles.title}>내 이벤트</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('EventCreate')}>
          <Text style={styles.addButtonText}>새 이벤트 등록</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={pagedEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="이벤트명, 장소 검색"
              returnKeyType="search"
            />
            <ScrollFilter
              current={statusFilter}
              onSelect={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
            <TouchableOpacity style={styles.moreFilterButton} onPress={() => setShowSortOptions((value) => !value)}>
              <Text style={styles.moreFilterText}>{showSortOptions ? '정렬 옵션 접기' : '정렬 옵션'}</Text>
            </TouchableOpacity>
            {showSortOptions ? (
              <View style={styles.sortRow}>
                {SORT_MODES.map((item) => (
                  <TouchableOpacity key={item.value} style={[styles.sortChip, sortMode === item.value && styles.activeSortChip]} onPress={() => { setSortMode(item.value); setPage(1); }}>
                    <Text style={[styles.sortChipText, sortMode === item.value && styles.activeSortChipText]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <View style={styles.pageHead}>
              <Text style={styles.pageHint}>검색 결과 {visibleEvents.length}건</Text>
              <Text style={styles.pageHint}>{currentPage} / {totalPages}</Text>
            </View>
          </>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{events.length === 0 ? '등록한 이벤트가 없습니다.' : '조건에 맞는 이벤트가 없습니다.'}</Text>
            <Text style={styles.emptyText}>{events.length === 0 ? '첫 이벤트를 등록해 판매를 시작하세요.' : '상태 필터를 변경해 확인해보세요.'}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('EventCreate')}>
              <Text style={styles.primaryButtonText}>이벤트 등록</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          visibleEvents.length > PAGE_SIZE ? (
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
    </View>
  );
}

function ScrollFilter({ current, onSelect }: { current: (typeof STATUS_FILTERS)[number]['value']; onSelect: (value: (typeof STATUS_FILTERS)[number]['value']) => void }) {
  return (
    <View style={styles.filterRow}>
      {STATUS_FILTERS.map((item) => (
        <TouchableOpacity key={item.value} style={[styles.filterChip, current === item.value && styles.activeFilterChip]} onPress={() => onSelect(item.value)}>
          <Text style={[styles.filterChipText, current === item.value && styles.activeFilterChipText]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  header: { padding: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  addButton: { backgroundColor: '#2563EB', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontWeight: '900' },
  list: { padding: 18, paddingTop: 8, paddingBottom: 32 },
  searchInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A', marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterChipText: { color: '#475569', fontSize: 12, fontWeight: '800' },
  activeFilterChipText: { color: '#2563EB' },
  moreFilterButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 10 },
  moreFilterText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  sortChip: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeSortChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  sortChipText: { color: '#475569', fontWeight: '900' },
  activeSortChipText: { color: '#2563EB' },
  pageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pageHint: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1 },
  eventTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  eventMeta: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 18 },
  statusBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statItem: { flex: 1, borderRadius: 12, backgroundColor: '#F8FAFC', padding: 10 },
  statLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  statValue: { marginTop: 4, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 8, color: '#64748B' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, marginTop: 18 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  pageNumberButton: { minWidth: 36, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activePageNumberButton: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  pageNumberText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  activePageNumberText: { color: '#FFFFFF' },
  disabledButton: { opacity: 0.55 },
});
