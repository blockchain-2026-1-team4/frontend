import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventSummary } from '../types/api';

export default function EventListPage({ navigation, route }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [query, setQuery] = useState(route?.params?.query ?? '');
  const [loading, setLoading] = useState(true);
  const category = route?.params?.category;

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await backendApi.getEvents({ query: query.trim() || undefined, category, size: 30 });
      setEvents(data.items ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [category]);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="검색어" returnKeyType="search" onSubmitEditing={loadEvents} />
        <TouchableOpacity style={styles.button} onPress={loadEvents}>
          <Text style={styles.buttonText}>검색</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.title}>{item.name || item.title}</Text>
              <Text style={styles.meta}>{item.venue}</Text>
              <Text style={styles.meta}>{item.eventAt ? new Date(item.eventAt).toLocaleString() : '-'}</Text>
              <Text style={styles.price}>{item.ticketPriceWei ? `${item.ticketPriceWei} WEI` : '가격 정보 없음'}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>검색 결과가 없습니다.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: { flexDirection: 'row', gap: 10, padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  input: { flex: 1, backgroundColor: '#F1F3F5', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#007AFF', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: '#fff', fontWeight: '900' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  category: { color: '#007AFF', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  title: { color: '#212529', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  meta: { color: '#868E96', fontSize: 13, marginBottom: 3 },
  price: { color: '#212529', fontSize: 14, fontWeight: '800', marginTop: 8 },
  empty: { textAlign: 'center', color: '#868E96', paddingVertical: 80 },
});
