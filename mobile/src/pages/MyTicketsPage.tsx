import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import { formatCompactDateTime, getTicketDisplayStatus } from '../lib/ticketDisplay';
import type { DisplayStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const DISPLAY_RANK: Record<string, number> = {
  '입장 가능':    0,
  '보유 중':      1,
  '리셀 판매중':  2,
  '판매 가능':    3,
  '판매 종료':    4,
  '사용 기간 종료': 5,
  '체크인 완료':  6,
  '취소됨':       7,
};

const TONE_BADGE: Record<string, { bg: string; text: string }> = {
  green:   { bg: '#ECFDF5', text: '#059669' },
  blue:    { bg: '#EFF6FF', text: '#2563EB' },
  yellow:  { bg: '#FFF7ED', text: '#D97706' },
  red:     { bg: '#FEF2F2', text: '#DC2626' },
  gray:    { bg: '#F1F5F9', text: '#64748B' },
  neutral: { bg: '#F1F5F9', text: '#334155' },
};

function badgeStyle(status: DisplayStatus) {
  return TONE_BADGE[status.tone] ?? TONE_BADGE.neutral;
}

function eventDateTime(ticket: TicketDetail, event?: EventDetail) {
  return formatCompactDateTime(event?.eventAt || ticket.eventDateTime);
}

export default function MyTicketsPage({ navigation }: any) {
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, EventDetail>>({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTickets = async () => {
      try {
        const data = await backendApi.getMyTickets();
        setTickets(data);
        const eventIds = Array.from(new Set(data.map((t) => t.eventId).filter(Boolean)));
        const entries = await Promise.all(eventIds.map(async (id) => [id, await backendApi.getEvent(String(id))] as const));
        setEventsById(Object.fromEntries(entries));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    void loadTickets();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const base = statusFilter === 'ALL'    ? tickets
      : statusFilter === 'OWNED'           ? tickets.filter((t) => String(t.status).toUpperCase() === 'SOLD')
      : statusFilter === 'LISTED'          ? tickets.filter((t) => String(t.status).toUpperCase() === 'LISTED')
      : statusFilter === 'USED'            ? tickets.filter((t) => String(t.status).toUpperCase() === 'USED')
      : tickets;

    const displayRankOf = (t: TicketDetail) => {
      const label = getTicketDisplayStatus(t, eventsById[t.eventId] as any).label;
      return DISPLAY_RANK[label] ?? 7;
    };

    return [...base].sort((a, b) => {
      // 1차: 표시 상태 우선순위
      const rankA = displayRankOf(a);
      const rankB = displayRankOf(b);
      if (rankA !== rankB) return rankA - rankB;
      // 2차: 미래 이벤트는 임박 순, 과거 이벤트는 최근 순
      const timeA = new Date(eventsById[a.eventId]?.eventAt || a.eventDateTime || 0).getTime();
      const timeB = new Date(eventsById[b.eventId]?.eventAt || b.eventDateTime || 0).getTime();
      const now = Date.now();
      const futureA = timeA >= now;
      return futureA ? timeA - timeB : timeB - timeA;
    });
  }, [statusFilter, tickets, eventsById]);

  const renderTicket = ({ item }: { item: TicketDetail }) => {
    const event = eventsById[item.eventId];
    const status = getTicketDisplayStatus(item, eventsById[item.eventId] as any);
    const { bg, text } = badgeStyle(status);
    const section = item.sectionName;
    return (
      <TouchableOpacity style={styles.ticketCard} onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id ?? item.ticketId })}>
        <View style={styles.ticketInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>{event?.name || item.eventTitle || item.eventName || '이벤트'}</Text>
          <Text style={styles.ticketMeta}>{event?.venue || item.venue || '-'}</Text>
          <Text style={styles.ticketMeta}>{eventDateTime(item, event)}</Text>
          <Text style={styles.ticketSeat}>
            {section ? `${section} · ` : ''}{item.seatInfo || '-'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: bg }]}>
          <Text style={[styles.statusText, { color: text }]}>{status.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <FlatList
          data={filteredAndSorted}
          keyExtractor={(item) => String(item.id ?? item.ticketId)}
          renderItem={renderTicket}
          contentContainerStyle={styles.list}
          ListHeaderComponent={(
            <View style={styles.filterRow}>
              {[
                { id: 'ALL',    label: '전체' },
                { id: 'OWNED',  label: '보유 중' },
                { id: 'LISTED', label: '리셀 판매중' },
                { id: 'USED',   label: '사용 완료' },
              ].map((item) => (
                <TouchableOpacity key={item.id} style={[styles.filterChip, statusFilter === item.id && styles.activeFilterChip]} onPress={() => setStatusFilter(item.id)}>
                  <Text style={[styles.filterText, statusFilter === item.id && styles.activeFilterText]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>보유한 티켓이 없습니다.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 20 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  activeFilterText: { color: '#2563EB' },
  ticketCard: { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' },
  ticketInfo: { flex: 1, paddingRight: 12 },
  eventTitle: { fontSize: 17, fontWeight: '900', color: '#212529', marginBottom: 8 },
  ticketMeta: { fontSize: 13, color: '#868E96', marginBottom: 4, lineHeight: 18 },
  ticketSeat: { fontSize: 14, color: '#343A40', fontWeight: '800', marginTop: 4 },
  statusBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, color: '#2563EB', fontWeight: '900' },
  emptyText: { textAlign: 'center', color: '#868E96', fontSize: 16, paddingVertical: 100 },
});
