import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, Modal, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput } from '../components/TextInput';
import { TicketIcon } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { showDialog } from '../lib/dialog';
import { backendApi } from '../lib/backend';
import { formatCompactDateTime, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: 'ALL' as const,       label: '전체',     tone: undefined },
  { value: 'AVAILABLE' as const, label: '판매 가능', tone: 'green' as const },
  { value: 'SOLD' as const,      label: '판매됨',   tone: undefined },
  { value: 'LISTED' as const,    label: '리셀',     tone: undefined },
  { value: 'USED' as const,      label: '입장 완료', tone: undefined },
];

type SortMode = 'priceAsc' | 'priceDesc' | 'seat' | 'latest';

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
  return String(ticket.id ?? ticket.ticketId ?? ticket.contractTokenId ?? ticket.seatInfo);
}

function comparePrice(a: TicketDetail, b: TicketDetail): number {
  const toStr = (t: TicketDetail) => String(t.originalPriceWei ?? t.priceWei ?? '0').split('.')[0] || '0';
  const ra = toStr(a); const rb = toStr(b);
  const len = Math.max(ra.length, rb.length);
  return ra.padStart(len, '0') < rb.padStart(len, '0') ? -1 : ra.padStart(len, '0') > rb.padStart(len, '0') ? 1 : 0;
}

function matchesTicketStatusFilter(status: string, selected: (typeof STATUS_FILTERS)[number]['value']) {
  return selected === 'ALL' || status === selected;
}

function explorerStatus(ticket: TicketDetail) {
  const status = String(ticket.status).toUpperCase();
  if (status === 'AVAILABLE') return { label: '판매 가능', tone: 'purple' };
  if (status === 'SOLD') return { label: '판매됨', tone: 'neutral' };
  if (status === 'LISTED') return { label: '리셀', tone: 'yellow' };
  if (status === 'USED') return { label: '입장 완료', tone: 'blue' };
  if (status === 'CANCELED' || status === 'CANCELLED') return { label: '취소됨', tone: 'red' };
  return { label: status || '-', tone: 'neutral' };
}

type SelectOption<T extends string> = { id: T; label: string; sub: string };

