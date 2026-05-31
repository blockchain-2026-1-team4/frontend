import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { getNextRoundTime, salesSortRank, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventSummary, TicketDetail } from '../types/api';

type IconName = 'ticket' | 'cart' | 'search' | 'alert';
type SalesItem = { event: EventSummary; tickets: TicketDetail[] };
type SalesFilter = 'all' | 'available' | 'sold' | 'listed' | 'used' | 'cancelled';

const FILTERS: { key: SalesFilter; label: string; tone?: 'teal' | 'amber' | 'blue' | 'red' }[] = [
  { key: 'all', label: '전체' },
  { key: 'available', label: '미판매', tone: 'amber' },
  { key: 'sold', label: '판매됨', tone: 'teal' },
  { key: 'listed', label: '리셀 등록', tone: 'amber' },
  { key: 'used', label: '입장 완료', tone: 'blue' },
  { key: 'cancelled', label: '취소', tone: 'red' },
];

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function eventTitle(event: EventSummary | EventDetail) {
  return event.name || event.title || '이벤트';
}

function eventDateText(event: EventSummary | EventDetail) {
  const next = getNextRoundTime(event);
  const value = !Number.isNaN(next) ? new Date(next) : new Date(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || '');
  if (Number.isNaN(value.getTime())) return '일정 미정';
  return value.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function isEnded(event: EventSummary) {
  const end = new Date(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || '').getTime();
  return !Number.isNaN(end) && end < Date.now();
}

function ticketStats(event: EventSummary, tickets: TicketDetail[]) {
  const total = Number(event.totalTicketCount ?? 0) || tickets.length;
  const sold = Number(event.soldTicketCount ?? 0) || tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
  const available = Number(event.remainingTicketCount ?? 0) || tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'AVAILABLE').length;
  const listed = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'LISTED').length;
  const used = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
  const cancelled = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'CANCELLED').length;
  return { total, sold, available, listed, used, cancelled };
}

function matchesTicketFilter(ticket: TicketDetail, filter: SalesFilter) {
  const status = String(ticket.status).toUpperCase();
  if (filter === 'all') return true;
  if (filter === 'available') return status === 'AVAILABLE';
  if (filter === 'sold') return ['SOLD', 'LISTED', 'USED'].includes(status);
  if (filter === 'listed') return status === 'LISTED';
  if (filter === 'used') return status === 'USED';
  if (filter === 'cancelled') return status === 'CANCELLED';
  return true;
}

function matchesEventFilter(stat: ReturnType<typeof ticketStats>, filter: SalesFilter) {
  if (filter === 'all') return true;
  if (filter === 'available') return stat.available > 0;
  if (filter === 'sold') return stat.sold > 0;
  if (filter === 'listed') return stat.listed > 0;
  if (filter === 'used') return stat.used > 0;
  if (filter === 'cancelled') return stat.cancelled > 0;
  return true;
}

function sectionOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split(/[-\s]/)[0] || 'GENERAL';
}

