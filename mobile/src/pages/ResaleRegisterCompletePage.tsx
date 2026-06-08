import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PosterThumb, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { formatCompactDateTime, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, ResaleListing, TicketDetail } from '../types/api';

function eventTitle(event?: EventDetail | null, ticket?: TicketDetail | null, listing?: ResaleListing | null) {
  return event?.name || event?.title || ticket?.eventTitle || ticket?.eventName || listing?.eventName || '이벤트';
}

function roundTime(event?: EventDetail | null, ticket?: TicketDetail | null) {
  return formatCompactDateTime(event?.eventStartAt || event?.startsAt || event?.eventAt || event?.eventDateTime || ticket?.eventDateTime);
}

function priceLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '-';
  const eth = weiToEth(value);
  return eth === String(value) ? `${value} WEI` : eth;
}

function statusLabel(status?: string | null) {
  const key = String(status ?? 'ACTIVE').toUpperCase();
  if (key === 'ACTIVE' || key === 'LISTED') return '판매 중';
  if (key === 'SOLD') return '거래 완료';
  if (key === 'CANCELED' || key === 'CANCELLED') return '취소됨';
  return status || '판매 중';
}

export default function ResaleRegisterCompletePage({ route, navigation }: any) {
  const listingId = route?.params?.listingId;
  const ticketId = route?.params?.ticketId;
  const [listing, setListing] = useState<ResaleListing | null>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(listingId || ticketId));

  useEffect(() => {
    const load = async () => {
      if (!listingId && !ticketId) return;
      setLoading(true);
      try {
        const listingData = listingId ? await backendApi.getResaleListing(String(listingId)).catch(() => null) : null;
        setListing(listingData);

        const targetTicketId = ticketId ?? listingData?.ticketId;
        const ticketData = targetTicketId ? await backendApi.getTicket(String(targetTicketId)).catch(() => null) : null;
        setTicket(ticketData);

        const targetEventId = ticketData?.eventId ?? listingData?.eventId;
        if (targetEventId) {
          setEvent(await backendApi.getEvent(String(targetEventId)).catch(() => null));
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [listingId, ticketId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;
  }

  const title = eventTitle(event, ticket, listing);
  const price = listing?.priceWei ?? listing?.price;
  const createdAt = listing?.createdAt ?? ticket?.updatedAt ?? ticket?.createdAt;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} activeOpacity={0.84}>
            <TicketIcon name="arrowLeft" size={20} />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>Resale Listed</Text>
            <Text style={styles.topTitle}>리셀 등록 완료</Text>
          </View>
          <View style={styles.iconPlaceholder} />
        </View>

        <View style={styles.successCard}>
          <View style={styles.checkCircle}>
            <TicketIcon name="check" size={42} color="#0F6E56" />
          </View>
          <View style={styles.successBadge}>
            <TicketIcon name="check" size={14} color="#0F6E56" />
            <Text style={styles.successBadgeText}>등록됨</Text>
          </View>
          <Text style={styles.successTitle}>리셀 등록이{'\n'}완료되었습니다</Text>
          <Text style={styles.successSub}>등록한 티켓이 리셀 마켓에{'\n'}공개되었습니다.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>등록한 티켓</Text>
          <View style={styles.ticketCard}>
            <View style={styles.ticketHead}>
              <View style={styles.ticketHeadText}>
                <Text style={styles.eventName} numberOfLines={2}>{title}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{roundTime(event, ticket)}</Text>
              </View>
              <Text style={styles.statusPill}>{statusLabel(listing?.status)}</Text>
            </View>

            <View style={styles.ticketContent}>
              <PosterThumb imageUrl={resolveImageUrl(event?.imageUrl)} title={title} style={styles.poster} />
              <View style={styles.ticketInfo}>
                <InfoRow label="좌석" value={ticket?.seatInfo || listing?.seatInfo || '-'} />
                <InfoRow label="리셀 가격" value={priceLabel(price)} highlight />
                <InfoRow label="등록 시각" value={formatCompactDateTime(createdAt)} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => (listingId ? navigation.replace('ResaleDetail', { listingId }) : navigation.replace('ResaleList'))}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryButtonText}>리셀 현황 보기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineButton} onPress={() => navigation.replace('MyTicketFlow')} activeOpacity={0.88}>
          <Text style={styles.outlineButtonText}>내 티켓으로 이동</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value?: string | number | null; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoKey}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.price]} numberOfLines={1}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  screen: { flex: 1 },
  content: { paddingBottom: 152 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
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
  iconPlaceholder: { width: 40, height: 40 },
  titleWrap: { alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 2 },
  topTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  successCard: { marginHorizontal: 16, marginTop: 18, marginBottom: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 30, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, alignItems: 'center', ...flowShadow },
  checkCircle: { width: 82, height: 82, marginBottom: 16, borderRadius: 28, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  successBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#DCFCE7', marginBottom: 12 },
  successBadgeText: { color: '#0F6E56', fontSize: 10, fontWeight: '900' },
  successTitle: { color: '#0F172A', fontSize: 24, fontWeight: '900', letterSpacing: -0.8, lineHeight: 30, textAlign: 'center', marginBottom: 9 },
  successSub: { color: '#64748B', fontSize: 13, lineHeight: 21, textAlign: 'center', fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  sectionLabel: { color: '#0F172A', fontSize: 16, fontWeight: '900', letterSpacing: -0.3, marginLeft: 2, marginBottom: 10 },
  ticketCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 26, overflow: 'hidden', ...flowShadow },
  ticketHead: { padding: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ticketHeadText: { flex: 1, minWidth: 0 },
  eventName: { color: '#0F172A', fontSize: 17, fontWeight: '900', lineHeight: 22, letterSpacing: -0.4, marginBottom: 5 },
  eventMeta: { color: '#64748B', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  statusPill: { height: 29, borderRadius: 999, backgroundColor: '#F1F5F9', color: '#475569', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 7, fontSize: 11, fontWeight: '900', overflow: 'hidden' },
  ticketContent: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  poster: { width: 86, height: 112, borderRadius: 20, flexShrink: 0 },
  ticketInfo: { flex: 1, minWidth: 0 },
  infoRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoKey: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  infoValue: { flex: 1, textAlign: 'right', color: '#0F172A', fontSize: 14, fontWeight: '900' },
  price: { color: '#534AB7' },
  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 9 },
  primaryButton: { height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#534AB7', ...flowShadow },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  outlineButton: { height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D8D4FF' },
  outlineButtonText: { color: '#534AB7', fontSize: 15, fontWeight: '900' },
});
