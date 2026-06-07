import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  EntryEmpty,
  EntryEventCard,
  EntryHero,
  EntrySectionHead,
  EntrySummary,
  EntryTopBar,
  entryColors,
  entryStyles,
} from '../components/EntryScheduleKit';
import { TextInput } from '../components/TextInput';
import { TicketIcon } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import {
  buildEntrySchedules,
  entryTicketStats,
  type EntrySchedule,
  type EntryScheduleState,
  scheduleKey,
  scheduleState,
  scheduleStateLabel,
  scheduleTitle,
} from '../lib/entrySchedule';
import type { TicketDetail } from '../types/api';

const PAGE_SIZE = 8;
const FILTERS: { key: 'all' | EntryScheduleState; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'today', label: '오늘' },
  { key: 'upcoming', label: '예정' },
  { key: 'ended', label: '종료' },
];

export default function CheckInEventListPage({ navigation, route }: any) {
  const routeFilter = route?.params?.filter as 'all' | EntryScheduleState | undefined;
  const [schedules, setSchedules] = useState<EntrySchedule[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | EntryScheduleState>(routeFilter ?? 'all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await backendApi.getMyEvents({ page: 0, size: 100 });
      const events = (response.items ?? []).filter((event) => ['PUBLISHED', 'ACTIVE'].includes(String(event.status).toUpperCase()));
      const loaded = await Promise.all(events.map(async (event) => ({
        event,
        tickets: await backendApi.getEventTickets(event.id).catch(() => [] as TicketDetail[]),
      })));
      setSchedules(loaded.flatMap(({ event, tickets }) => buildEntrySchedules(event, tickets)));
      setPage(1);
    } catch (error: any) {
      Alert.alert('전체 일정 로드 실패', errorMessage(error, '전체 입장 일정을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = useMemo(() => ({
    today: schedules.filter((schedule) => scheduleState(schedule) === 'today').length,
    upcoming: schedules.filter((schedule) => scheduleState(schedule) === 'upcoming').length,
    ended: schedules.filter((schedule) => scheduleState(schedule) === 'ended').length,
  }), [schedules]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return schedules
      .filter((schedule) => filter === 'all' || scheduleState(schedule) === filter)
      .filter((schedule) => !normalized || `${scheduleTitle(schedule)} ${schedule.event.venue || ''}`.toLowerCase().includes(normalized))
      .sort((a, b) => scheduleState(a) === 'ended' ? b.endTime - a.endTime : a.startTime - b.startTime);
  }, [filter, query, schedules]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const resetFilters = () => { setFilter('all'); setQuery(''); setPage(1); };

  if (loading) {
    return <View style={entryStyles.center}><ActivityIndicator size="large" color={entryColors.purple} /><Text style={entryStyles.centerText}>전체 일정을 불러오고 있습니다.</Text></View>;
  }

  return (
    <ScrollView
      style={entryStyles.screen}
      contentContainerStyle={entryStyles.content}
      stickyHeaderIndices={[0]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <EntryTopBar eyebrow="Entry Schedule" title="전체 일정 관리" back onBack={() => navigation.goBack()} rightIcon="adjustments" rightLabel="필터 초기화" onRight={resetFilters} />
      <EntryHero badge="전체 일정" title={'입장 일정을\n상태별로 확인하세요.'} subtitle="오늘, 예정, 종료 이벤트를 검색하고 입장 관리 화면으로 이동합니다." />

      <View style={entryStyles.section}>
        <View style={styles.search}>
          <TicketIcon name="search" color="#94A3B8" size={17} />
          <TextInput style={styles.searchInput} value={query} onChangeText={(value) => { setQuery(value); setPage(1); }} placeholder="이벤트명, 장소 검색" returnKeyType="search" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity key={item.key} style={[styles.filter, active && styles.filterActive]} onPress={() => { setFilter(item.key); setPage(1); }}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={entryStyles.section}>
        <EntrySummary items={[{ label: '오늘', value: counts.today }, { label: '예정', value: counts.upcoming }, { label: '종료', value: counts.ended }]} />
      </View>

      <View style={entryStyles.section}>
        <EntrySectionHead title="일정 목록" subtitle="많아지면 페이지 단위로 표시합니다." action={`${currentPage} / ${totalPages}`} />
        {visible.length === 0 ? (
          <EntryEmpty title="조건에 맞는 입장 일정이 없습니다." action="필터 초기화" onAction={resetFilters} />
        ) : (
          <View style={styles.list}>
            {visible.map((schedule) => {
              const stats = entryTicketStats(schedule.tickets);
              return (
                <EntryEventCard
                  key={scheduleKey(schedule)}
                  schedule={schedule}
                  meta={`${scheduleStateLabel(schedule)} · 티켓 ${stats.total}장 · 입장 ${stats.entered}명\n${schedule.event.venue || '장소 미정'}`}
                  onPress={() => navigation.navigate('CheckInManage', { eventId: schedule.event.id, roundId: schedule.roundId })}
                />
              );
            })}
          </View>
        )}
      </View>

      {totalPages > 1 ? (
        <View style={styles.pagination}>
          <TouchableOpacity style={[styles.pageButton, currentPage === 1 && styles.pageDisabled]} disabled={currentPage === 1} onPress={() => setPage((value) => Math.max(1, value - 1))}>
            <Text style={styles.pageText}>이전</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pageButton, currentPage === totalPages && styles.pageDisabled]} disabled={currentPage === totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))}>
            <Text style={styles.pageText}>다음</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  search: { height: 46, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, shadowColor: '#0F172A', shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 1 },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 13, paddingVertical: 0 },
  filters: { gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  filter: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  list: { gap: 10 },
  pagination: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingBottom: 14 },
  pageButton: { flex: 1, height: 42, borderRadius: 15, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  pageDisabled: { opacity: 0.35 },
  pageText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
