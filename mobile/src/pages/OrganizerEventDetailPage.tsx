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
import { formatEventRange, formatEventStatus, formatTicketStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? '');
}

export default function OrganizerEventDetailPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusDraft, setStatusDraft] = useState('ACTIVE');
  const [statusSaving, setStatusSaving] = useState(false);

  const soldTickets = tickets.filter((ticket) => ticket.status === 'SOLD' || ticket.status === 'LISTED' || ticket.status === 'USED').length;
  const usedTickets = tickets.filter((ticket) => ticket.status === 'USED').length;
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
      setStatusDraft(detail.status || 'ACTIVE');
      setTickets(eventTickets);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const saveStatus = async () => {
    if (!event) return;
    if (event.adminCanceled && statusDraft !== 'CANCELED') {
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
        <Text style={styles.emptyTitle}>이벤트를 찾지 못했습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.eyebrow}>Event Detail</Text>
      <Text style={styles.title}>{event.name || event.title || '이벤트 상세'}</Text>
      <Text style={styles.subtitle}>
        {event.venue} · {formatEventRange(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime, event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime)}
      </Text>
      <Text style={styles.statusText}>이벤트 상태 {formatEventStatus(event.status)}</Text>

      <View style={styles.metricGrid}>
        <Metric label="총 발행 티켓" value={tickets.length} />
        <Metric label="판매 완료 티켓" value={soldTickets} />
        <Metric label="체크인 완료 티켓" value={usedTickets} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>이벤트 상태 변경</Text>
        <Text style={styles.statusDescription}>운영중지 또는 이벤트 취소는 판매와 체크인에 영향을 줄 수 있습니다.</Text>
        {event.adminCanceled ? <Text style={styles.warningText}>관리자가 취소한 이벤트는 주최자가 복구할 수 없습니다.</Text> : null}
        <View style={styles.statusGrid}>
          {[
            { value: 'ACTIVE', label: '운영중' },
            { value: 'INACTIVE', label: '운영중지' },
            { value: 'CANCELED', label: '이벤트 취소' },
          ].map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.statusChip, statusDraft === item.value && styles.activeStatusChip]}
              disabled={statusSaving || (event.adminCanceled === true && item.value !== 'CANCELED')}
              onPress={() => setStatusDraft(item.value)}
            >
              <Text style={[styles.statusChipText, statusDraft === item.value && styles.activeStatusChipText]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.secondaryButton, statusSaving && styles.disabledButton]} disabled={statusSaving} onPress={() => void saveStatus()}>
          <Text style={styles.secondaryButtonText}>{statusSaving ? '저장 중...' : '상태 저장'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>이벤트 관리 연결</Text>
        <View style={styles.actionList}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('EventSettings', { eventId: event.id })}>
            <Text style={styles.secondaryButtonText}>이벤트 수정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id, returnTo: 'detail' })}>
            <Text style={styles.primaryButtonText}>티켓 발행하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('SalesStatus', { eventId: event.id })}>
            <Text style={styles.secondaryButtonText}>판매 현황 보기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CheckInStatus', { eventId: event.id })}>
            <Text style={styles.secondaryButtonText}>체크인 현황 보기</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>최근 발행 티켓 미리보기</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TicketExplore', { eventId: event.id })}>
            <Text style={styles.linkText}>전체 티켓 탐색</Text>
          </TouchableOpacity>
        </View>
        {recentTickets.length === 0 ? (
          <Text style={styles.emptyText}>최근 발행 티켓이 없습니다.</Text>
        ) : (
          recentTickets.map((ticket) => (
            <View key={ticketId(ticket)} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketTitle}>{ticket.seatInfo || '-'}</Text>
                <Text style={styles.ticketMeta}>구역 {ticket.sectionName || String(ticket.seatInfo || '').split('-')[0]} · 가격 {weiToEth(ticket.originalPriceWei || ticket.priceWei)}</Text>
                <Text style={styles.ticketMeta}>리셀 {ticket.resaleEnabled ? '허용' : '비허용'} · {ticket.ownerWalletAddress || ticket.ownerAddress || '미판매'}</Text>
              </View>
              <Text style={styles.badge}>{formatTicketStatus(ticket.status)}</Text>
            </View>
          ))
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
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  statusText: { marginTop: 8, color: '#475569', fontSize: 12, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  actionList: { marginTop: 12, gap: 8 },
  linkText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  statusDescription: { marginTop: 10, color: '#475569', fontSize: 13, lineHeight: 19 },
  warningText: { marginTop: 10, color: '#B91C1C', fontSize: 13, fontWeight: '800', lineHeight: 19 },
  statusGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statusChip: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeStatusChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  statusChipText: { color: '#475569', fontWeight: '900' },
  activeStatusChipText: { color: '#2563EB' },
  disabledButton: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketInfo: { flex: 1, paddingRight: 10 },
  ticketTitle: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
});
