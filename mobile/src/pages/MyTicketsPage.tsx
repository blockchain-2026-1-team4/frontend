import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlowBadge, FlowHero, IconButton, PosterArt, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { backendApi } from '../lib/backend';
import {
  canRegisterResale,
  displayStatusOf,
  entryStatusOf,
  eventDateLabel,
  eventTitle,
  eventVenue,
  sectionNameOf,
  ticketIdOf,
} from '../lib/ticketFlowDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const FILTERS = [
  { id: 'ALL', label: '전체' },
  { id: 'ENTRY', label: '입장 가능' },
  { id: 'RESALE', label: '리셀 가능' },
  { id: 'USED', label: '사용 완료' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

function statusRank(ticket: TicketDetail, event?: EventDetail) {
  const status = displayStatusOf(ticket, event).label;
  const ranks: Record<string, number> = {
    '입장 가능': 0,
    '보유 중': 1,
    '리셀 판매중': 2,
    '판매 가능': 3,
    '사용 완료': 4,
    '체크인 완료': 5,
    '취소됨': 6,
  };
  return ranks[status] ?? 7;
}

export default function MyTicketsPage({ navigation }: any) {
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, EventDetail>>({});
  const [statusFilter, setStatusFilter] = useState<FilterId>('ALL');
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
    const base = tickets.filter((ticket) => {
      const event = eventsById[ticket.eventId];
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ENTRY') return entryStatusOf(ticket, event).label === '입장 가능';
      if (statusFilter === 'RESALE') return canRegisterResale(ticket, event);
      if (statusFilter === 'USED') return ['USED', 'CANCELED'].includes(String(ticket.status).toUpperCase());
      return true;
    });

    return [...base].sort((left, right) => {
      const rankDiff = statusRank(left, eventsById[left.eventId]) - statusRank(right, eventsById[right.eventId]);
      if (rankDiff !== 0) return rankDiff;
      const leftTime = new Date(eventsById[left.eventId]?.eventAt || eventsById[left.eventId]?.eventStartAt || left.eventDateTime || 0).getTime();
      const rightTime = new Date(eventsById[right.eventId]?.eventAt || eventsById[right.eventId]?.eventStartAt || right.eventDateTime || 0).getTime();
      return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime) - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
    });
  }, [eventsById, statusFilter, tickets]);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>My Tickets</Text>
          <Text style={styles.title}>내 티켓</Text>
        </View>
        <IconButton>
          <TicketIcon name="search" size={21} />
        </IconButton>
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
              const status = displayStatusOf(ticket, event);
              const entry = entryStatusOf(ticket, event);
              const id = ticketIdOf(ticket);
              const quickIsQr = entry.label === '입장 가능';
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
                      <FlowBadge label={status.label} tone={status.tone === 'red' ? 'red' : status.tone === 'gray' ? 'gray' : status.tone === 'yellow' ? 'yellow' : 'green'} />
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
                <Text style={styles.emptyTitle}>보유한 티켓이 없습니다.</Text>
                <Text style={styles.emptyText}>이벤트 탐색에서 예매 가능한 티켓을 찾아보세요.</Text>
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
