import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlowBadge, FlowHero, IconButton, PosterArt, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { showDialog } from '../lib/dialog';
import { backendApi } from '../lib/backend';
import { formatDateTime, weiToEthLabel } from '../lib/ticketFlowDisplay';
import type { DisputeRecord, ResaleListing, TicketDetail } from '../types/api';

const STATUS_LABEL: Record<string, string> = {
  OPEN: '접수됨',
  RECEIVED: '접수됨',
  REVIEWING: '처리 중',
  PROCESSING: '처리 중',
  RESOLVED: '해결 완료',
  REJECTED: '반려',
  CLOSED: '종료',
  CANCELED: '취소됨',
};

const TYPE_LABEL: Record<string, string> = {
  TICKET_NOT_DELIVERED: '티켓 미전달',
  PAYMENT_ISSUE: '결제 문제',
  FRAUD_SUSPECTED: '사기 의심',
  OTHER: '기타',
};

const EDITABLE_STATUSES = new Set(['OPEN', 'RECEIVED']);
const PROCESSING_STATUSES = new Set(['REVIEWING', 'PROCESSING']);
const DONE_STATUSES = new Set(['RESOLVED', 'REJECTED', 'CLOSED', 'CANCELED']);

const DISPUTE_STATUS_RANK: Record<string, number> = {
  OPEN: 0, RECEIVED: 0,
  REVIEWING: 1, PROCESSING: 1,
  RESOLVED: 2, REJECTED: 2, CLOSED: 2, CANCELED: 2,
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'DONE';

type DisputeTargetSummary = {
  title: string;
  venue?: string;
  eventDate?: string;
  seat?: string;
  price?: string;
  transactionDate?: string;
  kind: string;
};

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'ACTIVE', label: '처리중' },
  { id: 'DONE', label: '완료' },
];

function disputeKey(item: DisputeRecord, index: number) {
  return String(item.id ?? `dispute-${index}`);
}

function getStatusBadge(status?: string) {
  const key = status?.toUpperCase() ?? 'OPEN';
  if (EDITABLE_STATUSES.has(key)) return { label: '수정/취소 가능', tone: 'purple' as const };
  if (PROCESSING_STATUSES.has(key)) return { label: '처리 중', tone: 'yellow' as const };
  if (DONE_STATUSES.has(key)) return { label: STATUS_LABEL[key] ?? '완료', tone: 'gray' as const };
  return { label: STATUS_LABEL[key] ?? key, tone: 'purple' as const };
}

function statusTone(status?: string): 'green' | 'purple' | 'gray' | 'red' | 'yellow' {
  const key = String(status ?? 'OPEN').toUpperCase();
  if (EDITABLE_STATUSES.has(key)) return 'purple';
  if (PROCESSING_STATUSES.has(key)) return 'yellow';
  if (key === 'CANCELED' || key === 'REJECTED') return 'red';
  if (DONE_STATUSES.has(key)) return 'gray';
  return 'purple';
}

