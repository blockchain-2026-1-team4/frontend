import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventDetail, ResaleListing, TicketDetail } from '../types/api';

export default function ResaleDetailPage({ route, navigation }: any) {
  const { listingId } = route.params;
  const [listing, setListing] = useState<ResaleListing | null>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const listingData = await backendApi.getResaleListing(String(listingId));
        setListing(listingData);
        const ticketData = await backendApi.getTicket(String(listingData.ticketId));
        setTicket(ticketData);
        setEvent(await backendApi.getEvent(String(listingData.eventId)));
      } catch (error: any) {
        Alert.alert('오류', error.message || '리셀 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [listingId]);

  const purchase = async () => {
    setSubmitting(true);
    try {
      const purchased = await backendApi.purchaseResale(String(listingId));
      navigation.replace('PurchaseComplete', { type: 'resale', listingId: purchased.id ?? purchased.listingId, ticketId: purchased.ticketId, eventId: purchased.eventId });
    } catch (error: any) {
      Alert.alert('구매 실패', error.message || '리셀 티켓 구매에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!listing) return <View style={styles.center}><Text>리셀 등록을 찾을 수 없습니다.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.status}>{listing.status}</Text>
        <Text style={styles.title}>{event?.name || listing.eventName || '리셀 티켓'}</Text>
        <Text style={styles.meta}>{event?.venue || '-'}</Text>
        <Text style={styles.meta}>{event?.eventAt ? new Date(event.eventAt).toLocaleString() : '-'}</Text>
      </View>
      <View style={styles.card}>
        <Info label="좌석" value={ticket?.seatInfo || listing.seatInfo || '-'} />
        <Info label="리셀 가격" value={`${listing.priceWei ?? listing.price ?? '-'} WEI`} />
        <Info label="티켓 ID" value={String(listing.ticketId)} />
      </View>
      <TouchableOpacity style={[styles.button, submitting && styles.disabled]} disabled={submitting || listing.status !== 'ACTIVE'} onPress={purchase}>
        <Text style={styles.buttonText}>{submitting ? '구매 처리 중...' : '리셀 티켓 구매하기'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('DisputeCreate', { resaleListingId: listing.id ?? listing.listingId, ticketId: listing.ticketId })}
      >
        <Text style={styles.secondaryButtonText}>이 리셀 거래 분쟁 신고</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E9ECEF' },
  status: { color: '#007AFF', fontWeight: '900', marginBottom: 8 },
  title: { color: '#212529', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  meta: { color: '#868E96', marginBottom: 4 },
  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  infoLabel: { color: '#868E96', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  infoValue: { color: '#212529', fontWeight: '900' },
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  secondaryButton: { borderWidth: 1, borderColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
