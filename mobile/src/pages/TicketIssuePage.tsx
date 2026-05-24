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

type SalePolicy = {
  saleStartDate: string;
  saleStartTime: string;
  saleEndDate: string;
  saleEndTime: string;
};

function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
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

function roundStartIso(round: EventRound) {
  return toDateTimeIso(round.eventDate, round.startTime);
}

function defaultPolicyForRound(round?: EventRound): SalePolicy {
  const now = new Date();
  return {
    saleStartDate: localDate(now),
    saleStartTime: localTime(now),
    saleEndDate: round?.eventDate || localDate(now),
    saleEndTime: round?.startTime || '23:59',
  };
}

function ethToWei(value: string) {
  const normalized = value.trim();
  if (!normalized) return '0';
  const [whole, fraction = ''] = normalized.split('.');
  const fractionWei = `${fraction}${'0'.repeat(18)}`.slice(0, 18);
  return `${BigInt(whole || '0') * 1_000_000_000_000_000_000n + BigInt(fractionWei || '0')}`;
}

function ticketKey(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.seatInfo);
}

function sectionOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split(/[-\s]/)[0] || 'GENERAL';
}

function normalizeSectionName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, '');
  if (!trimmed) return '';
  if (trimmed === '스탠딩') return trimmed;
  return trimmed.replace(/석$/u, '').toUpperCase();
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
  const [policyMode, setPolicyMode] = useState<PolicyMode>('global');
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [globalSalePolicy, setGlobalSalePolicy] = useState<SalePolicy>(() => defaultPolicyForRound());
  const [roundSalePolicies, setRoundSalePolicies] = useState<Record<string, SalePolicy>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionName, setSectionName] = useState('VIP');
  const [customSectionName, setCustomSectionName] = useState('');
  const [showCustomSection, setShowCustomSection] = useState(false);
  const [sectionPriceEth, setSectionPriceEth] = useState('0.2');
  const [resaleEnabled, setResaleEnabled] = useState(true);
  const [resaleCapRate, setResaleCapRate] = useState('120');
  const [customResaleCapRate, setCustomResaleCapRate] = useState('');
  const [useCustomResaleRate, setUseCustomResaleRate] = useState(false);
  const [startNumber, setStartNumber] = useState('1');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [issueCount, setIssueCount] = useState('10');
  const [issuing, setIssuing] = useState(false);
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
      setEvent(eventDetail);
      setTickets(issuedTickets);
      const rounds = eventDetail.rounds || [];
      const firstRound = rounds[0];
      const nextGlobalPolicy = {
        saleStartDate: dateFromIso(eventDetail.primarySaleStart || eventDetail.salesStartAt) || localDate(new Date()),
        saleStartTime: timeFromIso(eventDetail.primarySaleStart || eventDetail.salesStartAt) || localTime(new Date()),
        saleEndDate: dateFromIso(eventDetail.primarySaleEnd || eventDetail.salesEndAt) || firstRound?.eventDate || localDate(new Date()),
        saleEndTime: timeFromIso(eventDetail.primarySaleEnd || eventDetail.salesEndAt) || firstRound?.startTime || '23:59',
      };
      setGlobalSalePolicy(nextGlobalPolicy);
      setRoundSalePolicies(Object.fromEntries(rounds.map((round, index) => [
        round.id || `round-${index}`,
        {
          saleStartDate: dateFromIso(round.saleStartAt) || nextGlobalPolicy.saleStartDate,
          saleStartTime: timeFromIso(round.saleStartAt) || nextGlobalPolicy.saleStartTime,
          saleEndDate: dateFromIso(round.saleEndAt) || nextGlobalPolicy.saleEndDate,
          saleEndTime: timeFromIso(round.saleEndAt) || nextGlobalPolicy.saleEndTime,
        },
      ])));
      setActiveRoundId((current) => current || firstRound?.id || (firstRound ? 'round-0' : null));
    } catch (error: any) {
      Alert.alert('티켓 정보 로드 실패', errorMessage(error, '티켓 발행 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const issuedCount = tickets.length;
  const totalCount = Number(event?.totalTicketCount || 0);
  const hasTotalLimit = Number.isFinite(totalCount) && totalCount > 0;
  const remainingCount = hasTotalLimit ? Math.max(totalCount - issuedCount, 0) : null;
  const effectiveSectionName = normalizeSectionName(showCustomSection ? customSectionName : sectionName);
  const effectiveResaleCapRate = useCustomResaleRate ? customResaleCapRate : resaleCapRate;
  const rounds = event?.rounds || [];
  const activeRound = rounds.find((round, index) => (round.id || `round-${index}`) === activeRoundId) || rounds[0];
  const activePolicy = activeRound ? roundSalePolicies[activeRound.id || `round-${rounds.indexOf(activeRound)}`] || defaultPolicyForRound(activeRound) : globalSalePolicy;
  const recentTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 5),
    [tickets],
  );
  const previewSeats = useMemo(() => {
    const count = Number(issueCount);
    const start = Number(startNumber);
    if (!effectiveSectionName || !Number.isInteger(count) || count <= 0 || !Number.isInteger(start) || start <= 0) return [];
    return Array.from({ length: Math.min(count, 8) }, (_, index) => `${effectiveSectionName}-${start + index}`);
  }, [effectiveSectionName, issueCount, startNumber]);

  const showError = (title: string, message: string) => {
    setFeedback({ type: 'error', message });
    Alert.alert(title, message);
  };

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

  const selectQuantity = (value: string) => {
    setIssueCount(value);
  };

  const selectAllRemaining = () => {
    if (remainingCount && remainingCount > 0) {
      setIssueCount(String(remainingCount));
    }
  };

  const updateRoundPolicy = (roundKey: string, patch: Partial<SalePolicy>) => {
    setRoundSalePolicies((current) => ({
      ...current,
      [roundKey]: { ...(current[roundKey] || globalSalePolicy), ...patch },
    }));
  };

  const validateSalePolicy = () => {
    const check = (label: string, policy: SalePolicy, round?: EventRound) => {
      const start = toDateTimeIso(policy.saleStartDate, policy.saleStartTime);
      const end = toDateTimeIso(policy.saleEndDate, policy.saleEndTime);
      if (end < start) return `${label} 판매 종료는 판매 시작 이후로 설정해주세요.`;
      if (round && end > roundStartIso(round)) return `${label} 티켓 판매는 공연 시작 전에 종료되어야 합니다.`;
      return null;
    };

    if (policyMode === 'global') {
      const message = check('전체', globalSalePolicy);
      if (message) return message;
      const invalidRound = rounds.find((round) => toDateTimeIso(globalSalePolicy.saleEndDate, globalSalePolicy.saleEndTime) > roundStartIso(round));
      if (invalidRound) return '전체 티켓 판매는 모든 회차의 공연 시작 전에 종료되어야 합니다.';
      return null;
    }

    for (let index = 0; index < rounds.length; index += 1) {
      const round = rounds[index];
      const roundKey = round.id || `round-${index}`;
      const message = check(`${index + 1}회차`, roundSalePolicies[roundKey] || globalSalePolicy, round);
      if (message) return message;
    }
    return null;
  };

  const syncSalePolicyToEvent = async () => {
    if (!event) return;
    const sortedRounds = [...rounds].sort((a, b) => roundStartIso(a).localeCompare(roundStartIso(b)));
    const firstRound = sortedRounds[0];
    const lastRound = [...sortedRounds].sort((a, b) => toDateTimeIso(b.eventDate, b.endTime).localeCompare(toDateTimeIso(a.eventDate, a.endTime)))[0];
    const roundPayloads = sortedRounds.map((round, index) => {
      const originalIndex = rounds.findIndex((item) => item === round);
      const roundKey = round.id || `round-${originalIndex}`;
      const policy = policyMode === 'global' ? globalSalePolicy : roundSalePolicies[roundKey] || globalSalePolicy;
      return {
        title: round.title || `${index + 1}회차`,
        eventDate: round.eventDate,
        startTime: round.startTime,
        endTime: round.endTime,
        useGlobalSalePeriod: policyMode === 'global',
        saleStartAt: toDateTimeIso(policy.saleStartDate, policy.saleStartTime),
        saleEndAt: toDateTimeIso(policy.saleEndDate, policy.saleEndTime),
      };
    });
    const saleStarts = roundPayloads.map((round) => round.saleStartAt).sort();
    const saleEnds = roundPayloads.map((round) => round.saleEndAt).sort();

    await backendApi.updateEvent(event.id, {
      name: event.name || event.title,
      category: event.category,
      venue: event.venue,
      description: event.description || null,
      imageUrl: event.imageUrl || null,
      eventAt: firstRound ? roundStartIso(firstRound) : event.eventAt,
      eventStartAt: firstRound ? roundStartIso(firstRound) : event.eventStartAt,
      eventEndAt: lastRound ? toDateTimeIso(lastRound.eventDate, lastRound.endTime) : event.eventEndAt,
      primarySaleStart: saleStarts[0],
      primarySaleEnd: saleEnds[saleEnds.length - 1],
      salesStartAt: saleStarts[0],
      salesEndAt: saleEnds[saleEnds.length - 1],
      rounds: roundPayloads,
    });
  };

  const issue = async () => {
    setFeedback(null);
    const quantity = Number(issueCount);
    const start = Number(startNumber);
    const capRate = Number(effectiveResaleCapRate);

    if (!effectiveSectionName) return showError('입력 오류', '좌석 구역을 선택하거나 직접 추가해주세요.');
    if (!isPositiveNumber(sectionPriceEth)) return showError('입력 오류', '구역 가격을 0보다 큰 숫자로 입력해주세요.');
    if (resaleEnabled && (!Number.isFinite(capRate) || capRate < 100)) return showError('입력 오류', '최대 리셀가는 100% 이상으로 설정해주세요.');
    if (!isPositiveInteger(issueCount)) return showError('입력 오류', '발행 수량은 1장 이상으로 입력해주세요.');
    if (!isPositiveInteger(startNumber)) return showError('입력 오류', '시작 번호는 1 이상의 정수로 입력해주세요.');
    if (remainingCount !== null && quantity > remainingCount) return showError('입력 오류', `남은 발행 가능 수량은 ${remainingCount}장입니다.`);
    const salePolicyError = validateSalePolicy();
    if (salePolicyError) return showError('입력 오류', salePolicyError);

    setIssuing(true);
    try {
      await syncSalePolicyToEvent();
      const issued = await backendApi.issueTickets(eventId, {
        totalTicketCount: hasTotalLimit ? totalCount : undefined,
        ticketSections: [{
          sectionName: effectiveSectionName,
          priceWei: ethToWei(sectionPriceEth),
          resaleEnabled,
          resaleCapRate: Math.round(capRate * 100),
          startNumber: start,
          quantity,
        }],
      });
      const message = `${issued.length}장의 티켓을 발행했습니다.`;
      setFeedback({ type: 'success', message });
      Alert.alert('티켓 발행 완료', message);
      await load();
    } catch (error: any) {
      showError('티켓 발행 실패', errorMessage(error, '티켓을 발행하지 못했습니다.'));
    } finally {
      setIssuing(false);
    }
  };

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
      <Text style={styles.title}>티켓 발행</Text>
      <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'}의 좌석 구역별 가격과 리셀 정책을 설정합니다.</Text>

      {feedback ? (
        <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.statusBand}>
        <Text style={styles.statusTitle}>발행 현황</Text>
        <Text style={styles.statusLine}>
          총 {hasTotalLimit ? `${totalCount}장` : '미설정'} · 발행 {issuedCount}장 · 남은 {remainingCount === null ? '-' : `${remainingCount}장`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>티켓 정책 적용 방식</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeButton, policyMode === 'global' && styles.activeModeButton]} onPress={() => setPolicyMode('global')}>
            <Text style={styles.modeButtonText}>전체 설정 적용</Text>
            <Text style={styles.modeHint}>모든 회차에 같은 판매 기간과 정책을 적용합니다.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeButton, policyMode === 'round' && styles.activeModeButton]} onPress={() => setPolicyMode('round')}>
            <Text style={styles.modeButtonText}>회차별 설정</Text>
            <Text style={styles.modeHint}>회차마다 판매 기간과 정책을 따로 설정합니다.</Text>
          </TouchableOpacity>
        </View>

        {policyMode === 'round' && rounds.length > 0 ? (
          <View style={styles.roundPolicyList}>
            {rounds.map((round, index) => {
              const roundKey = round.id || `round-${index}`;
              const expanded = activeRoundId === roundKey;
              const policy = roundSalePolicies[roundKey] || globalSalePolicy;
              return (
                <View key={roundKey} style={styles.roundPolicyItem}>
                  <TouchableOpacity style={styles.roundHeader} onPress={() => setActiveRoundId(expanded ? null : roundKey)}>
                    <View style={styles.roundHeaderCopy}>
                      <Text style={styles.roundTitle}>{expanded ? '▼' : '▶'} {index + 1}회차 · {round.eventDate}</Text>
                      <Text style={styles.roundSummary}>{policy.saleStartDate} {policy.saleStartTime} ~ {policy.saleEndDate} {policy.saleEndTime}</Text>
                    </View>
                  </TouchableOpacity>
                  {expanded ? (
                    <SalePolicyFields
                      policy={policy}
                      onChange={(patch) => updateRoundPolicy(roundKey, patch)}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <SalePolicyFields policy={globalSalePolicy} onChange={(patch) => setGlobalSalePolicy((current) => ({ ...current, ...patch }))} />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{policyMode === 'round' && activeRound ? `${rounds.indexOf(activeRound) + 1}회차 좌석 구역` : '좌석 구역'}</Text>
        <View style={styles.chipGrid}>
          {SECTION_PRESETS.map((section) => (
            <TouchableOpacity
              key={section}
              style={[styles.choiceChip, !showCustomSection && sectionName === section && styles.activeChip]}
              onPress={() => {
                setShowCustomSection(false);
                setSectionName(section);
              }}
            >
              <Text style={[styles.choiceChipText, !showCustomSection && sectionName === section && styles.activeChipText]}>{section}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.choiceChip, showCustomSection && styles.activeChip]} onPress={() => setShowCustomSection(true)}>
            <Text style={[styles.choiceChipText, showCustomSection && styles.activeChipText]}>직접 추가</Text>
          </TouchableOpacity>
        </View>
        {showCustomSection ? (
          <TextInput style={styles.input} value={customSectionName} onChangeText={setCustomSectionName} placeholder="예: 2층A, BOX" autoCapitalize="characters" />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>구역 정책</Text>
        <Text style={styles.label}>가격</Text>
        <View style={styles.unitInputWrap}>
          <TextInput style={styles.unitInput} value={sectionPriceEth} onChangeText={setSectionPriceEth} keyboardType="decimal-pad" inputMode="decimal" />
          <Text style={styles.unitText}>ETH</Text>
        </View>

        <TouchableOpacity style={styles.toggleRow} onPress={() => setResaleEnabled((value) => !value)}>
          <Text style={styles.toggleLabel}>리셀 허용</Text>
          <Text style={[styles.toggleBadge, resaleEnabled ? styles.toggleOn : styles.toggleOff]}>{resaleEnabled ? '허용' : '비허용'}</Text>
        </TouchableOpacity>

        {resaleEnabled ? (
          <>
            <Text style={styles.label}>최대 리셀가</Text>
            <View style={styles.chipGrid}>
              {RESALE_RATE_PRESETS.map((rate) => (
                <TouchableOpacity
                  key={rate}
                  style={[styles.choiceChip, !useCustomResaleRate && resaleCapRate === rate && styles.activeChip]}
                  onPress={() => {
                    setUseCustomResaleRate(false);
                    setResaleCapRate(rate);
                  }}
                >
                  <Text style={[styles.choiceChipText, !useCustomResaleRate && resaleCapRate === rate && styles.activeChipText]}>{rate}%</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.choiceChip, useCustomResaleRate && styles.activeChip]} onPress={() => setUseCustomResaleRate(true)}>
                <Text style={[styles.choiceChipText, useCustomResaleRate && styles.activeChipText]}>직접 입력</Text>
              </TouchableOpacity>
            </View>
            {useCustomResaleRate ? (
              <View style={styles.unitInputWrap}>
                <TextInput style={styles.unitInput} value={customResaleCapRate} onChangeText={setCustomResaleCapRate} keyboardType="number-pad" inputMode="numeric" placeholder="예: 130" />
                <Text style={styles.unitText}>%</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>발행 수량</Text>
        <View style={styles.unitInputWrap}>
          <TextInput style={styles.unitInput} value={issueCount} onChangeText={setIssueCount} keyboardType="number-pad" inputMode="numeric" />
          <Text style={styles.unitText}>장</Text>
        </View>
        <View style={styles.chipGrid}>
          {QUANTITY_PRESETS.map((count) => (
            <TouchableOpacity key={count} style={[styles.choiceChip, issueCount === count && styles.activeChip]} onPress={() => selectQuantity(count)}>
              <Text style={[styles.choiceChipText, issueCount === count && styles.activeChipText]}>{count}장</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.choiceChip, remainingCount === null || remainingCount <= 0 ? styles.disabledChip : null]} disabled={remainingCount === null || remainingCount <= 0} onPress={selectAllRemaining}>
            <Text style={styles.choiceChipText}>남은 수량 전체</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced((value) => !value)}>
          <Text style={styles.advancedToggleText}>{showAdvanced ? '▼' : '▶'} 고급 설정</Text>
        </TouchableOpacity>
        {showAdvanced ? (
          <>
            <Text style={styles.label}>시작 번호</Text>
            <TextInput style={styles.input} value={startNumber} onChangeText={setStartNumber} keyboardType="number-pad" inputMode="numeric" />
          </>
        ) : null}

        <Text style={styles.previewLabel}>발행 예정 좌석</Text>
        <Text style={styles.previewText}>{previewSeats.join(', ') || '-'}</Text>
      </View>

      <TouchableOpacity style={[styles.primaryButton, issuing && styles.disabledButton]} disabled={issuing} onPress={issue}>
        <Text style={styles.primaryButtonText}>{issuing ? '발행 중...' : '티켓 발행'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('TicketExplore', { eventId })}>
        <Text style={styles.secondaryButtonText}>전체 발행 티켓 보기</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>최근 발행 티켓</Text>
        {recentTickets.length === 0 ? (
          <Text style={styles.emptyText}>최근 발행 티켓이 없습니다.</Text>
        ) : (
          recentTickets.map((ticket) => (
            <View key={ticketKey(ticket)} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketSeat}>{ticket.seatInfo}</Text>
                <Text style={styles.ticketMeta}>구역 {sectionOf(ticket)} · 가격 {weiToEth(ticket.originalPriceWei || ticket.priceWei)}</Text>
                <Text style={styles.ticketMeta}>리셀 {ticket.resaleEnabled ? `허용 · 상한 ${(ticket.resaleCapRate ?? 10000) / 100}%` : '비허용'}</Text>
              </View>
              <Text style={styles.ticketStatus}>{formatTicketStatus(ticket.status)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SalePolicyFields({ policy, onChange }: { policy: SalePolicy; onChange: (patch: Partial<SalePolicy>) => void }) {
  return (
    <View style={styles.salePolicyBody}>
      <View style={styles.saleBoundaryCard}>
        <Text style={styles.saleBoundaryTitle}>판매 시작</Text>
        <View style={styles.saleBoundaryRow}>
          <View style={styles.saleBoundaryField}>
            <Text style={styles.smallLabel}>날짜</Text>
            <TextInput style={styles.input} value={policy.saleStartDate} onChangeText={(value) => onChange({ saleStartDate: value })} placeholder="YYYY-MM-DD" />
          </View>
          <View style={styles.saleBoundaryField}>
            <Text style={styles.smallLabel}>시간</Text>
            <TextInput style={styles.input} value={policy.saleStartTime} onChangeText={(value) => onChange({ saleStartTime: value })} placeholder="HH:mm" />
          </View>
        </View>
      </View>
      <View style={styles.saleBoundaryCard}>
        <Text style={styles.saleBoundaryTitle}>판매 종료</Text>
        <View style={styles.saleBoundaryRow}>
          <View style={styles.saleBoundaryField}>
            <Text style={styles.smallLabel}>날짜</Text>
            <TextInput style={styles.input} value={policy.saleEndDate} onChangeText={(value) => onChange({ saleEndDate: value })} placeholder="YYYY-MM-DD" />
          </View>
          <View style={styles.saleBoundaryField}>
            <Text style={styles.smallLabel}>시간</Text>
            <TextInput style={styles.input} value={policy.saleEndTime} onChangeText={(value) => onChange({ saleEndTime: value })} placeholder="HH:mm" />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  backButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 14 },
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
  statusTitle: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  statusLine: { marginTop: 6, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  label: { marginTop: 14, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  smallLabel: { marginBottom: 6, color: '#64748B', fontSize: 12, fontWeight: '900' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  modeButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF' },
  activeModeButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  modeButtonText: { color: '#0F172A', fontWeight: '900' },
  modeHint: { marginTop: 6, color: '#64748B', fontSize: 12, lineHeight: 16 },
  roundPolicyList: { marginTop: 10 },
  roundPolicyItem: { marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  roundHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundHeaderCopy: { flex: 1 },
  roundTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  roundSummary: { marginTop: 4, color: '#64748B', fontSize: 12, fontWeight: '800' },
  salePolicyBody: { marginTop: 10, gap: 10 },
  saleBoundaryCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF' },
  saleBoundaryTitle: { color: '#2563EB', fontSize: 13, fontWeight: '900', marginBottom: 8 },
  saleBoundaryRow: { flexDirection: 'row', gap: 8 },
  saleBoundaryField: { flex: 1 },
  unitInputWrap: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  unitInput: { flex: 1, padding: 12, color: '#0F172A' },
  unitText: { color: '#64748B', fontWeight: '900' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  choiceChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  disabledChip: { opacity: 0.45 },
  choiceChipText: { color: '#334155', fontWeight: '900', fontSize: 13 },
  activeChipText: { color: '#2563EB' },
  toggleRow: { marginTop: 14, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: '#0F172A', fontWeight: '800' },
  toggleBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '900' },
  toggleOn: { backgroundColor: '#DCFCE7', color: '#166534' },
  toggleOff: { backgroundColor: '#F1F5F9', color: '#64748B' },
  advancedToggle: { marginTop: 14, paddingVertical: 8 },
  advancedToggleText: { color: '#2563EB', fontWeight: '900' },
  previewLabel: { marginTop: 14, color: '#64748B', fontSize: 12, fontWeight: '800' },
  previewText: { marginTop: 5, color: '#0F172A', fontWeight: '800', lineHeight: 20 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 10, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketInfo: { flex: 1 },
  ticketSeat: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  ticketStatus: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900', alignSelf: 'flex-start' },
  emptyText: { color: '#94A3B8', paddingVertical: 18, textAlign: 'center' },
});
