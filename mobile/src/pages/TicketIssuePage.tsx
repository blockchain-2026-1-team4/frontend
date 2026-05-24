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
import { formatTicketStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventRound, TicketDetail } from '../types/api';

const SECTION_PRESETS = ['VIP', 'R', 'S', 'A', 'B', 'C', '스탠딩'];
const RESALE_RATE_PRESETS = ['100', '110', '120', '150'];
const QUANTITY_PRESETS = ['1', '10', '50'];

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

function toDateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
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

function makeSectionPolicy(round?: EventRound, expanded = true): SectionPolicy {
  const now = new Date();
  return {
    id: makeId('section'),
    sectionName: 'VIP',
    customSectionName: '',
    useCustomSectionName: false,
    quantity: '10',
    priceEth: '0.2',
    saleStartDate: localDate(now),
    saleStartTime: localTime(now),
    saleEndDate: round?.eventDate || localDate(now),
    saleEndTime: round?.startTime || '23:59',
    resaleEnabled: true,
    resaleCapRate: '120',
    useCustomResaleRate: false,
    customResaleCapRate: '',
    startNumber: '1',
    expanded,
  };
}

function sectionNameOf(policy: SectionPolicy) {
  const raw = policy.useCustomSectionName ? policy.customSectionName : policy.sectionName;
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

function resaleRateOf(policy: SectionPolicy) {
  return policy.useCustomResaleRate ? policy.customResaleCapRate : policy.resaleCapRate;
}

function ticketKey(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.seatInfo);
}

function countIssuedByRound(tickets: TicketDetail[], key: string) {
  return tickets.filter((ticket) => ticket.eventRoundId === key || ticket.sectionName?.startsWith(`${key}-`)).length;
}

