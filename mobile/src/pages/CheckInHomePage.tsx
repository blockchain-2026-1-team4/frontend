import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  EntryEmpty,
  EntryEventCard,
  EntryHero,
  EntrySectionHead,
  EntryTopBar,
  entryColors,
  entryStyles,
} from '../components/EntryScheduleKit';
import { flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import {
  buildEntrySchedules,
  entryTicketStats,
  type EntrySchedule,
  type EntryScheduleState,
  scheduleDateParts,
  scheduleKey,
  scheduleState,
  scheduleStatusBadge,
} from '../lib/entrySchedule';
import type { TicketDetail } from '../types/api';

const SEGMENTS: { key: EntryScheduleState; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'upcoming', label: '예정' },
  { key: 'ended', label: '종료' },
];

export default function CheckInHomePage({ navigation }: any) {
  const [schedules, setSchedules] = useState<EntrySchedule[]>([]);
  const [active, setActive] = useState<EntryScheduleState>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await backendApi.getMyEvents({ page: 0, size: 100 });
      const events = (page.items ?? []).filter((event) => ['PUBLISHED', 'ACTIVE'].includes(String(event.status).toUpperCase()));
      const loaded = await Promise.all(events.map(async (event) => ({
        event,
        tickets: await backendApi.getEventTickets(event.id).catch(() => [] as TicketDetail[]),
      })));
      setSchedules(loaded.flatMap(({ event, tickets }) => buildEntrySchedules(event, tickets)));
    } catch (error: any) {
      Alert.alert('일정 관리 로드 실패', errorMessage(error, '입장 운영 일정을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const grouped = useMemo(() => {
    const groups: Record<EntryScheduleState, EntrySchedule[]> = { today: [], upcoming: [], ended: [] };
    schedules.forEach((schedule) => groups[scheduleState(schedule)].push(schedule));
    groups.today.sort((a, b) => a.startTime - b.startTime);
    groups.upcoming.sort((a, b) => a.startTime - b.startTime);
    groups.ended.sort((a, b) => b.endTime - a.endTime);
    return groups;
  }, [schedules]);

  const selected = grouped[active];
  const selectedLabel = SEGMENTS.find((segment) => segment.key === active)?.label ?? '오늘';
  const goManage = (schedule: EntrySchedule) => navigation.navigate('CheckInManage', { eventId: schedule.event.id, roundId: schedule.roundId });

  if (loading) {
    return <View style={entryStyles.center}><ActivityIndicator size="large" color={entryColors.purple} /><Text style={entryStyles.centerText}>일정 관리 화면을 준비하고 있습니다.</Text></View>;
  }

  return (
    <ScrollView
      style={entryStyles.screen}
      contentContainerStyle={entryStyles.content}
      stickyHeaderIndices={[0]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <EntryTopBar eyebrow="Entry Operations" title="일정 관리" rightIcon="category" rightLabel="전체 일정" onRight={() => navigation.navigate('CheckInEventList')} />
      <EntryHero
        badge="입장 운영"
        title={'오늘, 예정, 종료 일정을\n구분해서 관리하세요.'}
        subtitle="오늘 공연은 종료 전까지 QR 검증 화면으로 이동할 수 있습니다."
      />

      <View style={styles.segment}>
        {SEGMENTS.map((segment) => {
          const selectedSegment = active === segment.key;
          return (
            <TouchableOpacity key={segment.key} style={[styles.segmentButton, selectedSegment && styles.segmentButtonActive]} onPress={() => setActive(segment.key)}>
              <Text style={[styles.segmentText, selectedSegment && styles.segmentTextActive]}>{segment.label}</Text>
              <Text style={styles.count}>{grouped[segment.key].length}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={entryStyles.section}>
        <EntrySectionHead
          title={`${selectedLabel} 입장 일정`}
          subtitle={`${selected.length}개의 입장 운영 일정`}
          action="전체 일정"
          onAction={() => navigation.navigate('CheckInEventList', { filter: active })}
        />
        {selected.length === 0 ? (
          <EntryEmpty title={`${selectedLabel} 입장 일정이 없습니다.`} action="전체 일정 보기" onAction={() => navigation.navigate('CheckInEventList')} />
        ) : (
          <View style={styles.list}>
            {selected.map((schedule) => {
              const stats = entryTicketStats(schedule.tickets);
              const date = scheduleDateParts(schedule);
              return (
                <EntryEventCard
                  key={scheduleKey(schedule)}
                  schedule={schedule}
                  meta={`${scheduleStatusBadge(schedule).label} · ${schedule.event.venue || '장소 미정'} · ${date.time} · 입장 ${stats.entered}/${stats.total}`}
                  actionLabel={active === 'ended' ? '현황' : '관리'}
                  onPress={() => active === 'ended'
                    ? navigation.navigate('CheckInStatus', { eventId: schedule.event.id, roundId: schedule.roundId })
                    : goManage(schedule)}
                />
              );
            })}
          </View>
        )}
      </View>

      {active === 'today' && grouped.upcoming.length > 0 ? (
        <View style={entryStyles.section}>
          <EntrySectionHead title="예정 일정" subtitle="가장 가까운 일정만 표시합니다." action="더 보기" onAction={() => navigation.navigate('CheckInEventList', { filter: 'upcoming' })} />
          <View style={styles.list}>
            {grouped.upcoming.slice(0, 2).map((schedule) => {
              const date = scheduleDateParts(schedule);
              return <EntryEventCard key={scheduleKey(schedule)} schedule={schedule} meta={`${scheduleStatusBadge(schedule).label} · ${schedule.event.venue || '장소 미정'} · ${date.time}`} onPress={() => goManage(schedule)} />;
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: 8, marginHorizontal: 12, marginBottom: 16, padding: 6, borderRadius: 22, backgroundColor: '#EEF1F7' },
  segmentButton: { flex: 1, height: 44, borderRadius: 17, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  segmentButtonActive: { backgroundColor: '#FFFFFF', ...flowShadow },
  segmentText: { color: '#64748B', fontWeight: '900', fontSize: 12 },
  segmentTextActive: { color: '#1A1A2E' },
  count: { color: '#534AB7', backgroundColor: '#EEEDFE', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, fontSize: 10, fontWeight: '900' },
  list: { gap: 10 },
});
