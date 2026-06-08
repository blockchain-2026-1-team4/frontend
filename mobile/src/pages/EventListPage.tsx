import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import {
  formatEventCategory,
  formatNextRoundLabel,
  getNextRoundTime,
  isEventListedNow,
  userSortRank,
  weiToEth,
} from '../lib/ticketDisplay';
import type { EventSummary } from '../types/api';

const CATEGORIES = [
  { id: 'ALL', label: '전체', icon: 'grid' },
  { id: 'CONCERT', label: '공연', icon: 'mic' },
  { id: 'FESTIVAL', label: '페스티벌', icon: 'music' },
  { id: 'SPORTS', label: '스포츠', icon: 'trophy' },
  { id: 'EXHIBITION', label: '전시', icon: 'photo' },
  { id: 'CONFERENCE', label: '컨퍼런스', icon: 'laptop' },
] as const;

const STATUS_FILTERS = [
  { id: 'ALL', label: '전체' },
  { id: 'SALE', label: '예매 가능' },
  { id: 'DEADLINE', label: '마감 임박' },
  { id: 'RESALE', label: '리셀 가능' },
] as const;

const SORT_OPTIONS = [
  { id: 'SCHEDULE', label: '가까운 일정순' },
  { id: 'LATEST', label: '최신순' },
  { id: 'LOW_PRICE', label: '가격 낮은순' },
] as const;

const POSTER_GRADIENTS = [
  ['#26215C', '#534AB7', '#1D9E75'],
  ['#0C447C', '#185FA5', '#639922'],
  ['#712B13', '#D85A30', '#EF9F27'],
  ['#2C2C2A', '#5F5E5A', '#534AB7'],
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];
type StatusFilterId = (typeof STATUS_FILTERS)[number]['id'];
type SortId = (typeof SORT_OPTIONS)[number]['id'];
type IconName = (typeof CATEGORIES)[number]['icon'] | 'arrowLeft' | 'adjust' | 'search' | 'shield' | 'sparkle' | 'map' | 'calendar' | 'chevron';

function eventName(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function eventVenue(event: EventSummary) {
  return event.location?.name || event.location?.address || event.venue || '-';
}

function priceLabel(value?: string) {
  const eth = weiToEth(value);
  if (!value || eth === '-') return '가격 정보 없음';
  return eth;
}

function priceValue(value?: string) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  try {
    return Number(BigInt(value));
  } catch {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  }
}

function daysUntilEvent(event: EventSummary) {
  const time = getNextRoundTime(event);
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / 86400000);
}

function isDeadlineEvent(event: EventSummary) {
  const days = daysUntilEvent(event);
  return days !== null && days >= 0 && days <= 5;
}

function formatDdayLabel(days: number) {
  return days === 0 ? 'D-DAY' : `D-${days}`;
}

function deadlineBadgeLabel(event: EventSummary) {
  const days = daysUntilEvent(event);
  if (days === null || days < 0 || days > 5) return null;
  return formatDdayLabel(days);
}

function upcomingDdayBadgeLabel(event: EventSummary) {
  const days = daysUntilEvent(event);
  if (days === null || days < 0) return null;
  return formatDdayLabel(days);
}

function normalizeCategory(value?: string): CategoryId {
  return CATEGORIES.some((item) => item.id === value) ? (value as CategoryId) : 'ALL';
}

