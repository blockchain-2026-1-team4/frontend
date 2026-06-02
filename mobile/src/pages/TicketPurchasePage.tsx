import { useProvider } from '@reown/appkit-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WalletRequiredView from '../components/WalletRequiredView';
import { backendApi } from '../lib/backend';
import { purchaseTicketOnChain } from '../lib/blockchain/client';
import { showDialog } from '../lib/dialog';
import { formatCompactDateTime, formatTicketStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail, UserProfile } from '../types/api';

function isAvailable(ticket?: TicketDetail | null) {
  return String(ticket?.status ?? '').toUpperCase() === 'AVAILABLE';
}

function sectionNameOf(ticket?: TicketDetail | null) {
  const source = String(ticket?.sectionName || ticket?.seatInfo || '').trim();
  return source.replace(/-\d+$/, '').replace(/^\d+회차-/, '') || '-';
}

function roundLabelOf(ticket?: TicketDetail | null, event?: EventDetail | null) {
  const ticketRoundId = ticket?.eventRoundId ? String(ticket.eventRoundId) : '';
  const matchedRound = event?.rounds?.find((round) => round.id && String(round.id) === ticketRoundId);
  if (matchedRound) return matchedRound.title || `${matchedRound.eventDate} ${matchedRound.startTime}`;

  const seatMatch = String(ticket?.seatInfo || ticket?.sectionName || '').match(/^(\d+)회차[-\s]/);
  if (seatMatch) return `${seatMatch[1]}회차`;
  return ticketRoundId || '-';
}

function priceLabel(value?: string) {
  if (!value) return '-';
  const eth = weiToEth(value);
  return eth === value ? `${value} WEI` : eth;
}

function resaleLabel(ticket?: TicketDetail | null, event?: EventDetail | null) {
  const enabled = ticket?.resaleEnabled ?? event?.resaleAllowed ?? false;
  const capRate = ticket?.resaleCapRate ?? event?.maxResalePriceRate;
  return enabled ? `허용 · 최대 ${Math.round((capRate ?? 0) / 100)}%` : '불가';
}

function getPurchaseState(ticket?: TicketDetail | null, event?: EventDetail | null) {
  if (!isAvailable(ticket)) return { label: '구매 불가', canPurchase: false };

  const now = Date.now();
  const saleStart = new Date(ticket?.saleStartAt || event?.primarySaleStart || event?.salesStartAt || '').getTime();
  const saleEnd = new Date(ticket?.saleEndAt || event?.primarySaleEnd || event?.salesEndAt || '').getTime();

  if (!Number.isNaN(saleStart) && now < saleStart) return { label: '예매 예정', canPurchase: false };
  if (!Number.isNaN(saleEnd) && now > saleEnd) return { label: '판매 종료', canPurchase: false };
  return { label: '티켓 예매하기', canPurchase: true };
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

export default function TicketPurchasePage({ route, navigation }: any) {
  const { ticketId, eventId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { provider } = useProvider();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ticketData, meData] = await Promise.all([
          backendApi.getTicket(String(ticketId)),
          backendApi.getMe().catch(() => null),
        ]);
        setTicket(ticketData);
        setMe(meData);
        const targetEventId = eventId ?? ticketData.eventId;
        if (targetEventId) setEvent(await backendApi.getEvent(String(targetEventId)));
      } catch (error: any) {
        showDialog('오류', error.message || '티켓 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ticketId, eventId]);

  const purchaseState = useMemo(() => getPurchaseState(ticket, event), [event, ticket]);

  const submitPurchase = async () => {
    setSubmitting(true);
    try {
      const tokenId = ticket?.contractTokenId;
      const priceWei = ticket?.originalPriceWei ?? ticket?.priceWei ?? event?.ticketPriceWei;
      if (!tokenId) throw new Error('온체인 tokenId가 없는 티켓입니다. 주최자가 티켓을 다시 발행해야 합니다.');
      if (!priceWei) throw new Error('티켓 가격 정보를 확인할 수 없습니다.');
      const transactionHash = await purchaseTicketOnChain(provider, String(tokenId), String(priceWei));
      const purchased = await backendApi.purchasePrimary(String(ticketId), transactionHash);
      navigation.replace('PurchaseComplete', { type: 'primary', ticketId: purchased.id ?? purchased.ticketId, eventId: purchased.eventId });
    } catch (error: any) {
      showDialog('구매 실패', error.message || '티켓 구매에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const purchase = () => {
    if (!purchaseState.canPurchase || submitting) return;
    showDialog('티켓 예매', '선택한 티켓을 예매할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '예매하기', onPress: () => void submitPurchase() },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  if (!ticket) return <View style={styles.center}><Text>티켓을 찾을 수 없습니다.</Text></View>;
  if (!me?.walletAddress?.trim()) return <WalletRequiredView navigation={navigation} feature="티켓 구매" />;

  const price = ticket.originalPriceWei ?? ticket.priceWei ?? event?.ticketPriceWei;
  const disabled = submitting || !purchaseState.canPurchase;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.stepLabel}>3단계 · 티켓 선택/좌석 정책</Text>
        <Text style={styles.title}>{event?.name || ticket.eventTitle || ticket.eventName || ticket.eventId}</Text>
        <Text style={styles.meta}>{event?.venueDetail || event?.venue || ticket.venue || '-'}</Text>
      </View>

      <View style={styles.card}>
        <Info label="회차" value={roundLabelOf(ticket, event)} />
        <Info label="구역명" value={sectionNameOf(ticket)} />
        <Info label="좌석" value={ticket.seatInfo} />
        <Info label="가격" value={priceLabel(price)} />
        <Info label="잔여 수량" value={isAvailable(ticket) ? '1장' : '0장'} />
        <Info label="리셀 가능 여부" value={resaleLabel(ticket, event)} />
        <Info label="판매 종료 시간" value={formatCompactDateTime(ticket.saleEndAt || event?.primarySaleEnd || event?.salesEndAt)} />
        <Info label="판매 상태" value={formatTicketStatus(ticket.status)} />
      </View>

      <TouchableOpacity style={[styles.button, disabled && styles.disabled]} disabled={disabled} onPress={purchase}>
        <Text style={styles.buttonText}>{submitting ? '구매 처리 중...' : purchaseState.label}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  stepLabel: { color: '#2563EB', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  title: { color: '#0F172A', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  meta: { color: '#64748B', fontWeight: '800' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { color: '#64748B', fontWeight: '900', fontSize: 13 },
  infoValue: { color: '#0F172A', fontWeight: '900', flex: 1, textAlign: 'right', lineHeight: 19 },
  button: { backgroundColor: '#2563EB', padding: 17, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
