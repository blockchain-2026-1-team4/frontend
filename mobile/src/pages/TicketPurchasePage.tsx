import { useProvider } from '@reown/appkit-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import WalletRequiredView from '../components/WalletRequiredView';
import { backendApi } from '../lib/backend';
import { purchaseTicketOnChain } from '../lib/blockchain/client';
import { showDialog } from '../lib/dialog';
import { formatCompactDateTime, formatTicketStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail, UserProfile } from '../types/api';

type IconName = 'arrowLeft' | 'map' | 'calendar' | 'seat' | 'refresh' | 'wallet' | 'alert' | 'ticket' | 'chevron';

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

function eventTitle(event?: EventDetail | null, ticket?: TicketDetail | null) {
  return event?.name || event?.title || ticket?.eventTitle || ticket?.eventName || ticket?.eventId || '이벤트';
}

function eventVenue(event?: EventDetail | null, ticket?: TicketDetail | null) {
  return event?.venueDetail || event?.location?.address || event?.location?.name || event?.venue || ticket?.venue || '-';
}

function walletShort(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  if (text.length <= 14) return text;
  return `${text.slice(0, 6)}...${text.slice(-6)}`;
}

function Icon({ name, color = '#64748B', size = 20 }: { name: IconName; color?: string; size?: number }) {
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  if (name === 'arrowLeft') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M15 18l-6-6 6-6" {...common} /></Svg>;
  if (name === 'map') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 21s7-4.4 7-11a7 7 0 10-14 0c0 6.6 7 11 7 11z" {...common} /><Circle cx="12" cy="10" r="2.5" {...common} /></Svg>;
  if (name === 'calendar') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="5" width="16" height="15" rx="2" {...common} /><Path d="M8 3v4M16 3v4M4 10h16" {...common} /></Svg>;
  if (name === 'seat') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M7 11V6a3 3 0 016 0v5M6 11h10a3 3 0 013 3v5H5v-5a3 3 0 013-3zM8 19v2M16 19v2" {...common} /></Svg>;
  if (name === 'refresh') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M20 11a8 8 0 00-14.2-4.9L4 8M4 4v4h4M4 13a8 8 0 0014.2 4.9L20 16M16 16h4v4" {...common} /></Svg>;
  if (name === 'wallet') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="3" y="6" width="18" height="14" rx="3" {...common} /><Path d="M16 12h5v5h-5a2.5 2.5 0 010-5zM3 9h18" {...common} /></Svg>;
  if (name === 'alert') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" {...common} /><Path d="M12 7v6M12 17h.01" {...common} /></Svg>;
  if (name === 'ticket') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 6h14v4a2 2 0 000 4v4H5v-4a2 2 0 000-4V6zM9 8v8" {...common} /></Svg>;
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M9 18l6-6-6-6" {...common} /></Svg>;
}