function Icon({ name, color = '#64748B', size = 20 }: { name: IconName; color?: string; size?: number }) {
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  if (name === 'arrowLeft') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M15 18l-6-6 6-6" {...common} />
      </Svg>
    );
  }

  if (name === 'adjust') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...common} />
        <Circle cx="16" cy="7" r="2" {...common} />
        <Circle cx="8" cy="17" r="2" {...common} />
      </Svg>
    );
  }

  if (name === 'search') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="11" cy="11" r="7" {...common} />
        <Path d="M20 20l-3.5-3.5" {...common} />
      </Svg>
    );
  }

  if (name === 'grid') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="4" y="4" width="6" height="6" rx="1.5" {...common} />
        <Rect x="14" y="4" width="6" height="6" rx="1.5" {...common} />
        <Rect x="4" y="14" width="6" height="6" rx="1.5" {...common} />
        <Rect x="14" y="14" width="6" height="6" rx="1.5" {...common} />
      </Svg>
    );
  }

  if (name === 'mic') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="9" y="3" width="6" height="11" rx="3" {...common} />
        <Path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8" {...common} />
      </Svg>
    );
  }

  if (name === 'music') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M9 18V5l10-2v13" {...common} />
        <Circle cx="6" cy="18" r="3" {...common} />
        <Circle cx="16" cy="16" r="3" {...common} />
      </Svg>
    );
  }

  if (name === 'trophy') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M8 4h8v4a4 4 0 01-8 0V4zM8 6H5a3 3 0 003 3M16 6h3a3 3 0 01-3 3M12 12v5M9 21h6M10 17h4" {...common} />
      </Svg>
    );
  }

  if (name === 'photo') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="4" y="5" width="16" height="14" rx="2" {...common} />
        <Circle cx="9" cy="10" r="2" {...common} />
        <Path d="M20 16l-5-5-7 7" {...common} />
      </Svg>
    );
  }

  if (name === 'laptop') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="5" y="5" width="14" height="10" rx="2" {...common} />
        <Path d="M3 19h18" {...common} />
      </Svg>
    );
  }

  if (name === 'shield') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zM9 12l2 2 4-5" {...common} />
      </Svg>
    );
  }

  if (name === 'sparkle') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" {...common} />
      </Svg>
    );
  }

  if (name === 'map') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 21s7-4.4 7-11a7 7 0 10-14 0c0 6.6 7 11 7 11z" {...common} />
        <Circle cx="12" cy="10" r="2.5" {...common} />
      </Svg>
    );
  }

  if (name === 'calendar') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="4" y="5" width="16" height="15" rx="2" {...common} />
        <Path d="M8 3v4M16 3v4M4 10h16" {...common} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 18l6-6-6-6" {...common} />
    </Svg>
  );
}

function PosterArt({ event, index, compact = false }: { event: EventSummary; index: number; compact?: boolean }) {
  const imageUrl = resolveImageUrl((event as any).imageUrl);
  const colors = POSTER_GRADIENTS[index % POSTER_GRADIENTS.length];
  const title = eventName(event);
  const listed = isEventListedNow(event);
  const ddayBadge = compact ? upcomingDdayBadgeLabel(event) : deadlineBadgeLabel(event);
  const badge = ddayBadge ?? (listed ? '예매 가능' : '공식');
  const badgeStyle = compact
    ? [styles.hotBadge, ddayBadge ? styles.hotBadgeDeadline : listed ? styles.hotBadgeSale : styles.hotBadgeDefault]
    : [styles.posterBadge, ddayBadge ? styles.posterBadgeDeadline : listed ? styles.posterBadgeSale : styles.posterBadgeDefault];

  return (
    <View style={compact ? styles.hotImage : styles.poster}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={StyleSheet.absoluteFill} />
      <Text style={badgeStyle} numberOfLines={1}>{badge}</Text>
      {!compact ? <Text style={styles.posterTitle} numberOfLines={2}>{title}</Text> : null}
    </View>
  );
}

