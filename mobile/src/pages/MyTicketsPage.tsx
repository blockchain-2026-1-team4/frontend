import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import { formatEventDate, formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

function eventDate(ticket: TicketDetail, event?: EventDetail) {
  const value = event?.eventAt || ticket.eventDateTime;
  return formatEventDate(value);
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
        const eventIds = Array.from(new Set(data.map((ticket) => ticket.eventId).filter(Boolean)));
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

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'ALL') return tickets;
    if (statusFilter === 'OWNED') return tickets.filter((ticket) => ['ISSUED', 'OWNED', 'SOLD'].includes(String(ticket.status).toUpperCase()));
    if (statusFilter === 'LISTED') return tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'LISTED');
    if (statusFilter === 'USED') return tickets.filter((ticket) => ['USED', 'EXPIRED'].includes(String(ticket.status).toUpperCase()));
    return tickets;
  }, [statusFilter, tickets]);

  const renderTicket = ({ item }: { item: TicketDetail }) => {
    const event = eventsById[item.eventId];
    const status = formatTicketStatus(item.status);
    return (
      <TouchableOpacity style={styles.ticketCard} onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id ?? item.ticketId })}>
        <View style={styles.ticketInfo}>
          <Text style={styles.eventTitle}>{event?.name || item.eventTitle || item.eventName || '이벤트'}</Text>
          <Text style={styles.ticketMeta}>{event?.venue || item.venue || '-'}</Text>
          <Text style={styles.ticketMeta}>{eventDate(item, event)}</Text>
          <Text style={styles.ticketSeat}>좌석 {item.seatInfo || '-'}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => String(item.id ?? item.ticketId)}
          renderItem={renderTicket}
          contentContainerStyle={styles.list}
          ListHeaderComponent={(
            <View style={styles.filterRow}>
              {[
                { id: 'ALL', label: '전체' },
                { id: 'OWNED', label: '소유중' },
                { id: 'LISTED', label: '판매중' },
                { id: 'USED', label: '종료' },
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
