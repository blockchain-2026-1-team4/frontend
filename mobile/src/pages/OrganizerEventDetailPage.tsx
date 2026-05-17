import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { backendApi } from '../lib/backend';
import type { CheckInRecord, EventDetail, TicketDetail } from '../types/api';

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? '');
}

function weiToEth(wei?: string) {
  if (!wei) return '-';
  const value = BigInt(wei);
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = String(value % 1_000_000_000_000_000_000n).padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction} ETH` : `${whole} ETH`;
}

export default function OrganizerEventDetailPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validatorId, setValidatorId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [eventAt, setEventAt] = useState('');

  const soldTickets = tickets.filter((ticket) => ticket.status === 'SOLD' || ticket.status === 'LISTED' || ticket.status === 'USED').length;
  const usedTickets = tickets.filter((ticket) => ticket.status === 'USED').length;
  const availableTickets = tickets.filter((ticket) => ticket.status === 'AVAILABLE').length;

  const checkInSummary = useMemo(() => {
    const success = checkIns.filter((record) => record.result === 'SUCCESS' || record.status === 'SUCCESS').length;
    return { success, total: checkIns.length };
  }, [checkIns]);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const detail = await backendApi.getEvent(eventId);
      const eventTickets = await backendApi.getEventTickets(eventId).catch(() => []);
      const histories = await Promise.all(
        eventTickets.map((ticket) => backendApi.getTicketCheckIns(ticketId(ticket)).catch(() => [])),
      );

      setEvent(detail);
      setTickets(eventTickets);
      setCheckIns(histories.flat());
      setName(detail.name || detail.title || '');
      setCategory(detail.category || '');
      setVenue(detail.venue || '');
      setDescription(detail.description || '');
      setEventAt((detail.eventAt || detail.eventDateTime || '').slice(0, 16));
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', error.message || '이벤트 정보를 불러오지 못했습니다.');
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

  const saveEvent = async () => {
    if (!event) return;
    setSaving(true);
    try {
      const updated = await backendApi.updateEvent(event.id, {
        name: name.trim() || null,
        category: category.trim() || null,
        venue: venue.trim() || null,
        description: description.trim() || null,
        eventAt: eventAt ? new Date(eventAt).toISOString() : null,
      });
      setEvent(updated);
      Alert.alert('저장 완료', '이벤트 정보가 수정되었습니다.');
      await load();
    } catch (error: any) {
      Alert.alert('저장 실패', error.message || '이벤트 정보를 수정하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!event) return;
    setSaving(true);
    try {
      await backendApi.updateEventStatus(event.id, { status });
      await load();
    } catch (error: any) {
      Alert.alert('상태 변경 실패', error.message || '상태를 변경하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const addValidator = async () => {
    if (!event || !validatorId.trim()) {
      Alert.alert('입력 필요', '검증자로 등록할 사용자 ID를 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await backendApi.addEventValidator(event.id, { userId: validatorId.trim() });
      setValidatorId('');
      Alert.alert('등록 완료', '체크인 검증자를 등록했습니다.');
    } catch (error: any) {
      Alert.alert('검증자 등록 실패', error.message || '검증자를 등록하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>이벤트 운영 정보를 불러오고 있습니다.</Text>
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
      <Text style={styles.eyebrow}>Event Operations</Text>
      <Text style={styles.title}>{event.name || event.title || '이벤트 관리'}</Text>
      <Text style={styles.subtitle}>{event.venue} · {formatDate(event.eventAt || event.eventDateTime)}</Text>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>발행</Text>
          <Text style={styles.metricValue}>{tickets.length}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>판매</Text>
          <Text style={styles.metricValue}>{soldTickets}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>체크인</Text>
          <Text style={styles.metricValue}>{usedTickets}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id })}>
          <Text style={styles.primaryButtonText}>티켓 추가 발행</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => changeStatus(event.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} disabled={saving}>
          <Text style={styles.secondaryButtonText}>{event.status === 'ACTIVE' ? '비활성화' : '활성화'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>판매 현황</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>판매 {soldTickets}</Text>
          <Text style={styles.statText}>잔여 {availableTickets}</Text>
          <Text style={styles.statText}>가격 {weiToEth(event.ticketPriceWei)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>이벤트 정보 수정</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="이벤트명" />
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="카테고리" />
        <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="장소" />
        <TextInput style={styles.input} value={eventAt} onChangeText={setEventAt} placeholder="YYYY-MM-DDTHH:mm" />
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="설명" multiline />
        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={saveEvent}>
          <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '정보 저장'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>티켓 목록</Text>
        {tickets.length === 0 ? (
          <Text style={styles.emptyText}>아직 발행된 티켓이 없습니다.</Text>
        ) : (
          tickets.slice(0, 20).map((ticket) => (
            <View key={ticketId(ticket)} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketTitle}>{ticket.seatInfo}</Text>
                <Text style={styles.ticketMeta}>{ticket.ownerWalletAddress || ticket.ownerAddress || '미판매'}</Text>
              </View>
              <Text style={styles.badge}>{ticket.status}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>체크인 현황</Text>
        <Text style={styles.cardText}>성공 {checkInSummary.success}건 · 전체 시도 {checkInSummary.total}건</Text>
        {checkIns.length === 0 ? (
          <Text style={styles.emptyText}>체크인 기록이 없습니다.</Text>
        ) : (
          checkIns.slice(0, 12).map((record) => (
            <View key={record.id ?? `${record.ticketId}-${record.checkedInAt}`} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketTitle}>{record.result ?? record.status}</Text>
                <Text style={styles.ticketMeta}>{formatDate(record.checkedInAt || record.createdAt)} · {record.ticketId}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>체크인 관리</Text>
        <Text style={styles.cardText}>현장 검증자로 등록할 사용자 UUID를 입력합니다.</Text>
        <TextInput style={styles.input} value={validatorId} onChangeText={setValidatorId} placeholder="사용자 UUID" autoCapitalize="none" />
        <TouchableOpacity style={[styles.secondaryButton, saving && styles.disabledButton]} disabled={saving} onPress={addValidator}>
          <Text style={styles.secondaryButtonText}>검증자 등록</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  actions: { marginTop: 6 },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 20 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statText: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#F1F5F9', color: '#334155', paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, marginTop: 10, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketInfo: { flex: 1, paddingRight: 10 },
  ticketTitle: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
});
