import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatCompactDateTime, getTicketDisplayStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventRound, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: 'ALL' as const,        label: '전체',     tone: undefined },
  { value: 'AVAILABLE' as const,  label: '판매 가능', tone: 'green' as const },
  { value: 'SOLD_GROUP' as const, label: '판매됨',   tone: 'red' as const },
  { value: 'LISTED' as const,     label: '리셀',     tone: 'amber' as const },
  { value: 'USED' as const,       label: '입장 완료', tone: 'blue' as const },
  { value: 'CANCELED' as const,  label: '취소',     tone: undefined },
];

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

function matchesTicketStatusFilter(status: string, selectedStatus: (typeof STATUS_FILTERS)[number]['value']) {
  if (selectedStatus === 'ALL') return true;
  if (selectedStatus === 'SOLD_GROUP') return ['SOLD', 'LISTED', 'USED'].includes(status);
  return status === selectedStatus;
}

export default function TicketExplorePage({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
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
  const [query, setQuery] = useState('');

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
    const normalized = query.trim().toLowerCase();
    const base = tickets.filter((ticket) => {
      const matchesRound = selectedRound === 'ALL' || ticket.eventRoundId === selectedRound;
      const matchesSection = selectedSection === 'ALL' || sectionOf(ticket) === selectedSection;
      const matchesStatus = matchesTicketStatusFilter(String(ticket.status).toUpperCase(), selectedStatus);
      const matchesResale =
        resaleFilter === 'ALL' ||
        (resaleFilter === 'ENABLED' && ticket.resaleEnabled) ||
        (resaleFilter === 'DISABLED' && !ticket.resaleEnabled);
      const matchesQuery = !normalized || String(ticket.seatInfo || ticket.ticketId || ticket.id || '').toLowerCase().includes(normalized);
      return matchesRound && matchesSection && matchesStatus && matchesResale && matchesQuery;
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
          <View style={[styles.hero, { paddingTop: Math.max(insets.top + 14, 36) }]}>
            <View style={styles.heroTop}>
              <TouchableOpacity style={styles.backButton} onPress={() => eventId ? navigation.navigate('OrganizerEventDetail', { eventId }) : navigation.navigate('MyEvents')}>
                <Text style={styles.backButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.eyebrow}>Ticket Explorer</Text>
            </View>
            <Text style={styles.title}>전체 티켓 탐색</Text>
            <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'}</Text>
            <View style={styles.heroChip}>
              <View style={styles.heroDot} />
              <Text style={styles.heroChipText}>개별 티켓 상태 확인 · 회차 · 좌석 · 판매</Text>
            </View>
          </View>
          <View style={styles.statStrip}>
            <Metric label="판매 완료" value={sold} tone="red" />
            <Metric label="판매 가능" value={available} tone="green" />
            <Metric label="리셀 중" value={listed} tone="yellow" />
          </View>

          <View style={styles.searchWrap}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={(v) => { setQuery(v); setPage(1); }}
                placeholder="티켓 ID로 검색 (예: 1회차-R-042)"
              />
            </View>
          </View>

          <View style={styles.filterSection}>
          <FilterBlock title="회차">
            <FilterChip label="전체" active={selectedRound === 'ALL'} onPress={() => { setSelectedRound('ALL'); setPage(1); }} />
            {(event?.rounds ?? []).map((round, index) => (
              <FilterChip key={round.id || index} label={roundLabel(round, index)} active={selectedRound === round.id} onPress={() => { setSelectedRound(round.id || ''); setPage(1); }} />
            ))}
          </FilterBlock>

          <FilterBlock title="구역">
            {sectionFilters.map((section) => (
              <FilterChip key={section} label={section === 'ALL' ? '전체' : section} active={selectedSection === section} onPress={() => { setSelectedSection(section); setPage(1); }} />
            ))}
          </FilterBlock>

          <FilterBlock title="상태">
            {STATUS_FILTERS.map((item) => (
              <FilterChip key={item.value} label={item.label} tone={item.tone} active={selectedStatus === item.value} onPress={() => { setSelectedStatus(item.value); setPage(1); }} />
            ))}
          </FilterBlock>

          <FilterBlock title="정렬">
            {SORT_OPTIONS.map((item) => (
              <FilterChip key={item.value} label={item.label} active={sortMode === item.value} onPress={() => { setSortMode(item.value); setPage(1); }} />
            ))}
          </FilterBlock>
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>결과 {filteredTickets.length}건</Text>
            <View style={styles.paginationRow}>
              <Text style={styles.pageInfoText}>{currentPage} / {totalPages}</Text>
              <TouchableOpacity style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} disabled={currentPage === 1} onPress={() => setPage((v) => Math.max(v - 1, 1))}>
                <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pageBtn, styles.pageBtnActive, currentPage >= totalPages && styles.pageBtnDisabled]} disabled={currentPage >= totalPages} onPress={() => setPage((v) => Math.min(v + 1, totalPages))}>
                <Text style={[styles.pageBtnText, { color: currentPage < totalPages ? '#FFFFFF' : '#B4B2A9' }]}>다음</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
      renderItem={({ item }) => {
        const status = getTicketDisplayStatus(item, event as any);
        const badgeTone = BADGE_TONE[status.tone] ?? BADGE_TONE.neutral;
        return (
          <View style={styles.tkt}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tktId}>{item.seatInfo || '-'}</Text>
              <Text style={styles.tktMeta}>{sectionOf(item)} · {weiToEth(item.originalPriceWei || item.priceWei)} ETH · 리셀 {item.resaleEnabled ? '허용' : '불가'}</Text>
            </View>
            <View style={[styles.tktBadge, { backgroundColor: badgeTone.bg }]}>
              <Text style={[styles.tktBadgeText, { color: badgeTone.text }]}>{status.label}</Text>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={<Text style={styles.emptyText}>조건에 맞는 티켓이 없습니다.</Text>}
      ListFooterComponent={<View style={{ height: 8 }} />}
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

type ChipTone = 'green' | 'red' | 'amber' | 'blue';

const CHIP_TONE_STYLE: Record<ChipTone, { bg: string; border: string; text: string }> = {
  green: { bg: '#E1F5EE', border: '#9FE1CB', text: '#0F6E56' },
  red:   { bg: '#FCEBEB', border: '#F7C1C1', text: '#A32D2D' },
  amber: { bg: '#FAEEDA', border: '#FAC775', text: '#854F0B' },
  blue:  { bg: '#E6F1FB', border: '#A3C8F0', text: '#185FA5' },
};

const BADGE_TONE: Record<string, { bg: string; text: string }> = {
  neutral: { bg: '#F3F4F6', text: '#6B7280' },
  green:   { bg: '#E1F5EE', text: '#0F6E56' },
  red:     { bg: '#FCEBEB', text: '#A32D2D' },
  yellow:  { bg: '#FAEEDA', text: '#854F0B' },
  blue:    { bg: '#E6F1FB', text: '#185FA5' },
  gray:    { bg: '#E5E7EB', text: '#6B7280' },
};

function FilterChip({ label, active, onPress, tone }: { label: string; active: boolean; onPress: () => void; tone?: ChipTone }) {
  const toneStyle = !active && tone ? { backgroundColor: CHIP_TONE_STYLE[tone].bg, borderColor: CHIP_TONE_STYLE[tone].border } : undefined;
  const toneTextStyle = !active && tone ? { color: CHIP_TONE_STYLE[tone].text } : undefined;
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.activeFilterChip, toneStyle]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.activeFilterChipText, toneTextStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'red' | 'green' | 'yellow' }) {
  return <View style={styles.metricCard}><Text style={[styles.metricValue, styles[`metric_${tone}`]]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: '#94A3B8', paddingVertical: 48, textAlign: 'center' },
  errorText: { marginTop: 8, color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  hero: { backgroundColor: '#1A1A2E', paddingHorizontal: 18, paddingBottom: 28 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  backButton: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  backButtonText: { color: 'rgba(255,255,255,0.75)', fontWeight: '900', fontSize: 20, lineHeight: 22 },
  primaryButton: { marginTop: 14, backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  eyebrow: { color: '#A89CF7', fontWeight: '800', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', lineHeight: 24 },
  subtitle: { marginTop: 3, color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  eventContext: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  eventContextIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.1)' },
  eventContextName: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  eventContextMeta: { marginTop: 1, color: 'rgba(255,255,255,0.45)', fontSize: 10 },
  heroChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A89CF7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 10 },
  statStrip: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, marginTop: -14, marginBottom: 10 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  metricLabel: { color: '#9CA3AF', fontSize: 9, fontWeight: '800', marginTop: 2 },
  metricValue: { fontSize: 17, fontWeight: '900', lineHeight: 20 },
  metric_neutral: { color: '#1A1A2E' },
  metric_red: { color: '#A32D2D' },
  metric_green: { color: '#0F6E56' },
  metric_yellow: { color: '#854F0B' },
  filterSection: { marginHorizontal: 14, marginBottom: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', overflow: 'hidden' },
  filterBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  filterTitleRow: { width: 36, flexShrink: 0 },
  filterTitle: { color: '#6B7280', fontSize: 10, fontWeight: '900' },
  filterExpand: { color: '#534AB7', fontSize: 10, fontWeight: '800' },
  filterList: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  filterChip: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#1A1A2E', backgroundColor: '#1A1A2E' },
  filterChipText: { color: '#6B7280', fontWeight: '800', fontSize: 10 },
  activeFilterChipText: { color: '#FFFFFF' },
  searchWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 0 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 2 },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 12, color: '#1A1A2E', paddingVertical: 8 },
  sectionHead: { marginTop: 8, marginBottom: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#9CA3AF', fontSize: 10, fontWeight: '900' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageInfoText: { color: '#9CA3AF', fontSize: 10, fontWeight: '600', marginRight: 2 },
  pageBtn: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, borderWidth: 0.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  pageBtnActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  pageBtnDisabled: { opacity: 0.38 },
  pageBtnText: { color: '#6B7280', fontSize: 10, fontWeight: '700' },
  pageBtnTextDisabled: { color: '#B4B2A9' },
  tkt: { backgroundColor: '#FFFFFF', borderRadius: 10, marginHorizontal: 14, marginBottom: 6, borderWidth: 0.5, borderColor: '#E5E7EB', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tktId: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  tktMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  tktBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, flexShrink: 0 },
  tktBadgeText: { fontSize: 9, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
});
