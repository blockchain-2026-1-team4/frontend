import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';

function toLocalInputDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('날짜 형식이 올바르지 않습니다.');
  }
  return date.toISOString();
}

function ethToWei(value: string) {
  const normalized = value.trim();
  if (!normalized) return '0';
  const [whole, fraction = ''] = normalized.split('.');
  const fractionWei = `${fraction}${'0'.repeat(18)}`.slice(0, 18);
  return `${BigInt(whole || '0') * 1_000_000_000_000_000_000n + BigInt(fractionWei || '0')}`;
}

export default function EventCreatePage({ navigation }: any) {
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(19, 0, 0, 0);
    return date;
  }, []);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('CONCERT');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [eventAt, setEventAt] = useState(toLocalInputDate(tomorrow));
  const [ticketPriceEth, setTicketPriceEth] = useState('0.01');
  const [totalTicketCount, setTotalTicketCount] = useState('100');
  const [resaleAllowed, setResaleAllowed] = useState(true);
  const [maxResaleRate, setMaxResaleRate] = useState('120');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  const createEvent = async () => {
    if (!name.trim()) {
      Alert.alert('입력 필요', '이벤트명을 입력해야 등록할 수 있습니다.');
      return;
    }
    if (!category.trim()) {
      Alert.alert('입력 필요', '카테고리를 입력해야 등록할 수 있습니다.');
      return;
    }
    if (!venue.trim()) {
      Alert.alert('입력 필요', '장소를 입력해야 등록할 수 있습니다.');
      return;
    }
    if (!eventAt.trim()) {
      Alert.alert('입력 필요', '이벤트 일시를 입력해야 등록할 수 있습니다.');
      return;
    }
    if (!ticketPriceEth.trim()) {
      Alert.alert('입력 필요', '티켓 가격을 입력해야 등록할 수 있습니다.');
      return;
    }
    if (!totalTicketCount.trim()) {
      Alert.alert('입력 필요', '총 티켓 수를 입력해야 등록할 수 있습니다.');
      return;
    }

    const count = Number(totalTicketCount);
    if (!Number.isInteger(count) || count <= 0) {
      Alert.alert('입력 오류', '티켓 수량은 1 이상의 정수여야 합니다.');
      return;
    }
    if (Number.isNaN(Number(ticketPriceEth)) || Number(ticketPriceEth) < 0) {
      Alert.alert('입력 오류', '티켓 가격은 0 이상의 숫자여야 합니다.');
      return;
    }
    if (Number.isNaN(Number(maxResaleRate)) || Number(maxResaleRate) < 100) {
      Alert.alert('입력 오류', '최대 리셀 가격 비율은 100 이상이어야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('등록 불가', statusMessage);
        return;
      }

      const eventDate = new Date(toIso(eventAt));
      const saleStart = new Date();
      saleStart.setMinutes(saleStart.getMinutes() + 5);
      const saleEnd = new Date(eventDate);
      saleEnd.setHours(saleEnd.getHours() - 1);

      if (saleEnd <= saleStart) {
        saleEnd.setTime(saleStart.getTime() + 60 * 60 * 1000);
      }

      const resaleStart = new Date(saleStart);
      resaleStart.setHours(resaleStart.getHours() + 1);

      const maxResalePriceRate = Math.max(10000, Math.round(Number(maxResaleRate || '100') * 100));

      const createdEvent = await backendApi.createEvent({
        name: name.trim(),
        category: category.trim().toUpperCase(),
        venue: venue.trim(),
        description: description.trim() || null,
        imageUrl: null,
        eventAt: eventDate.toISOString(),
        ticketPriceWei: ethToWei(ticketPriceEth),
        totalTicketCount: count,
        primarySaleStart: saleStart.toISOString(),
        primarySaleEnd: saleEnd.toISOString(),
        resaleAllowed,
        maxResalePriceRate,
        resaleStart: resaleAllowed ? resaleStart.toISOString() : null,
        resaleEnd: resaleAllowed ? saleEnd.toISOString() : null,
      });

      setCreated(true);
      Alert.alert('등록 완료', '이벤트가 등록되었습니다.', [
        { text: '티켓 발행으로 이동', onPress: () => navigation.replace('TicketIssue', { eventId: createdEvent.id }) },
      ]);
    } catch (error: any) {
      Alert.alert('등록 실패', errorMessage(error, '이벤트를 등록하지 못했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Create Event</Text>
        <Text style={styles.title}>이벤트 등록</Text>
        <Text style={styles.subtitle}>판매 기간과 리셀 정책은 기본값으로 생성되며, 등록 후 웹/관리 화면에서 조정할 수 있습니다.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>이벤트명</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예: TRUST LIVE 2026" />

          <Text style={styles.label}>카테고리</Text>
          <TextInput style={styles.input} value={category} onChangeText={setCategory} autoCapitalize="characters" />

          <Text style={styles.label}>장소</Text>
          <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="예: 서울 올림픽공원" />

          <Text style={styles.label}>일시</Text>
          <TextInput style={styles.input} value={eventAt} onChangeText={setEventAt} placeholder="YYYY-MM-DDTHH:mm" />

          <Text style={styles.label}>티켓 가격 (ETH)</Text>
          <TextInput
            style={styles.input}
            value={ticketPriceEth}
            onChangeText={setTicketPriceEth}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>총 티켓 수</Text>
          <TextInput
            style={styles.input}
            value={totalTicketCount}
            onChangeText={setTotalTicketCount}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>최대 리셀 가격 비율 (%)</Text>
          <TextInput
            style={styles.input}
            value={maxResaleRate}
            onChangeText={setMaxResaleRate}
            keyboardType="number-pad"
          />

          <TouchableOpacity style={styles.toggleRow} onPress={() => setResaleAllowed((value) => !value)}>
            <Text style={styles.toggleLabel}>리셀 허용</Text>
            <Text style={[styles.toggleBadge, resaleAllowed ? styles.toggleOn : styles.toggleOff]}>
              {resaleAllowed ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>설명</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="이벤트 소개"
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (submitting || created) && styles.disabledButton]}
          disabled={submitting || created}
          onPress={createEvent}
        >
          <Text style={styles.primaryButtonText}>{submitting ? '등록 중...' : created ? '등록 완료' : '이벤트 등록'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 36 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  toggleRow: { marginTop: 14, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: '#0F172A', fontWeight: '800' },
  toggleBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '900' },
  toggleOn: { backgroundColor: '#DCFCE7', color: '#166534' },
  toggleOff: { backgroundColor: '#F1F5F9', color: '#64748B' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
