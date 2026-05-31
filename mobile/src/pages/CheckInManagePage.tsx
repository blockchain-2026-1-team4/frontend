import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate, formatEventStatus, formatTicketEntryStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail, UserAdminRecord } from '../types/api';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

function QrIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <Path d="M14 14h2v2h-2zM18 14h2v6h-6v-2h4zM14 18h2" />
    </Svg>
  );
}

type QrPayload = { ticketId?: string; claimedOwner?: string; expiresAt?: string | number; signature?: string };
type Feedback = { type: 'error' | 'success' | 'info'; title: string; message: string };

function normalizeExpiresAt(value?: string | number) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return new Date(Number(value) * 1000).toISOString();
  return String(value);
}

function parsePayload(value: string): QrPayload {
  return JSON.parse(value.trim()) as QrPayload;
}

function checkInErrorDetail(error: unknown) {
  const message = errorMessage(error, '입장 처리에 실패했습니다.');
  if (message.includes('이미') || message.includes('사용 완료') || message.includes('USED')) return { title: '중복 입장', message: '이미 체크인된 티켓입니다.' };
  if (message.includes('권한') || message.includes('FORBIDDEN')) return { title: '권한 없음', message: '체크인 권한이 없습니다. 전역 검증자 또는 이 이벤트의 검증자로 등록된 계정이어야 합니다.' };
  if (message.includes('만료') || message.includes('EXPIRED')) return { title: '만료 QR', message: '만료된 QR입니다. 관람객에게 QR 새로고침을 요청해주세요.' };
  if (message.includes('서명') || message.includes('유효하지') || message.includes('SIGNATURE')) return { title: '서명 오류', message: 'QR 서명 또는 티켓 상태가 유효하지 않습니다.' };
  return { title: '처리 실패', message };
}

