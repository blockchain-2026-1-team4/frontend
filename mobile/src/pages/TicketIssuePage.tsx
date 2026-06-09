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
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { EventFlowHero, EventFlowSectionHead, EventFlowTopBar, EventFormGroup } from '../components/EventFlowKit';
import { PosterThumb } from '../components/TicketFlowKit';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import type { EventDetail, EventRound, TicketDetail } from '../types/api';

type TicketIconName = 'settings' | 'list' | 'ticket' | 'calendar' | 'seat' | 'hash' | 'eth' | 'repeat' | 'adjust' | 'check' | 'plus' | 'rocket';

function TicketIcon({ name, color = '#534AB7', size = 14 }: { name: TicketIconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'settings' ? <Path {...common} d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-13v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /> : null}
      {name === 'list' ? <Path {...common} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> : null}
      {name === 'ticket' ? <Path {...common} d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Zm8-1v12" /> : null}
      {name === 'calendar' ? <Path {...common} d="M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /> : null}
      {name === 'seat' ? <Path {...common} d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v8H5v-8Zm2 8v2m10-2v2" /> : null}
      {name === 'hash' ? <Path {...common} d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /> : null}
      {name === 'eth' ? <Path {...common} d="m12 2 6 10-6 4-6-4 6-10Zm0 14 6-4-6 10-6-10 6 4Z" /> : null}
      {name === 'repeat' ? <Path {...common} d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /> : null}
      {name === 'adjust' ? <Path {...common} d="M4 6h16M4 12h16M4 18h16M8 6v0M14 12v0M10 18v0" /> : null}
      {name === 'check' ? <Path {...common} d="m5 12 4 4L19 6" /> : null}
      {name === 'plus' ? <Path {...common} d="M12 5v14M5 12h14" /> : null}
      {name === 'rocket' ? <Path {...common} d="M4.5 16.5 3 21l4.5-1.5M9 15l-4-4s4-7 13-8c1 9-8 13-8 13l-4-4m7-5h.01" /> : null}
    </Svg>
  );
}

function CardIcon({ name, bg, color }: { name: TicketIconName; bg: string; color: string }) {
  return (
    <View style={[styles.cardHeadIcon, { backgroundColor: bg }]}>
      <TicketIcon name={name} color={color} size={13} />
    </View>
  );
}

const SECTION_PRESETS = ['VIP', 'R', 'S', 'A', 'B', 'C', '스탠딩'];
const RESALE_RATE_PRESETS = ['100', '110', '120', '150'];
const SALE_END_HOURS_OPTIONS = [
  { value: '0.5', label: '30분 전' },
  { value: '1', label: '1시간 전' },
  { value: '2', label: '2시간 전' },
  { value: '3', label: '3시간 전' },
  { value: '6', label: '6시간 전' },
  { value: '12', label: '12시간 전' },
  { value: '24', label: '1일 전' },
  { value: 'custom', label: '직접 입력' },
];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => pad(index));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => pad(index * 5));

type FlowPage = 1 | 2 | 3 | 4;
type PolicyMode = 'global' | 'round';

