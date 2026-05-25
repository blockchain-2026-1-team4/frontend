import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import type { EventDetail, EventRound, TicketDetail } from '../types/api';

const SECTION_PRESETS = ['VIP', 'R', 'S', 'A', 'B', 'C', '스탠딩'];
const RESALE_RATE_PRESETS = ['100', '110', '120', '150'];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => pad(index));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => pad(index * 5));

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

function normalizeDate(value?: string | null, fallback = localDate(new Date())) {
  if (!value) return fallback;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return dateFromIso(raw) || fallback;
}

function normalizeTime(value?: string | null, fallback = '19:00') {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${pad(hour)}:${pad(minute)}`;
}

function toDateTimeIso(date: string, time: string) {
  const normalizedDate = normalizeDate(date, '');
  const normalizedTime = normalizeTime(time, '');
  if (!normalizedDate || !normalizedTime) return '';
  const value = new Date(`${normalizedDate}T${normalizedTime}:00`);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString();
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

function normalizeEventRound(round: EventRound, index: number, event: EventDetail): EventRound {
  const fallbackStart = event.eventStartAt || event.eventAt || event.startsAt || event.eventDateTime;
  const fallbackEnd = event.eventEndAt || event.endsAt || fallbackStart;
  return {
    ...round,
    title: round.title || `${index + 1}회차`,
    eventDate: normalizeDate(round.eventDate, dateFromIso(fallbackStart) || localDate(new Date())),
    startTime: normalizeTime(round.startTime, timeFromIso(fallbackStart) || '19:00'),
    endTime: normalizeTime(round.endTime, timeFromIso(fallbackEnd) || '21:00'),
    useGlobalSalePeriod: round.useGlobalSalePeriod ?? true,
  };
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
  const [loadError, setLoadError] = useState('');
  const [lastIssuedSummary, setLastIssuedSummary] = useState('');
  const [ticketConfigConfirmed, setTicketConfigConfirmed] = useState(false);
  const [issueCompleted, setIssueCompleted] = useState(false);
  const [issueSeatModalVisible, setIssueSeatModalVisible] = useState(false);
  const [actionPolicy, setActionPolicy] = useState<SectionPolicy | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoadError('이벤트 정보가 없어 티켓 발행 화면을 열 수 없습니다. 이벤트 상세 화면에서 다시 진입해주세요.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setLoadError('');
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
      const rawRounds = eventDetail.rounds?.length ? eventDetail.rounds : [{
        id: undefined,
        title: '1회차',
        eventDate: dateFromIso(eventDetail.eventStartAt || eventDetail.eventAt || eventDetail.startsAt) || localDate(new Date()),
        startTime: timeFromIso(eventDetail.eventStartAt || eventDetail.eventAt || eventDetail.startsAt) || '19:00',
        endTime: timeFromIso(eventDetail.eventEndAt || eventDetail.endsAt) || '21:00',
        saleStartAt: eventDetail.primarySaleStart || eventDetail.salesStartAt,
        saleEndAt: eventDetail.primarySaleEnd || eventDetail.salesEndAt,
        useGlobalSalePeriod: true,
      }];
      const rounds = rawRounds.map((round, index) => normalizeEventRound(round, index, eventDetail));

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
      const message = errorMessage(error, '티켓 발행 정보를 불러오지 못했습니다.');
      setLoadError(message);
      Alert.alert('티켓 발행 정보 로드 실패', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const rounds = event?.rounds || [];
  const earliestRoundInfo = rounds
    .map((round, index) => ({ round, index, startsAt: roundStartIso(round) }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const activeRoundIndex = Math.max(0, rounds.findIndex((round, index) => roundKey(round, index) === activeRoundKey));
  const activeRound = rounds[activeRoundIndex] || rounds[0];
  const draftBaseRound = policyMode === 'global' ? earliestRoundInfo?.round || activeRound : activeRound;
  const activeKey = activeRound ? roundKey(activeRound, activeRoundIndex) : 'global';
  const draftKey = policyMode === 'global' ? 'global' : activeKey;
  const currentDraft = drafts[draftKey] || makeSectionPolicy(draftBaseRound);
  const currentSections = policyMode === 'global' ? globalSections : roundPolicies[activeKey]?.sections || [];
  const issuedCountForRound = (round: EventRound | undefined, index: number) => {
    if (!round) return 0;
    return tickets.filter((ticket) => {
      if (round.id && ticket.eventRoundId === round.id) return true;
      if (rounds.length === 1 && !ticket.eventRoundId) return true;
      return String(ticket.seatInfo || '').startsWith(`${index + 1}회차-`);
    }).length;
  };
  const issuedCount = tickets.length;
  const activeIssuedCount = issuedCountForRound(activeRound, activeRoundIndex);
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
  const finalTotalCount = totalConfiguredCapacity;
  const finalIssuedCount = issuedCount;
  const finalIssueCount = totalPlannedQuantity;
  const finalRemainingCount = finalTotalCount - finalIssuedCount - finalIssueCount;

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
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...currentDraft, ...patch },
    }));
  };

  const updateRoundPolicy = (key: string, patch: Partial<RoundPolicy>) => {
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setRoundPolicies((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const selectPolicyMode = (mode: PolicyMode) => {
    setPolicyMode(mode);
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
  };

  const updateGlobalTotalTicketCount = (value: string) => {
    setGlobalTotalTicketCount(value);
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
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
    if (!policyMode || !draftBaseRound) return;
    const label = policyMode === 'global' ? '공통 정책' : `${activeRoundIndex + 1}회차 정책`;
    const roundsToValidate = policyMode === 'global' ? [earliestRoundInfo?.round || draftBaseRound] : [draftBaseRound];
    for (const round of roundsToValidate) {
      const message = validateSection(currentDraft, label, round);
      if (message) {
        showError(message);
        return;
      }
    }
    const requestedQuantity = Number(currentDraft.quantity || 0);
    const capacityTargets = policyMode === 'global'
      ? rounds.map((round, index) => ({ round, index, total: Number(globalTotalTicketCount || 0), saved: currentSavedQuantity }))
      : [{ round: activeRound, index: activeRoundIndex, total: currentTotalTicketCount, saved: currentSavedQuantity }];
    const exceeded = capacityTargets.find((target) => {
      const alreadyIssued = issuedCountForRound(target.round, target.index);
      return target.total > 0 && alreadyIssued + target.saved + requestedQuantity > target.total;
    });
    if (exceeded) {
      const alreadyIssued = issuedCountForRound(exceeded.round, exceeded.index);
      const remaining = Math.max(exceeded.total - alreadyIssued - exceeded.saved, 0);
      showError(`${exceeded.index + 1}회차에 남은 수량이 부족합니다. 총 ${exceeded.total}장 중 이미 ${alreadyIssued}장 발행, 저장된 정책 ${exceeded.saved}장, 남은 수량 ${remaining}장입니다. 이번 입력 수량은 ${requestedQuantity}장입니다.`);
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
    setDrafts((current) => {
      const next = { ...current };
      delete next[draftKey];
      return next;
    });
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setFeedback({ type: 'success', message: `${sectionNameOf(saved)} 정책을 저장했습니다.` });
  };

  const removeSavedPolicy = (sectionId: string) => {
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
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

  const editSavedPolicy = (policy: SectionPolicy) => {
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...policy, id: makeId('section'), expanded: false },
    }));
    removeSavedPolicy(policy.id);
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setFeedback({ type: 'success', message: `${sectionNameOf(policy)} 정책을 수정할 수 있도록 펼쳤습니다.` });
  };

  const sectionPrefix = (policy: SectionPolicy, roundIndex: number) => `${roundIndex + 1}회차-${sectionNameOf(policy)}`;

  const issuedMaxSeatNumber = (policy: SectionPolicy, roundIndex: number) => {
    const prefix = sectionPrefix(policy, roundIndex);
    return tickets.reduce((max, ticket) => {
      const ticketSection = ticket.sectionName || String(ticket.seatInfo || '').replace(/-\d+$/, '');
      if (ticketSection !== prefix && !String(ticket.seatInfo || '').startsWith(`${prefix}-`)) return max;
      const match = String(ticket.seatInfo || '').match(/-(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
  };

  const policyStartNumber = (policy: SectionPolicy, roundIndex: number, policies: SectionPolicy[]) => {
    const section = sectionNameOf(policy);
    const policyIndex = policies.findIndex((item) => item.id === policy.id);
    const beforeQuantity = policies
      .slice(0, policyIndex >= 0 ? policyIndex : policies.length)
      .filter((item) => sectionNameOf(item) === section)
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return issuedMaxSeatNumber(policy, roundIndex) + beforeQuantity + 1;
  };

  const openSavedPolicyActions = (policy: SectionPolicy) => {
    setActionPolicy(policy);
  };

  const sectionToPayload = (policy: SectionPolicy, round: EventRound, roundIndex: number, policies: SectionPolicy[]): IssueSectionPayload => {
    const rawSection = sectionNameOf(policy);
    return {
      eventRoundId: round.id,
      sectionName: `${roundIndex + 1}회차-${rawSection}`,
      priceWei: ethToWei(policy.priceEth),
      saleStartAt: toDateTimeIso(policy.saleStartDate, policy.saleStartTime),
      saleEndAt: toDateTimeIso(policy.saleEndDate, policy.saleEndTime),
      resaleEnabled: policy.resaleEnabled,
      resaleCapRate: Math.round(Number(resaleRateOf(policy)) * 100),
      startNumber: policyStartNumber(policy, roundIndex, policies),
      quantity: Number(policy.quantity),
    };
  };

  const issueTickets = async () => {
    if (!ticketConfigConfirmed) {
      showError('티켓 설정 완료 후 발행할 수 있습니다.');
      return;
    }
    if (!policyMode || !hasSavedPolicies) {
      showError('발행할 좌석 정책을 먼저 저장해주세요.');
      return;
    }
    const payload = policyMode === 'global'
      ? rounds.flatMap((round, index) => globalSections.map((section) => sectionToPayload(section, round, index, globalSections)))
      : rounds.flatMap((round, index) => {
        const key = roundKey(round, index);
        const sections = roundPolicies[key]?.sections || [];
        return sections.map((section) => sectionToPayload(section, round, index, sections));
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
      setTicketConfigConfirmed(true);
      setIssueCompleted(true);
    } catch (error: any) {
      showError(errorMessage(error, '티켓을 발행하지 못했습니다.'));
    } finally {
      setIssuing(false);
    }
  };

  const seatRange = (policy: SectionPolicy, startNumber = Number(policy.startNumber || '1')) => {
    const section = sectionNameOf(policy) || '좌석';
    const start = startNumber;
    const quantity = Number(policy.quantity || '0');
    const end = quantity > 0 ? start + quantity - 1 : start;
    return quantity === 1 ? `${section}-${start}` : `${section}-${start} ~ ${section}-${end}`;
  };

  const previewRange = (policy: SectionPolicy, roundIndex: number, policies: SectionPolicy[] = currentSections) => {
    return `${roundIndex + 1}회차-${seatRange(policy, policyStartNumber(policy, roundIndex, policies))}`;
  };

  const savedPolicyTitle = (policy: SectionPolicy) => `${sectionNameOf(policy)} · ${policy.quantity}장 · ${policy.priceEth} ETH`;
  const savedPolicySaleSummary = (policy: SectionPolicy) => policy.saleStartDate === policy.saleEndDate
    ? `판매 ${formatDateShort(policy.saleStartDate)} ${policy.saleStartTime} ~ ${policy.saleEndTime}`
    : `판매 ${formatDateShort(policy.saleStartDate)} ${policy.saleStartTime} ~ ${formatDateShort(policy.saleEndDate)} ${policy.saleEndTime}`;
  const savedPolicyResaleSummary = (policy: SectionPolicy) => policy.resaleEnabled ? `리셀 허용 · 최대 ${resaleRateOf(policy)}%` : '리셀 불가';
  const saleDeadlineRoundLabel = policyMode === 'global'
    ? earliestRoundInfo ? roundLabel(earliestRoundInfo.round, earliestRoundInfo.index) : '-'
    : activeRound ? roundLabel(activeRound, activeRoundIndex) : '-';
  const issueSeatSummary = (() => {
    const totals = new Map<string, number>();
    if (policyMode === 'global') {
      globalSections.forEach((section) => {
        const name = sectionNameOf(section);
        totals.set(name, (totals.get(name) || 0) + Number(section.quantity || 0) * rounds.length);
      });
    } else {
      Object.values(roundPolicies).forEach((policy) => {
        policy.sections.forEach((section) => {
          const name = sectionNameOf(section);
          totals.set(name, (totals.get(name) || 0) + Number(section.quantity || 0));
        });
      });
    }
    return Array.from(totals.entries()).map(([name, quantity]) => `${name} ${quantity}장`).join(' · ');
  })();
  const issueSeatLines = (() => {
    if (policyMode === 'global') {
      return rounds.flatMap((round, index) => globalSections.map((section) => previewRange(section, index, globalSections)));
    }
    return rounds.flatMap((round, index) => {
      const key = roundKey(round, index);
      const sections = roundPolicies[key]?.sections || [];
      return sections.map((section) => previewRange(section, index, sections));
    });
  })();
  const finalRoundSummaries = rounds.map((round, index) => {
    const key = roundKey(round, index);
    const sections = policyMode === 'global' ? globalSections : roundPolicies[key]?.sections || [];
    const total = policyMode === 'global' ? Number(globalTotalTicketCount || 0) : Number(roundPolicies[key]?.totalTicketCount || 0);
    const alreadyIssued = issuedCountForRound(round, index);
    const issueCount = sections.reduce((sum, section) => sum + Number(section.quantity || 0), 0);
    const remaining = total - alreadyIssued - issueCount;
    const summary = sections.map((section) => `${sectionNameOf(section)} ${section.quantity}장`).join(' · ');
    return { key, label: roundLabel(round, index), total, alreadyIssued, issueCount, remaining, summary };
  });
  const currentDraftStartNumber = issuedMaxSeatNumber(currentDraft, activeRoundIndex)
    + currentSections
      .filter((section) => sectionNameOf(section) === sectionNameOf(currentDraft))
      .reduce((sum, section) => sum + Number(section.quantity || 0), 0)
    + 1;
  const currentCapacityStatus = (() => {
    const targets = policyMode === 'global'
      ? rounds.map((round, index) => ({
        index,
        total: Number(globalTotalTicketCount || 0),
        alreadyIssued: issuedCountForRound(round, index),
        saved: currentSavedQuantity,
      }))
      : [{
        index: activeRoundIndex,
        total: currentTotalTicketCount,
        alreadyIssued: activeIssuedCount,
        saved: currentSavedQuantity,
      }];
    const validTargets = targets
      .filter((target) => target.total > 0)
      .map((target) => ({ ...target, remaining: Math.max(target.total - target.alreadyIssued - target.saved, 0) }));
    if (validTargets.length === 0) return null;
    return validTargets.sort((a, b) => a.remaining - b.remaining)[0];
  })();

  const confirmTicketConfig = () => {
    if (!hasSavedPolicies) {
      showError('저장된 좌석 정책이 없습니다.');
      return;
    }
    if (!validateCapacityPage()) return;
    if (finalRemainingCount < 0) {
      showError(`이번 발행 수량이 남은 수량보다 많습니다. 총 ${finalTotalCount}장 중 이미 ${finalIssuedCount}장 발행, 이번 입력 ${finalIssueCount}장, 초과 ${Math.abs(finalRemainingCount)}장입니다.`);
      return;
    }
    setTicketConfigConfirmed(true);
    setIssueCompleted(false);
    setFeedback({ type: 'success', message: '티켓 설정을 완료했습니다. 최종 발행 내용을 확인해주세요.' });
  };

  const reopenTicketConfig = () => {
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setFeedback(null);
  };

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

  if (loadError && !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>티켓 발행 화면을 열 수 없습니다.</Text>
        <Text style={styles.emptyText}>{loadError}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('MyEvents')}>
          <Text style={styles.primaryButtonText}>이벤트 목록으로 돌아가기</Text>
        </TouchableOpacity>
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
              <TouchableOpacity style={[styles.modeCard, policyMode === 'global' && styles.activeModeCard]} onPress={() => selectPolicyMode('global')}>
                <Text style={[styles.modeTitle, policyMode === 'global' && styles.activeModeText]}>{policyMode === 'global' ? '✓ ' : ''}전체 설정 적용</Text>
                <Text style={styles.modeHint}>모든 회차에 같은 규칙을 일괄 적용합니다.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeCard, policyMode === 'round' && styles.activeModeCard]} onPress={() => selectPolicyMode('round')}>
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
                  onChangeText={updateGlobalTotalTicketCount}
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
                <View style={styles.savedPolicySection}>
                  <Text style={styles.sectionTitle}>저장된 좌석 정책</Text>
                  <View style={styles.savedPolicyList}>
                    {currentSections.map((policy) => (
                      <View key={policy.id} style={styles.savedPolicyCard}>
                        <View style={styles.savedPolicyHeader}>
                          <View style={styles.savedPolicyHeaderTop}>
                            <Text style={styles.savedBadge}>저장됨</Text>
                            <TouchableOpacity style={styles.kebabButton} onPress={() => openSavedPolicyActions(policy)}>
                              <Text style={styles.kebabText}>⋮</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.savedPolicyText}>{savedPolicyTitle(policy)}</Text>
                          <Text style={styles.savedPolicyMeta}>{savedPolicySaleSummary(policy)}</Text>
                          <Text style={styles.savedPolicyMeta}>{savedPolicyResaleSummary(policy)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {!ticketConfigConfirmed ? (
                <>
              <Text style={[styles.sectionTitle, currentSections.length > 0 && styles.newPolicyTitle]}>새 좌석 정책 추가</Text>
              <View style={styles.builderBox}>
                <View style={styles.stepCard}>
                <Text style={styles.builderTitle}>STEP 1 · 좌석 구역 선택</Text>
                <Text style={styles.helpText}>좌석 구역을 선택해 판매 정보를 설정하세요.</Text>
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
                </View>

                {canRevealQuantity ? (
                  <View style={[styles.stepCard, styles.activeStepCard]}>
                    <Text style={styles.builderTitle}>STEP 2 · {sectionNameOf(currentDraft)} 좌석 발행 수량 설정</Text>
                    <View style={styles.unitInputWrap}>
                      <TextInput style={styles.unitInput} value={currentDraft.quantity} onChangeText={(value) => updateDraft({ quantity: value })} keyboardType="number-pad" inputMode="numeric" placeholder="예: 10" />
                      <Text style={styles.unitText}>장</Text>
                    </View>
                    <View style={styles.issuePreviewBox}>
                      <Text style={styles.previewLabel}>발행 예정</Text>
                      <Text style={styles.previewTextStrong}>{seatRange(currentDraft, currentDraftStartNumber)}</Text>
                      {currentCapacityStatus ? (
                        <Text style={styles.previewText}>
                          {currentCapacityStatus.index + 1}회차 기준 · 총 {currentCapacityStatus.total}장 · 이미 발행 {currentCapacityStatus.alreadyIssued}장 · 저장됨 {currentCapacityStatus.saved}장 · 남은 수량 {currentCapacityStatus.remaining}장
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {canRevealPrice ? (
                  <View style={[styles.stepCard, styles.formStepCard]}>
                    <Text style={styles.builderTitle}>STEP 3 · 가격 및 판매 기간 설정</Text>
                    <Text style={styles.deadlineGuide}>판매 종료는 가장 빠른 회차 시작 전까지만 가능합니다.</Text>
                    <Text style={styles.deadlineGuideMeta}>({saleDeadlineRoundLabel})</Text>
                    <Text style={styles.label}>가격</Text>
                    <View style={styles.unitInputWrap}>
                      <TextInput style={styles.unitInput} value={currentDraft.priceEth} onChangeText={(value) => updateDraft({ priceEth: value })} keyboardType="decimal-pad" inputMode="decimal" placeholder="예: 0.2" />
                      <Text style={styles.unitText}>ETH</Text>
                    </View>
                    <View style={styles.dateTimeGrid}>
                      <DatePickerField label="판매 시작 날짜" value={currentDraft.saleStartDate} onChange={(value) => updateDraft({ saleStartDate: value })} />
                      <TimePickerField label="시작 시간" value={currentDraft.saleStartTime} onChange={(value) => updateDraft({ saleStartTime: value })} />
                      <DatePickerField label="판매 종료 날짜" value={currentDraft.saleEndDate} onChange={(value) => updateDraft({ saleEndDate: value })} />
                      <TimePickerField label="종료 시간" value={currentDraft.saleEndTime} onChange={(value) => updateDraft({ saleEndTime: value })} />
                    </View>
                    <Text style={styles.helpText}>판매 종료는 선택된 회차의 공연 시작 전까지만 허용됩니다.</Text>
                  </View>
                ) : null}

                {canRevealResale ? (
                  <View style={[styles.stepCard, styles.formStepCard]}>
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
                  <View style={styles.stepCard}>
                    <Text style={styles.builderTitle}>STEP 5 · 좌석 정책 저장</Text>
                    <Text style={styles.helpText}>저장하면 요약 카드로 접히고, 다시 눌러 수정할 수 있습니다.</Text>
                    <TouchableOpacity style={styles.savePolicyButton} onPress={saveCurrentPolicy}>
                      <Text style={styles.savePolicyButtonText}>{sectionNameOf(currentDraft) ? `${sectionNameOf(currentDraft)} 정책 저장` : '좌석 정책 저장'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
              {hasSavedPolicies && !ticketConfigConfirmed ? (
                <TouchableOpacity style={styles.completeConfigButton} onPress={confirmTicketConfig}>
                  <Text style={styles.completeConfigButtonText}>티켓 설정 완료</Text>
                </TouchableOpacity>
              ) : null}
                </>
              ) : null}
            </View>
          ) : null}
        </View>

        {flowPage === 3 && ticketConfigConfirmed ? (
          <View style={styles.statusBand}>
            <Text style={styles.statusLabel}>최종 발행 확인</Text>
            {policyMode === 'round' ? (
              <View style={styles.finalRoundList}>
                {finalRoundSummaries.map((summary) => (
                  <View key={summary.key} style={styles.finalRoundCard}>
                    <Text style={styles.finalRoundTitle}>{summary.label}</Text>
                    <Text style={styles.finalCountText}>총 티켓 수: {summary.total}장</Text>
                    <Text style={styles.finalCountText}>이미 발행됨: {summary.alreadyIssued}장</Text>
                    <Text style={styles.finalCountText}>이번에 발행됨: {summary.issueCount}장</Text>
                    <Text style={styles.finalCountText}>발행 후 남음: {Math.max(summary.remaining, 0)}장</Text>
                    <Text style={styles.previewLabel}>이번 발행 좌석</Text>
                    <Text style={styles.previewText}>{summary.summary || '저장된 좌석 정책이 없습니다.'}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.finalCountList}>
                <Text style={styles.finalCountText}>총 티켓 수: {finalTotalCount}장</Text>
                <Text style={styles.finalCountText}>이미 발행됨: {finalIssuedCount}장</Text>
                <Text style={styles.finalCountText}>이번에 발행됨: {finalIssueCount}장</Text>
                <Text style={styles.finalCountText}>발행 후 남음: {Math.max(finalRemainingCount, 0)}장</Text>
              </View>
            )}
            {policyMode === 'global' ? (
              <>
                <Text style={styles.previewLabel}>이번 발행 좌석</Text>
                <Text style={styles.previewText}>{issueSeatSummary || '저장된 좌석 정책이 없습니다.'}</Text>
              </>
            ) : null}
            {lastIssuedSummary ? (
              <>
                <Text style={styles.previewLabel}>방금 발행됨</Text>
                <Text style={styles.previewText}>{lastIssuedSummary}</Text>
              </>
            ) : null}
            <TouchableOpacity
              style={[styles.primaryButton, styles.finalActionButton, (issuing || issueCompleted) && styles.disabledButton]}
              disabled={issuing || issueCompleted}
              onPress={issueTickets}
            >
              <Text style={styles.primaryButtonText}>{issueCompleted ? '발행 완료' : issuing ? '발행 중...' : '티켓 발행'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={reopenTicketConfig}>
              <Text style={styles.secondaryButtonText}>다시 티켓 설정하기</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Modal visible={issueSeatModalVisible} transparent animationType="slide" onRequestClose={() => setIssueSeatModalVisible(false)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>이번 발행 좌석</Text>
                <TouchableOpacity onPress={() => setIssueSeatModalVisible(false)}>
                  <Text style={styles.sheetClose}>닫기</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.issueSeatList}>
                {issueSeatLines.map((line) => (
                  <Text key={line} style={styles.issueSeatLine}>{line}</Text>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal visible={!!actionPolicy} transparent animationType="fade" onRequestClose={() => setActionPolicy(null)}>
          <View style={styles.menuOverlay}>
            <View style={styles.actionMenu}>
              <Text style={styles.actionMenuTitle}>{actionPolicy ? `${sectionNameOf(actionPolicy)} 좌석 정책` : '좌석 정책'}</Text>
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  const target = actionPolicy;
                  setActionPolicy(null);
                  if (target) editSavedPolicy(target);
                }}
              >
                <Text style={styles.actionMenuText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  const target = actionPolicy;
                  setActionPolicy(null);
                  if (target) removeSavedPolicy(target.id);
                }}
              >
                <Text style={styles.actionMenuDeleteText}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionMenuCancel} onPress={() => setActionPolicy(null)}>
                <Text style={styles.actionMenuText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
            <TouchableOpacity
              style={[styles.bottomPrimaryButton, !issueCompleted && styles.disabledButton]}
              disabled={!issueCompleted}
              onPress={() => navigation.navigate('TicketExplore', { eventId })}
            >
              <Text style={styles.primaryButtonText}>다음: 티켓 발행 현황보기</Text>
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
        const active = disabled || activeRoundKey === key;
        return (
          <TouchableOpacity key={key} style={[styles.roundChip, active && styles.roundChipActive, disabled && !active && styles.disabledRoundChip]} disabled={disabled} onPress={() => onSelect(key)}>
            <Text style={[styles.roundChipText, active && styles.roundChipTextActive]}>{index + 1}회차</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function monthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function sameDate(left: string, right: Date) {
  return left === localDate(right);
}

function buildCalendarCells(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const cells: Array<Date | null> = [];
  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - startOffset + 1;
    const date = new Date(month.getFullYear(), month.getMonth(), dayNumber);
    cells.push(date.getMonth() === month.getMonth() ? date : null);
  }
  return cells;
}

function DatePickerField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const initialDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [draftValue, setDraftValue] = useState(value || localDate(new Date()));

  const openPicker = () => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    setDraftValue(value || localDate(base));
    setMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen(true);
  };

  return (
    <View style={styles.dateTimeField}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TouchableOpacity style={styles.pickerButton} onPress={openPicker}>
        <Text style={styles.pickerButtonText}>{formatDateDot(value)}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.sheetClose}>닫기</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calendarHeader}>
              <TouchableOpacity style={styles.calendarNavButton} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                <Text style={styles.calendarNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{monthTitle(month)}</Text>
              <TouchableOpacity style={styles.calendarNavButton} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                <Text style={styles.calendarNavText}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weekRow}>
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}
            </View>
            <View style={styles.calendarGrid}>
              {buildCalendarCells(month).map((date, index) => {
                const selected = date ? sameDate(draftValue, date) : false;
                return (
                  <TouchableOpacity
                    key={`${month.getFullYear()}-${month.getMonth()}-${index}`}
                    style={[styles.calendarCell, !date && styles.calendarCellEmpty, selected && styles.calendarCellSelected]}
                    disabled={!date}
                    onPress={() => date && setDraftValue(localDate(date))}
                  >
                    <Text style={[styles.calendarCellText, selected && styles.calendarCellTextSelected]}>{date ? date.getDate() : ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.sheetPrimaryButton} onPress={() => { onChange(draftValue); setOpen(false); }}>
              <Text style={styles.sheetPrimaryText}>완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimePickerField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState((value || '00:00').split(':')[0] || '00');
  const [minute, setMinute] = useState((value || '00:00').split(':')[1] || '00');

  const openPicker = () => {
    const [nextHour = '00', nextMinute = '00'] = (value || '00:00').split(':');
    setHour(pad(Number(nextHour)));
    setMinute(pad(Number(nextMinute)));
    setOpen(true);
  };

  return (
    <View style={styles.dateTimeField}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TouchableOpacity style={styles.pickerButton} onPress={openPicker}>
        <Text style={styles.pickerButtonText}>{value || '00:00'}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.sheetClose}>닫기</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.timePickerRow}>
              <ScrollView style={styles.timeColumn} contentContainerStyle={styles.timeColumnContent}>
                {HOUR_OPTIONS.map((option) => (
                  <TouchableOpacity key={option} style={[styles.timeOption, hour === option && styles.timeOptionActive]} onPress={() => setHour(option)}>
                    <Text style={[styles.timeOptionText, hour === option && styles.timeOptionTextActive]}>{option}시</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={styles.timeColumn} contentContainerStyle={styles.timeColumnContent}>
                {MINUTE_OPTIONS.map((option) => (
                  <TouchableOpacity key={option} style={[styles.timeOption, minute === option && styles.timeOptionActive]} onPress={() => setMinute(option)}>
                    <Text style={[styles.timeOptionText, minute === option && styles.timeOptionTextActive]}>{option}분</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity style={styles.sheetPrimaryButton} onPress={() => { onChange(`${hour}:${minute}`); setOpen(false); }}>
              <Text style={styles.sheetPrimaryText}>완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7FB' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 118 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', textAlign: 'center' },
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
  sectionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900', marginBottom: 10 },
  savedPolicySection: { marginBottom: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  newPolicyTitle: { marginTop: 2 },
  savedPolicyList: { gap: 8 },
  savedPolicyCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  savedPolicyHeader: { padding: 12 },
  savedPolicyHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  savedBadge: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  savedPolicyArrow: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  kebabButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  kebabText: { color: '#334155', fontSize: 20, fontWeight: '900', lineHeight: 22 },
  savedPolicyText: { color: '#0F172A', fontSize: 13, fontWeight: '900', lineHeight: 19 },
  savedPolicyMeta: { marginTop: 3, color: '#475569', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  savedPolicyDetail: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 12 },
  builderBox: { gap: 12 },
  builderTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  stepCard: { borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 8, backgroundColor: '#FFFFFF', padding: 12 },
  activeStepCard: { borderWidth: 2, borderColor: '#93C5FD', backgroundColor: '#F8FBFF' },
  formStepCard: { borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
  stepBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#DBEAFE', paddingTop: 14 },
  deadlineGuide: { marginTop: 8, color: '#2563EB', fontSize: 12, fontWeight: '900', lineHeight: 17 },
  deadlineGuideMeta: { marginTop: 3, color: '#475569', fontSize: 12, fontWeight: '800', lineHeight: 17 },
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
  completeConfigButton: { marginTop: 16, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  completeConfigButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  issuePreviewBox: { marginTop: 12, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  previewLabel: { marginTop: 10, color: '#64748B', fontSize: 12, fontWeight: '900' },
  previewText: { marginTop: 5, color: '#0F172A', fontWeight: '800', lineHeight: 20 },
  previewTextStrong: { marginTop: 5, color: '#0F172A', fontSize: 16, fontWeight: '900', lineHeight: 22 },
  statusBand: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  statusLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  statusLine: { marginTop: 6, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  finalCountList: { marginTop: 10, gap: 7, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, backgroundColor: '#F8FAFC' },
  finalCountText: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  finalRoundList: { marginTop: 10, gap: 10 },
  finalRoundCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, backgroundColor: '#F8FAFC' },
  finalRoundTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  finalActionButton: { marginTop: 14 },
  removeButton: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FECACA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF2F2' },
  removeButtonText: { color: '#B91C1C', fontSize: 12, fontWeight: '900' },
  editButton: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EFF6FF' },
  editButtonText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
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
  pickerButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, backgroundColor: '#FFFFFF' },
  pickerButtonText: { color: '#0F172A', fontWeight: '900' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '82%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  sheetClose: { color: '#64748B', fontWeight: '900' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calendarNavButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  calendarNavText: { color: '#0F172A', fontSize: 24, fontWeight: '900' },
  calendarTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekText: { flex: 1, textAlign: 'center', color: '#64748B', fontSize: 12, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calendarCellEmpty: { opacity: 0.18 },
  calendarCellSelected: { backgroundColor: '#2563EB', borderRadius: 999 },
  calendarCellText: { color: '#0F172A', fontWeight: '800' },
  calendarCellTextSelected: { color: '#FFFFFF' },
  sheetPrimaryButton: { marginTop: 14, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  sheetPrimaryText: { color: '#FFFFFF', fontWeight: '900' },
  timePickerRow: { flexDirection: 'row', gap: 10, height: 260 },
  timeColumn: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#F8FAFC' },
  timeColumnContent: { padding: 8, gap: 6 },
  timeOption: { borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  timeOptionActive: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#2563EB' },
  timeOptionText: { color: '#334155', fontWeight: '900' },
  timeOptionTextActive: { color: '#2563EB' },
  issueSeatList: { maxHeight: 360 },
  issueSeatLine: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 10, color: '#0F172A', fontWeight: '900' },
  menuOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  actionMenu: { borderRadius: 12, backgroundColor: '#FFFFFF', padding: 10 },
  actionMenuTitle: { padding: 12, color: '#0F172A', fontSize: 15, fontWeight: '900' },
  actionMenuItem: { padding: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionMenuText: { color: '#0F172A', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  actionMenuDeleteText: { color: '#DC2626', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  actionMenuCancel: { marginTop: 8, padding: 14, borderRadius: 8, backgroundColor: '#F8FAFC' },
});
