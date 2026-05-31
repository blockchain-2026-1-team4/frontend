import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventCategory, getNextRoundTime, operationSortRank } from '../lib/ticketDisplay';
import type { EventSummary } from '../types/api';

type StatusFilter = 'all' | 'published' | 'draft' | 'ended' | 'cancelled';
type IconName = 'plus' | 'search' | 'calendar' | 'broadcast' | 'sliders';

const STATUS_FILTERS: { key: StatusFilter; label: string; tone?: 'teal' | 'red' }[] = [
  { key: 'all', label: '전체' },
  { key: 'published', label: '게시중', tone: 'teal' },
  { key: 'draft', label: '초안' },
  { key: 'ended', label: '종료' },
  { key: 'cancelled', label: '취소', tone: 'red' },
];

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

function eventEnd(event: EventSummary) {
  return event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || '';
}

function eventStart(event: EventSummary) {
  const next = getNextRoundTime(event);
  if (!Number.isNaN(next)) return new Date(next).toISOString();
  return event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || null;
}

function isEnded(event: EventSummary) {
  const status = String(event.status ?? '').toUpperCase();
  if (status === 'CANCELLED') return false;
  const end = new Date(eventEnd(event)).getTime();
  return !Number.isNaN(end) && end < Date.now();
}

