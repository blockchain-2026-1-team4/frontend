import { useProvider } from '@reown/appkit-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from '../components/TextInput';
import { FlowBadge, FlowHero, IconButton, PosterThumb, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import WalletRequiredView from '../components/WalletRequiredView';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { listTicketOnChain } from '../lib/blockchain/client';
import { showDialog } from '../lib/dialog';
import {
  canRegisterResale,
  ethToWeiValue,
  eventDateLabel,
  eventTitle,
  eventVenue,
  maxResalePriceLabel,
  resaleDeadlineLabel,
  resalePolicyLabel,
  sectionNameOf,
  ticketIdOf,
  ticketStatusLabel,
  validityLabel,
  weiToEthInputValue,
  weiToEthLabel,
} from '../lib/ticketFlowDisplay';
import type { EventDetail, TicketDetail, UserProfile } from '../types/api';

function normalizeResaleFailure(cause: any) {
  const message = errorMessage(cause, '리셀 등록에 실패했습니다.');
  if (message.includes('owner') || message.includes('FORBIDDEN') || message.includes('권한')) {
    return '본인 소유 티켓만 리셀 등록할 수 있습니다.';
  }
  if (message.includes('LISTED') || message.includes('이미')) {
    return '이미 리셀 등록된 티켓입니다.';
  }
  if (message.includes('USED')) {
    return '사용 완료된 티켓은 리셀 등록할 수 없습니다.';
  }
  if (message.includes('EXPIRED') || message.includes('종료') || message.includes('만료')) {
    return '리셀 가능 기간이 종료되었습니다.';
  }
  if (message.includes('resaleAllowed') || message.includes('정책')) {
    return '리셀 정책상 판매가 제한된 티켓입니다.';
  }
  if (message.includes('price') || message.includes('가격')) {
    return '리셀 가능 가격을 초과했습니다.';
  }
  return message;
}

function localBlockReason(ticket: TicketDetail | null, event: EventDetail | null) {
  const status = String(ticket?.status ?? '').toUpperCase();
  const now = Date.now();

  if (status === 'LISTED') return '이미 리셀 등록됨';
  if (status === 'USED') return '이미 사용된 티켓';
  if (status === 'AVAILABLE') return '구매 완료된 본인 티켓만 리셀 등록할 수 있습니다.';
  if (status && status !== 'SOLD') return '현재 상태에서는 리셀 등록할 수 없습니다.';

  const ticketRoundId = ticket?.eventRoundId ? String(ticket.eventRoundId) : null;
  if (ticketRoundId && event?.rounds?.length) {
    const round = event.rounds.find((r) => r.id && String(r.id) === ticketRoundId);
    if (round) {
      const endStr = round.eventDate && round.endTime ? `${round.eventDate}T${round.endTime}` : round.eventDate;
      if (endStr && now > new Date(endStr).getTime()) return '종료된 회차';
    }
  }

  const eventStatus = String(event?.status ?? '').toUpperCase();
  if (eventStatus === 'CANCELLED' || eventStatus === 'FLAGGED') return '리셀 금지 이벤트';
  if (!canRegisterResale(ticket, event)) {
    if (ticket?.resaleEnabled === false || event?.resaleAllowed === false) return '리셀 금지 이벤트';
    if (event?.resaleStart && now < new Date(event.resaleStart).getTime()) return '아직 리셀 가능 기간이 아닙니다.';
    if (event?.resaleEnd && now > new Date(event.resaleEnd).getTime()) return '종료된 회차';
    return '현재 이 티켓은 리셀 등록할 수 없습니다.';
  }
  return '';
}

function PolicyRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.policyRow}>
      <Text style={styles.policyKey}>{label}</Text>
      <Text style={styles.policyValue}>{value || '-'}</Text>
    </View>
  );
}