function Row({ icon, label, value, green = false, total = false }: { icon?: IconName; label: string; value?: string | number | null; green?: boolean; total?: boolean }) {
  return (
    <View style={[styles.row, total && styles.totalRow]}>
      <View style={styles.rowLabelWrap}>
        {icon ? <Icon name={icon} size={16} color={total ? '#0F172A' : '#64748B'} /> : null}
        <Text style={[styles.rowLabel, total && styles.totalLabel]}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, green && styles.rowValueGreen, total && styles.totalValue]}>{value || '-'}</Text>
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
    void load();
  }, [ticketId, eventId]);

  const purchaseState = useMemo(() => getPurchaseState(ticket, event), [event, ticket]);

  const submitPurchase = async () => {
    setSubmitting(true);
    try {
      const tokenId = ticket?.contractTokenId;
      const priceWei = ticket?.originalPriceWei ?? ticket?.priceWei ?? event?.ticketPriceWei;
      if (!tokenId) throw new Error('티켓 tokenId가 없습니다. 주최자가 티켓을 다시 발행해야 합니다.');
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
          <Icon name="arrowLeft" size={20} />
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.eyebrow}>Ticket Checkout</Text>
          <Text style={styles.topTitle}>결제 확인</Text>
        </View>
        <Text style={[styles.badge, styles.badgeGreen]}>{purchaseState.canPurchase ? '예매 중' : purchaseState.label}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A1A2E', '#534AB7', '#1D9E75']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.posterRow}>
            <LinearGradient colors={['#0C447C', '#185FA5', '#639922']} style={styles.miniPoster} />
            <LinearGradient colors={['#26215C', '#534AB7', '#1D9E75']} style={styles.miniPoster} />
          </View>
          <View style={styles.heroDim} />
          <View style={styles.heroBody}>
            <Text style={styles.glassBadge}>최종 확인</Text>
            <Text style={styles.heroTitle}>선택한 티켓과{'\n'}결제 정보를 확인하세요</Text>
            <Text style={styles.heroMeta}>예매 완료 후 티켓 소유권은 연결된 지갑 주소로 기록됩니다.</Text>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.summaryCard}>
            <View style={styles.pillRow}>
              <Text style={[styles.pill, styles.pillActive]}>{section}</Text>
              <Text style={styles.pill}>{seat}</Text>
            </View>
            <Text style={styles.eventName}>{title}</Text>
            <View style={styles.placeRow}>
              <Icon name="map" size={15} color="#64748B" />
              <Text style={styles.placeText}>{eventVenue(event, ticket)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.head}>
            <View>
              <Text style={styles.headTitle}>선택한 티켓</Text>
              <Text style={styles.headSub}>좌석과 판매 조건을 확인하세요</Text>
            </View>
            <TouchableOpacity style={styles.changeButton} onPress={() => navigation.goBack()} activeOpacity={0.84}>
              <Text style={styles.changeText}>변경</Text>
            </TouchableOpacity>
          </View>

          <LinearGradient colors={['#1A1A2E', '#534AB7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ticketCard}>
            <View style={styles.ticketGlow} />
            <View style={styles.ticketMain}>
              <View style={styles.ticketMainText}>
                <Text style={styles.ticketLabel}>구역 / 좌석</Text>
                <Text style={styles.ticketValue}>{section} · {seat}</Text>
              </View>
              <Text style={[styles.badge, styles.badgeGreen]}>{formatTicketStatus(ticket.status)}</Text>
            </View>
            <View style={styles.ticketMeta}>
              <View style={styles.ticketMetaCell}>
                <Text style={styles.ticketLabel}>회차</Text>
                <Text style={styles.ticketMetaValue}>{round}</Text>
              </View>
              <View style={styles.ticketMetaCell}>
                <Text style={styles.ticketLabel}>수량</Text>
                <Text style={styles.ticketMetaValue}>1장</Text>
              </View>
              <View style={styles.ticketMetaCell}>
                <Text style={styles.ticketLabel}>가격</Text>
                <Text style={styles.ticketMetaValue}>{priceLabel(price)}</Text>
              </View>
              <View style={styles.ticketMetaCell}>
                <Text style={styles.ticketLabel}>판매 종료</Text>
                <Text style={styles.ticketMetaValue}>{formatCompactDateTime(ticket.saleEndAt || event?.primarySaleEnd || event?.salesEndAt)}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <View style={styles.head}>
            <View>
              <Text style={styles.headTitle}>예매 상세</Text>
              <Text style={styles.headSub}>가격, 리셀 정책, 판매 상태</Text>
            </View>
          </View>
          <View style={styles.panel}>
            <Row icon="calendar" label="회차" value={round} />
            <Row icon="seat" label="좌석" value={seat} />
            <Row icon="refresh" label="리셀 가능 여부" value={resaleLabel(ticket, event)} green />
            <Row label="최종 결제 금액" value={priceLabel(price)} total />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.methodCard}>
            <View style={styles.methodIcon}><Icon name="wallet" size={21} color="#534AB7" /></View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>연결된 지갑</Text>
              <Text style={styles.methodSub}>{walletShort(me.walletAddress)} · Kaia Kairos</Text>
            </View>
            <Text style={styles.methodChange}>연결됨</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.notice, styles.warn]}>
            <View style={styles.warnIcon}><Icon name="alert" size={21} color="#F97316" /></View>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>예매 전 확인</Text>
              <Text style={styles.noticeSub}>결제가 완료되면 티켓 소유권이 지갑에 기록됩니다. 좌석과 금액을 다시 확인해주세요.</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.stickyBuy}>
        <View style={styles.buyPrice}>
          <Text style={styles.buyLabel}>결제 예정</Text>
          <Text style={styles.buyValue} numberOfLines={1}>{priceLabel(price)}</Text>
        </View>
        <TouchableOpacity style={[styles.buyButton, disabled && styles.buyButtonDisabled]} disabled={disabled} onPress={purchase} activeOpacity={0.88}>
          <Icon name="ticket" size={20} color="#FFFFFF" />
          <Text style={styles.buyButtonText}>{submitting ? '예매 처리 중...' : purchaseState.label}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  scroll: { flex: 1 },
  content: { paddingBottom: 150 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  empty: { color: '#94A3B8', fontWeight: '800' },
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
  iconButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', ...shadow },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 2 },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  badge: { fontSize: 10, fontWeight: '900', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, overflow: 'hidden' },
  badgeGreen: { backgroundColor: '#DCFCE7', color: '#0F6E56' },
  hero: { height: 176, marginHorizontal: 16, marginTop: 14, marginBottom: 14, borderRadius: 28, overflow: 'hidden', position: 'relative', ...shadow },
  heroDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  posterRow: { position: 'absolute', right: -10, top: 18, flexDirection: 'row', gap: 8, transform: [{ rotate: '8deg' }], opacity: 0.76, zIndex: 1 },
  miniPoster: { width: 58, height: 84, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroBody: { position: 'absolute', left: 17, right: 17, bottom: 17, zIndex: 2 },
  glassBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    color: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', lineHeight: 28, letterSpacing: 0, marginTop: 9, marginBottom: 6 },
  heroMeta: { fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 17, fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  summaryCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 16, ...shadow },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 9 },
  pill: { fontSize: 10, fontWeight: '900', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#F1F5F9', color: '#64748B', overflow: 'hidden' },
  pillActive: { backgroundColor: '#EEEDFE', color: '#534AB7' },
  eventName: { fontSize: 20, fontWeight: '900', lineHeight: 25, letterSpacing: 0, color: '#0F172A', marginBottom: 9 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeText: { flex: 1, fontSize: 12, fontWeight: '800', color: '#64748B' },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  headTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  headSub: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '700' },
  changeButton: { borderWidth: 1, borderColor: '#D8D4FF', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  changeText: { fontSize: 12, fontWeight: '900', color: '#534AB7' },
  ticketCard: { borderRadius: 26, padding: 16, position: 'relative', overflow: 'hidden', ...shadow },
  ticketGlow: { position: 'absolute', right: -40, top: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(168,156,247,0.42)' },
  ticketMain: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 2 },
  ticketMainText: { flex: 1, minWidth: 0 },
  ticketLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.58)', marginBottom: 4 },
  ticketValue: { fontSize: 19, fontWeight: '900', color: '#FFFFFF', lineHeight: 24 },
  ticketMeta: { marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12, position: 'relative', zIndex: 2 },
  ticketMetaCell: { width: '47%' },
  ticketMetaValue: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', lineHeight: 18 },
  panel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, overflow: 'hidden', ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  totalRow: { backgroundColor: '#F8FAFC', borderBottomWidth: 0 },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  rowLabel: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  totalLabel: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  rowValue: { flex: 1, fontSize: 13, fontWeight: '900', color: '#0F172A', textAlign: 'right', lineHeight: 18 },
  rowValueGreen: { color: '#0F6E56' },
  totalValue: { fontSize: 19, color: '#0F172A' },
  methodCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  methodIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  methodInfo: { flex: 1 },
  methodTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  methodSub: { fontSize: 11, color: '#64748B', lineHeight: 16, fontWeight: '700' },
  methodChange: { fontSize: 12, fontWeight: '900', color: '#534AB7' },
  notice: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  warn: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  warnIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  noticeSub: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  stickyBuy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 35,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  buyPrice: { width: 112 },
  buyLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', marginBottom: 3 },
  buyValue: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  buyButton: { flex: 1, minHeight: 52, borderRadius: 17, backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12, ...shadow },
  buyButtonDisabled: { opacity: 0.55 },
  buyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
