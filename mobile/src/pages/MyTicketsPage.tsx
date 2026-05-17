import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { backendApi } from '../lib/backend';
import type { TicketDetail } from '../types/api';

export default function MyTicketsPage({ navigation }: any) {
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const data = await backendApi.getMyTickets();
      setTickets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderTicket = ({ item }: { item: TicketDetail }) => (
    <TouchableOpacity 
      style={styles.ticketCard}
      onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id })}
    >
      <View style={styles.ticketInfo}>
        <Text style={styles.eventTitle}>{item.eventTitle}</Text>
        <Text style={styles.ticketDetails}>
          {item.seatInfo} | {item.status}
        </Text>
        <Text style={styles.ticketPrice}>{item.priceWei} WEI</Text>
      </View>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>상세보기</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>보유한 티켓이 없습니다.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 20 },
  ticketCard: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 20, 
    marginBottom: 15, 
    flexDirection: 'row', 
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  ticketInfo: { flex: 1 },
  eventTitle: { fontSize: 18, fontWeight: 'bold', color: '#212529', marginBottom: 5 },
  ticketDetails: { fontSize: 14, color: '#868E96', marginBottom: 5 },
  ticketPrice: { fontSize: 14, color: '#007AFF', fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#F1F3F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusText: { fontSize: 12, color: '#495057', fontWeight: 'bold' },
  emptyContainer: { paddingVertical: 100, alignItems: 'center' },
  emptyText: { color: '#868E96', fontSize: 16 },
});