export default function TicketResaleCreatePage({ route, navigation }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [validity, setValidity] = useState<Record<string, unknown> | null>(null);
  const [priceEth, setPriceEth] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { provider } = useProvider();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ticketData, validityData, meData] = await Promise.all([
          backendApi.getTicket(String(ticketId)),
          backendApi.getTicketValidity(String(ticketId)).catch(() => null),
          backendApi.getMe().catch(() => null),
        ]);
        const eventData = ticketData.eventId ? await backendApi.getEvent(String(ticketData.eventId)).catch(() => null) : null;
        setTicket(ticketData);
        setEvent(eventData);
        setValidity(validityData);
        setMe(meData);
        setPriceEth(weiToEthInputValue(ticketData.originalPriceWei ?? ticketData.priceWei));
      } catch (error: any) {
        showDialog('오류', errorMessage(error, '티켓 정보를 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [ticketId]);

  const blockReason = useMemo(() => localBlockReason(ticket, event), [event, ticket]);
  const priceValid = Number(priceEth) > 0 && !Number.isNaN(Number(priceEth));

  const handleCreateResale = async () => {
    if (blockReason) {
      setFeedback(blockReason);
      showDialog('리셀 등록 불가', blockReason);
      return;
    }
    if (!priceValid) {
      const message = '리셀 가격을 KAIA 단위로 입력해주세요. 예: 0.05';
      setFeedback(message);
      showDialog('입력 오류', message);
      return;
    }

    setSubmitting(true);
    setFeedback('');
    try {
      const priceWei = ethToWeiValue(priceEth);
      const tokenId = ticket?.contractTokenId;
      if (!tokenId) throw new Error('온체인 tokenId가 없는 티켓입니다. 리셀 등록 전에 티켓 발행 상태를 확인해주세요.');
      const transactionHash = await listTicketOnChain(provider, String(tokenId), priceWei);
      const listing = await backendApi.createResale(String(ticketId), priceWei, transactionHash);
      navigation.replace('ResaleRegisterComplete', { listingId: listing.id ?? listing.listingId, ticketId });
    } catch (error: any) {
      const message = normalizeResaleFailure(error);
      setFeedback(message);
      showDialog('등록 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;
  if (!me?.walletAddress?.trim()) return <WalletRequiredView navigation={navigation} feature="리셀 등록" />;

  const title = eventTitle(event, ticket);
  const basePrice = ticket?.originalPriceWei ?? ticket?.priceWei ?? event?.ticketPriceWei;
  const okMessage = '등록 가능한 가격입니다.';

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.84}>
          <IconButton><TicketIcon name="arrowLeft" size={20} /></IconButton>
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.eyebrow}>Resale</Text>
          <Text style={styles.topTitle}>티켓 리셀 등록</Text>
        </View>
        <IconButton><TicketIcon name="info" size={20} /></IconButton>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FlowHero
          height={166}
          style={styles.resaleHero}
          posters={false}
          badge="공식 리셀"
          title={'보유 티켓을\n안전하게 등록하세요'}
          meta="블록체인 검증 후 공식 리셀 목록에 표시합니다."
        />

        <View style={styles.section}>
          <View style={styles.formCard}>
            <View style={styles.head}>
              <View style={styles.headCopy}>
                <Text style={styles.headTitle}>등록할 티켓</Text>
                <Text style={styles.headSub}>현재 보유 중인 티켓만 등록할 수 있습니다.</Text>
              </View>
              <FlowBadge label={validityLabel(validity)} tone={validity?.valid === false ? 'red' : 'green'} />
            </View>
            <View style={styles.selectedTicket}>
              <PosterThumb imageUrl={resolveImageUrl(event?.imageUrl)} title={title} variant={1} style={styles.ticketPoster} />
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketName} numberOfLines={3}>{title}</Text>
                <Text style={styles.ticketMeta}>{eventDateLabel(event, ticket)}{'\n'}{sectionNameOf(ticket)} · {ticket?.seatInfo || ticketIdOf(ticket)}</Text>
                <Text style={styles.ticketMeta}>{eventVenue(event, ticket)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.policyCard}>
            <PolicyRow label="원가" value={weiToEthLabel(basePrice)} />
            <PolicyRow label="최대 리셀가" value={maxResalePriceLabel(ticket, event)} />
            <PolicyRow label="리셀 기한" value={resaleDeadlineLabel(ticket, event)} />
            <PolicyRow label="리셀 정책" value={resalePolicyLabel(ticket, event)} />
            <PolicyRow label="티켓 상태" value={ticketStatusLabel(ticket?.status)} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>리셀 가격</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={priceEth}
                  onChangeText={setPriceEth}
                  placeholder="0.05"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.suffix}>KAIA</Text>
              </View>
            </View>
            <View style={[styles.alert, blockReason || feedback ? styles.alertRed : styles.alertGreen]}>
              <TicketIcon name={blockReason || feedback ? 'alert' : 'check'} size={19} color={blockReason || feedback ? '#DC2626' : '#0F6E56'} />
              <View style={styles.alertCopy}>
                <Text style={[styles.alertTitle, blockReason || feedback ? styles.alertTitleRed : styles.alertTitleGreen]}>
                  {blockReason || feedback || okMessage}
                </Text>
                <Text style={styles.alertSub}>
                  {blockReason ? '리셀 등록이 불가한 상태입니다.' : feedback ? '' : '주최자 정책의 원가와 최대 리셀가 범위 안에서 등록할 수 있습니다.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={[styles.primaryButton, (submitting || Boolean(blockReason)) && styles.primaryDisabled]} onPress={handleCreateResale} disabled={submitting} activeOpacity={0.88}>
            <TicketIcon name="tag" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{submitting ? '등록 중...' : blockReason ? '리셀 등록 불가' : '리셀 등록하기'}</Text>
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
  topTitleWrap: { flex: 1, alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 2 },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  resaleHero: { marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  formCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 16, ...flowShadow },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  headCopy: { flex: 1 },
  headTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  headSub: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '700', lineHeight: 16 },
  selectedTicket: { flexDirection: 'row', gap: 12 },
  ticketPoster: { width: 84, height: 112, borderRadius: 18, overflow: 'hidden', flexShrink: 0 },
  ticketInfo: { flex: 1, minWidth: 0 },
  ticketName: { fontSize: 15, fontWeight: '900', lineHeight: 19, letterSpacing: 0, color: '#0F172A', marginBottom: 7 },
  ticketMeta: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700', marginBottom: 3 },
  policyCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, paddingHorizontal: 14, ...flowShadow },
  policyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  policyKey: { fontSize: 12, color: '#64748B', fontWeight: '800' },
  policyValue: { flex: 1, fontSize: 13, fontWeight: '900', color: '#0F172A', textAlign: 'right' },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '900', color: '#64748B', marginBottom: 6 },
  inputWrap: { height: 54, borderWidth: 1, borderColor: '#D9E1EE', borderRadius: 17, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  input: { flex: 1, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent', fontSize: 18, fontWeight: '900', color: '#0F172A' },
  suffix: { fontSize: 13, fontWeight: '900', color: '#64748B' },
  alert: { borderRadius: 19, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1 },
  alertGreen: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  alertRed: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  alertCopy: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '900', marginBottom: 3 },
  alertTitleGreen: { color: '#0F6E56' },
  alertTitleRed: { color: '#DC2626' },
  alertSub: { fontSize: 11, lineHeight: 16, color: '#64748B', fontWeight: '700' },
  primaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: '#534AB7', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', ...flowShadow },
  primaryDisabled: { opacity: 0.55 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