function sectionStats(tickets: TicketDetail[]) {
  const map = new Map<string, { total: number; sold: number }>();
  tickets.forEach((ticket) => {
    const key = sectionOf(ticket);
    const current = map.get(key) ?? { total: 0, sold: 0 };
    current.total += 1;
    if (['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())) current.sold += 1;
    map.set(key, current);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko-KR', { numeric: true }));
}

function AppIcon({ name, color = '#534AB7', size = 18 }: { name: IconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'ticket' ? <Path {...common} d="M4 9a3 3 0 0 0 0 6v3h16v-3a3 3 0 0 0 0-6V6H4v3Zm8-2v10" /> : null}
      {name === 'cart' ? (
        <>
          <Circle {...common} cx={9} cy={20} r={1} />
          <Circle {...common} cx={17} cy={20} r={1} />
          <Path {...common} d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 2-1.6L21 8H7" />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <Circle {...common} cx={11} cy={11} r={8} />
          <Path {...common} d="m21 21-4.35-4.35" />
        </>
      ) : null}
      {name === 'alert' ? (
        <>
          <Path {...common} d="M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          <Path {...common} d="M12 9v4m0 4h.01" />
        </>
      ) : null}
    </Svg>
  );
}

export default function SalesStatusPage({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const eventId = route?.params?.eventId as string | undefined;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [items, setItems] = useState<SalesItem[]>([]);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SalesFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (eventId) {
        const [detail, list] = await Promise.all([backendApi.getEvent(eventId), backendApi.getEventTickets(eventId).catch(() => [])]);
        setEvent(detail);
        setTickets(list);
        setItems([]);
        return;
      }

      const page = await backendApi.getMyEvents({ page: 0, size: 100 });
      const myEvents = (page.items ?? [])
        .filter((item) => String(item.status).toUpperCase() !== 'CANCELLED')
        .sort((a, b) => {
          const rankDiff = salesSortRank(a) - salesSortRank(b);
          if (rankDiff !== 0) return rankDiff;
          const aTime = getNextRoundTime(a);
          const bTime = getNextRoundTime(b);
          return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
        });
      const withTickets = await Promise.all(myEvents.map(async (item) => ({ event: item, tickets: await backendApi.getEventTickets(item.id).catch(() => []) })));
      setItems(withTickets);
      setEvent(null);
      setTickets([]);
    } catch (error: any) {
      Alert.alert('티켓 판매 현황 로드 실패', errorMessage(error, '티켓 판매 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const stat = ticketStats(item.event, item.tickets);
        acc.issued += stat.total;
        acc.sold += stat.sold;
        return acc;
      },
      { issued: 0, sold: 0 },
    );
  }, [items]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const stat = ticketStats(item.event, item.tickets);
      if (!matchesEventFilter(stat, filter)) return false;
      if (!normalized) return true;
      return `${eventTitle(item.event)} ${item.event.venue || ''}`.toLowerCase().includes(normalized);
    });
  }, [items, query, filter]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  if (eventId && event) {
    const sold = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
    const used = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
    const available = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'AVAILABLE').length;
    const listed = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'LISTED').length;
    const filteredTickets = tickets.filter((ticket) => matchesTicketFilter(ticket, filter));
    const stats = sectionStats(filteredTickets);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
        <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 18, 40) }]}>
          <Text style={styles.eyebrow}>Sales Dashboard</Text>
          <Text style={styles.heroTitle}>티켓 판매 현황</Text>
          <Text style={styles.heroSub} numberOfLines={1}>{eventTitle(event)} · {weiToEth(event.ticketPriceWei)}</Text>
          <View style={styles.heroChip}><View style={styles.heroDotAmber} /><Text style={styles.heroChipText}>판매 {sold}장 · 잔여 {available}장</Text></View>
        </HeroGradient>
        <View style={styles.statStrip}>
          <MiniStat label="판매" value={sold} color="#0F6E56" />
          <MiniStat label="잔여" value={available} color="#534AB7" />
          <MiniStat label="리셀" value={listed} color="#854F0B" />
          <MiniStat label="체크인" value={used} color="#185FA5" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity key={item.key} style={[styles.filterPill, active && styles.filterPillActive, !active && item.tone === 'teal' && styles.filterPillTeal, !active && item.tone === 'amber' && styles.filterPillAmber, !active && item.tone === 'blue' && styles.filterPillBlue, !active && item.tone === 'red' && styles.filterPillRed]} onPress={() => setFilter(item.key)}>
                <Text style={[styles.filterText, active && styles.filterTextActive, !active && item.tone === 'teal' && styles.filterTextTeal, !active && item.tone === 'amber' && styles.filterTextAmber, !active && item.tone === 'blue' && styles.filterTextBlue, !active && item.tone === 'red' && styles.filterTextRed]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>구역별 판매 현황</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TicketExplore', { eventId })}><Text style={styles.sectionLink}>전체 티켓</Text></TouchableOpacity>
        </View>
        <View style={styles.detailCard}>
          {stats.length === 0 ? <Text style={styles.emptyText}>발행된 티켓이 없습니다.</Text> : stats.map(([section, item]) => {
            const pct = item.total > 0 ? Math.round((item.sold / item.total) * 100) : 0;
            return (
              <View key={section} style={styles.sectionRow}>
                <View style={styles.barTop}><Text style={styles.cardName}>{section}</Text><Text style={styles.barValue}>{item.sold}/{item.total}</Text></View>
                <View style={styles.barBg}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: '#534AB7' }]} /></View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 18, 40) }]}>
        <Text style={styles.eyebrow}>Ticket Operations</Text>
        <Text style={styles.heroTitle}>티켓 판매 현황</Text>
        <Text style={styles.heroSub}>이벤트별 판매 상태와 좌석 현황을 관리합니다.</Text>
        <View style={styles.heroChip}><View style={styles.heroDotAmber} /><Text style={styles.heroChipText}>운영중 이벤트 {items.length}개</Text></View>
      </HeroGradient>

      <View style={styles.metricGrid}>
        <MetricCard icon="ticket" iconBg="#EEEDFE" iconColor="#534AB7" value={totals.issued} label="총 발급 티켓" />
        <MetricCard icon="cart" iconBg="#E1F5EE" iconColor="#0F6E56" value={totals.sold} label="판매 완료" />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <AppIcon name="search" color="#9CA3AF" size={15} />
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="이벤트명 검색" returnKeyType="search" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity key={item.key} style={[styles.filterPill, active && styles.filterPillActive, !active && item.tone === 'teal' && styles.filterPillTeal, !active && item.tone === 'amber' && styles.filterPillAmber, !active && item.tone === 'blue' && styles.filterPillBlue, !active && item.tone === 'red' && styles.filterPillRed]} onPress={() => setFilter(item.key)}>
              <Text style={[styles.filterText, active && styles.filterTextActive, !active && item.tone === 'teal' && styles.filterTextTeal, !active && item.tone === 'amber' && styles.filterTextAmber, !active && item.tone === 'blue' && styles.filterTextBlue, !active && item.tone === 'red' && styles.filterTextRed]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.resultLabel}>
        <Text style={styles.resultText}>운영중 이벤트 {visibleItems.length}건</Text>
        <Text style={styles.sortText}>최신순</Text>
      </View>

      {visibleItems.length === 0 ? (
        <View style={styles.emptyBox}><Text style={styles.emptyTitle}>운영할 판매 이벤트가 없습니다.</Text></View>
      ) : visibleItems.map((item) => {
        const stat = ticketStats(item.event, item.tickets);
        const soldPct = stat.total > 0 ? Math.min(100, Math.round((stat.sold / stat.total) * 100)) : 0;
        const remainPct = stat.total > 0 ? Math.min(100, Math.round((stat.available / stat.total) * 100)) : 0;
        const resalePct = stat.total > 0 ? Math.min(100, Math.round((stat.listed / stat.total) * 100)) : 0;
        const missing = stat.total <= 0;
        return (
          <TouchableOpacity key={item.event.id} style={styles.ticketCard} onPress={() => navigation.navigate('SalesStatus', { eventId: item.event.id })}>
            <View style={styles.cardTop}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardName} numberOfLines={1}>{eventTitle(item.event)}</Text>
                <Text style={styles.cardMeta}>{item.event.venue || '장소 미정'} · {eventDateText(item.event)}</Text>
              </View>
              <View style={[styles.badge, missing ? styles.badgeWarn : styles.badgeSell]}>
                <Text style={[styles.badgeText, missing ? styles.badgeTextWarn : styles.badgeTextSell]}>{missing ? '미발행' : '판매 중'}</Text>
              </View>
            </View>
            {missing ? (
              <View style={styles.warnBox}><AppIcon name="alert" color="#854F0B" size={13} /><Text style={styles.warnText}>티켓이 아직 발행되지 않았습니다. 티켓 발행 후 판매가 시작됩니다.</Text></View>
            ) : (
              <View style={styles.bars}>
                <BarRow label="판매" value={`${stat.sold}/${stat.total}`} pct={soldPct} color="#534AB7" />
                <BarRow label="잔여" value={`${stat.available}`} pct={remainPct} color="#CECBF6" muted />
                <BarRow label="리셀" value={`${stat.listed}`} pct={resalePct} color="#FAC775" muted />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function MetricCard({ icon, iconBg, iconColor, value, label }: { icon: IconName; iconBg: string; iconColor: string; value: number; label: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: iconBg }]}><AppIcon name={icon} color={iconColor} size={15} /></View>
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statMini}><Text style={[styles.statValue, { color }]}>{value.toLocaleString()}</Text><Text style={styles.statLabel}>{label}</Text></View>
  );
}

function BarRow({ label, value, pct, color, muted }: { label: string; value: string; pct: number; color: string; muted?: boolean }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barBg}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
      <Text style={[styles.barValue, muted && styles.barValueMuted]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  hero: { paddingHorizontal: 18, paddingBottom: 30 },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', lineHeight: 26 },
  heroSub: { color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 4 },
  heroChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  heroDotAmber: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FAC775' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: -18, marginBottom: 10 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', padding: 11 },
  metricIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  metricValue: { fontSize: 20, fontWeight: '900', color: '#1A1A2E', lineHeight: 22 },
  metricLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 11 },
  searchInput: { flex: 1, paddingVertical: 9, color: '#1A1A2E', fontSize: 12 },
  filterWrap: { paddingHorizontal: 14, paddingBottom: 8, gap: 6 },
  filterPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  filterPillActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterPillTeal: { backgroundColor: '#E1F5EE', borderColor: '#9FE1CB' },
  filterPillAmber: { backgroundColor: '#FAEEDA', borderColor: '#FAC775' },
  filterPillBlue: { backgroundColor: '#E6F1FB', borderColor: '#A9CDEB' },
  filterPillRed: { backgroundColor: '#FCEBEB', borderColor: '#F7C1C1' },
  filterText: { color: '#6B7280', fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  filterTextTeal: { color: '#0F6E56' },
  filterTextAmber: { color: '#854F0B' },
  filterTextBlue: { color: '#185FA5' },
  filterTextRed: { color: '#A32D2D' },
  resultLabel: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 6 },
  resultText: { fontSize: 10, color: '#9CA3AF', fontWeight: '800' },
  sortText: { fontSize: 10, color: '#534AB7', fontWeight: '800' },
  ticketCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', padding: 12, marginHorizontal: 14, marginBottom: 7 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 12, fontWeight: '900', color: '#1A1A2E' },
  cardMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  badgeSell: { backgroundColor: '#E6F1FB' },
  badgeWarn: { backgroundColor: '#FAEEDA' },
  badgeText: { fontSize: 9, fontWeight: '900' },
  badgeTextSell: { color: '#185FA5' },
  badgeTextWarn: { color: '#854F0B' },
  bars: { gap: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barLabel: { width: 30, fontSize: 9, color: '#9CA3AF', fontWeight: '800' },
  barBg: { flex: 1, height: 5, borderRadius: 99, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  barValue: { width: 34, textAlign: 'right', fontSize: 9, fontWeight: '900', color: '#1A1A2E' },
  barValueMuted: { color: '#9CA3AF' },
  warnBox: { backgroundColor: '#FAEEDA', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  warnText: { flex: 1, color: '#854F0B', fontSize: 10, fontWeight: '700', lineHeight: 15 },
  emptyBox: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, alignItems: 'center' },
  emptyTitle: { color: '#6B7280', fontSize: 13, fontWeight: '800' },
  statStrip: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  statMini: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#E5E7EB', paddingVertical: 9, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '900', lineHeight: 19 },
  statLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#1A1A2E' },
  sectionLink: { color: '#534AB7', fontSize: 11, fontWeight: '800' },
  detailCard: { marginHorizontal: 14, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', padding: 12 },
  sectionRow: { paddingVertical: 9 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  emptyText: { color: '#9CA3AF', paddingVertical: 16, textAlign: 'center', fontSize: 12, fontWeight: '700' },
});
