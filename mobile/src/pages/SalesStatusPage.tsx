import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate, formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, EventSummary, TicketDetail } from '../types/api';

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? '');
}

function eventTitle(event: EventSummary | EventDetail) {
  return event.name || event.title || '이벤트';
}

function weiToEth(wei?: string) {
  if (!wei) return '-';
  const value = BigInt(wei);
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = String(value % 1_000_000_000_000_000_000n).padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction} ETH` : `${whole} ETH`;
}

export default function SalesStatusPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string | undefined;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!eventId) {
        const page = await backendApi.getMyEvents({ page: 0, size: 20 });
        const myEvents = (page.items ?? []).filter((item) => item.status !== 'CANCELED');
        setEvents(myEvents);
        setEvent(null);
        setTickets([]);
      } else {
        const [detail, list] = await Promise.all([
          backendApi.getEvent(eventId),
          backendApi.getEventTickets(eventId).catch(() => []),
        ]);
        setEvent(detail);
        setTickets(list);
        setEvents([]);
      }
    } catch (error: any) {
      Alert.alert('판매 현황 로드 실패', errorMessage(error, '판매 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sold = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(ticket.status)).length;
  const used = tickets.filter((ticket) => ticket.status === 'USED').length;
  const available = tickets.filter((ticket) => ticket.status === 'AVAILABLE').length;

  const previewTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 5),
    [tickets],
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (!eventId) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text style={styles.eyebrow}>Ticket Sales</Text>
        <Text style={styles.title}>티켓 판매</Text>
        <Text style={styles.subtitle}>먼저 이벤트를 선택한 뒤 판매 요약과 전체 탐색으로 이동하세요.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>이벤트 선택</Text>
          {events.length === 0 ? (
            <Text style={styles.emptyText}>선택 가능한 이벤트가 없습니다.</Text>
          ) : (
            events.slice(0, 10).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.eventRow}
                onPress={() => navigation.navigate('SalesStatus', { eventId: item.id })}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>{eventTitle(item)}</Text>
                  <Text style={styles.rowMeta}>일시 {formatEventDate(item.eventAt || item.eventDateTime)}</Text>
                </View>
                <Text style={styles.linkText}>선택</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Sales Preview</Text>
      <Text style={styles.title}>판매 현황</Text>
      <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'} · {weiToEth(event?.ticketPriceWei)}</Text>
      <View style={styles.metricGrid}>
        <Metric label="판매 완료 티켓" value={sold} />
        <Metric label="잔여 좌석" value={available} />
        <Metric label="체크인 완료 티켓" value={used} />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>최근 발행 티켓 미리보기</Text>
          <TouchableOpacity onPress={() => navigation?.navigate?.('TicketExplore', { eventId })}>
            <Text style={styles.linkText}>전체 티켓 탐색</Text>
          </TouchableOpacity>
        </View>
        {previewTickets.length === 0 ? (
          <Text style={styles.emptyText}>최근 발행된 티켓이 없습니다.</Text>
        ) : (
          previewTickets.map((item) => (
            <View key={ticketId(item)} style={styles.eventRow}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{item.seatInfo || '-'}</Text>
                <Text style={styles.rowMeta}>{item.ownerWalletAddress || item.ownerAddress || '미판매'}</Text>
              </View>
              <Text style={styles.badge}>{formatTicketStatus(item.status)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionHead: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  linkText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  eventRow: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowInfo: { flex: 1 },
  rowTitle: { color: '#0F172A', fontWeight: '900' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 24, textAlign: 'center' },
});
