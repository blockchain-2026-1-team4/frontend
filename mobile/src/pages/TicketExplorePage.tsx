import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatCompactDateTime, getTicketDisplayStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventRound, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: 'ALL',       label: '전체' },
  { value: 'AVAILABLE', label: '판매 가능' },
  { value: 'SOLD',      label: '구매 완료' },
  { value: 'LISTED',    label: '리셀 판매중' },
  { value: 'USED',      label: '체크인 완료' },
  { value: 'CANCELLED', label: '취소' },
] as const;

type SortMode = 'latest' | 'seat' | 'priceAsc' | 'priceDesc';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'latest', label: '최신순' },
  { value: 'seat', label: '좌석순' },
  { value: 'priceAsc', label: '가격 낮은순' },
  { value: 'priceDesc', label: '가격 높은순' },
];

function sectionOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split(/[-\s]/)[0] || 'GENERAL';
}

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.seatInfo);
}

function comparePrice(a: TicketDetail, b: TicketDetail): number {
  const toInt = (t: TicketDetail) => String(t.originalPriceWei ?? t.priceWei ?? '0').split('.')[0] || '0';
  const rawA = toInt(a);
  const rawB = toInt(b);
  const len = Math.max(rawA.length, rawB.length);
  const pa = rawA.padStart(len, '0');
  const pb = rawB.padStart(len, '0');
  return pa < pb ? -1 : pa > pb ? 1 : 0;
}

function roundLabel(round: EventRound, index: number) {
  const dateTime = `${round.eventDate}T${String(round.startTime).slice(0, 5)}:00`;
  return `${index + 1}회차 · ${formatCompactDateTime(dateTime)}`;
}

function ticketRoundLabel(ticket: TicketDetail, event?: EventDetail | null) {
  const index = event?.rounds?.findIndex((round) => round.id && round.id === ticket.eventRoundId) ?? -1;
  return index >= 0 ? `${index + 1}회차` : '회차 미지정';
}

