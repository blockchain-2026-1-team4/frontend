import { useProvider } from '@reown/appkit-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlowBadge, FlowHero, IconButton, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { purchaseResaleTicketOnChain } from '../lib/blockchain/client';
import { showDialog } from '../lib/dialog';
import {
  compactId,
  eventTitle,
  resolveRoundTimes,
  sectionNameOf,
  weiToEthLabel,
} from '../lib/ticketFlowDisplay';
import type { EventDetail, ResaleListing, TicketDetail, UserProfile } from '../types/api';

type RoundTimes = { startMs: number; endMs: number };

const ACTIVE_STATUSES = ['ACTIVE', 'LISTED', 'OPEN', 'ON_SALE'];

function resaleStatusLabel(
  listing: ResaleListing | null,
  event: EventDetail | null,
  roundTimes: RoundTimes | null,
  isMyListing: boolean,
): string {
  if (!listing) return '구매 불가';
  const eventStatus = String(event?.status ?? '').toUpperCase();
  if (eventStatus === 'CANCELLED') return '이벤트 취소';
  if (eventStatus === 'DRAFT' || eventStatus === 'INACTIVE') return '판매 불가';
  const s = String(listing.status ?? '').toUpperCase();
  if (s === 'CANCELED') return '취소됨';
  if (['SOLD', 'COMPLETED', 'PURCHASED'].includes(s)) return '판매완료';
  if (['CLOSED', 'EXPIRED'].includes(s)) return '판매종료';
  if (roundTimes === null) return '상태 확인 필요';
  const now = Date.now();
  if (now >= roundTimes.endMs) return '판매종료';
  if (!Number.isNaN(roundTimes.startMs) && now >= roundTimes.startMs) return '판매종료';
  if (isMyListing) return '내가 등록한 티켓';
  if (ACTIVE_STATUSES.includes(s)) return '판매중';
  return '구매 불가';
}

function statusTone(label: string): 'green' | 'gray' | 'red' | 'purple' {
  if (label === '판매중') return 'green';
  if (label === '이벤트 취소' || label === '취소됨') return 'red';
  if (label === '상태 확인 필요' || label === '내가 등록한 티켓') return 'purple';
  return 'gray';
}

function blockedPurchaseMessage(
  listing: ResaleListing | null,
  event: EventDetail | null,
  roundTimes: RoundTimes | null,
  isMyListing: boolean,
): string {
  if (!listing) return '리셀 티켓 정보를 확인할 수 없습니다.';
  const eventStatus = String(event?.status ?? '').toUpperCase();
  if (eventStatus === 'CANCELLED') return '취소된 이벤트의 리셀 티켓입니다.';
  if (eventStatus === 'DRAFT' || eventStatus === 'INACTIVE') return '현재 판매가 허용되지 않는 이벤트입니다.';
  const s = String(listing.status ?? '').toUpperCase();
  if (s === 'CANCELED') return '취소된 리셀 티켓입니다.';
  if (['SOLD', 'COMPLETED', 'PURCHASED'].includes(s)) return '이미 판매 완료된 리셀 티켓입니다.';
  if (['CLOSED', 'EXPIRED'].includes(s)) return '판매가 종료된 리셀 티켓입니다.';
  if (roundTimes === null) return '회차 정보를 확인할 수 없어 구매할 수 없습니다.';
  const now = Date.now();
  if (now >= roundTimes.endMs) return '공연이 종료되어 판매가 종료된 리셀 티켓입니다.';
  if (!Number.isNaN(roundTimes.startMs) && now >= roundTimes.startMs) return '공연이 이미 시작되어 판매가 종료된 리셀 티켓입니다.';
  if (isMyListing) return '본인이 등록한 리셀 티켓은 구매할 수 없습니다.';
  if (!ACTIVE_STATUSES.includes(s)) return '현재 구매할 수 없는 리셀 티켓입니다.';
  return '';
}

function seatLabel(ticket?: TicketDetail | null, listing?: ResaleListing | null) {
  const seat = ticket?.seatInfo || listing?.seatInfo || '-';
  const section = sectionNameOf(ticket);
  return section && section !== '-' && !seat.includes(section) ? `${section}-${seat}` : seat;
}

