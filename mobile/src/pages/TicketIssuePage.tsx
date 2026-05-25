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
import { weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventRound, TicketDetail } from '../types/api';

const SECTION_PRESETS = ['VIP', 'R', 'S', 'A', 'B', 'C', '스탠딩'];
const RESALE_RATE_PRESETS = ['100', '110', '120', '150'];
const QUANTITY_PRESETS = ['1', '10', '50'];

type FlowPage = 1 | 2 | 3;
type PolicyMode = 'global' | 'round';

type SectionPolicy = {
  id: string;
  sectionName: string;
  customSectionName: string;
  useCustomSectionName: boolean;
  quantity: string;
  priceEth: string;
  saleStartDate: string;
  saleStartTime: string;
  saleEndDate: string;
  saleEndTime: string;
  resaleEnabled: boolean;
  resaleCapRate: string;
  useCustomResaleRate: boolean;
  customResaleCapRate: string;
  startNumber: string;
  expanded: boolean;
};

type RoundPolicy = {
  roundKey: string;
  totalTicketCount: string;
  expanded: boolean;
  sections: SectionPolicy[];
};

type IssueSectionPayload = {
  eventRoundId?: string;
  sectionName: string;
  priceWei: string;
  saleStartAt: string;
  saleEndAt: string;
  resaleEnabled: boolean;
  resaleCapRate: number;
  startNumber: number;
  quantity: number;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateFromIso(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return localDate(date);
}

function timeFromIso(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return localTime(date);
}

function toDateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatDateDot(value?: string) {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

function formatDateShort(value?: string) {
  if (!value) return '-';
  const [, month, day] = value.split('-');
  if (!month || !day) return value;
  return `${Number(month)}/${Number(day)}`;
}

function roundKey(round: EventRound, index: number) {
  return round.id || `round-${index}`;
}

function roundLabel(round: EventRound, index: number) {
  return `${index + 1}회차 · ${formatDateDot(round.eventDate)} ${round.startTime}`;
}

function roundStartIso(round: EventRound) {
  return toDateTimeIso(round.eventDate, round.startTime);
}

function ethToWei(value: string) {
  const normalized = value.trim();
  if (!normalized) return '0';
  const [whole, fraction = ''] = normalized.split('.');
  const fractionWei = `${fraction}${'0'.repeat(18)}`.slice(0, 18);
  return `${BigInt(whole || '0') * 1_000_000_000_000_000_000n + BigInt(fractionWei || '0')}`;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeSectionPolicy(round?: EventRound): SectionPolicy {
  const now = new Date();
  return {
    id: makeId('section'),
    sectionName: '',
    customSectionName: '',
    useCustomSectionName: false,
    quantity: '',
    priceEth: '',
    saleStartDate: localDate(now),
    saleStartTime: localTime(now),
    saleEndDate: round?.eventDate || localDate(now),
    saleEndTime: round?.startTime || '23:59',
    resaleEnabled: true,
    resaleCapRate: '120',
    useCustomResaleRate: false,
    customResaleCapRate: '',
    startNumber: '1',
    expanded: false,
  };
}

function sectionNameOf(policy: SectionPolicy) {
  const raw = policy.useCustomSectionName ? policy.customSectionName : policy.sectionName;
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

function resaleRateOf(policy: SectionPolicy) {
  return policy.useCustomResaleRate ? policy.customResaleCapRate : policy.resaleCapRate;
}

function isPositiveInteger(value: string) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function isPositiveNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function ticketSectionOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split('-')[0] || 'GENERAL';
}

export default function TicketIssuePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const returnTo = route?.params?.returnTo as 'create' | 'detail' | undefined;
  const [flowPage, setFlowPage] = useState<FlowPage>(1);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [policyMode, setPolicyMode] = useState<PolicyMode | null>(null);
  const [globalTotalTicketCount, setGlobalTotalTicketCount] = useState('');
  const [globalSections, setGlobalSections] = useState<SectionPolicy[]>([]);
  const [roundPolicies, setRoundPolicies] = useState<Record<string, RoundPolicy>>({});
  const [activeRoundKey, setActiveRoundKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SectionPolicy>>({});
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [lastIssuedSummary, setLastIssuedSummary] = useState('');

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
      const rounds = eventDetail.rounds?.length ? eventDetail.rounds : [{
        id: eventDetail.id,
        title: '1회차',
        eventDate: dateFromIso(eventDetail.eventStartAt || eventDetail.eventAt || eventDetail.startsAt) || localDate(new Date()),
        startTime: timeFromIso(eventDetail.eventStartAt || eventDetail.eventAt || eventDetail.startsAt) || '19:00',
        endTime: timeFromIso(eventDetail.eventEndAt || eventDetail.endsAt) || '21:00',
        saleStartAt: eventDetail.primarySaleStart || eventDetail.salesStartAt,
        saleEndAt: eventDetail.primarySaleEnd || eventDetail.salesEndAt,
        useGlobalSalePeriod: true,
      }];

      setEvent({ ...eventDetail, rounds });
      setTickets(issuedTickets);
      setActiveRoundKey((current) => current || roundKey(rounds[0], 0));
      setRoundPolicies((current) => {
        const next: Record<string, RoundPolicy> = {};
        rounds.forEach((round, index) => {
          const key = roundKey(round, index);
          next[key] = current[key] || {
            roundKey: key,
            totalTicketCount: '',
            expanded: index === 0,
            sections: [],
          };
        });
        return next;
      });
    } catch (error: any) {
      Alert.alert('티켓 발행 정보 로드 실패', errorMessage(error, '티켓 발행 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const rounds = event?.rounds || [];
  const activeRoundIndex = Math.max(0, rounds.findIndex((round, index) => roundKey(round, index) === activeRoundKey));
  const activeRound = rounds[activeRoundIndex] || rounds[0];
  const activeKey = activeRound ? roundKey(activeRound, activeRoundIndex) : 'global';
  const draftKey = policyMode === 'global' ? 'global' : activeKey;
  const currentDraft = drafts[draftKey] || makeSectionPolicy(activeRound);
  const currentSections = policyMode === 'global' ? globalSections : roundPolicies[activeKey]?.sections || [];
  const issuedCount = tickets.length;
  const eventTotalCount = Number(event?.totalTicketCount || 0);
  const currentTotalTicketCount = policyMode === 'global'
    ? Number(globalTotalTicketCount || 0)
    : Number(roundPolicies[activeKey]?.totalTicketCount || 0);
  const currentSavedQuantity = currentSections.reduce((sum, section) => sum + (Number(section.quantity) || 0), 0);
  const totalPlannedQuantity = policyMode === 'global'
    ? globalSections.reduce((sum, section) => sum + (Number(section.quantity) || 0), 0) * rounds.length
    : Object.values(roundPolicies).reduce((sum, policy) => sum + policy.sections.reduce((sectionSum, section) => sectionSum + (Number(section.quantity) || 0), 0), 0);
  const totalConfiguredCapacity = policyMode === 'global'
    ? Number(globalTotalTicketCount || 0) * rounds.length
    : Object.values(roundPolicies).reduce((sum, policy) => sum + (Number(policy.totalTicketCount) || 0), 0);
  const hasSavedPolicies = policyMode === 'global'
    ? globalSections.length > 0
    : Object.values(roundPolicies).some((policy) => policy.sections.length > 0);
  const activeRoundTotalCount = roundPolicies[activeKey]?.totalTicketCount || '';

  const goBackToEventFlow = () => {
    if (returnTo === 'create') {
      navigation.replace('EventCreate');
      return;
    }
    if (eventId) {
      navigation.navigate('OrganizerEventDetail', { eventId });
      return;
    }
    navigation.navigate('MyEvents');
  };

  const showError = (message: string) => {
    setFeedback({ type: 'error', message });
    Alert.alert('입력 확인', message);
  };

  const updateDraft = (patch: Partial<SectionPolicy>) => {
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...currentDraft, ...patch },
    }));
  };

  const updateRoundPolicy = (key: string, patch: Partial<RoundPolicy>) => {
    setRoundPolicies((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const setAllRemainingQuantity = () => {
    if (currentTotalTicketCount <= 0) return;
    const saved = currentSections.reduce((sum, section) => sum + (Number(section.quantity) || 0), 0);
    updateDraft({ quantity: String(Math.max(currentTotalTicketCount - saved, 0)) });
  };

  const validateCapacityPage = () => {
    if (!policyMode) {
      showError('정책 적용 방식을 먼저 선택해주세요.');
      return false;
    }
    if (policyMode === 'global') {
      if (!isPositiveInteger(globalTotalTicketCount)) {
        showError('모든 회차에 적용할 총 티켓 수를 입력해주세요.');
        return false;
      }
      return true;
    }
    const missing = rounds.find((round, index) => !isPositiveInteger(roundPolicies[roundKey(round, index)]?.totalTicketCount || ''));
    if (missing) {
      showError('각 회차의 총 티켓 수를 모두 입력해주세요.');
      return false;
    }
    return true;
  };

  const validateSection = (policy: SectionPolicy, label: string, round?: EventRound) => {
    const sectionName = sectionNameOf(policy);
    const resaleRate = Number(resaleRateOf(policy));
    if (!sectionName) return `${label} 좌석 구역을 선택해주세요.`;
    if (!isPositiveInteger(policy.quantity)) return `${label} 발행 개수는 1장 이상이어야 합니다.`;
    if (!isPositiveInteger(policy.startNumber)) return `${label} 시작 번호는 1 이상이어야 합니다.`;
    if (!isPositiveNumber(policy.priceEth)) return `${label} 가격은 0보다 큰 값이어야 합니다.`;
    if (!policy.saleStartDate || !policy.saleStartTime || !policy.saleEndDate || !policy.saleEndTime) return `${label} 판매 시작과 종료 시간을 입력해주세요.`;
    const saleStart = toDateTimeIso(policy.saleStartDate, policy.saleStartTime);
    const saleEnd = toDateTimeIso(policy.saleEndDate, policy.saleEndTime);
    if (saleStart >= saleEnd) return `${label} 판매 종료는 판매 시작보다 늦어야 합니다.`;
    if (round && saleEnd > roundStartIso(round)) return `${label} 판매 종료는 공연 시작 전이어야 합니다.`;
    if (policy.resaleEnabled && (!Number.isFinite(resaleRate) || resaleRate < 100)) return `${label} 최대 리셀가는 100% 이상이어야 합니다.`;
    return null;
  };

  const saveCurrentPolicy = () => {
    if (!policyMode || !activeRound) return;
    const label = policyMode === 'global' ? '공통 정책' : `${activeRoundIndex + 1}회차 정책`;
    const roundsToValidate = policyMode === 'global' ? rounds : [activeRound];
    for (const round of roundsToValidate) {
      const message = validateSection(currentDraft, label, round);
      if (message) {
        showError(message);
        return;
      }
    }
    if (currentTotalTicketCount > 0 && currentSavedQuantity + Number(currentDraft.quantity) > currentTotalTicketCount) {
      showError('발행 개수가 총 티켓 수보다 많습니다.');
      return;
    }

    const saved = { ...currentDraft, id: makeId('section'), expanded: false };
    if (policyMode === 'global') {
      setGlobalSections((current) => [...current, saved]);
    } else {
      setRoundPolicies((current) => ({
        ...current,
        [activeKey]: {
          ...current[activeKey],
          sections: [...(current[activeKey]?.sections || []), saved],
        },
      }));
    }
    setDrafts((current) => ({ ...current, [draftKey]: makeSectionPolicy(activeRound) }));
    setFeedback({ type: 'success', message: `${sectionNameOf(saved)} 정책을 저장했습니다.` });
  };

  const removeSavedPolicy = (sectionId: string) => {
    if (policyMode === 'global') {
      setGlobalSections((current) => current.filter((section) => section.id !== sectionId));
      return;
    }
    setRoundPolicies((current) => ({
      ...current,
      [activeKey]: {
        ...current[activeKey],
        sections: (current[activeKey]?.sections || []).filter((section) => section.id !== sectionId),
      },
    }));
  };

  const toggleSavedPolicy = (sectionId: string) => {
    if (policyMode === 'global') {
      setGlobalSections((current) => current.map((section) => section.id === sectionId ? { ...section, expanded: !section.expanded } : section));
      return;
    }
    setRoundPolicies((current) => ({
      ...current,
      [activeKey]: {
        ...current[activeKey],
        sections: (current[activeKey]?.sections || []).map((section) => section.id === sectionId ? { ...section, expanded: !section.expanded } : section),
      },
    }));
  };

  const sectionToPayload = (policy: SectionPolicy, round: EventRound, roundIndex: number): IssueSectionPayload => {
    const rawSection = sectionNameOf(policy);
    return {
      eventRoundId: round.id,
      sectionName: `${roundIndex + 1}회차-${rawSection}`,
      priceWei: ethToWei(policy.priceEth),
      saleStartAt: toDateTimeIso(policy.saleStartDate, policy.saleStartTime),
      saleEndAt: toDateTimeIso(policy.saleEndDate, policy.saleEndTime),
      resaleEnabled: policy.resaleEnabled,
      resaleCapRate: Math.round(Number(resaleRateOf(policy)) * 100),
      startNumber: Number(policy.startNumber),
      quantity: Number(policy.quantity),
    };
  };

  const issueTickets = async () => {
    if (!policyMode || !hasSavedPolicies) {
      showError('발행할 좌석 정책을 먼저 저장해주세요.');
      return;
    }
    const payload = policyMode === 'global'
      ? rounds.flatMap((round, index) => globalSections.map((section) => sectionToPayload(section, round, index)))
      : rounds.flatMap((round, index) => {
        const key = roundKey(round, index);
        return (roundPolicies[key]?.sections || []).map((section) => sectionToPayload(section, round, index));
      });
    if (payload.length === 0) {
      showError('발행할 좌석 정책을 먼저 저장해주세요.');
      return;
    }

    setIssuing(true);
    setFeedback(null);
    try {
      const requestedTotal = issuedCount + payload.reduce((sum, section) => sum + section.quantity, 0);
      const totalTicketCount = Math.max(eventTotalCount, totalConfiguredCapacity, requestedTotal);
      const issued = await backendApi.issueTickets(eventId, { totalTicketCount, ticketSections: payload });
      const summary = issued.slice(0, 3).map((ticket) => ticket.seatInfo).join(', ');
      setLastIssuedSummary(summary ? `${summary}${issued.length > 3 ? ` 외 ${issued.length - 3}장` : ''}` : `${issued.length}장`);
      setFeedback({ type: 'success', message: `티켓 ${issued.length}장을 발행했습니다.` });
      await load();
    } catch (error: any) {
      showError(errorMessage(error, '티켓을 발행하지 못했습니다.'));
    } finally {
      setIssuing(false);
    }
  };

  const previewRange = (policy: SectionPolicy, roundIndex: number) => {
    const section = sectionNameOf(policy) || '구역';
    const start = Number(policy.startNumber || '1');
    const quantity = Number(policy.quantity || '0');
    const end = quantity > 0 ? start + quantity - 1 : start;
    return `${roundIndex + 1}회차-${section}-${start} ~ ${section}-${end}`;
  };

  const savedPolicySummary = (policy: SectionPolicy) => (
    `${sectionNameOf(policy)} · ${policy.quantity}장 · ${policy.priceEth}ETH · 판매 ${formatDateShort(policy.saleStartDate)}~${formatDateShort(policy.saleEndDate)} · ${policy.resaleEnabled ? `리셀 ${resaleRateOf(policy)}%` : '리셀 불가'}`
  );

  const pageTitle = flowPage === 1
    ? '적용 방식 선택'
    : flowPage === 2
      ? policyMode === 'round' ? '회차별 총 티켓 수량 설정' : '총 티켓 수량 설정'
      : '좌석 판매 설정';
  const pageDescription = flowPage === 1
    ? '좌석 수, 가격, 판매 기간, 리셀 정책을\n모든 회차에 동일하게 적용할지 선택하세요.'
    : flowPage === 2
      ? policyMode === 'round'
        ? '각 회차마다 티켓 수를 설정할 수 있습니다.'
        : '모든 회차에 동일한 티켓 수가 적용됩니다.'
      : '좌석 구역을 선택한 뒤 판매할 티켓 상품을 저장하세요.';
  const topSubtitle = '티켓 판매 규칙을 단계별로 설정합니다.';
  const canRevealQuantity = !!sectionNameOf(currentDraft);
  const canRevealPrice = canRevealQuantity && isPositiveInteger(currentDraft.quantity);
  const canRevealResale = canRevealPrice && isPositiveNumber(currentDraft.priceEth) && !!currentDraft.saleStartDate && !!currentDraft.saleEndDate;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>티켓 발행 정보를 확인하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <TouchableOpacity style={styles.backButton} onPress={goBackToEventFlow}>
          <Text style={styles.backButtonText}>{returnTo === 'create' ? '이벤트 등록으로 돌아가기' : '이벤트 상세로 돌아가기'}</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Ticket Issue</Text>
        <Text style={styles.title}>티켓 발행</Text>
        <Text style={styles.subtitle}>{topSubtitle}</Text>
        <StepProgress page={flowPage} />

        {feedback ? (
          <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
            <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{pageTitle}</Text>
          <Text style={styles.pageDescription}>{pageDescription}</Text>

          {flowPage === 1 ? (
            <View style={styles.modeStack}>
              <TouchableOpacity style={[styles.modeCard, policyMode === 'global' && styles.activeModeCard]} onPress={() => setPolicyMode('global')}>
                <Text style={[styles.modeTitle, policyMode === 'global' && styles.activeModeText]}>{policyMode === 'global' ? '✓ ' : ''}전체 설정 적용</Text>
                <Text style={styles.modeHint}>모든 회차에 같은 규칙을 일괄 적용합니다.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeCard, policyMode === 'round' && styles.activeModeCard]} onPress={() => setPolicyMode('round')}>
                <Text style={[styles.modeTitle, policyMode === 'round' && styles.activeModeText]}>{policyMode === 'round' ? '✓ ' : ''}회차별 설정</Text>
                <Text style={styles.modeHint}>회차마다 다른 규칙을 적용합니다.</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {flowPage === 2 && policyMode === 'global' ? (
            <View style={styles.sectionBlock}>
              <View style={styles.unitInputWrap}>
                <TextInput
                  style={styles.unitInput}
                  value={globalTotalTicketCount}
                  onChangeText={setGlobalTotalTicketCount}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="예: 500"
                />
                <Text style={styles.unitText}>장</Text>
              </View>
              <View style={styles.roundSummaryList}>
                {rounds.map((round, index) => (
                  <View key={roundKey(round, index)} style={styles.selectableRoundRow}>
                    <Text style={styles.roundSummaryTitle}>{roundLabel(round, index)}</Text>
                    <Text style={[styles.roundSummaryStatus, globalTotalTicketCount && styles.roundSummaryStatusSet]}>
                      {globalTotalTicketCount ? `총 ${globalTotalTicketCount}장 설정됨` : '총 티켓 수 미설정'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {flowPage === 2 && policyMode === 'round' ? (
            <View style={styles.sectionBlock}>
              <View style={styles.unitInputWrap}>
                <TextInput
                  style={styles.unitInput}
                  value={activeRoundTotalCount}
                  onChangeText={(value) => updateRoundPolicy(activeKey, { totalTicketCount: value })}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="예: 300"
                />
                <Text style={styles.unitText}>장</Text>
              </View>
              <View style={styles.roundSummaryList}>
              {rounds.map((round, index) => {
                const key = roundKey(round, index);
                const policy = roundPolicies[key];
                const active = activeKey === key;
                return (
                  <TouchableOpacity key={key} style={[styles.selectableRoundRow, active && styles.selectableRoundRowActive]} onPress={() => setActiveRoundKey(key)}>
                    <Text style={styles.roundSummaryTitle}>{roundLabel(round, index)}</Text>
                    <Text style={[styles.roundSummaryStatus, policy?.totalTicketCount && styles.roundSummaryStatusSet]}>
                      {policy?.totalTicketCount ? `총 ${policy.totalTicketCount}장 설정됨` : '총 티켓 수 미설정'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              </View>
            </View>
          ) : null}

          {flowPage === 3 && policyMode ? (
            <View style={styles.sectionBlock}>
              <RoundSelector
                rounds={rounds}
                activeRoundKey={activeKey}
                onSelect={setActiveRoundKey}
                disabled={policyMode === 'global'}
              />

              {currentSections.length > 0 ? (
                <View style={styles.savedPolicyList}>
                  {currentSections.map((policy) => (
                    <View key={policy.id} style={styles.savedPolicyCard}>
                      <TouchableOpacity style={styles.savedPolicyHeader} onPress={() => toggleSavedPolicy(policy.id)}>
                        <Text style={styles.savedPolicyText}>{policy.expanded ? '▼' : '▶'} {savedPolicySummary(policy)}</Text>
                      </TouchableOpacity>
                      {policy.expanded ? (
                        <View style={styles.savedPolicyDetail}>
                          <Text style={styles.previewText}>판매 시작 {formatDateDot(policy.saleStartDate)} {policy.saleStartTime}</Text>
                          <Text style={styles.previewText}>판매 종료 {formatDateDot(policy.saleEndDate)} {policy.saleEndTime}</Text>
                          <Text style={styles.previewText}>발행 예정 {previewRange(policy, activeRoundIndex)}</Text>
                          <TouchableOpacity style={styles.removeButton} onPress={() => removeSavedPolicy(policy.id)}>
                            <Text style={styles.removeButtonText}>삭제</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.builderBox}>
                <Text style={styles.builderTitle}>STEP 1 · 좌석 구역 선택</Text>
                <View style={styles.chipGrid}>
                  {SECTION_PRESETS.map((section) => (
                    <TouchableOpacity
                      key={section}
                      style={[styles.choiceChip, !currentDraft.useCustomSectionName && currentDraft.sectionName === section && styles.activeChip]}
                      onPress={() => updateDraft({ sectionName: section, useCustomSectionName: false })}
                    >
                      <Text style={[styles.choiceChipText, !currentDraft.useCustomSectionName && currentDraft.sectionName === section && styles.activeChipText]}>{section}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[styles.choiceChip, currentDraft.useCustomSectionName && styles.activeChip]} onPress={() => updateDraft({ useCustomSectionName: true })}>
                    <Text style={[styles.choiceChipText, currentDraft.useCustomSectionName && styles.activeChipText]}>직접 추가</Text>
                  </TouchableOpacity>
                </View>
                {currentDraft.useCustomSectionName ? (
                  <TextInput
                    style={styles.input}
                    value={currentDraft.customSectionName}
                    onChangeText={(value) => updateDraft({ customSectionName: value })}
                    placeholder="예: BOX, 2층"
                    autoCapitalize="characters"
                  />
                ) : null}

                {canRevealQuantity ? (
                  <View style={styles.stepBox}>
                    <Text style={styles.builderTitle}>STEP 2 · 발행 개수 설정</Text>
                    <View style={styles.unitInputWrap}>
                      <TextInput style={styles.unitInput} value={currentDraft.quantity} onChangeText={(value) => updateDraft({ quantity: value })} keyboardType="number-pad" inputMode="numeric" placeholder="10" />
                      <Text style={styles.unitText}>장</Text>
                    </View>
                    <View style={styles.quickRow}>
                      {QUANTITY_PRESETS.map((quantity) => (
                        <TouchableOpacity key={quantity} style={styles.quickButton} onPress={() => updateDraft({ quantity })}>
                          <Text style={styles.quickButtonText}>{quantity}장</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={[styles.quickButton, currentTotalTicketCount <= 0 && styles.disabledButton]} disabled={currentTotalTicketCount <= 0} onPress={setAllRemainingQuantity}>
                        <Text style={styles.quickButtonText}>남은 수량 전체</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.issuePreviewBox}>
                      <Text style={styles.previewLabel}>발행 예정 좌석</Text>
                      <Text style={styles.previewText}>{previewRange(currentDraft, activeRoundIndex)}</Text>
                    </View>
                  </View>
                ) : null}

                {canRevealPrice ? (
                  <View style={styles.stepBox}>
                    <Text style={styles.builderTitle}>STEP 3 · 가격 및 판매 기간 설정</Text>
                    <Text style={styles.label}>가격</Text>
                    <View style={styles.unitInputWrap}>
                      <TextInput style={styles.unitInput} value={currentDraft.priceEth} onChangeText={(value) => updateDraft({ priceEth: value })} keyboardType="decimal-pad" inputMode="decimal" placeholder="0.2" />
                      <Text style={styles.unitText}>ETH</Text>
                    </View>
                    <View style={styles.dateTimeGrid}>
                      <DateTimeField label="판매 시작 날짜" value={currentDraft.saleStartDate} onChange={(value) => updateDraft({ saleStartDate: value })} placeholder="YYYY-MM-DD" />
                      <DateTimeField label="시작 시간" value={currentDraft.saleStartTime} onChange={(value) => updateDraft({ saleStartTime: value })} placeholder="HH:mm" />
                      <DateTimeField label="판매 종료 날짜" value={currentDraft.saleEndDate} onChange={(value) => updateDraft({ saleEndDate: value })} placeholder="YYYY-MM-DD" />
                      <DateTimeField label="종료 시간" value={currentDraft.saleEndTime} onChange={(value) => updateDraft({ saleEndTime: value })} placeholder="HH:mm" />
                    </View>
                    <Text style={styles.helpText}>판매 종료는 선택된 회차의 공연 시작 전까지만 허용됩니다.</Text>
                  </View>
                ) : null}

                {canRevealResale ? (
                  <View style={styles.stepBox}>
                    <Text style={styles.builderTitle}>STEP 4 · 리셀 정책 설정</Text>
                    <TouchableOpacity style={styles.toggleRow} onPress={() => updateDraft({ resaleEnabled: !currentDraft.resaleEnabled })}>
                      <Text style={styles.toggleLabel}>리셀 허용</Text>
                      <Text style={[styles.toggleBadge, currentDraft.resaleEnabled ? styles.toggleOn : styles.toggleOff]}>{currentDraft.resaleEnabled ? 'ON' : 'OFF'}</Text>
                    </TouchableOpacity>
                    {currentDraft.resaleEnabled ? (
                      <>
                        <Text style={styles.label}>최대 리셀가</Text>
                        <View style={styles.chipGrid}>
                          {RESALE_RATE_PRESETS.map((rate) => (
                            <TouchableOpacity
                              key={rate}
                              style={[styles.choiceChip, !currentDraft.useCustomResaleRate && currentDraft.resaleCapRate === rate && styles.activeChip]}
                              onPress={() => updateDraft({ resaleCapRate: rate, useCustomResaleRate: false })}
                            >
                              <Text style={[styles.choiceChipText, !currentDraft.useCustomResaleRate && currentDraft.resaleCapRate === rate && styles.activeChipText]}>{rate}%</Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity style={[styles.choiceChip, currentDraft.useCustomResaleRate && styles.activeChip]} onPress={() => updateDraft({ useCustomResaleRate: true })}>
                            <Text style={[styles.choiceChipText, currentDraft.useCustomResaleRate && styles.activeChipText]}>직접 입력</Text>
                          </TouchableOpacity>
                        </View>
                        {currentDraft.useCustomResaleRate ? (
                          <View style={styles.unitInputWrap}>
                            <TextInput style={styles.unitInput} value={currentDraft.customResaleCapRate} onChangeText={(value) => updateDraft({ customResaleCapRate: value })} keyboardType="number-pad" inputMode="numeric" placeholder="예: 130" />
                            <Text style={styles.unitText}>%</Text>
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                ) : null}

                {canRevealResale ? (
                  <TouchableOpacity style={styles.savePolicyButton} onPress={saveCurrentPolicy}>
                    <Text style={styles.savePolicyButtonText}>{sectionNameOf(currentDraft) ? `${sectionNameOf(currentDraft)} 정책 저장` : '좌석 정책 저장'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {flowPage === 3 ? (
          <View style={styles.statusBand}>
            <Text style={styles.statusLabel}>최종 발행 영역</Text>
            <Text style={styles.statusLine}>총 {totalConfiguredCapacity || '-'}장 · 발행 {issuedCount}장 · 남은 {totalConfiguredCapacity ? Math.max(totalConfiguredCapacity - issuedCount, 0) : '-'}장</Text>
            <Text style={styles.previewLabel}>발행 예정 좌석</Text>
            <Text style={styles.previewText}>{hasSavedPolicies ? `${totalPlannedQuantity}장 발행 예정` : '저장된 좌석 정책이 없습니다.'}</Text>
            {lastIssuedSummary ? (
              <>
                <Text style={styles.previewLabel}>방금 발행됨</Text>
                <Text style={styles.previewText}>{lastIssuedSummary}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {lastIssuedSummary ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('TicketExplore', { eventId })}>
            <Text style={styles.secondaryButtonText}>전체 발행 티켓 보기</Text>
          </TouchableOpacity>
        ) : null}

        {flowPage === 3 ? (
          <View style={styles.compactCard}>
            <Text style={styles.compactTitle}>발행 티켓 요약</Text>
            {tickets.length === 0 ? (
              <Text style={styles.emptyText}>아직 발행된 티켓이 없습니다.</Text>
            ) : (
              <Text style={styles.previewText}>
                최근 {tickets.slice(0, 3).map((ticket) => `${ticket.seatInfo} · ${ticketSectionOf(ticket)} · ${weiToEth(ticket.originalPriceWei || ticket.priceWei)} ETH`).join('\n')}
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        {flowPage === 1 ? (
          <TouchableOpacity style={[styles.primaryButton, !policyMode && styles.disabledButton]} disabled={!policyMode} onPress={() => setFlowPage(2)}>
            <Text style={styles.primaryButtonText}>다음: 회차 설정</Text>
          </TouchableOpacity>
        ) : null}
        {flowPage === 2 ? (
          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.bottomSecondaryButton} onPress={() => setFlowPage(1)}>
              <Text style={styles.bottomSecondaryText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomPrimaryButton} onPress={() => validateCapacityPage() && setFlowPage(3)}>
              <Text style={styles.primaryButtonText}>다음: 좌석 정책 설정</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {flowPage === 3 ? (
          <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.bottomSecondaryButton} onPress={() => setFlowPage(2)}>
              <Text style={styles.bottomSecondaryText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bottomPrimaryButton, (!hasSavedPolicies || issuing) && styles.disabledButton]} disabled={!hasSavedPolicies || issuing} onPress={issueTickets}>
              <Text style={styles.primaryButtonText}>{issuing ? '발행 중...' : '티켓 발행'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StepProgress({ page }: { page: FlowPage }) {
  const steps: Array<{ step: FlowPage; label: string }> = [
    { step: 1, label: '적용 방식' },
    { step: 2, label: '총 수량' },
    { step: 3, label: '좌석 판매' },
  ];

  return (
    <View style={styles.progressRow}>
      {steps.map((item, index) => {
        const active = page === item.step;
        const completed = page > item.step;
        return (
          <React.Fragment key={item.step}>
            <View style={[styles.progressPill, completed && styles.progressPillDone, active && styles.progressPillActive]}>
              <Text style={[styles.progressPillText, completed && styles.progressPillTextDone, active && styles.progressPillTextActive]}>
                {item.step} {item.label}
              </Text>
            </View>
            {index < steps.length - 1 ? <View style={[styles.progressLine, (completed || active) && styles.progressLineActive]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function RoundSelector({
  rounds,
  activeRoundKey,
  disabled,
  onSelect,
}: {
  rounds: EventRound[];
  activeRoundKey: string;
  disabled: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.roundChipRow}>
      {rounds.map((round, index) => {
        const key = roundKey(round, index);
        const active = activeRoundKey === key;
        return (
          <TouchableOpacity key={key} style={[styles.roundChip, active && styles.roundChipActive, disabled && !active && styles.disabledRoundChip]} disabled={disabled} onPress={() => onSelect(key)}>
            <Text style={[styles.roundChipText, active && styles.roundChipTextActive]}>{index + 1}회차</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DateTimeField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <View style={styles.dateTimeField}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7FB' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 118 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  backButton: { borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#EFF6FF', marginBottom: 14 },
  backButtonText: { color: '#2563EB', fontWeight: '900' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  progressPill: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  progressPillDone: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  progressPillActive: { borderWidth: 2, borderColor: '#2563EB', backgroundColor: '#2563EB' },
  progressPillText: { color: '#64748B', fontSize: 11, fontWeight: '900' },
  progressPillTextDone: { color: '#2563EB' },
  progressPillTextActive: { color: '#FFFFFF' },
  progressLine: { flex: 1, height: 2, marginHorizontal: 4, backgroundColor: '#CBD5E1' },
  progressLineActive: { backgroundColor: '#93C5FD' },
  messageBox: { marginTop: 14, borderRadius: 8, padding: 12, borderWidth: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
  card: { marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  compactCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  compactTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  pageDescription: { marginTop: 8, color: '#475569', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  modeStack: { gap: 10, marginTop: 12 },
  modeCard: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 14, backgroundColor: '#FFFFFF' },
  activeModeCard: { borderWidth: 2, borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  modeTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  activeModeText: { color: '#2563EB' },
  modeHint: { marginTop: 6, color: '#64748B', fontSize: 12, lineHeight: 17 },
  sectionBlock: { marginTop: 12 },
  helpText: { marginTop: 8, color: '#64748B', fontSize: 12, lineHeight: 18 },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '900' },
  smallLabel: { marginBottom: 6, color: '#64748B', fontSize: 12, fontWeight: '900' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, backgroundColor: '#FFFFFF', color: '#0F172A' },
  unitInputWrap: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  unitInput: { flex: 1, padding: 11, color: '#0F172A' },
  unitText: { color: '#64748B', fontWeight: '900' },
  roundSummaryList: { marginTop: 12, gap: 8 },
  roundSummaryTitle: { color: '#0F172A', fontWeight: '900', fontSize: 13 },
  roundSummaryMeta: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  selectableRoundRow: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF', padding: 12 },
  selectableRoundRowActive: { borderWidth: 2, borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  roundSummaryStatus: { marginTop: 5, color: '#64748B', fontSize: 12, fontWeight: '800' },
  roundSummaryStatusSet: { color: '#2563EB', fontWeight: '900' },
  roundBox: { marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  roundHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundHeaderCopy: { flex: 1 },
  roundTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  roundMeta: { marginTop: 5, color: '#64748B', fontSize: 12, fontWeight: '800' },
  roundBody: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 12 },
  roundChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  roundChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  roundChipActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  disabledRoundChip: { opacity: 0.45 },
  roundChipText: { color: '#334155', fontWeight: '900', fontSize: 13 },
  roundChipTextActive: { color: '#2563EB' },
  savedPolicyList: { gap: 8, marginBottom: 12 },
  savedPolicyCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  savedPolicyHeader: { padding: 12 },
  savedPolicyText: { color: '#0F172A', fontSize: 13, fontWeight: '900', lineHeight: 19 },
  savedPolicyDetail: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 12 },
  builderBox: { borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, backgroundColor: '#F8FBFF', padding: 12 },
  builderTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  stepBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#DBEAFE', paddingTop: 14 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  choiceChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  choiceChipText: { color: '#334155', fontWeight: '900', fontSize: 13 },
  activeChipText: { color: '#2563EB' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickButton: { borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  quickButtonText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  dateTimeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  dateTimeField: { width: '48%' },
  toggleRow: { marginTop: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  toggleLabel: { color: '#0F172A', fontWeight: '900' },
  toggleBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '900' },
  toggleOn: { backgroundColor: '#DCFCE7', color: '#166534' },
  toggleOff: { backgroundColor: '#F1F5F9', color: '#64748B' },
  savePolicyButton: { marginTop: 14, borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#EFF6FF' },
  savePolicyButtonText: { color: '#2563EB', fontWeight: '900' },
  issuePreviewBox: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  previewLabel: { marginTop: 10, color: '#64748B', fontSize: 12, fontWeight: '900' },
  previewText: { marginTop: 5, color: '#0F172A', fontWeight: '800', lineHeight: 20 },
  statusBand: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  statusLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  statusLine: { marginTop: 6, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  removeButton: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FECACA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF2F2' },
  removeButtonText: { color: '#B91C1C', fontSize: 12, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 14, textAlign: 'center' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 14 },
  bottomRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center' },
  bottomPrimaryButton: { flex: 1.4, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  bottomSecondaryButton: { flex: 0.8, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 15, alignItems: 'center', backgroundColor: '#FFFFFF' },
  bottomSecondaryText: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
});
