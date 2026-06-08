import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  EventFlowHero,
  EventFlowMenuRow,
  EventFlowSectionHead,
  EventFlowTopBar,
  eventFlowStyles,
} from '../components/EventFlowKit';
import { TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { formatEventCategory, formatEventRange, getEventDisplayStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

function eventTitle(event: EventDetail) {
  return event.name || event.title || '이벤트';
}

function eventStart(event: EventDetail) {
  return event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || '';
}

function eventEnd(event: EventDetail) {
  return event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || '';
}

function roundSummary(event: EventDetail) {
  const rounds = event.rounds ?? [];
  if (rounds.length === 0) return formatEventRange(eventStart(event), eventEnd(event));
  const first = rounds[0];
  const firstText = `${first.title || '1회차'} · ${first.eventDate} ${String(first.startTime).slice(0, 5)}`;
  return rounds.length === 1 ? firstText : `${firstText} 외 ${rounds.length - 1}개 회차`;
}

function statusTone(tone: string): 'green' | 'purple' | 'gray' | 'red' | 'yellow' {
  if (tone === 'green') return 'green';
  if (tone === 'red') return 'red';
  if (tone === 'yellow') return 'yellow';
  if (tone === 'purple' || tone === 'blue') return 'purple';
  return 'gray';
}

export default function OrganizerEventDetailPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    try {
      const [detail, eventTickets] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => []),
      ]);
      setEvent(detail);
      setTickets(eventTickets);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('MyEvents');
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /><Text style={styles.loadingText}>이벤트 상세 정보를 불러오고 있습니다.</Text></View>;
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>이벤트를 찾을 수 없습니다.</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={goBack}><Text style={styles.emptyButtonText}>돌아가기</Text></TouchableOpacity>
      </View>
    );
  }

  const soldTickets = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
  const usedTickets = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
  const totalTickets = Number(event.totalTicketCount ?? 0) || tickets.length;
  const issuedTickets = tickets.length;
  const soldPct = totalTickets > 0 ? Math.min(100, (soldTickets / totalTickets) * 100) : 0;
  const displayStatus = getEventDisplayStatus(event);
  const issuedMessage = issuedTickets > 0 ? '발행된 티켓이 있어 일정은 제한적으로 수정됩니다.' : '티켓 발행 전에는 회차 일정을 자유롭게 수정할 수 있습니다.';

  return (
    <ScrollView
      style={eventFlowStyles.container}
      contentContainerStyle={eventFlowStyles.content}
      stickyHeaderIndices={[0]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <EventFlowTopBar eyebrow="Event Console" title="이벤트 상세" badge={displayStatus.label} badgeTone={statusTone(displayStatus.tone)} onBack={goBack} />
      <EventFlowHero
        size="lg"
        badge={formatEventCategory(event.category)}
        title={eventTitle(event)}
        meta={`${event.venue || '장소 미정'} · ${roundSummary(event)}\n${issuedMessage}`}
        posters
        imageUrl={resolveImageUrl(event.imageUrl)}
      />

      <View style={styles.stats}>
        <Stat icon="ticket" value={totalTickets} label="총 티켓" />
        <Stat icon="tag" value={issuedTickets} label="발행" />
        <Stat icon="cart" value={soldTickets} label="판매" />
        <Stat icon="userCheck" value={usedTickets} label="입장" />
      </View>

      <View style={eventFlowStyles.section}>
        <EventFlowSectionHead title="이벤트 관리" subtitle="정보 수정과 공개 상태를 관리합니다." />
        <View style={[eventFlowStyles.card, styles.menuCard]}>
          <EventFlowMenuRow icon="edit" title="기본 정보 수정" subtitle="이름, 장소, 소개, 포스터를 수정합니다." onPress={() => navigation.navigate('EventSettings', { eventId: event.id, mode: 'info' })} />
          <EventFlowMenuRow icon="calendarTime" iconTone="green" title="회차 일정 관리" subtitle="발행 전 회차는 날짜와 시간을 수정할 수 있습니다." onPress={() => navigation.navigate('EventSettings', { eventId: event.id, mode: 'schedule' })} />
          <EventFlowMenuRow icon="eye" iconTone="red" title="이벤트 상태 변경" subtitle="게시중, 비공개, 취소 상태로 전환합니다." last onPress={() => navigation.navigate('EventSettings', { eventId: event.id, mode: 'status' })} />
        </View>
      </View>

      <View style={eventFlowStyles.section}>
        <EventFlowSectionHead title="티켓 운영" subtitle="발행과 판매 현황" />
        <View style={styles.operationGrid}>
          <TouchableOpacity style={[styles.operationCard, styles.operationPrimary]} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id, returnTo: 'detail' })}>
            <View style={styles.operationIcon}><TicketIcon name="ticket" color="#534AB7" size={20} /></View>
            <Text style={styles.operationTitle}>티켓 발행</Text>
            <Text style={styles.operationSubtitle}>좌석과 판매 정책을 설정합니다.</Text>
            <Text style={styles.operationLink}>설정하기  ›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.operationCard} onPress={() => navigation.navigate('SalesStatus', { eventId: event.id })}>
            <View style={styles.operationIcon}><TicketIcon name="chart" color="#534AB7" size={20} /></View>
            <Text style={styles.operationTitle}>판매 현황</Text>
            <View style={styles.progressTop}><Text style={styles.progressText}>{soldTickets}/{totalTickets}</Text><Text style={styles.progressText}>{soldPct.toFixed(soldPct < 1 && soldPct > 0 ? 1 : 0)}%</Text></View>
            <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${soldPct}%` }]} /></View>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ icon, value, label }: { icon: 'ticket' | 'tag' | 'cart' | 'userCheck'; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}><TicketIcon name={icon} color="#534AB7" size={16} /></View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#F6F7FB' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 13 },
  emptyTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  emptyButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: '#534AB7' },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 18, ...flowShadow },
  statIcon: { width: 30, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE', marginBottom: 8 },
  statValue: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  statLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', marginTop: 2 },
  menuCard: { overflow: 'hidden', ...flowShadow },
  operationGrid: { flexDirection: 'row', gap: 10 },
  operationCard: { flex: 1, minHeight: 118, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, ...flowShadow },
  operationPrimary: { borderWidth: 1.5, borderColor: '#D8D4FF', backgroundColor: '#FBFAFF' },
  operationIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE', marginBottom: 10 },
  operationTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 3 },
  operationSubtitle: { color: '#64748B', fontSize: 10, lineHeight: 14 },
  operationLink: { color: '#534AB7', fontSize: 12, fontWeight: '900', marginTop: 12 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13, marginBottom: 5 },
  progressText: { color: '#64748B', fontSize: 10, fontWeight: '900' },
  progressBg: { height: 7, borderRadius: 999, overflow: 'hidden', backgroundColor: '#EEF2F7' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#534AB7' },
});
