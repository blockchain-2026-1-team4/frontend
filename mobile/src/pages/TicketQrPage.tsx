import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { backendApi } from '../lib/backend';
import { formatTicketEntryStatus, isTicketUsableForEntry } from '../lib/ticketDisplay';
import type { TicketDetail, TicketQr, UserProfile } from '../types/api';

export default function TicketQrPage({ route }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [qr, setQr] = useState<TicketQr | null>(null);
  const [messageHash, setMessageHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const createDevelopmentSignature = (_hash?: string) => {
    // TODO: Replace this with a real mobile wallet signature over the check-in message hash.
    return 'mobile-dev-signature';
  };

  const loadQr = async () => {
    setLoading(true);
    try {
      const ticketData = await backendApi.getTicket(String(ticketId));
      setTicket(ticketData);
      const claimedOwner = ticketData.ownerWalletAddress || ticketData.ownerAddress || 'mobile-user';
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const checkInMessage = await backendApi.getTicketCheckInMessage(String(ticketId), { claimedOwner, expiresAt });
      const hash = String(checkInMessage.messageHash ?? '');
      setMessageHash(hash);

      const signature = createDevelopmentSignature(hash);
      setQr(await backendApi.createTicketQr(String(ticketId), { claimedOwner, expiresAt, signature }));
    } catch (error: any) {
      Alert.alert('QR 생성 실패', error.message || 'QR을 생성하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQr();
  }, [ticketId]);

  const qrValue = qr?.payload || JSON.stringify({ ticketId, owner: ticket?.ownerWalletAddress });
  const ticketNumber = qr?.barcodeText || ticket?.contractTokenId || String(ticketId);
  const usable = isTicketUsableForEntry(ticket?.status);
  const status = formatTicketEntryStatus(ticket?.status);
  const expiresText = useMemo(() => (qr?.expiresAt ? new Date(qr.expiresAt).toLocaleString() : '-'), [qr?.expiresAt]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, usable ? styles.usableBadge : styles.disabledBadge]}>
          <Text style={[styles.statusText, usable ? styles.usableText : styles.disabledText]}>{status}</Text>
        </View>
      </View>

      <View style={styles.qrCard}>
        <Text style={styles.cardTitle}>모바일 체크인 QR</Text>
        <Text style={styles.cardText}>입장 시 스태프에게 이 QR 코드를 제시해주세요.</Text>
        <View style={styles.qrFrame}>
          {qr?.qrPngBase64 ? (
            <Image style={styles.qrImage} source={{ uri: `data:image/png;base64,${qr.qrPngBase64}` }} />
          ) : (
            <QRCode value={qrValue} size={240} />
          )}
        </View>
        <Text style={styles.expires}>만료 시간 {expiresText}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>티켓 번호</Text>
        <Text style={styles.ticketNumber}>{ticketNumber}</Text>
        <Text style={styles.infoText}>현재 바코드는 별도 스캐너 연동 없이 티켓 식별 번호로만 표시됩니다.</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>QR 갱신</Text>
        <Text style={styles.infoText}>QR 새로고침은 5분 유효기간의 체크인 payload를 다시 발급합니다. 현재 모바일 서명은 개발용 서명값을 사용 중입니다.</Text>
        {messageHash ? <Text style={styles.hashText}>서명 메시지 {messageHash.slice(0, 12)}...</Text> : null}
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
  statusRow: { alignItems: 'flex-start', marginBottom: 12 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  usableBadge: { backgroundColor: '#ECFDF5' },
  disabledBadge: { backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 13, fontWeight: '900' },
  usableText: { color: '#047857' },
  disabledText: { color: '#64748B' },
  qrCard: { backgroundColor: '#fff', borderRadius: 12, padding: 22, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' },
  cardTitle: { color: '#212529', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  cardText: { color: '#64748B', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 18 },
  qrFrame: { padding: 10, backgroundColor: '#FFFFFF', borderRadius: 10 },
  qrImage: { width: 240, height: 240 },
  expires: { color: '#495057', marginTop: 16, fontWeight: '800' },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E9ECEF' },
  infoTitle: { color: '#212529', fontSize: 15, fontWeight: '900', marginBottom: 8 },
  ticketNumber: { color: '#212529', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  infoText: { color: '#64748B', fontSize: 13, lineHeight: 20 },
  hashText: { color: '#868E96', marginTop: 10, fontSize: 12, fontWeight: '800' },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '900' },
});
