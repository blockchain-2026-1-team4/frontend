import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { backendApi } from '../lib/backend';
import type { TicketDetail } from '../types/api';

export default function TicketDetailPage({ route, navigation }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      const data = await backendApi.getTicket(ticketId);
      setTicket(data);
      
      // In a real app, the QR data would be a signed message or token from the backend
      const qrResponse = await backendApi.createTicketQr(ticketId, { timestamp: Date.now() });
      setQrData(JSON.stringify(qrResponse));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResale = () => {
    navigation.navigate('TicketResaleCreate', { ticketId: ticket?.id });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.center}>
        <Text>티켓 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Event Header */}
      <View style={styles.headerCard}>
        <Text style={styles.eventTitle}>{ticket.eventTitle}</Text>
        <Text style={styles.venueText}>{ticket.venue}</Text>
        <Text style={styles.dateText}>{new Date(ticket.eventDateTime).toLocaleString()}</Text>
      </View>

      {/* Ticket Details */}
      <View style={styles.detailCard}>
        <View style={styles.qrContainer}>
          {qrData ? (
            <QRCode value={qrData} size={200} />
          ) : (
            <View style={styles.qrPlaceholder} />
          )}
          <Text style={styles.qrHint}>입장 시 이 QR 코드를 제시해 주세요.</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>좌석 정보</Text>
            <Text style={styles.infoValue}>{ticket.seatInfo}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>상태</Text>
            <Text style={styles.infoValue}>{ticket.status}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>구매 가격</Text>
            <Text style={styles.infoValue}>{ticket.priceWei} WEI</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>소유자</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{ticket.ownerAddress.slice(0, 6)}...{ticket.ownerAddress.slice(-4)}</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionContainer}>
        {ticket.status === 'OWNED' && (
          <TouchableOpacity style={styles.resaleButton} onPress={handleResale}>
            <Text style={styles.resaleButtonText}>리셀 판매 등록하기</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { backgroundColor: '#fff', padding: 25, borderRadius: 15, marginBottom: 20, alignItems: 'center', elevation: 2 },
  eventTitle: { fontSize: 24, fontWeight: 'bold', color: '#212529', marginBottom: 8, textAlign: 'center' },
  venueText: { fontSize: 16, color: '#495057', marginBottom: 4 },
  dateText: { fontSize: 14, color: '#868E96' },
  detailCard: { backgroundColor: '#fff', padding: 25, borderRadius: 15, elevation: 2 },
  qrContainer: { alignItems: 'center', marginBottom: 30, paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: '#eee' },
  qrPlaceholder: { width: 200, height: 200, backgroundColor: '#f5f5f5' },
  qrHint: { marginTop: 15, fontSize: 13, color: '#868E96' },
  infoRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  infoBox: { flex: 1, backgroundColor: '#F8F9FA', padding: 12, borderRadius: 10 },
  infoLabel: { fontSize: 11, color: '#868E96', marginBottom: 4, fontWeight: 'bold' },
  infoValue: { fontSize: 14, color: '#212529', fontWeight: '600' },
  actionContainer: { marginTop: 20 },
  resaleButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center' },
  resaleButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
