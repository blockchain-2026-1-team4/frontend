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
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatTicketStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

function ethToWei(value: string) {
  const normalized = value.trim();
  if (!normalized) return '0';
  const [whole, fraction = ''] = normalized.split('.');
  const fractionWei = `${fraction}${'0'.repeat(18)}`.slice(0, 18);
  return `${BigInt(whole || '0') * 1_000_000_000_000_000_000n + BigInt(fractionWei || '0')}`;
}

function ticketKey(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.seatInfo);
}

function sectionOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split(/[-\s]/)[0] || 'GENERAL';
}

export default function TicketIssuePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalTicketCount, setTotalTicketCount] = useState('100');
  const [sectionName, setSectionName] = useState('VIP');
  const [sectionPriceEth, setSectionPriceEth] = useState('0.2');
  const [resaleEnabled, setResaleEnabled] = useState(true);
  const [resaleCapRate, setResaleCapRate] = useState('120');
  const [startNumber, setStartNumber] = useState('1');
  const [issueCount, setIssueCount] = useState('10');
  const [issuing, setIssuing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('티켓 발행 불가', statusMessage);
        navigation.goBack();
        return;
      }
      const [eventDetail, issuedTickets] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => []),
      ]);
      setEvent(eventDetail);
      setTickets(issuedTickets);
      if ((eventDetail.totalTicketCount ?? 0) > 0) setTotalTicketCount(String(eventDetail.totalTicketCount));
    } catch (error: any) {
      Alert.alert('티켓 정보 로드 실패', errorMessage(error, '티켓 발행 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const issuedCount = tickets.length;
  const totalCount = Number(totalTicketCount);
  const remainingCount = Number.isFinite(totalCount) ? Math.max(totalCount - issuedCount, 0) : 0;
  const recentTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 5),
    [tickets],
  );
  const previewSeats = useMemo(() => {
    const count = Number(issueCount);
    const start = Number(startNumber);
    if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(start) || start <= 0) return [];
    return Array.from({ length: Math.min(count, 8) }, (_, index) => `${sectionName}-${start + index}`);
  }, [issueCount, sectionName, startNumber]);

  const showError = (title: string, message: string) => {
    setFeedback({ type: 'error', message });
    Alert.alert(title, message);
  };

  const issue = async () => {
    setFeedback(null);
    const total = Number(totalTicketCount);
    const quantity = Number(issueCount);
    const start = Number(startNumber);
    const capRate = Number(resaleCapRate);
    if (!Number.isInteger(total) || total <= 0) return showError('입력 오류', '총 티켓 수는 1 이상의 정수여야 합니다.');
    if (!sectionName.trim()) return showError('입력 오류', '좌석 구역을 입력해주세요.');
    if (Number.isNaN(Number(sectionPriceEth)) || Number(sectionPriceEth) < 0) return showError('입력 오류', '구역별 가격을 올바르게 입력해주세요.');
    if (!Number.isInteger(start) || start <= 0) return showError('입력 오류', '시작 번호는 1 이상의 정수여야 합니다.');
    if (!Number.isInteger(quantity) || quantity <= 0) return showError('입력 오류', '발행 수량은 1 이상의 정수여야 합니다.');
    if (issuedCount + quantity > total) return showError('입력 오류', `남은 발행 가능 수량은 ${remainingCount}장입니다.`);
    if (resaleEnabled && (!Number.isFinite(capRate) || capRate < 100)) return showError('입력 오류', '최대 리셀 가격 비율은 100% 이상이어야 합니다.');

    setIssuing(true);
    try {
      const issued = await backendApi.issueTickets(eventId, {
        totalTicketCount: total,
        ticketSections: [{
          sectionName: sectionName.trim().toUpperCase(),
          priceWei: ethToWei(sectionPriceEth),
          resaleEnabled,
          resaleCapRate: Math.round(capRate * 100),
          startNumber: start,
          quantity,
        }],
      });
      const message = `${issued.length}장의 티켓을 발행했습니다.`;
      setFeedback({ type: 'success', message });
      Alert.alert('티켓 발행 완료', message);
      await load();
    } catch (error: any) {
      showError('티켓 발행 실패', errorMessage(error, '티켓을 발행하지 못했습니다.'));
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>티켓 발행 정보를 확인하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('MyEvents')}>
        <Text style={styles.backButtonText}>이벤트 관리로 돌아가기</Text>
      </TouchableOpacity>
      <Text style={styles.eyebrow}>Ticket Issue</Text>
      <Text style={styles.title}>티켓 발행</Text>
      <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'}의 좌석 구역별 가격과 리셀 정책을 설정합니다.</Text>

      {feedback ? (
        <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <Summary label="총 티켓 수" value={totalTicketCount || '-'} />
        <Summary label="발행 완료" value={issuedCount} />
        <Summary label="미발행" value={remainingCount} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>구역별 발행 정책</Text>

        <Text style={styles.label}>총 티켓 수</Text>
        <TextInput style={styles.input} value={totalTicketCount} onChangeText={setTotalTicketCount} keyboardType="number-pad" inputMode="numeric" />

        <Text style={styles.label}>좌석 구역</Text>
        <TextInput style={styles.input} value={sectionName} onChangeText={setSectionName} placeholder="VIP, R, S" autoCapitalize="characters" />

        <Text style={styles.label}>좌석 구역별 가격 (ETH)</Text>
        <TextInput style={styles.input} value={sectionPriceEth} onChangeText={setSectionPriceEth} keyboardType="decimal-pad" />

        <TouchableOpacity style={styles.toggleRow} onPress={() => setResaleEnabled((value) => !value)}>
          <Text style={styles.toggleLabel}>리셀 허용 여부</Text>
          <Text style={[styles.toggleBadge, resaleEnabled ? styles.toggleOn : styles.toggleOff]}>{resaleEnabled ? '허용' : '비허용'}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>최대 리셀 가격 비율 (%)</Text>
        <TextInput style={styles.input} value={resaleCapRate} onChangeText={setResaleCapRate} keyboardType="number-pad" editable={resaleEnabled} />

        <Text style={styles.label}>시작 번호</Text>
        <TextInput style={styles.input} value={startNumber} onChangeText={setStartNumber} keyboardType="number-pad" inputMode="numeric" />

        <Text style={styles.label}>발행 수량</Text>
        <TextInput style={styles.input} value={issueCount} onChangeText={setIssueCount} keyboardType="number-pad" inputMode="numeric" />

        <Text style={styles.previewLabel}>발행 예정 좌석</Text>
        <Text style={styles.previewText}>{previewSeats.join(', ') || '-'}</Text>
      </View>

      <TouchableOpacity style={[styles.primaryButton, issuing && styles.disabledButton]} disabled={issuing} onPress={issue}>
        <Text style={styles.primaryButtonText}>{issuing ? '발행 중...' : '티켓 발행'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('TicketExplore', { eventId })}>
        <Text style={styles.secondaryButtonText}>전체 발행 티켓 보기</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>최근 발행 티켓</Text>
        {recentTickets.length === 0 ? (
          <Text style={styles.emptyText}>최근 발행 티켓이 없습니다.</Text>
        ) : (
          recentTickets.map((ticket) => (
            <View key={ticketKey(ticket)} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketSeat}>{ticket.seatInfo}</Text>
                <Text style={styles.ticketMeta}>구역 {sectionOf(ticket)} · 가격 {weiToEth(ticket.originalPriceWei || ticket.priceWei)}</Text>
                <Text style={styles.ticketMeta}>리셀 {ticket.resaleEnabled ? '허용' : '비허용'}</Text>
              </View>
              <Text style={styles.ticketStatus}>{formatTicketStatus(ticket.status)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Summary({ label, value }: { label: string; value: number | string }) {
  return <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  backButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 14 },
  backButtonText: { color: '#2563EB', fontWeight: '900' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  messageBox: { marginTop: 14, borderRadius: 8, padding: 12, borderWidth: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  summaryValue: { marginTop: 7, color: '#0F172A', fontSize: 22, fontWeight: '900' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  label: { marginTop: 14, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  toggleRow: { marginTop: 14, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: '#0F172A', fontWeight: '800' },
  toggleBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '900' },
  toggleOn: { backgroundColor: '#DCFCE7', color: '#166534' },
  toggleOff: { backgroundColor: '#F1F5F9', color: '#64748B' },
  previewLabel: { marginTop: 14, color: '#64748B', fontSize: 12, fontWeight: '800' },
  previewText: { marginTop: 5, color: '#0F172A', fontWeight: '800', lineHeight: 20 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 10, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketInfo: { flex: 1 },
  ticketSeat: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  ticketStatus: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900', alignSelf: 'flex-start' },
  emptyText: { color: '#94A3B8', paddingVertical: 18, textAlign: 'center' },
});
