import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, TicketDetail } from '../types/api';

type CheckInEvent = { event: EventSummary; tickets: TicketDetail[] };
type SectionKey = 'today' | 'upcoming' | 'ended';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function eventTitle(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function eventEndTime(event: EventSummary) {
  const time = new Date(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || '').getTime();
  return Number.isNaN(time) ? NaN : time;
}

function ticketCount(item: CheckInEvent) {
  return Number(item.event.totalTicketCount ?? 0) || item.tickets.length;
}

function sectionOf(item: CheckInEvent, now = new Date()): SectionKey {
  const endTime = eventEndTime(item.event);
  if (!Number.isNaN(endTime) && now.getTime() > endTime) return 'ended';
  const startTime = getNextRoundTime(item.event, now);
  if (!Number.isNaN(startTime) && new Date(startTime).toDateString() === now.toDateString()) return 'today';
  return 'upcoming';
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return { month: '--', day: '--' };
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return { month: '--', day: '--' };
  return {
    month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(date.getDate()).padStart(2, '0'),
  };
}

function eventStartText(event: EventSummary) {
  const start = getNextRoundTime(event);
  if (Number.isNaN(start)) return '시간 미정';
  return new Date(start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function CheckInHomePage({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CheckInEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await backendApi.getMyEvents({ page: 0, size: 100 });
      const published = (page.items ?? []).filter((event) => String(event.status).toUpperCase() === 'ACTIVE');
      const withTickets = await Promise.all(published.map(async (event) => ({ event, tickets: await backendApi.getEventTickets(event.id).catch(() => []) })));
      setItems(withTickets);
    } catch (error: any) {
      Alert.alert('체크인 로드 실패', errorMessage(error, '체크인 운영 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const grouped = useMemo(() => {
    const groups: Record<SectionKey, CheckInEvent[]> = { today: [], upcoming: [], ended: [] };
    items.forEach((item) => groups[sectionOf(item)].push(item));
    Object.values(groups).forEach((group) => group.sort((a, b) => {
      const aTime = getNextRoundTime(a.event);
      const bTime = getNextRoundTime(b.event);
      return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
    }));
    return groups;
  }, [items]);

  const missingTickets = items.filter((item) => ticketCount(item) === 0).length;
  const todayText = grouped.today.length === 0 ? '오늘 예정 없음' : `오늘 일정 ${grouped.today.length}건`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
        <Text style={styles.loadingText}>체크인 운영 화면을 준비하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 14, 36) }]}>
        <Text style={styles.eyebrow}>Check-in Operations</Text>
        <Text style={styles.heroTitle}>체크인 허브</Text>
        <Text style={styles.heroSub}>운영 현황을 한눈에 확인하고 바로 처리합니다.</Text>
        <View style={styles.heroChip}><View style={[styles.heroDot, grouped.today.length > 0 && styles.heroDotGreen]} /><Text style={styles.heroChipText}>{todayText}</Text></View>
      </HeroGradient>

      <View style={styles.statStrip}>
        <MiniStat label="오늘 일정" value={grouped.today.length} color="#1D9E75" />
        <MiniStat label="향후 일정" value={grouped.upcoming.length} color="#534AB7" />
        <MiniStat label="티켓 미발행" value={missingTickets} color="#854F0B" />
      </View>

      <CheckInSection
        title="오늘 일정"
        count={grouped.today.length}
        items={grouped.today}
        emptyText="오늘 예정된 이벤트가 없습니다."
        countTone="gray"
        onOpenList={() => navigation.navigate('CheckInEventList', { section: '오늘 일정' })}
        onOpenEvent={(eventId) => navigation.navigate('CheckInManage', { eventId })}
      />

      <CheckInSection
        title="향후 일정"
        count={grouped.upcoming.length}
        items={grouped.upcoming.slice(0, 3)}
        emptyText="예정된 체크인 이벤트가 없습니다."
        countTone="purple"
        onOpenList={() => navigation.navigate('CheckInEventList', { section: '향후 일정' })}
        onOpenEvent={(eventId) => navigation.navigate('CheckInManage', { eventId })}
      />

      <CheckInSection
        title="종료된 이벤트"
        count={grouped.ended.length}
        items={grouped.ended.slice(0, 3)}
        emptyText="종료된 체크인 이벤트가 없습니다."
        countTone="gray"
        onOpenList={() => navigation.navigate('CheckInEventList', { section: '종료된 이벤트' })}
        onOpenEvent={(eventId) => navigation.navigate('CheckInStatus', { eventId })}
      />
    </ScrollView>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statMini}><Text style={[styles.statValue, { color }]}>{value.toLocaleString()}</Text><Text style={styles.statLabel}>{label}</Text></View>
  );
}

