import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from '../components/TextInput';
import { FlowBadge, FlowHero, PosterArt, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { backendApi } from '../lib/backend';
import {
  canRegisterResale,
  eventDateLabel,
  eventTitle,
  eventVenue,
  sectionNameOf,
  ticketEntryReason,
  ticketEntryStatus,
  ticketIdOf,
} from '../lib/ticketFlowDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const FILTERS = [
  { id: 'ALL', label: '전체' },
  { id: 'ENTRY', label: '사용 가능' },
  { id: 'RESALE', label: '리셀 가능' },
  { id: 'USED', label: '사용 완료' },
  { id: 'EXPIRED', label: '기간 만료' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

function canResaleByRound(ticket: TicketDetail, event?: EventDetail): boolean {
  if (ticketEntryReason(ticket, event) === '사용 기간 종료') return false;
  return canRegisterResale(ticket, event);
}

function roundNameOf(ticket: TicketDetail, event?: EventDetail): string {
  const roundId = ticket.eventRoundId ? String(ticket.eventRoundId) : null;
  if (roundId && event?.rounds?.length) {
    const round = event.rounds.find((r) => r.id && String(r.id) === roundId);
    if (round?.title) return round.title;
  }
  return '';
}

function statusRank(ticket: TicketDetail, event?: EventDetail) {
  const entry = ticketEntryStatus(ticket, event);
  return entry.label === '사용 가능' ? 0 : 1;
}

function emptyMessage(filter: FilterId, query: string): { title: string; sub: string } {
  if (query.trim()) return { title: `'${query.trim()}'에 해당하는 티켓이 없습니다.`, sub: '다른 검색어로 다시 시도해보세요.' };
  if (filter === 'ENTRY') return { title: '사용 가능한 티켓이 없습니다.', sub: '체크인 시간(30분 전~공연 종료)에 사용 가능 상태로 전환됩니다.' };
  if (filter === 'RESALE') return { title: '리셀 등록 가능한 티켓이 없습니다.', sub: '리셀 허용 이벤트의 SOLD 상태 티켓만 등록할 수 있습니다.' };
  if (filter === 'USED') return { title: '사용 완료된 티켓이 없습니다.', sub: '체크인 후 사용 완료 처리된 티켓이 여기에 표시됩니다.' };
  if (filter === 'EXPIRED') return { title: '기간 만료된 티켓이 없습니다.', sub: '회차가 종료된 미사용 티켓이 여기에 표시됩니다.' };
  return { title: '보유한 티켓이 없습니다.', sub: '이벤트 탐색에서 예매 가능한 티켓을 찾아보세요.' };
}

export default function MyTicketsPage({ navigation }: any) {
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, EventDetail>>({});
  const [statusFilter, setStatusFilter] = useState<FilterId>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTickets = async () => {
      setLoading(true);
      try {
        const data = await backendApi.getMyTickets();
        setTickets(data);
        const eventIds = Array.from(new Set(data.map((ticket) => ticket.eventId).filter(Boolean)));
        const entries = await Promise.all(
          eventIds.map(async (id) => [String(id), await backendApi.getEvent(String(id)).catch(() => undefined)] as const),
        );
        setEventsById(Object.fromEntries(entries.filter(([, event]) => Boolean(event))) as Record<string, EventDetail>);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    void loadTickets();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = tickets.filter((ticket) => {
      const event = eventsById[ticket.eventId];
      if (statusFilter === 'ENTRY') return ticketEntryStatus(ticket, event).label === '사용 가능';
      if (statusFilter === 'RESALE') return canResaleByRound(ticket, event);
      if (statusFilter === 'USED') return ['USED', 'CANCELLED'].includes(String(ticket.status).toUpperCase());
      if (statusFilter === 'EXPIRED') return ticketEntryReason(ticket, event) === '사용 기간 종료';
      return true;
    }).filter((ticket) => {
      if (!q) return true;
      const event = eventsById[ticket.eventId];
      const name = eventTitle(event, ticket).toLowerCase();
      const venue = eventVenue(event, ticket).toLowerCase();
      const seat = String(ticket.seatInfo ?? '').toLowerCase();
      const section = sectionNameOf(ticket).toLowerCase();
      const round = roundNameOf(ticket, event).toLowerCase();
      return name.includes(q) || venue.includes(q) || seat.includes(q) || section.includes(q) || round.includes(q);
    });

    return [...base].sort((left, right) => {
      const rankDiff = statusRank(left, eventsById[left.eventId]) - statusRank(right, eventsById[right.eventId]);
      if (rankDiff !== 0) return rankDiff;
      const leftTime = new Date(eventsById[left.eventId]?.eventAt || eventsById[left.eventId]?.eventStartAt || left.eventDateTime || 0).getTime();
      const rightTime = new Date(eventsById[right.eventId]?.eventAt || eventsById[right.eventId]?.eventStartAt || right.eventDateTime || 0).getTime();
      return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime) - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
    });
  }, [eventsById, statusFilter, searchQuery, tickets]);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>My Tickets</Text>
          <Text style={styles.title}>내 티켓</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FlowHero
            height={150}
            style={styles.summaryHero}
            badge={`보유 티켓 ${tickets.length}장`}
            title={'입장 가능한 티켓을\n빠르게 확인하세요'}
            meta="QR 확인, 리셀 등록, 분쟁 신고까지 한 곳에서 처리합니다."
          />

          <View style={styles.searchBar}>
            <TicketIcon name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="이벤트명, 장소, 구역, 좌석 검색"
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <TicketIcon name="x" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map((item) => {
              const active = statusFilter === item.id;
              return (
                <TouchableOpacity key={item.id} style={[styles.filter, active && styles.filterActive]} onPress={() => setStatusFilter(item.id)} activeOpacity={0.84}>
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.ticketList}>
            {filteredAndSorted.length ? filteredAndSorted.map((ticket, index) => {
              const event = eventsById[ticket.eventId];
              const entry = ticketEntryStatus(ticket, event);
              const id = ticketIdOf(ticket);
              const quickIsQr = entry.label === '사용 가능';
              return (
                <TouchableOpacity
                  key={id || `${ticket.eventId}-${index}`}
                  style={styles.ticket}
                  onPress={() => navigation.navigate('TicketDetail', { ticketId: id })}
                  activeOpacity={0.86}
                >
                  <PosterArt title={eventTitle(event, ticket)} variant={index} />
                  <View style={styles.ticketInfo}>
                    <View style={styles.ticketTop}>
                      <FlowBadge label={entry.label} tone={entry.tone === 'red' ? 'red' : entry.tone === 'gray' ? 'gray' : entry.tone === 'yellow' ? 'yellow' : 'green'} />
                      <FlowBadge label={String(ticket.status).toUpperCase() === 'LISTED' ? '리셀 중' : '보유 중'} />
                    </View>
                    <Text style={styles.ticketName} numberOfLines={2}>{eventTitle(event, ticket)}</Text>
                    <Text style={styles.ticketMeta} numberOfLines={2}>{eventVenue(event, ticket)}{'\n'}{eventDateLabel(event, ticket)}</Text>
                    <View style={styles.seatLine}>
                      <Text style={styles.seat} numberOfLines={1}>{sectionNameOf(ticket)} · {ticket.seatInfo || '-'}</Text>
                      <TouchableOpacity
                        onPress={() => navigation.navigate(quickIsQr ? 'TicketQr' : 'TicketDetail', { ticketId: id })}
                        activeOpacity={0.84}
                      >
                        <Text style={styles.quick}>{quickIsQr ? 'QR' : '상세'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }) : (
              <View style={styles.emptyCard}>
                <TicketIcon name="ticket" size={26} color="#94A3B8" />
                <Text style={styles.emptyTitle}>{emptyMessage(statusFilter, searchQuery).title}</Text>
                <Text style={styles.emptyText}>{emptyMessage(statusFilter, searchQuery).sub}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  screen: { flex: 1 },
  content: { paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  topbar: {
    backgroundColor: 'rgba(246,247,251,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14 },
  searchInput: { flex: 1, height: 36, fontSize: 13, fontWeight: '700', color: '#0F172A', backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
  summaryHero: { margin: 16 },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 13 },
  filter: { flexShrink: 0, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  ticketList: { paddingHorizontal: 16, gap: 12 },
  ticket: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 12, flexDirection: 'row', gap: 12, ...flowShadow },
  ticketInfo: { flex: 1, minWidth: 0 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  ticketName: { fontSize: 15, fontWeight: '900', lineHeight: 19, letterSpacing: 0, color: '#0F172A', marginBottom: 7 },
  ticketMeta: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  seatLine: { marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  seat: { flex: 1, fontSize: 13, fontWeight: '900', color: '#0F172A' },
  quick: { fontSize: 12, fontWeight: '900', color: '#534AB7' },
  emptyCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 24, alignItems: 'center', ...flowShadow },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '900', color: '#0F172A' },
  emptyText: { marginTop: 5, fontSize: 12, color: '#64748B', fontWeight: '700', textAlign: 'center' },
});
