import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from '../components/TextInput';
import { FlowBadge, FlowHero, IconButton, PosterArt, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import {
  eventDateLabel,
  eventTitle,
  eventVenue,
  formatDateTime,
  sectionNameOf,
  ticketIdOf,
  weiToEthLabel,
} from '../lib/ticketFlowDisplay';
import type { DisputeRecord, EventDetail, ResaleListing, TicketDetail } from '../types/api';

type TargetType = 'ticket' | 'resale';

type TicketOption = {
  ticket: TicketDetail;
  event?: EventDetail;
};

type ResaleOption = {
  listing: ResaleListing;
  ticket?: TicketDetail;
  event?: EventDetail;
};

const DISPUTE_TYPES = [
  { value: 'PAYMENT_ISSUE', label: '결제 문제' },
  { value: 'FRAUD_SUSPECTED', label: '사기 의심' },
  { value: 'OTHER', label: '기타' },
];

function isActiveDispute(status?: string) {
  return ['OPEN', 'RECEIVED', 'REVIEWING', 'PROCESSING'].includes(String(status ?? '').toUpperCase());
}

function normalizeDisputeFailure(cause: any, fallback: string) {
  const message = errorMessage(cause, fallback);
  if (message.includes('이미 처리 중') || message.includes('CONFLICT')) return '동일한 거래/티켓에 대해 이미 신고하셨습니다.';
  if (message.includes('권한') || message.includes('Forbidden') || message.includes('FORBIDDEN')) return '본인의 티켓 또는 거래만 신고할 수 있습니다.';
  if (message.includes('상태') || message.includes('status')) return '접수 가능한 상태의 티켓 또는 거래가 아닙니다.';
  return message || fallback;
}

function selectedTargetTitle(targetType: TargetType, ticket?: TicketOption | null, resale?: ResaleOption | null) {
  if (targetType === 'resale') return eventTitle(resale?.event, resale?.ticket) || resale?.listing.eventName || '리셀 거래 신고';
  return eventTitle(ticket?.event, ticket?.ticket);
}

function TargetSummary({
  title,
  venue,
  date,
  seat,
  price,
  selected,
}: {
  title: string;
  venue?: string;
  date?: string;
  seat?: string;
  price?: string;
  selected?: boolean;
}) {
  return (
    <View style={[styles.selectedTicket, selected && styles.selectedTicketActive]}>
      <PosterArt title={title} variant={2} style={styles.targetPoster} />
      <View style={styles.targetCopy}>
        {selected ? <FlowBadge label="선택됨" /> : null}
        <Text style={styles.ticketName} numberOfLines={2}>{title}</Text>
        <Text style={styles.ticketMeta}>{venue || '-'}</Text>
        <Text style={styles.ticketMeta}>{formatDateTime(date)}</Text>
        <Text style={styles.ticketMeta}>{seat || '-'}</Text>
        {price ? <Text style={styles.ticketMeta}>{price}</Text> : null}
      </View>
    </View>
  );
}

export default function DisputeCreatePage({ route, navigation }: any) {
  const editingDispute = route?.params?.dispute as DisputeRecord | undefined;
  const isEditing = Boolean(editingDispute?.id);
  const directTicketId = editingDispute?.ticketId ? String(editingDispute.ticketId) : route?.params?.ticketId ? String(route.params.ticketId) : '';
  const directResaleListingId = editingDispute?.resaleListingId
    ? String(editingDispute.resaleListingId)
    : route?.params?.resaleListingId
      ? String(route.params.resaleListingId)
      : '';
  const hasDirectTarget = Boolean(directTicketId || directResaleListingId);

  const [targetType, setTargetType] = useState<TargetType>(directResaleListingId ? 'resale' : 'ticket');
  const [ticketOptions, setTicketOptions] = useState<TicketOption[]>([]);
  const [resaleOptions, setResaleOptions] = useState<ResaleOption[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState(directTicketId);
  const [selectedResaleListingId, setSelectedResaleListingId] = useState(directResaleListingId);
  const [selectedTicketSummary, setSelectedTicketSummary] = useState<TicketOption | null>(null);
  const [selectedResaleSummary, setSelectedResaleSummary] = useState<ResaleOption | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(!isEditing);
  const [type, setType] = useState(editingDispute?.type || route?.params?.type || 'OTHER');
  const [description, setDescription] = useState(editingDispute?.description || '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const loadTicketSummary = async (targetTicketId: string) => {
      try {
        const ticket = await backendApi.getTicket(targetTicketId);
        const event = ticket.eventId ? await backendApi.getEvent(String(ticket.eventId)).catch(() => undefined) : undefined;
        const summary = { ticket, event };
        setSelectedTicketSummary(summary);
        setSelectedTicketId(ticketIdOf(ticket) || targetTicketId);
      } catch {
        setSelectedTicketSummary(null);
      }
    };

    const loadResaleSummary = async (listingId: string) => {
      try {
        const listing = await backendApi.getResaleListing(listingId);
        const [ticket, event] = await Promise.all([
          backendApi.getTicket(String(listing.ticketId)).catch(() => undefined),
          backendApi.getEvent(String(listing.eventId)).catch(() => undefined),
        ]);
        const summary = { listing, ticket, event };
        setSelectedResaleSummary(summary);
        setSelectedResaleListingId(String(listing.id ?? listing.listingId ?? listingId));
        setSelectedTicketId(ticketIdOf(ticket) || String(listing.ticketId));
      } catch {
        setSelectedResaleSummary(null);
      }
    };

    if (directResaleListingId) {
      void loadResaleSummary(directResaleListingId);
    } else if (directTicketId) {
      void loadTicketSummary(directTicketId);
    }
  }, [directResaleListingId, directTicketId]);

  useEffect(() => {
    if (isEditing) {
      setLoadingTargets(false);
      return;
    }

    const loadTargets = async () => {
      setLoadingTargets(true);
      try {
        const [me, tickets] = await Promise.all([
          backendApi.getMe().catch(() => null),
          backendApi.getMyTickets().catch(() => []),
        ]);

        const eventIds = Array.from(new Set(tickets.map((ticket) => ticket.eventId).filter(Boolean)));
        const eventEntries = await Promise.all(
          eventIds.map(async (id) => [String(id), await backendApi.getEvent(String(id)).catch(() => undefined)] as const),
        );
        const eventsById = Object.fromEntries(eventEntries);
        setTicketOptions(tickets.map((ticket) => ({ ticket, event: eventsById[String(ticket.eventId)] })));

        const listingsPage = await backendApi.getResaleListings({ size: 100 }).catch(() => ({ items: [] }));
        const relatedListings = (listingsPage.items ?? []).filter((listing) => {
          if (!me?.id) return false;
          return listing.sellerId === me.id || listing.buyerId === me.id;
        });
        const resaleItems = await Promise.all(
          relatedListings.map(async (listing) => {
            const [ticket, event] = await Promise.all([
              backendApi.getTicket(String(listing.ticketId)).catch(() => undefined),
              backendApi.getEvent(String(listing.eventId)).catch(() => undefined),
            ]);
            return { listing, ticket, event };
          }),
        );
        setResaleOptions(resaleItems);
      } catch (cause: any) {
        setFeedback(errorMessage(cause, '신고 대상 목록을 불러오지 못했습니다.'));
      } finally {
        setLoadingTargets(false);
      }
    };

    void loadTargets();
  }, [isEditing]);

  const selectedTicket = useMemo(
    () => selectedTicketSummary ?? ticketOptions.find((option) => ticketIdOf(option.ticket) === selectedTicketId) ?? null,
    [selectedTicketId, selectedTicketSummary, ticketOptions],
  );
  const selectedResale = useMemo(
    () => selectedResaleSummary ?? resaleOptions.find((option) => String(option.listing.id ?? option.listing.listingId) === selectedResaleListingId) ?? null,
    [selectedResaleListingId, selectedResaleSummary, resaleOptions],
  );

  const title = isEditing ? '분쟁 신고 수정' : '내 분쟁 신고';
  const submitText = useMemo(() => {
    if (submitting) return isEditing ? '수정 중...' : '접수 중...';
    return isEditing ? '분쟁 신고 수정' : '분쟁 신고 접수';
  }, [isEditing, submitting]);

  const chooseTargetType = (nextType: TargetType) => {
    if (isEditing || hasDirectTarget) return;
    setTargetType(nextType);
    setFeedback('');
    if (nextType === 'ticket') {
      setSelectedResaleListingId('');
      setSelectedResaleSummary(null);
    } else {
      setSelectedTicketId('');
      setSelectedTicketSummary(null);
    }
  };

  const submit = async () => {
    const resolvedTicketId = selectedTicketId;
    const resolvedResaleListingId = targetType === 'resale' ? selectedResaleListingId : '';

    if (!isEditing && !resolvedTicketId.trim() && !resolvedResaleListingId.trim()) {
      const message = '신고 대상을 선택해주세요.';
      setFeedback(message);
      Alert.alert('입력 필요', message);
      return;
    }
    if (!description.trim()) {
      const message = '신고 내용을 입력해주세요.';
      setFeedback(message);
      Alert.alert('입력 필요', message);
      return;
    }

    setSubmitting(true);
    setFeedback('');
    try {
      if (isEditing && editingDispute?.id) {
        await backendApi.updateDispute(String(editingDispute.id), {
          type,
          description: description.trim(),
        });
        Alert.alert('수정 완료', '분쟁 신고 내용이 수정되었습니다.');
      } else {
        const mine = await backendApi.getMyDisputes({ size: 100 }).catch(() => ({ items: [] }));
        const duplicate = (mine.items ?? []).some((item) => {
          if (!isActiveDispute(item.status)) return false;
          const sameResale = resolvedResaleListingId.trim() && String(item.resaleListingId ?? '') === resolvedResaleListingId.trim();
          const sameTicket = resolvedTicketId.trim() && String(item.ticketId ?? '') === resolvedTicketId.trim();
          return Boolean(sameResale || sameTicket);
        });
        if (duplicate) throw new Error('동일한 거래/티켓에 대해 이미 신고하셨습니다.');

        await backendApi.createDispute({
          ticketId: resolvedTicketId.trim() || null,
          resaleListingId: resolvedResaleListingId.trim() || null,
          type,
          description: description.trim(),
        });
        Alert.alert('신고 완료', '분쟁 신고가 접수되었습니다.');
      }
      navigation.replace('MyDisputes');
    } catch (cause: any) {
      const visibleMessage = normalizeDisputeFailure(
        cause,
        isEditing ? '분쟁 신고를 수정하지 못했습니다.' : '분쟁 신고를 접수하지 못했습니다.',
      );
      setFeedback(visibleMessage);
      Alert.alert(isEditing ? '수정 실패' : '신고 실패', visibleMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const hasSelectedTarget = targetType === 'ticket' ? Boolean(selectedTicket) : Boolean(selectedResale);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.84}>
          <IconButton><TicketIcon name="arrowLeft" size={20} /></IconButton>
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.eyebrow}>Dispute</Text>
          <Text style={styles.topTitle}>{title}</Text>
        </View>
        <IconButton><TicketIcon name="help" size={20} /></IconButton>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FlowHero
          height={166}
          style={styles.disputeHero}
          posters={false}
          badge="분쟁 신고"
          title={'문제 상황을\n간단히 알려주세요'}
          meta="티켓 또는 리셀 거래와 관련된 문제를 접수합니다."
        />

        <View style={styles.section}>
          <View style={styles.formCard}>
            <View style={styles.head}>
              <View>
                <Text style={styles.headTitle}>신고 대상</Text>
                <Text style={styles.headSub}>신고할 대상을 선택하세요</Text>
              </View>
            </View>

            <View style={styles.choiceGrid}>
              <TouchableOpacity
                style={[styles.choice, targetType === 'ticket' && styles.choiceActive, (isEditing || hasDirectTarget) && styles.choiceLocked]}
                onPress={() => chooseTargetType('ticket')}
                activeOpacity={0.84}
              >
                <Text style={[styles.choiceText, targetType === 'ticket' && styles.choiceTextActive]}>내 티켓 문제</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choice, targetType === 'resale' && styles.choiceActive, (isEditing || hasDirectTarget) && styles.choiceLocked]}
                onPress={() => chooseTargetType('resale')}
                activeOpacity={0.84}
              >
                <Text style={[styles.choiceText, targetType === 'resale' && styles.choiceTextActive]}>리셀 거래 문제</Text>
              </TouchableOpacity>
            </View>

            {loadingTargets ? <ActivityIndicator style={styles.loader} color="#534AB7" /> : null}

            {targetType === 'ticket' && selectedTicket ? (
              <TargetSummary
                selected
                title={selectedTargetTitle(targetType, selectedTicket, selectedResale)}
                venue={eventVenue(selectedTicket.event, selectedTicket.ticket)}
                date={selectedTicket.event?.eventAt || selectedTicket.event?.eventStartAt || selectedTicket.ticket.eventDateTime}
                seat={`${sectionNameOf(selectedTicket.ticket)} · ${selectedTicket.ticket.seatInfo}`}
              />
            ) : null}

            {targetType === 'resale' && selectedResale ? (
              <TargetSummary
                selected
                title={selectedTargetTitle(targetType, selectedTicket, selectedResale)}
                venue={eventVenue(selectedResale.event, selectedResale.ticket)}
                date={selectedResale.event?.eventAt || selectedResale.event?.eventStartAt || selectedResale.ticket?.eventDateTime}
                seat={selectedResale.ticket?.seatInfo || selectedResale.listing.seatInfo}
                price={weiToEthLabel(selectedResale.listing.priceWei ?? selectedResale.listing.price)}
              />
            ) : null}

            {!hasDirectTarget && !isEditing && targetType === 'ticket' && !selectedTicket ? (
              <View style={styles.optionList}>
                {ticketOptions.length ? ticketOptions.map((option) => {
                  const optionId = ticketIdOf(option.ticket);
                  return (
                    <TouchableOpacity key={optionId} onPress={() => setSelectedTicketId(optionId)} activeOpacity={0.84}>
                      <TargetSummary
                        title={eventTitle(option.event, option.ticket)}
                        venue={eventVenue(option.event, option.ticket)}
                        date={eventDateLabel(option.event, option.ticket)}
                        seat={`${sectionNameOf(option.ticket)} · ${option.ticket.seatInfo}`}
                      />
                    </TouchableOpacity>
                  );
                }) : <Text style={styles.emptyText}>신고할 수 있는 내 티켓을 찾지 못했습니다.</Text>}
              </View>
            ) : null}

            {!hasDirectTarget && !isEditing && targetType === 'resale' && !selectedResale ? (
              <View style={styles.optionList}>
                {resaleOptions.length ? resaleOptions.map((option) => {
                  const optionId = String(option.listing.id ?? option.listing.listingId);
                  return (
                    <TouchableOpacity
                      key={optionId}
                      onPress={() => {
                        setSelectedResaleListingId(optionId);
                        setSelectedTicketId(ticketIdOf(option.ticket) || String(option.listing.ticketId));
                      }}
                      activeOpacity={0.84}
                    >
                      <TargetSummary
                        title={eventTitle(option.event, option.ticket) || option.listing.eventName || '리셀 거래 신고'}
                        venue={eventVenue(option.event, option.ticket)}
                        date={option.event?.eventAt || option.event?.eventStartAt || option.ticket?.eventDateTime}
                        seat={option.ticket?.seatInfo || option.listing.seatInfo}
                        price={weiToEthLabel(option.listing.priceWei ?? option.listing.price)}
                      />
                    </TouchableOpacity>
                  );
                }) : <Text style={styles.emptyText}>관련 리셀 거래를 찾지 못했습니다.</Text>}
              </View>
            ) : null}

            {!loadingTargets && !hasSelectedTarget ? (
              <View style={styles.emptyTarget}>
                <TicketIcon name="alert" size={20} color="#94A3B8" />
                <Text style={styles.emptyTargetText}>신고 대상을 선택해주세요.</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.formCard}>
            <Text style={styles.label}>분쟁 유형</Text>
            <View style={styles.typeRow}>
              {DISPUTE_TYPES.map((item) => {
                const active = type === item.value;
                return (
                  <TouchableOpacity key={item.value} style={[styles.type, active && styles.typeActive]} onPress={() => setType(item.value)} activeOpacity={0.84}>
                    <Text style={[styles.typeText, active && styles.typeTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>신고 내용</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDescription}
              placeholder="상황을 구체적으로 입력해 주세요."
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        {feedback ? (
          <View style={styles.section}>
            <View style={styles.feedbackBox}>
              <TicketIcon name="alert" size={20} color="#DC2626" />
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <TouchableOpacity style={[styles.primaryButton, submitting && styles.primaryDisabled]} disabled={submitting} onPress={submit} activeOpacity={0.88}>
            <TicketIcon name="alert" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{submitText}</Text>
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
  disputeHero: { marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  formCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 16, ...flowShadow },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  headTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  headSub: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '700' },
  choiceGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  choice: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 17, backgroundColor: '#FFFFFF', paddingVertical: 13, paddingHorizontal: 10, alignItems: 'center' },
  choiceActive: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  choiceLocked: { opacity: 0.72 },
  choiceText: { fontSize: 12, fontWeight: '900', color: '#64748B', textAlign: 'center' },
  choiceTextActive: { color: '#534AB7' },
  loader: { marginVertical: 12 },
  optionList: { gap: 10, marginTop: 8 },
  selectedTicket: { marginTop: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, padding: 14, flexDirection: 'row', gap: 10 },
  selectedTicketActive: { borderWidth: 1.5, borderColor: '#534AB7' },
  targetPoster: { width: 76, height: 100, borderRadius: 16 },
  targetCopy: { flex: 1, minWidth: 0, gap: 4 },
  ticketName: { fontSize: 15, fontWeight: '900', lineHeight: 19, letterSpacing: 0, color: '#0F172A', marginTop: 2 },
  ticketMeta: { fontSize: 11, color: '#64748B', lineHeight: 16, fontWeight: '700' },
  emptyText: { color: '#94A3B8', textAlign: 'center', fontWeight: '800', paddingVertical: 18 },
  emptyTarget: { marginTop: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyTargetText: { color: '#64748B', fontWeight: '800', fontSize: 12 },
  label: { fontSize: 11, fontWeight: '900', color: '#64748B', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  type: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  typeActive: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  typeText: { fontSize: 12, fontWeight: '900', color: '#64748B' },
  typeTextActive: { color: '#534AB7' },
  textarea: { width: '100%', minHeight: 134, borderWidth: 1, borderColor: '#D9E1EE', borderRadius: 17, padding: 13, fontSize: 13, color: '#0F172A', backgroundColor: '#FFFFFF' },
  feedbackBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 19, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  feedbackText: { flex: 1, color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  primaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: '#534AB7', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', ...flowShadow },
  primaryDisabled: { opacity: 0.55 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
