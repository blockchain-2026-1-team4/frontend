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
import type { EventDetail, TicketDetail } from '../types/api';

const SEAT_SECTIONS = ['A', 'B', 'C', 'D', 'VIP'];

function buildSeats(count: number, section: string, startNumber: number) {
  return Array.from({ length: count }, (_, index) => `${section}-${startNumber + index}`);
}

function ticketKey(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.seatInfo);
}

function nextSeatNumber(tickets: TicketDetail[], section: string) {
  const numbers = tickets
    .map((ticket) => ticket.seatInfo)
    .filter((seat) => seat.startsWith(`${section}-`))
    .map((seat) => Number(seat.split('-')[1]))
    .filter((value) => Number.isInteger(value) && value > 0);
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
}

export default function TicketIssuePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issueCount, setIssueCount] = useState('10');
  const [seatSection, setSeatSection] = useState('A');
  const [startNumber, setStartNumber] = useState('1');
  const [issuing, setIssuing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const totalCount = event?.totalTicketCount ?? 0;
  const issuedCount = tickets.length;
  const remainingCount = Math.max(totalCount - issuedCount, 0);

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
      setStartNumber(String(nextSeatNumber(issuedTickets, seatSection)));
    } catch (error: any) {
      const message = errorMessage(error, '현재 발행 정보를 불러오지 못했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert('티켓 정보 로드 실패', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation, seatSection]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const previewSeats = useMemo(() => {
    const count = Number(issueCount);
    const start = Number(startNumber);
    if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(start) || start <= 0) return [];
    return buildSeats(Math.min(count, 8), seatSection, start);
  }, [issueCount, seatSection, startNumber]);

  const setAllRemaining = () => {
    setIssueCount(String(remainingCount));
  };

  const selectSection = (section: string) => {
    setSeatSection(section);
    setStartNumber(String(nextSeatNumber(tickets, section)));
  };

  const showError = (title: string, message: string) => {
    setFeedback({ type: 'error', message });
    Alert.alert(title, message);
  };

  const issue = async () => {
    setFeedback(null);

    if (!eventId) {
      showError('이벤트 없음', '티켓을 발행할 이벤트를 찾지 못했습니다.');
      return;
    }
    if (remainingCount <= 0) {
      showError('발행 불가', '이 이벤트는 총 티켓 수만큼 모두 발행되었습니다.');
      return;
    }

    const count = Number(issueCount);
    const start = Number(startNumber);
    if (!Number.isInteger(count) || count <= 0) {
      showError('입력 오류', '이번 발행 수량은 1 이상의 정수여야 합니다.');
      return;
    }
    if (count > remainingCount) {
      showError('입력 오류', `남은 미발행 티켓은 ${remainingCount}장입니다.`);
      return;
    }
    if (!Number.isInteger(start) || start <= 0) {
      showError('입력 오류', '시작 번호는 1 이상의 정수여야 합니다.');
      return;
    }

    const seatInfos = buildSeats(count, seatSection, start);
    const existingSeats = new Set(tickets.map((ticket) => ticket.seatInfo));
    const duplicatedSeat = seatInfos.find((seat) => existingSeats.has(seat));
    if (duplicatedSeat) {
      showError('좌석 중복', `${duplicatedSeat} 좌석은 이미 발행되었습니다. 시작 번호를 조정해 주세요.`);
      return;
    }

    setIssuing(true);
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        showError('티켓 발행 불가', statusMessage);
        return;
      }

      const issued = await backendApi.issueTickets(eventId, { seatInfos });
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
      <Text style={styles.eyebrow}>Ticket Issue</Text>
      <Text style={styles.title}>티켓 발행</Text>
      <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'}의 총 티켓 수 안에서 미발행 티켓을 생성합니다.</Text>

      {feedback ? (
        <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>총 티켓</Text>
          <Text style={styles.summaryValue}>{totalCount || '-'}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>발행 완료</Text>
          <Text style={styles.summaryValue}>{issuedCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>미발행</Text>
          <Text style={styles.summaryValue}>{remainingCount}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>이번에 발행할 티켓</Text>
        <Text style={styles.helpText}>총 티켓 수를 넘지 않도록 미발행 수량 안에서 발행합니다.</Text>

        <Text style={styles.label}>좌석 구역</Text>
        <View style={styles.sectionGrid}>
          {SEAT_SECTIONS.map((section) => (
            <TouchableOpacity key={section} style={[styles.sectionChip, seatSection === section && styles.activeSectionChip]} onPress={() => selectSection(section)}>
              <Text style={[styles.sectionChipText, seatSection === section && styles.activeSectionChipText]}>{section}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>시작 번호</Text>
        <TextInput style={styles.input} value={startNumber} onChangeText={setStartNumber} keyboardType="number-pad" inputMode="numeric" />

        <Text style={styles.label}>이번 발행 수량</Text>
        <View style={styles.countRow}>
          <TextInput style={[styles.input, styles.countInput]} value={issueCount} onChangeText={setIssueCount} keyboardType="number-pad" inputMode="numeric" />
          <TouchableOpacity style={styles.countShortcut} onPress={() => setIssueCount('1')}><Text style={styles.countShortcutText}>1장</Text></TouchableOpacity>
          <TouchableOpacity style={styles.countShortcut} onPress={() => setIssueCount('10')}><Text style={styles.countShortcutText}>10장</Text></TouchableOpacity>
          <TouchableOpacity style={styles.countShortcut} onPress={setAllRemaining}><Text style={styles.countShortcutText}>전체</Text></TouchableOpacity>
        </View>

        <Text style={styles.previewLabel}>발행될 좌석</Text>
        <Text style={styles.previewText}>{previewSeats.join(', ') || '-'}</Text>
        {Number(issueCount) > 8 ? <Text style={styles.helpText}>외 {Number(issueCount) - 8}장이 이어서 생성됩니다.</Text> : null}
      </View>

      <TouchableOpacity style={[styles.primaryButton, (issuing || remainingCount <= 0) && styles.disabledButton]} disabled={issuing || remainingCount <= 0} onPress={issue}>
        <Text style={styles.primaryButtonText}>{issuing ? '발행 중...' : remainingCount <= 0 ? '발행 완료' : '티켓 발행'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('OrganizerEventDetail', { eventId })}>
        <Text style={styles.secondaryButtonText}>이벤트 관리로 이동</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>최근 발행 좌석</Text>
        {tickets.length === 0 ? (
          <Text style={styles.emptyText}>아직 발행된 티켓이 없습니다.</Text>
        ) : (
          tickets.slice(-4).reverse().map((ticket) => (
            <View key={ticketKey(ticket)} style={styles.ticketRow}>
              <Text style={styles.ticketSeat}>{ticket.seatInfo}</Text>
              <Text style={styles.ticketStatus}>{ticket.status}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  summaryValue: { marginTop: 7, color: '#0F172A', fontSize: 22, fontWeight: '900' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  helpText: { marginTop: 8, color: '#64748B', fontSize: 12, lineHeight: 18 },
  label: { marginTop: 14, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeSectionChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  sectionChipText: { color: '#475569', fontWeight: '900' },
  activeSectionChipText: { color: '#2563EB' },
  countRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countInput: { flex: 1 },
  countShortcut: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  countShortcutText: { color: '#0F172A', fontWeight: '900', fontSize: 12 },
  previewLabel: { marginTop: 14, color: '#64748B', fontSize: 12, fontWeight: '800' },
  previewText: { marginTop: 5, color: '#0F172A', fontWeight: '800', lineHeight: 20 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketSeat: { color: '#0F172A', fontWeight: '900' },
  ticketStatus: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#94A3B8', paddingVertical: 18, textAlign: 'center' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
