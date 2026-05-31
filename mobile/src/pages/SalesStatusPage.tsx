import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatNextRoundLabel, getSalesDisplayStatus, getNextRoundTime, salesSortRank, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventSummary, TicketDetail } from '../types/api';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

function eventTitle(event: EventSummary | EventDetail) {
  return event.name || event.title || '이벤트';
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

export default function SalesStatusPage({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const eventId = route?.params?.eventId as string | undefined;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!eventId) {
        const page = await backendApi.getMyEvents({ page: 0, size: 50 });
        const myEvents = (page.items ?? [])
          .filter((item) => String(item.status).toUpperCase() !== 'CANCELLED')
          .sort((a, b) => {
            const rankDiff = salesSortRank(a) - salesSortRank(b);
            if (rankDiff !== 0) return rankDiff;
            const aTime = getNextRoundTime(a);
            const bTime = getNextRoundTime(b);
            return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
          });
        setEvents(myEvents);
        setEvent(null);
        setTickets([]);
      } else {
        const [detail, list] = await Promise.all([
          backendApi.getEvent(eventId),
          backendApi.getEventTickets(eventId).catch(() => []),
        ]);
        setEvent(detail);
        setTickets(list);
        setEvents([]);
      }
    } catch (error: any) {
      Alert.alert('티켓 판매 현황 로드 실패', errorMessage(error, '티켓 판매 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sold = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
  const used = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
  const available = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'AVAILABLE').length;
  const listed = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'LISTED').length;
  const stats = useMemo(() => sectionStats(tickets), [tickets]);

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('OrganizerDashboard');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  if (!eventId) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}>
          <View style={styles.heroTopBar}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
              <BackIcon />
            </TouchableOpacity>
          </View>
          <Text style={styles.eyebrow}>TICKET OPERATIONS</Text>
          <Text style={styles.heroTitle}>티켓 판매 현황</Text>
          <Text style={styles.heroSub}>이벤트별 판매 상태와 좌석 현황을 관리합니다.</Text>
          <View style={styles.heroChip}>
            <View style={styles.heroDot} />
            <Text style={styles.heroChipText}>운영중 이벤트 {events.length}개</Text>
          </View>
        </HeroGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>운영중 판매 이벤트</Text>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>운영할 판매 이벤트가 없습니다.</Text>
          </View>
        ) : (
          events.map((item) => {
            const status = getSalesDisplayStatus(item);
            return (
              <TouchableOpacity key={item.id} style={styles.eventItem} onPress={() => navigation.navigate('SalesStatus', { eventId: item.id })}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName} numberOfLines={1}>{eventTitle(item)}</Text>
                  <Text style={styles.eventMeta}>{formatNextRoundLabel(item)}</Text>
                  <Text style={styles.eventMeta}>남은 좌석 {item.remainingTicketCount ?? 0}장</Text>
                </View>
                <View style={[styles.statusBadge, styles[`tone_${status.tone}` as keyof typeof styles] as any]}>
                  <Text style={[styles.statusBadgeText, styles[`toneText_${status.tone}` as keyof typeof styles] as any]}>{status.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}>
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>SALES DASHBOARD</Text>
        <Text style={styles.heroTitle}>티켓 판매 현황</Text>
        <Text style={styles.heroSub} numberOfLines={1}>{event?.name || event?.title || '이벤트'} · {weiToEth(event?.ticketPriceWei)}</Text>
        <View style={styles.heroChip}>
          <View style={styles.heroDot} />
          <Text style={styles.heroChipText}>판매 {sold}장 · 남은 좌석 {available}장</Text>
        </View>
      </HeroGradient>

      <View style={styles.metricGrid}>
        <MetricCard label="판매" value={sold} bg="#E1F5EE" color="#0F6E56" />
        <MetricCard label="남은 좌석" value={available} bg="#EEEDFE" color="#534AB7" />
        <MetricCard label="리셀 중" value={listed} bg="#FAEEDA" color="#854F0B" />
        <MetricCard label="체크인" value={used} bg="#E6F1FB" color="#185FA5" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>구역별 판매 현황</Text>
        <TouchableOpacity onPress={() => navigation?.navigate?.('TicketExplore', { eventId })}>
          <Text style={styles.sectionLink}>전체 티켓</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {stats.length === 0 ? (
          <Text style={styles.emptyText}>발행된 티켓이 없습니다.</Text>
        ) : (
          stats.map(([section, item]) => {
            const pct = item.total > 0 ? Math.round((item.sold / item.total) * 100) : 0;
            return (
              <View key={section} style={styles.sectionRow}>
                <View style={styles.sectionInfo}>
                  <Text style={styles.rowTitle}>{section}</Text>
                  <Text style={styles.rowMeta}>판매 {item.sold} / {item.total} ({pct}%)</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function MetricCard({ label, value, bg, color }: { label: string; value: number; bg: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: bg }]}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: -20, marginBottom: 16 },
  metricCard: { width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13, borderWidth: 0.5, borderColor: '#E5E7EB' },
  metricIconBox: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  metricValue: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  metricLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  sectionLink: { fontSize: 11, color: '#534AB7', fontWeight: '700' },
  card: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  sectionRow: { paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  sectionInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { color: '#1A1A2E', fontWeight: '800', fontSize: 13 },
  rowMeta: { color: '#9CA3AF', fontSize: 11 },
  progressTrack: { marginTop: 8, height: 6, borderRadius: 999, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: '#534AB7' },
  eventItem: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventInfo: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },
  eventMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  emptyBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, alignItems: 'center' },
  emptyTitle: { color: '#6B7280', fontSize: 13, fontWeight: '800' },
  emptyText: { color: '#9CA3AF', paddingVertical: 16, textAlign: 'center', fontSize: 13 },
  tone_neutral: { backgroundColor: '#F1F5F9' },
  toneText_neutral: { color: '#475569' },
  tone_blue: { backgroundColor: '#EEEDFE' },
  toneText_blue: { color: '#534AB7' },
  tone_green: { backgroundColor: '#E1F5EE' },
  toneText_green: { color: '#0F6E56' },
  tone_yellow: { backgroundColor: '#FAEEDA' },
  toneText_yellow: { color: '#854F0B' },
  tone_red: { backgroundColor: '#FEE2E2' },
  toneText_red: { color: '#B91C1C' },
  tone_gray: { backgroundColor: '#E5E7EB' },
  toneText_gray: { color: '#6B7280' },
});
