import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventDetail, TicketDetail } from '../types/api';

export default function MyTicketsPage({ navigation }: any) {
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, EventDetail>>({});
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
    loadTickets();
  }, []);

  const renderTicket = ({ item }: { item: TicketDetail }) => {
    const event = eventsById[item.eventId];
    return (
      <TouchableOpacity style={styles.ticketCard} onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id ?? item.ticketId })}>
        <View style={styles.ticketInfo}>
          <Text style={styles.eventTitle}>{event?.name || item.eventTitle || item.eventName || '티켓'}</Text>
          <Text style={styles.ticketDetails}>{item.seatInfo} | {item.status}</Text>
          <Text style={styles.ticketPrice}>{item.originalPriceWei ?? item.priceWei ? `${item.originalPriceWei ?? item.priceWei} WEI` : ''}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>상세</Text>
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
          data={tickets}
          keyExtractor={(item) => String(item.id ?? item.ticketId)}
          renderItem={renderTicket}
          contentContainerStyle={styles.list}
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
  ticketCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' },
  ticketInfo: { flex: 1 },
  eventTitle: { fontSize: 18, fontWeight: 'bold', color: '#212529', marginBottom: 5 },
  ticketDetails: { fontSize: 14, color: '#868E96', marginBottom: 5 },
  ticketPrice: { fontSize: 14, color: '#007AFF', fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#F1F3F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusText: { fontSize: 12, color: '#495057', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#868E96', fontSize: 16, paddingVertical: 100 },
});
