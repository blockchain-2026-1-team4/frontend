import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventDetail, TicketDetail } from '../types/api';

export default function TicketDetailPage({ route, navigation }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [validity, setValidity] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTicket = async () => {
      try {
        const data = await backendApi.getTicket(String(ticketId));
        setTicket(data);
        setEvent(await backendApi.getEvent(String(data.eventId)));
        setValidity(await backendApi.getTicketValidity(String(ticketId)));
      } catch (error: any) {
        Alert.alert('오류', error.message || '티켓 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadTicket();
  }, [ticketId]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!ticket) return <View style={styles.center}><Text>티켓 정보를 찾을 수 없습니다.</Text></View>;

  const canResale = ['OWNED', 'PURCHASED'].includes(String(ticket.status));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eventTitle}>{event?.name || ticket.eventTitle || ticket.eventName || '티켓'}</Text>
        <Text style={styles.venueText}>{event?.venue || ticket.venue || '-'}</Text>
        <Text style={styles.dateText}>{event?.eventAt ? new Date(event.eventAt).toLocaleString() : '-'}</Text>
      </View>

      <View style={styles.detailCard}>
        <Info label="좌석" value={ticket.seatInfo} />
        <Info label="상태" value={ticket.status} />
        <Info label="원가" value={`${ticket.originalPriceWei ?? ticket.priceWei ?? '-'} WEI`} />
        <Info label="유효성" value={validity?.valid === false ? String(validity.reason || 'INVALID') : 'VALID'} />
        <Info label="토큰 ID" value={String(ticket.contractTokenId ?? '-')} />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TicketQr', { ticketId: ticket.id ?? ticket.ticketId })}>
        <Text style={styles.primaryButtonText}>QR / 바코드 보기</Text>
      </TouchableOpacity>

      {canResale ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('TicketResaleCreate', { ticketId: ticket.id ?? ticket.ticketId })}>
          <Text style={styles.secondaryButtonText}>티켓 판매 등록</Text>
        </TouchableOpacity>
      ) : null}
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
  headerCard: { backgroundColor: '#fff', padding: 24, borderRadius: 12, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' },
  eventTitle: { fontSize: 22, fontWeight: '900', color: '#212529', marginBottom: 8, textAlign: 'center' },
  venueText: { fontSize: 15, color: '#495057', marginBottom: 4 },
  dateText: { fontSize: 13, color: '#868E96' },
  detailCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  infoRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  infoLabel: { fontSize: 12, color: '#868E96', marginBottom: 4, fontWeight: 'bold' },
  infoValue: { fontSize: 15, color: '#212529', fontWeight: '800' },
  primaryButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 18 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '900' },
});