function resalePercent(listing?: ResaleListing | null, ticket?: TicketDetail | null) {
  const original = ticket?.originalPriceWei || ticket?.priceWei;
  const price = listing?.priceWei || listing?.price;
  if (!original || !price) return '-';
  try {
    const percent = (BigInt(String(price)) * 100n) / BigInt(String(original));
    return `${percent.toString()}%`;
  } catch {
    return '-';
  }
}

function sellerLabel(listing?: ResaleListing | null) {
  return listing?.sellerDisplayName || compactId(listing?.sellerId, 6, 4);
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function ResaleDetailPage({ route, navigation }: any) {
  const { listingId } = route.params;
  const [listing, setListing] = useState<ResaleListing | null>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const { provider } = useProvider();

  useEffect(() => {
    const load = async () => {
      try {
        const listingData = await backendApi.getResaleListing(String(listingId));
        setListing(listingData);
        const [ticketData, eventData, meData] = await Promise.all([
          backendApi.getTicket(String(listingData.ticketId)),
          backendApi.getEvent(String(listingData.eventId)),
          backendApi.getMe().catch(() => null),
        ]);
        setTicket(ticketData);
        setEvent(eventData);
        setMe(meData);
      } catch (cause: any) {
        showDialog('오류', errorMessage(cause, '리셀 티켓 정보를 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [listingId]);

  const isMyListing = Boolean(listing?.sellerId && me?.id && listing.sellerId === me.id);
  const roundTimes = useMemo(
    () =>
      ticket && event
        ? resolveRoundTimes(ticket.eventRoundId ? String(ticket.eventRoundId) : null, ticket.eventDateTime, event)
        : null,
    [ticket, event],
  );
  const blockMessage = useMemo(
    () => blockedPurchaseMessage(listing, event, roundTimes, isMyListing),
    [listing, event, roundTimes, isMyListing],
  );
  const isBlocked = Boolean(blockMessage);

  const buttonText = useMemo(() => {
    if (submitting) return '구매 처리 중...';
    if (!listing) return '구매 불가';
    const eventStatus = String(event?.status ?? '').toUpperCase();
    if (eventStatus === 'CANCELLED') return '이벤트 취소';
    if (eventStatus === 'DRAFT' || eventStatus === 'INACTIVE') return '판매 불가';
    const s = String(listing.status ?? '').toUpperCase();
    if (s === 'CANCELED') return '취소됨';
    if (['SOLD', 'COMPLETED', 'PURCHASED'].includes(s)) return '판매완료';
    if (['CLOSED', 'EXPIRED'].includes(s)) return '판매종료';
    if (roundTimes === null) return '상태 확인 필요';
    const now = Date.now();
    if (now >= roundTimes.endMs) return '판매종료';
    if (!Number.isNaN(roundTimes.startMs) && now >= roundTimes.startMs) return '판매종료';
    if (isMyListing) return '내가 등록한 티켓';
    if (!ACTIVE_STATUSES.includes(s)) return '구매 불가';
    return '리셀 티켓 구매하기';
  }, [event, isMyListing, listing, roundTimes, submitting]);

  const purchase = async () => {
    if (blockMessage) {
      setFeedback(blockMessage);
      showDialog('구매 불가', blockMessage);
      return;
    }
    if (!me?.walletAddress?.trim()) {
      showDialog('지갑 로그인 필요', '리셀 티켓 구매는 지갑 로그인 후 가능합니다.', [
        { text: '취소', style: 'cancel' },
        { text: '지갑 로그인', onPress: () => navigation.navigate('Auth', { initialRole: 'USER' }) },
      ]);
      return;
    }

    showDialog('리셀 티켓 구매', '선택한 리셀 티켓을 구매할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '구매하기', onPress: () => void submitPurchase() },
    ]);
  };

  const submitPurchase = async () => {
    setSubmitting(true);
    setFeedback('');
    try {
      const targetListingId = listing?.id ?? listing?.listingId ?? listingId;
      const tokenId = ticket?.contractTokenId;
      const priceWei = listing?.priceWei ?? listing?.price;
      if (!tokenId) throw new Error('온체인 tokenId가 없는 티켓입니다. 리셀 구매를 진행할 수 없습니다.');
      if (!priceWei) throw new Error('리셀 가격 정보를 확인할 수 없습니다.');
      const transactionHash = await purchaseResaleTicketOnChain(provider, String(tokenId), String(priceWei));
      const purchased = await backendApi.purchaseResale(String(targetListingId), transactionHash);
      navigation.replace('PurchaseComplete', {
        type: 'resale',
        listingId: purchased.id ?? purchased.listingId,
        ticketId: purchased.ticketId,
        eventId: purchased.eventId,
      });
    } catch (cause: any) {
      const message = errorMessage(cause, '리셀 티켓 구매에 실패했습니다.');
      setFeedback(message);
      showDialog('구매 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;
  if (!listing) return <View style={styles.center}><Text style={styles.empty}>리셀 등록을 찾을 수 없습니다.</Text></View>;

  const title = eventTitle(event, ticket);
  const seat = seatLabel(ticket, listing);
  const status = resaleStatusLabel(listing, event, roundTimes, isMyListing);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.84}>
          <IconButton><TicketIcon name="arrowLeft" size={20} /></IconButton>
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.eyebrow}>Resale Detail</Text>
          <Text style={styles.topTitle}>리셀 거래 상세</Text>
        </View>
        <FlowBadge label={status} tone={statusTone(status)} />
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FlowHero
          height={176}
          style={styles.hero}
          posters={false}
          badge="리셀 티켓"
          title={'구매 전 소유권과\n가격을 확인하세요.'}
          meta={`${title} · ${seat} · ${weiToEthLabel(listing.priceWei ?? listing.price)}`}
        />

        <View style={styles.section}>
          <View style={styles.detailCard}>
            <FlowBadge label={status} tone={statusTone(status)} />
            <Text style={styles.detailTitle}>좌석 {seat}</Text>
            <Text style={styles.meta}>블록체인 기록으로 소유권이 확인된 리셀 티켓입니다.</Text>
            <View style={styles.grid2}>
              <InfoBox label="리셀 가격" value={weiToEthLabel(listing.priceWei ?? listing.price)} />
              <InfoBox label="원가 대비" value={resalePercent(listing, ticket)} />
              <InfoBox label="티켓 ID" value={compactId(listing.ticketId, 8, 4)} />
              <InfoBox label="판매자" value={sellerLabel(listing)} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sellerCard}>
            <View style={styles.ico}>
              <TicketIcon name="userCheck" size={21} color="#534AB7" />
            </View>
            <View style={styles.sellerCopy}>
              <Text style={styles.tipTitle}>검증된 판매자</Text>
              <Text style={styles.tipSub}>현재 티켓 소유자와 판매 등록자가 일치합니다.</Text>
            </View>
          </View>
        </View>

        {(feedback || isBlocked) ? (
          <View style={styles.section}>
            <View style={styles.alert}>
              <TicketIcon name="alert" size={20} color="#EA580C" />
              <Text style={styles.alertText}>{feedback || blockMessage}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.primary, (submitting || isBlocked) && styles.disabledButton]}
            disabled={submitting || isBlocked}
            onPress={purchase}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryText}>{buttonText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.outline]}
            onPress={() => navigation.navigate('DisputeCreate', { resaleListingId: listing.id ?? listing.listingId, ticketId: listing.ticketId })}
            activeOpacity={0.88}
          >
            <Text style={styles.outlineText}>이 리셀 거래 분쟁 신고</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB', padding: 24 },
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
  topTitleWrap: { flex: 1, alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 2 },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  hero: { marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  detailCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 16, ...flowShadow },
  detailTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', lineHeight: 27, letterSpacing: 0, marginTop: 8, marginBottom: 8 },
  meta: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 14 },
  kv: { width: '48%', minHeight: 72, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EDF2F7', borderRadius: 17, padding: 12 },
  k: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 5 },
  v: { fontSize: 13, fontWeight: '900', color: '#0F172A', lineHeight: 18 },
  sellerCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', ...flowShadow },
  ico: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sellerCopy: { flex: 1, minWidth: 0 },
  tipTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  tipSub: { fontSize: 10, color: '#64748B', lineHeight: 15, fontWeight: '700' },
  alert: { borderRadius: 19, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  alertText: { flex: 1, color: '#EA580C', fontWeight: '800', lineHeight: 20, fontSize: 12 },
  actions: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  btn: { width: '100%', minHeight: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#534AB7', ...flowShadow },
  disabledButton: { backgroundColor: '#CBD5E1' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  outline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CECBF6' },
  outlineText: { color: '#534AB7', fontSize: 15, fontWeight: '900' },
  empty: { color: '#64748B', fontWeight: '800', textAlign: 'center' },
});