function CheckInSection({
  title,
  count,
  items,
  emptyText,
  countTone,
  onOpenList,
  onOpenEvent,
}: {
  title: string;
  count: number;
  items: CheckInEvent[];
  emptyText: string;
  countTone: 'purple' | 'gray';
  onOpenList: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={[styles.countBadge, countTone === 'purple' ? styles.countPurple : styles.countGray]}><Text style={[styles.countText, countTone === 'purple' ? styles.countTextPurple : styles.countTextGray]}>{count}건</Text></View>
      </View>
      <View style={styles.ciBlock}>
        {items.length === 0 ? (
          <Text style={styles.ciEmpty}>{emptyText}</Text>
        ) : items.map((item) => {
          const start = getNextRoundTime(item.event);
          const dateStr = !Number.isNaN(start) ? new Date(start).toISOString() : null;
          const date = formatDate(dateStr);
          const missing = ticketCount(item) === 0;
          return (
            <TouchableOpacity key={item.event.id} style={styles.ciRow} onPress={() => onOpenEvent(item.event.id)}>
              <View style={styles.dateBox}><Text style={styles.dateMonth}>{date.month}</Text><Text style={styles.dateDay}>{date.day}</Text></View>
              <View style={styles.ciInfo}>
                <Text style={styles.ciName} numberOfLines={1}>{eventTitle(item.event)}</Text>
                <Text style={styles.ciSub} numberOfLines={1}>{item.event.venue || '장소 미정'} · {eventStartText(item.event)}</Text>
              </View>
              <View style={[styles.ciBadge, missing ? styles.ciBadgeWarn : styles.ciBadgeOk]}>
                <Text style={[styles.ciBadgeText, missing ? styles.ciBadgeTextWarn : styles.ciBadgeTextOk]}>{missing ? '미발행' : '체크인 가능'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={styles.ciButtonRow}><TouchableOpacity style={styles.ciButton} onPress={onOpenList}><Text style={styles.ciButtonText}>목록 보기</Text></TouchableOpacity></View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  hero: { paddingHorizontal: 18, paddingBottom: 30 },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', lineHeight: 26 },
  heroSub: { color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 4 },
  heroChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  heroDotGreen: { backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },
  statStrip: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, marginTop: -14, marginBottom: 12 },
  statMini: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#E5E7EB', paddingVertical: 9, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '900', lineHeight: 19 },
  statLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#1A1A2E' },
  countBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  countPurple: { backgroundColor: '#EEEDFE' },
  countGray: { backgroundColor: '#F3F4F6' },
  countText: { fontSize: 10, fontWeight: '900' },
  countTextPurple: { color: '#534AB7' },
  countTextGray: { color: '#9CA3AF' },
  ciBlock: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, marginBottom: 8, overflow: 'hidden' },
  ciEmpty: { fontSize: 11, color: '#9CA3AF', padding: 12, fontWeight: '700' },
  ciRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  dateBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  dateMonth: { fontSize: 7, fontWeight: '900', color: '#534AB7', textTransform: 'uppercase', lineHeight: 9 },
  dateDay: { fontSize: 14, fontWeight: '900', color: '#3C3489', lineHeight: 16 },
  ciInfo: { flex: 1, minWidth: 0 },
  ciName: { fontSize: 11, fontWeight: '900', color: '#1A1A2E' },
  ciSub: { fontSize: 9, color: '#9CA3AF', marginTop: 1, fontWeight: '700' },
  ciBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  ciBadgeOk: { backgroundColor: '#E1F5EE' },
  ciBadgeWarn: { backgroundColor: '#FAEEDA' },
  ciBadgeText: { fontSize: 9, fontWeight: '900' },
  ciBadgeTextOk: { color: '#0F6E56' },
  ciBadgeTextWarn: { color: '#854F0B' },
  ciButtonRow: { padding: 8 },
  ciButton: { backgroundColor: '#F5F5F5', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  ciButtonText: { color: '#534AB7', fontSize: 11, fontWeight: '900' },
});
