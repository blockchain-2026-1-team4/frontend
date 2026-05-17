import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { EventSummary } from '../types/api';

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

function eventDate(event: EventSummary) {
  const value = event.eventAt || event.eventDateTime;
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
  CANCELED: '취소',
};

export default function MyEventsPage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  const load = useCallback(async (targetPage = 0, append = false) => {
    try {
      const data = await backendApi.getMyEvents({ page: targetPage, size: 12 });
      setEvents((current) => (append ? [...current, ...(data.items ?? [])] : data.items ?? []));
      setPage(data.page ?? targetPage);
      setHasNext(data.hasNext ?? false);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '내 이벤트를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(0, false);
    }, [load]),
  );

  const refresh = () => {
    setRefreshing(true);
    void load(0, false);
  };

  const loadMore = () => {
    if (!hasNext || loading) return;
    void load(page + 1, true);
  };

  const renderItem = ({ item }: { item: EventSummary }) => {
    const sold = item.soldTicketCount ?? 0;
    const total = item.totalTicketCount ?? 0;
    const remaining = item.remainingTicketCount ?? Math.max(total - sold, 0);

    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: item.id })}>
        <View style={styles.cardHead}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.eventTitle}>{eventTitle(item)}</Text>
            <Text style={styles.eventMeta}>{item.venue} · {eventDate(item)}</Text>
          </View>
          <Text style={styles.statusBadge}>{STATUS_LABEL[item.status] ?? item.status}</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>판매</Text>
            <Text style={styles.statValue}>{sold}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>잔여</Text>
            <Text style={styles.statValue}>{remaining}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>전체</Text>
            <Text style={styles.statValue}>{total || '-'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && events.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>내 이벤트를 불러오고 있습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>My Events</Text>
          <Text style={styles.title}>내 이벤트</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('EventCreate')}>
          <Text style={styles.addButtonText}>등록</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.25}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>등록한 이벤트가 없습니다.</Text>
            <Text style={styles.emptyText}>첫 이벤트를 등록해 판매를 시작하세요.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('EventCreate')}>
              <Text style={styles.primaryButtonText}>이벤트 등록</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          hasNext ? (
            <TouchableOpacity style={styles.moreButton} onPress={loadMore}>
              <Text style={styles.moreButtonText}>더 보기</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  header: { padding: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  addButton: { backgroundColor: '#2563EB', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontWeight: '900' },
  list: { padding: 18, paddingTop: 8, paddingBottom: 32 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1 },
  eventTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  eventMeta: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 18 },
  statusBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statItem: { flex: 1, borderRadius: 12, backgroundColor: '#F8FAFC', padding: 10 },
  statLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  statValue: { marginTop: 4, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 8, color: '#64748B' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, marginTop: 18 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  moreButton: { padding: 14, alignItems: 'center' },
  moreButtonText: { color: '#2563EB', fontWeight: '900' },
});
