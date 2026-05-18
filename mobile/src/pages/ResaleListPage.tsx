import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import type { ResaleListing } from '../types/api';

export default function ResaleListPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId;
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await backendApi.getResaleListings({ size: 50 });
        const items = data.items ?? [];
        // TODO: Replace client-side filtering when backend supports eventId on GET /resale-listings.
        setListings(eventId ? items.filter((item) => String(item.eventId) === String(eventId)) : items);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => String(item.id ?? item.listingId)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ResaleDetail', { listingId: item.id ?? item.listingId })}>
            <View style={styles.cardHeader}>
              <Text style={styles.status}>{item.status}</Text>
              <Text style={styles.price}>{item.priceWei ?? item.price} WEI</Text>
            </View>
            <Text style={styles.title}>{item.eventName || `이벤트 ${String(item.eventId).slice(0, 8)}`}</Text>
            <Text style={styles.meta}>티켓 {String(item.ticketId).slice(0, 8)}</Text>
            <Text style={styles.meta}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>판매 중인 리셀 티켓이 없습니다.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  status: { color: '#007AFF', fontSize: 12, fontWeight: '900' },
  price: { color: '#212529', fontWeight: '900' },
  title: { color: '#212529', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  meta: { color: '#868E96', fontSize: 13, marginBottom: 3 },
  empty: { textAlign: 'center', color: '#868E96', paddingVertical: 100 },
});