type SectionPolicy = {
  id: string;
  sectionName: string;
  customSectionName: string;
  useCustomSectionName: boolean;
  quantity: string;
  priceEth: string;
  useCustomSaleStart: boolean;
  customSaleStartDate: string;
  customSaleStartTime: string;
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
  saleStartDate: string;
  saleStartTime: string;
  saleEndHoursBefore: string;
  customSaleEndHoursBefore: string;
  showAdvancedSaleStart: boolean;
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

function makeSectionPolicy(): SectionPolicy {
  return {
    id: makeId('section'),
    sectionName: '',
    customSectionName: '',
    useCustomSectionName: false,
    quantity: '',
    priceEth: '',
    useCustomSaleStart: false,
    customSaleStartDate: localDate(new Date()),
    customSaleStartTime: '10:00',
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

function effectiveSaleEndHours(value: string, customValue?: string) {
  return value === 'custom' ? customValue || '' : value;
}

function dateMonthDay(value?: string) {
  if (!value) return { month: '---', day: '--', weekday: '' };
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { month: '---', day: '--', weekday: '' };
  return {
    month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: pad(date.getDate()),
    weekday: date.toLocaleString('ko-KR', { weekday: 'long' }),
  };
}

function saleEndLabel(value: string, customValue?: string) {
  if (value === 'custom') return `공연 ${customValue || '-'}시간 전`;
  return `공연 ${SALE_END_HOURS_OPTIONS.find((option) => option.value === value)?.label || value}`;
}

function ticketIdentifier(ticket: TicketDetail) {
  return ticket.id ? String(ticket.id) : ticket.ticketId != null ? String(ticket.ticketId) : '';
}

function confirmAction(title: string, message: string) {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: '확인', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true },
    );
  });
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
  const [policyMode, setPolicyMode] = useState<PolicyMode>('global');
  const [defaultResaleEnabled, setDefaultResaleEnabled] = useState(true);
  const [defaultResaleCapRate, setDefaultResaleCapRate] = useState('120');
  const [globalTotalTicketCount, setGlobalTotalTicketCount] = useState('');
  const [globalSaleStartDate, setGlobalSaleStartDate] = useState(localDate(new Date()));
  const [globalSaleStartTime, setGlobalSaleStartTime] = useState('10:00');
  const [globalSaleEndHoursBefore, setGlobalSaleEndHoursBefore] = useState('1');
  const [globalCustomSaleEndHoursBefore, setGlobalCustomSaleEndHoursBefore] = useState('');
  const [globalShowAdvancedSaleStart, setGlobalShowAdvancedSaleStart] = useState(false);
  const [globalSections, setGlobalSections] = useState<SectionPolicy[]>([]);
  const [roundPolicies, setRoundPolicies] = useState<Record<string, RoundPolicy>>({});
  const [activeRoundKey, setActiveRoundKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SectionPolicy>>({});
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [lastIssuedSummary, setLastIssuedSummary] = useState('');
  const [lastIssuedTicketIds, setLastIssuedTicketIds] = useState<string[]>([]);
  const [ticketConfigConfirmed, setTicketConfigConfirmed] = useState(false);
  const [issueCompleted, setIssueCompleted] = useState(false);
  const [prevFlowPage, setPrevFlowPage] = useState<FlowPage | null>(null);
  const [issueSeatModalVisible, setIssueSeatModalVisible] = useState(false);
  const [actionPolicy, setActionPolicy] = useState<SectionPolicy | null>(null);
  const [addingPolicy, setAddingPolicy] = useState(false);

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
          const existing = current[key];
          next[key] = existing ?? {
            roundKey: key,
            totalTicketCount: '',
            saleStartDate: localDate(new Date()),
            saleStartTime: '10:00',
            saleEndHoursBefore: '1',
            customSaleEndHoursBefore: '',
            showAdvancedSaleStart: false,
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
  const currentDraft = drafts[draftKey] || {
    ...makeSectionPolicy(),
    resaleEnabled: defaultResaleEnabled,
    resaleCapRate: defaultResaleCapRate,
  };
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
      navigation.replace('OrganizerEventDetail', { eventId });
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
    setLastIssuedTicketIds([]);
    setLastIssuedSummary('');
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...currentDraft, ...patch },
    }));
  };

  const updateRoundPolicy = (key: string, patch: Partial<RoundPolicy>) => {
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setLastIssuedTicketIds([]);
    setLastIssuedSummary('');
    setRoundPolicies((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const selectPolicyMode = (mode: PolicyMode) => {
    setPolicyMode(mode);
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setLastIssuedTicketIds([]);
    setLastIssuedSummary('');
  };

  const updateDefaultResale = (patch: { enabled?: boolean; capRate?: string }) => {
    if (typeof patch.enabled === 'boolean') setDefaultResaleEnabled(patch.enabled);
    if (patch.capRate) setDefaultResaleCapRate(patch.capRate);
    setDrafts((current) => Object.fromEntries(Object.entries(current).map(([key, draft]) => [
      key,
      {
        ...draft,
        resaleEnabled: typeof patch.enabled === 'boolean' ? patch.enabled : draft.resaleEnabled,
        resaleCapRate: patch.capRate || draft.resaleCapRate,
        useCustomResaleRate: patch.capRate ? false : draft.useCustomResaleRate,
      },
    ])));
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
  };

  const updateGlobalTotalTicketCount = (value: string) => {
    setGlobalTotalTicketCount(value);
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setLastIssuedTicketIds([]);
    setLastIssuedSummary('');
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
      // 각 회차에 이미 발행된 수보다 작게 설정할 수 없음
      for (const [index, round] of (rounds || []).entries()) {
        const already = issuedCountForRound(round, index);
        if (Number(globalTotalTicketCount || 0) < already) {
          showError(`${index + 1}회차에 이미 ${already}장이 발행되어 있습니다. 총 티켓 수는 최소 ${already}장 이상으로 설정해야 합니다.`);
          return false;
        }
      }
      if (!globalSaleStartDate || !globalSaleStartTime) {
        showError('판매 시작 날짜와 시간을 입력해주세요.');
        return false;
      }
      if (!globalSaleEndHoursBefore) {
        showError('판매 종료 시점을 선택해주세요.');
        return false;
      }
      if (globalSaleEndHoursBefore === 'custom' && !isPositiveNumber(globalCustomSaleEndHoursBefore)) {
        showError('판매 종료 직접 입력값을 시간 단위로 입력해주세요.');
        return false;
      }
      return true;
    }
    const missingSale = rounds.find((round, index) => {
      const rp = roundPolicies[roundKey(round, index)];
      return !rp?.saleStartDate || !rp?.saleStartTime || !rp?.saleEndHoursBefore;
    });
    if (missingSale) {
      showError('각 회차의 판매 기간을 모두 설정해주세요.');
      return false;
    }
    const missingCustomSale = rounds.find((round, index) => {
      const rp = roundPolicies[roundKey(round, index)];
      return rp?.saleEndHoursBefore === 'custom' && !isPositiveNumber(rp.customSaleEndHoursBefore || '');
    });
    if (missingCustomSale) {
      showError('직접 입력한 판매 종료 시간을 모두 입력해주세요.');
      return false;
    }
    const missing = rounds.find((round, index) => !isPositiveInteger(roundPolicies[roundKey(round, index)]?.totalTicketCount || ''));
    if (missing) {
      showError('각 회차의 총 티켓 수를 모두 입력해주세요.');
      return false;
    }
    // 회차별로 이미 발행된 수보다 작게 총 수를 설정할 수 없음
    for (const [index, round] of rounds.entries()) {
      const rp = roundPolicies[roundKey(round, index)];
      const already = issuedCountForRound(round, index);
      if (rp && Number(rp.totalTicketCount || 0) < already) {
        showError(`${index + 1}회차에 이미 ${already}장이 발행되어 있습니다. 총 티켓 수는 최소 ${already}장 이상으로 설정해야 합니다.`);
        return false;
      }
    }
    return true;
  };

  const validateSection = (policy: SectionPolicy, label: string) => {
    const sectionName = sectionNameOf(policy);
    const resaleRate = Number(resaleRateOf(policy));
    if (!sectionName) return `${label} 좌석 구역을 선택해주세요.`;
    if (!isPositiveInteger(policy.quantity)) return `${label} 발행 개수는 1장 이상이어야 합니다.`;
    if (!isPositiveInteger(policy.startNumber)) return `${label} 시작 번호는 1 이상이어야 합니다.`;
    if (!isPositiveNumber(policy.priceEth)) return `${label} 가격은 0보다 큰 값이어야 합니다.`;
    if (policy.useCustomSaleStart && (!policy.customSaleStartDate || !policy.customSaleStartTime)) {
      return `${label} 구역별 판매 시작 날짜와 시간을 입력해주세요.`;
    }
    if (policy.resaleEnabled && (!Number.isFinite(resaleRate) || resaleRate < 100)) return `${label} 최대 리셀가는 100% 이상이어야 합니다.`;
    return null;
  };

  const saveCurrentPolicy = () => {
    if (!policyMode || !draftBaseRound) return;
    const label = policyMode === 'global' ? '공통 정책' : `${activeRoundIndex + 1}회차 정책`;
    const message = validateSection(currentDraft, label);
    if (message) {
      showError(message);
      return;
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
    setLastIssuedTicketIds([]);
    setLastIssuedSummary('');
    setFeedback({ type: 'success', message: `${sectionNameOf(saved)} 정책을 저장했습니다.` });
    setAddingPolicy(false);
  };

  const removeSavedPolicy = (sectionId: string) => {
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setLastIssuedTicketIds([]);
    setLastIssuedSummary('');
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
    setAddingPolicy(true);
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...policy, id: makeId('section'), expanded: false },
    }));
    removeSavedPolicy(policy.id);
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setLastIssuedTicketIds([]);
    setLastIssuedSummary('');
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

  const sectionToPayload = (
    policy: SectionPolicy,
    round: EventRound,
    roundIndex: number,
    policies: SectionPolicy[],
    roundSaleStartDate: string,
    roundSaleStartTime: string,
    roundSaleEndHoursBefore: string,
  ): IssueSectionPayload => {
    const rawSection = sectionNameOf(policy);
    const saleStartAt = policy.useCustomSaleStart
      ? toDateTimeIso(policy.customSaleStartDate, policy.customSaleStartTime)
      : toDateTimeIso(roundSaleStartDate, roundSaleStartTime);
    const saleEndAt = new Date(
      new Date(roundStartIso(round)).getTime() - Number(roundSaleEndHoursBefore) * 3_600_000
    ).toISOString();
    return {
      eventRoundId: round.id,
      sectionName: `${roundIndex + 1}회차-${rawSection}`,
      priceWei: ethToWei(policy.priceEth),
      saleStartAt,
      saleEndAt,
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
      ? rounds.flatMap((round, index) =>
          globalSections.map((section) =>
            sectionToPayload(section, round, index, globalSections, globalSaleStartDate, globalSaleStartTime, effectiveSaleEndHours(globalSaleEndHoursBefore, globalCustomSaleEndHoursBefore))
          )
        )
      : rounds.flatMap((round, index) => {
          const key = roundKey(round, index);
          const rp = roundPolicies[key];
          const sections = rp?.sections || [];
          return sections.map((section) =>
            sectionToPayload(section, round, index, sections, rp?.saleStartDate || '', rp?.saleStartTime || '', effectiveSaleEndHours(rp?.saleEndHoursBefore || '1', rp?.customSaleEndHoursBefore))
          );
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
      const firstPriceEth = policyMode === 'global'
        ? globalSections[0]?.priceEth
        : roundPolicies[roundKey(rounds[0], 0)]?.sections[0]?.priceEth;
      const baseTicketPriceWei = firstPriceEth ? ethToWei(firstPriceEth) : undefined;
      const issued = await backendApi.issueTickets(eventId, { totalTicketCount, ticketSections: payload, baseTicketPriceWei });
      const summary = issued.slice(0, 3).map((ticket) => ticket.seatInfo).join(', ');
      const issuedIds = issued.map(ticketIdentifier).filter(Boolean);
      setLastIssuedSummary(summary ? `${summary}${issued.length > 3 ? ` 외 ${issued.length - 3}장` : ''}` : `${issued.length}장`);
      setLastIssuedTicketIds(issuedIds);
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
  const savedPolicySaleSummary = (policy: SectionPolicy) => {
    if (policy.useCustomSaleStart) {
      return `판매 시작 ${formatDateShort(policy.customSaleStartDate)} ${policy.customSaleStartTime} (구역별)`;
    }
    return '판매 기간: 회차 공통 설정';
  };
  const savedPolicyResaleSummary = (policy: SectionPolicy) => policy.resaleEnabled ? `리셀 허용 · 최대 ${resaleRateOf(policy)}%` : '리셀 불가';
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
  const expectedMaxRevenueEth = policyMode === 'global'
    ? globalSections.reduce((sum, section) => sum + Number(section.priceEth || 0) * Number(section.quantity || 0), 0) * rounds.length
    : Object.values(roundPolicies).reduce(
      (sum, policy) => sum + policy.sections.reduce((sectionSum, section) => sectionSum + Number(section.priceEth || 0) * Number(section.quantity || 0), 0),
      0,
    );
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
    setPrevFlowPage(flowPage);
    setTicketConfigConfirmed(true);
    setIssueCompleted(false);
    setFlowPage(4);
    setFeedback({ type: 'success', message: '티켓 설정을 완료했습니다. 최종 발행 내용을 확인해주세요.' });
  };

  const reopenTicketConfig = async () => {
    if (issueCompleted) {
      if (lastIssuedTicketIds.length === 0) {
        showError('방금 발행한 티켓 정보를 확인할 수 없어 취소할 수 없습니다. 티켓 판매 현황에서 확인해주세요.');
        return;
      }
      const confirmed = await confirmAction(
        '직전 발행을 취소할까요?',
        `방금 발행한 티켓 ${lastIssuedTicketIds.length}장을 취소한 뒤 다시 설정합니다. 이미 판매된 티켓은 취소할 수 없습니다.`,
      );
      if (!confirmed) return;

      setIssuing(true);
      try {
        await backendApi.cancelIssuedTickets(eventId, { ticketIds: lastIssuedTicketIds });
        setTickets((current) => current.filter((ticket) => !lastIssuedTicketIds.includes(ticketIdentifier(ticket))));
        setLastIssuedSummary('');
        setLastIssuedTicketIds([]);
        setFeedback({ type: 'success', message: '직전 발행을 취소했습니다. 티켓 설정을 다시 수정할 수 있습니다.' });
        await load();
      } catch (error: any) {
        showError(errorMessage(error, '직전 발행을 취소하지 못했습니다.'));
        return;
      } finally {
        setIssuing(false);
      }
    }
    setTicketConfigConfirmed(false);
    setIssueCompleted(false);
    setFlowPage(prevFlowPage ?? 3);
    setPrevFlowPage(null);
  };

  const pageTitle = flowPage === 1
    ? '적용 대상 선택'
    : flowPage === 2
      ? '티켓 발행 설정'
      : flowPage === 3
        ? '좌석 정책'
        : '최종 발행 확인';
  const pageDescription = policyMode === 'global'
    ? '기본은 모든 선택 회차에 동일 적용입니다. 특정 회차만 다르면 회차별로 따로 설정할 수 있습니다.'
    : '각 회차마다 발행 수량과 좌석 정책을 따로 설정합니다.';
  const eventName = event?.name || event?.title || '이벤트';
  const eventVenue = event?.venue || '장소 미정';
  const finalConfirming = flowPage === 4;
  const savedOverviewMode = flowPage === 3 && !ticketConfigConfirmed && currentSections.length > 0 && !sectionNameOf(currentDraft) && !addingPolicy;
  const heroTitle = flowPage === 1
    ? '회차별로 반복 입력하지 않게\n먼저 적용 범위를 정하세요.'
    : flowPage === 2
      ? '선택한 회차에 적용할\n판매 수량과 기간을 정하세요.'
      : flowPage === 3
        ? '구역별 가격과 수량을\n한 번에 정리하세요.'
        : '발행 전 내용을\n마지막으로 확인하세요.';
  const heroSubtitle = flowPage === 1
    ? '같은 티켓 정책이면 모든 회차에 공통 적용하고, 회차별 설정도 선택할 수 있습니다.'
    : flowPage === 2
      ? policyMode === 'global'
        ? '아래 정책은 선택한 모든 회차에 공통 적용됩니다.'
        : '상단에서 선택한 회차의 발행 정책을 설정합니다.'
      : flowPage === 3
        ? policyMode === 'global'
          ? '좌석 구성, 가격, 리셀 정책이 모든 회차에 공통 적용됩니다.'
          : '상단에서 선택한 회차의 좌석 정책을 편집합니다.'
        : policyMode === 'global'
          ? `선택한 ${rounds.length}개 회차에 동일한 티켓 정책이 적용됩니다.`
          : '회차별로 설정한 티켓 정책을 마지막으로 확인합니다.';
  const headerIcon: TicketIconName = flowPage === 1 ? 'settings' : flowPage === 2 ? 'ticket' : 'seat';
  const headerColor = '#534AB7';
  const canRevealQuantity = !!sectionNameOf(currentDraft);
  const canRevealPrice = canRevealQuantity && isPositiveInteger(currentDraft.quantity);
  const canRevealResale = canRevealPrice && isPositiveNumber(currentDraft.priceEth);
  const showPolicySaveBar = flowPage === 3 && !ticketConfigConfirmed && !savedOverviewMode && canRevealResale;
  const showPostIssueBar = finalConfirming && issueCompleted;
  const showBottomBar = true;

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
      <EventFlowTopBar
        eyebrow={flowPage === 3 ? 'Seat Policy' : flowPage === 4 ? 'Final Review' : 'Ticket Issue'}
        title={pageTitle}
        badge={`${flowPage}/4`}
        badgeTone="gray"
        onBack={flowPage === 1 ? goBackToEventFlow : flowPage === 4 ? () => void reopenTicketConfig() : () => setFlowPage((flowPage - 1) as FlowPage)}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <EventFlowHero
          height={196}
          badge={flowPage === 1 ? '적용 대상' : flowPage === 2 ? '발행 설정' : flowPage === 3 ? '좌석 정책' : '최종 확인'}
          title={heroTitle}
          meta={heroSubtitle}
          posters
          imageUrl={resolveImageUrl(event?.imageUrl)}
        />
        <StepProgress page={flowPage} />
        {policyMode === 'round' && (flowPage === 2 || flowPage === 3) ? (
          <View style={styles.policyRoundSelectorCard}>
            <View style={styles.policyRoundSelectorHead}>
              <View style={styles.policyRoundSelectorIcon}>
                <TicketIcon name="calendar" color="#534AB7" size={13} />
              </View>
              <View style={styles.policyRoundSelectorCopy}>
                <Text style={styles.policyRoundSelectorTitle}>회차 선택</Text>
                <Text style={styles.policyRoundSelectorMeta}>현재 설정할 회차를 선택하세요.</Text>
              </View>
              <View style={styles.commonApplyPill}>
                <Text style={styles.commonApplyPillText}>개별 설정</Text>
              </View>
            </View>
            <RoundSelector rounds={rounds} activeRoundKey={activeKey} onSelect={setActiveRoundKey} disabled={false} />
          </View>
        ) : null}

        {feedback?.type === 'error' ? (
          <View style={[styles.messageBox, styles.errorBox]}>
            <Text style={[styles.messageText, styles.errorText]}>{feedback.message}</Text>
          </View>
        ) : null}

        {flowPage === 1 ? (
          <>
            <View style={[styles.card, styles.targetEventCard]}>
              <PosterThumb imageUrl={resolveImageUrl(event?.imageUrl)} title={eventName} style={styles.targetPoster} />
              <View style={styles.targetEventCopy}>
                <Text style={styles.targetBadge}>발행 대상 이벤트</Text>
                <Text style={styles.targetEventTitle}>{eventName}</Text>
                <Text style={styles.targetEventMeta}>{eventVenue}{'\n'}같은 장소 · {rounds.length}개 회차</Text>
              </View>
            </View>
            <View style={styles.targetSection}>
              <View style={styles.targetSectionHead}>
                <View>
                  <Text style={styles.targetSectionTitle}>적용할 회차</Text>
                  <Text style={styles.targetSectionSub}>티켓 정책을 적용할 전체 회차입니다.</Text>
                </View>
                <View style={styles.selectedCountPill}>
                  <Text style={styles.selectedCountText}>{rounds.length}개 선택</Text>
                </View>
              </View>
              <View style={styles.targetRoundList}>
                {rounds.map((round, index) => {
                  const date = dateMonthDay(round.eventDate);
                  return (
                    <View key={roundKey(round, index)} style={styles.targetRoundCard}>
                      <View style={styles.targetDateBox}>
                        <Text style={styles.targetDateMonth}>{date.month}</Text>
                        <Text style={styles.targetDateDay}>{date.day}</Text>
                      </View>
                      <View style={styles.targetRoundCopy}>
                        <Text style={styles.targetRoundName}>{index + 1}회차 · {date.weekday}</Text>
                        <Text style={styles.targetRoundMeta}>{round.startTime} ~ {round.endTime} · 같은 장소</Text>
                      </View>
                      <View style={styles.targetRoundCheck}>
                        <TicketIcon name="check" color="#0F172A" size={15} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.flowStack}>
          {flowPage === 1 ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <CardIcon name={headerIcon} bg="#EEEDFE" color={headerColor} />
                <Text style={[styles.cardTitle, { color: headerColor }]}>정책 적용 방식</Text>
              </View>
              <Text style={styles.pageDescription}>{pageDescription}</Text>
              <View style={styles.modeStack}>
                <TouchableOpacity style={[styles.modeCard, policyMode === 'global' && styles.activeModeCard]} onPress={() => selectPolicyMode('global')}>
                  <View style={[styles.optionRadio, policyMode === 'global' && styles.optionRadioOn]}>
                    {policyMode === 'global' ? <View style={styles.optionRadioDot} /> : null}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.modeTitle, policyMode === 'global' && styles.activeModeText]}>선택 회차 공통 적용</Text>
                    <Text style={styles.modeHint}>선택한 모든 회차에 같은 정책을 적용합니다.</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeCard, policyMode === 'round' && styles.activeModeCard]} onPress={() => selectPolicyMode('round')}>
                  <View style={[styles.optionRadio, policyMode === 'round' && styles.optionRadioOn]}>
                    {policyMode === 'round' ? <View style={styles.optionRadioDot} /> : null}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.modeTitle, policyMode === 'round' && styles.activeModeText]}>회차별로 따로 설정</Text>
                    <Text style={styles.modeHint}>각 회차의 수량과 정책을 따로 설정합니다.</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {flowPage === 2 && policyMode === 'global' ? (
            <View style={styles.sectionBlock}>
              <View style={styles.targetSummaryCard}>
                <View style={styles.targetSummaryIcon}><TicketIcon name="check" color="#0F6E56" size={18} /></View>
                <View style={styles.targetSummaryCopy}>
                  <Text style={styles.targetSummaryTitle}>선택 회차 공통 적용</Text>
                  <Text style={styles.targetSummarySub}>{rounds.map((round, index) => `${index + 1}회차 ${formatDateShort(round.eventDate)} ${round.startTime}`).join(' · ')}{'\n'}회차별로 같은 수량과 판매 정책을 적용합니다.</Text>
                </View>
              </View>
              <View style={styles.sectionHeadingWrap}>
                <EventFlowSectionHead title="발행 수량" subtitle="각 회차에서 판매 가능한 티켓 수" />
              </View>
              <View style={styles.formSectionBody}>
                <EventFormGroup icon="ticket" label="회차별 발행 수량" helper="선택한 각 회차에 같은 수량이 적용됩니다.">
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
                </EventFormGroup>
              </View>
              <View style={styles.sectionHeadingWrap}>
                <EventFlowSectionHead title="판매 기간" subtitle="사용자가 티켓을 구매할 수 있는 기간" />
              </View>
              <View style={styles.formSectionBody}>
                <EventFormGroup icon="calendar" label="판매 시작" helper="공식 예매가 열리는 날짜와 시간입니다.">
                  <View style={styles.dateTimeGrid}>
                    <DatePickerField label="판매 시작 날짜" value={globalSaleStartDate} onChange={(v) => { setGlobalSaleStartDate(v); setTicketConfigConfirmed(false); }} />
                    <TimePickerField label="시작 시간" value={globalSaleStartTime} onChange={(v) => { setGlobalSaleStartTime(v); setTicketConfigConfirmed(false); }} />
                  </View>
                </EventFormGroup>
                <EventFormGroup icon="clock" label="판매 종료" helper="각 회차 시작 시간을 기준으로 자동 종료됩니다.">
                  <View style={styles.chipGrid}>
                    {SALE_END_HOURS_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.choiceChip, globalSaleEndHoursBefore === opt.value && styles.activeChip]}
                        onPress={() => { setGlobalSaleEndHoursBefore(opt.value); setTicketConfigConfirmed(false); }}
                      >
                        <Text style={[styles.choiceChipText, globalSaleEndHoursBefore === opt.value && styles.activeChipText]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {globalSaleEndHoursBefore === 'custom' ? (
                    <View style={styles.directInputWrap}>
                      <TextInput
                        style={styles.directInput}
                        value={globalCustomSaleEndHoursBefore}
                        onChangeText={(value) => { setGlobalCustomSaleEndHoursBefore(value); setTicketConfigConfirmed(false); }}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        placeholder="예: 4"
                      />
                      <Text style={styles.unitText}>시간 전</Text>
                    </View>
                  ) : null}
                </EventFormGroup>
              </View>
            </View>
          ) : null}

          {flowPage === 2 && policyMode === 'round' ? (
            <View style={styles.sectionBlock}>
              <View style={styles.targetSummaryCard}>
                <View style={styles.targetSummaryIcon}><TicketIcon name="check" color="#0F6E56" size={18} /></View>
                <View style={styles.targetSummaryCopy}>
                  <Text style={styles.targetSummaryTitle}>선택 회차 개별 설정</Text>
                  <Text style={styles.targetSummarySub}>{activeRoundIndex + 1}회차 {formatDateShort(activeRound?.eventDate)} {activeRound?.startTime}{'\n'}상단에서 선택한 회차의 수량과 판매 정책을 설정합니다.</Text>
                </View>
              </View>
              <View style={styles.sectionHeadingWrap}>
                <EventFlowSectionHead title="발행 수량" subtitle="선택한 회차에서 판매 가능한 티켓 수" />
              </View>
              <View style={styles.formSectionBody}>
                <EventFormGroup icon="ticket" label="회차별 발행 수량" helper="상단에서 선택한 회차에만 적용됩니다.">
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
                </EventFormGroup>
              </View>
              <View style={styles.sectionHeadingWrap}>
                <EventFlowSectionHead title="판매 기간" subtitle="선택한 회차의 티켓 구매 가능 기간" />
              </View>
              <View style={styles.formSectionBody}>
                <EventFormGroup icon="calendar" label="판매 시작" helper="선택한 회차의 공식 예매 시작 날짜와 시간입니다.">
                  <View style={styles.dateTimeGrid}>
                    <DatePickerField label="판매 시작 날짜" value={roundPolicies[activeKey]?.saleStartDate || ''} onChange={(v) => updateRoundPolicy(activeKey, { saleStartDate: v })} />
                    <TimePickerField label="시작 시간" value={roundPolicies[activeKey]?.saleStartTime || ''} onChange={(v) => updateRoundPolicy(activeKey, { saleStartTime: v })} />
                  </View>
                </EventFormGroup>
                <EventFormGroup icon="clock" label="판매 종료" helper="선택한 회차 시작 시간을 기준으로 자동 종료됩니다.">
                  <View style={styles.chipGrid}>
                    {SALE_END_HOURS_OPTIONS.map((opt) => {
                      const active = (roundPolicies[activeKey]?.saleEndHoursBefore || '1') === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.choiceChip, active && styles.activeChip]}
                          onPress={() => updateRoundPolicy(activeKey, { saleEndHoursBefore: opt.value })}
                        >
                          <Text style={[styles.choiceChipText, active && styles.activeChipText]}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {(roundPolicies[activeKey]?.saleEndHoursBefore || '1') === 'custom' ? (
                    <View style={styles.directInputWrap}>
                      <TextInput
                        style={styles.directInput}
                        value={roundPolicies[activeKey]?.customSaleEndHoursBefore || ''}
                        onChangeText={(value) => updateRoundPolicy(activeKey, { customSaleEndHoursBefore: value })}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        placeholder="예: 4"
                      />
                      <Text style={styles.unitText}>시간 전</Text>
                    </View>
                  ) : null}
                </EventFormGroup>
              </View>
            </View>
          ) : null}

          {flowPage === 2 ? (
            <>
              <View style={styles.sectionHeadingWrap}>
                <EventFlowSectionHead title="공통 리셀 정책" subtitle="좌석별로 나중에 수정할 수 있습니다." />
              </View>
              <View style={styles.formSectionBody}>
                <EventFormGroup icon="refresh" label="리셀 허용" helper="구매자가 공식 리셀 마켓에 티켓을 등록할 수 있습니다." required={false}>
                  <TouchableOpacity style={styles.resaleToggleControl} onPress={() => updateDefaultResale({ enabled: !defaultResaleEnabled })}>
                    <Text style={styles.resaleToggleText}>{defaultResaleEnabled ? '허용됨' : '허용 안 함'}</Text>
                    <View style={[styles.switchTrack, !defaultResaleEnabled && styles.switchTrackOff]}>
                      <View style={[styles.switchKnob, !defaultResaleEnabled && styles.switchKnobOff]} />
                    </View>
                  </TouchableOpacity>
                  {defaultResaleEnabled ? (
                    <>
                      <Text style={styles.label}>최대 리셀가</Text>
                      <View style={styles.resaleChipRow}>
                        {RESALE_RATE_PRESETS.map((rate) => (
                          <TouchableOpacity
                            key={rate}
                            style={[styles.resaleChip, defaultResaleCapRate === rate && styles.activeChip]}
                            onPress={() => updateDefaultResale({ capRate: rate })}
                          >
                            <Text style={[styles.resaleChipText, defaultResaleCapRate === rate && styles.activeChipText]}>{rate}%</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : null}
                </EventFormGroup>
              </View>
            </>
          ) : null}

          {flowPage === 3 && policyMode && !ticketConfigConfirmed ? (
            <View style={styles.sectionBlock}>
              <View style={styles.targetSummaryCard}>
                <View style={styles.targetSummaryIcon}><TicketIcon name="check" color="#0F6E56" size={18} /></View>
                <View style={styles.targetSummaryCopy}>
                  <Text style={styles.targetSummaryTitle}>{policyMode === 'global' ? `${rounds.length}개 회차에 동일 적용` : `${activeRoundIndex + 1}회차 개별 좌석 정책`}</Text>
                  <Text style={styles.targetSummarySub}>{policyMode === 'global' ? '회차마다 같은 좌석 구성, 가격, 리셀 정책을 사용합니다.' : '상단에서 선택한 회차에만 현재 좌석 구성과 가격을 적용합니다.'}</Text>
                </View>
              </View>
              <View style={styles.sectionHeadingWrap}>
                <EventFlowSectionHead
                  title="좌석 정책"
                  subtitle={policyMode === 'global' ? `회차별 ${globalTotalTicketCount || 0}장 배정` : `${activeRoundIndex + 1}회차 · 총 ${activeRoundTotalCount || 0}장`}
                />
              </View>
              {savedOverviewMode ? (
                <>
                  <View style={styles.savedZone}>
                    <View style={styles.savedZoneHeader}>
                      <TicketIcon name="check" color="#0F6E56" size={15} />
                      <Text style={styles.savedZoneTitle}>저장 완료된 좌석 정책</Text>
                      <View style={styles.savedCountPill}>
                        <Text style={styles.savedCountText}>{currentSections.length}개</Text>
                      </View>
                    </View>
                    {currentSections.map((policy) => (
                      <View key={policy.id} style={styles.savedSummaryCard}>
                        <View style={styles.seatCardTop}>
                          <Text style={styles.seatCardName}>{sectionNameOf(policy)}</Text>
                          <TouchableOpacity style={styles.moreButton} onPress={() => openSavedPolicyActions(policy)}>
                            <TicketIcon name="adjust" color="#64748B" size={14} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.seatKpiRow}>
                          <View style={styles.seatKpi}>
                            <Text style={styles.seatKpiLabel}>가격</Text>
                            <Text style={styles.seatKpiValue}>{policy.priceEth} ETH</Text>
                          </View>
                          <View style={styles.seatKpi}>
                            <Text style={styles.seatKpiLabel}>수량</Text>
                            <Text style={styles.seatKpiValue}>{policy.quantity}장</Text>
                          </View>
                          <View style={styles.seatKpi}>
                            <Text style={styles.seatKpiLabel}>리셀</Text>
                            <Text style={styles.seatKpiValue}>{policy.resaleEnabled ? `${resaleRateOf(policy)}%` : '불가'}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity style={styles.addSeatButton} onPress={() => setAddingPolicy(true)}>
                    <TicketIcon name="plus" color="#534AB7" size={18} />
                    <Text style={styles.addSeatButtonText}>새 좌석 정책 추가</Text>
                  </TouchableOpacity>

                </>
              ) : (
                <>
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

                  {currentSections.length > 0 ? (
                    <Text style={[styles.sectionTitle, currentSections.length > 0 && styles.newPolicyTitle]}>새 좌석 정책 추가</Text>
                  ) : null}
                  <View style={styles.builderBox}>
                    <View style={styles.stepCard}>
                      <View style={styles.policyCardHead}>
                        <CardIcon name="seat" bg="#EEEDFE" color="#534AB7" />
                        <Text style={[styles.policyCardTitle, { color: '#534AB7' }]}>1 · 좌석 구역 선택</Text>
                      </View>
                      <View style={styles.policyCardBody}>
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
                    </View>

                    {canRevealQuantity ? (
                      <View style={[styles.stepCard, styles.activeStepCard]}>
                        <View style={styles.policyCardHead}>
                          <CardIcon name="hash" bg="#E6F1FB" color="#185FA5" />
                          <Text style={[styles.policyCardTitle, { color: '#185FA5' }]}>2 · {sectionNameOf(currentDraft)} 발행 수량</Text>
                        </View>
                        <View style={styles.policyCardBody}>
                          <View style={styles.unitInputWrap}>
                            <TextInput style={styles.unitInput} value={currentDraft.quantity} onChangeText={(value) => updateDraft({ quantity: value })} keyboardType="number-pad" inputMode="numeric" placeholder="예: 10" />
                            <Text style={styles.unitText}>장</Text>
                          </View>
                          <View style={styles.issuePreviewBox}>
                            <View style={styles.previewRow}>
                              <Text style={styles.previewInlineLabel}>발행 예정</Text>
                              <Text style={styles.previewInlineValuePurple}>{seatRange(currentDraft, currentDraftStartNumber)}</Text>
                            </View>
                            {currentCapacityStatus ? (
                              <>
                                <View style={styles.previewRow}>
                                  <Text style={styles.previewInlineLabel}>총 {currentCapacityStatus.total}장 중 이미 발행</Text>
                                  <Text style={styles.previewInlineValue}>{currentCapacityStatus.alreadyIssued + currentCapacityStatus.saved}장</Text>
                                </View>
                                <View style={styles.previewRow}>
                                  <Text style={styles.previewInlineLabel}>남은 수량</Text>
                                  <Text style={styles.previewInlineValueGreen}>{currentCapacityStatus.remaining}장</Text>
                                </View>
                              </>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    ) : null}

                    {canRevealPrice ? (
                      <View style={[styles.stepCard, styles.formStepCard]}>
                        <View style={styles.policyCardHead}>
                          <CardIcon name="eth" bg="#E1F5EE" color="#0F6E56" />
                          <Text style={[styles.policyCardTitle, { color: '#0F6E56' }]}>3 · 가격 설정</Text>
                        </View>
                        <View style={styles.policyCardBody}>
                          <View style={styles.unitInputWrap}>
                            <TextInput style={styles.unitInput} value={currentDraft.priceEth} onChangeText={(value) => updateDraft({ priceEth: value })} keyboardType="decimal-pad" inputMode="decimal" placeholder="예: 0.2" />
                            <Text style={styles.unitText}>ETH</Text>
                          </View>
                        </View>
                      </View>
                    ) : null}

                    {canRevealResale ? (
                      <View style={[styles.stepCard, styles.formStepCard]}>
                        <View style={styles.policyCardHead}>
                          <CardIcon name="repeat" bg="#FAEEDA" color="#854F0B" />
                          <Text style={[styles.policyCardTitle, { color: '#854F0B' }]}>4 · 리셀 정책</Text>
                        </View>
                        <View style={styles.policyCardBody}>
                          <TouchableOpacity style={styles.toggleRow} onPress={() => updateDraft({ resaleEnabled: !currentDraft.resaleEnabled })}>
                            <Text style={styles.toggleLabel}>리셀 허용</Text>
                            <View style={[styles.switchTrack, !currentDraft.resaleEnabled && styles.switchTrackOff]}>
                              <View style={[styles.switchKnob, !currentDraft.resaleEnabled && styles.switchKnobOff]} />
                            </View>
                          </TouchableOpacity>
                          {currentDraft.resaleEnabled ? (
                            <>
                              <Text style={styles.label}>최대 리셀가</Text>
                              <View style={styles.resaleChipRow}>
                                {RESALE_RATE_PRESETS.map((rate) => (
                                  <TouchableOpacity
                                    key={rate}
                                    style={[styles.resaleChip, !currentDraft.useCustomResaleRate && currentDraft.resaleCapRate === rate && styles.activeChip]}
                                    onPress={() => updateDraft({ resaleCapRate: rate, useCustomResaleRate: false })}
                                  >
                                    <Text style={[styles.resaleChipText, !currentDraft.useCustomResaleRate && currentDraft.resaleCapRate === rate && styles.activeChipText]}>{rate}%</Text>
                                  </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={[styles.resaleChip, currentDraft.useCustomResaleRate && styles.activeChip]} onPress={() => updateDraft({ useCustomResaleRate: true })}>
                                  <Text style={[styles.resaleChipText, currentDraft.useCustomResaleRate && styles.activeChipText]}>직접 입력</Text>
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
                      </View>
                    ) : null}

                    {canRevealResale ? (
                      <View style={[styles.stepCard, styles.formStepCard]}>
                        <View style={styles.policyCardHead}>
                          <CardIcon name="adjust" bg="#F3F4F6" color="#6B7280" />
                          <Text style={[styles.policyCardTitle, { color: '#6B7280' }]}>5 · 고급: 구역별 판매 시작 별도 설정</Text>
                        </View>
                        <View style={styles.policyCardBody}>
                          <TouchableOpacity style={styles.toggleRow} onPress={() => updateDraft({ useCustomSaleStart: !currentDraft.useCustomSaleStart })}>
                            <View style={styles.toggleCopy}>
                              <Text style={styles.toggleLabel}>구역별 판매 시작 별도 설정</Text>
                              <Text style={styles.toggleSub}>설정 시 2단계 기간을 덮어씁니다.</Text>
                            </View>
                            <View style={[styles.switchTrack, !currentDraft.useCustomSaleStart && styles.switchTrackOff]}>
                              <View style={[styles.switchKnob, !currentDraft.useCustomSaleStart && styles.switchKnobOff]} />
                            </View>
                          </TouchableOpacity>
                          {currentDraft.useCustomSaleStart ? (
                            <View style={styles.dateTimeGrid}>
                              <DatePickerField label="판매 시작 날짜" value={currentDraft.customSaleStartDate} onChange={(v) => updateDraft({ customSaleStartDate: v })} />
                              <TimePickerField label="시작 시간" value={currentDraft.customSaleStartTime} onChange={(v) => updateDraft({ customSaleStartTime: v })} />
                            </View>
                          ) : null}
                        </View>
                      </View>
                    ) : null}

                  </View>
                </>
              )}
            </View>
          ) : null}
        </View>

        {flowPage === 4 && ticketConfigConfirmed ? (
          <>
            <View style={styles.reviewSection}>
              <EventFlowSectionHead title="발행 회차" subtitle={policyMode === 'global' ? '공통 정책 적용 대상' : '회차별 정책 적용 대상'} />
              <View style={styles.targetRoundList}>
                {rounds.map((round, index) => {
                  const date = dateMonthDay(round.eventDate);
                  const quantity = policyMode === 'global' ? globalTotalTicketCount : roundPolicies[roundKey(round, index)]?.totalTicketCount;
                  return (
                    <View key={roundKey(round, index)} style={styles.targetRoundCard}>
                      <View style={styles.targetDateBox}>
                        <Text style={styles.targetDateMonth}>{date.month}</Text>
                        <Text style={styles.targetDateDay}>{date.day}</Text>
                      </View>
                      <View style={styles.targetRoundCopy}>
                        <Text style={styles.targetRoundName}>{index + 1}회차 · {date.weekday}</Text>
                        <Text style={styles.targetRoundMeta}>{round.startTime} 시작 · {quantity || 0}장 발행</Text>
                      </View>
                      <View style={styles.targetRoundCheck}>
                        <TicketIcon name="check" color="#0F172A" size={15} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={styles.reviewSection}>
              <EventFlowSectionHead title="판매 정책" subtitle="발행 수량과 판매 기간" />
              <View style={styles.statusBand}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>회차별 발행 수량</Text>
                  <Text style={styles.confirmValue}>{policyMode === 'global' ? `${globalTotalTicketCount || 0}장` : '회차별 개별 설정'}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>총 발행 수량</Text>
                  <Text style={styles.confirmValue}>{totalConfiguredCapacity}장</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>판매 시작</Text>
                  <Text style={styles.confirmValue}>{policyMode === 'global' ? `${formatDateDot(globalSaleStartDate)} ${globalSaleStartTime}` : '회차별 개별 설정'}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>판매 종료</Text>
                  <Text style={styles.confirmValue}>{policyMode === 'global' ? saleEndLabel(globalSaleEndHoursBefore, globalCustomSaleEndHoursBefore) : '각 회차별 설정'}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>리셀 정책</Text>
                  <Text style={styles.confirmValueGreen}>{defaultResaleEnabled ? `허용 · 최대 ${defaultResaleCapRate}%` : '허용 안 함'}</Text>
                </View>
            {lastIssuedSummary ? (
              <>
                <Text style={styles.previewLabel}>방금 발행됨</Text>
                <Text style={styles.previewText}>{lastIssuedSummary}</Text>
              </>
            ) : null}
              </View>
            </View>
            <View style={styles.reviewSection}>
              <EventFlowSectionHead title="좌석 정책" subtitle={policyMode === 'global' ? '회차별 동일 적용 구역' : '회차별 설정 구역'} />
              <View style={styles.reviewSeatList}>
                {(policyMode === 'global' ? globalSections : Object.values(roundPolicies).flatMap((policy) => policy.sections)).map((section) => (
                  <View key={`${section.id}-${sectionNameOf(section)}`} style={styles.reviewSeatRow}>
                    <View style={styles.reviewSeatCopy}>
                      <Text style={styles.reviewSeatName}>{sectionNameOf(section)}</Text>
                      <Text style={styles.reviewSeatMeta}>{section.quantity}장 · {section.resaleEnabled ? `리셀 ${resaleRateOf(section)}%` : '리셀 불가'}</Text>
                    </View>
                    <Text style={styles.reviewSeatPrice}>{section.priceEth} ETH</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.totalCard}>
              <Text style={styles.totalCardTitle}>예상 최대 매출</Text>
              <Text style={styles.totalCardValue}>{expectedMaxRevenueEth.toFixed(2)} ETH</Text>
              <Text style={styles.totalCardSub}>저장된 좌석 정책의 가격과 발행 수량 기준</Text>
            </View>
            <View style={styles.finalNotice}>
              <TicketIcon name="adjust" color="#A16207" size={16} />
              <View style={styles.finalNoticeCopy}>
                <Text style={styles.finalNoticeTitle}>발행 후에는 주요 정책 변경이 제한됩니다.</Text>
                <Text style={styles.finalNoticeSub}>수량, 가격, 회차 시간이 사용자 티켓에 반영됩니다.</Text>
              </View>
            </View>
          </>
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

      {showBottomBar ? (
        <View style={styles.bottomBar}>
          {feedback?.type === 'success' ? (
            <View style={[styles.messageBox, styles.successBox, { marginTop: 0, marginHorizontal: 0, marginBottom: 10 }]}>
              <Text style={[styles.messageText, styles.successText]}>{feedback.message}</Text>
            </View>
          ) : null}
          {flowPage === 1 ? (
            <View style={styles.bottomRow}>
              <TouchableOpacity style={styles.bottomSecondaryButton} onPress={goBackToEventFlow}>
                <Text style={styles.bottomSecondaryText}>이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomPrimaryButton} onPress={() => setFlowPage(2)}>
                <Text style={styles.primaryButtonText}>다음 · 발행 설정</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {flowPage === 2 ? (
            <View style={styles.bottomRow}>
              <TouchableOpacity style={styles.bottomSecondaryButton} onPress={() => setFlowPage(1)}>
                <Text style={styles.bottomSecondaryText}>이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomPrimaryButton} onPress={() => validateCapacityPage() && setFlowPage(3)}>
                <Text style={styles.primaryButtonText}>다음 · 좌석 정책</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {flowPage === 3 && !showPolicySaveBar ? (
            <View style={styles.bottomRow}>
              <TouchableOpacity style={styles.bottomSecondaryButton} onPress={() => setFlowPage(2)}>
                <Text style={styles.bottomSecondaryText}>이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bottomPrimaryButton, !hasSavedPolicies && styles.disabledButton]} disabled={!hasSavedPolicies} onPress={confirmTicketConfig}>
                <Text style={styles.primaryButtonText}>다음 · 최종 확인</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {showPolicySaveBar ? (
            <View style={styles.bottomRow}>
              <TouchableOpacity style={styles.bottomSecondaryButton} onPress={() => setFlowPage(2)}>
                <Text style={styles.bottomSecondaryText}>이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomPrimaryButton} onPress={saveCurrentPolicy}>
                <Text style={styles.primaryButtonText}>{sectionNameOf(currentDraft) ? `${sectionNameOf(currentDraft)} 정책 저장` : '좌석 정책 저장'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {flowPage === 4 && !issueCompleted ? (
            <View style={styles.bottomRow}>
              <TouchableOpacity style={[styles.bottomSecondaryButton, issuing && styles.disabledButton]} disabled={issuing} onPress={() => void reopenTicketConfig()}>
                <Text style={styles.bottomSecondaryText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bottomPrimaryButton, issuing && styles.disabledButton]} disabled={issuing} onPress={issueTickets}>
                <Text style={styles.primaryButtonText}>{issuing ? '발행 중...' : '티켓 발행'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {showPostIssueBar ? (
            <View style={styles.bottomRow}>
              <TouchableOpacity style={styles.bottomSecondaryButton} onPress={() => setFlowPage(3)}>
                <Text style={styles.bottomSecondaryText}>이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomPrimaryButton} onPress={() => navigation.navigate('TicketExplore', { eventId })}>
                <Text style={styles.primaryButtonText}>판매 현황</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function StepProgress({ page }: { page: FlowPage }) {
  const steps: Array<{ step: FlowPage; label: string }> = [
    { step: 1, label: '대상' },
    { step: 2, label: '발행' },
    { step: 3, label: '좌석' },
    { step: 4, label: '확인' },
  ];

  return (
    <View style={styles.progressRow}>
      {steps.map((item, index) => {
        const active = page === item.step;
        const completed = page > item.step;
        return (
          <React.Fragment key={item.step}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, completed && styles.stepCircleDone, active && styles.stepCircleActive]}>
                {completed ? (
                  <TicketIcon name="check" color="#085041" size={11} />
                ) : (
                  <Text style={[styles.stepCircleText, active && styles.stepCircleTextActive]}>{item.step}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, completed && styles.stepLabelDone, active && styles.stepLabelActive]}>{item.label}</Text>
            </View>
            {index < steps.length - 1 ? <View style={[styles.progressLine, completed && styles.progressLineDone]} /> : null}
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roundChipRow}>
      {rounds.map((round, index) => {
        const key = roundKey(round, index);
        const active = disabled || activeRoundKey === key;
        return (
          <TouchableOpacity key={key} style={[styles.roundChip, active && styles.roundChipActive, disabled && !active && styles.disabledRoundChip]} disabled={disabled} onPress={() => onSelect(key)}>
            <View style={styles.roundChipTop}>
              <Text style={[styles.roundChipText, active && styles.roundChipTextActive]}>{index + 1}회차</Text>
              <Text style={[styles.roundChipStatus, active && styles.roundChipStatusActive]}>{active ? '선택됨' : '선택'}</Text>
            </View>
            <Text style={styles.roundChipDate}>{formatDateDot(round.eventDate)}</Text>
            <Text style={styles.roundChipDate}>{round.startTime} ~ {round.endTime}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
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
  screen: { flex: 1, backgroundColor: '#F6F7FB' },
  container: { flex: 1 },
  content: { paddingBottom: 146 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF' },
  emptyTitle: { color: '#1A1A2E', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  hero: { paddingHorizontal: 18, paddingBottom: 24 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  heroBackButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginTop: 0, marginBottom: 3, lineHeight: 24 },
  heroSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 17 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' },
  stepCircleDone: { backgroundColor: '#5EE3A1' },
  stepCircleActive: { backgroundColor: '#1A1A2E' },
  stepCircleText: { color: '#94A3B8', fontSize: 11, fontWeight: '900' },
  stepCircleTextActive: { color: '#FFFFFF' },
  stepLabel: { marginLeft: 7, color: '#94A3B8', fontSize: 10, fontWeight: '900' },
  stepLabelDone: { color: '#0F6E56' },
  stepLabelActive: { color: '#1A1A2E' },
  progressPill: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  progressPillDone: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  progressPillActive: { borderWidth: 1.5, borderColor: '#534AB7', backgroundColor: '#534AB7' },
  progressPillText: { color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  progressPillTextDone: { color: '#534AB7' },
  progressPillTextActive: { color: '#FFFFFF' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#DBE3EF' },
  progressLineDone: { backgroundColor: '#5EE3A1' },
  eventContext: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventContextIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  eventContextCopy: { flex: 1, minWidth: 0 },
  eventContextName: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  eventContextMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 1 },
  eventContextRight: { alignItems: 'flex-end' },
  eventContextValue: { color: '#A89CF7', fontSize: 13, fontWeight: '900', lineHeight: 15 },
  eventContextLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700' },
  messageBox: { marginTop: 14, marginHorizontal: 16, borderRadius: 12, padding: 12, borderWidth: 0.5 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
  errorText: { color: '#B91C1C' },
  successText: { color: '#047857' },
  targetSection: { paddingHorizontal: 16, paddingBottom: 14 },
  targetSectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  targetSectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  targetSectionSub: { color: '#64748B', fontSize: 11, marginTop: 3 },
  selectedCountPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#DCFCE7' },
  selectedCountText: { color: '#0F6E56', fontSize: 10, fontWeight: '900' },
  targetEventCard: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetPoster: { width: 76, height: 96, borderRadius: 18, padding: 9, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: '#534AB7' },
  targetPosterText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', lineHeight: 14 },
  targetEventCopy: { flex: 1, minWidth: 0 },
  targetBadge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, color: '#534AB7', backgroundColor: '#EEEDFE', fontSize: 10, fontWeight: '900' },
  targetEventTitle: { color: '#0F172A', fontSize: 16, lineHeight: 21, fontWeight: '900', letterSpacing: -0.35, marginTop: 8, marginBottom: 7 },
  targetEventMeta: { color: '#64748B', fontSize: 11, lineHeight: 17 },
  targetRoundList: { gap: 10 },
  targetRoundCard: { minHeight: 78, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, borderWidth: 1.5, borderColor: '#D8D4FF', backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 1 },
  targetDateBox: { width: 48, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE' },
  targetDateMonth: { color: '#534AB7', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  targetDateDay: { color: '#0F172A', fontSize: 20, fontWeight: '900', lineHeight: 24 },
  targetRoundCopy: { flex: 1, minWidth: 0 },
  targetRoundName: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  targetRoundMeta: { color: '#64748B', fontSize: 11, lineHeight: 16 },
  targetRoundCheck: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5EE3A1' },
  targetSummaryCard: { marginHorizontal: 16, marginBottom: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  targetSummaryIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7' },
  targetSummaryCopy: { flex: 1, minWidth: 0 },
  targetSummaryTitle: { color: '#0F172A', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  targetSummarySub: { color: '#64748B', fontSize: 11, lineHeight: 17 },
  sectionHeadingWrap: { paddingHorizontal: 16, paddingTop: 2 },
  formSectionBody: { paddingHorizontal: 16 },
  card: { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 0, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.055, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  flowStack: {},
  issueCard: { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.055, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  compactCard: { marginTop: 12, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#E5E7EB' },
  compactTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '800' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  cardHeadIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#1A1A2E', fontSize: 15, fontWeight: '900', flex: 1 },
  cardBody: { paddingHorizontal: 15, paddingVertical: 14 },
  pageDescription: { marginTop: 0, paddingHorizontal: 15, paddingTop: 12, color: '#64748B', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  modeStack: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  modeCard: { flex: 1, minHeight: 74, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  activeModeCard: { borderColor: '#1A1A2E', backgroundColor: '#1A1A2E' },
  optionRadio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  optionRadioOn: { borderColor: '#534AB7', backgroundColor: '#534AB7' },
  optionRadioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  optionCopy: { flex: 1, minWidth: 0 },
  modeTitle: { color: '#1A1A2E', fontSize: 12, fontWeight: '800' },
  activeModeText: { color: '#FFFFFF' },
  modeHint: { marginTop: 3, color: '#94A3B8', fontSize: 9, lineHeight: 13 },
  sectionBlock: { paddingTop: 0, paddingBottom: 0 },
  helpText: { marginTop: 8, color: '#9CA3AF', fontSize: 12, lineHeight: 18 },
  label: { marginTop: 12, marginBottom: 5, color: '#6B7280', fontSize: 10, fontWeight: '800' },
  smallLabel: { marginBottom: 6, color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 11, backgroundColor: '#FFFFFF', color: '#1A1A2E' },
  unitInputWrap: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 17, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  unitInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  unitText: { color: '#9CA3AF', fontWeight: '700' },
  directInputWrap: { marginTop: 8, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingRight: 11 },
  directInput: { flex: 1, paddingHorizontal: 11, paddingVertical: 9, color: '#1A1A2E', fontSize: 12, fontWeight: '800' },
  roundSummaryList: { marginTop: 8, gap: 5, paddingHorizontal: 13, paddingBottom: 12 },
  roundSummaryListPlain: { marginTop: 8, gap: 5 },
  roundItemCompact: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundNumberBox: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  roundNumberText: { color: '#534AB7', fontSize: 10, fontWeight: '900' },
  roundCompactCopy: { flex: 1, minWidth: 0 },
  commonApplyPill: { backgroundColor: '#EEEDFE', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  commonApplyPillText: { color: '#534AB7', fontSize: 9, fontWeight: '800' },
  countPillBlue: { backgroundColor: '#E6F1FB', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  countPillBlueText: { color: '#185FA5', fontSize: 10, fontWeight: '800' },
  roundSummaryTitle: { color: '#1A1A2E', fontWeight: '800', fontSize: 11 },
  roundSummaryMeta: { color: '#534AB7', fontWeight: '800', fontSize: 12 },
  selectableRoundRow: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 9, backgroundColor: '#FFFFFF', padding: 10 },
  selectableRoundRowActive: { borderWidth: 1.5, borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  roundSummaryStatus: { marginTop: 2, color: '#9CA3AF', fontSize: 10, fontWeight: '700' },
  roundSummaryStatusSet: { color: '#534AB7', fontWeight: '800' },
  roundBox: { marginTop: 10, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#FFFFFF' },
  roundHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundHeaderCopy: { flex: 1 },
  roundTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '800' },
  roundMeta: { marginTop: 5, color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  roundBody: { borderTopWidth: 0.5, borderTopColor: '#E5E7EB', padding: 12 },
  roundChipRow: { flexDirection: 'row', gap: 10, paddingBottom: 12 },
  roundChip: { minWidth: 158, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, padding: 13, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  roundChipActive: { borderWidth: 1.5, borderColor: '#534AB7', backgroundColor: '#FBFAFF' },
  disabledRoundChip: { opacity: 0.45 },
  roundChipTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 },
  roundChipText: { color: '#0F172A', fontWeight: '900', fontSize: 14 },
  roundChipTextActive: { color: '#534AB7' },
  roundChipStatus: { color: '#64748B', backgroundColor: '#F1F5F9', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '900' },
  roundChipStatusActive: { color: '#534AB7', backgroundColor: '#EEEDFE' },
  roundChipDate: { color: '#64748B', fontSize: 11, lineHeight: 16 },
  policyRoundSelectorCard: { marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 2 },
  policyRoundSelectorHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  policyRoundSelectorIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  policyRoundSelectorCopy: { flex: 1, minWidth: 0 },
  policyRoundSelectorTitle: { color: '#1A1A2E', fontSize: 12, fontWeight: '900' },
  policyRoundSelectorMeta: { marginTop: 2, color: '#9CA3AF', fontSize: 10, fontWeight: '700' },
  sectionTitle: { color: '#1A1A2E', fontSize: 11, fontWeight: '800', marginBottom: 8 },
  savedPolicySection: { marginHorizontal: 14, marginBottom: 14, paddingBottom: 12 },
  savedZone: { marginHorizontal: 14, marginTop: 12 },
  savedZoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  savedZoneTitle: { color: '#0F6E56', fontSize: 11, fontWeight: '800', flex: 1 },
  savedCountPill: { backgroundColor: '#E1F5EE', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  savedCountText: { color: '#0F6E56', fontSize: 10, fontWeight: '800' },
  savedSummaryCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, padding: 14, marginBottom: 10, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 1 },
  savedSummaryCopy: { flex: 1, minWidth: 0 },
  moreButton: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  seatCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  seatCardName: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  seatKpiRow: { flexDirection: 'row', gap: 8 },
  seatKpi: { flex: 1, minWidth: 0, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: '#EDF2F7', backgroundColor: '#F8FAFC' },
  seatKpiLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '900', marginBottom: 4 },
  seatKpiValue: { color: '#0F172A', fontSize: 11, fontWeight: '900' },
  addSeatButton: { height: 58, marginHorizontal: 14, marginTop: 8, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9C2FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FBFAFF' },
  addSeatButtonText: { color: '#534AB7', fontSize: 14, fontWeight: '900' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginTop: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF', fontSize: 10, fontWeight: '800' },
  addPolicyCard: { marginTop: 8, marginHorizontal: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CECBF6', borderRadius: 12, overflow: 'hidden' },
  addPolicyHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: '#FAFAFE', borderBottomWidth: 0.5, borderBottomColor: '#EEEDFE' },
  addPolicyIcon: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  addPolicyTitle: { color: '#534AB7', fontSize: 11, fontWeight: '800' },
  addPolicyBody: { paddingHorizontal: 13, paddingVertical: 11 },
  addPolicyHint: { color: '#9CA3AF', fontSize: 10, lineHeight: 15, marginBottom: 8 },
  addChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  addChip: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFFFFF' },
  addChipText: { color: '#6B7280', fontSize: 11, fontWeight: '800' },
  newPolicyTitle: { marginTop: 2, marginHorizontal: 14 },
  savedPolicyList: { gap: 8 },
  savedPolicyCard: { borderWidth: 0.5, borderColor: '#9FE1CB', borderRadius: 11, backgroundColor: '#FFFFFF' },
  savedPolicyHeader: { padding: 12 },
  savedPolicyHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  savedBadge: { color: '#0F6E56', backgroundColor: '#E1F5EE', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, fontSize: 9, fontWeight: '800', overflow: 'hidden' },
  savedPolicyArrow: { color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  kebabButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  kebabText: { color: '#1A1A2E', fontSize: 20, fontWeight: '800', lineHeight: 22 },
  savedPolicyText: { color: '#1A1A2E', fontSize: 13, fontWeight: '800', lineHeight: 19 },
  savedPolicyMeta: { marginTop: 3, color: '#6B7280', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  savedPolicyDetail: { borderTopWidth: 0.5, borderTopColor: '#E5E7EB', padding: 12 },
  builderBox: { gap: 0 },
  builderTitle: { color: '#1A1A2E', fontSize: 11, fontWeight: '800' },
  stepCard: { marginHorizontal: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 11 },
  policyCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -11, marginTop: -11, marginBottom: 11, paddingHorizontal: 13, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  policyCardTitle: { fontSize: 11, fontWeight: '800', flex: 1 },
  policyCardBody: { marginHorizontal: -11, marginBottom: -11, paddingHorizontal: 13, paddingBottom: 11 },
  activeStepCard: { borderWidth: 1.5, borderColor: '#A89CF7', backgroundColor: '#FAFAFE' },
  formStepCard: { borderColor: '#C4C0F5', backgroundColor: '#FAFAFE' },
  stepBox: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#E5E7EB', paddingTop: 14 },
  deadlineGuide: { marginTop: 8, color: '#534AB7', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  deadlineGuideMeta: { marginTop: 3, color: '#6B7280', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  choiceChip: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: '#FFFFFF', minWidth: '23%', alignItems: 'center' },
  activeChip: { borderColor: '#1A1A2E', backgroundColor: '#1A1A2E' },
  choiceChipText: { color: '#6B7280', fontWeight: '800', fontSize: 10 },
  activeChipText: { color: '#FFFFFF' },
  resaleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  resaleChip: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFFFFF' },
  resaleChipText: { color: '#6B7280', fontSize: 11, fontWeight: '800' },
  resaleToggleControl: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  resaleToggleText: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickButton: { borderWidth: 0.5, borderColor: '#C4C0F5', backgroundColor: '#EEEDFE', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  quickButtonText: { color: '#534AB7', fontWeight: '800', fontSize: 12 },
  dateTimeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  dateTimeField: { width: '48%' },
  toggleRow: { marginTop: 12, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  toggleCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  toggleLabel: { color: '#1A1A2E', fontWeight: '700' },
  toggleSub: { color: '#9CA3AF', fontSize: 10, marginTop: 1 },
  switchTrack: { width: 36, height: 20, borderRadius: 10, backgroundColor: '#534AB7', padding: 2, justifyContent: 'center' },
  switchTrackOff: { backgroundColor: '#E5E7EB' },
  switchKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', alignSelf: 'flex-end' },
  switchKnobOff: { alignSelf: 'flex-start' },
  toggleBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '800' },
  toggleOn: { backgroundColor: '#DCFCE7', color: '#166534' },
  toggleOff: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  savePolicyButton: { marginTop: 14, borderWidth: 0.5, borderColor: '#1A1A2E', borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#1A1A2E' },
  savePolicyButtonText: { color: '#FFFFFF', fontWeight: '800' },
  completeConfigButton: { marginTop: 6, marginHorizontal: 14, backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  completeConfigButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  completionZone: { marginTop: 6, marginHorizontal: 14, backgroundColor: '#1A1A2E', borderRadius: 14, overflow: 'hidden' },
  completionTop: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  completionEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  completionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  completionEyebrow: { color: '#6EE7B7', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  completionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', lineHeight: 19 },
  completionSub: { color: 'rgba(255,255,255,0.45)', fontSize: 10, lineHeight: 15, marginTop: 3 },
  completionButton: { marginHorizontal: 16, marginTop: 12, marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  completionButtonText: { color: '#1A1A2E', fontSize: 13, fontWeight: '900', flex: 1, textAlign: 'center' },
  completionArrow: { color: '#534AB7', fontSize: 16, fontWeight: '900' },
  issuePreviewBox: { marginTop: 8, backgroundColor: '#FAFAFE', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 0.5, borderColor: '#CECBF6' },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  previewInlineLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '700' },
  previewInlineValue: { color: '#1A1A2E', fontSize: 10, fontWeight: '800' },
  previewInlineValuePurple: { color: '#534AB7', fontSize: 10, fontWeight: '800' },
  previewInlineValueGreen: { color: '#0F6E56', fontSize: 10, fontWeight: '800' },
  previewLabel: { marginTop: 10, marginHorizontal: 12, color: '#9CA3AF', fontSize: 10, fontWeight: '800' },
  previewText: { marginTop: 5, marginHorizontal: 12, color: '#1A1A2E', fontWeight: '700', lineHeight: 18, fontSize: 11 },
  previewTextStrong: { marginTop: 5, color: '#1A1A2E', fontSize: 15, fontWeight: '800', lineHeight: 22 },
  statusBand: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 0, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  statusLabel: { color: '#534AB7', fontSize: 11, fontWeight: '800', paddingHorizontal: 13, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  statusLine: { marginTop: 6, color: '#1A1A2E', fontSize: 16, fontWeight: '800' },
  finalCountList: { marginTop: 10, marginHorizontal: 12, gap: 0, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, backgroundColor: '#F9F9F9' },
  finalCountText: { color: '#1A1A2E', fontSize: 11, fontWeight: '800', paddingVertical: 3 },
  confirmRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 15, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  confirmLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  confirmValue: { color: '#1A1A2E', fontSize: 11, fontWeight: '800' },
  confirmValuePurple: { color: '#534AB7', fontSize: 11, fontWeight: '800' },
  confirmValueGreen: { color: '#0F6E56', fontSize: 11, fontWeight: '800' },
  finalRoundList: { marginTop: 10, marginHorizontal: 12, gap: 8 },
  finalRoundCard: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, backgroundColor: '#F9F9F9' },
  finalRoundTitle: { color: '#1A1A2E', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  finalActionButton: { marginTop: 12, marginHorizontal: 12 },
  reviewSection: { paddingHorizontal: 16, paddingBottom: 14 },
  reviewSeatList: { gap: 9, padding: 14, borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  reviewSeatRow: { padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#EDF2F7', backgroundColor: '#F8FAFC' },
  reviewSeatCopy: { flex: 1, minWidth: 0 },
  reviewSeatName: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  reviewSeatMeta: { color: '#64748B', fontSize: 10, marginTop: 3 },
  reviewSeatPrice: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  totalCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 24, padding: 16, backgroundColor: '#1A1A2E' },
  totalCardTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginBottom: 8 },
  totalCardValue: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  totalCardSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 5 },
  finalNotice: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  finalNoticeCopy: { flex: 1, minWidth: 0 },
  finalNoticeTitle: { color: '#A16207', fontSize: 12, fontWeight: '900', marginBottom: 3 },
  finalNoticeSub: { color: '#64748B', fontSize: 10, lineHeight: 15 },
  removeButton: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: '#FECACA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF2F2' },
  removeButtonText: { color: '#B91C1C', fontSize: 12, fontWeight: '800' },
  editButton: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: '#C4C0F5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EEEDFE' },
  editButtonText: { color: '#534AB7', fontSize: 12, fontWeight: '800' },
  secondaryButton: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8, marginHorizontal: 12, marginBottom: 12, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#1A1A2E', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#9CA3AF', paddingVertical: 14, textAlign: 'center' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: 'rgba(255,255,255,0.97)', paddingHorizontal: 16, paddingVertical: 12 },
  bottomRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { backgroundColor: '#534AB7', borderRadius: 17, paddingVertical: 17, alignItems: 'center' },
  bottomPrimaryButton: { flex: 1.4, backgroundColor: '#534AB7', borderRadius: 17, paddingVertical: 17, alignItems: 'center', shadowColor: '#534AB7', shadowOpacity: 0.22, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  bottomSecondaryButton: { flex: 0.8, borderWidth: 1.5, borderColor: '#CECBF6', borderRadius: 17, paddingVertical: 17, alignItems: 'center', backgroundColor: '#FFFFFF' },
  bottomSecondaryFullButton: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 15, alignItems: 'center', backgroundColor: '#FFFFFF' },
  bottomSecondaryText: { color: '#534AB7', fontSize: 15, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  pickerButton: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 11, backgroundColor: '#FFFFFF' },
  pickerButtonText: { color: '#1A1A2E', fontWeight: '800' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '82%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  sheetClose: { color: '#9CA3AF', fontWeight: '700' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calendarNavButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  calendarNavText: { color: '#1A1A2E', fontSize: 24, fontWeight: '800' },
  calendarTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekText: { flex: 1, textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calendarCellEmpty: { opacity: 0.18 },
  calendarCellSelected: { backgroundColor: '#534AB7', borderRadius: 999 },
  calendarCellText: { color: '#1A1A2E', fontWeight: '700' },
  calendarCellTextSelected: { color: '#FFFFFF' },
  sheetPrimaryButton: { marginTop: 14, backgroundColor: '#1A1A2E', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  sheetPrimaryText: { color: '#FFFFFF', fontWeight: '800' },
  timePickerRow: { flexDirection: 'row', gap: 10, height: 260 },
  timeColumn: { flex: 1, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F5F5F5' },
  timeColumnContent: { padding: 8, gap: 6 },
  timeOption: { borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  timeOptionActive: { backgroundColor: '#EEEDFE', borderWidth: 0.5, borderColor: '#534AB7' },
  timeOptionText: { color: '#6B7280', fontWeight: '700' },
  timeOptionTextActive: { color: '#534AB7' },
  issueSeatList: { maxHeight: 360 },
  issueSeatLine: { borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', paddingVertical: 10, color: '#1A1A2E', fontWeight: '800' },
  menuOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  actionMenu: { borderRadius: 14, backgroundColor: '#FFFFFF', padding: 10 },
  actionMenuTitle: { padding: 12, color: '#1A1A2E', fontSize: 14, fontWeight: '800' },
  actionMenuItem: { padding: 14, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  actionMenuText: { color: '#1A1A2E', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actionMenuDeleteText: { color: '#DC2626', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  actionMenuCancel: { marginTop: 8, padding: 14, borderRadius: 10, backgroundColor: '#F5F5F5' },
});
