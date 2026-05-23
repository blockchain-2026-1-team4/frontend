import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
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

function isActiveDispute(status?: string) {
  return ['OPEN', 'RECEIVED', 'REVIEWING', 'PROCESSING'].includes(String(status ?? '').toUpperCase());
}

function normalizeDisputeFailure(cause: any, fallback: string) {
  const message = errorMessage(cause, fallback);
  if (message.includes('이미 처리 중') || message.includes('CONFLICT')) return '이미 처리 중인 분쟁 신고가 있습니다.';
  if (message.includes('권한') || message.includes('Forbidden') || message.includes('FORBIDDEN')) return '본인의 티켓 또는 거래만 신고할 수 있습니다.';
  if (message.includes('상태') || message.includes('status')) return '접수 가능한 상태의 티켓 또는 거래가 아닙니다.';
  return message || fallback;
}

const DISPUTE_TYPES = [
  { value: 'TICKET_NOT_DELIVERED', label: '티켓 미전달' },
  { value: 'PAYMENT_ISSUE', label: '결제 문제' },
  { value: 'FRAUD_SUSPECTED', label: '사기 의심' },
  { value: 'OTHER', label: '기타' },
];

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function ticketIdOf(ticket?: TicketDetail | null) {
  return ticket?.id ? String(ticket.id) : ticket?.ticketId ? String(ticket.ticketId) : '';
}

