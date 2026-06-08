import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlowBadge, FlowHero, IconButton, PosterThumb, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import {
  canRegisterResale,
  compactId,
  displayStatusOf,
  entryStatusOf,
  eventDateLabel,
  eventTitle,
  eventVenue,
  ownerAddressOf,
  resalePolicyLabel,
  sectionNameOf,
  ticketIdOf,
  ticketStatusLabel,
  validityLabel,
  weiToEthLabel,
} from '../lib/ticketFlowDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

function Kv({ label, value, green = false }: { label: string; value?: string | number | null; green?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{label}</Text>
      <Text style={[styles.v, green && styles.vGreen]}>{value || '-'}</Text>
    </View>
  );
}

function ActionButton({
  label,
  variant,
  disabled,
  onPress,
}: {
  label: string;
  variant: 'primary' | 'dark' | 'outline';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, styles[`action_${variant}`], disabled && styles.actionDisabled]} disabled={disabled} onPress={onPress} activeOpacity={0.86}>
      <Text style={[styles.actionText, styles[`actionText_${variant}`]]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TicketDetailPage({ route, navigation }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [validity, setValidity] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTicket = async () => {
      setLoading(true);
      try {
        const data = await backendApi.getTicket(String(ticketId));
        setTicket(data);
        const [eventData, validityData] = await Promise.all([
          data.eventId ? backendApi.getEvent(String(data.eventId)).catch(() => null) : Promise.resolve(null),
          backendApi.getTicketValidity(String(ticketId)).catch(() => null),
        ]);
        setEvent(eventData);
        setValidity(validityData);
      } catch (error: any) {
        Alert.alert('오류', error.message || '티켓 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    void loadTicket();
  }, [ticketId]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;
  if (!ticket) return <View style={styles.center}><Text style={styles.emptyText}>티켓 정보를 찾을 수 없습니다.</Text></View>;

  const id = ticketIdOf(ticket) || String(ticketId);
  const title = eventTitle(event, ticket);
  const entry = entryStatusOf(ticket, event);
  const status = displayStatusOf(ticket, event);
  const canResale = canRegisterResale(ticket, event);
  const price = weiToEthLabel(ticket.originalPriceWei ?? ticket.priceWei ?? event?.ticketPriceWei);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.84}>
          <IconButton><TicketIcon name="arrowLeft" size={20} /></IconButton>
        </TouchableOpacity>
        <Text style={styles.topTitle}>티켓 상세</Text>
        <IconButton><TicketIcon name="dots" size={20} /></IconButton>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FlowHero
          height={260}
          style={styles.detailHero}
          badge={entry.label}
          title={title}
          meta={`${eventVenue(event, ticket)}\n${eventDateLabel(event, ticket)}`}
        />

        <View style={styles.section}>
          <View style={styles.ticketPass}>
            <View style={styles.notchLeft} />
            <View style={styles.notchRight} />
            <View style={styles.passTop}>
              <PosterThumb imageUrl={resolveImageUrl(event?.imageUrl)} title={title} variant={1} style={styles.ticketPoster} />
              <View style={styles.ticketInfo}>
                <View style={styles.ticketTop}>
                  <FlowBadge label={entry.label} tone={entry.tone === 'red' ? 'red' : entry.tone === 'gray' ? 'gray' : 'green'} />
                  <FlowBadge label={sectionNameOf(ticket)} />
                </View>
                <Text style={styles.ticketName}>{sectionNameOf(ticket)} · {ticket.seatInfo || '-'}</Text>
                <Text style={styles.ticketMeta}>
                  티켓 번호 {compactId(ticket.contractTokenId || id)}
                  {'\n'}소유 지갑 {compactId(ownerAddressOf(ticket), 6, 6)}
                </Text>
              </View>
            </View>
            <View style={styles.passBody}>
              <Kv label="상태" value={ticketStatusLabel(ticket.status)} green={status.tone === 'green' || status.tone === 'blue'} />
              <Kv label="유효성" value={validityLabel(validity)} green />
              <Kv label="가격" value={price} />
              <Kv label="리셀" value={resalePolicyLabel(ticket, event)} />
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <ActionButton label="QR 보기" variant="primary" onPress={() => navigation.navigate('TicketQr', { ticketId: id })} />
          <ActionButton label="리셀 등록" variant="dark" disabled={!canResale} onPress={() => navigation.navigate('TicketResaleCreate', { ticketId: id })} />
          <ActionButton label="내 티켓 분쟁 신고" variant="outline" onPress={() => navigation.navigate('DisputeCreate', { ticketId: id })} />
        </View>

        {!canResale ? (
          <View style={styles.section}>
            <View style={styles.notice}>
              <View style={styles.noticeIcon}><TicketIcon name="info" size={20} color="#F97316" /></View>
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>리셀 등록 불가</Text>
                <Text style={styles.noticeSub}>보유 중인 티켓이고 이벤트/티켓 정책에서 리셀이 허용된 경우에만 등록할 수 있습니다.</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.chainCard}>
            <View style={styles.chainIcon}><TicketIcon name="shield" size={22} color="#A89CF7" /></View>
            <View style={styles.chainCopy}>
              <Text style={styles.chainTitle}>블록체인 소유권 확인</Text>
              <Text style={styles.chainSub}>현재 티켓 소유권과 구매 이력이 연결된 지갑 기준으로 검증되어 있습니다.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ticketPoster: { width: 84, height: 112, borderRadius: 18, overflow: 'hidden', flexShrink: 0 },
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  screen: { flex: 1 },
  content: { paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  emptyText: { color: '#94A3B8', fontWeight: '800' },
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
  },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  detailHero: { marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  ticketPass: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 16, position: 'relative', overflow: 'hidden', ...flowShadow },
  notchLeft: { position: 'absolute', left: -11, top: 118, width: 22, height: 22, borderRadius: 11, backgroundColor: '#F6F7FB', borderWidth: 1, borderColor: '#E5E7EB' },
  notchRight: { position: 'absolute', right: -11, top: 118, width: 22, height: 22, borderRadius: 11, backgroundColor: '#F6F7FB', borderWidth: 1, borderColor: '#E5E7EB' },
  passTop: { flexDirection: 'row', gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: '#DBE3EF' },
  ticketInfo: { flex: 1, minWidth: 0 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  ticketName: { fontSize: 15, fontWeight: '900', lineHeight: 19, letterSpacing: 0, color: '#0F172A', marginBottom: 7 },
  ticketMeta: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  passBody: { paddingTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kv: { width: '48%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EDF2F7', borderRadius: 17, padding: 12 },
  k: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 5 },
  v: { fontSize: 13, fontWeight: '900', color: '#0F172A', lineHeight: 18 },
  vGreen: { color: '#0F6E56' },
  actions: { paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: { minHeight: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  action_primary: { flex: 1, backgroundColor: '#534AB7', ...flowShadow },
  action_dark: { flex: 1, backgroundColor: '#1A1A2E', ...flowShadow },
  action_outline: { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CECBF6' },
  actionDisabled: { opacity: 0.48 },
  actionText: { fontSize: 15, fontWeight: '900' },
  actionText_primary: { color: '#FFFFFF' },
  actionText_dark: { color: '#FFFFFF' },
  actionText_outline: { color: '#534AB7' },
  notice: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 22, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  noticeIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  noticeSub: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  chainCard: { backgroundColor: '#1A1A2E', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  chainIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(168,156,247,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chainCopy: { flex: 1 },
  chainTitle: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', marginBottom: 3 },
  chainSub: { fontSize: 11, color: 'rgba(255,255,255,0.58)', lineHeight: 17, fontWeight: '700' },
});
