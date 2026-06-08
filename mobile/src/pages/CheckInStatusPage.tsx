import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  EntryEmpty,
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
import { resolveImageUrl } from '../lib/config';
import { checkInResult, ticketId } from '../lib/entrySchedule';
import type { CheckInRecord, EventDetail, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;
const FILTERS = [
  { key: 'all' as const, label: '전체' },
  { key: 'success' as const, label: '입장 완료' },
  { key: 'failed' as const, label: '입장 실패' },
  { key: 'manual' as const, label: '수동 확인' },
];
type Filter = (typeof FILTERS)[number]['key'];

function recordLabel(record: CheckInRecord) {
  const result = checkInResult(record);
  if (result === 'SUCCESS') return '입장 완료';
  if (result === 'FAILED') return '입장 실패';
  return '수동 확인';
}

function recordTone(record: CheckInRecord) {
  const result = checkInResult(record);
  return result === 'SUCCESS'
    ? { bg: '#DCFCE7', text: '#0F6E56' }
    : result === 'FAILED'
      ? { bg: '#FEE2E2', text: '#B91C1C' }
      : { bg: '#FFF7ED', text: '#A16207' };
}

function formatTime(record: CheckInRecord) {
  const date = new Date(record.checkedInAt || record.createdAt || '');
  return Number.isNaN(date.getTime()) ? '시간 미정' : date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadHistories(tickets: TicketDetail[]) {
  const histories: CheckInRecord[] = [];
  for (let index = 0; index < tickets.length; index += 25) {
    const chunk = tickets.slice(index, index + 25);
    const result = await Promise.all(chunk.map((ticket) => backendApi.getTicketCheckIns(ticketId(ticket)).catch(() => [] as CheckInRecord[])));
    histories.push(...result.flat());
  }
  return histories;
}

export default function CheckInStatusPage({ navigation, route }: any) {
  const eventId = String(route?.params?.eventId ?? '');
  const roundId = route?.params?.roundId != null ? String(route.params.roundId) : undefined;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [allTickets, eventDetail] = await Promise.all([
        backendApi.getEventTickets(eventId).catch(() => [] as TicketDetail[]),
        backendApi.getEvent(eventId).catch(() => null),
      ]);
      const scoped = roundId ? allTickets.filter((ticket) => String(ticket.eventRoundId ?? '') === roundId) : allTickets;
      const histories = await loadHistories(scoped);
      setEvent(eventDetail);
      setTickets(scoped);
      setRecords(histories.flat());
      setPage(1);
    } catch (error: any) {
      Alert.alert('입장 현황 로드 실패', errorMessage(error, '입장 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, roundId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const successRecords = records.filter((record) => checkInResult(record) === 'SUCCESS');
  const failure = records.filter((record) => checkInResult(record) === 'FAILED').length;
  const enteredIds = new Set(successRecords.map((record) => String(record.ticketId ?? '')));
  const entered = Math.max(enteredIds.size, tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length);
  const pending = Math.max(tickets.length - entered, 0);
  const ticketMap = useMemo(() => new Map(tickets.map((ticket) => [ticketId(ticket), ticket])), [tickets]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records
      .filter((record) => {
        const result = checkInResult(record);
        const filterMatch = filter === 'all'
          || (filter === 'success' && result === 'SUCCESS')
          || (filter === 'failed' && result === 'FAILED')
          || (filter === 'manual' && result !== 'SUCCESS' && result !== 'FAILED');
        const raw = record as CheckInRecord & Record<string, unknown>;
        const ticket = ticketMap.get(String(record.ticketId ?? ''));
        const owner = ticket?.ownerWalletAddress || ticket?.ownerAddress || raw.claimedOwner || '';
        const queryTarget = `${record.ticketId ?? ''} ${owner} ${record.memo ?? ''}`.toLowerCase();
        return filterMatch && (!normalized || queryTarget.includes(normalized));
      })
      .sort((a, b) => new Date(b.checkedInAt || b.createdAt || '').getTime() - new Date(a.checkedInAt || a.createdAt || '').getTime());
  }, [filter, query, records, ticketMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const exportRecords = async () => {
    if (records.length === 0) {
      Alert.alert('내보낼 기록 없음', '아직 입장 기록이 없습니다.');
      return;
    }
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = ['ticketId,result,checkedInAt,memo', ...records.map((record) => [record.ticketId, checkInResult(record), record.checkedInAt || record.createdAt, record.memo].map(escape).join(','))].join('\n');
    try {
      if (Platform.OS === 'web') {
        const web = globalThis as any;
        const blob = new web.Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
        const url = web.URL.createObjectURL(blob);
        const link = web.document.createElement('a');
        link.href = url;
        link.download = 'entry-status.csv';
        link.click();
        web.URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: '입장 현황', message: csv });
      }
    } catch (error: any) {
      Alert.alert('내보내기 실패', errorMessage(error, '입장 기록을 내보내지 못했습니다.'));
    }
  };

  if (loading) {
    return <View style={entryStyles.center}><ActivityIndicator size="large" color={entryColors.purple} /><Text style={entryStyles.centerText}>입장 현황을 불러오고 있습니다.</Text></View>;
  }

  return (
    <ScrollView
      style={entryStyles.screen}
      contentContainerStyle={entryStyles.content}
      stickyHeaderIndices={[0]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <EntryTopBar eyebrow="Entry Status" title="입장 현황" back onBack={() => navigation.goBack()} rightIcon="download" rightLabel="입장 기록 내보내기" onRight={() => void exportRecords()} />
      <EntryHero badge="입장 현황" title={'최근 입장 기록을\n확인하세요.'} subtitle="성공, 실패, 미입장 상태를 기준으로 검증 이력을 추적합니다." imageUrl={resolveImageUrl(event?.imageUrl)} />

      <View style={entryStyles.section}>
        <EntrySummary items={[{ label: '성공', value: entered }, { label: '실패', value: failure }, { label: '미입장', value: pending }]} />
      </View>

      <View style={entryStyles.section}>
        <View style={styles.search}>
          <TicketIcon name="search" color="#94A3B8" size={17} />
          <TextInput style={styles.searchInput} value={query} onChangeText={(value) => { setQuery(value); setPage(1); }} placeholder="티켓 ID, 지갑 주소 검색" returnKeyType="search" />
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
        <EntrySectionHead title="최근 입장 기록" subtitle="최신순으로 표시됩니다." action={`${currentPage} / ${totalPages}`} />
        {visible.length === 0 ? (
          <EntryEmpty
            title={records.length === 0 ? '아직 입장 기록이 없습니다.' : '검색 조건에 맞는 입장 기록이 없습니다.'}
            action="QR 스캔 시작"
            onAction={() => navigation.navigate('CheckInScan', { eventId, roundId })}
          />
        ) : (
          <View style={styles.list}>
            {visible.map((record, index) => {
              const tone = recordTone(record);
              const raw = record as CheckInRecord & Record<string, unknown>;
              const ticket = ticketMap.get(String(record.ticketId ?? ''));
              const owner = ticket?.ownerWalletAddress || ticket?.ownerAddress || raw.claimedOwner;
              return (
                <View key={String(record.id ?? `${record.ticketId}-${index}`)} style={[entryStyles.card, styles.record]}>
                  <View style={styles.recordTop}>
                    <Text style={[styles.badge, { color: tone.text, backgroundColor: tone.bg }]}>{recordLabel(record)}</Text>
                    <Text style={styles.time}>{formatTime(record)}</Text>
                  </View>
                  <Text style={styles.ticket}>티켓 {record.ticketId || '-'}</Text>
                  {owner ? <Text style={styles.detail}>지갑 {String(owner)}</Text> : null}
                  {record.memo ? <Text style={styles.detail}>{record.memo}</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {totalPages > 1 ? (
        <View style={styles.pagination}>
          <TouchableOpacity style={[styles.pageButton, currentPage === 1 && styles.disabled]} disabled={currentPage === 1} onPress={() => setPage((value) => Math.max(1, value - 1))}><Text style={styles.pageText}>이전</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.pageButton, currentPage === totalPages && styles.disabled]} disabled={currentPage === totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))}><Text style={styles.pageText}>다음</Text></TouchableOpacity>
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
  record: { padding: 14 },
  recordTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { borderRadius: 999, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6, fontSize: 10, fontWeight: '900' },
  time: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  ticket: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  detail: { color: '#64748B', fontSize: 10, lineHeight: 15, marginTop: 4 },
  pagination: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingBottom: 14 },
  pageButton: { flex: 1, height: 42, borderRadius: 15, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  pageText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
