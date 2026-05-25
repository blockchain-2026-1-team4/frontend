import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventRange, formatEventStatus, getEventDisplayStatus, getTicketDisplayStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.seatInfo);
}

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

export default function OrganizerEventDetailPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusDraft, setStatusDraft] = useState('PUBLISHED');
  const [statusSaving, setStatusSaving] = useState(false);

  const soldTickets = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
  const usedTickets = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
  const totalTickets = event?.totalTicketCount && event.totalTicketCount > 0 ? event.totalTicketCount : tickets.length;
  const displayStatus = getEventDisplayStatus(event);
  const recentTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 4),
    [tickets],
  );

  const load = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const detail = await backendApi.getEvent(eventId);
      const eventTickets = await backendApi.getEventTickets(eventId).catch(() => []);
      setEvent(detail);
      setStatusDraft(detail.status || 'PUBLISHED');
      setTickets(eventTickets);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const saveStatus = async () => {
    if (!event) return;
    if (event.adminCanceled && statusDraft !== 'CANCELLED') {
      Alert.alert('변경 불가', '관리자가 취소한 이벤트는 주최자가 복구할 수 없습니다.');
      return;
    }

    setStatusSaving(true);
    try {
      await backendApi.updateEventStatus(event.id, { status: statusDraft });
      Alert.alert('저장 완료', '이벤트 상태가 변경되었습니다.');
      await load();
    } catch (error: any) {
      Alert.alert('상태 변경 실패', errorMessage(error, '이벤트 상태를 변경하지 못했습니다.'));
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>이벤트 상세 정보를 불러오고 있습니다.</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>이벤트를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.hero}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterEmpty}><Text style={styles.posterEmptyText}>포스터 없음</Text></View>
        )}
        <View style={styles.heroCopy}>
          <View style={styles.heroTopRow}>
            <Text style={styles.category}>{event.category || 'EVENT'}</Text>
            <Text style={[styles.statusBadge, styles[`tone_${displayStatus.tone}`]]}>{displayStatus.label}</Text>
          </View>
          <Text style={styles.title}>{eventTitle(event)}</Text>
          <Text style={styles.meta}>장소 {event.venue || '-'}</Text>
          <Text style={styles.meta}>회차 {roundSummary(event)}</Text>
          <Text style={styles.statusText}>현재 상태: {formatEventStatus(event.status)}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <Metric label="총 티켓" value={totalTickets} />
        <Metric label="발행" value={tickets.length} />
        <Metric label="판매" value={soldTickets} />
        <Metric label="체크인" value={usedTickets} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>주요 액션</Text>
        <View style={styles.actionList}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id, returnTo: 'detail' })}>
            <Text style={styles.primaryButtonText}>티켓 발행</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('SalesStatus', { eventId: event.id })}>
            <Text style={styles.secondaryButtonText}>티켓 발행 현황</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CheckInStatus', { eventId: event.id })}>
            <Text style={styles.secondaryButtonText}>체크인 현황</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>보조 액션</Text>
        <View style={styles.actionList}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('EventSettings', { eventId: event.id })}>
            <Text style={styles.secondaryButtonText}>이벤트 수정</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.subTitle}>이벤트 상태 변경</Text>
          <Text style={styles.statusDescription}>게시 여부와 취소 여부만 관리합니다. 판매 상태와 공연 상태는 일정과 티켓 수량으로 자동 계산됩니다.</Text>
          {event.adminCanceled ? <Text style={styles.warningText}>관리자가 취소한 이벤트는 주최자가 복구할 수 없습니다.</Text> : null}
          <View style={styles.statusGrid}>
            {[
              { value: 'PUBLISHED', label: '게시중' },
              { value: 'INACTIVE', label: '비공개' },
              { value: 'CANCELLED', label: '이벤트 취소' },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.statusChip, statusDraft === item.value && styles.activeStatusChip]}
                disabled={statusSaving || (event.adminCanceled === true && item.value !== 'CANCELLED')}
                onPress={() => setStatusDraft(item.value)}
              >
                <Text style={[styles.statusChipText, statusDraft === item.value && styles.activeStatusChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.statusSaveButton, statusSaving && styles.disabledButton]} disabled={statusSaving} onPress={() => void saveStatus()}>
            <Text style={styles.statusSaveButtonText}>{statusSaving ? '저장 중...' : '상태 저장'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardSecondary}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>최근 발행 티켓</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TicketExplore', { eventId: event.id })}>
            <Text style={styles.linkText}>전체 보기</Text>
          </TouchableOpacity>
        </View>
        {recentTickets.length === 0 ? (
          <Text style={styles.emptyText}>최근 발행 티켓이 없습니다.</Text>
        ) : (
          recentTickets.map((ticket) => {
            const ticketStatus = getTicketDisplayStatus(ticket);
            return (
              <View key={ticketId(ticket)} style={styles.ticketRow}>
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketTitle}>{ticket.seatInfo || '-'}</Text>
                  <Text style={styles.ticketMeta}>구역 {ticket.sectionName || String(ticket.seatInfo || '').split('-')[0]} · 가격 {weiToEth(ticket.originalPriceWei || ticket.priceWei)}</Text>
                  <Text style={styles.ticketMeta}>리셀 {ticket.resaleEnabled ? '허용' : '불가'} · {ticket.ownerWalletAddress || ticket.ownerAddress || '미판매'}</Text>
                </View>
                <Text style={[styles.ticketBadge, styles[`tone_${ticketStatus.tone}`]]}>{ticketStatus.label}</Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 16, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  hero: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  poster: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#E2E8F0' },
  posterEmpty: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  posterEmptyText: { color: '#64748B', fontWeight: '900' },
  heroCopy: { padding: 16 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  category: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A', lineHeight: 31 },
  meta: { marginTop: 7, color: '#64748B', fontSize: 13, lineHeight: 19 },
  statusText: { marginTop: 10, color: '#334155', fontSize: 12, fontWeight: '900' },
  statusBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  metricValue: { marginTop: 7, color: '#0F172A', fontSize: 22, fontWeight: '900' },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  cardSecondary: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#EEF2F7' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  subTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  actionList: { marginTop: 12, gap: 8 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  secondaryButtonText: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  statusPanel: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  statusDescription: { marginTop: 8, color: '#475569', fontSize: 13, lineHeight: 19 },
  warningText: { marginTop: 10, color: '#B91C1C', fontSize: 13, fontWeight: '800', lineHeight: 19 },
  statusGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusChip: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 9, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeStatusChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  statusChipText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  activeStatusChipText: { color: '#2563EB' },
  statusSaveButton: { marginTop: 10, borderWidth: 1, borderColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#EFF6FF' },
  statusSaveButtonText: { color: '#2563EB', fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  linkText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketInfo: { flex: 1, paddingRight: 10 },
  ticketTitle: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  ticketBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
  tone_neutral: { backgroundColor: '#F1F5F9', color: '#475569' },
  tone_blue: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  tone_green: { backgroundColor: '#DCFCE7', color: '#15803D' },
  tone_yellow: { backgroundColor: '#FEF3C7', color: '#A16207' },
  tone_red: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  tone_gray: { backgroundColor: '#E2E8F0', color: '#475569' },
});
