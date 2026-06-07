import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  OrganizerEmpty,
  OrganizerFilterBar,
  OrganizerHero,
  OrganizerSearch,
  OrganizerTopBar,
  organizerColors,
} from '../components/OrganizerTabKit';
import { FlowBadge, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showDialog } from '../lib/dialog';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatCompactDateTime, getNextRoundTime, salesSortRank, weiToEth } from '../lib/ticketDisplay';
import type { EventRound, EventSummary, TicketDetail } from '../types/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type SalesFilter = 'all' | 'available' | 'sold' | 'listed';

const FILTERS: { key: SalesFilter; label: string }[] = [
  { key: 'all',       label: '전체' },
  { key: 'available', label: '판매 중' },
  { key: 'sold',      label: '매진' },
  { key: 'listed',    label: '리셀 중' },
];

type RoundCard = {
  event: EventSummary;
  round: EventRound | null;
  roundIndex: number;       // 0-based → "N+1회차"
  roundLabel: string;       // display label on card
  tickets: TicketDetail[];  // tickets for this round
  allTickets: TicketDetail[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function evtTitle(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function evtDateText(event: EventSummary, round: EventRound | null) {
  if (round?.eventDate && round.startTime) {
    return formatCompactDateTime(`${round.eventDate}T${round.startTime}`);
  }
  const next = getNextRoundTime(event);
  const val = !Number.isNaN(next) ? new Date(next) : new Date(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || '');
  if (Number.isNaN(val.getTime())) return '일정 미정';
  return val.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function ticketStats(tickets: TicketDetail[]) {
  const total = tickets.length;
  const sold = tickets.filter((t) => ['SOLD', 'LISTED', 'USED'].includes(String(t.status).toUpperCase())).length;
  const available = tickets.filter((t) => String(t.status).toUpperCase() === 'AVAILABLE').length;
  const listed = tickets.filter((t) => String(t.status).toUpperCase() === 'LISTED').length;
  const used = tickets.filter((t) => String(t.status).toUpperCase() === 'USED').length;
  return { total, sold, available, listed, used };
}

function roundBadge(
  stats: ReturnType<typeof ticketStats>,
  event: EventSummary,
  round: EventRound | null,
): { label: string; tone: 'green' | 'gray' | 'red' | 'yellow' | 'purple' } {
  const now = Date.now();
  const parseMs = (s?: string | null) => (s ? new Date(s).getTime() : NaN);
  const eventStatus = String(event.status ?? '').toUpperCase();

  // 1. CANCELLED → 취소
  if (eventStatus === 'CANCELLED') return { label: '취소', tone: 'red' };
  // 2. DRAFT / INACTIVE → 판매 불가
  if (eventStatus === 'DRAFT' || eventStatus === 'INACTIVE') return { label: '판매 불가', tone: 'gray' };

  let roundStartMs: number;
  let roundEndMs: number;
  let saleStartMs: number;
  let saleEndMs: number;

  if (round?.eventDate) {
    roundStartMs = parseMs(round.startTime ? `${round.eventDate}T${round.startTime}` : round.eventDate);
    roundEndMs = parseMs(round.endTime ? `${round.eventDate}T${round.endTime}` : round.eventDate);
    saleStartMs = parseMs(round.saleStartAt || event.primarySaleStart || event.salesStartAt);
    saleEndMs = parseMs(round.saleEndAt || event.primarySaleEnd || event.salesEndAt);
  } else {
    roundStartMs = parseMs(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime);
    roundEndMs = parseMs(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime);
    saleStartMs = parseMs(event.primarySaleStart || event.salesStartAt);
    saleEndMs = parseMs(event.primarySaleEnd || event.salesEndAt);
  }

  // 3. 회차 종료 후 → 종료
  if (!Number.isNaN(roundEndMs) && now >= roundEndMs) return { label: '종료', tone: 'gray' };
  // 4. stats.total === 0 → 미발행
  if (stats.total === 0) return { label: '미발행', tone: 'gray' };
  // 5. stats.available === 0 AND stats.total > 0 → 매진
  if (stats.available === 0 && stats.total > 0) return { label: '매진', tone: 'red' };
  // 6. 판매 시작 전 → 판매 예정
  if (!Number.isNaN(saleStartMs) && now < saleStartMs) return { label: '판매 예정', tone: 'yellow' };
  // 7. 판매 종료 후 + 회차 시작 전 → 판매 종료
  if (!Number.isNaN(saleEndMs) && now >= saleEndMs && (Number.isNaN(roundStartMs) || now < roundStartMs)) {
    return { label: '판매 종료', tone: 'gray' };
  }
  // 8. 판매기간 내 AND stats.available > 0 → 판매 중
  const inSale = (Number.isNaN(saleStartMs) || now >= saleStartMs) && (Number.isNaN(saleEndMs) || now <= saleEndMs);
  if (inSale && stats.available > 0) return { label: '판매 중', tone: 'green' };
  // 9. 그 외 → 상태 확인 필요
  return { label: '상태 확인 필요', tone: 'purple' };
}

function buildRoundCards(event: EventSummary, allTickets: TicketDetail[]): RoundCard[] {
  const rounds = event.rounds ?? [];
  if (rounds.length === 0) {
    return [{ event, round: null, roundIndex: -1, roundLabel: evtTitle(event), tickets: allTickets, allTickets }];
  }
  return rounds.map((round, index) => {
    const roundId = round.id ? String(round.id) : null;
    const roundTickets = roundId
      ? allTickets.filter((t) => t.eventRoundId != null && String(t.eventRoundId) === roundId)
      : round.eventDate
        ? allTickets.filter((t) => t.eventDateTime?.slice(0, 10) === round.eventDate.slice(0, 10))
        : allTickets;
    return {
      event,
      round,
      roundIndex: index,
      roundLabel: `${evtTitle(event)} · ${index + 1}회차`,
      tickets: roundTickets,
      allTickets,
    };
  });
}

function matchesFilter(stats: ReturnType<typeof ticketStats>, filter: SalesFilter) {
  if (filter === 'all') return true;
  if (filter === 'available') return stats.available > 0;
  if (filter === 'sold') return stats.total > 0 && stats.available === 0;
  if (filter === 'listed') return stats.listed > 0;
  return true;
}

function sectionOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split(/[-\s]/)[0] || 'GENERAL';
}

type ZoneData = { total: number; sold: number; available: number; listed: number; minPriceWei?: string; resaleEnabled?: boolean };

function zoneStats(tickets: TicketDetail[]): [string, ZoneData][] {
  const map = new Map<string, ZoneData>();
  tickets.forEach((t) => {
    const key = sectionOf(t);
    const cur = map.get(key) ?? { total: 0, sold: 0, available: 0, listed: 0 };
    cur.total += 1;
    const status = String(t.status).toUpperCase();
    if (['SOLD', 'LISTED', 'USED'].includes(status)) cur.sold += 1;
    if (status === 'AVAILABLE') cur.available += 1;
    if (status === 'LISTED') cur.listed += 1;
    const price = t.originalPriceWei || t.priceWei;
    if (price) {
      if (!cur.minPriceWei) { cur.minPriceWei = price; }
      else { try { if (BigInt(price) < BigInt(cur.minPriceWei)) cur.minPriceWei = price; } catch { /* skip */ } }
    }
    if (t.resaleEnabled) cur.resaleEnabled = true;
    map.set(key, cur);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko-KR', { numeric: true }));
}

function minPriceWei(tickets: TicketDetail[]): string | null {
  const prices = tickets.map((t) => t.originalPriceWei || t.priceWei).filter(Boolean) as string[];
  if (!prices.length) return null;
  try {
    return prices.reduce((min, p) => BigInt(p) < BigInt(min) ? p : min, prices[0]);
  } catch { return prices[0]; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatGrid2({ issued, sold }: { issued: number; sold: number }) {
  return (
    <View style={styles.stat2Grid}>
      <View style={styles.stat2Cell}>
        <View style={styles.statIco}><TicketIcon name="ticket" color={organizerColors.purple} size={18} /></View>
        <Text style={styles.stat2Num}>{issued.toLocaleString()}</Text>
        <Text style={styles.stat2Label}>총 발급 티켓</Text>
      </View>
      <View style={[styles.stat2Cell, styles.stat2CellBorder]}>
        <View style={styles.statIco}><TicketIcon name="cart" color={organizerColors.purple} size={18} /></View>
        <Text style={[styles.stat2Num, { color: organizerColors.purple }]}>{sold.toLocaleString()}</Text>
        <Text style={styles.stat2Label}>판매 완료</Text>
      </View>
    </View>
  );
}

function StatGrid4({ sold, available, listed, used }: { sold: number; available: number; listed: number; used: number }) {
  return (
    <View style={styles.stat4Grid}>
      {[
        { label: '판매', value: sold, color: organizerColors.purple },
        { label: '잔여', value: available, color: '#185FA5' },
        { label: '리셀', value: listed, color: '#854F0B' },
        { label: '입장', value: used, color: organizerColors.green },
      ].map((item) => (
        <View key={item.label} style={styles.stat4Cell}>
          <Text style={[styles.stat4Num, { color: item.color }]}>{item.value}</Text>
          <Text style={styles.stat4Label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ProgressBar({ label, pct, value, muted }: { label: string; pct: number; value: string; muted?: boolean }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(100, pct)}%` as any, backgroundColor: muted ? '#CBD5E1' : organizerColors.purple }]} />
      </View>
      <Text style={[styles.barVal, muted && styles.barValMuted]}>{value}</Text>
    </View>
  );
}

function RoundCardItem({ card, onPress }: { card: RoundCard; onPress: () => void }) {
  const stats = useMemo(() => ticketStats(card.tickets), [card.tickets]);
  const badge = roundBadge(stats, card.event, card.round);
  const soldPct = stats.total > 0 ? (stats.sold / stats.total) * 100 : 0;
  const availPct = stats.total > 0 ? (stats.available / stats.total) * 100 : 0;
  const listedPct = stats.total > 0 ? (stats.listed / stats.total) * 100 : 0;
  const price = minPriceWei(card.allTickets);
  const sectionCount = new Set(card.allTickets.map(sectionOf)).size;

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventTop}>
        <View style={styles.eventCopy}>
          <Text style={styles.eventName} numberOfLines={2}>{card.roundLabel}</Text>
          <Text style={styles.eventMeta}>{card.event.venue || '장소 미정'} · {evtDateText(card.event, card.round)}</Text>
        </View>
        <FlowBadge label={badge.label} tone={badge.tone} />
      </View>

      <View style={styles.progressWrap}>
        <ProgressBar label="판매" pct={soldPct} value={`${stats.sold}/${stats.total}`} />
        <ProgressBar label="잔여" pct={availPct} value={String(stats.available)} muted />
        <ProgressBar label="리셀" pct={listedPct} value={String(stats.listed)} muted={stats.listed === 0} />
      </View>

      <View style={styles.eventFoot}>
        <Text style={styles.eventFootMeta}>
          {price ? `${weiToEth(price)}부터` : '-'}{sectionCount > 0 ? ` · 좌석 ${sectionCount}개 구역` : ''}
        </Text>
        <TouchableOpacity style={styles.detailBtn} onPress={onPress} activeOpacity={0.86}>
          <Text style={styles.detailBtnText}>상세 보기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ZoneCard({ name, total, sold, available, listed, minPriceWei: price, resaleEnabled, event }: { name: string; total: number; sold: number; available: number; listed: number; minPriceWei?: string; resaleEnabled?: boolean; event: EventSummary }) {
  const badge = roundBadge({ total, sold, available, listed, used: 0 }, event, null);
  const sub = [price ? weiToEth(price) : null, resaleEnabled !== undefined ? (resaleEnabled ? '리셀 허용' : '리셀 불가') : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.zoneCard}>
      <View style={styles.zoneTop}>
        <View>
          <Text style={styles.zoneName}>{name}</Text>
          {sub ? <Text style={styles.zoneSub}>{sub}</Text> : null}
        </View>
        <FlowBadge label={badge.label} tone={badge.tone} />
      </View>
      <View style={styles.zoneKpis}>
        {[
          { k: '판매', v: sold },
          { k: '이용', v: total },
          { k: '잔여', v: available },
          { k: '리셀', v: listed },
        ].map((item) => (
          <View key={item.k} style={styles.kpi}>
            <Text style={styles.kpiKey}>{item.k}</Text>
            <Text style={styles.kpiVal}>{item.v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SummaryPanel({ sold, total, available, listed, revenueWei }: { sold: number; total: number; available: number; listed: number; revenueWei?: string | null }) {
  const rows = [
    { label: '판매 수량', value: `${sold} / ${total}` },
    { label: '잔여 수량', value: String(available) },
    { label: '리셀 등록', value: String(listed) },
    { label: '예상 매출', value: revenueWei ? weiToEth(revenueWei) : `${sold > 0 ? sold : 0}건` },
  ];
  return (
    <View style={styles.summaryCard}>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.summaryRow, i === rows.length - 1 && styles.summaryRowLast]}>
          <Text style={styles.summaryLabel}>{row.label}</Text>
          <Text style={[styles.summaryVal, row.label === '예상 매출' && styles.summaryValPrimary]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailTopBar({ onBack, badgeLabel, badgeTone }: { onBack: () => void; badgeLabel: string; badgeTone: 'green' | 'gray' | 'red' | 'yellow' | 'purple' }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.detailTopBar, { paddingTop: Math.max(insets.top, 14) }]}>
      <TouchableOpacity style={styles.detailBack} onPress={onBack} activeOpacity={0.84}>
        <TicketIcon name="arrowLeft" color={organizerColors.ink} size={20} />
      </TouchableOpacity>
      <View style={styles.detailTopCopy}>
        <Text style={styles.detailTopEyebrow}>Sales Dashboard</Text>
        <Text style={styles.detailTopTitle}>회차 판매 상세</Text>
      </View>
      <FlowBadge label={badgeLabel} tone={badgeTone} />
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SalesItem = { event: EventSummary; tickets: TicketDetail[] };

export default function SalesStatusPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string | undefined;
  const [items, setItems] = useState<SalesItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SalesFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (eventId) {
        // detail mode — load single event tickets
        const [detail, list] = await Promise.all([
          backendApi.getEvent(eventId),
          backendApi.getEventTickets(eventId).catch(() => [] as TicketDetail[]),
        ]);
        setItems([{ event: detail, tickets: list }]);
      } else {
        const page = await backendApi.getMyEvents({ page: 0, size: 100 });
        const myEvents = (page.items ?? [])
          .filter((e) => String(e.status).toUpperCase() !== 'CANCELLED')
          .sort((a, b) => {
            const rankDiff = salesSortRank(a) - salesSortRank(b);
            if (rankDiff !== 0) return rankDiff;
            return (getNextRoundTime(a) || 0) - (getNextRoundTime(b) || 0);
          });
        const withTickets = await Promise.all(
          myEvents.map(async (e) => ({ event: e, tickets: await backendApi.getEventTickets(e.id).catch(() => [] as TicketDetail[]) })),
        );
        setItems(withTickets);
      }
    } catch (cause: any) {
      showDialog('로드 실패', errorMessage(cause, '판매 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // ─── All memo hooks must be declared before any conditional return ───────────
  const allRoundCards = useMemo(() => {
    if (eventId) return [];
    return items.flatMap((item) => buildRoundCards(item.event, item.tickets));
  }, [eventId, items]);

  const totals = useMemo(() => {
    const eventMap = new Map<string, TicketDetail[]>();
    allRoundCards.forEach((c) => { if (!eventMap.has(c.event.id)) eventMap.set(c.event.id, c.allTickets); });
    const all = [...eventMap.values()].flat();
    return {
      issued: all.length,
      sold: all.filter((t) => ['SOLD', 'LISTED', 'USED'].includes(String(t.status).toUpperCase())).length,
    };
  }, [allRoundCards]);

  const visibleCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRoundCards.filter((card) => {
      const stats = ticketStats(card.tickets);
      if (!matchesFilter(stats, filter)) return false;
      if (!q) return true;
      return `${card.roundLabel} ${card.event.venue || ''}`.toLowerCase().includes(q);
    });
  }, [allRoundCards, filter, query]);

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={organizerColors.purple} /></View>;

  // ─── Detail mode ─────────────────────────────────────────────────────────────
  if (eventId && items.length > 0) {
    const { event, tickets } = items[0];
    const stats = ticketStats(tickets);
    // Zones always computed from all tickets; filter controls which zones are SHOWN
    const allZones = zoneStats(tickets);
    const visibleZones = allZones.filter(([, z]) => {
      if (filter === 'all') return true;
      if (filter === 'available') return z.available > 0;
      if (filter === 'sold') return z.available === 0 && z.total > 0;
      if (filter === 'listed') return z.listed > 0;
      return true;
    });
    const badge = roundBadge(stats, event, null);
    let revenueWei: bigint = 0n;
    tickets.forEach((t) => {
      if (['SOLD', 'LISTED', 'USED'].includes(String(t.status).toUpperCase())) {
        try { revenueWei += BigInt(t.originalPriceWei || t.priceWei || '0'); } catch { /* skip */ }
      }
    });

    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <DetailTopBar
          onBack={() => navigation.goBack()}
          badgeLabel={badge.label}
          badgeTone={badge.tone}
        />
        <OrganizerHero
          badge="1회차"
          title={`${evtTitle(event)}\n판매 현황`}
          meta={`${weiToEth(event.ticketPriceWei) !== '-' ? `${weiToEth(event.ticketPriceWei)}부터 · ` : ''}판매 ${stats.sold}장 · 잔여 ${stats.available}장`}
        />
        <StatGrid4 sold={stats.sold} available={stats.available} listed={stats.listed} used={stats.used} />
        <OrganizerFilterBar items={FILTERS} value={filter} onChange={(v) => setFilter(v)} />

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>구역별 판매 현황</Text>
            <Text style={styles.sectionSub}>좌석 구역 기준 판매/잔여/리셀</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('TicketExplore', { eventId })}>
            <Text style={styles.sectionLink}>전체 티켓</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.zoneList}>
          {visibleZones.length === 0
            ? <Text style={styles.emptyText}>조건에 맞는 구역이 없습니다.</Text>
            : visibleZones.map(([name, z]) => (
              <ZoneCard key={name} name={name} total={z.total} sold={z.sold} available={z.available} listed={z.listed} minPriceWei={z.minPriceWei} resaleEnabled={z.resaleEnabled} event={event} />
            ))
          }
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>판매 요약</Text>
            <Text style={styles.sectionSub}>회차 기준 누계</Text>
          </View>
        </View>
        <View style={styles.summaryWrap}>
          <SummaryPanel
            sold={stats.sold}
            total={stats.total}
            available={stats.available}
            listed={stats.listed}
            revenueWei={revenueWei > 0n ? revenueWei.toString() : null}
          />
        </View>
      </ScrollView>
    );
  }

  // ─── Overview mode ────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <OrganizerTopBar
        eyebrow="Ticket Operations"
        title="티켓 판매 현황"
        leftIcon="arrowLeft"
        leftLabel="뒤로"
        onLeftPress={() => navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('Organizer')}
        rightIcon="adjustments"
        rightLabel="필터 초기화"
        onRightPress={() => { setFilter('all'); setQuery(''); }}
      />
      <OrganizerHero
        badge="판매 운영"
        title={'회차별 판매율과\n이상 좌석을 확인하세요.'}
        meta="이벤트별 발급, 판매, 잔여, 리셀 수량을 한 화면에서 관리합니다."
      />

      <View style={styles.stat2Wrap}>
        <StatGrid2 issued={totals.issued} sold={totals.sold} />
      </View>

      <OrganizerSearch value={query} onChangeText={setQuery} placeholder="이벤트명, 회차 검색" />
      <OrganizerFilterBar items={FILTERS} value={filter} onChange={(v) => setFilter(v)} />

      {visibleCards.length === 0 ? (
        <OrganizerEmpty title="조건에 맞는 판매 이벤트가 없습니다." actionLabel="내 이벤트 보기" onAction={() => navigation.navigate('MyEvents')} />
      ) : visibleCards.map((card, index) => (
        <RoundCardItem
          key={`${card.event.id}-${card.roundIndex}-${index}`}
          card={card}
          onPress={() => navigation.push('SalesStatus', { eventId: card.event.id })}
        />
      ))}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: organizerColors.background },
  content: { paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: organizerColors.background },

  stat2Wrap: { paddingHorizontal: 16, paddingBottom: 12 },
  stat2Grid: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: organizerColors.border, flexDirection: 'row', ...flowShadow },
  stat2Cell: { flex: 1, paddingVertical: 16, paddingHorizontal: 18 },
  stat2CellBorder: { borderLeftWidth: 1, borderLeftColor: organizerColors.border },
  stat2Num: { fontSize: 24, fontWeight: '900', color: organizerColors.ink, letterSpacing: -0.6 },
  stat2Label: { fontSize: 11, color: organizerColors.muted, fontWeight: '800', marginTop: 3 },

  stat4Grid: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  stat4Cell: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 17, borderWidth: 1, borderColor: organizerColors.border, paddingVertical: 12, alignItems: 'center', ...flowShadow },
  stat4Num: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  stat4Label: { fontSize: 9, color: organizerColors.muted, fontWeight: '800', marginTop: 3 },

  eventCard: { marginHorizontal: 16, marginBottom: 12, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: organizerColors.border, ...flowShadow },
  eventTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 13 },
  eventCopy: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 15, fontWeight: '900', color: organizerColors.ink, lineHeight: 20, letterSpacing: -0.3 },
  eventMeta: { fontSize: 11, color: organizerColors.muted, fontWeight: '700', marginTop: 4 },

  progressWrap: { gap: 7, marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 26, fontSize: 10, color: organizerColors.muted, fontWeight: '900' },
  barBg: { flex: 1, height: 7, backgroundColor: '#EEF2F7', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barVal: { width: 38, textAlign: 'right', fontSize: 10, fontWeight: '900', color: organizerColors.ink },
  barValMuted: { color: organizerColors.muted },

  eventFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 10 },
  eventFootMeta: { flex: 1, fontSize: 11, color: organizerColors.muted, fontWeight: '700' },
  detailBtn: { height: 34, borderRadius: 13, backgroundColor: '#EEEDFE', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  detailBtnText: { fontSize: 12, fontWeight: '900', color: organizerColors.purple },

  statIco: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },

  detailTopBar: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: organizerColors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  detailBack: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: organizerColors.border, alignItems: 'center', justifyContent: 'center', ...flowShadow },
  detailTopCopy: { flex: 1 },
  detailTopEyebrow: { fontSize: 10, fontWeight: '900', color: organizerColors.purple, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  detailTopTitle: { fontSize: 18, fontWeight: '900', color: organizerColors.ink, letterSpacing: -0.4 },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: organizerColors.ink, letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 3 },
  sectionLink: { fontSize: 12, fontWeight: '900', color: organizerColors.purple, paddingBottom: 2 },
  emptyText: { textAlign: 'center', color: organizerColors.muted, paddingVertical: 28, fontWeight: '800' },

  zoneList: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  zoneCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: organizerColors.border, padding: 16, ...flowShadow },
  zoneTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  zoneName: { fontSize: 16, fontWeight: '900', color: organizerColors.ink, letterSpacing: -0.3 },
  zoneSub: { fontSize: 10, color: organizerColors.muted, fontWeight: '800', marginTop: 3 },
  zoneKpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#EDF2F7', paddingVertical: 10, alignItems: 'center' },
  kpiKey: { fontSize: 9, fontWeight: '900', color: organizerColors.muted, marginBottom: 4 },
  kpiVal: { fontSize: 13, fontWeight: '900', color: organizerColors.ink },

  summaryWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: organizerColors.border, overflow: 'hidden', ...flowShadow },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { fontSize: 12, color: '#64748B', fontWeight: '800' },
  summaryVal: { fontSize: 13, fontWeight: '900', color: organizerColors.ink },
  summaryValPrimary: { color: organizerColors.purple },
});
