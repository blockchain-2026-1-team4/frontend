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

const EVENT_CATEGORIES = [
  { value: 'CONCERT', label: '공연' },
  { value: 'SPORTS', label: '스포츠' },
  { value: 'EXHIBITION', label: '전시' },
  { value: 'FESTIVAL', label: '페스티벌' },
  { value: 'ETC', label: '기타' },
];

function toDatetimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDatetime(value: string, label: string) {
  const normalized = value.trim().replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    throw new Error(`${label}은 YYYY-MM-DDTHH:mm 형식으로 입력해주세요.`);
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} 형식이 올바르지 않습니다.`);
  }
  return date;
}

export default function EventCreatePage({ navigation }: any) {
  const defaults = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + 14);
    start.setHours(19, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    const saleStart = new Date();
    saleStart.setDate(saleStart.getDate() + 1);
    saleStart.setHours(12, 0, 0, 0);
    const saleEnd = new Date(start);
    saleEnd.setHours(saleEnd.getHours() - 2);
    return { start, end, saleStart, saleEnd };
  }, []);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('CONCERT');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [eventStartAt, setEventStartAt] = useState(toDatetimeLocal(defaults.start));
  const [eventEndAt, setEventEndAt] = useState(toDatetimeLocal(defaults.end));
  const [salesStartAt, setSalesStartAt] = useState(toDatetimeLocal(defaults.saleStart));
  const [salesEndAt, setSalesEndAt] = useState(toDatetimeLocal(defaults.saleEnd));
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const showError = (title: string, message: string) => {
    setFeedback({ type: 'error', message });
    Alert.alert(title, message);
  };

  const createEvent = async () => {
    setFeedback(null);
    if (!name.trim()) return showError('입력 필요', '이벤트명을 입력해주세요.');
    if (!venue.trim()) return showError('입력 필요', '장소를 입력해주세요.');
    if (!description.trim()) return showError('입력 필요', '설명을 입력해주세요.');
    if (!imageUrl.trim()) return showError('입력 필요', '포스터 이미지 URL을 입력해주세요.');

    let eventStart: Date;
    let eventEnd: Date;
    let saleStart: Date;
    let saleEnd: Date;
    try {
      eventStart = parseDatetime(eventStartAt, '이벤트 시작 일시');
      eventEnd = parseDatetime(eventEndAt, '이벤트 종료 일시');
      saleStart = parseDatetime(salesStartAt, '판매 시작 일시');
      saleEnd = parseDatetime(salesEndAt, '판매 종료 일시');
    } catch (error: any) {
      return showError('입력 오류', error.message);
    }
    if (eventEnd <= eventStart) return showError('입력 오류', '이벤트 종료 일시는 시작 일시보다 늦어야 합니다.');
    if (saleEnd <= saleStart) return showError('입력 오류', '판매 종료 일시는 판매 시작 일시보다 늦어야 합니다.');

    setSubmitting(true);
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) return showError('등록 불가', statusMessage);

      const createdEvent = await backendApi.createEvent({
        name: name.trim(),
        category,
        venue: venue.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        eventAt: eventStart.toISOString(),
        eventStartAt: eventStart.toISOString(),
        eventEndAt: eventEnd.toISOString(),
        startsAt: eventStart.toISOString(),
        endsAt: eventEnd.toISOString(),
        primarySaleStart: saleStart.toISOString(),
        primarySaleEnd: saleEnd.toISOString(),
        salesStartAt: saleStart.toISOString(),
        salesEndAt: saleEnd.toISOString(),
        ticketPriceWei: '1',
        totalTicketCount: 0,
        resaleAllowed: false,
        maxResalePriceRate: 10000,
        resaleStart: null,
        resaleEnd: null,
      });

      setFeedback({ type: 'success', message: '이벤트가 등록되었습니다. 이제 티켓 정책을 설정해주세요.' });
      Alert.alert('등록 완료', '이벤트가 등록되었습니다. 티켓 발행 화면으로 이동합니다.');
      navigation.replace('TicketIssue', { eventId: createdEvent.id });
    } catch (error: any) {
      showError('등록 실패', errorMessage(error, '이벤트를 등록하지 못했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Event Create</Text>
        <Text style={styles.title}>이벤트 등록</Text>
        <Text style={styles.subtitle}>이벤트 정보와 티켓 정책을 분리합니다. 가격, 수량, 리셀 정책은 티켓 발행 단계에서 구역별로 설정하세요.</Text>

        {feedback ? (
          <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
            <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>이벤트명</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="TRUST LIVE 2026" />

          <Text style={styles.label}>카테고리</Text>
          <View style={styles.categoryGrid}>
            {EVENT_CATEGORIES.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.activeCategoryChip]} onPress={() => setCategory(item.value)}>
                <Text style={[styles.categoryChipText, category === item.value && styles.activeCategoryChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>장소</Text>
          <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="서울 올림픽공원" />

          <Text style={styles.label}>포스터 이미지 URL</Text>
          <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." autoCapitalize="none" />

          <Text style={styles.label}>이벤트 시작 일시</Text>
          <TextInput style={styles.input} value={eventStartAt} onChangeText={setEventStartAt} placeholder="YYYY-MM-DDTHH:mm" />

          <Text style={styles.label}>이벤트 종료 일시</Text>
          <TextInput style={styles.input} value={eventEndAt} onChangeText={setEventEndAt} placeholder="YYYY-MM-DDTHH:mm" />

          <Text style={styles.label}>판매 시작 일시</Text>
          <TextInput style={styles.input} value={salesStartAt} onChangeText={setSalesStartAt} placeholder="YYYY-MM-DDTHH:mm" />

          <Text style={styles.label}>판매 종료 일시</Text>
          <TextInput style={styles.input} value={salesEndAt} onChangeText={setSalesEndAt} placeholder="YYYY-MM-DDTHH:mm" />

          <Text style={styles.label}>설명</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="이벤트 소개" multiline />
        </View>

        <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabledButton]} disabled={submitting} onPress={createEvent}>
          <Text style={styles.primaryButtonText}>{submitting ? '등록 중...' : '이벤트 등록 후 티켓 설정'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#2563EB' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
