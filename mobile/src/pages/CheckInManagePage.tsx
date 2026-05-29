import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate, formatEventStatus, formatTicketEntryStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail, UserAdminRecord } from '../types/api';

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

function parsePayload(value: string): QrPayload {
  return JSON.parse(value.trim()) as QrPayload;
}

function checkInErrorDetail(error: unknown) {
  const message = errorMessage(error, '입장 처리에 실패했습니다.');

  if (message.includes('이미') || message.includes('사용 완료') || message.includes('USED')) {
    return { title: '중복 입장', message: '이미 체크인된 티켓입니다.' };
  }
  if (message.includes('권한') || message.includes('FORBIDDEN')) {
    return {
      title: '권한 없음',
      message: '체크인 권한이 없습니다. 전역 검증자 또는 이 이벤트의 검증자로 등록된 계정이어야 합니다.',
    };
  }
  if (message.includes('만료') || message.includes('EXPIRED')) {
    return { title: '만료 QR', message: '만료된 QR입니다. 관람객에게 QR 새로고침을 요청해주세요.' };
  }
  if (message.includes('서명') || message.includes('유효하지') || message.includes('SIGNATURE')) {
    return { title: '서명 오류', message: 'QR 서명 또는 티켓 상태가 유효하지 않습니다.' };
  }

  return { title: '처리 실패', message };
}

type Feedback = {
  type: 'error' | 'success' | 'info';
  title: string;
  message: string;
};

