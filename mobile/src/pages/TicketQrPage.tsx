import { useProvider } from '@reown/appkit-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { FlowBadge, FlowHero, IconButton, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { backendApi } from '../lib/backend';
import { signCheckInMessageHash } from '../lib/blockchain/client';
import { compactId, entryStatusOf, ownerAddressOf } from '../lib/ticketFlowDisplay';
import type { TicketDetail, TicketQr } from '../types/api';

function remainingText(expiresAt?: string, now = Date.now()) {
  if (!expiresAt) return '새로고침 가능';
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return '새로고침 가능';
  const seconds = Math.max(0, Math.floor((expires - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${String(minutes).padStart(2, '0')}:${rest} · 새로고침`;
}

export default function TicketQrPage({ route, navigation }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [qr, setQr] = useState<TicketQr | null>(null);
  const [messageHash, setMessageHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const { provider } = useProvider();

  const loadQr = async () => {
    setLoading(true);
    try {
      const ticketData = await backendApi.getTicket(String(ticketId));
      setTicket(ticketData);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const ownerHint = ownerAddressOf(ticketData);
      if (!ownerHint) throw new Error('티켓 소유자 지갑 주소를 찾을 수 없습니다.');

      const checkInMessage = await backendApi.getTicketCheckInMessage(String(ticketId), { claimedOwner: ownerHint, expiresAt });
      const hash = String(checkInMessage.messageHash ?? '');
      setMessageHash(hash);

      const signed = await signCheckInMessageHash(provider, hash);
      if (signed.address.toLowerCase() !== ownerHint.toLowerCase()) {
        throw new Error('현재 연결된 지갑이 티켓 소유자 지갑과 다릅니다.');
      }
      setQr(await backendApi.createTicketQr(String(ticketId), { claimedOwner: ownerHint, expiresAt, signature: signed.signature }));
      setNow(Date.now());
    } catch (error: any) {
      Alert.alert('QR 생성 실패', error.message || 'QR을 생성하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQr();
  }, [ticketId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const qrValue = qr?.payload || JSON.stringify({ ticketId, owner: ownerAddressOf(ticket) });
  const ticketNumber = qr?.barcodeText || ticket?.contractTokenId || String(ticketId);
  const entry = entryStatusOf(ticket);
  const timerText = useMemo(() => remainingText(qr?.expiresAt, now), [now, qr?.expiresAt]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.84}>
          <IconButton><TicketIcon name="arrowLeft" size={20} /></IconButton>
        </TouchableOpacity>
        <Text style={styles.topTitle}>입장 QR</Text>
        <FlowBadge label={entry.label} tone={entry.tone === 'red' ? 'red' : entry.tone === 'gray' ? 'gray' : 'green'} />
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FlowHero
          height={166}
          style={styles.qrHero}
          posters={false}
          badge="모바일 체크인"
          title={'입장 전 QR을\n제시하세요'}
          meta="5분마다 새로운 체크인 payload가 발급됩니다."
        />

        <View style={styles.section}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>모바일 체크인 QR</Text>
            <Text style={styles.qrSub}>스태프에게 이 화면을 보여주세요.</Text>
            <View style={styles.qrBox}>
              {qr?.qrPngBase64 ? (
                <Image style={styles.qrImage} source={{ uri: `data:image/png;base64,${qr.qrPngBase64}` }} />
              ) : (
                <QRCode value={qrValue} size={218} />
              )}
            </View>
            <View style={styles.timer}>
              <TicketIcon name="clock" size={15} color="#534AB7" />
              <Text style={styles.timerText}>{timerText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.infoPanel}>
            <View style={styles.infoIcon}><TicketIcon name="ticket" size={21} color="#534AB7" /></View>
            <View style={styles.infoCopy}>
              <Text style={styles.tipTitle}>티켓 번호</Text>
              <Text style={styles.ticketNumber}>{ticketNumber}</Text>
              <Text style={styles.tipSub}>QR 인식 실패 시 티켓 번호로도 확인할 수 있습니다.</Text>
            </View>
          </View>
        </View>

        {messageHash ? (
          <View style={styles.section}>
            <View style={styles.infoPanel}>
              <View style={styles.infoIcon}><TicketIcon name="shield" size={21} color="#534AB7" /></View>
              <View style={styles.infoCopy}>
                <Text style={styles.tipTitle}>서명 메시지</Text>
                <Text style={styles.tipSub}>{compactId(messageHash, 12, 8)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.refresh}>
          <TouchableOpacity style={styles.primaryButton} onPress={loadQr} activeOpacity={0.88}>
            <TicketIcon name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>QR 새로고침</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  screen: { flex: 1 },
  content: { paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  topbar: {
    backgroundColor: 'rgba(246,247,251,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  qrHero: { marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  qrCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 20, alignItems: 'center', ...flowShadow },
  qrTitle: { fontSize: 21, fontWeight: '900', color: '#0F172A', marginBottom: 5, textAlign: 'center' },
  qrSub: { fontSize: 12, color: '#64748B', lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  qrBox: { width: 226, height: 226, marginTop: 16, marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 12, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  qrImage: { width: 218, height: 218 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEEDFE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  timerText: { color: '#534AB7', fontSize: 12, fontWeight: '900' },
  infoPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start', ...flowShadow },
  infoIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoCopy: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  tipSub: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  ticketNumber: { fontSize: 13, color: '#0F172A', lineHeight: 18, fontWeight: '900', marginBottom: 3 },
  refresh: { paddingHorizontal: 16, paddingBottom: 14 },
  primaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: '#534AB7', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', ...flowShadow },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
