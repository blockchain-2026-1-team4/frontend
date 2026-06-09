import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { PosterThumb } from '../components/TicketFlowKit';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { formatCompactDateTime, formatEventCategory, formatTicketStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

type IconName = 'check' | 'shield' | 'qr' | 'ticket' | 'list' | 'search';

function eventTitle(event?: EventDetail | null, ticket?: TicketDetail | null) {
  return event?.name || event?.title || ticket?.eventTitle || ticket?.eventName || '이벤트';
}

function eventVenue(event?: EventDetail | null, ticket?: TicketDetail | null) {
  return event?.venueDetail || event?.location?.address || event?.location?.name || event?.venue || ticket?.venue || '-';
}

function eventDate(event?: EventDetail | null, ticket?: TicketDetail | null) {
  return formatCompactDateTime(event?.eventStartAt || event?.startsAt || event?.eventAt || event?.eventDateTime || ticket?.eventDateTime);
}

function priceLabel(value?: string) {
  if (!value) return '-';
  const eth = weiToEth(value);
  return eth === value ? `${value} WEI` : eth;
}

function sectionNameOf(ticket?: TicketDetail | null) {
  const source = String(ticket?.sectionName || ticket?.seatInfo || '').trim();
  return source.replace(/-\d+$/, '').replace(/^\d+회차-/, '') || '-';
}

function Icon({ name, color = '#64748B', size = 20 }: { name: IconName; color?: string; size?: number }) {
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  if (name === 'check') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 12l4 4L19 6" {...common} /></Svg>;
  if (name === 'shield') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zM9 12l2 2 4-5" {...common} /></Svg>;
  if (name === 'qr') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="4" width="6" height="6" rx="1" {...common} /><Rect x="14" y="4" width="6" height="6" rx="1" {...common} /><Rect x="4" y="14" width="6" height="6" rx="1" {...common} /><Path d="M14 14h2v2h-2zM18 14h2v6h-6v-2h4z" {...common} /></Svg>;
  if (name === 'ticket') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 6h14v4a2 2 0 000 4v4H5v-4a2 2 0 000-4V6zM9 8v8" {...common} /></Svg>;
  if (name === 'list') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" {...common} /></Svg>;
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3" {...common} /></Svg>;
}

function Kv({ label, value, tone }: { label: string; value?: string | number | null; tone?: 'blue' | 'green' }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{label}</Text>
      <Text style={[styles.v, tone === 'blue' && styles.vBlue, tone === 'green' && styles.vGreen]}>{value || '-'}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  variant,
  disabled,
  onPress,
}: {
  label: string;
  icon: IconName;
  variant: 'dark' | 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  onPress: () => void;
}) {
  const solid = variant === 'dark' || variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.actionButton, styles[`action_${variant}`], disabled && styles.actionDisabled]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <Icon name={icon} size={18} color={solid ? '#FFFFFF' : variant === 'ghost' ? '#64748B' : '#534AB7'} />
      <Text style={[styles.actionText, styles[`actionText_${variant}`]]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function PurchaseCompletePage({ route, navigation }: any) {
  const ticketId = route?.params?.ticketId;
  const eventId = route?.params?.eventId;
  const type = route?.params?.type === 'resale' ? '리셀 구매' : '티켓 예매';
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(ticketId));

  useEffect(() => {
    const load = async () => {
      if (!ticketId) return;
      setLoading(true);
      try {
        const ticketData = await backendApi.getTicket(String(ticketId));
        setTicket(ticketData);
        const targetEventId = eventId ?? ticketData.eventId;
        if (targetEventId) setEvent(await backendApi.getEvent(String(targetEventId)));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [ticketId, eventId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;
  }

  const price = ticket?.originalPriceWei ?? ticket?.priceWei ?? event?.ticketPriceWei;
  const resolvedTicketId = ticket?.id ?? ticket?.ticketId ?? ticketId;
  const category = event?.category ? formatEventCategory(event.category) : '공식 티켓';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#1A1A2E', '#534AB7', '#1D9E75']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.completeHero}>
        <View style={styles.completeCenter}>
          <View style={styles.check}>
            <Icon name="check" size={48} color="#A89CF7" />
          </View>
          <Text style={styles.eyebrow}>Purchase Complete</Text>
          <Text style={styles.completeTitle}>티켓 예매가{'\n'}완료되었습니다</Text>
          <Text style={styles.completeSub}>구매한 티켓은 내 티켓 목록에서 확인할 수 있습니다.{'\n'}입장 QR은 티켓 상세에서 사용할 수 있습니다.</Text>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.ticketPass}>
          <View style={styles.ticketTop}>
            <PosterThumb imageUrl={resolveImageUrl(event?.imageUrl)} title={eventTitle(event, ticket)} style={styles.poster} />
            <View style={styles.info}>
              <View style={styles.badges}>
                <Text style={[styles.badge, styles.badgeGreen]}>예매 완료</Text>
                <Text style={[styles.badge, styles.badgePurple]}>{category}</Text>
              </View>
              <Text style={styles.event}>{eventTitle(event, ticket)}</Text>
              <Text style={styles.meta}>{eventVenue(event, ticket)}{'\n'}{eventDate(event, ticket)}</Text>
            </View>
          </View>
          <View style={styles.ticketBody}>
            <Kv label="구역 / 좌석" value={`${sectionNameOf(ticket)} · ${ticket?.seatInfo || '-'}`} />
            <Kv label="수량" value="1장" />
            <Kv label="결제 금액" value={priceLabel(price)} tone="blue" />
            <Kv label="티켓 상태" value={formatTicketStatus(ticket?.status || 'SOLD')} tone="green" />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.chainCard}>
          <View style={styles.chainIcon}><Icon name="shield" size={23} color="#A89CF7" /></View>
          <View style={styles.chainCopy}>
            <Text style={styles.chainTitle}>블록체인 기록 완료</Text>
            <Text style={styles.chainSub}>티켓 소유권과 구매 기록이 연결된 지갑 주소 기준으로 기록되었습니다.</Text>
            <Text style={styles.tx}>Token {ticket?.contractTokenId || resolvedTicketId || '-'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionGrid}>
          <ActionButton label="내 티켓 보기" icon="list" variant="dark" onPress={() => navigation.replace('MyTicketFlow')} />
          <ActionButton
            label="QR 확인하기"
            icon="qr"
            variant="primary"
            disabled={!resolvedTicketId}
            onPress={() => navigation.navigate('TicketQr', { ticketId: resolvedTicketId })}
          />
        </View>
        <ActionButton
          label="티켓 상세 보기"
          icon="ticket"
          variant="outline"
          disabled={!resolvedTicketId}
          onPress={() => navigation.navigate('TicketDetail', { ticketId: resolvedTicketId })}
        />
        <ActionButton label="이벤트 탐색으로 돌아가기" icon="search" variant="ghost" onPress={() => navigation.replace('EventList')} />
      </View>

      <View style={styles.section}>
        <View style={styles.tip}>
          <View style={styles.tipIcon}><Icon name="qr" size={21} color="#534AB7" /></View>
          <View style={styles.tipCopy}>
            <Text style={styles.tipTitle}>다음 단계</Text>
            <Text style={styles.tipSub}>내 티켓에서 QR을 확인하거나 티켓 상세 화면에서 리셀 가능 여부와 입장 정보를 다시 확인할 수 있습니다.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  completeHero: { height: 286, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  heroDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  completeCenter: { position: 'relative', zIndex: 2, alignItems: 'center', paddingHorizontal: 24 },
  check: { width: 82, height: 82, borderRadius: 24, backgroundColor: 'rgba(168,156,247,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#A89CF7', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 8 },
  completeTitle: { fontSize: 25, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0, lineHeight: 31, textAlign: 'center', marginBottom: 9 },
  completeSub: { fontSize: 12, lineHeight: 19, color: 'rgba(255,255,255,0.68)', textAlign: 'center', fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  ticketPass: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 26, padding: 16, marginTop: 14, overflow: 'hidden', ...shadow },
  ticketTop: { flexDirection: 'row', gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: '#DBE3EF' },
  poster: { width: 88, height: 112, borderRadius: 18, position: 'relative', overflow: 'hidden', flexShrink: 0 },
  posterDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  posterText: { position: 'absolute', left: 9, right: 9, bottom: 9, zIndex: 2, color: '#FFFFFF', fontSize: 12, fontWeight: '900', lineHeight: 15 },
  info: { flex: 1, minWidth: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  badge: { fontSize: 10, fontWeight: '900', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, overflow: 'hidden' },
  badgeGreen: { backgroundColor: '#DCFCE7', color: '#0F6E56' },
  badgePurple: { backgroundColor: '#EEEDFE', color: '#534AB7' },
  event: { fontSize: 17, fontWeight: '900', lineHeight: 21, letterSpacing: 0, color: '#0F172A', marginBottom: 8 },
  meta: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  ticketBody: { paddingTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kv: { width: '48%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EDF2F7', borderRadius: 17, padding: 12 },
  k: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 5 },
  v: { fontSize: 13, fontWeight: '900', color: '#0F172A', lineHeight: 18 },
  vBlue: { color: '#534AB7' },
  vGreen: { color: '#0F6E56' },
  chainCard: { backgroundColor: '#1A1A2E', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  chainIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(168,156,247,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chainCopy: { flex: 1 },
  chainTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  chainSub: { fontSize: 11, color: 'rgba(255,255,255,0.58)', lineHeight: 17, fontWeight: '700' },
  tx: { marginTop: 7, fontSize: 11, fontWeight: '900', color: '#A89CF7' },
  actions: { paddingHorizontal: 16, paddingBottom: 14 },
  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionButton: { flex: 1, minHeight: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 12, marginBottom: 10 },
  action_dark: { backgroundColor: '#1A1A2E' },
  action_primary: { backgroundColor: '#534AB7', ...shadow },
  action_outline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CECBF6' },
  action_ghost: { backgroundColor: 'transparent', minHeight: 42 },
  actionDisabled: { opacity: 0.5 },
  actionText: { fontSize: 15, fontWeight: '900' },
  actionText_dark: { color: '#FFFFFF' },
  actionText_primary: { color: '#FFFFFF' },
  actionText_outline: { color: '#534AB7' },
  actionText_ghost: { color: '#64748B', fontSize: 13 },
  tip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tipCopy: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  tipSub: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
});