function normalizeFailureMessage(cause: any, fallback: string) {
  const message = errorMessage(cause, fallback);
  if (message.includes('이미 처리 중')) return '이미 처리 중인 분쟁 신고가 있습니다.';
  if (message.includes('권한') || message.includes('Forbidden') || message.includes('FORBIDDEN')) return '본인의 티켓 또는 거래만 신고할 수 있습니다.';
  if (message.includes('상태') || message.includes('status')) return '접수 가능한 상태의 티켓 또는 거래가 아닙니다.';
  if (message.includes('티켓') || message.includes('리셀')) return message;
  return message || fallback;
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
    const loadTicketSummary = async (ticketId: string) => {
      try {
        const ticket = await backendApi.getTicket(ticketId);
        const event = ticket.eventId ? await backendApi.getEvent(String(ticket.eventId)).catch(() => undefined) : undefined;
        const summary = { ticket, event };
        setSelectedTicketSummary(summary);
        setSelectedTicketId(ticketIdOf(ticket) || ticketId);
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

  const title = isEditing ? '분쟁 신고 수정' : '새 분쟁 신고';
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
    const resolvedTicketId = targetType === 'ticket' ? selectedTicketId : selectedTicketId;
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
        if (duplicate) {
          throw new Error('이미 처리 중인 분쟁 신고가 있습니다.');
        }
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Dispute</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {isEditing ? '접수 단계의 분쟁 신고 사유와 내용을 수정합니다.' : '신고할 티켓 또는 리셀 거래를 선택한 뒤 내용을 작성합니다.'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>신고 대상</Text>
        <View style={styles.targetTypeRow}>
          <TouchableOpacity
            style={[styles.targetTypeButton, targetType === 'ticket' && styles.activeTargetTypeButton, (isEditing || hasDirectTarget) && styles.lockedButton]}
            onPress={() => chooseTargetType('ticket')}
          >
            <Text style={[styles.targetTypeText, targetType === 'ticket' && styles.activeTargetTypeText]}>내 티켓 문제 신고</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.targetTypeButton, targetType === 'resale' && styles.activeTargetTypeButton, (isEditing || hasDirectTarget) && styles.lockedButton]}
            onPress={() => chooseTargetType('resale')}
          >
            <Text style={[styles.targetTypeText, targetType === 'resale' && styles.activeTargetTypeText]}>리셀 거래 문제 신고</Text>
          </TouchableOpacity>
        </View>

        {loadingTargets ? <ActivityIndicator style={styles.loader} color="#2563EB" /> : null}

        {!isEditing && !hasDirectTarget && targetType === 'ticket' ? (
          <View style={styles.optionList}>
            {ticketOptions.length ? ticketOptions.map((option) => {
              const optionId = ticketIdOf(option.ticket);
              return (
                <TouchableOpacity key={optionId} style={[styles.optionCard, selectedTicketId === optionId && styles.selectedOptionCard]} onPress={() => setSelectedTicketId(optionId)}>
                  <TargetSummary title={option.event?.name || option.ticket.eventTitle || option.ticket.eventName || '이벤트'} seat={option.ticket.seatInfo} date={option.event?.eventAt || option.ticket.eventDateTime} />
                </TouchableOpacity>
              );
            }) : <Text style={styles.emptyText}>신고할 수 있는 내 티켓을 찾지 못했습니다.</Text>}
          </View>
        ) : null}

        {!isEditing && !hasDirectTarget && targetType === 'resale' ? (
          <View style={styles.optionList}>
            {resaleOptions.length ? resaleOptions.map((option) => {
              const optionId = String(option.listing.id ?? option.listing.listingId);
              return (
                <TouchableOpacity key={optionId} style={[styles.optionCard, selectedResaleListingId === optionId && styles.selectedOptionCard]} onPress={() => {
                  setSelectedResaleListingId(optionId);
                  setSelectedTicketId(ticketIdOf(option.ticket) || String(option.listing.ticketId));
                }}>
                  <TargetSummary
                    title={option.event?.name || option.listing.eventName || option.ticket?.eventTitle || '리셀 거래'}
                    seat={option.ticket?.seatInfo || option.listing.seatInfo}
                    date={option.listing.purchasedAt || option.listing.createdAt}
                    price={`${option.listing.priceWei ?? option.listing.price ?? '-'} WEI`}
                  />
                </TouchableOpacity>
              );
            }) : <Text style={styles.emptyText}>관련 리셀 거래를 찾지 못했습니다.</Text>}
          </View>
        ) : null}

        {targetType === 'ticket' && selectedTicket ? (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedLabel}>선택된 티켓</Text>
            <TargetSummary title={selectedTicket.event?.name || selectedTicket.ticket.eventTitle || selectedTicket.ticket.eventName || '이벤트'} seat={selectedTicket.ticket.seatInfo} date={selectedTicket.event?.eventAt || selectedTicket.ticket.eventDateTime} />
          </View>
        ) : null}

        {targetType === 'resale' && selectedResale ? (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedLabel}>선택된 리셀 거래</Text>
            <TargetSummary
              title={selectedResale.event?.name || selectedResale.listing.eventName || selectedResale.ticket?.eventTitle || '리셀 거래'}
              seat={selectedResale.ticket?.seatInfo || selectedResale.listing.seatInfo}
              date={selectedResale.listing.purchasedAt || selectedResale.listing.createdAt}
              price={`${selectedResale.listing.priceWei ?? selectedResale.listing.price ?? '-'} WEI`}
            />
          </View>
        ) : null}
        {((targetType === 'ticket' && !selectedTicket) || (targetType === 'resale' && !selectedResale)) && !loadingTargets ? (
          <View style={styles.emptyTargetBox}>
            <Text style={styles.emptyTargetTitle}>신고 대상을 선택해주세요.</Text>
            <Text style={styles.emptyTargetText}>
              {targetType === 'ticket'
                ? '내 티켓 목록에서 문제가 있는 티켓을 선택하면 이벤트명, 좌석, 일시가 표시됩니다.'
                : '관련 리셀 거래를 선택하면 이벤트명, 좌석, 가격 정보를 확인할 수 있습니다.'}
            </Text>
          </View>
        ) : null}

        {isEditing ? <Text style={styles.helper}>신고 수정 시에는 분쟁 유형과 신고 내용만 변경할 수 있습니다.</Text> : null}
        {hasDirectTarget && !isEditing ? <Text style={styles.helper}>리셀 상세에서 선택한 신고 대상이 자동으로 설정되었습니다.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>분쟁 유형</Text>
        <View style={styles.typeGrid}>
          {DISPUTE_TYPES.map((item) => (
            <TouchableOpacity key={item.value} style={[styles.typeChip, type === item.value && styles.activeTypeChip]} onPress={() => setType(item.value)}>
              <Text style={[styles.typeChipText, type === item.value && styles.activeTypeChipText]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>신고 내용</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="상황을 구체적으로 입력해 주세요."
          multiline
        />
      </View>

      {feedback ? (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.submitButton, submitting && styles.disabled]} disabled={submitting} onPress={submit}>
        <Text style={styles.submitButtonText}>{submitText}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function TargetSummary({ title, seat, date, price }: { title: string; seat?: string; date?: string; price?: string }) {
  return (
    <View>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summaryMeta}>좌석: {seat || '-'}</Text>
      {price ? <Text style={styles.summaryMeta}>가격: {price}</Text> : null}
      <Text style={styles.summaryMeta}>일시: {formatDate(date)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginBottom: 12 },
  targetTypeRow: { flexDirection: 'row', gap: 8 },
  targetTypeButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeTargetTypeButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  lockedButton: { opacity: 0.7 },
  targetTypeText: { color: '#475569', fontWeight: '900', fontSize: 13, textAlign: 'center' },
  activeTargetTypeText: { color: '#2563EB' },
  loader: { marginTop: 16 },
  optionList: { marginTop: 14, gap: 10 },
  optionCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, backgroundColor: '#FFFFFF' },
  selectedOptionCard: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  selectedBox: { marginTop: 14, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, padding: 14, backgroundColor: '#EFF6FF' },
  selectedLabel: { color: '#2563EB', fontWeight: '900', fontSize: 12, marginBottom: 6 },
  emptyTargetBox: { marginTop: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, backgroundColor: '#F8FAFC' },
  emptyTargetTitle: { color: '#0F172A', fontWeight: '900', fontSize: 14 },
  emptyTargetText: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 18 },
  summaryTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginBottom: 6 },
  summaryMeta: { color: '#64748B', fontSize: 13, lineHeight: 20 },
  emptyText: { color: '#94A3B8', textAlign: 'center', fontWeight: '800', paddingVertical: 18 },
  helper: { marginTop: 10, color: '#64748B', fontSize: 12, lineHeight: 18 },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeTypeChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  typeChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeTypeChipText: { color: '#2563EB' },
  feedbackBox: { marginTop: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 12 },
  feedbackText: { color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  submitButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