function SelectSheet<T extends string>({
  title,
  helper,
  options,
  value,
  onChange,
}: {
  title: string;
  helper: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.id === value) ?? options[0];
  return (
    <>
      <TouchableOpacity style={styles.roundSelect} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <Text style={styles.roundSelectMain}>{cur?.label}</Text>
          <Text style={styles.roundSelectSub}>{helper}</Text>
        </View>
        <TicketIcon name="chevron" size={18} color="#64748B" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.sheetClose}>닫기</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const active = opt.id === value;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.sheetRow, active && styles.sheetRowActive]}
                    onPress={() => { onChange(opt.id); setOpen(false); }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radio, active && styles.radioActive]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetMain, active && styles.sheetMainActive]}>{opt.label}</Text>
                      <Text style={styles.sheetSub}>{opt.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!eventId) {
      setLoadError('이벤트 정보가 없어 전체 티켓 탐색을 열 수 없습니다.');
      setLoading(false); setRefreshing(false);
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
      showDialog('전체 티켓 탐색 로드 실패', message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sold      = tickets.filter((t) => ['SOLD', 'LISTED', 'USED'].includes(String(t.status).toUpperCase())).length;
  const available = tickets.filter((t) => String(t.status).toUpperCase() === 'AVAILABLE').length;
  const listed    = tickets.filter((t) => String(t.status).toUpperCase() === 'LISTED').length;
  const used      = tickets.filter((t) => String(t.status).toUpperCase() === 'USED').length;

  const roundOptions: SelectOption<string>[] = useMemo(() => {
    const allOpt: SelectOption<string> = { id: 'ALL', label: '전체 회차', sub: '모든 회차의 티켓을 함께 조회합니다.' };
    if (!event?.rounds?.length) return [allOpt];
    return [allOpt, ...event.rounds.map((round, index) => {
      const rid = round.id ? String(round.id) : String(index);
      const roundTickets = tickets.filter((t) => t.eventRoundId != null && String(t.eventRoundId) === rid);
      const rs = roundTickets.filter((t) => ['SOLD', 'LISTED', 'USED'].includes(String(t.status).toUpperCase())).length;
      const dateLabel = formatCompactDateTime(`${round.eventDate}T${String(round.startTime).slice(0, 5)}:00`);
      return { id: rid, label: round.title?.trim() || `${index + 1}회차`, sub: `${dateLabel} · 판매 ${rs}/${roundTickets.length}` };
    })];
  }, [event?.rounds, tickets]);

  const sortOptions: SelectOption<SortMode>[] = useMemo(() => SORT_OPTIONS.map((option) => ({
    id: option.value,
    label: option.label,
    sub: option.value === 'latest'
      ? '최근 생성된 티켓부터 표시합니다.'
      : option.value === 'seat'
        ? '좌석명 기준으로 정렬합니다.'
        : option.value === 'priceAsc'
          ? '낮은 가격의 티켓부터 표시합니다.'
          : '높은 가격의 티켓부터 표시합니다.',
  })), []);

  const sectionFilters = useMemo(() => {
    const roundTickets = selectedRound === 'ALL'
      ? tickets
      : tickets.filter((ticket) => ticket.eventRoundId != null && String(ticket.eventRoundId) === selectedRound);
    const sections = Array.from(new Set(roundTickets.map(sectionOf))).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
    return ['ALL', ...sections];
  }, [selectedRound, tickets]);

  const filteredTickets = useMemo(() => {
    const norm = query.trim().toLowerCase();
    const base = tickets.filter((t) => {
      const mr = selectedRound === 'ALL' || (t.eventRoundId != null && String(t.eventRoundId) === selectedRound);
      const ms = selectedSection === 'ALL' || sectionOf(t) === selectedSection;
      const mst = matchesTicketStatusFilter(String(t.status).toUpperCase(), selectedStatus);
      const searchable = [t.seatInfo, t.id, t.ticketId, t.contractTokenId, sectionOf(t)].filter(Boolean).join(' ').toLowerCase();
      const mq = !norm || searchable.includes(norm);
      return mr && ms && mst && mq;
    });
    return [...base].sort((a, b) => {
      if (sortMode === 'priceAsc')  return comparePrice(a, b);
      if (sortMode === 'priceDesc') return comparePrice(b, a);
      if (sortMode === 'seat') return String(a.seatInfo || '').localeCompare(String(b.seatInfo || ''), 'ko-KR', { numeric: true });
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [selectedRound, selectedSection, selectedStatus, sortMode, query, tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTickets = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRoundLabel = roundOptions.find((o) => o.id === selectedRound)?.label ?? '전체 회차';

  const onBack = () => eventId ? navigation.navigate('OrganizerEventDetail', { eventId }) : navigation.navigate('MyEvents');
  const onRoundChange = (id: string) => {
    setSelectedRound(id);
    setSelectedSection('ALL');
    setPage(1);
  };
  const exportTickets = async () => {
    if (filteredTickets.length === 0) {
      showDialog('내보낼 티켓이 없습니다.', '검색 및 필터 조건을 변경한 뒤 다시 시도해주세요.');
      return;
    }
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredTickets.map((ticket) => [
      ticketId(ticket),
      ticket.contractTokenId ?? '',
      ticket.seatInfo,
      sectionOf(ticket),
      String(ticket.status).toUpperCase(),
      weiToEth(ticket.originalPriceWei || ticket.priceWei),
    ].map(escapeCsv).join(','));
    const csv = ['ticketId,contractTokenId,seat,section,status,priceEth', ...rows].join('\n');

    try {
      if (Platform.OS === 'web') {
        const web = globalThis as any;
        const blob = new web.Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
        const url = web.URL.createObjectURL(blob);
        const link = web.document.createElement('a');
        link.href = url;
        link.download = `${event?.name || event?.title || 'tickets'}-tickets.csv`;
        link.click();
        web.URL.revokeObjectURL(url);
        return;
      }
      await Share.share({ title: '전체 티켓 탐색 결과', message: csv });
    } catch (error: any) {
      showDialog('티켓 내보내기 실패', errorMessage(error, '티켓 목록을 내보내지 못했습니다.'));
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;

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
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity style={styles.topbarIcon} onPress={onBack} activeOpacity={0.84}>
          <TicketIcon name="arrowLeft" size={20} color="#475569" />
        </TouchableOpacity>
        <View style={styles.topbarCenter}>
          <Text style={styles.topbarEyebrow}>Ticket Explorer</Text>
          <Text style={styles.topbarTitle}>전체 티켓 탐색</Text>
        </View>
        <TouchableOpacity style={styles.topbarIcon} onPress={() => void exportTickets()} activeOpacity={0.84}>
          <TicketIcon name="download" size={20} color="#475569" />
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={pagedTickets}
        keyExtractor={ticketId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListHeaderComponent={(
          <>
            <LinearGradient colors={['#1A1A2E', '#534AB7', '#1D9E75']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroGlow} />
              <View style={styles.posterRow}>
                <LinearGradient colors={['#26215C', '#534AB7', '#1D9E75']} style={styles.miniPoster} />
                <LinearGradient colors={['#0C447C', '#185FA5', '#639922']} style={styles.miniPoster} />
              </View>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.16)', 'rgba(0,0,0,0.78)']} style={StyleSheet.absoluteFill} />
              <View style={styles.heroBody}>
                <View style={styles.glassBadge}>
                  <Text style={styles.glassBadgeText}>개별 티켓</Text>
                </View>
                <Text style={styles.heroTitle}>{'티켓 ID, 좌석, 상태를\n정확히 검색하세요.'}</Text>
                <Text style={styles.heroMeta}>환불, 분쟁, 리셀 문의가 들어왔을 때 개별 티켓을 추적합니다.</Text>
              </View>
            </LinearGradient>

            <View style={styles.statStrip}>
              {[
                { label: '판매 완료', value: sold },
                { label: '판매 가능', value: available },
                { label: '리셀 중',   value: listed },
                { label: '입장 완료', value: used },
              ].map((m) => (
                <View key={m.label} style={styles.metricCard}>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.searchWrap}>
              <View style={styles.searchBox}>
                <TicketIcon name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={(v) => { setQuery(v); setPage(1); }}
                  placeholder="티켓 ID, 좌석 검색 예: 1회차-R-042"
                />
              </View>
            </View>

            <View style={styles.filterPanel}>
              <View style={[styles.filterBlock, styles.filterBlockFirst]}>
                <View style={styles.filterTitle}>
                  <TicketIcon name="calendar" size={13} color="#64748B" />
                  <Text style={styles.filterTitleText}>회차</Text>
                </View>
                <SelectSheet
                  title="회차 선택"
                  helper="회차가 많아지면 여기서 선택"
                  options={roundOptions}
                  value={selectedRound}
                  onChange={onRoundChange}
                />
              </View>

              <View style={styles.filterBlock}>
                <View style={styles.filterTitle}>
                  <TicketIcon name="check" size={13} color="#64748B" />
                  <Text style={styles.filterTitleText}>상태</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {STATUS_FILTERS.map((item) => {
                    const active = selectedStatus === item.value;
                    const tone = CHIP_TONE[item.tone ?? ''] ?? undefined;
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[styles.chip, active && styles.chipActive, !active && tone ? { backgroundColor: tone.bg, borderColor: tone.border } : undefined]}
                        onPress={() => { setSelectedStatus(item.value); setPage(1); }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive, !active && tone ? { color: tone.text } : undefined]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={[styles.filterBlock, styles.filterBlockLast]}>
                <View style={styles.filterTitle}>
                  <TicketIcon name="sort" size={13} color="#64748B" />
                  <Text style={styles.filterTitleText}>정렬</Text>
                </View>
                <SelectSheet
                  title="정렬 선택"
                  helper="좌석순, 가격순으로 변경 가능"
                  options={sortOptions}
                  value={sortMode}
                  onChange={(value) => { setSortMode(value); setPage(1); }}
                />
              </View>
            </View>

            <View style={[styles.filterPanel, styles.sectionPanel]}>
              <View style={[styles.filterBlock, styles.filterBlockFirst, styles.filterBlockLast]}>
                <View style={styles.filterTitle}>
                  <TicketIcon name="seat" size={13} color="#64748B" />
                  <Text style={styles.filterTitleText}>구역</Text>
                  <Text style={styles.filterTitleMuted}>· 회차 선택 후 표시</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {sectionFilters.map((section) => {
                    const active = selectedSection === section;
                    return (
                      <TouchableOpacity key={section} style={[styles.chip, active && styles.chipActive]} onPress={() => { setSelectedSection(section); setPage(1); }}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{section === 'ALL' ? '전체' : section}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={styles.pagerHead}>
              <Text style={styles.pagerLeft}>결과 {filteredTickets.length}건 · {selectedRoundLabel}</Text>
              <View style={styles.pagerBtns}>
                <TouchableOpacity style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} disabled={currentPage === 1} onPress={() => setPage((v) => Math.max(v - 1, 1))}>
                  <Text style={styles.pageBtnText}>이전</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pageBtn, styles.pageBtnActive, currentPage >= totalPages && styles.pageBtnDisabled]} disabled={currentPage >= totalPages} onPress={() => setPage((v) => Math.min(v + 1, totalPages))}>
                  <Text style={[styles.pageBtnText, { color: currentPage < totalPages ? '#FFFFFF' : '#B4B2A9' }]}>다음</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        renderItem={({ item }) => {
          const status = explorerStatus(item);
          const tone = BADGE_TONE[status.tone] ?? BADGE_TONE.neutral;
          const fullTicketId = ticketId(item);
          const tktIdShort = fullTicketId.length > 7 ? `${fullTicketId.slice(0, 7)}...` : fullTicketId;
          return (
            <View style={styles.tkt}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tktTitle}>{item.seatInfo || '-'}</Text>
                <Text style={styles.tktMeta}>{sectionOf(item)} · {weiToEth(item.originalPriceWei || item.priceWei)} ETH{tktIdShort ? ` · 티켓 ID ${tktIdShort}` : ''}</Text>
              </View>
              <View style={[styles.tktBadge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.tktBadgeText, { color: tone.text }]}>{status.label}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>조건에 맞는 티켓이 없습니다.</Text>}
        ListFooterComponent={<View style={{ height: 8 }} />}
      />
    </View>
  );
}

// ─── Helpers / constants ──────────────────────────────────────────────────────

const CHIP_TONE: Record<string, { bg: string; border: string; text: string }> = {
  green: { bg: '#F8FAFC', border: '#E7E5FF', text: '#534AB7' },
  red:   { bg: '#FCEBEB', border: '#F7C1C1', text: '#A32D2D' },
  amber: { bg: '#FAEEDA', border: '#FAC775', text: '#854F0B' },
  blue:  { bg: '#E6F1FB', border: '#A3C8F0', text: '#185FA5' },
};

const BADGE_TONE: Record<string, { bg: string; text: string }> = {
  neutral: { bg: '#F1F5F9', text: '#64748B' },
  green:   { bg: '#E1F5EE', text: '#0F6E56' },
  red:     { bg: '#FCEBEB', text: '#A32D2D' },
  yellow:  { bg: '#FAEEDA', text: '#854F0B' },
  blue:    { bg: '#E6F1FB', text: '#185FA5' },
  gray:    { bg: '#E5E7EB', text: '#6B7280' },
  purple:  { bg: '#EEEDFE', text: '#534AB7' },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7FB' },
  list: { flex: 1 },
  content: { paddingBottom: 98 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: '#94A3B8', paddingVertical: 48, textAlign: 'center', fontWeight: '800' },
  errorText: { marginTop: 8, color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  primaryButton: { marginTop: 14, backgroundColor: '#534AB7', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },

  // ── Topbar ──
  topbar: { backgroundColor: 'rgba(246,247,251,0.92)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.72)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  topbarCenter: { flex: 1, alignItems: 'center' },
  topbarEyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  topbarTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
  topbarIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOpacity: 0.045, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },

  // ── Hero ──
  hero: { marginHorizontal: 16, marginVertical: 14, borderRadius: 28, height: 190, overflow: 'hidden', backgroundColor: '#1A1A2E', shadowColor: '#534AB7', shadowOpacity: 0.27, shadowRadius: 20, shadowOffset: { width: 0, height: 20 }, elevation: 6 },
  heroGlow: { position: 'absolute', right: 20, top: -45, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.13)' },
  posterRow: { position: 'absolute', right: -12, top: 18, flexDirection: 'row', gap: 8, opacity: 0.74, transform: [{ rotate: '8deg' }], zIndex: 1 },
  miniPoster: { width: 58, height: 84, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#26215C' },
  heroBody: { position: 'absolute', left: 18, right: 18, bottom: 18, zIndex: 2 },
  glassBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  glassBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },
  heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', lineHeight: 28.5, letterSpacing: -0.8, marginTop: 9, marginBottom: 9 },
  heroMeta: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 17 },

  // ── Stats ──
  statStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#0F172A', shadowOpacity: 0.055, shadowRadius: 15, shadowOffset: { width: 0, height: 12 }, elevation: 2 },
  metricValue: { fontSize: 18, fontWeight: '900', color: '#534AB7', letterSpacing: -0.3 },
  metricLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', marginTop: 2, textAlign: 'center' },

  // ── Search ──
  searchWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  searchBox: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 17, paddingHorizontal: 13, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  searchInput: { flex: 1, fontSize: 13, color: '#1A1A2E', paddingVertical: 0 },

  // ── Filter panel ──
  filterPanel: { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#0F172A', shadowOpacity: 0.055, shadowRadius: 15, shadowOffset: { width: 0, height: 12 }, elevation: 2 },
  sectionPanel: { marginTop: 0 },
  filterBlock: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterBlockFirst: { paddingTop: 14 },
  filterBlockLast: { borderBottomWidth: 0, paddingBottom: 14 },
  filterTitle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  filterTitleText: { fontSize: 11, fontWeight: '900', color: '#64748B' },
  filterTitleMuted: { fontSize: 10, fontWeight: '800', color: '#94A3B8' },

  // ── Round selector button ──
  roundSelect: { height: 48, borderRadius: 17, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 8 },
  roundSelectMain: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  roundSelectSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },

  // ── Chips ──
  chipRow: { gap: 8, paddingRight: 4 },
  chip: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  chipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  chipText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },

  // ── Round modal (bottom sheet) ──
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '70%' },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#DBE3EF', marginTop: 10, alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sheetTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  sheetClose: { fontSize: 12, fontWeight: '900', color: '#64748B' },
  sheetList: { padding: 10, paddingBottom: 20 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 12, borderRadius: 18, marginBottom: 2 },
  sheetRowActive: { backgroundColor: '#FBFAFF', borderWidth: 1, borderColor: '#D8D4FF' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', flexShrink: 0 },
  radioActive: { borderWidth: 6, borderColor: '#534AB7' },
  sheetMain: { fontSize: 13, fontWeight: '900', color: '#0F172A' },
  sheetMainActive: { color: '#534AB7' },
  sheetSub: { fontSize: 10, color: '#64748B', marginTop: 2 },

  // ── Pager ──
  pagerHead: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pagerLeft: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  pagerBtns: { flexDirection: 'row', gap: 7 },
  pageBtn: { height: 34, borderRadius: 13, backgroundColor: '#FFFFFF', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  pageBtnActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  pageBtnDisabled: { opacity: 0.38 },
  pageBtnText: { color: '#6B7280', fontSize: 12, fontWeight: '900' },

  // ── Ticket row ──
  tkt: { backgroundColor: '#FFFFFF', borderRadius: 22, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#0F172A', shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 1 },
  tktTitle: { fontSize: 14, fontWeight: '900', color: '#1A1A2E', marginBottom: 4 },
  tktMeta: { fontSize: 11, color: '#64748B', lineHeight: 16 },
  tktBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, flexShrink: 0 },
  tktBadgeText: { fontSize: 10, fontWeight: '900' },
});
