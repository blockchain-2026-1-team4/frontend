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
import { formatEventCategory, formatNextRoundLabel, getEventDisplayStatus, getNextRoundTime, operationSortRank } from '../lib/ticketDisplay';
import type { EventSummary } from '../types/api';

type IconName = 'arrow-left' | 'plus' | 'search' | 'calendar' | 'pin';
type StatusFilter = 'all' | 'published' | 'draft' | 'ended';

const PAGE_SIZE = 8;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'published', label: '게시중' },
  { key: 'draft', label: '초안' },
  { key: 'ended', label: '종료' },
];

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

function eventEnd(event: EventSummary) {
  return event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || '';
}

function isExpired(event: EventSummary) {
  const status = String(event.status ?? '').toUpperCase();
  if (status === 'CANCELLED') return true;
  const end = new Date(eventEnd(event)).getTime();
  return !Number.isNaN(end) && end < Date.now();
}

function getEventBadge(event: EventSummary): { label: string; bg: string; text: string } {
  const status = String(event.status ?? '').toUpperCase();
  const expired = isExpired(event);
  if (expired) return { label: '종료', bg: '#F3F4F6', text: '#6B7280' };
  if (status === 'PUBLISHED') return { label: '게시중', bg: '#E1F5EE', text: '#0F6E56' };
  if (status === 'INACTIVE') return { label: '비공개', bg: '#F3F4F6', text: '#9CA3AF' };
  if (status === 'DRAFT') return { label: '초안', bg: '#F3F4F6', text: '#9CA3AF' };
  return { label: getEventDisplayStatus(event).label, bg: '#FAEEDA', text: '#854F0B' };
}

function formatDate(dateStr?: string | null): { month: string; day: string } {
  if (!dateStr) return { month: '--', day: '--' };
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return { month: '--', day: '--' };
  return {
    month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(date.getDate()).padStart(2, '0'),
  };
}

function AppIcon({ name, color = '#534AB7', size = 18 }: { name: IconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'arrow-left' ? <Path {...common} d="M19 12H5m7 7-7-7 7-7" /> : null}
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
      {name === 'pin' ? (
        <>
          <Path {...common} d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <Circle {...common} cx={12} cy={10} r={3} />
        </>
      ) : null}
    </Svg>
  );
}

const HeroLinearGradient = LinearGradient as unknown as React.ComponentType<any>;

export default function MyEventsPage({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const data = await backendApi.getMyEvents({ page: 0, size: 100 });
      setEvents(data.items ?? []);
      setPage(1);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '내 이벤트를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const publishedCount = useMemo(
    () => events.filter((e) => String(e.status ?? '').toUpperCase() === 'PUBLISHED' && !isExpired(e)).length,
    [events],
  );

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events
      .filter((event) => {
        const status = String(event.status ?? '').toUpperCase();
        const expired = isExpired(event);
        if (statusFilter === 'published') return status === 'PUBLISHED' && !expired;
        if (statusFilter === 'draft') return (status === 'DRAFT' || status === 'INACTIVE') && !expired;
        if (statusFilter === 'ended') return expired;
        return !expired;
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

  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEvents = visibleEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const goBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('OrganizerDashboard');
  };

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
      <HeroLinearGradient
        colors={['#1A1A2E', '#2D2B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}
      >
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
            <AppIcon name="arrow-left" color="rgba(255,255,255,0.78)" size={22} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="새 이벤트 등록" style={styles.addHeroButton} onPress={() => navigation.navigate('EventCreate')}>
            <AppIcon name="plus" color="rgba(255,255,255,0.9)" size={18} />
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>MY EVENTS</Text>
        <Text style={styles.heroTitle}>내 이벤트</Text>
        <Text style={styles.heroSub}>등록한 이벤트를 관리하고 검색하세요.</Text>
        <View style={styles.heroChip}>
          <View style={styles.heroDot} />
          <Text style={styles.heroChipText}>전체 {events.length}개 · 게시중 {publishedCount}개</Text>
        </View>
      </HeroLinearGradient>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <AppIcon name="search" color="#9CA3AF" size={16} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(value) => { setQuery(value); setPage(1); }}
            placeholder="이벤트명, 장소, 카테고리 검색"
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[styles.filterTab, statusFilter === filter.key && styles.filterTabActive]}
            onPress={() => { setStatusFilter(filter.key); setPage(1); }}
          >
            <Text style={[styles.filterTabText, statusFilter === filter.key && styles.filterTabTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultHint}>결과 {visibleEvents.length}건</Text>
        {visibleEvents.length > PAGE_SIZE && (
          <Text style={styles.resultHint}>{currentPage} / {totalPages} 페이지</Text>
        )}
      </View>

      {pagedEvents.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>표시할 이벤트가 없습니다.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('EventCreate')}>
            <Text style={styles.emptyButtonText}>이벤트 등록</Text>
          </TouchableOpacity>
        </View>
      ) : (
        pagedEvents.map((item) => {
          const nextTime = getNextRoundTime(item);
          const dateStr = !Number.isNaN(nextTime) ? new Date(nextTime).toISOString() : null;
          const { month, day } = formatDate(dateStr);
          const badge = getEventBadge(item);
          const isGray = badge.label !== '게시중';
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.eventItem}
              onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: item.id })}
            >
              <View style={[styles.eventDateBox, isGray && styles.eventDateBoxGray]}>
                <Text style={[styles.eventMonth, isGray && styles.eventMonthGray]}>{month}</Text>
                <Text style={[styles.eventDay, isGray && styles.eventDayGray]}>{day}</Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName} numberOfLines={1}>{eventTitle(item)}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {item.venue || '장소 미정'} · {formatNextRoundLabel(item)}
                </Text>
              </View>
              <View style={[styles.eventBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.eventBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {visibleEvents.length > PAGE_SIZE && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
            disabled={currentPage === 1}
            onPress={() => setPage((v) => Math.max(v - 1, 1))}
          >
            <Text style={styles.pageButtonText}>이전</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pageButton, currentPage >= totalPages && styles.disabledButton]}
            disabled={currentPage >= totalPages}
            onPress={() => setPage((v) => Math.min(v + 1, totalPages))}
          >
            <Text style={styles.pageButtonText}>다음</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  addHeroButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  searchSection: { paddingHorizontal: 16, marginTop: 14, marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: '#0F172A', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB' },
  filterTabActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterTabText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  filterTabTextActive: { color: '#FFFFFF' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  resultHint: { fontSize: 11, color: '#9CA3AF', fontWeight: '700' },
  eventItem: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventDateBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  eventDateBoxGray: { backgroundColor: '#F3F4F6' },
  eventMonth: { fontSize: 8, fontWeight: '800', color: '#534AB7', textTransform: 'uppercase' },
  eventMonthGray: { color: '#9CA3AF' },
  eventDay: { fontSize: 16, fontWeight: '900', color: '#3C3489', lineHeight: 18 },
  eventDayGray: { color: '#6B7280' },
  eventInfo: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  eventMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  eventBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  eventBadgeText: { fontSize: 9, fontWeight: '800' },
  emptyBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, alignItems: 'center', marginTop: 8 },
  emptyTitle: { color: '#6B7280', fontSize: 13, fontWeight: '800' },
  emptyButton: { backgroundColor: '#1A1A2E', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  pagination: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 8 },
  pageButton: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  pageButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  disabledButton: { opacity: 0.35 },
});