export default function CheckInManagePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const scannedPayload = route?.params?.scannedPayload as string | undefined;
  const [validators, setValidators] = useState<Record<string, unknown>[]>([]);
  const [validatorQuery, setValidatorQuery] = useState('');
  const [validatorResults, setValidatorResults] = useState<UserAdminRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [directIdMode, setDirectIdMode] = useState(false);
  const [directId, setDirectId] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ticketId, setTicketId] = useState('');
  const [claimedOwner, setClaimedOwner] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [signature, setSignature] = useState('');
  const [memo, setMemo] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [validatorOpen, setValidatorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);

  const hasQrInfo = Boolean(ticketId.trim() && claimedOwner.trim() && expiresAt.trim() && signature.trim());
  const expired = useMemo(() => {
    const time = new Date(expiresAt || '').getTime();
    return Number.isFinite(time) && time <= Date.now();
  }, [expiresAt]);
  const qrState = !hasQrInfo ? '스캔 필요' : expired ? '만료 QR' : '검증 대기';

  const checkInAvailability = useMemo(() => {
    if (!event) return { canCheckIn: true, reason: '' };
    const todayStr = new Date().toLocaleDateString('sv-SE'); // "YYYY-MM-DD"
    const rounds = event.rounds ?? [];
    if (rounds.length > 0) {
      if (rounds.some((r) => r.eventDate === todayStr)) return { canCheckIn: true, reason: '' };
      if (rounds.every((r) => r.eventDate < todayStr)) return { canCheckIn: false, reason: '종료된 공연' };
      return { canCheckIn: false, reason: '체크인 예정' };
    }
    const eventDateStr = (event.eventAt || event.eventStartAt || event.startsAt || event.eventDateTime || '').slice(0, 10);
    if (!eventDateStr) return { canCheckIn: true, reason: '' };
    if (eventDateStr === todayStr) return { canCheckIn: true, reason: '' };
    if (eventDateStr < todayStr) return { canCheckIn: false, reason: '종료된 공연' };
    return { canCheckIn: false, reason: '체크인 예정' };
  }, [event]);

  const applyParsedPayload = useCallback((payload: QrPayload) => {
    setTicketId(payload.ticketId || '');
    setClaimedOwner(payload.claimedOwner || '');
    setExpiresAt(normalizeExpiresAt(payload.expiresAt));
    setSignature(payload.signature || '');
  }, []);

  const load = useCallback(async () => {
    try {
      const [eventDetail, data] = await Promise.all([
        backendApi.getEvent(eventId).catch(() => null),
        backendApi.getEventValidators(eventId).catch(() => []),
      ]);
      setEvent(eventDetail);
      setValidators(data);
    } catch (error: any) {
      setFeedback({ type: 'error', title: '조회 실패', message: errorMessage(error, '검증자 목록을 불러오지 못했습니다.') });
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
        const parsed = parsePayload(scannedPayload);
        applyParsedPayload(parsed);
        setFeedback({ type: 'info', title: 'QR 스캔 완료', message: '스캔 결과를 확인한 뒤 입장 처리 버튼을 눌러주세요.' });
      } catch {
        setFeedback({ type: 'error', title: '스캔 실패', message: '스캔한 QR 내용이 올바른 JSON 형식이 아닙니다.' });
      }
    }, [applyParsedPayload, scannedPayload]),
  );

  useEffect(() => {
    if (!ticketId.trim()) {
      setTicket(null);
      return;
    }

    let mounted = true;
    void backendApi
      .getTicket(ticketId.trim())
      .then((detail) => {
        if (mounted) setTicket(detail);
      })
      .catch(() => {
        if (mounted) setTicket(null);
      });

    return () => {
      mounted = false;
    };
  }, [ticketId]);

  const handleValidatorQueryChange = (text: string) => {
    setValidatorQuery(text);
    setValidatorResults([]);
    setSearchError('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!text.trim()) return;
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await backendApi.searchUsers(text.trim());
        setValidatorResults(result.items ?? []);
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          setSearchError('사용자 검색 권한이 없습니다. 하단 "ID 직접 입력"을 사용해 주세요.');
          setDirectIdMode(true);
        } else {
          setSearchError(errorMessage(error, '검색 중 오류가 발생했습니다.'));
        }
        setValidatorResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const addValidatorByUser = async (user: UserAdminRecord) => {
    await registerValidator(String(user.id), user.displayName || user.email || String(user.id));
  };

  const addValidatorById = async () => {
    if (!directId.trim()) {
      Alert.alert('입력 필요', '사용자 ID를 입력해주세요.');
      return;
    }
    await registerValidator(directId.trim(), directId.trim());
  };

  const registerValidator = async (userId: string, label: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.addEventValidator(eventId, { userId });
      setValidatorQuery('');
      setValidatorResults([]);
      setDirectId('');
      setFeedback({ type: 'success', title: '등록 완료', message: `${label}을(를) 검증자로 등록했습니다.` });
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '검증자를 등록하지 못했습니다.');
      setFeedback({ type: 'error', title: '등록 실패', message });
      Alert.alert('검증자 등록 실패', message);
    } finally {
      setSaving(false);
    }
  };

  const applyPayload = () => {
    try {
      const parsed = parsePayload(qrPayload);
      applyParsedPayload(parsed);
      setFeedback({ type: 'info', title: 'QR 반영 완료', message: '입력한 QR 내용을 입장 처리 정보에 반영했습니다.' });
    } catch {
      const message = 'QR payload는 JSON 형식이어야 합니다.';
      setFeedback({ type: 'error', title: 'QR 입력 오류', message });
      Alert.alert('QR 입력 오류', message);
    }
  };

  const checkIn = async () => {
    if (!hasQrInfo) {
      const message = 'QR을 먼저 스캔하거나 QR 내용을 반영해주세요.';
      setFeedback({ type: 'error', title: 'QR 정보 필요', message });
      Alert.alert('QR 정보 필요', message);
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
      setFeedback({ type: 'success', title: '입장 성공', message: '입장 처리가 완료되었습니다.' });
      setMemo('');
    } catch (error: any) {
      const detail = checkInErrorDetail(error);
      setFeedback({ type: 'error', title: detail.title, message: detail.message });
      Alert.alert(detail.title, detail.message);
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
      <Text style={styles.subtitle}>선택된 이벤트의 QR을 검증하고 실제 입장 처리를 진행합니다.</Text>

      <View style={styles.eventBanner}>
        <Text style={styles.eventBannerEyebrow}>선택된 이벤트</Text>
        <Text style={styles.eventBannerTitle}>{event?.name || event?.title || '이벤트를 불러오는 중'}</Text>
        <Text style={styles.eventBannerMeta}>장소 {event?.venue || '-'}</Text>
        <Text style={styles.eventBannerMeta}>일시 {formatEventDate(event?.eventAt || event?.eventDateTime)}</Text>
        <Text style={styles.eventBannerStatus}>{formatEventStatus(event?.status)}</Text>
      </View>

      {feedback ? (
        <View style={[styles.messageBox, feedback.type === 'error' ? styles.errorBox : styles.infoBox]}>
          <Text style={[styles.messageTitle, feedback.type === 'error' ? styles.errorText : styles.infoText]}>{feedback.title}</Text>
          <Text style={[styles.messageText, feedback.type === 'error' ? styles.errorText : styles.infoText]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기본 상태</Text>
        <Text style={styles.cardText}>먼저 QR 스캔 버튼으로 관람객의 체크인 QR을 읽어주세요.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('CheckInScan', { eventId })}>
          <Text style={styles.primaryButtonText}>QR 스캔하기</Text>
        </TouchableOpacity>
      </View>

      {hasQrInfo ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>QR 스캔 결과</Text>
          <Info label="좌석" value={ticket?.seatInfo || `티켓 ${ticketId}`} />
          <Info label="만료 여부" value={expired ? '만료됨' : '유효'} />
          <Info label="상태" value={ticket ? formatTicketEntryStatus(ticket.status) : qrState} />
          <Text style={styles.label}>운영 메모</Text>
          <TextInput style={styles.input} value={memo} onChangeText={setMemo} placeholder="선택 입력" />
          {checkInAvailability.reason ? (
            <View style={styles.checkInBlockedBox}>
              <Text style={styles.checkInBlockedText}>{checkInAvailability.reason}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryButton, (checkingIn || !checkInAvailability.canCheckIn) && styles.disabledButton]}
            disabled={checkingIn || !checkInAvailability.canCheckIn}
            onPress={checkIn}
          >
            <Text style={styles.primaryButtonText}>
              {checkingIn ? '처리 중...' : checkInAvailability.reason || '입장 처리'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.card}>
        <TouchableOpacity style={styles.collapseHeader} onPress={() => setManualOpen((value) => !value)}>
          <Text style={styles.cardTitle}>수동 입력</Text>
          <Text style={styles.chevron}>{manualOpen ? '⌃' : '⌄'}</Text>
        </TouchableOpacity>
        {manualOpen ? (
          <>
            <Text style={styles.cardText}>스캔이 어려운 경우에만 QR payload를 붙여넣어 사용합니다.</Text>
            <TextInput style={[styles.input, styles.textArea]} value={qrPayload} onChangeText={setQrPayload} placeholder='{"ticketId":"...","claimedOwner":"0x...","expiresAt":"...","signature":"..."}' multiline />
            <TouchableOpacity style={styles.secondaryButton} onPress={applyPayload}>
              <Text style={styles.secondaryButtonText}>QR 내용 반영</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.collapseHeader} onPress={() => setValidatorOpen((value) => !value)}>
          <Text style={styles.cardTitle}>검증자 관리</Text>
          <Text style={styles.chevron}>{validatorOpen ? '⌃' : '⌄'}</Text>
        </TouchableOpacity>
        {validatorOpen ? (
          <>
            <Text style={styles.cardText}>이메일 또는 이름으로 검색하거나, ID를 직접 입력해 등록하세요.</Text>

            {!directIdMode ? (
              <>
                <TextInput
                  style={styles.input}
                  value={validatorQuery}
                  onChangeText={handleValidatorQueryChange}
                  placeholder="이메일 또는 이름으로 검색"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searching ? (
                  <ActivityIndicator style={styles.searchSpinner} color="#2563EB" />
                ) : searchError ? (
                  <View style={styles.searchErrorBox}>
                    <Text style={styles.searchErrorText}>{searchError}</Text>
                  </View>
                ) : validatorResults.length > 0 ? (
                  <View style={styles.searchResultList}>
                    {validatorResults.map((user) => (
                      <TouchableOpacity
                        key={String(user.id)}
                        style={[styles.searchResultItem, saving && styles.disabledButton]}
                        disabled={saving}
                        onPress={() => void addValidatorByUser(user)}
                      >
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultName}>{user.displayName || '-'}</Text>
                          <Text style={styles.searchResultSub}>{user.email || String(user.id)}</Text>
                        </View>
                        <Text style={styles.searchResultAction}>{saving ? '등록 중' : '+ 등록'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : validatorQuery.trim() && !searching ? (
                  <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                ) : null}
                <TouchableOpacity style={styles.fallbackToggle} onPress={() => setDirectIdMode(true)}>
                  <Text style={styles.fallbackToggleText}>ID 직접 입력으로 전환</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={directId}
                  onChangeText={setDirectId}
                  placeholder="사용자 ID 입력"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.secondaryButton, saving && styles.disabledButton]}
                  disabled={saving}
                  onPress={() => void addValidatorById()}
                >
                  <Text style={styles.secondaryButtonText}>{saving ? '등록 중...' : '검증자 등록'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fallbackToggle} onPress={() => { setDirectIdMode(false); setSearchError(''); }}>
                  <Text style={styles.fallbackToggleText}>검색으로 전환</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.sectionLabel}>등록된 검증자</Text>
            {validators.length === 0 ? (
              <Text style={styles.emptyText}>등록된 검증자가 없습니다.</Text>
            ) : (
              validators.map((validator, index) => (
                <Text key={String(validator.id ?? index)} style={styles.validatorText}>
                  {String(validator.displayName ?? validator.validatorId ?? validator.userId ?? validator.id ?? '-')}
                </Text>
              ))
            )}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  eventBanner: { marginTop: 14, borderRadius: 16, padding: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  eventBannerEyebrow: { color: '#2563EB', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  eventBannerTitle: { marginTop: 4, color: '#0F172A', fontSize: 18, fontWeight: '900' },
  eventBannerMeta: { marginTop: 4, color: '#1E3A8A', fontSize: 12, fontWeight: '800' },
  eventBannerStatus: { marginTop: 8, color: '#0369A1', fontSize: 12, fontWeight: '900' },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1 },
  infoBox: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  messageTitle: { fontWeight: '900', lineHeight: 20, marginBottom: 4 },
  messageText: { fontWeight: '800', lineHeight: 19 },
  infoText: { color: '#1D4ED8' },
  errorText: { color: '#DC2626' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 20 },
  collapseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chevron: { color: '#64748B', fontSize: 20, fontWeight: '900' },
  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  infoValue: { color: '#0F172A', fontWeight: '900' },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 120, textAlignVertical: 'top', marginTop: 12 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  checkInBlockedBox: { marginTop: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10 },
  checkInBlockedText: { color: '#64748B', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  helpText: { marginTop: 6, color: '#94A3B8', fontSize: 12, lineHeight: 17 },
  searchSpinner: { marginTop: 12 },
  searchErrorBox: { marginTop: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10 },
  searchErrorText: { color: '#DC2626', fontSize: 13, fontWeight: '800', lineHeight: 18 },
  fallbackToggle: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  fallbackToggleText: { color: '#2563EB', fontSize: 13, fontWeight: '800' },
  searchResultList: { marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  searchResultInfo: { flex: 1 },
  searchResultName: { color: '#0F172A', fontWeight: '900', fontSize: 14 },
  searchResultSub: { marginTop: 2, color: '#64748B', fontSize: 12, fontWeight: '700' },
  searchResultAction: { color: '#2563EB', fontWeight: '900', fontSize: 13 },
  sectionLabel: { marginTop: 16, marginBottom: 6, color: '#64748B', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#94A3B8', paddingTop: 14, textAlign: 'center' },
  validatorText: { marginTop: 10, color: '#475569', fontWeight: '800' },
});