export default function CheckInManagePage({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
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
    const now = Date.now();
    const end = new Date(event.eventEndAt || event.endsAt || '').getTime();
    if (!Number.isNaN(end) && now > end) return { canCheckIn: false, reason: '종료된 공연' };
    const todayStr = new Date().toLocaleDateString('sv-SE');
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

  useFocusEffect(useCallback(() => {
    if (!scannedPayload) return;
    setQrPayload(scannedPayload);
    try {
      applyParsedPayload(parsePayload(scannedPayload));
      setFeedback({ type: 'info', title: 'QR 스캔 완료', message: '스캔 결과를 확인한 뒤 입장 처리 버튼을 눌러주세요.' });
    } catch {
      setFeedback({ type: 'error', title: '스캔 실패', message: '스캔한 QR 내용이 올바른 JSON 형식이 아닙니다.' });
    }
  }, [applyParsedPayload, scannedPayload]));

  useEffect(() => {
    if (!ticketId.trim()) { setTicket(null); return; }
    let mounted = true;
    void backendApi.getTicket(ticketId.trim()).then((detail) => { if (mounted) setTicket(detail); }).catch(() => { if (mounted) setTicket(null); });
    return () => { mounted = false; };
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
        if (status === 401 || status === 403) { setSearchError('사용자 검색 권한이 없습니다. 하단 "ID 직접 입력"을 사용해 주세요.'); setDirectIdMode(true); }
        else setSearchError(errorMessage(error, '검색 중 오류가 발생했습니다.'));
        setValidatorResults([]);
      } finally { setSearching(false); }
    }, 400);
  };

  const registerValidator = async (userId: string, label: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.addEventValidator(eventId, { userId });
      setValidatorQuery(''); setValidatorResults([]); setDirectId('');
      setFeedback({ type: 'success', title: '등록 완료', message: `${label}을(를) 검증자로 등록했습니다.` });
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '검증자를 등록하지 못했습니다.');
      setFeedback({ type: 'error', title: '등록 실패', message });
      Alert.alert('검증자 등록 실패', message);
    } finally { setSaving(false); }
  };

  const applyPayload = () => {
    try {
      applyParsedPayload(parsePayload(qrPayload));
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
      await backendApi.checkIn({ ticketId: ticketId.trim(), claimedOwner: claimedOwner.trim(), expiresAt: expiresAt.trim(), signature: signature.trim(), memo: memo.trim() || null });
      setFeedback({ type: 'success', title: '입장 성공', message: '입장 처리가 완료되었습니다.' });
      setMemo('');
    } catch (error: any) {
      const detail = checkInErrorDetail(error);
      setFeedback({ type: 'error', title: detail.title, message: detail.message });
      Alert.alert(detail.title, detail.message);
    } finally { setCheckingIn(false); }
  };

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('CheckInHome');
  };

  const feedbackBg = feedback?.type === 'error' ? '#FEF2F2' : feedback?.type === 'success' ? '#ECFDF5' : '#EEEDFE';
  const feedbackBorder = feedback?.type === 'error' ? '#FECACA' : feedback?.type === 'success' ? '#BBF7D0' : '#C4C0F5';
  const feedbackColor = feedback?.type === 'error' ? '#B91C1C' : feedback?.type === 'success' ? '#047857' : '#534AB7';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}>
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
            <BackIcon />
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanHeroButton} onPress={() => navigation.navigate('CheckInScan', { eventId })}>
            <QrIcon />
            <Text style={styles.scanHeroButtonText}>QR 스캔</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>CHECK-IN MANAGE</Text>
        <Text style={styles.heroTitle}>체크인 관리</Text>
        <Text style={styles.heroSub}>QR을 검증하고 실제 입장 처리를 진행합니다.</Text>
        {event ? (
          <View style={styles.heroChip}>
            <View style={styles.heroDot} />
            <Text style={styles.heroChipText} numberOfLines={1}>{event.name || event.title || '이벤트'} · {formatEventStatus(event.status)}</Text>
          </View>
        ) : null}
      </HeroGradient>

      {feedback ? (
        <View style={[styles.feedbackBox, { backgroundColor: feedbackBg, borderColor: feedbackBorder }]}>
          <Text style={[styles.feedbackTitle, { color: feedbackColor }]}>{feedback.title}</Text>
          <Text style={[styles.feedbackText, { color: feedbackColor }]}>{feedback.message}</Text>
        </View>
      ) : null}

      {event ? (
        <View style={styles.eventBanner}>
          <Text style={styles.bannerLabel}>선택된 이벤트</Text>
          <Text style={styles.bannerTitle}>{event.name || event.title || '이벤트를 불러오는 중'}</Text>
          <Text style={styles.bannerMeta}>장소 {event.venue || '-'} · {formatEventDate(event.eventAt || event.eventDateTime)}</Text>
        </View>
      ) : null}

      {hasQrInfo ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>QR 스캔 결과</Text>
          <InfoRow label="좌석" value={ticket?.seatInfo || `티켓 ${ticketId}`} />
          <InfoRow label="만료 여부" value={expired ? '만료됨' : '유효'} />
          <InfoRow label="상태" value={ticket ? formatTicketEntryStatus(ticket.status) : qrState} />
          <Text style={styles.label}>운영 메모</Text>
          <TextInput style={styles.input} value={memo} onChangeText={setMemo} placeholder="선택 입력" />
          {checkInAvailability.reason ? (
            <View style={styles.blockedBox}>
              <Text style={styles.blockedText}>{checkInAvailability.reason}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryButton, (checkingIn || !checkInAvailability.canCheckIn) && styles.disabledButton]}
            disabled={checkingIn || !checkInAvailability.canCheckIn}
            onPress={checkIn}
          >
            <Text style={styles.primaryButtonText}>{checkingIn ? '처리 중...' : checkInAvailability.reason || '입장 처리'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>입장 처리</Text>
          <Text style={styles.cardText}>우측 상단 QR 스캔 버튼으로 관람객의 체크인 QR을 읽어주세요.</Text>
        </View>
      )}

      <View style={styles.card}>
        <TouchableOpacity style={styles.collapseHeader} onPress={() => setManualOpen((v) => !v)}>
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
        <TouchableOpacity style={styles.collapseHeader} onPress={() => setValidatorOpen((v) => !v)}>
          <Text style={styles.cardTitle}>검증자 관리</Text>
          <Text style={styles.chevron}>{validatorOpen ? '⌃' : '⌄'}</Text>
        </TouchableOpacity>
        {validatorOpen ? (
          <>
            <Text style={styles.cardText}>이메일 또는 이름으로 검색하거나, ID를 직접 입력해 등록하세요.</Text>
            {!directIdMode ? (
              <>
                <TextInput style={styles.input} value={validatorQuery} onChangeText={handleValidatorQueryChange} placeholder="이메일 또는 이름으로 검색" autoCapitalize="none" autoCorrect={false} />
                {searching ? <ActivityIndicator style={styles.searchSpinner} color="#534AB7" /> : null}
                {searchError ? <View style={styles.errorBox}><Text style={styles.errorText}>{searchError}</Text></View> : null}
                {validatorResults.length > 0 ? (
                  <View style={styles.searchResultList}>
                    {validatorResults.map((user) => (
                      <TouchableOpacity key={String(user.id)} style={[styles.searchResultItem, saving && styles.disabledButton]} disabled={saving} onPress={() => void registerValidator(String(user.id), user.displayName || user.email || String(user.id))}>
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultName}>{user.displayName || '-'}</Text>
                          <Text style={styles.searchResultSub}>{user.email || String(user.id)}</Text>
                        </View>
                        <Text style={styles.searchResultAction}>{saving ? '등록 중' : '+ 등록'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : validatorQuery.trim() && !searching ? <Text style={styles.emptyText}>검색 결과가 없습니다.</Text> : null}
                <TouchableOpacity style={styles.fallbackToggle} onPress={() => setDirectIdMode(true)}>
                  <Text style={styles.fallbackToggleText}>ID 직접 입력으로 전환</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput style={styles.input} value={directId} onChangeText={setDirectId} placeholder="사용자 ID 입력" autoCapitalize="none" autoCorrect={false} />
                <TouchableOpacity style={[styles.secondaryButton, saving && styles.disabledButton]} disabled={saving} onPress={() => void registerValidator(directId.trim(), directId.trim())}>
                  <Text style={styles.secondaryButtonText}>{saving ? '등록 중...' : '검증자 등록'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fallbackToggle} onPress={() => { setDirectIdMode(false); setSearchError(''); }}>
                  <Text style={styles.fallbackToggleText}>검색으로 전환</Text>
                </TouchableOpacity>
              </>
            )}
            <Text style={styles.sectionLabel}>등록된 검증자</Text>
            {validators.length === 0 ? <Text style={styles.emptyText}>등록된 검증자가 없습니다.</Text> : (
              validators.map((validator, index) => {
                const displayName = String(validator.validatorDisplayName ?? validator.displayName ?? '').trim();
                const email = String(validator.validatorEmail ?? validator.email ?? '').trim();
                const nameLabel = displayName || email || '-';
                const emailLabel = displayName ? email : '';
                return (
                  <View key={String(validator.id ?? index)} style={styles.validatorRow}>
                    <Text style={styles.validatorName}>{nameLabel}</Text>
                    {emailLabel ? <Text style={styles.validatorEmail}>{emailLabel}</Text> : null}
                  </View>
                );
              })
            )}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  scanHeroButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  scanHeroButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  feedbackBox: { marginHorizontal: 16, marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 0.5 },
  feedbackTitle: { fontWeight: '800', marginBottom: 4, fontSize: 13 },
  feedbackText: { fontWeight: '700', lineHeight: 18, fontSize: 13 },
  eventBanner: { marginHorizontal: 16, marginTop: 14, borderRadius: 14, padding: 14, backgroundColor: '#EEEDFE', borderWidth: 0.5, borderColor: '#C4C0F5' },
  bannerLabel: { color: '#534AB7', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  bannerTitle: { color: '#1A1A2E', fontSize: 16, fontWeight: '800' },
  bannerMeta: { marginTop: 4, color: '#534AB7', fontSize: 11, fontWeight: '700' },
  card: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardTitle: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  cardText: { marginTop: 8, color: '#6B7280', lineHeight: 19, fontSize: 13 },
  collapseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chevron: { color: '#9CA3AF', fontSize: 18, fontWeight: '800' },
  infoRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  infoLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  infoValue: { color: '#1A1A2E', fontWeight: '800', fontSize: 13 },
  label: { marginTop: 12, marginBottom: 6, color: '#1A1A2E', fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, backgroundColor: '#FFFFFF', color: '#1A1A2E' },
  textArea: { minHeight: 100, textAlignVertical: 'top', marginTop: 10 },
  primaryButton: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { borderWidth: 0.5, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#1A1A2E', fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
  blockedBox: { marginTop: 10, backgroundColor: '#F5F5F5', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 10 },
  blockedText: { color: '#6B7280', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  searchSpinner: { marginTop: 12 },
  errorBox: { marginTop: 10, backgroundColor: '#FEF2F2', borderWidth: 0.5, borderColor: '#FECACA', borderRadius: 10, padding: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  fallbackToggle: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  fallbackToggleText: { color: '#534AB7', fontSize: 12, fontWeight: '800' },
  searchResultList: { marginTop: 10, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 12, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  searchResultInfo: { flex: 1 },
  searchResultName: { color: '#1A1A2E', fontWeight: '800', fontSize: 13 },
  searchResultSub: { marginTop: 2, color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  searchResultAction: { color: '#534AB7', fontWeight: '800', fontSize: 12 },
  sectionLabel: { marginTop: 16, marginBottom: 6, color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  emptyText: { color: '#9CA3AF', paddingTop: 12, textAlign: 'center', fontSize: 12 },
  validatorRow: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  validatorName: { color: '#1A1A2E', fontWeight: '800', fontSize: 13 },
  validatorEmail: { marginTop: 2, color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
});