function ticketSectionOf(ticket: TicketDetail) {
  const section = ticket.sectionName || String(ticket.seatInfo || '').split('-')[0];
  return section || 'GENERAL';
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
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issuingKey, setIssuingKey] = useState<string | null>(null);
  const [policyMode, setPolicyMode] = useState<PolicyMode>('global');
  const [globalSections, setGlobalSections] = useState<SectionPolicy[]>([makeSectionPolicy()]);
  const [roundPolicies, setRoundPolicies] = useState<Record<string, RoundPolicy>>({});
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

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
      setGlobalSections((current) => {
        const baseRound = rounds[0];
        if (current.length > 0) {
          return current.map((section, index) => ({
            ...section,
            saleEndDate: section.saleEndDate || baseRound.eventDate,
            saleEndTime: section.saleEndTime || baseRound.startTime,
            expanded: index === 0 ? section.expanded : false,
          }));
        }
        return [makeSectionPolicy(baseRound)];
      });
      setRoundPolicies((current) => {
        const next: Record<string, RoundPolicy> = {};
        rounds.forEach((round, index) => {
          const key = roundKey(round, index);
          const previous = current[key];
          next[key] = previous || {
            roundKey: key,
            totalTicketCount: '',
            expanded: index === 0,
            sections: [makeSectionPolicy(round, true)],
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
  const issuedCount = tickets.length;
  const eventTotalCount = Number(event?.totalTicketCount || 0);
  const hasEventTotal = Number.isFinite(eventTotalCount) && eventTotalCount > 0;
  const compactTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 3),
    [tickets],
  );

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

  const updateGlobalSection = (sectionId: string, patch: Partial<SectionPolicy>) => {
    setGlobalSections((current) => current.map((section) => section.id === sectionId ? { ...section, ...patch } : section));
  };

  const updateRoundPolicy = (key: string, patch: Partial<RoundPolicy>) => {
    setRoundPolicies((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const updateRoundSection = (key: string, sectionId: string, patch: Partial<SectionPolicy>) => {
    setRoundPolicies((current) => ({
      ...current,
      [key]: {
        ...current[key],
        sections: current[key].sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section),
      },
    }));
  };

  const addGlobalSection = () => {
    setGlobalSections((current) => [...current.map((section) => ({ ...section, expanded: false })), makeSectionPolicy(rounds[0])]);
  };

  const addRoundSection = (key: string, round: EventRound) => {
    setRoundPolicies((current) => ({
      ...current,
      [key]: {
        ...current[key],
        sections: [...current[key].sections.map((section) => ({ ...section, expanded: false })), makeSectionPolicy(round)],
      },
    }));
  };

  const removeSection = (sectionId: string, roundPolicyKey?: string) => {
    if (roundPolicyKey) {
      setRoundPolicies((current) => {
        const target = current[roundPolicyKey];
        if (!target || target.sections.length <= 1) return current;
        return {
          ...current,
          [roundPolicyKey]: {
            ...target,
            sections: target.sections.filter((section) => section.id !== sectionId),
          },
        };
      });
      return;
    }
    setGlobalSections((current) => current.length <= 1 ? current : current.filter((section) => section.id !== sectionId));
  };

  const validateSection = (policy: SectionPolicy, label: string, round?: EventRound) => {
    const sectionName = sectionNameOf(policy);
    const resaleRate = Number(resaleRateOf(policy));
    if (!sectionName) return `${label} 좌석 구역명을 입력해주세요.`;
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

  const validatePayload = (sections: IssueSectionPayload[], contextLabel: string, roundTotalCount?: string) => {
    if (sections.length === 0) return `${contextLabel}에 발행할 좌석 구역 정책이 없습니다.`;
    const totalQuantity = sections.reduce((sum, section) => sum + section.quantity, 0);
    if (roundTotalCount && Number(roundTotalCount) > 0 && totalQuantity > Number(roundTotalCount)) {
      return `${contextLabel}의 발행 개수가 총 티켓 수보다 많습니다.`;
    }
    return null;
  };

  const sectionToPayload = (policy: SectionPolicy, round: EventRound, roundIndex: number): IssueSectionPayload => {
    const rawSection = sectionNameOf(policy);
    const namespacedSection = `${roundIndex + 1}회차-${rawSection}`;
    return {
      eventRoundId: round.id,
      sectionName: namespacedSection,
      priceWei: ethToWei(policy.priceEth),
      saleStartAt: toDateTimeIso(policy.saleStartDate, policy.saleStartTime),
      saleEndAt: toDateTimeIso(policy.saleEndDate, policy.saleEndTime),
      resaleEnabled: policy.resaleEnabled,
      resaleCapRate: Math.round(Number(resaleRateOf(policy)) * 100),
      startNumber: Number(policy.startNumber),
      quantity: Number(policy.quantity),
    };
  };

  const issueSections = async (contextKey: string, contextLabel: string, sections: IssueSectionPayload[], roundTotalCount?: string) => {
    const payloadError = validatePayload(sections, contextLabel, roundTotalCount);
    if (payloadError) {
      showError(payloadError);
      return;
    }

    const requestedTotal = issuedCount + sections.reduce((sum, section) => sum + section.quantity, 0);
    const totalTicketCount = Math.max(eventTotalCount, Number(roundTotalCount || 0), requestedTotal);

    setFeedback(null);
    setIssuingKey(contextKey);
    try {
      const issued = await backendApi.issueTickets(eventId, {
        totalTicketCount,
        ticketSections: sections,
      });
      const message = `${contextLabel} 티켓 ${issued.length}장을 발행했습니다.`;
      setFeedback({ type: 'success', message });
      Alert.alert('티켓 발행 완료', message);
      await load();
    } catch (error: any) {
      showError(errorMessage(error, '티켓을 발행하지 못했습니다.'));
    } finally {
      setIssuingKey(null);
    }
  };

  const issueGlobal = async () => {
    if (rounds.length === 0) {
      showError('이벤트 회차 정보가 필요합니다.');
      return;
    }
    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
      for (let sectionIndex = 0; sectionIndex < globalSections.length; sectionIndex += 1) {
        const message = validateSection(globalSections[sectionIndex], `${roundIndex + 1}회차 ${sectionIndex + 1}번 정책`, rounds[roundIndex]);
        if (message) {
          showError(message);
          return;
        }
      }
    }
    const payload = rounds.flatMap((round, roundIndex) => globalSections.map((section) => sectionToPayload(section, round, roundIndex)));
    await issueSections('global', '전체 회차', payload);
  };

  const issueRound = async (round: EventRound, roundIndex: number) => {
    const key = roundKey(round, roundIndex);
    const policy = roundPolicies[key];
    if (!policy) return;
    for (let sectionIndex = 0; sectionIndex < policy.sections.length; sectionIndex += 1) {
      const message = validateSection(policy.sections[sectionIndex], `${roundIndex + 1}회차 ${sectionIndex + 1}번 정책`, round);
      if (message) {
        showError(message);
        return;
      }
    }
    await issueSections(key, `${roundIndex + 1}회차`, policy.sections.map((section) => sectionToPayload(section, round, roundIndex)), policy.totalTicketCount);
  };

  const previewRange = (policy: SectionPolicy, roundIndex: number) => {
    const section = sectionNameOf(policy) || '구역';
    const start = Number(policy.startNumber || '1');
    const quantity = Number(policy.quantity || '0');
    const end = quantity > 0 ? start + quantity - 1 : start;
    return `${roundIndex + 1}회차-${section}-${start} ~ ${roundIndex + 1}회차-${section}-${end}`;
  };

  const globalTotalPerRound = globalSections.reduce((sum, section) => sum + (Number(section.quantity) || 0), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>티켓 발행 정보를 확인하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <TouchableOpacity style={styles.backButton} onPress={goBackToEventFlow}>
        <Text style={styles.backButtonText}>{returnTo === 'create' ? '이벤트 등록으로 돌아가기' : '이벤트 상세로 돌아가기'}</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>Ticket Issue</Text>
      <Text style={styles.title}>티켓 설정</Text>
      <Text style={styles.subtitle}>
        {event?.name || event?.title || '이벤트'}의 회차별 총 티켓 수와 좌석 구역별 판매 정책을 설정합니다.
      </Text>

      {feedback ? (
        <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.statusBand}>
        <Text style={styles.statusLabel}>발행 현황</Text>
        <Text style={styles.statusLine}>
          총 {hasEventTotal ? `${eventTotalCount}장` : '미설정'} · 발행 {issuedCount}장 · 남은 {hasEventTotal ? `${Math.max(eventTotalCount - issuedCount, 0)}장` : '-'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>정책 적용 방식</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeButton, policyMode === 'global' && styles.activeModeButton]} onPress={() => setPolicyMode('global')}>
            <Text style={[styles.modeButtonTitle, policyMode === 'global' && styles.activeModeText]}>전체 설정 적용</Text>
            <Text style={styles.modeHint}>같은 좌석 구역 정책을 모든 회차에 적용합니다.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeButton, policyMode === 'round' && styles.activeModeButton]} onPress={() => setPolicyMode('round')}>
            <Text style={[styles.modeButtonTitle, policyMode === 'round' && styles.activeModeText]}>회차별 설정</Text>
            <Text style={styles.modeHint}>회차마다 총 티켓 수와 좌석 정책을 따로 관리합니다.</Text>
          </TouchableOpacity>
        </View>
      </View>

      {policyMode === 'global' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>공통 좌석 구역 정책</Text>
          <Text style={styles.helperText}>아래 정책이 모든 회차에 복사되어 발행됩니다. 판매 기간은 좌석 구역 정책별로 설정합니다.</Text>

          {rounds.length > 0 ? (
            <View style={styles.roundSummaryList}>
              {rounds.map((round, index) => (
                <View key={roundKey(round, index)} style={styles.roundSummaryRow}>
                  <Text style={styles.roundSummaryTitle}>{roundLabel(round, index)}</Text>
                  <Text style={styles.roundSummaryMeta}>예상 {globalTotalPerRound}장</Text>
                </View>
              ))}
            </View>
          ) : null}

          {globalSections.map((section, index) => (
            <SectionPolicyCard
              key={section.id}
              policy={section}
              index={index}
              canRemove={globalSections.length > 1}
              previewText={rounds.length > 0 ? previewRange(section, 0) : '-'}
              onChange={(patch) => updateGlobalSection(section.id, patch)}
              onRemove={() => removeSection(section.id)}
            />
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addGlobalSection}>
            <Text style={styles.addButtonText}>+ 좌석 구역 추가</Text>
          </TouchableOpacity>

          <IssuePreview sections={globalSections} roundIndex={0} title="전체 회차 발행 예정 좌석" />
          <TouchableOpacity style={[styles.primaryButton, issuingKey === 'global' && styles.disabledButton]} disabled={issuingKey !== null} onPress={issueGlobal}>
            <Text style={styles.primaryButtonText}>{issuingKey === 'global' ? '발행 중...' : '전체 회차에 발행'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.roundList}>
          {rounds.map((round, index) => {
            const key = roundKey(round, index);
            const policy = roundPolicies[key] || {
              roundKey: key,
              totalTicketCount: '',
              expanded: index === 0,
              sections: [makeSectionPolicy(round)],
            };
            const issuedByRound = countIssuedByRound(tickets, round.id || key);
            const plannedQuantity = policy.sections.reduce((sum, section) => sum + (Number(section.quantity) || 0), 0);

            return (
              <View key={key} style={styles.card}>
                <TouchableOpacity style={styles.accordionHeader} onPress={() => updateRoundPolicy(key, { expanded: !policy.expanded })}>
                  <View style={styles.accordionCopy}>
                    <Text style={styles.cardTitle}>{policy.expanded ? '▼' : '▶'} {roundLabel(round, index)}</Text>
                    <Text style={styles.roundMeta}>발행 {issuedByRound}장 · 예정 {plannedQuantity}장</Text>
                  </View>
                </TouchableOpacity>

                {policy.expanded ? (
                  <View style={styles.roundBody}>
                    <Text style={styles.label}>총 티켓 수</Text>
                    <View style={styles.unitInputWrap}>
                      <TextInput
                        style={styles.unitInput}
                        value={policy.totalTicketCount}
                        onChangeText={(value) => updateRoundPolicy(key, { totalTicketCount: value })}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        placeholder="예: 500"
                      />
                      <Text style={styles.unitText}>장</Text>
                    </View>

                    {policy.sections.map((section, sectionIndex) => (
                      <SectionPolicyCard
                        key={section.id}
                        policy={section}
                        index={sectionIndex}
                        canRemove={policy.sections.length > 1}
                        previewText={previewRange(section, index)}
                        onChange={(patch) => updateRoundSection(key, section.id, patch)}
                        onRemove={() => removeSection(section.id, key)}
                      />
                    ))}

                    <TouchableOpacity style={styles.addButton} onPress={() => addRoundSection(key, round)}>
                      <Text style={styles.addButtonText}>+ 좌석 구역 추가</Text>
                    </TouchableOpacity>

                    <IssuePreview sections={policy.sections} roundIndex={index} title={`${index + 1}회차 발행 예정 좌석`} />
                    <TouchableOpacity style={[styles.primaryButton, issuingKey === key && styles.disabledButton]} disabled={issuingKey !== null} onPress={() => issueRound(round, index)}>
                      <Text style={styles.primaryButtonText}>{issuingKey === key ? '발행 중...' : `${index + 1}회차 발행`}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('TicketExplore', { eventId })}>
        <Text style={styles.secondaryButtonText}>전체 발행 티켓 보기</Text>
      </TouchableOpacity>

      <View style={styles.compactCard}>
        <Text style={styles.compactTitle}>최근 발행 티켓</Text>
        {compactTickets.length === 0 ? (
          <Text style={styles.emptyText}>아직 발행된 티켓이 없습니다.</Text>
        ) : (
          compactTickets.map((ticket) => (
            <View key={ticketKey(ticket)} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketSeat}>{ticket.seatInfo}</Text>
                <Text style={styles.ticketMeta}>{ticketSectionOf(ticket)} · {weiToEth(ticket.originalPriceWei || ticket.priceWei)} ETH</Text>
              </View>
              <Text style={styles.ticketStatus}>{formatTicketStatus(ticket.status)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SectionPolicyCard({
  policy,
  index,
  canRemove,
  previewText,
  onChange,
  onRemove,
}: {
  policy: SectionPolicy;
  index: number;
  canRemove: boolean;
  previewText: string;
  onChange: (patch: Partial<SectionPolicy>) => void;
  onRemove: () => void;
}) {
  const sectionName = sectionNameOf(policy) || '좌석 구역';
  const resaleRate = resaleRateOf(policy);
  const summary = `${sectionName} · ${policy.quantity || 0}장 · ${policy.priceEth || 0} ETH · 판매 ${formatDateShort(policy.saleStartDate)}~${formatDateShort(policy.saleEndDate)} · ${policy.resaleEnabled ? `리셀 ${resaleRate}%` : '리셀 불가'}`;

  return (
    <View style={styles.policyCard}>
      <TouchableOpacity style={styles.policyHeader} onPress={() => onChange({ expanded: !policy.expanded })}>
        <View style={styles.policyHeaderCopy}>
          <Text style={styles.policyTitle}>{policy.expanded ? '▼' : '▶'} {index + 1}번 정책</Text>
          <Text style={styles.policySummary}>{summary}</Text>
        </View>
        {canRemove ? (
          <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
            <Text style={styles.removeButtonText}>삭제</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {policy.expanded ? (
        <View style={styles.policyBody}>
          <Text style={styles.label}>좌석 구역</Text>
          <View style={styles.chipGrid}>
            {SECTION_PRESETS.map((section) => (
              <TouchableOpacity
                key={section}
                style={[styles.choiceChip, !policy.useCustomSectionName && policy.sectionName === section && styles.activeChip]}
                onPress={() => onChange({ sectionName: section, useCustomSectionName: false })}
              >
                <Text style={[styles.choiceChipText, !policy.useCustomSectionName && policy.sectionName === section && styles.activeChipText]}>{section}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.choiceChip, policy.useCustomSectionName && styles.activeChip]} onPress={() => onChange({ useCustomSectionName: true })}>
              <Text style={[styles.choiceChipText, policy.useCustomSectionName && styles.activeChipText]}>직접 추가</Text>
            </TouchableOpacity>
          </View>
          {policy.useCustomSectionName ? (
            <TextInput
              style={styles.input}
              value={policy.customSectionName}
              onChangeText={(value) => onChange({ customSectionName: value })}
              placeholder="예: BOX, 2층"
              autoCapitalize="characters"
            />
          ) : null}

          <View style={styles.twoColumnRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>발행 개수</Text>
              <View style={styles.unitInputWrap}>
                <TextInput style={styles.unitInput} value={policy.quantity} onChangeText={(value) => onChange({ quantity: value })} keyboardType="number-pad" inputMode="numeric" />
                <Text style={styles.unitText}>장</Text>
              </View>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>가격</Text>
              <View style={styles.unitInputWrap}>
                <TextInput style={styles.unitInput} value={policy.priceEth} onChangeText={(value) => onChange({ priceEth: value })} keyboardType="decimal-pad" inputMode="decimal" />
                <Text style={styles.unitText}>ETH</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickRow}>
            {QUANTITY_PRESETS.map((quantity) => (
              <TouchableOpacity key={quantity} style={styles.quickButton} onPress={() => onChange({ quantity })}>
                <Text style={styles.quickButtonText}>{quantity}장</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>판매 기간</Text>
          <View style={styles.dateTimeGrid}>
            <View style={styles.dateTimeField}>
              <Text style={styles.smallLabel}>판매 시작 날짜</Text>
              <TextInput style={styles.input} value={policy.saleStartDate} onChangeText={(value) => onChange({ saleStartDate: value })} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.dateTimeField}>
              <Text style={styles.smallLabel}>시작 시간</Text>
              <TextInput style={styles.input} value={policy.saleStartTime} onChangeText={(value) => onChange({ saleStartTime: value })} placeholder="HH:mm" />
            </View>
            <View style={styles.dateTimeField}>
              <Text style={styles.smallLabel}>판매 종료 날짜</Text>
              <TextInput style={styles.input} value={policy.saleEndDate} onChangeText={(value) => onChange({ saleEndDate: value })} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.dateTimeField}>
              <Text style={styles.smallLabel}>종료 시간</Text>
              <TextInput style={styles.input} value={policy.saleEndTime} onChangeText={(value) => onChange({ saleEndTime: value })} placeholder="HH:mm" />
            </View>
          </View>

          <TouchableOpacity style={styles.toggleRow} onPress={() => onChange({ resaleEnabled: !policy.resaleEnabled })}>
            <Text style={styles.toggleLabel}>리셀 허용</Text>
            <Text style={[styles.toggleBadge, policy.resaleEnabled ? styles.toggleOn : styles.toggleOff]}>{policy.resaleEnabled ? '허용' : '비허용'}</Text>
          </TouchableOpacity>

          {policy.resaleEnabled ? (
            <>
              <Text style={styles.label}>최대 리셀가</Text>
              <View style={styles.chipGrid}>
                {RESALE_RATE_PRESETS.map((rate) => (
                  <TouchableOpacity
                    key={rate}
                    style={[styles.choiceChip, !policy.useCustomResaleRate && policy.resaleCapRate === rate && styles.activeChip]}
                    onPress={() => onChange({ resaleCapRate: rate, useCustomResaleRate: false })}
                  >
                    <Text style={[styles.choiceChipText, !policy.useCustomResaleRate && policy.resaleCapRate === rate && styles.activeChipText]}>{rate}%</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.choiceChip, policy.useCustomResaleRate && styles.activeChip]} onPress={() => onChange({ useCustomResaleRate: true })}>
                  <Text style={[styles.choiceChipText, policy.useCustomResaleRate && styles.activeChipText]}>직접 입력</Text>
                </TouchableOpacity>
              </View>
              {policy.useCustomResaleRate ? (
                <View style={styles.unitInputWrap}>
                  <TextInput style={styles.unitInput} value={policy.customResaleCapRate} onChangeText={(value) => onChange({ customResaleCapRate: value })} keyboardType="number-pad" inputMode="numeric" placeholder="예: 130" />
                  <Text style={styles.unitText}>%</Text>
                </View>
              ) : null}
            </>
          ) : null}

          <Text style={styles.label}>고급 설정</Text>
          <View style={styles.unitInputWrap}>
            <TextInput style={styles.unitInput} value={policy.startNumber} onChangeText={(value) => onChange({ startNumber: value })} keyboardType="number-pad" inputMode="numeric" />
            <Text style={styles.unitText}>번부터</Text>
          </View>

          <Text style={styles.previewLabel}>발행 예정 좌석</Text>
          <Text style={styles.previewText}>{previewText}</Text>
        </View>
      ) : null}
    </View>
  );
}

function IssuePreview({ sections, roundIndex, title }: { sections: SectionPolicy[]; roundIndex: number; title: string }) {
  const ranges = sections.map((section) => {
    const name = sectionNameOf(section) || '구역';
    const start = Number(section.startNumber || '1');
    const quantity = Number(section.quantity || '0');
    const end = quantity > 0 ? start + quantity - 1 : start;
    return `${roundIndex + 1}회차-${name}-${start}~${end}`;
  });

  return (
    <View style={styles.issuePreviewBox}>
      <Text style={styles.previewLabel}>{title}</Text>
      <Text style={styles.previewText}>{ranges.join(' · ') || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 16, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  backButton: { borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#EFF6FF', marginBottom: 14 },
  backButtonText: { color: '#2563EB', fontWeight: '900' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  messageBox: { marginTop: 14, borderRadius: 8, padding: 12, borderWidth: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
  statusBand: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  statusLabel: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  statusLine: { marginTop: 6, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  compactCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  compactTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  helperText: { marginTop: 6, color: '#64748B', fontSize: 12, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  modeButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF' },
  activeModeButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  modeButtonTitle: { color: '#0F172A', fontWeight: '900' },
  activeModeText: { color: '#2563EB' },
  modeHint: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 16 },
  roundSummaryList: { marginTop: 12, gap: 8 },
  roundSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10 },
  roundSummaryTitle: { color: '#0F172A', fontWeight: '900', fontSize: 13 },
  roundSummaryMeta: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  roundList: { marginTop: 2 },
  accordionHeader: { paddingVertical: 2 },
  accordionCopy: { flex: 1 },
  roundMeta: { marginTop: 5, color: '#64748B', fontSize: 12, fontWeight: '800' },
  roundBody: { marginTop: 10 },
  policyCard: { marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  policyHeaderCopy: { flex: 1 },
  policyTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  policySummary: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  policyBody: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 12 },
  removeButton: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF2F2' },
  removeButtonText: { color: '#B91C1C', fontSize: 12, fontWeight: '900' },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '900' },
  smallLabel: { marginBottom: 6, color: '#64748B', fontSize: 12, fontWeight: '900' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, backgroundColor: '#FFFFFF', color: '#0F172A' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choiceChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  choiceChipText: { color: '#334155', fontWeight: '900', fontSize: 13 },
  activeChipText: { color: '#2563EB' },
  twoColumnRow: { flexDirection: 'row', gap: 8 },
  halfField: { flex: 1 },
  unitInputWrap: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  unitInput: { flex: 1, padding: 11, color: '#0F172A' },
  unitText: { color: '#64748B', fontWeight: '900' },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  quickButton: { borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  quickButtonText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  dateTimeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateTimeField: { width: '48%' },
  toggleRow: { marginTop: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: '#0F172A', fontWeight: '900' },
  toggleBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '900' },
  toggleOn: { backgroundColor: '#DCFCE7', color: '#166534' },
  toggleOff: { backgroundColor: '#F1F5F9', color: '#64748B' },
  previewLabel: { marginTop: 10, color: '#64748B', fontSize: 12, fontWeight: '900' },
  previewText: { marginTop: 5, color: '#0F172A', fontWeight: '800', lineHeight: 20 },
  issuePreviewBox: { marginTop: 14, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12 },
  addButton: { marginTop: 12, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  addButtonText: { color: '#2563EB', fontWeight: '900' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 12, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketInfo: { flex: 1 },
  ticketSeat: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  ticketStatus: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900', alignSelf: 'flex-start' },
  emptyText: { color: '#94A3B8', paddingVertical: 14, textAlign: 'center' },
});
