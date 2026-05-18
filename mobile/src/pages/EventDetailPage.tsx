import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventDetail, ResaleListing, TicketDetail } from '../types/api';

export default function EventDetailPage({ route, navigation }: any) {
  const { eventId } = route.params;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [resales, setResales] = useState<ResaleListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [eventData, ticketData, resaleData] = await Promise.all([
          backendApi.getEvent(eventId),
          backendApi.getEventTickets(eventId),
          backendApi.getResaleListings({ size: 50 }),
        ]);
        setEvent(eventData);
        setTickets(ticketData);
        // TODO: Replace client-side filtering when backend adds GET /resale-listings?eventId=...
        setResales((resaleData.items ?? []).filter((listing) => String(listing.eventId) === String(eventId)));
      } catch (error: any) {
        Alert.alert('오류', error.message || '이벤트 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const availableTickets = useMemo(
    () => tickets.filter((ticket) => ['ISSUED', 'AVAILABLE'].includes(String(ticket.status))),
    [tickets],
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  if (!event) {
    return <View style={styles.center}><Text>이벤트를 찾을 수 없습니다.</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.category}>{event.category}</Text>
        <Text style={styles.title}>{event.name || event.title}</Text>
        <Text style={styles.meta}>{event.venue}</Text>
        <Text style={styles.meta}>{event.eventAt ? new Date(event.eventAt).toLocaleString() : '-'}</Text>
      </View>

      <Text style={styles.description}>{event.description || '상세 설명이 없습니다.'}</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{event.remainingTicketCount ?? '-'}</Text>
          <Text style={styles.summaryLabel}>잔여 티켓</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{event.ticketPriceWei ?? '-'}</Text>
          <Text style={styles.summaryLabel}>1차 가격(WEI)</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>1차 판매 티켓</Text>
        <Text style={styles.sectionHint}>{availableTickets.length}개</Text>
      </View>
      <FlatList
        data={availableTickets.slice(0, 5)}
        scrollEnabled={false}
        keyExtractor={(item) => String(item.id ?? item.ticketId)}
        ListEmptyComponent={<Text style={styles.empty}>구매 가능한 1차 티켓이 없습니다.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.ticketRow} onPress={() => navigation.navigate('TicketPurchase', { ticketId: item.id ?? item.ticketId, eventId })}>
            <View>
              <Text style={styles.rowTitle}>{item.seatInfo}</Text>
              <Text style={styles.rowMeta}>{item.originalPriceWei ?? item.priceWei ?? event.ticketPriceWei} WEI</Text>
            </View>
            <Text style={styles.rowAction}>예매</Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>리셀 티켓</Text>
        <Text style={styles.sectionHint}>{resales.length}개</Text>
      </View>
      <FlatList
        data={resales.slice(0, 5)}
        scrollEnabled={false}
        keyExtractor={(item) => String(item.id ?? item.listingId)}
        ListEmptyComponent={<Text style={styles.empty}>등록된 리셀 티켓이 없습니다.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.ticketRow} onPress={() => navigation.navigate('ResaleDetail', { listingId: item.id ?? item.listingId })}>
            <View>
              <Text style={styles.rowTitle}>티켓 {String(item.ticketId).slice(0, 8)}</Text>
              <Text style={styles.rowMeta}>{item.priceWei ?? item.price} WEI</Text>
            </View>
            <Text style={styles.rowAction}>보기</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('ResaleList', { eventId })}>
        <Text style={styles.secondaryButtonText}>리셀 목록 더 보기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { backgroundColor: '#fff', borderRadius: 12, padding: 22, borderWidth: 1, borderColor: '#E9ECEF', marginBottom: 16 },
  category: { color: '#007AFF', fontWeight: '900', marginBottom: 8 },
  title: { fontSize: 25, fontWeight: '900', color: '#212529', marginBottom: 10 },
  meta: { color: '#495057', fontSize: 14, marginBottom: 4 },
  description: { color: '#495057', fontSize: 15, lineHeight: 22, marginBottom: 18 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E9ECEF' },
  summaryValue: { color: '#212529', fontSize: 18, fontWeight: '900' },
  summaryLabel: { color: '#868E96', fontSize: 12, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  sectionTitle: { color: '#212529', fontSize: 17, fontWeight: '900' },
  sectionHint: { color: '#868E96', fontSize: 12 },
  ticketRow: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' },
  rowTitle: { color: '#212529', fontWeight: '900', marginBottom: 4 },
  rowMeta: { color: '#868E96', fontSize: 13 },
  rowAction: { color: '#007AFF', fontWeight: '900' },
  empty: { color: '#868E96', paddingVertical: 16 },
  secondaryButton: { borderWidth: 1, borderColor: '#007AFF', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  secondaryButtonText: { color: '#007AFF', fontWeight: '900' },
});
