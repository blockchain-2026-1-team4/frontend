import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate } from '../lib/ticketDisplay';
import type { CheckInRecord, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;
const MAX_VISIBLE_PAGES = 4;
const RESULT_FILTERS = [
  { value: 'ALL', label: '전체' },
  { value: 'SUCCESS', label: '입장 완료' },
  { value: 'FAILED', label: '입장 실패' },
  { value: 'PENDING', label: '확인 필요' },
] as const;
const SORT_MODES = [
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
] as const;

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? '');
}

function resultLabel(record: CheckInRecord) {
  const value = String(record.result ?? record.status ?? '').toUpperCase();
  if (value === 'SUCCESS') return '입장 완료';
  if (value === 'FAILED') return '입장 실패';
  return value || '확인 필요';
}

export default function CheckInStatusPage({ route }: any) {
  const eventId = route?.params?.eventId as string;
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<(typeof RESULT_FILTERS)[number]['value']>('ALL');
  const [sortMode, setSortMode] = useState<(typeof SORT_MODES)[number]['value']>('latest');
  const [showSortOptions, setShowSortOptions] = useState(false);

  const load = useCallback(async () => {
    try {
      const eventTickets = await backendApi.getEventTickets(eventId).catch(() => []);
      const histories = await Promise.all(eventTickets.map((ticket) => backendApi.getTicketCheckIns(ticketId(ticket)).catch(() => [])));
      setTickets(eventTickets);
      setRecords(histories.flat());
      setPage(1);
    } catch (error: any) {
      Alert.alert('체크인 현황 로드 실패', errorMessage(error, '체크인 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const used = tickets.filter((ticket) => ticket.status === 'USED').length;
  const success = records.filter((record) => record.result === 'SUCCESS' || record.status === 'SUCCESS').length;
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = records.filter((record) => {
      const ticketMatch = String(record.ticketId || '').toLowerCase();
      const memoMatch = String(record.memo || '').toLowerCase();
      const haystack = `${ticketMatch} ${memoMatch}`;
      const matchesQuery = !normalized || haystack.includes(normalized);
      const resultKey = String(record.result || record.status || '').toUpperCase();
      const matchesResult = selectedResult === 'ALL' || resultKey === selectedResult || (selectedResult === 'PENDING' && !record.result && !record.status);
      return matchesQuery && matchesResult;
    });

    return [...base].sort((a, b) => {
      const aTime = new Date(a.checkedInAt || a.createdAt || '').getTime();
      const bTime = new Date(b.checkedInAt || b.createdAt || '').getTime();
      return sortMode === 'latest'
        ? (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
        : (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
    });
  }, [query, records, selectedResult, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRecords = useMemo(() => filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [currentPage, filteredRecords]);
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
      data={pagedRecords}
      keyExtractor={(item, index) => String(item.id ?? `${item.ticketId}-${item.checkedInAt}-${index}`)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={
        <>
          <Text style={styles.eyebrow}>Check-in Status</Text>
          <Text style={styles.title}>체크인 현황</Text>
          <View style={styles.metricGrid}>
            <Metric label="체크인 완료 티켓" value={used} />
            <Metric label="입장 성공 기록" value={success} />
            <Metric label="총 입장 처리 기록" value={records.length} />
          </View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>입장 처리 기록</Text>
            <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="티켓 ID, 메모 검색"
            returnKeyType="search"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
            {RESULT_FILTERS.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.filterChip, selectedResult === item.value && styles.activeFilterChip]}
                onPress={() => {
                  setSelectedResult(item.value);
                  setPage(1);
                }}
              >
                <Text style={[styles.filterChipText, selectedResult === item.value && styles.activeFilterChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
            <Text style={styles.pageHint}>검색된 입장 처리 기록 {filteredRecords.length}건</Text>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{resultLabel(item)}</Text>
          <Text style={styles.rowMeta}>{formatEventDate(item.checkedInAt || item.createdAt)} · 티켓 {item.ticketId}</Text>
          {item.memo ? <Text style={styles.rowMemo}>{item.memo}</Text> : null}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>조건에 맞는 입장 처리 기록이 없습니다.</Text>}
      ListFooterComponent={
        filteredRecords.length > PAGE_SIZE ? (
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
  moreFilterButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 10 },
  moreFilterText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  sortRow: { flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 10 },
  sortChip: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeSortChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  sortChipText: { color: '#475569', fontWeight: '900' },
  activeSortChipText: { color: '#2563EB' },
  pageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pageHint: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  rowTitle: { color: '#0F172A', fontWeight: '900' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  rowMemo: { marginTop: 8, color: '#334155', fontSize: 13, lineHeight: 18 },
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