export default function EventListPage({ navigation, route }: any) {
  const initialCategory = normalizeCategory(route?.params?.category);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [query, setQuery] = useState(String(route?.params?.query ?? ''));
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>(initialCategory);
  const [selectedSmart, setSelectedSmart] = useState<StatusFilterId>('ALL');
  const [selectedSort, setSelectedSort] = useState<SortId>('SCHEDULE');
  const [loading, setLoading] = useState(true);

  const loadEvents = async (nextQuery = query, nextCategory = selectedCategory) => {
    setLoading(true);
    try {
      const data = await backendApi.getEvents({
        query: nextQuery.trim() || undefined,
        category: nextCategory === 'ALL' ? undefined : nextCategory,
        size: 50,
      });
      setEvents(data.items ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents(query, selectedCategory);
  }, [selectedCategory]);

  const visibleEvents = useMemo(() => {
    let visible = events.filter((event) => isEventListedNow(event));

    if (selectedSmart === 'SALE') {
      visible = visible.filter((event) => isEventListedNow(event));
    } else if (selectedSmart === 'DEADLINE') {
      visible = visible.filter(isDeadlineEvent);
    } else if (selectedSmart === 'RESALE') {
      visible = visible.filter((event) => Boolean(event.resaleAllowed));
    }

    return [...visible].sort((left, right) => {
      if (selectedSort === 'LOW_PRICE') {
        const priceDiff = priceValue(left.ticketPriceWei) - priceValue(right.ticketPriceWei);
        if (priceDiff !== 0) return priceDiff;
      }
      if (selectedSort === 'LATEST') {
        const leftId = Number(left.id) || 0;
        const rightId = Number(right.id) || 0;
        if (leftId !== rightId) return rightId - leftId;
      }

      const rankDiff = userSortRank(left) - userSortRank(right);
      if (rankDiff !== 0) return rankDiff;
      const leftTime = getNextRoundTime(left);
      const rightTime = getNextRoundTime(right);
      return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime) - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
    });
  }, [events, selectedSmart, selectedSort]);

  const hotEvents = useMemo(() => {
    const deadlineEvents = visibleEvents.filter(isDeadlineEvent);
    return (deadlineEvents.length ? deadlineEvents : visibleEvents).slice(0, 5);
  }, [visibleEvents]);

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('Main');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.top}>
            <View style={styles.left}>
              <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.84}>
                <Icon name="arrowLeft" size={20} />
              </TouchableOpacity>
              <View>
                <Text style={styles.eyebrow}>Discover</Text>
                <Text style={styles.title}>이벤트 탐색</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.filterButton}
              activeOpacity={0.84}
              onPress={() => setSelectedSort((current) => {
                const idx = SORT_OPTIONS.findIndex((o) => o.id === current);
                return SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].id;
              })}
            >
              <Icon name="adjust" color="#FFFFFF" size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.search}>
            <Icon name="search" color="#94A3B8" size={21} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="이벤트명, 장소, 아티스트 검색"
              returnKeyType="search"
              onSubmitEditing={() => loadEvents()}
            />
            <TouchableOpacity style={styles.searchButton} onPress={() => loadEvents()} activeOpacity={0.86}>
              <Text style={styles.searchButtonText}>검색</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.categoryStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {CATEGORIES.map((item) => {
              const active = selectedCategory === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.categoryItem}
                  onPress={() => setSelectedCategory(item.id)}
                  activeOpacity={0.84}
                >
                  <View style={[styles.categoryIcon, active && styles.categoryIconActive]}>
                    <Icon name={item.icon} color={active ? '#FFFFFF' : '#64748B'} size={21} />
                  </View>
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.smartRow}>
          {STATUS_FILTERS.map((item) => {
            const active = selectedSmart === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.smartChip, active && styles.smartActive]}
                onPress={() => setSelectedSmart(item.id)}
                activeOpacity={0.84}
              >
                <Text style={[styles.smartText, active && styles.smartActiveText]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.resultRow}>
          <Text style={styles.resultText}>검색 결과 <Text style={styles.resultStrong}>{visibleEvents.length}건</Text></Text>
          <TouchableOpacity
            style={styles.sortChip}
            activeOpacity={0.84}
            onPress={() => setSelectedSort((current) => {
              const idx = SORT_OPTIONS.findIndex((o) => o.id === current);
              return SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].id;
            })}
          >
            <Text style={styles.sortText}>{SORT_OPTIONS.find((o) => o.id === selectedSort)?.label ?? '가까운 일정순'}</Text>
            <Icon name="chevron" size={14} color="#475569" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroZone}>
          <LinearGradient
            colors={['#1A1A2E', '#534AB7', '#1D9E75']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featuredHero}
          >
            <View style={styles.posterLine}>
              <LinearGradient colors={['#712B13', '#D85A30', '#EF9F27']} style={styles.miniPoster} />
              <LinearGradient colors={['#0C447C', '#185FA5', '#639922']} style={styles.miniPoster} />
              <LinearGradient colors={['#2C2C2A', '#5F5E5A', '#534AB7']} style={styles.miniPoster} />
            </View>
            <View style={styles.heroOverlay} />
            <Text style={styles.heroBadge}>공식 이벤트 탐색</Text>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>검증된 티켓 이벤트를{'\n'}빠르게 찾아보세요</Text>
              <View style={styles.heroMetaLine}>
                <Icon name="shield" color="rgba(255,255,255,0.78)" size={14} />
                <Text style={styles.heroMeta}>구매와 양도 이력이 기록되는 공식 티켓</Text>
              </View>
              <View style={styles.heroMetaLine}>
                <Icon name="sparkle" color="rgba(255,255,255,0.78)" size={14} />
                <Text style={styles.heroMeta}>이번 주 추천 이벤트와 마감 임박 티켓을 확인하세요</Text>
              </View>
              <View style={styles.heroBottom}>
                <Text style={styles.heroPrice}>{priceLabel(visibleEvents[0]?.ticketPriceWei)}~</Text>
                <Text style={styles.heroAction}>추천 보기</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {loading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color="#534AB7" />
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionTitle}>마감 임박</Text>
                <Text style={styles.sectionSub}>놓치기 쉬운 티켓</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotRow}>
              {hotEvents.length ? hotEvents.map((event, index) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.hotCard}
                  onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                  activeOpacity={0.86}
                >
                  <PosterArt event={event} index={index} compact />
                  <View style={styles.hotBody}>
                    <Text style={styles.hotName} numberOfLines={2}>{eventName(event)}</Text>
                    <Text style={styles.hotDate} numberOfLines={1}>{formatNextRoundLabel(event)}</Text>
                    <Text style={styles.hotPrice}>{priceLabel(event.ticketPriceWei)}~</Text>
                  </View>
                </TouchableOpacity>
              )) : <Text style={styles.emptyInline}>마감 임박 이벤트가 없습니다.</Text>}
            </ScrollView>

            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionTitle}>전체 이벤트</Text>
                <Text style={styles.sectionSub}>예매 가능한 이벤트 우선</Text>
              </View>
            </View>

            <View style={styles.eventList}>
              {visibleEvents.length ? visibleEvents.map((event, index) => {
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.eventCard}
                    onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                    activeOpacity={0.86}
                  >
                    <PosterArt event={event} index={index} />
                    <View style={styles.eventInfo}>
                      <View style={styles.infoTop}>
                        <Text style={styles.label}>{formatEventCategory(event.category)}</Text>
                        <Text style={styles.state}>예매 가능</Text>
                      </View>
                      <Text style={styles.eventName} numberOfLines={2}>{eventName(event)}</Text>
                      <View style={styles.meta}>
                        <Icon name="map" color="#64748B" size={14} />
                        <Text style={styles.metaText} numberOfLines={1}>{eventVenue(event)}</Text>
                      </View>
                      <View style={styles.meta}>
                        <Icon name="calendar" color="#64748B" size={14} />
                        <Text style={styles.metaText} numberOfLines={1}>{formatNextRoundLabel(event)}</Text>
                      </View>
                      <View style={styles.eventBottom}>
                        <Text style={styles.price}>{priceLabel(event.ticketPriceWei)}~</Text>
                        <View style={styles.goRow}>
                          <Text style={styles.goText}>상세 보기</Text>
                          <Icon name="chevron" size={14} color="#534AB7" />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }) : <Text style={styles.empty}>조건에 맞는 이벤트가 없습니다.</Text>}
            </View>
          </>
        )}

        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Icon name="shield" color="#A89CF7" size={22} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>블록체인 검증 티켓</Text>
            <Text style={styles.noticeSub}>구매와 양도 이력이 투명하게 기록되어 위조 티켓 위험을 줄입니다.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  screen: { flex: 1 },
  content: { paddingBottom: 118 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 11,
    backgroundColor: 'rgba(246,247,251,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 21, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  search: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingLeft: 13,
    paddingRight: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    ...shadow,
  },
  searchInput: { flex: 1, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, color: '#0F172A', fontSize: 14, backgroundColor: 'transparent' },
  searchButton: { borderRadius: 14, backgroundColor: '#534AB7', paddingHorizontal: 14, paddingVertical: 10 },
  searchButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  categoryStrip: { paddingTop: 13, paddingBottom: 8 },
  categoryRow: { gap: 10, paddingHorizontal: 16 },
  categoryItem: { width: 62, flexShrink: 0, alignItems: 'center', gap: 6 },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  categoryIconActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  categoryText: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  categoryTextActive: { color: '#0F172A' },
  smartRow: { gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  smartChip: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  smartActive: { backgroundColor: '#EEEDFE', borderColor: '#D8D4FF' },
  smartDark: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  smartText: { fontSize: 12, fontWeight: '900', color: '#475569' },
  smartActiveText: { color: '#534AB7' },
  smartDarkText: { color: '#FFFFFF' },
  resultRow: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultText: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  resultStrong: { color: '#0F172A', fontWeight: '900' },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sortText: { fontSize: 12, fontWeight: '900', color: '#475569' },
  heroZone: { paddingHorizontal: 16, paddingBottom: 16 },
  featuredHero: { height: 210, borderRadius: 28, overflow: 'hidden', position: 'relative', ...shadow },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  posterLine: { position: 'absolute', top: 18, right: -18, flexDirection: 'row', gap: 8, transform: [{ rotate: '8deg' }], opacity: 0.78 },
  miniPoster: { width: 62, height: 88, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    color: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
  heroBody: { position: 'absolute', left: 17, right: 17, bottom: 17, zIndex: 2 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', lineHeight: 28, letterSpacing: 0, marginBottom: 9 },
  heroMetaLine: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2 },
  heroMeta: { flex: 1, color: 'rgba(255,255,255,0.74)', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  heroBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroPrice: { backgroundColor: '#FFFFFF', color: '#0F172A', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontWeight: '900', overflow: 'hidden' },
  heroAction: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  centerBlock: { paddingVertical: 54, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  sectionSub: { fontSize: 11, fontWeight: '800', color: '#94A3B8', marginTop: 3 },
  hotRow: { gap: 12, paddingHorizontal: 16, paddingBottom: 18 },
  hotCard: { width: 150, flexShrink: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, overflow: 'hidden', ...shadow },
  hotImage: { height: 112, position: 'relative', overflow: 'hidden' },
  hotBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    zIndex: 2,
    minHeight: 23,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
  hotBadgeDeadline: { backgroundColor: '#EF4444', color: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  hotBadgeSale: { backgroundColor: '#DCFCE7', color: '#0F6E56', borderWidth: 1, borderColor: '#BBF7D0' },
  hotBadgeDefault: { backgroundColor: 'rgba(15,23,42,0.72)', color: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  hotBody: { padding: 10 },
  hotName: { fontSize: 13, fontWeight: '900', color: '#0F172A', lineHeight: 17, marginBottom: 4 },
  hotDate: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  hotPrice: { fontSize: 12, fontWeight: '900', color: '#534AB7', marginTop: 7 },
  eventList: { paddingHorizontal: 16, gap: 13 },
  eventCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 12, flexDirection: 'row', gap: 12, ...shadow },
  disabledEvent: { opacity: 0.52 },
  poster: { width: 102, height: 136, borderRadius: 19, position: 'relative', overflow: 'hidden', flexShrink: 0 },
  posterBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 8,
    fontWeight: '900',
    overflow: 'hidden',
  },
  posterBadgeDeadline: { backgroundColor: '#EF4444', color: '#FFFFFF' },
  posterBadgeSale: { backgroundColor: '#DCFCE7', color: '#0F6E56' },
  posterBadgeDefault: { backgroundColor: 'rgba(0,0,0,0.42)', color: '#FFFFFF' },
  posterTitle: { position: 'absolute', left: 10, right: 10, bottom: 10, zIndex: 2, color: '#FFFFFF', fontSize: 12, fontWeight: '900', lineHeight: 15 },
  eventInfo: { flex: 1, minWidth: 0, paddingVertical: 2 },
  infoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 },
  label: { fontSize: 10, fontWeight: '900', color: '#534AB7', backgroundColor: '#EEEDFE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  state: { fontSize: 10, fontWeight: '900', color: '#0F6E56', backgroundColor: '#E1F5EE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  eventName: { fontSize: 16, fontWeight: '900', color: '#0F172A', lineHeight: 20, marginBottom: 9, letterSpacing: 0 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  metaText: { flex: 1, color: '#64748B', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  eventBottom: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  price: { flex: 1, fontSize: 14, fontWeight: '900', color: '#0F172A' },
  goRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  goText: { fontSize: 12, fontWeight: '900', color: '#534AB7' },
  empty: { textAlign: 'center', color: '#94A3B8', paddingVertical: 52, fontWeight: '800' },
  emptyInline: { color: '#94A3B8', paddingVertical: 28, fontWeight: '800' },
  notice: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#1A1A2E', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', gap: 12, alignItems: 'center' },
  noticeIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(168,156,247,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  noticeSub: { fontSize: 10, color: 'rgba(255,255,255,0.58)', lineHeight: 14, fontWeight: '700' },
});