function isCancelled(event: EventSummary) {
  return String(event.status ?? '').toUpperCase() === 'CANCELLED';
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

function formatEventTime(dateStr?: string | null) {
  if (!dateStr) return '시간 미정';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '시간 미정';
  return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ticketSummary(event: EventSummary) {
  const sold = Number(event.soldTicketCount ?? 0);
  const total = Number(event.totalTicketCount ?? 0);
  return total > 0 ? `티켓 ${sold}/${total}` : '티켓 미발행';
}

function eventBadge(event: EventSummary) {
  const status = String(event.status ?? '').toUpperCase();
  if (isCancelled(event)) return { label: '취소', bg: '#FCEBEB', text: '#A32D2D', grayDate: true };
  if (isEnded(event)) return { label: '종료', bg: '#F3F4F6', text: '#6B7280', grayDate: true };
  if (status === 'PUBLISHED') return { label: '게시중', bg: '#E1F5EE', text: '#0F6E56', grayDate: false };
  if (status === 'DRAFT') return { label: '초안', bg: '#F3F4F6', text: '#9CA3AF', grayDate: true };
  if (status === 'INACTIVE') return { label: '비공개', bg: '#F3F4F6', text: '#9CA3AF', grayDate: true };
  return { label: status || '상태 없음', bg: '#FAEEDA', text: '#854F0B', grayDate: true };
}

function AppIcon({ name, color = '#534AB7', size = 18 }: { name: IconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'plus' ? <Path {...common} d="M12 5v14M5 12h14" /> : null}
      {name === 'search' ? (
        <>
          <Circle {...common} cx={11} cy={11} r={8} />
          <Path {...common} d="m21 21-4.35-4.35" />
        </>
      ) : null}
      {name === 'calendar' ? (
        <>
          <Rect {...common} x={4} y={5} width={16} height={15} rx={2} />
          <Path {...common} d="M8 3v4m8-4v4M4 10h16" />
        </>
      ) : null}
      {name === 'broadcast' ? (
        <>
          <Circle {...common} cx={12} cy={12} r={2} />
          <Path {...common} d="M16.24 7.76a6 6 0 0 1 0 8.48M7.76 16.24a6 6 0 0 1 0-8.48" />
        </>
      ) : null}
      {name === 'sliders' ? <Path {...common} d="M4 6h16M4 12h16M4 18h16M8 6v0M14 12v0M10 18v0" /> : null}
    </Svg>
  );
}

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

export default function MyEventsPage({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    try {
      const data = await backendApi.getMyEvents({ page: 0, size: 100 });
      setEvents(data.items ?? []);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '내 이벤트를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const publishedCount = useMemo(
    () => events.filter((event) => String(event.status ?? '').toUpperCase() === 'PUBLISHED' && !isEnded(event) && !isCancelled(event)).length,
    [events],
  );

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events
      .filter((event) => {
        const status = String(event.status ?? '').toUpperCase();
        if (statusFilter === 'published') return status === 'PUBLISHED' && !isEnded(event) && !isCancelled(event);
        if (statusFilter === 'draft') return (status === 'DRAFT' || status === 'INACTIVE') && !isCancelled(event);
        if (statusFilter === 'ended') return isEnded(event);
        if (statusFilter === 'cancelled') return isCancelled(event);
        return true;
      })
      .filter((event) => {
        if (!normalized) return true;
        const haystack = `${eventTitle(event)} ${event.venue || ''} ${formatEventCategory(event.category)}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .sort((a, b) => {
        const rankDiff = operationSortRank(a) - operationSortRank(b);
        if (rankDiff !== 0) return rankDiff;
        const aTime = getNextRoundTime(a);
        const bTime = getNextRoundTime(b);
        return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
      });
  }, [events, query, statusFilter]);

  if (loading && events.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
        <Text style={styles.loadingText}>내 이벤트를 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 18, 40) }]}>
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>My Events</Text>
          <TouchableOpacity style={styles.heroAction} onPress={() => navigation.navigate('EventCreate')} accessibilityRole="button" accessibilityLabel="이벤트 등록">
            <AppIcon name="plus" color="rgba(255,255,255,0.9)" size={18} />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>내 이벤트</Text>
        <Text style={styles.heroSub}>등록한 이벤트를 관리하고 검색하세요.</Text>
        <View style={styles.heroChip}>
          <View style={styles.heroDot} />
          <Text style={styles.heroChipText}>전체 {events.length}개 · 게시중 {publishedCount}개</Text>
        </View>
      </HeroGradient>

      <View style={styles.metricGrid}>
        <MetricCard icon="calendar" iconBg="#EEEDFE" iconColor="#534AB7" value={events.length} label="전체 이벤트" />
        <MetricCard icon="broadcast" iconBg="#E1F5EE" iconColor="#0F6E56" value={publishedCount} label="게시중" trend={`이번달 +${publishedCount}`} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <AppIcon name="search" color="#9CA3AF" size={15} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="이벤트명, 장소, 카테고리"
            returnKeyType="search"
          />
          <AppIcon name="sliders" color="#534AB7" size={15} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap}>
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterPill, active && styles.filterPillActive, !active && filter.tone === 'teal' && styles.filterPillTeal, !active && filter.tone === 'red' && styles.filterPillRed]}
              onPress={() => setStatusFilter(filter.key)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive, !active && filter.tone === 'teal' && styles.filterTextTeal, !active && filter.tone === 'red' && styles.filterTextRed]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.resultLabel}>
        <Text style={styles.resultText}>결과 {visibleEvents.length}건</Text>
        <Text style={styles.sortText}>최신순</Text>
      </View>

      {visibleEvents.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>표시할 이벤트가 없습니다.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('EventCreate')}>
            <Text style={styles.emptyButtonText}>이벤트 등록</Text>
          </TouchableOpacity>
        </View>
      ) : (
        visibleEvents.map((item) => {
          const dateStr = eventStart(item);
          const date = formatDate(dateStr);
          const badge = eventBadge(item);
          return (
            <TouchableOpacity key={item.id} style={styles.eventCard} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: item.id })}>
              <View style={[styles.eventDate, badge.grayDate && styles.eventDateGray]}>
                <Text style={[styles.eventMonth, badge.grayDate && styles.eventMonthGray]}>{date.month}</Text>
                <Text style={[styles.eventDay, badge.grayDate && styles.eventDayGray]}>{date.day}</Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName} numberOfLines={1}>{eventTitle(item)}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{item.venue || '장소 미정'} · {formatEventTime(dateStr)} · {ticketSummary(item)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

function MetricCard({ icon, iconBg, iconColor, value, label, trend }: { icon: IconName; iconBg: string; iconColor: string; value: number; label: string; trend?: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: iconBg }]}>
        <AppIcon name={icon} color={iconColor} size={15} />
      </View>
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {trend ? <Text style={styles.metricTrend}>{trend}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  hero: { paddingHorizontal: 18, paddingBottom: 30 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroAction: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', lineHeight: 26 },
  heroSub: { color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 4 },
  heroChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: -18, marginBottom: 10 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', padding: 11 },
  metricIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  metricValue: { fontSize: 20, fontWeight: '900', color: '#1A1A2E', lineHeight: 22 },
  metricLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  metricTrend: { fontSize: 9, color: '#0F6E56', marginTop: 3, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 11 },
  searchInput: { flex: 1, paddingVertical: 9, color: '#1A1A2E', fontSize: 12 },
  filterWrap: { paddingHorizontal: 14, paddingBottom: 8, gap: 6 },
  filterPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  filterPillActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterPillTeal: { backgroundColor: '#E1F5EE', borderColor: '#9FE1CB' },
  filterPillRed: { backgroundColor: '#FCEBEB', borderColor: '#F7C1C1' },
  filterText: { color: '#6B7280', fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  filterTextTeal: { color: '#0F6E56' },
  filterTextRed: { color: '#A32D2D' },
  resultLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 6 },
  resultText: { fontSize: 10, color: '#9CA3AF', fontWeight: '800' },
  sortText: { fontSize: 10, color: '#534AB7', fontWeight: '800' },
  eventCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', padding: 11, marginHorizontal: 14, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventDate: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  eventDateGray: { backgroundColor: '#F3F4F6' },
  eventMonth: { fontSize: 7, fontWeight: '900', color: '#534AB7', textTransform: 'uppercase', lineHeight: 9 },
  eventMonthGray: { color: '#9CA3AF' },
  eventDay: { fontSize: 15, fontWeight: '900', color: '#3C3489', lineHeight: 17 },
  eventDayGray: { color: '#6B7280' },
  eventInfo: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 12, fontWeight: '900', color: '#1A1A2E' },
  eventMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 9, fontWeight: '900' },
  emptyBox: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, alignItems: 'center' },
  emptyTitle: { color: '#6B7280', fontSize: 13, fontWeight: '800' },
  emptyButton: { backgroundColor: '#1A1A2E', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