function FilterRow({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {FILTERS.map((item) => {
        const active = value === item.id;
        return (
          <TouchableOpacity key={item.id} style={[styles.filter, active && styles.filterActive]} onPress={() => onChange(item.id)} activeOpacity={0.86}>
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function MyDisputesPage({ navigation }: any) {
  const [items, setItems] = useState<DisputeRecord[]>([]);
  const [targetSummaries, setTargetSummaries] = useState<Record<string, DisputeTargetSummary>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cancelingId, setCancelingId] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await backendApi.getMyDisputes({ size: 50 });
      const disputeItems = data.items ?? [];
      setItems(disputeItems);

      const entries = await Promise.all(
        disputeItems.map(async (item, index) => {
          const key = disputeKey(item, index);
          const summary = await loadTargetSummary(item);
          return [key, summary] as const;
        }),
      );
      setTargetSummaries(Object.fromEntries(entries));
    } catch (cause: any) {
      setError(errorMessage(cause, '분쟁 내역을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filteredItems = useMemo(() => {
    let result = items.filter((item) => item.status?.toUpperCase() !== 'CANCELED');
    if (statusFilter === 'ACTIVE') {
      result = result.filter((item) => {
        const status = item.status?.toUpperCase() ?? 'OPEN';
        return EDITABLE_STATUSES.has(status) || PROCESSING_STATUSES.has(status);
      });
    } else if (statusFilter === 'DONE') {
      result = result.filter((item) => DONE_STATUSES.has(item.status?.toUpperCase() ?? ''));
    }
    return result.sort((a, b) => {
      const rankA = DISPUTE_STATUS_RANK[a.status?.toUpperCase() ?? 'OPEN'] ?? 3;
      const rankB = DISPUTE_STATUS_RANK[b.status?.toUpperCase() ?? 'OPEN'] ?? 3;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }, [items, statusFilter]);

  const activeCount = useMemo(
    () => items.filter((item) => {
      const status = item.status?.toUpperCase() ?? 'OPEN';
      return EDITABLE_STATUSES.has(status) || PROCESSING_STATUSES.has(status);
    }).length,
    [items],
  );
  const doneCount = useMemo(() => items.filter((item) => {
    const s = item.status?.toUpperCase() ?? '';
    return DONE_STATUSES.has(s) && s !== 'CANCELED';
  }).length, [items]);

  const cancelDispute = (item: DisputeRecord) => {
    const disputeId = String(item.id ?? '');
    if (!disputeId) return;
    showDialog('분쟁 신고 취소', '접수한 분쟁 신고를 취소할까요?', [
      { text: '아니요', style: 'cancel' },
      {
        text: '취소하기',
        style: 'destructive',
        onPress: async () => {
          setCancelingId(disputeId);
          try {
            await backendApi.cancelDispute(disputeId);
            showDialog('취소 완료', '분쟁 신고가 취소되었습니다.');
            await load();
          } catch (cause: any) {
            showDialog('취소 실패', errorMessage(cause, '처리 중이거나 완료된 분쟁 신고는 취소할 수 없습니다.'));
          } finally {
            setCancelingId('');
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MyPage'))} activeOpacity={0.84}>
          <IconButton><TicketIcon name="arrowLeft" size={20} /></IconButton>
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.eyebrow}>Disputes</Text>
          <Text style={styles.topTitle}>내 분쟁 신고</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('DisputeCreate')} activeOpacity={0.84}>
          <IconButton><TicketIcon name="plus" size={20} /></IconButton>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <FlowHero
          height={176}
          style={styles.hero}
          badge="처리 상태 확인"
          title={'접수한 신고를\n한 곳에서 관리하세요.'}
          meta={`진행중 ${activeCount}건 · 처리완료 ${doneCount}건 · 접수 단계 신고는 수정할 수 있습니다.`}
        />

        <FilterRow value={statusFilter} onChange={setStatusFilter} />

        {error ? (
          <View style={styles.section}>
            <View style={styles.errorBox}>
              <TicketIcon name="alert" size={19} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.disputeList}>
          {filteredItems.map((item, index) => {
            const key = disputeKey(item, index);
            const statusKey = item.status?.toUpperCase() ?? 'OPEN';
            const editable = EDITABLE_STATUSES.has(statusKey);
            const badge = getStatusBadge(statusKey);
            const disabled = cancelingId === String(item.id ?? '');
            const summary = targetSummaries[key];

            return (
              <View key={key} style={styles.disputeCard}>
                <View style={styles.disputeCardTop}>
                  <FlowBadge label={STATUS_LABEL[statusKey] ?? item.status ?? '접수됨'} tone={statusTone(statusKey)} />
                  <FlowBadge label={badge.label} tone={badge.tone} />
                </View>

                <View style={styles.targetBox}>
                  <PosterArt title={summary?.title ?? '분쟁 대상'} variant={index + 1} style={styles.targetPoster} />
                  <View style={styles.targetCopy}>
                    <FlowBadge label={summary?.kind ?? (item.resaleListingId ? '리셀 거래' : '내 티켓')} />
                    <Text style={styles.targetName} numberOfLines={2}>{summary?.title ?? '분쟁 대상 정보를 불러오는 중입니다.'}</Text>
                    <Text style={styles.meta} numberOfLines={2}>{summary?.venue || '-'}</Text>
                    <Text style={styles.meta}>{summary?.seat || '-'}</Text>
                    <Text style={styles.meta}>신고 유형: {TYPE_LABEL[item.type ?? 'OTHER'] ?? item.type ?? '분쟁'}</Text>
                  </View>
                </View>

                <Text style={styles.description} numberOfLines={3}>신고 내용: {item.description || '-'}</Text>
                {summary?.price ? <Text style={styles.meta}>거래 가격: {weiToEthLabel(summary.price)}</Text> : null}
                {summary?.transactionDate ? <Text style={styles.meta}>거래 일시: {formatDateTime(summary.transactionDate)}</Text> : null}
                {item.resolutionNote ? <Text style={styles.note}>처리 메모: {item.resolutionNote}</Text> : null}

                {editable ? (
                  <View style={styles.disputeActions}>
                    <TouchableOpacity style={[styles.btn, styles.outline]} onPress={() => navigation.navigate('DisputeCreate', { dispute: item })} activeOpacity={0.86}>
                      <Text style={styles.outlineText}>신고 내용 수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.danger, disabled && styles.disabled]} disabled={disabled} onPress={() => cancelDispute(item)} activeOpacity={0.86}>
                      <Text style={styles.dangerText}>{disabled ? '취소 중...' : '신고 취소'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
          {!filteredItems.length ? <Text style={styles.empty}>접수한 분쟁 신고가 없습니다.</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

async function loadTargetSummary(item: DisputeRecord): Promise<DisputeTargetSummary> {
  const embedded = item as DisputeRecord & {
    eventName?: string;
    eventTitle?: string;
    venue?: string;
    seatInfo?: string;
    priceWei?: string;
    price?: string;
    eventAt?: string;
    eventDateTime?: string;
  };

  if (embedded.eventName || embedded.eventTitle || embedded.seatInfo || embedded.priceWei || embedded.price) {
    return {
      title: embedded.eventName || embedded.eventTitle || '분쟁 대상',
      venue: embedded.venue,
      eventDate: embedded.eventAt || embedded.eventDateTime,
      seat: embedded.seatInfo,
      price: embedded.priceWei || embedded.price,
      transactionDate: item.resaleListingId ? item.createdAt : undefined,
      kind: item.resaleListingId ? '리셀 거래' : '내 티켓',
    };
  }

  if (item.resaleListingId) {
    const listing = await backendApi.getResaleListing(String(item.resaleListingId)).catch(() => undefined as ResaleListing | undefined);
    if (listing) {
      const [ticket, event] = await Promise.all([
        backendApi.getTicket(String(listing.ticketId)).catch(() => undefined as TicketDetail | undefined),
        backendApi.getEvent(String(listing.eventId)).catch(() => undefined),
      ]);
      return {
        title: event?.name || event?.title || listing.eventName || ticket?.eventTitle || '리셀 거래 신고',
        venue: event?.venue || ticket?.venue,
        eventDate: event?.eventAt || event?.eventDateTime || ticket?.eventDateTime,
        seat: ticket?.seatInfo || listing.seatInfo,
        price: listing.priceWei || listing.price,
        transactionDate: listing.purchasedAt || listing.createdAt || item.createdAt,
        kind: '리셀 거래',
      };
    }
  }

  if (item.ticketId) {
    const ticket = await backendApi.getTicket(String(item.ticketId)).catch(() => undefined as TicketDetail | undefined);
    if (ticket) {
      const event = ticket.eventId ? await backendApi.getEvent(String(ticket.eventId)).catch(() => undefined) : undefined;
      return {
        title: event?.name || event?.title || ticket.eventTitle || ticket.eventName || '티켓 신고',
        venue: event?.venue || ticket.venue,
        eventDate: event?.eventAt || event?.eventDateTime || ticket.eventDateTime,
        seat: ticket.seatInfo,
        price: ticket.priceWei || ticket.originalPriceWei,
        kind: '내 티켓',
      };
    }
  }

  return {
    title: item.resaleListingId ? '리셀 거래 신고' : '티켓 신고',
    eventDate: item.createdAt,
    kind: item.resaleListingId ? '리셀 거래' : '내 티켓',
  };
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
  hero: { marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  filters: { gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  filter: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 19, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  errorText: { flex: 1, color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  disputeList: { gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  disputeCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 14, ...flowShadow },
  disputeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 },
  targetBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#DBE3EF', borderRadius: 18, padding: 13, marginBottom: 12, flexDirection: 'row', gap: 10 },
  targetPoster: { width: 58, height: 78, borderRadius: 15 },
  targetCopy: { flex: 1, minWidth: 0, gap: 4 },
  targetName: { fontSize: 16, fontWeight: '900', color: '#0F172A', lineHeight: 20, letterSpacing: 0, marginTop: 4 },
  meta: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  description: { color: '#334155', lineHeight: 20, fontSize: 12, fontWeight: '800' },
  note: { marginTop: 8, color: '#0F6E56', fontWeight: '800', lineHeight: 20 },
  disputeActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, minHeight: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  outline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CECBF6' },
  outlineText: { color: '#534AB7', fontSize: 13, fontWeight: '900' },
  danger: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3' },
  dangerText: { color: '#DC2626', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  empty: { textAlign: 'center', color: '#94A3B8', paddingVertical: 40, fontWeight: '800' },
});
