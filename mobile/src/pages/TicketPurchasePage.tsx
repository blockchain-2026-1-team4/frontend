import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import { formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

export default function TicketPurchasePage({ route, navigation }: any) {
  const { ticketId, eventId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const ticketData = await backendApi.getTicket(String(ticketId));
        setTicket(ticketData);
        const targetEventId = eventId ?? ticketData.eventId;
        if (targetEventId) setEvent(await backendApi.getEvent(String(targetEventId)));
      } catch (error: any) {
        Alert.alert('오류', error.message || '티켓 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ticketId, eventId]);

  const purchase = async () => {
    setSubmitting(true);
    try {
      const purchased = await backendApi.purchasePrimary(String(ticketId));
      navigation.replace('PurchaseComplete', { type: 'primary', ticketId: purchased.id ?? purchased.ticketId, eventId: purchased.eventId });
    } catch (error: any) {
      Alert.alert('구매 실패', error.message || '티켓 구매에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!ticket) return <View style={styles.center}><Text>티켓을 찾을 수 없습니다.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>이벤트</Text>
        <Text style={styles.title}>{event?.name || ticket.eventTitle || ticket.eventName || ticket.eventId}</Text>
        <Text style={styles.meta}>{event?.venue || ticket.venue || '-'}</Text>
      </View>
      <View style={styles.card}>
        <Info label="좌석" value={ticket.seatInfo} />
        <Info label="상태" value={formatTicketStatus(ticket.status)} />
        <Info label="가격" value={`${ticket.originalPriceWei ?? ticket.priceWei ?? event?.ticketPriceWei ?? '-'} WEI`} />
      </View>
      <TouchableOpacity style={[styles.button, submitting && styles.disabled]} disabled={submitting} onPress={purchase}>
        <Text style={styles.buttonText}>{submitting ? '구매 처리 중...' : '티켓 구매하기'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E9ECEF' },
  label: { color: '#007AFF', fontWeight: '900', marginBottom: 6 },
  title: { color: '#212529', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  meta: { color: '#868E96' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  infoLabel: { color: '#868E96', fontWeight: '700' },
  infoValue: { color: '#212529', fontWeight: '900', flex: 1, textAlign: 'right' },
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
