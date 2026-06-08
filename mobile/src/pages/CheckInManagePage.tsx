import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  EntryEmpty,
  EntryHero,
  EntrySectionHead,
  EntrySummary,
  EntryTopBar,
  entryColors,
  entryStyles,
} from '../components/EntryScheduleKit';
import { FlowBadge } from '../components/TicketFlowKit';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import {
  buildEntrySchedules,
  buildZoneStats,
  entryTicketStats,
  scheduleDateParts,
  scheduleTitle,
} from '../lib/entrySchedule';
import type { EventDetail, EventValidatorRecord, TicketDetail, UserAdminRecord } from '../types/api';

function validatorView(record: EventValidatorRecord, index: number) {
  const raw = record as EventValidatorRecord & Record<string, unknown>;
  const wallet = String(raw.validatorWalletAddress ?? raw.walletAddress ?? '').trim();
  return {
    key: String(record.id ?? index),
    name: String(raw.validatorDisplayName ?? raw.displayName ?? raw.validatorEmail ?? `검증자 ${index + 1}`),
    wallet: wallet.length > 12 ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : wallet,
  };
}

export default function CheckInManagePage({ navigation, route }: any) {
  const eventId = String(route?.params?.eventId ?? '');
  const roundId = route?.params?.roundId != null ? String(route.params.roundId) : undefined;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [validators, setValidators] = useState<EventValidatorRecord[]>([]);
  const [validatorOpen, setValidatorOpen] = useState(false);
  const [validatorQuery, setValidatorQuery] = useState('');
  const [validatorResults, setValidatorResults] = useState<UserAdminRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [eventData, allTickets, validatorData] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => [] as TicketDetail[]),
        backendApi.getEventValidators(eventId).catch(() => [] as EventValidatorRecord[]),
      ]);
      const scoped = roundId ? allTickets.filter((ticket) => String(ticket.eventRoundId ?? '') === roundId) : allTickets;
      setEvent(eventData);
      setTickets(scoped);
      setValidators(validatorData);
    } catch (error: any) {
      Alert.alert('입장 관리 로드 실패', errorMessage(error, '이벤트 입장 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, roundId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const schedule = useMemo(() => {
    if (!event) return null;
    const allSchedules = buildEntrySchedules(event, tickets);
    return allSchedules.find((item) => item.roundId === roundId) ?? allSchedules[0] ?? null;
  }, [event, roundId, tickets]);
  const stats = entryTicketStats(tickets);
  const zones = useMemo(() => buildZoneStats(tickets), [tickets]);

  const searchValidators = (value: string) => {
    setValidatorQuery(value);
    setValidatorResults([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) return;
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await backendApi.searchUsers(value.trim());
        setValidatorResults(result.items ?? []);
      } catch (error: any) {
        setFeedback(errorMessage(error, '검증 계정을 검색하지 못했습니다.'));
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const addValidator = async (user: UserAdminRecord) => {
    setSaving(true);
    try {
      await backendApi.addEventValidator(eventId, { userId: String(user.id) });
      setValidatorQuery('');
      setValidatorResults([]);
      setFeedback(`${user.displayName || user.email || '선택한 계정'}을(를) QR 검증 계정으로 추가했습니다.`);
      await load();
    } catch (error: any) {
      Alert.alert('검증 계정 추가 실패', errorMessage(error, 'QR 검증 계정을 추가하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !schedule) {
    return <View style={entryStyles.center}><ActivityIndicator size="large" color={entryColors.purple} /><Text style={entryStyles.centerText}>이벤트 입장 정보를 불러오고 있습니다.</Text></View>;
  }

  const date = scheduleDateParts(schedule);
  const openScan = () => navigation.navigate('CheckInScan', { eventId, roundId });
  const openStatus = () => navigation.navigate('CheckInStatus', { eventId, roundId });

  return (
    <ScrollView
      style={entryStyles.screen}
      contentContainerStyle={entryStyles.content}
      stickyHeaderIndices={[0]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <EntryTopBar eyebrow="Event Entry" title="이벤트 입장 관리" back onBack={() => navigation.goBack()} rightIcon="qr" rightLabel="QR 스캔" onRight={openScan} />
      <EntryHero badge="선택된 이벤트" title={scheduleTitle(schedule)} subtitle={`${event?.venue || '장소 미정'} · ${date.full}`} posters={false} imageUrl={resolveImageUrl(event?.imageUrl)} />

      <View style={entryStyles.section}>
        <EntrySummary items={[{ label: '총 티켓', value: stats.total }, { label: '입장 완료', value: stats.entered }, { label: '미입장', value: stats.pending }]} />
      </View>

      <View style={entryStyles.section}>
        <TouchableOpacity style={entryStyles.primaryButton} onPress={openScan}>
          <LinearGradient colors={['#534AB7', '#6F67D8']} style={entryStyles.primaryGradient}>
            <Text style={entryStyles.primaryText}>QR 스캐너로 입장 처리</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={entryStyles.section}>
        <TouchableOpacity style={entryStyles.outlineButton} onPress={() => setValidatorOpen((value) => !value)}>
          <Text style={entryStyles.outlineText}>QR 검증 계정 추가</Text>
        </TouchableOpacity>
      </View>

      {feedback ? <View style={[entryStyles.section, styles.feedbackWrap]}><Text style={styles.feedback}>{feedback}</Text></View> : null}

      {validatorOpen ? (
        <View style={entryStyles.section}>
          <EntrySectionHead title="QR 검증 계정" subtitle="이 이벤트의 QR 검증을 처리할 계정을 추가합니다." action={`${validators.length}명`} />
          <View style={styles.list}>
            <View style={[entryStyles.card, styles.inputCard]}>
              <TextInput style={styles.input} value={validatorQuery} onChangeText={searchValidators} placeholder="닉네임 또는 지갑 주소로 검색" autoCapitalize="none" />
            </View>
            {searching ? <ActivityIndicator color={entryColors.purple} /> : null}
            {validatorResults.map((user) => (
              <View key={String(user.id)} style={[entryStyles.card, styles.staff]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{String(user.displayName || user.email || '?')[0]}</Text></View>
                <View style={styles.staffMain}>
                  <Text style={styles.staffName}>{user.displayName || user.email || String(user.id)}</Text>
                  <Text style={styles.staffSub}>추가 가능한 계정</Text>
                </View>
                <TouchableOpacity style={styles.action} disabled={saving} onPress={() => void addValidator(user)}><Text style={styles.actionText}>{saving ? '추가 중' : '추가'}</Text></TouchableOpacity>
              </View>
            ))}
            {validators.map((record, index) => {
              const validator = validatorView(record, index);
              return (
                <View key={validator.key} style={[entryStyles.card, styles.staff]}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{validator.name[0]}</Text></View>
                  <View style={styles.staffMain}>
                    <Text style={styles.staffName}>{validator.name}</Text>
                    <Text style={styles.staffSub}>검증자{validator.wallet ? ` · ${validator.wallet}` : ''}</Text>
                  </View>
                  <FlowBadge label="등록됨" tone="purple" />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={entryStyles.section}>
        <EntrySectionHead title="구역별 입장 요약" subtitle="좌석 구역별 입장 현황" action="현황 보기" onAction={openStatus} />
        {zones.length === 0 ? (
          <EntryEmpty title="표시할 좌석 구역이 없습니다." />
        ) : (
          <View style={styles.list}>
            {zones.map((zone) => (
              <View key={zone.name} style={[entryStyles.card, styles.zone]}>
                <View style={styles.zoneTop}>
                  <View><Text style={styles.zoneName}>{zone.name}</Text><Text style={styles.zoneMeta}>입장 완료 {zone.entered}명</Text></View>
                  <FlowBadge label={`${zone.entered}/${zone.total}`} tone="purple" />
                </View>
                <View style={styles.zoneGrid}>
                  <Kpi label="총량" value={zone.total} />
                  <Kpi label="입장" value={zone.entered} />
                  <Kpi label="미입장" value={zone.pending} />
                  <Kpi label="실패" value={zone.failed} />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <View style={styles.kpi}><Text style={styles.kpiLabel}>{label}</Text><Text style={styles.kpiValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  feedbackWrap: { paddingBottom: 14 },
  feedback: { paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#D8D4FF', borderRadius: 20, backgroundColor: '#FBFAFF', color: '#534AB7', fontSize: 11, lineHeight: 16, fontWeight: '800' },
  inputCard: { padding: 14 },
  input: { height: 48, borderWidth: 1, borderColor: '#D9E1EE', borderRadius: 16, paddingHorizontal: 13, color: '#0F172A', fontWeight: '800' },
  staff: { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#534AB7', fontWeight: '900', fontSize: 15 },
  staffMain: { flex: 1, minWidth: 0 },
  staffName: { color: '#0F172A', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  staffSub: { color: '#64748B', fontSize: 10 },
  action: { height: 36, borderRadius: 14, borderWidth: 1.5, borderColor: '#D8D4FF', backgroundColor: '#FFFFFF', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#534AB7', fontSize: 11, fontWeight: '900' },
  zone: { padding: 14 },
  zoneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  zoneName: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  zoneMeta: { color: '#64748B', fontSize: 11, marginTop: 4 },
  zoneGrid: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EDF2F7', borderRadius: 15, paddingVertical: 10, alignItems: 'center' },
  kpiLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '900', marginBottom: 4 },
  kpiValue: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
});
