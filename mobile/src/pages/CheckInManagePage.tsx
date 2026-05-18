import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';

type QrPayload = {
  ticketId?: string;
  claimedOwner?: string;
  expiresAt?: string | number;
  signature?: string;
};

function normalizeExpiresAt(value?: string | number) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    return new Date(Number(value) * 1000).toISOString();
  }
  return String(value);
}

function checkInResultMessage(error: unknown) {
  const message = errorMessage(error, '입장 처리에 실패했습니다.');
  if (message.includes('이미 사용')) return '이미 체크인된 티켓입니다.';
  if (message.includes('검증자 권한') || message.includes('FORBIDDEN') || message.includes('권한')) {
    return '체크인 권한이 없습니다. 전역 체크인 검증자이거나 이 이벤트의 검증자로 등록된 계정이어야 합니다.';
  }
  if (message.includes('서명') || message.includes('유효하지')) return 'QR 서명 또는 티켓 상태가 유효하지 않습니다.';
  return message;
}

export default function CheckInManagePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const scannedPayload = route?.params?.scannedPayload as string | undefined;
  const [validatorId, setValidatorId] = useState('');
  const [validators, setValidators] = useState<Record<string, unknown>[]>([]);
  const [ticketId, setTicketId] = useState('');
  const [claimedOwner, setClaimedOwner] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [signature, setSignature] = useState('');
  const [memo, setMemo] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await backendApi.getEventValidators(eventId).catch(() => []);
      setValidators(data);
    } catch (error: any) {
      setFeedback({ type: 'error', message: errorMessage(error, '검증자 목록을 불러오지 못했습니다.') });
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useFocusEffect(
    useCallback(() => {
      if (!scannedPayload) return;
      setQrPayload(scannedPayload);
      try {
        const parsed = JSON.parse(scannedPayload.trim()) as QrPayload;
        setTicketId(parsed.ticketId || '');
        setClaimedOwner(parsed.claimedOwner || '');
        setExpiresAt(normalizeExpiresAt(parsed.expiresAt));
        setSignature(parsed.signature || '');
        setFeedback({ type: 'success', message: '스캔한 QR 정보를 입력 폼에 반영했습니다.' });
      } catch {
        setFeedback({ type: 'error', message: '스캔한 QR 내용이 JSON 형식이 아닙니다.' });
      }
    }, [scannedPayload]),
  );

  const addValidator = async () => {
    if (!validatorId.trim()) {
      const message = '검증자로 등록할 사용자 UUID를 입력해 주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.addEventValidator(eventId, { userId: validatorId.trim() });
      setValidatorId('');
      setFeedback({ type: 'success', message: '체크인 검증자를 등록했습니다.' });
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '검증자를 등록하지 못했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert('검증자 등록 실패', message);
    } finally {
      setSaving(false);
    }
  };

  const applyPayload = () => {
    try {
      const parsed = JSON.parse(qrPayload.trim()) as QrPayload;
      setTicketId(parsed.ticketId || '');
      setClaimedOwner(parsed.claimedOwner || '');
      setExpiresAt(normalizeExpiresAt(parsed.expiresAt));
      setSignature(parsed.signature || '');
      setFeedback({ type: 'success', message: 'QR payload를 입력 폼에 반영했습니다.' });
    } catch {
      const message = 'QR payload는 JSON 형식이어야 합니다.';
      setFeedback({ type: 'error', message });
      Alert.alert('QR 입력 오류', message);
    }
  };

  const checkIn = async () => {
    if (!ticketId.trim() || !claimedOwner.trim() || !expiresAt.trim() || !signature.trim()) {
      const message = 'ticketId, 소유자 지갑, 만료 시간, 서명이 모두 필요합니다.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    setCheckingIn(true);
    setFeedback(null);
    try {
      await backendApi.checkIn({
        ticketId: ticketId.trim(),
        claimedOwner: claimedOwner.trim(),
        expiresAt: expiresAt.trim(),
        signature: signature.trim(),
        memo: memo.trim() || null,
      });
      setFeedback({ type: 'success', message: '입장 처리가 완료되었습니다.' });
      setMemo('');
    } catch (error: any) {
      const message = checkInResultMessage(error);
      setFeedback({ type: 'error', message });
      Alert.alert('입장 처리 실패', message);
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Check-in Manage</Text>
      <Text style={styles.title}>체크인 관리</Text>
      <Text style={styles.subtitle}>전역 체크인 검증자 또는 이 이벤트의 검증자로 등록된 계정이 QR payload를 스캔/입력해 입장 처리를 진행합니다.</Text>

      {feedback ? (
        <View style={[styles.messageBox, feedback.type === 'error' ? styles.errorBox : styles.infoBox]}>
          <Text style={[styles.messageText, feedback.type === 'error' ? styles.errorText : styles.infoText]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>QR/바코드 입력</Text>
        <Text style={styles.cardText}>카메라로 QR을 스캔하거나 QR payload를 직접 붙여넣을 수 있습니다.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('CheckInScan', { eventId })}>
          <Text style={styles.primaryButtonText}>QR 스캔</Text>
        </TouchableOpacity>
        <TextInput style={[styles.input, styles.textArea]} value={qrPayload} onChangeText={setQrPayload} placeholder='{"ticketId":"...","claimedOwner":"0x...","expiresAt":"...","signature":"..."}' multiline />
        <TouchableOpacity style={styles.secondaryButton} onPress={applyPayload}>
          <Text style={styles.secondaryButtonText}>QR 내용 반영</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>입장 처리</Text>
        <Text style={styles.label}>티켓 ID</Text>
        <TextInput style={styles.input} value={ticketId} onChangeText={setTicketId} autoCapitalize="none" />
        <Text style={styles.label}>소유자 지갑 주소</Text>
        <TextInput style={styles.input} value={claimedOwner} onChangeText={setClaimedOwner} autoCapitalize="none" />
        <Text style={styles.label}>만료 시간</Text>
        <TextInput style={styles.input} value={expiresAt} onChangeText={setExpiresAt} placeholder="ISO 시간 또는 QR epoch" autoCapitalize="none" />
        <Text style={styles.label}>서명</Text>
        <TextInput style={[styles.input, styles.textAreaSmall]} value={signature} onChangeText={setSignature} autoCapitalize="none" multiline />
        <Text style={styles.label}>메모</Text>
        <TextInput style={styles.input} value={memo} onChangeText={setMemo} placeholder="선택 입력" />
        <TouchableOpacity style={[styles.primaryButton, checkingIn && styles.disabledButton]} disabled={checkingIn} onPress={checkIn}>
          <Text style={styles.primaryButtonText}>{checkingIn ? '처리 중...' : '입장 처리'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>검증자 관리</Text>
        <Text style={styles.cardText}>전역 체크인 검증자는 모든 이벤트를 검증할 수 있고, 이벤트별 검증자는 이 이벤트에 대해서만 체크인할 수 있습니다.</Text>
        <TextInput style={styles.input} value={validatorId} onChangeText={setValidatorId} placeholder="검증자 사용자 UUID" autoCapitalize="none" />
        <TouchableOpacity style={[styles.secondaryButton, saving && styles.disabledButton]} disabled={saving} onPress={addValidator}>
          <Text style={styles.secondaryButtonText}>{saving ? '등록 중...' : '검증자 등록'}</Text>
        </TouchableOpacity>
        {validators.length === 0 ? (
          <Text style={styles.emptyText}>등록된 검증자가 없습니다.</Text>
        ) : (
          validators.map((validator, index) => (
            <Text key={String(validator.id ?? index)} style={styles.validatorText}>
              {String(validator.displayName ?? validator.validatorId ?? validator.userId ?? validator.id ?? '-')}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1 },
  infoBox: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  messageText: { fontWeight: '800', lineHeight: 19 },
  infoText: { color: '#1D4ED8' },
  errorText: { color: '#DC2626' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 20 },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  textAreaSmall: { minHeight: 74, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  emptyText: { color: '#94A3B8', paddingTop: 14, textAlign: 'center' },
  validatorText: { marginTop: 10, color: '#475569', fontWeight: '800' },
});