export default function TicketExplorePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRound, setSelectedRound] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_FILTERS)[number]['value']>('ALL');
  const [resaleFilter, setResaleFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('latest');

  const load = useCallback(async () => {
    if (!eventId) {
      setLoadError('이벤트 정보가 없어 전체 티켓 탐색을 열 수 없습니다.');
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
      const message = errorMessage(error, '티켓 목록을 불러오지 못했습니다.');
      setLoadError(message);
      Alert.alert('전체 티켓 탐색 로드 실패', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sold = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
  const available = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'AVAILABLE').length;
  const listed = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'LISTED').length;
  const sectionFilters = useMemo(() => {
    const sections = Array.from(new Set(tickets.map(sectionOf))).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
    return ['ALL', ...sections];
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const base = tickets.filter((ticket) => {
      const matchesRound = selectedRound === 'ALL' || ticket.eventRoundId === selectedRound;
      const matchesSection = selectedSection === 'ALL' || sectionOf(ticket) === selectedSection;
      const matchesStatus = selectedStatus === 'ALL' || String(ticket.status).toUpperCase() === selectedStatus;
      const matchesResale =
        resaleFilter === 'ALL' ||
        (resaleFilter === 'ENABLED' && ticket.resaleEnabled) ||
        (resaleFilter === 'DISABLED' && !ticket.resaleEnabled);
      return matchesRound && matchesSection && matchesStatus && matchesResale;
    });
    return [...base].sort((a, b) => {
      if (sortMode === 'priceAsc') return comparePrice(a, b);
      if (sortMode === 'priceDesc') return comparePrice(b, a);
      if (sortMode === 'seat') return String(a.seatInfo || '').localeCompare(String(b.seatInfo || ''), 'ko-KR', { numeric: true });
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [resaleFilter, selectedRound, selectedSection, selectedStatus, sortMode, tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTickets = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;

  if (loadError && !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>전체 티켓 탐색을 열 수 없습니다.</Text>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('MyEvents')}>
          <Text style={styles.primaryButtonText}>내 이벤트로 돌아가기</Text>
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
          <Text style={styles.eyebrow}>Ticket Explorer</Text>
          <Text style={styles.title}>전체 티켓 탐색</Text>
          <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'}의 개별 티켓 상태를 회차와 좌석 기준으로 확인합니다.</Text>
          <View style={styles.metricGrid}>
            <Metric label="판매 완료" value={sold} />
            <Metric label="판매 가능" value={available} />
            <Metric label="리셀 중" value={listed} />
          </View>

          <FilterBlock title="회차">
            <FilterChip label="전체" active={selectedRound === 'ALL'} onPress={() => { setSelectedRound('ALL'); setPage(1); }} />
            {(event?.rounds ?? []).map((round, index) => (
              <FilterChip key={round.id || index} label={roundLabel(round, index)} active={selectedRound === round.id} onPress={() => { setSelectedRound(round.id || ''); setPage(1); }} />
            ))}
          </FilterBlock>

          <FilterBlock title="좌석 구역">
            {sectionFilters.map((section) => (
              <FilterChip key={section} label={section === 'ALL' ? '전체' : section} active={selectedSection === section} onPress={() => { setSelectedSection(section); setPage(1); }} />
            ))}
          </FilterBlock>

          <FilterBlock title="판매 상태">
            {STATUS_FILTERS.map((item) => (
              <FilterChip key={item.value} label={item.label} active={selectedStatus === item.value} onPress={() => { setSelectedStatus(item.value); setPage(1); }} />
            ))}
          </FilterBlock>

          <FilterBlock title="리셀 여부">
            <FilterChip label="전체" active={resaleFilter === 'ALL'} onPress={() => { setResaleFilter('ALL'); setPage(1); }} />
            <FilterChip label="리셀 허용" active={resaleFilter === 'ENABLED'} onPress={() => { setResaleFilter('ENABLED'); setPage(1); }} />
            <FilterChip label="리셀 불가" active={resaleFilter === 'DISABLED'} onPress={() => { setResaleFilter('DISABLED'); setPage(1); }} />
          </FilterBlock>

          <FilterBlock title="정렬">
            {SORT_OPTIONS.map((item) => (
              <FilterChip key={item.value} label={item.label} active={sortMode === item.value} onPress={() => { setSortMode(item.value); setPage(1); }} />
            ))}
          </FilterBlock>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>검색 결과</Text>
            <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
          </View>
        </>
      )}
      renderItem={({ item }) => {
        const status = getTicketDisplayStatus(item, event as any);
        return (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <View style={styles.rowTitleLine}>
                <Text style={styles.rowTitle}>{item.seatInfo || '-'}</Text>
                <Text style={[styles.badge, styles[`tone_${status.tone}`]]}>{status.label}</Text>
              </View>
              <Text style={styles.rowMeta}>{ticketRoundLabel(item, event)} · {sectionOf(item)}</Text>
              <Text style={styles.rowMeta}>정가 {weiToEth(item.originalPriceWei || item.priceWei)}</Text>
              <Text style={styles.rowMeta}>리셀 {item.resaleEnabled ? `허용 · 최대 ${(item.resaleCapRate ?? 10000) / 100}%` : '불가'}</Text>
            </View>
          </View>
        );
      }}
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

function FilterBlock({ title, children, maxVisible = 8 }: { title: string; children: React.ReactNode; maxVisible?: number }) {
  const [expanded, setExpanded] = useState(false);
  const childArray = React.Children.toArray(children);
  const hasMore = childArray.length > maxVisible;
  const visible = expanded || !hasMore ? childArray : childArray.slice(0, maxVisible);
  return (
    <View style={styles.filterBlock}>
      <View style={styles.filterTitleRow}>
        <Text style={styles.filterTitle}>{title}</Text>
        {hasMore && (
          <TouchableOpacity onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.filterExpand}>{expanded ? '접기' : `+${childArray.length - maxVisible}개 더보기`}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.filterList}>{visible}</View>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.activeFilterChip]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.activeFilterChipText]}>{label}</Text>
    </TouchableOpacity>
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
  filterBlock: { marginTop: 12 },
  filterTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  filterTitle: { color: '#334155', fontSize: 12, fontWeight: '900' },
  filterExpand: { color: '#2563EB', fontSize: 12, fontWeight: '800' },
  filterList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterChipText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  activeFilterChipText: { color: '#2563EB' },
  sectionHead: { marginTop: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  pageText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  rowInfo: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowTitle: { color: '#0F172A', fontWeight: '900', fontSize: 16 },
  rowMeta: { marginTop: 5, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, minWidth: 68, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  tone_neutral: { backgroundColor: '#F1F5F9', color: '#475569' },
  tone_blue: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  tone_green: { backgroundColor: '#DCFCE7', color: '#15803D' },
  tone_yellow: { backgroundColor: '#FEF3C7', color: '#A16207' },
  tone_red: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  tone_gray: { backgroundColor: '#E2E8F0', color: '#475569' },
});
