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
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate, formatEventStatus } from '../lib/ticketDisplay';
import type { EventSummary, TicketDetail } from '../types/api';

type RecentCheckInItem = {
  eventId: string;
  eventName: string;
  seatInfo: string;
  usedAt: string;
};

function eventTitle(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export default function CheckInHomePage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckInItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await backendApi.getMyEvents({ page: 0, size: 12 });
      const myEvents = page.items ?? [];
      const activeEvents = myEvents.filter((event) => event.status === 'ACTIVE');
      setEvents(activeEvents);

      const targetForHistory = activeEvents.slice(0, 5);
      const histories = await Promise.all(
        targetForHistory.map(async (event) => {
          const tickets = await backendApi.getEventTickets(event.id).catch(() => [] as TicketDetail[]);
          return tickets
            .filter((ticket) => ticket.status === 'USED' && ticket.usedAt)
            .map((ticket) => ({
              eventId: event.id,
              eventName: eventTitle(event),
              seatInfo: ticket.seatInfo || '-',
              usedAt: String(ticket.usedAt),
            }));
        }),
      );

      const flattened = histories
        .flat()
        .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
        .slice(0, 8);

      setRecentCheckIns(flattened);
    } catch (error: any) {
      Alert.alert('체크인 홈 로드 실패', errorMessage(error, '체크인 운영 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const todayEvents = useMemo(() => events.filter((event) => isToday(event.eventAt || event.eventDateTime)), [events]);
  const sortedTodayEvents = useMemo(() => {
    return [...todayEvents].sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      const aTime = new Date(a.eventAt || a.eventDateTime || '').getTime();
      const bTime = new Date(b.eventAt || b.eventDateTime || '').getTime();
      return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
    });
  }, [todayEvents]);
  const recentEventId = recentCheckIns[0]?.eventId;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>체크인 운영 화면을 준비하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Check-in Home</Text>
      <Text style={styles.title}>체크인</Text>
      <Text style={styles.subtitle}>체크인할 이벤트를 먼저 고르고, 이후 실제 입장 처리는 관리 화면에서 진행하세요.</Text>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>오늘 체크인 예정 이벤트</Text>
          <Text style={styles.sectionHint}>{sortedTodayEvents.length}건</Text>
        </View>
        {sortedTodayEvents.length === 0 ? (
          <Text style={styles.emptyText}>오늘 체크인 예정 이벤트가 없습니다.</Text>
        ) : (
          sortedTodayEvents.map((event) => {
            const highlighted = event.id === recentEventId;

            return (
            <View key={event.id} style={styles.eventRow}>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{eventTitle(event)}</Text>
                <Text style={styles.eventMeta}>장소 {event.venue || '-'}</Text>
                <Text style={styles.eventMeta}>일시 {formatEventDate(event.eventAt || event.eventDateTime)}</Text>
              </View>
              <View style={styles.eventActions}>
                <Text style={styles.badge}>{formatEventStatus(event.status)}</Text>
                <TouchableOpacity style={[styles.rowButton, highlighted && styles.primaryRowButton]} onPress={() => navigation.navigate('CheckInManage', { eventId: event.id })}>
                  <Text style={styles.rowButtonText}>입장 처리</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rowButton} onPress={() => navigation.navigate('CheckInStatus', { eventId: event.id })}>
                  <Text style={styles.rowButtonText}>체크인 현황</Text>
                </TouchableOpacity>
              </View>
            </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>최근 입장 처리 로그</Text>
          <Text style={styles.sectionHint}>{recentCheckIns.length}건</Text>
        </View>
        {recentCheckIns.length === 0 ? (
          <Text style={styles.emptyText}>최근 입장 처리 로그가 없습니다.</Text>
        ) : (
          recentCheckIns.map((item, index) => (
            <TouchableOpacity key={`${item.eventId}-${item.seatInfo}-${index}`} style={styles.checkInRow} onPress={() => navigation.navigate('CheckInStatus', { eventId: item.eventId })}>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{item.eventName}</Text>
                <Text style={styles.eventMeta}>좌석 {item.seatInfo}</Text>
                <Text style={styles.eventMeta}>처리 시각 {formatEventDate(item.usedAt)}</Text>
              </View>
              <Text style={styles.linkText}>기록 보기</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  cardText: { marginTop: 8, color: '#64748B', fontSize: 13, lineHeight: 20 },
  primaryButton: { marginTop: 14, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', paddingVertical: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHint: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  checkInRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  eventInfo: { flex: 1 },
  eventTitle: { color: '#0F172A', fontWeight: '900', fontSize: 14 },
  eventMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  eventActions: { alignItems: 'flex-end', gap: 8 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  rowButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  primaryRowButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  rowButtonText: { color: '#0F172A', fontWeight: '900', fontSize: 12 },
  linkText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
});
