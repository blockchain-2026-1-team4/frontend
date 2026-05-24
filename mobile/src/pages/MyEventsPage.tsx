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
import { formatEventRange, formatSalesStatus } from '../lib/ticketDisplay';
import type { EventSummary } from '../types/api';

const PAGE_SIZE = 8;
const EXPIRED_STATUSES = new Set(['ENDED', 'CANCELED', 'CANCELLED']);

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

function categoryLabel(category?: string) {
  const labels: Record<string, string> = {
    CONCERT: '공연',
    SPORTS: '스포츠',
    EXHIBITION: '전시',
    FESTIVAL: '페스티벌',
    ETC: '기타',
  };
  return labels[String(category ?? '').toUpperCase()] ?? category ?? '-';
}

function eventStart(event: EventSummary) {
  return event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || '';
}

function eventEnd(event: EventSummary) {
  return event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || '';
}

function saleStart(event: EventSummary) {
  return event.salesStartAt || event.primarySaleStart || '';
}

function saleEnd(event: EventSummary) {
  return event.salesEndAt || event.primarySaleEnd || '';
}

function isExpired(event: EventSummary) {
  const status = String(event.status ?? '').toUpperCase();
  const end = new Date(eventEnd(event)).getTime();
  return EXPIRED_STATUSES.has(status) || (!Number.isNaN(end) && end < Date.now());
}

export default function MyEventsPage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [showExpired, setShowExpired] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const data = await backendApi.getMyEvents({ page: 0, size: 100 });
      setEvents(data.items ?? []);
      setPage(1);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '내 이벤트를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events
      .filter((event) => showExpired || !isExpired(event))
      .filter((event) => {
        const haystack = `${eventTitle(event)} ${event.venue || ''} ${categoryLabel(event.category)}`.toLowerCase();
        return !normalized || haystack.includes(normalized);
      })
      .sort((a, b) => {
        const aTime = new Date(eventStart(a)).getTime();
        const bTime = new Date(eventStart(b)).getTime();
        return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
      });
  }, [events, query, showExpired]);

  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEvents = visibleEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>My Events</Text>
          <Text style={styles.title}>이벤트 관리</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('EventCreate')}>
          <Text style={styles.addButtonText}>등록</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={pagedEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListHeaderComponent={(
          <>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="이벤트명, 장소, 카테고리 검색"
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.expiredButton} onPress={() => { setShowExpired((value) => !value); setPage(1); }}>
              <Text style={styles.expiredButtonText}>{showExpired ? '진행/예정 이벤트만 보기' : '지난 이벤트 보기'}</Text>
            </TouchableOpacity>
            <View style={styles.pageHead}>
              <Text style={styles.pageHint}>결과 {visibleEvents.length}건</Text>
              <Text style={styles.pageHint}>{currentPage} / {totalPages}</Text>
            </View>
          </>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: item.id })}>
            <View style={styles.cardHead}>
              <Text style={styles.category}>{categoryLabel(item.category)}</Text>
              <Text style={styles.salesBadge}>{formatSalesStatus(saleStart(item), saleEnd(item))}</Text>
            </View>
            <Text style={styles.eventTitle}>{eventTitle(item)}</Text>
            <Text style={styles.eventMeta}>장소 {item.venue || '-'}</Text>
            <Text style={styles.eventMeta}>이벤트 기간 {formatEventRange(eventStart(item), eventEnd(item))}</Text>
            <Text style={styles.eventMeta}>판매 기간 {formatEventRange(saleStart(item), saleEnd(item))}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>표시할 이벤트가 없습니다.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('EventCreate')}>
              <Text style={styles.primaryButtonText}>이벤트 등록</Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={visibleEvents.length > PAGE_SIZE ? (
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
  addButton: { backgroundColor: '#2563EB', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
  addButtonText: { color: '#FFFFFF', fontWeight: '900' },
  list: { padding: 18, paddingTop: 8, paddingBottom: 96 },
  searchInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A', marginBottom: 10 },
  expiredButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 10 },
  expiredButtonText: { color: '#2563EB', fontWeight: '900', fontSize: 13 },
  pageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pageHint: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  category: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  salesBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  eventTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  eventMeta: { marginTop: 4, color: '#64748B', fontSize: 12, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 13, paddingHorizontal: 18, marginTop: 18 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
