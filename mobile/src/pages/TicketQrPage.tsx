import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { backendApi } from '../lib/backend';
import type { TicketDetail, TicketQr } from '../types/api';

export default function TicketQrPage({ route }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [qr, setQr] = useState<TicketQr | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQr = async () => {
    setLoading(true);
    try {
      const ticketData = await backendApi.getTicket(String(ticketId));
      setTicket(ticketData);
      const claimedOwner = ticketData.ownerWalletAddress || ticketData.ownerAddress || 'mobile-user';
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      // TODO: Replace the development signature placeholder with a wallet signature flow.
      setQr(await backendApi.createTicketQr(String(ticketId), { claimedOwner, expiresAt, signature: 'mobile-dev-signature' }));
    } catch (error: any) {
      Alert.alert('QR 생성 실패', error.message || 'QR을 생성하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQr();
  }, [ticketId]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  const qrValue = qr?.payload || JSON.stringify({ ticketId, owner: ticket?.ownerWalletAddress });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        {qr?.qrPngBase64 ? (
          <Image style={styles.qrImage} source={{ uri: `data:image/png;base64,${qr.qrPngBase64}` }} />
        ) : (
          <QRCode value={qrValue} size={220} />
        )}
        <Text style={styles.hint}>입장 시 이 화면을 제시하세요.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>바코드</Text>
        <Text style={styles.barcode}>{qr?.barcodeText || String(ticketId)}</Text>
        <Text style={styles.expires}>만료: {qr?.expiresAt ? new Date(qr.expiresAt).toLocaleString() : '-'}</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={loadQr}>
        <Text style={styles.buttonText}>QR 새로고침</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20, alignItems: 'stretch' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' },
  qrImage: { width: 220, height: 220 },
  hint: { color: '#868E96', marginTop: 16 },
  label: { color: '#868E96', fontWeight: '800', marginBottom: 8 },
  barcode: { color: '#212529', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  expires: { color: '#868E96', marginTop: 10 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '900' },
});
