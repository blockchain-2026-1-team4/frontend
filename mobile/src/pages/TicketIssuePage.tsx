import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { EventDetail, TicketDetail } from '../types/api';

function buildSeats(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

export default function TicketIssuePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [count, setCount] = useState('20');
  const [prefix, setPrefix] = useState('A');
  const [seatText, setSeatText] = useState('');
  const [issuing, setIssuing] = useState(false);

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
      const firstSeat = issuedTickets[0]?.seatInfo;
      if (firstSeat) {
        const guessedPrefix = firstSeat.includes('-') ? firstSeat.split('-')[0] : firstSeat.replace(/[0-9]+$/, '');
        if (guessedPrefix) setPrefix((current) => (current === 'A' ? guessedPrefix : current));
      }
    } catch (error: any) {
      Alert.alert('티켓 정보 로드 실패', errorMessage(error, '현재 발행 정보를 불러오지 못했습니다.'));
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

  const previewSeats = useMemo(() => {
    const parsed = Number(count);
    if (!Number.isInteger(parsed) || parsed <= 0) return [];
    return buildSeats(Math.min(parsed, 8), prefix.trim() || 'A');
  }, [count, prefix]);

  const issue = async () => {
    const manualSeats = seatText
      .split(/\r?\n|,/)
      .map((seat) => seat.trim())
      .filter(Boolean);
    const parsedCount = Number(count);
    const seatInfos = manualSeats.length > 0
      ? manualSeats
      : Number.isInteger(parsedCount) && parsedCount > 0
        ? buildSeats(parsedCount, prefix.trim() || 'A')
        : [];

    if (!eventId) {
      Alert.alert('이벤트 없음', '티켓을 발행할 이벤트를 찾지 못했습니다.');
      return;
    }
    if (!seatText.trim() && !count.trim()) {
      Alert.alert('입력 필요', '자동 생성 수량을 입력하거나 좌석 정보를 직접 입력해 주세요.');
      return;
    }
    if (!seatText.trim() && !prefix.trim()) {
      Alert.alert('입력 필요', '자동 생성에 사용할 좌석 접두어를 입력해 주세요.');
      return;
    }
    if (seatInfos.length === 0) {
      Alert.alert('입력 오류', '발행할 좌석 정보를 만들 수 없습니다. 수량은 1 이상의 정수여야 합니다.');
      return;
    }

    setIssuing(true);
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('티켓 발행 불가', statusMessage);
        return;
      }

      const issued = await backendApi.issueTickets(eventId, { seatInfos });
      Alert.alert('티켓 발행 완료', `${issued.length}장의 티켓을 발행했습니다.`, [
        { text: '이벤트 관리로 이동', onPress: () => navigation.replace('OrganizerEventDetail', { eventId }) },
      ]);
      await load();
    } catch (error: any) {
      Alert.alert('티켓 발행 실패', errorMessage(error, '티켓을 발행하지 못했습니다.'));
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
      <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'}의 좌석 티켓을 발행합니다.</Text>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>현재 발행</Text>
          <Text style={styles.summaryValue}>{tickets.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>총 티켓 수</Text>
          <Text style={styles.summaryValue}>{event?.totalTicketCount ?? '-'}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>좌석 접두어</Text>
          <Text style={styles.summaryValue}>{prefix.trim() || '-'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>자동 생성 수량</Text>
        <TextInput style={styles.input} value={count} onChangeText={setCount} keyboardType="number-pad" />

        <Text style={styles.label}>좌석 접두어</Text>
        <TextInput style={styles.input} value={prefix} onChangeText={setPrefix} autoCapitalize="characters" />

        <Text style={styles.previewLabel}>미리보기</Text>
        <Text style={styles.previewText}>{previewSeats.join(', ') || '-'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>직접 입력</Text>
        <Text style={styles.helpText}>한 줄에 하나씩 입력하거나 쉼표로 구분하세요. 직접 입력이 있으면 자동 생성은 사용하지 않습니다.</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={seatText}
          onChangeText={setSeatText}
          placeholder={'A-1\nA-2\nA-3'}
          multiline
        />
      </View>

      <TouchableOpacity style={[styles.primaryButton, issuing && styles.disabledButton]} disabled={issuing} onPress={issue}>
        <Text style={styles.primaryButtonText}>{issuing ? '발행 중...' : '티켓 발행'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('OrganizerEventDetail', { eventId })}>
        <Text style={styles.secondaryButtonText}>나중에 발행하기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  summaryValue: { marginTop: 7, color: '#0F172A', fontSize: 18, fontWeight: '900' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { marginTop: 8, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 130, textAlignVertical: 'top' },
  helpText: { color: '#64748B', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  previewLabel: { marginTop: 14, color: '#64748B', fontSize: 12, fontWeight: '800' },
  previewText: { marginTop: 5, color: '#0F172A', fontWeight: '800' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
