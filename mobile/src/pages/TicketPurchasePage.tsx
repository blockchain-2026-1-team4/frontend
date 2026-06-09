import { useProvider } from '@reown/appkit-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WalletRequiredView from '../components/WalletRequiredView';
import { PosterThumb, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { backendApi } from '../lib/backend';
import { purchaseTicketOnChain } from '../lib/blockchain/client';
import { resolveImageUrl } from '../lib/config';
import { showDialog } from '../lib/dialog';
import { formatCompactDateTime, weiToEth } from '../lib/ticketDisplay';
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
  return ticketRoundId || '기본 회차';
}

function roundStartTimeOf(ticket?: TicketDetail | null, event?: EventDetail | null) {
  const ticketRoundId = ticket?.eventRoundId ? String(ticket.eventRoundId) : '';
  const matchedRound = event?.rounds?.find((round) => round.id && String(round.id) === ticketRoundId);
  if (matchedRound) {
    const startStr = matchedRound.eventDate && matchedRound.startTime
      ? `${matchedRound.eventDate}T${matchedRound.startTime}`
      : matchedRound.eventDate;
    return formatCompactDateTime(startStr);
  }
  return formatCompactDateTime(event?.eventStartAt || event?.startsAt || event?.eventAt || event?.eventDateTime);
}

function priceLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '-';
  const eth = weiToEth(value);
  return eth === String(value) ? `${value} WEI` : eth;
}

function resaleLabel(ticket?: TicketDetail | null, event?: EventDetail | null) {
  const enabled = ticket?.resaleEnabled ?? event?.resaleAllowed ?? false;
  if (!enabled) return '불가';
  const capRate = ticket?.resaleCapRate ?? event?.maxResalePriceRate;
  return capRate ? `가능 · 최대 ${Math.round(capRate / 100)}%` : '가능';
}

function getPurchaseState(ticket?: TicketDetail | null, event?: EventDetail | null) {
  if (!isAvailable(ticket)) return { label: '구매 불가', canPurchase: false };

  const now = Date.now();
  const saleStart = new Date(ticket?.saleStartAt || event?.primarySaleStart || event?.salesStartAt || '').getTime();
  const saleEnd = new Date(ticket?.saleEndAt || event?.primarySaleEnd || event?.salesEndAt || '').getTime();

  if (!Number.isNaN(saleStart) && now < saleStart) return { label: '예매 전', canPurchase: false };
  if (!Number.isNaN(saleEnd) && now > saleEnd) return { label: '예매 종료', canPurchase: false };
  return { label: '예매하기', canPurchase: true };
}

function eventTitle(event?: EventDetail | null, ticket?: TicketDetail | null) {
  return event?.name || event?.title || ticket?.eventTitle || ticket?.eventName || ticket?.eventId || '이벤트';
}

function eventVenue(event?: EventDetail | null, ticket?: TicketDetail | null) {
  return event?.venueDetail || event?.location?.address || event?.location?.name || event?.venue || ticket?.venue || '장소 미정';
}

