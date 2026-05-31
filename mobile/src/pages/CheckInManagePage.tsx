import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
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
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <Path d="M14 14h2v2h-2zM18 14h2v6h-6v-2h4zM14 18h2" />
    </Svg>
  );
}

function KeyboardIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8M6 14h.01M18 14h.01" />
    </Svg>
  );
}

function UserCheckIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7 2 2 2 4-4" />
    </Svg>
  );
}

function ArrowRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12h14m-7-7 7 7-7 7" />
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
        setSearchError(errorMessage(error, '검색 중 오류가 발생했습니다.'));
        setValidatorResults([]);
      } finally { setSearching(false); }
    }, 400);
  };

  const registerValidator = async (userId: string, label: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.addEventValidator(eventId, { userId });
      setValidatorQuery(''); setValidatorResults([]);
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

  const canScan = checkInAvailability.canCheckIn;
  const canManageValidators = checkInAvailability.reason !== '종료된 공연';

  const feedbackBg = feedback?.type === 'error' ? '#FEF2F2' : feedback?.type === 'success' ? '#ECFDF5' : '#EEEDFE';
  const feedbackBorder = feedback?.type === 'error' ? '#FECACA' : feedback?.type === 'success' ? '#BBF7D0' : '#C4C0F5';
  const feedbackColor = feedback?.type === 'error' ? '#B91C1C' : feedback?.type === 'success' ? '#047857' : '#534AB7';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 14, 36) }]}>
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.eyebrow}>Check-in Manage</Text>
          <View style={{ width: 28 }} />
        </View>
        <Text style={styles.heroTitle}>체크인 관리</Text>
        <Text style={styles.heroSub}>QR을 검증하고 실제 입장 처리를 진행합니다.</Text>
        {event ? (
          <View style={styles.heroChip}>
            <View style={styles.heroDot} />
            <Text style={styles.heroChipText} numberOfLines={1}>{event.name || event.title || '이벤트'} · {formatEventStatus(event.status)}</Text>
          </View>
        ) : null}
      </HeroGradient>

      {event ? (
        <View style={styles.ectx}>
          <Text style={styles.ectl}>선택된 이벤트</Text>
          <Text style={styles.ecn}>{event.name || event.title || '이벤트'}</Text>
          <Text style={styles.ecm}>{event.venue || '-'} · {formatEventDate(event.eventAt || event.eventDateTime)}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.qrScanCard, !canScan && styles.qrScanCardDisabled]}
        onPress={() => navigation.navigate('CheckInScan', { eventId })}
        disabled={!canScan}
      >
        <View style={[styles.qrScanIconBox, !canScan && styles.qrScanIconBoxDisabled]}>
          <QrIcon />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.qrScanTitle}>QR 스캐너로 입장 처리</Text>
          <Text style={styles.qrScanSub}>
            {canScan ? '카메라로 관람객 QR을 스캔하세요.' : `${checkInAvailability.reason} · QR 스캔 불가`}
          </Text>
        </View>
        <ArrowRightIcon />
      </TouchableOpacity>

      {feedback ? (
        <View style={[styles.feedbackBox, { backgroundColor: feedbackBg, borderColor: feedbackBorder }]}>
          <Text style={[styles.feedbackTitle, { color: feedbackColor }]}>{feedback.title}</Text>
          <Text style={[styles.feedbackText, { color: feedbackColor }]}>{feedback.message}</Text>
        </View>
      ) : null}

      {hasQrInfo ? (
        <View style={styles.qrResultCard}>
          <Text style={styles.qrResultTitle}>QR 스캔 결과</Text>
          <InfoRow label="좌석" value={ticket?.seatInfo || `티켓 ${ticketId}`} />
          <InfoRow label="만료 여부" value={expired ? '만료됨' : '유효'} />
          <InfoRow label="상태" value={ticket ? formatTicketEntryStatus(ticket.status) : qrState} />
          <Text style={styles.inputLabel}>운영 메모</Text>
          <TextInput style={styles.memoInput} value={memo} onChangeText={setMemo} placeholder="선택 입력" />
          {checkInAvailability.reason ? (
            <View style={styles.blockedBox}>
              <Text style={styles.blockedText}>{checkInAvailability.reason}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.checkInButton, (checkingIn || !checkInAvailability.canCheckIn) && styles.disabledButton]}
            disabled={checkingIn || !checkInAvailability.canCheckIn}
            onPress={checkIn}
          >
            <Text style={styles.checkInButtonText}>{checkingIn ? '처리 중...' : checkInAvailability.reason || '입장 처리'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 수동 입력 */}
      <View style={[styles.mc, !canScan && styles.mcDisabled]}>
        <TouchableOpacity style={styles.mch} onPress={() => canScan && setManualOpen((v) => !v)} disabled={!canScan}>
          <View style={[styles.mcIcon, { backgroundColor: '#F3F4F6' }]}>
            <KeyboardIcon />
          </View>
          <Text style={[styles.mcTitle, { color: canScan ? '#6B7280' : '#B4B2A9', flex: 1 }]}>
            수동 입력{'  '}<Text style={styles.mcSubLabel}>(QR 불가 시)</Text>
          </Text>
          <Text style={[styles.mcChev, manualOpen && styles.mcChevOpen]}>›</Text>
        </TouchableOpacity>
        {manualOpen ? (
          <View style={styles.mcBody}>
            <Text style={styles.mcHint}>QR 스캔이 어려운 경우에만 payload를 직접 붙여넣어 사용합니다.</Text>
            <TextInput
              style={styles.payloadInput}
              value={qrPayload}
              onChangeText={setQrPayload}
              placeholder={'{"ticketId":"...","claimedOwner":"0x...","expiresAt":"...","signature":"..."}'}
              multiline
            />
            <TouchableOpacity style={styles.applyBtn} onPress={applyPayload}>
              <Text style={styles.applyBtnText}>QR 내용 반영</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* 검증자 관리 */}
      <View style={[styles.mc, !canManageValidators && styles.mcDisabled]}>
        <TouchableOpacity style={styles.mch} onPress={() => canManageValidators && setValidatorOpen((v) => !v)} disabled={!canManageValidators}>
          <View style={[styles.mcIcon, { backgroundColor: canManageValidators ? '#E6F1FB' : '#F3F4F6' }]}>
            <UserCheckIcon />
          </View>
          <Text style={[styles.mcTitle, { color: canManageValidators ? '#185FA5' : '#B4B2A9', flex: 1 }]}>검증자 관리</Text>
          {canManageValidators ? (
            <View style={styles.validatorCountBadge}>
              <Text style={styles.validatorCountText}>{validators.length}명</Text>
            </View>
          ) : (
            <Text style={styles.mcDisabledLabel}>종료됨</Text>
          )}
          <Text style={[styles.mcChev, validatorOpen && styles.mcChevOpen]}>›</Text>
        </TouchableOpacity>
        {validatorOpen ? (
          <View style={styles.mcBody}>
            <Text style={styles.mcHint}>이 이벤트의 체크인을 처리할 수 있는 검증자를 등록하세요.</Text>
            {validators.map((validator, index) => {
              const nameLabel = String(validator.validatorDisplayName ?? validator.displayName ?? validator.email ?? validator.validatorEmail ?? '').trim() || '-';
              const walletRaw = String(validator.walletAddress ?? validator.validatorWalletAddress ?? '').trim();
              const walletShort = walletRaw.length > 10 ? `${walletRaw.slice(0, 6)}...${walletRaw.slice(-4)}` : walletRaw;
              return (
                <View key={String(validator.id ?? index)} style={styles.vRow}>
                  <View style={styles.vAvatar}>
                    <Text style={styles.vAvatarText}>{nameLabel[0] ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vName}>{nameLabel}</Text>
                    <Text style={styles.vMeta}>{walletShort ? `검증자 · ${walletShort}` : '검증자'}</Text>
                  </View>
                </View>
              );
            })}
            <View style={styles.vAddSection}>
              <TextInput
                style={styles.vInput}
                value={validatorQuery}
                onChangeText={handleValidatorQueryChange}
                placeholder="닉네임으로 검색"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searching ? <ActivityIndicator style={{ marginTop: 8 }} color="#534AB7" /> : null}
              {searchError ? <Text style={styles.searchErrorText}>{searchError}</Text> : null}
              {validatorResults.length > 0 ? (
                <View style={styles.searchResultList}>
                  {validatorResults.map((user) => {
                    const nick = user.displayName || user.email || String(user.id);
                    return (
                      <TouchableOpacity
                        key={String(user.id)}
                        style={[styles.searchResultItem, saving && styles.disabledButton]}
                        disabled={saving}
                        onPress={() => void registerValidator(String(user.id), nick)}
                      >
                        <View style={styles.searchResultAvatar}>
                          <Text style={styles.searchResultAvatarText}>{String(nick)[0] ?? '?'}</Text>
                        </View>
                        <Text style={styles.searchResultName}>{nick}</Text>
                        <Text style={styles.searchResultAction}>{saving ? '등록 중' : '+ 등록'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : validatorQuery.trim() && !searching ? (
                <Text style={styles.searchEmptyText}>검색 결과가 없습니다.</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      <View style={{ height: 8 }} />
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
  content: { paddingBottom: 80 },
  hero: { paddingHorizontal: 18, paddingBottom: 26 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  backButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1, textAlign: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', lineHeight: 24, marginBottom: 3 },
  heroSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 3 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 10 },
  ectx: { backgroundColor: '#EEEDFE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 14, marginTop: 10 },
  ectl: { fontSize: 9, fontWeight: '700', color: '#534AB7', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  ecn: { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },
  ecm: { fontSize: 10, color: '#534AB7', marginTop: 2 },
  qrScanCard: { marginHorizontal: 14, marginTop: 10, backgroundColor: '#1A1A2E', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrScanCardDisabled: { opacity: 0.42 },
  qrScanIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  qrScanIconBoxDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  qrScanTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  qrScanSub: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 },
  feedbackBox: { marginHorizontal: 14, marginTop: 10, borderRadius: 12, padding: 12, borderWidth: 0.5 },
  feedbackTitle: { fontWeight: '800', marginBottom: 4, fontSize: 13 },
  feedbackText: { fontWeight: '700', lineHeight: 18, fontSize: 13 },
  qrResultCard: { marginHorizontal: 14, marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  qrResultTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  infoRow: { paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  infoLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  infoValue: { color: '#1A1A2E', fontWeight: '800', fontSize: 12 },
  inputLabel: { marginTop: 12, marginBottom: 5, color: '#1A1A2E', fontSize: 11, fontWeight: '700' },
  memoInput: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 9, padding: 10, backgroundColor: '#FFFFFF', color: '#1A1A2E', fontSize: 12 },
  blockedBox: { marginTop: 8, backgroundColor: '#F5F5F5', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 9, padding: 10 },
  blockedText: { color: '#6B7280', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  checkInButton: { marginTop: 12, backgroundColor: '#1A1A2E', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  checkInButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  mc: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, marginTop: 10, overflow: 'hidden' },
  mcDisabled: { opacity: 0.45 },
  mcDisabledLabel: { fontSize: 9, fontWeight: '700', color: '#B4B2A9', marginRight: 6 },
  mch: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  mcIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mcTitle: { fontSize: 11, fontWeight: '700' },
  mcSubLabel: { fontSize: 9, color: '#B4B2A9' },
  mcChev: { fontSize: 13, color: '#B4B2A9' },
  mcChevOpen: { transform: [{ rotate: '90deg' }] },
  mcBody: { padding: 13 },
  mcHint: { fontSize: 10, color: '#9CA3AF', marginBottom: 9, lineHeight: 15 },
  payloadInput: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9, fontSize: 11, color: '#B4B2A9', backgroundColor: '#FAFAFA', minHeight: 70, textAlignVertical: 'top' },
  applyBtn: { marginTop: 8, backgroundColor: '#1A1A2E', borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  validatorCountBadge: { backgroundColor: '#E6F1FB', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, marginRight: 6 },
  validatorCountText: { fontSize: 10, fontWeight: '700', color: '#185FA5' },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 9, marginBottom: 6, backgroundColor: '#FFFFFF' },
  vAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  vAvatarText: { fontSize: 11, fontWeight: '800', color: '#534AB7' },
  vName: { fontSize: 11, fontWeight: '700', color: '#1A1A2E' },
  vMeta: { fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  vInput: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 11, fontSize: 12, color: '#1A1A2E', backgroundColor: '#FFFFFF', marginBottom: 4 },
  vAdd: { fontSize: 11, fontWeight: '700', color: '#534AB7', textAlign: 'center', paddingVertical: 6 },
  searchErrorText: { color: '#B91C1C', fontSize: 11, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  vAddSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  searchEmptyText: { color: '#9CA3AF', fontSize: 11, textAlign: 'center', paddingVertical: 8 },
  searchResultList: { marginTop: 6, marginBottom: 4, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 9, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  searchResultAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  searchResultAvatarText: { fontSize: 10, fontWeight: '800', color: '#534AB7' },
  searchResultName: { flex: 1, color: '#1A1A2E', fontWeight: '700', fontSize: 12 },
  searchResultAction: { color: '#534AB7', fontWeight: '800', fontSize: 11 },
  disabledButton: { opacity: 0.55 },
});
