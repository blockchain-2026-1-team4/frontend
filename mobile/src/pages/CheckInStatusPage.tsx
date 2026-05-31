import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, ScrollView as HScroll } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate } from '../lib/ticketDisplay';
import type { CheckInRecord, TicketDetail } from '../types/api';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="m21 21-4.35-4.35" />
    </Svg>
  );
}

const PAGE_SIZE = 20;
const MAX_VISIBLE_PAGES = 4;
const RESULT_FILTERS = [
  { value: 'ALL', label: '전체' },
  { value: 'SUCCESS', label: '입장 완료' },
  { value: 'FAILED', label: '입장 실패' },
  { value: 'PENDING', label: '수동 확인' },
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
  return value || '수동 확인';
}

function resultStyle(record: CheckInRecord): { bg: string; text: string } {
  const value = String(record.result ?? record.status ?? '').toUpperCase();
  if (value === 'SUCCESS') return { bg: '#E1F5EE', text: '#0F6E56' };
  if (value === 'FAILED') return { bg: '#FEE2E2', text: '#B91C1C' };
  return { bg: '#FAEEDA', text: '#854F0B' };
}

export default function CheckInStatusPage({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
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

  const success = records.filter((record) => record.result === 'SUCCESS' || record.status === 'SUCCESS').length;
  const failure = records.filter((record) => String(record.result ?? record.status ?? '').toUpperCase() === 'FAILED').length;
  const manualReview = records.filter((record) => {
    const value = String(record.result ?? record.status ?? '').toUpperCase();
    return value === 'PENDING' || !value;
  }).length;

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = records.filter((record) => {
      const ticketMatch = String(record.ticketId || '').toLowerCase();
      const memoMatch = String(record.memo || '').toLowerCase();
      const matchesQuery = !normalized || `${ticketMatch} ${memoMatch}`.includes(normalized);
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

  const hasActiveFilters = Boolean(query.trim()) || selectedResult !== 'ALL';
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRecords = useMemo(() => filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [currentPage, filteredRecords]);
  const pageNumbers = useMemo(() => {
    const half = Math.floor(MAX_VISIBLE_PAGES / 2);
    const start = Math.max(1, Math.min(currentPage - half, totalPages - MAX_VISIBLE_PAGES + 1));
    const end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('OrganizerDashboard');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}>
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>CHECK-IN STATUS</Text>
        <Text style={styles.heroTitle}>체크인 현황</Text>
        <Text style={styles.heroSub}>입장 처리 결과와 확인이 필요한 기록을 관리합니다.</Text>
        <View style={styles.heroChip}>
          <View style={styles.heroDot} />
          <Text style={styles.heroChipText}>총 {records.length}건 · 완료 {success}건 · 실패 {failure}건</Text>
        </View>
      </HeroGradient>

      <View style={styles.metricGrid}>
        <MetricCard label="입장 완료" value={success} bg="#E1F5EE" color="#0F6E56" />
        <MetricCard label="입장 실패" value={failure} bg="#FEE2E2" color="#B91C1C" />
        <MetricCard label="수동 확인" value={manualReview} bg="#FAEEDA" color="#854F0B" />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(value) => { setQuery(value); setPage(1); }}
            placeholder="티켓 ID 또는 메모 검색"
            returnKeyType="search"
          />
        </View>
      </View>

      <HScroll horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {RESULT_FILTERS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.filterTab, selectedResult === item.value && styles.filterTabActive]}
            onPress={() => { setSelectedResult(item.value); setPage(1); }}
          >
            <Text style={[styles.filterTabText, selectedResult === item.value && styles.filterTabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </HScroll>

      <View style={styles.toolbarRow}>
        <Text style={styles.resultHint}>결과 {filteredRecords.length}건</Text>
        <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortOptions((v) => !v)}>
          <Text style={styles.sortButtonText}>{SORT_MODES.find((item) => item.value === sortMode)?.label ?? '최신순'} ▾</Text>
        </TouchableOpacity>
      </View>

      {showSortOptions ? (
        <View style={styles.sortSheet}>
          {SORT_MODES.map((item) => (
            <TouchableOpacity key={item.value} style={[styles.sortSheetItem, sortMode === item.value && styles.activeSortSheetItem]} onPress={() => { setSortMode(item.value); setPage(1); setShowSortOptions(false); }}>
              <Text style={[styles.sortSheetItemText, sortMode === item.value && styles.activeSortSheetItemText]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.listHead}>
        <Text style={styles.listTitle}>입장 처리 기록</Text>
        {filteredRecords.length > PAGE_SIZE && <Text style={styles.resultHint}>{currentPage} / {totalPages}</Text>}
      </View>

      {pagedRecords.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{records.length === 0 && !hasActiveFilters ? '아직 입장 처리 기록이 없습니다.' : '검색 조건에 맞는 기록이 없습니다.'}</Text>
        </View>
      ) : (
        pagedRecords.map((item, index) => {
          const rs = resultStyle(item);
          return (
            <View key={String(item.id ?? `${item.ticketId}-${item.checkedInAt}-${index}`)} style={styles.row}>
              <View style={styles.rowHead}>
                <View style={[styles.resultBadge, { backgroundColor: rs.bg }]}>
                  <Text style={[styles.resultBadgeText, { color: rs.text }]}>{resultLabel(item)}</Text>
                </View>
                <Text style={styles.rowMeta}>{formatEventDate(item.checkedInAt || item.createdAt)}</Text>
              </View>
              <Text style={styles.rowTicket}>티켓 {item.ticketId}</Text>
              {item.memo ? <Text style={styles.rowMemo}>{item.memo}</Text> : null}
            </View>
          );
        })
      )}

      {filteredRecords.length > PAGE_SIZE && (
        <View style={styles.pagination}>
          <TouchableOpacity style={[styles.pageButton, currentPage === 1 && styles.disabledButton]} disabled={currentPage === 1} onPress={() => setPage((v) => Math.max(v - 1, 1))}>
            <Text style={styles.pageButtonText}>이전</Text>
          </TouchableOpacity>
          {pageNumbers.map((pageNumber) => (
            <TouchableOpacity key={pageNumber} style={[styles.pageNumberButton, currentPage === pageNumber && styles.activePageNumberButton]} onPress={() => setPage(pageNumber)}>
              <Text style={[styles.pageNumberText, currentPage === pageNumber && styles.activePageNumberText]}>{pageNumber}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.pageButton, currentPage >= totalPages && styles.disabledButton]} disabled={currentPage >= totalPages} onPress={() => setPage((v) => Math.min(v + 1, totalPages))}>
            <Text style={styles.pageButtonText}>다음</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function MetricCard({ label, value, bg, color }: { label: string; value: number; bg: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: bg }]}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
      <Text style={[styles.metricValue, { color }]}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  metricGrid: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, marginTop: -14, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#E5E7EB', paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  metricIconBox: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  metricValue: { fontSize: 18, fontWeight: '800', lineHeight: 20 },
  metricLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  searchSection: { paddingHorizontal: 16, marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: '#1A1A2E', fontSize: 13 },
  filterScroll: { marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 0 },
  filterTab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB', flexShrink: 0 },
  filterTabActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterTabText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  filterTabTextActive: { color: '#FFFFFF' },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  resultHint: { fontSize: 11, color: '#9CA3AF', fontWeight: '700' },
  sortButton: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#FFFFFF' },
  sortButtonText: { color: '#534AB7', fontWeight: '800', fontSize: 12 },
  sortSheet: { marginHorizontal: 16, marginBottom: 10, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  sortSheetItem: { paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  activeSortSheetItem: { backgroundColor: '#EEEDFE' },
  sortSheetItemText: { color: '#6B7280', fontWeight: '700', fontSize: 13 },
  activeSortSheetItemText: { color: '#534AB7' },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  listTitle: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, marginBottom: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  resultBadgeText: { fontSize: 11, fontWeight: '800' },
  rowTicket: { color: '#6B7280', fontSize: 11, fontWeight: '700' },
  rowMeta: { color: '#9CA3AF', fontSize: 11 },
  rowMemo: { marginTop: 6, color: '#1A1A2E', fontSize: 12, lineHeight: 17 },
  emptyBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 13 },
  pagination: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  pageButton: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  pageButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  pageNumberButton: { minWidth: 36, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activePageNumberButton: { borderColor: '#534AB7', backgroundColor: '#534AB7' },
  pageNumberText: { color: '#6B7280', fontWeight: '800', fontSize: 12 },
  activePageNumberText: { color: '#FFFFFF' },
  disabledButton: { opacity: 0.35 },
});
