import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  OrganizerEmpty,
  OrganizerFilterBar,
  OrganizerHero,
  OrganizerSearch,
  OrganizerSectionHead,
  OrganizerTopBar,
  organizerColors,
  organizerTabStyles,
} from '../components/OrganizerTabKit';
import { FlowBadge, PosterArt, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { formatEventCategory, getNextRoundTime, operationSortRank } from '../lib/ticketDisplay';
import type { EventSummary } from '../types/api';

type StatusFilter = 'all' | 'operating' | 'inactive' | 'ended' | 'cancelled';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'operating', label: '운영 중' },
  { key: 'inactive', label: '준비 중' },
  { key: 'ended', label: '종료' },
  { key: 'cancelled', label: '취소' },
];

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

function eventEnd(event: EventSummary) {
  return event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || '';
}

function eventStart(event: EventSummary) {
  const next = getNextRoundTime(event);
  if (!Number.isNaN(next)) return new Date(next);
  const fallback = new Date(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || '');
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function isEnded(event: EventSummary) {
  if (String(event.status ?? '').toUpperCase() === 'CANCELED') return false;
  const end = new Date(eventEnd(event)).getTime();
  return !Number.isNaN(end) && end < Date.now();
}

function isCancelled(event: EventSummary) {
  return String(event.status ?? '').toUpperCase() === 'CANCELED';
}

function eventBadge(event: EventSummary): { label: string; tone: 'green' | 'purple' | 'gray' | 'red' | 'yellow' } {
  const status = String(event.status ?? '').toUpperCase();
  if (isCancelled(event)) return { label: '취소', tone: 'red' };
  if (isEnded(event)) return { label: '종료', tone: 'gray' };
  if (status === 'ACTIVE') return { label: '운영 중', tone: 'green' };
  if (status === 'INACTIVE') return { label: '준비 중', tone: 'purple' };
  if (status === 'DRAFT') return { label: '초안', tone: 'gray' };
  return { label: status || '상태 없음', tone: 'yellow' };
}

function eventPosterUrl(event: EventSummary) {
  return resolveImageUrl(event.imageUrl || (event as any).posterUrl || (event as any).posterImageUrl || (event as any).thumbnailUrl || (event as any).image);
}

function ticketSummary(event: EventSummary) {
  const sold = Number(event.soldTicketCount ?? 0);
  const total = Number(event.totalTicketCount ?? 0);
  return total > 0 ? `티켓 ${sold.toLocaleString()} / ${total.toLocaleString()}` : '티켓 미발행';
}

export default function MyEventsPage({ navigation }: any) {
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

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events
      .filter((event) => {
        const status = String(event.status ?? '').toUpperCase();
        if (statusFilter === 'operating') return status === 'ACTIVE' && !isEnded(event) && !isCancelled(event);
        if (statusFilter === 'inactive') return status === 'INACTIVE';
        if (statusFilter === 'ended') return isEnded(event);
        if (statusFilter === 'cancelled') return isCancelled(event);
        return true;
      })
      .filter((event) => !normalized || `${eventTitle(event)} ${event.venue || ''} ${formatEventCategory(event.category)}`.toLowerCase().includes(normalized))
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
        <ActivityIndicator size="large" color={organizerColors.purple} />
        <Text style={styles.loadingText}>내 이벤트를 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={organizerTabStyles.container}
      contentContainerStyle={organizerTabStyles.content}
      stickyHeaderIndices={[0]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <OrganizerTopBar eyebrow="My Events" title="내 이벤트" rightIcon="plus" rightLabel="새 이벤트 등록" onRightPress={() => navigation.navigate('EventCreate')} />
      <OrganizerHero
        badge="이벤트 관리"
        title={'등록한 이벤트를\n검색하고 운영하세요.'}
        meta="게시, 준비, 종료, 취소 상태별로 빠르게 확인할 수 있습니다."
      />
      <OrganizerSearch value={query} onChangeText={setQuery} placeholder="이벤트명, 장소, 카테고리 검색" />
      <OrganizerFilterBar items={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      <OrganizerSectionHead title={`이벤트 ${visibleEvents.length}건`} subtitle="운영 우선순위 및 일정순" actionLabel="최신순" onAction={() => setStatusFilter('all')} />

      {visibleEvents.length === 0 ? (
        <OrganizerEmpty title="표시할 이벤트가 없습니다." actionLabel="이벤트 등록" onAction={() => navigation.navigate('EventCreate')} />
      ) : visibleEvents.map((item, index) => (
        <EventCard key={item.id} event={item} index={index} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: item.id })} />
      ))}
    </ScrollView>
  );
}

function EventCard({ event, index, onPress }: { event: EventSummary; index: number; onPress: () => void }) {
  const title = eventTitle(event);
  const badge = eventBadge(event);
  const posterUrl = eventPosterUrl(event);
  const start = eventStart(event);
  const time = start ? start.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '일정 미정';

  return (
    <TouchableOpacity style={styles.eventCard} onPress={onPress}>
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
      ) : (
        <PosterArt title={title} variant={index} style={styles.poster} />
      )}
      <View style={styles.eventCopy}>
        <View style={styles.eventTop}>
          <FlowBadge label={badge.label} tone={badge.tone} />
          <Text style={styles.sortText}>최신순</Text>
        </View>
        <Text style={styles.eventName} numberOfLines={2}>{title}</Text>
        <Text style={styles.eventMeta} numberOfLines={1}>{event.venue || '장소 미정'} · {time}</Text>
        <View style={styles.ticketRow}>
          <TicketIcon name="ticket" color={organizerColors.purple} size={15} />
          <Text style={styles.ticketText}>{ticketSummary(event)}</Text>
        </View>
      </View>
      <TicketIcon name="chevron" color="#B4B2A9" size={17} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: organizerColors.background },
  loadingText: { marginTop: 12, color: organizerColors.muted, fontSize: 14 },
  eventCard: { minHeight: 116, marginHorizontal: 16, marginBottom: 12, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: organizerColors.border, ...flowShadow },
  poster: { width: 70, height: 88, borderRadius: 18 },
  eventCopy: { flex: 1, minWidth: 0 },
  eventTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sortText: { color: organizerColors.muted, fontSize: 9, fontWeight: '800' },
  eventName: { color: organizerColors.ink, fontSize: 14, fontWeight: '900', lineHeight: 18, marginTop: 7 },
  eventMeta: { color: organizerColors.muted, fontSize: 9, fontWeight: '700', marginTop: 4 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  ticketText: { color: organizerColors.purple, fontSize: 10, fontWeight: '900' },
});