function walletShort(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  if (text.length <= 14) return text;
  return `${text.slice(0, 6)}...${text.slice(-6)}`;
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
    void load();
  }, [ticketId, eventId]);

  const purchaseState = useMemo(() => getPurchaseState(ticket, event), [event, ticket]);

  const submitPurchase = async () => {
    setSubmitting(true);
    try {
      const tokenId = ticket?.contractTokenId;
      const priceWei = event?.ticketPriceWei ?? ticket?.originalPriceWei ?? ticket?.priceWei;
      
      console.log('[PrimaryPurchase] ticket:', ticket);
      console.log('[PrimaryPurchase] event:', event);
      console.log('[PrimaryPurchase] tokenId:', tokenId);
      console.log('[PrimaryPurchase] priceWei:', priceWei);
      
      if (!tokenId) throw new Error('티켓 tokenId가 없습니다. 주최자가 티켓을 다시 발행해야 합니다.');
      if (!priceWei) throw new Error('티켓 가격 정보를 확인할 수 없습니다.');
      const transactionHash = await purchaseTicketOnChain(provider, String(tokenId), String(priceWei));
      
      console.log('[PrimaryPurchase] transactionHash:', transactionHash);
      
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;
  if (!ticket) return <View style={styles.center}><Text style={styles.empty}>티켓을 찾을 수 없습니다.</Text></View>;
  if (!me?.walletAddress?.trim()) return <WalletRequiredView navigation={navigation} feature="티켓 구매" />;

  const price = ticket.originalPriceWei ?? ticket.priceWei ?? event?.ticketPriceWei;
  const disabled = submitting || !purchaseState.canPurchase;
  const section = sectionNameOf(ticket);
  const seat = ticket.seatInfo || '-';
  const round = roundLabelOf(ticket, event);
  const title = eventTitle(event, ticket);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} activeOpacity={0.84}>
          <TicketIcon name="arrowLeft" size={20} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Ticket Checkout</Text>
          <Text style={styles.topTitle}>예매 확인</Text>
        </View>
        <Text style={styles.status}>{purchaseState.canPurchase ? '예매 중' : purchaseState.label}</Text>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A1A2E', '#534AB7', '#1D9E75']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.guide}>
          <Text style={styles.guideChip}>최종 확인</Text>
          <Text style={styles.guideTitle}>선택한 티켓과{'\n'}결제 정보를 확인하세요</Text>
          <Text style={styles.guideSub}>예매 완료 후 티켓은 연결된 지갑 주소로 발급됩니다.</Text>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadCopy}>
              <Text style={styles.sectionTitle}>선택한 티켓</Text>
              <Text style={styles.sectionSub}>이벤트, 좌석, 판매 조건을 한 번에 확인합니다.</Text>
            </View>
            <TouchableOpacity style={styles.changeButton} onPress={() => navigation.goBack()} activeOpacity={0.84}>
              <Text style={styles.changeText}>변경</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.eventCard}>
            <PosterThumb imageUrl={resolveImageUrl(event?.imageUrl)} title={title} style={styles.poster} />
            <View style={styles.eventMain}>
              <View style={styles.tagRow}>
                <Text style={styles.tag}>{section}</Text>
                <Text style={styles.tag}>{round}</Text>
              </View>
              <Text style={styles.eventName} numberOfLines={2}>{title}</Text>
              <View style={styles.meta}>
                <TicketIcon name="map" size={15} color="#64748B" />
                <Text style={styles.metaText} numberOfLines={2}>{eventVenue(event, ticket)}</Text>
              </View>
              <View style={styles.meta}>
                <TicketIcon name="calendar" size={15} color="#64748B" />
                <Text style={styles.metaText}>{roundStartTimeOf(ticket, event)}</Text>
              </View>

              <View style={styles.selectedSeatBox}>
                <View>
                  <Text style={styles.seatLabel}>선택 좌석</Text>
                  <Text style={styles.seatTitle}>{seat}</Text>
                </View>
                <Text style={styles.available}>판매 가능</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>결제 정보</Text>
              <Text style={styles.sectionSub}>최종 결제 조건만 확인합니다.</Text>
            </View>
          </View>

          <View style={styles.payCard}>
            <PayRow label="티켓 금액" value={priceLabel(price)} />
            <PayRow label="리셀 가능 여부" value={resaleLabel(ticket, event)} />
            <PayRow label="수수료" value="무료" />
            <PayRow label="총 결제 금액" value={priceLabel(price)} total />
          </View>

          <View style={styles.walletNote}>
            <TicketIcon name="wallet" size={19} color="#534AB7" />
            <View style={styles.noteCopy}>
              <Text style={styles.noteTitle}>연결된 지갑으로 티켓을 발급합니다.</Text>
              <Text style={styles.noteSub}>결제 전 지갑 주소가 맞는지 확인하세요. 현재 지갑: {walletShort(me.walletAddress)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.paybar}>
        <View style={styles.paySummary}>
          <Text style={styles.payLabel}>결제 예정</Text>
          <Text style={styles.payAmount} numberOfLines={1}>{priceLabel(price)}</Text>
        </View>
        <TouchableOpacity style={[styles.payButton, disabled && styles.payButtonDisabled]} disabled={disabled} onPress={purchase} activeOpacity={0.88}>
          <TicketIcon name="ticket" size={20} color="#FFFFFF" />
          <Text style={styles.payButtonText}>{submitting ? '예매 처리 중...' : purchaseState.label}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PayRow({ label, value, total }: { label: string; value?: string | number | null; total?: boolean }) {
  return (
    <View style={[styles.payRow, total && styles.payTotal]}>
      <Text style={[styles.payKey, total && styles.payTotalKey]}>{label}</Text>
      <Text style={[styles.payVal, total && styles.payTotalVal]} numberOfLines={1}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  screen: { flex: 1 },
  content: { paddingBottom: 150 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  empty: { color: '#94A3B8', fontWeight: '800' },
  topbar: {
    height: 72,
    backgroundColor: 'rgba(246,247,251,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
  },
  iconButton: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', ...flowShadow },
  titleWrap: { alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 2 },
  topTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  status: { height: 30, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#DCFCE7', color: '#0F6E56', fontSize: 11, fontWeight: '900', overflow: 'hidden' },
  guide: { marginHorizontal: 16, marginTop: 14, marginBottom: 14, borderRadius: 26, paddingHorizontal: 18, paddingVertical: 20, ...flowShadow },
  guideChip: { alignSelf: 'flex-start', height: 28, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.17)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', color: '#FFFFFF', fontSize: 10, fontWeight: '900', overflow: 'hidden', marginBottom: 9 },
  guideTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', lineHeight: 28, letterSpacing: -0.8, marginBottom: 6 },
  guideSub: { color: 'rgba(255,255,255,0.76)', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  sectionHeadCopy: { flex: 1 },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  sectionSub: { color: '#64748B', fontSize: 11, marginTop: 3, fontWeight: '700' },
  changeButton: { height: 34, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D8D4FF', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  changeText: { color: '#534AB7', fontSize: 12, fontWeight: '900' },
  eventCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 26, padding: 15, flexDirection: 'row', gap: 14, ...flowShadow },
  poster: { width: 88, height: 112, borderRadius: 20, flexShrink: 0 },
  eventMain: { flex: 1, minWidth: 0, paddingTop: 2 },
  tagRow: { flexDirection: 'row', gap: 7, marginBottom: 10, flexWrap: 'wrap' },
  tag: { height: 27, borderRadius: 999, backgroundColor: '#EEEDFE', color: '#534AB7', paddingHorizontal: 9, paddingVertical: 7, fontSize: 10, fontWeight: '900', overflow: 'hidden' },
  eventName: { color: '#0F172A', fontSize: 18, fontWeight: '900', letterSpacing: -0.5, lineHeight: 23, marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  metaText: { flex: 1, color: '#64748B', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  selectedSeatBox: { marginTop: 6, borderWidth: 1, borderColor: '#EDF2F7', backgroundColor: '#F8FAFC', borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  seatLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '900', marginBottom: 4 },
  seatTitle: { color: '#0F172A', fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  available: { height: 32, borderRadius: 999, backgroundColor: '#DCFCE7', color: '#0F6E56', paddingHorizontal: 10, paddingVertical: 9, fontSize: 10, fontWeight: '900', overflow: 'hidden' },
  payCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 26, overflow: 'hidden', ...flowShadow },
  payRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  payKey: { color: '#64748B', fontSize: 13, fontWeight: '800' },
  payVal: { flex: 1, textAlign: 'right', color: '#0F172A', fontSize: 14, fontWeight: '900' },
  payTotal: { minHeight: 60, backgroundColor: '#FBFAFF', borderBottomWidth: 0 },
  payTotalKey: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  payTotalVal: { color: '#534AB7', fontSize: 22, fontWeight: '900' },
  walletNote: { marginTop: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EDF2F7', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteCopy: { flex: 1 },
  noteTitle: { color: '#0F172A', fontSize: 12, fontWeight: '900', marginBottom: 3 },
  noteSub: { color: '#64748B', fontSize: 10, lineHeight: 15, fontWeight: '700' },
  paybar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
  paySummary: { width: 108 },
  payLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', marginBottom: 3 },
  payAmount: { color: '#0F172A', fontSize: 21, fontWeight: '900' },
  payButton: { flex: 1, height: 52, borderRadius: 18, backgroundColor: '#534AB7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...flowShadow },
  payButtonDisabled: { opacity: 0.55 },
  payButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
