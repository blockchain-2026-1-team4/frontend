import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  OrganizerEmpty,
  OrganizerHero,
  OrganizerSectionHead,
  OrganizerTopBar,
  organizerColors,
  organizerTabStyles,
} from '../components/OrganizerTabKit';
import { FlowBadge, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, TicketDetail } from '../types/api';

type CheckInEvent = { event: EventSummary; tickets: TicketDetail[] };
type SectionKey = 'today' | 'upcoming' | 'ended';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'upcoming', label: '예정' },
  { key: 'ended', label: '종료' },
];

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

function formatDate(event: EventSummary) {
  const time = getNextRoundTime(event);
  const date = Number.isNaN(time) ? null : new Date(time);
  return {
    month: date ? date.toLocaleString('en-US', { month: 'short' }).toUpperCase() : '--',
    day: date ? String(date.getDate()).padStart(2, '0') : '--',
    time: date ? date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '시간 미정',
  };
}

export default function CheckInHomePage({ navigation }: any) {
  const [items, setItems] = useState<CheckInEvent[]>([]);
  const [activeSection, setActiveSection] = useState<SectionKey>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await backendApi.getMyEvents({ page: 0, size: 100 });
      const events = (page.items ?? []).filter((event) => String(event.status).toUpperCase() === 'PUBLISHED');
      const withTickets = await Promise.all(events.map(async (event) => ({ event, tickets: await backendApi.getEventTickets(event.id).catch(() => []) })));
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

  const selectedItems = grouped[activeSection];
  const activeLabel = SECTIONS.find((section) => section.key === activeSection)?.label ?? '오늘';
  const openFirstEvent = () => {
    const first = grouped.today[0] ?? grouped.upcoming[0];
    if (first) navigation.navigate('CheckInManage', { eventId: first.event.id });
    else navigation.navigate('CheckInEventList', { section: '오늘 일정' });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={organizerColors.purple} />
        <Text style={styles.loadingText}>체크인 운영 화면을 준비하고 있습니다.</Text>
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
      <OrganizerTopBar eyebrow="Check-in Operations" title="체크인 허브" rightIcon="qr" rightLabel="QR 체크인" onRightPress={openFirstEvent} />
      <OrganizerHero
        badge="입장 운영"
        title={'오늘, 예정, 종료 일정을\n구분해서 관리하세요.'}
        meta="오늘 공연은 종료 전까지 QR 검증 화면으로 이동할 수 있습니다."
      />

      <View style={styles.tabs}>
        {SECTIONS.map((section) => {
          const active = section.key === activeSection;
          return (
            <TouchableOpacity key={section.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveSection(section.key)}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{section.label}</Text>
              <Text style={[styles.tabCount, active && styles.tabCountActive]}>{grouped[section.key].length}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <OrganizerSectionHead
        title={`${activeLabel} 일정`}
        subtitle={`${selectedItems.length}개의 체크인 운영 일정`}
        actionLabel="전체 목록"
        onAction={() => navigation.navigate('CheckInEventList', { section: `${activeLabel} 일정` })}
      />

      {selectedItems.length === 0 ? (
        <OrganizerEmpty title={`${activeLabel} 체크인 일정이 없습니다.`} actionLabel="전체 일정 보기" onAction={() => navigation.navigate('CheckInEventList')} />
      ) : selectedItems.map((item) => (
        <CheckInCard
          key={item.event.id}
          item={item}
          ended={activeSection === 'ended'}
          onPress={() => navigation.navigate(activeSection === 'ended' ? 'CheckInStatus' : 'CheckInManage', { eventId: item.event.id })}
        />
      ))}
    </ScrollView>
  );
}

function CheckInCard({ item, ended, onPress }: { item: CheckInEvent; ended: boolean; onPress: () => void }) {
  const date = formatDate(item.event);
  const missing = ticketCount(item) === 0;
  return (
    <TouchableOpacity style={styles.eventCard} onPress={onPress}>
      <View style={styles.dateBox}>
        <Text style={styles.dateMonth}>{date.month}</Text>
        <Text style={styles.dateDay}>{date.day}</Text>
      </View>
      <View style={styles.eventCopy}>
        <View style={styles.eventTop}>
          <Text style={styles.eventName} numberOfLines={1}>{eventTitle(item.event)}</Text>
          <FlowBadge label={ended ? '종료' : missing ? '미발행' : '체크인 가능'} tone={ended ? 'gray' : missing ? 'yellow' : 'green'} />
        </View>
        <Text style={styles.eventMeta} numberOfLines={1}>{item.event.venue || '장소 미정'} · {date.time}</Text>
        <View style={styles.eventAction}>
          <TicketIcon name={ended ? 'list' : 'qr'} color={ended ? '#64748B' : organizerColors.purple} size={16} />
          <Text style={[styles.eventActionText, ended && styles.eventActionTextEnded]}>{ended ? '체크인 결과 보기' : '체크인 운영 열기'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: organizerColors.background },
  loadingText: { marginTop: 12, color: organizerColors.muted, fontSize: 14 },
  tabs: { marginHorizontal: 16, marginBottom: 4, padding: 5, borderRadius: 18, flexDirection: 'row', gap: 5, backgroundColor: '#EDEEF5' },
  tab: { flex: 1, minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  tabActive: { backgroundColor: '#FFFFFF', ...flowShadow },
  tabLabel: { color: '#6B7280', fontSize: 12, fontWeight: '900' },
  tabLabelActive: { color: organizerColors.ink },
  tabCount: { minWidth: 21, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', textAlign: 'center', color: '#6B7280', backgroundColor: '#DDE0E9', fontSize: 10, fontWeight: '900' },
  tabCountActive: { color: organizerColors.purple, backgroundColor: '#EEEDFE' },
  eventCard: { marginHorizontal: 16, marginBottom: 12, padding: 14, minHeight: 116, flexDirection: 'row', gap: 13, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: organizerColors.border, ...flowShadow },
  dateBox: { width: 58, height: 72, borderRadius: 18, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  dateMonth: { color: organizerColors.purple, fontSize: 9, fontWeight: '900' },
  dateDay: { color: '#3C3489', fontSize: 24, fontWeight: '900', lineHeight: 28 },
  eventCopy: { flex: 1, minWidth: 0 },
  eventTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' },
  eventName: { flex: 1, color: organizerColors.ink, fontSize: 14, fontWeight: '900' },
  eventMeta: { color: organizerColors.muted, fontSize: 10, fontWeight: '700', marginTop: 5 },
  eventAction: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventActionText: { color: organizerColors.purple, fontSize: 11, fontWeight: '900' },
  eventActionTextEnded: { color: '#64748B' },
});
