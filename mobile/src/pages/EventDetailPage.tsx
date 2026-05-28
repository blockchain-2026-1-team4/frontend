import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { formatCompactDateTime, formatEventCategory, formatEventStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventRound, ResaleListing, TicketDetail } from '../types/api';

const PRIMARY_TICKET_PAGE_SIZE = 20;
const FALLBACK_ROUND_ID = '__default-round__';

type DisplayRound = EventRound & {
  displayStartAt?: string;
  displayEndAt?: string;
};

type SaleState = {
  label: string;
  tone: 'green' | 'yellow' | 'red' | 'gray';
};

type SectionGroup = {
  key: string;
  sectionName: string;
  tickets: TicketDetail[];
  availableCount: number;
  minPriceWei?: string;
  resaleEnabled: boolean;
  resaleCapRate?: number;
  saleEndAt?: string;
  saleState: SaleState;
};

function isAvailable(ticket?: TicketDetail | null) {
  return String(ticket?.status ?? '').toUpperCase() === 'AVAILABLE';
}

function datePart(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return value.split('T')[0] || value;
}

function timePart(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }
  return value.match(/T(\d{2}:\d{2})/)?.[1] ?? '';
}

function roundStartAt(round?: DisplayRound) {
  if (!round) return undefined;
  return round.displayStartAt || (round.eventDate && round.startTime ? `${round.eventDate}T${round.startTime}` : round.eventDate);
}

function roundEndAt(round?: DisplayRound) {
  if (!round) return undefined;
  return round.displayEndAt || (round.eventDate && round.endTime ? `${round.eventDate}T${round.endTime}` : round.eventDate);
}

function buildFallbackRound(event: EventDetail): DisplayRound {
  const start = event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || event.primarySaleStart || event.salesStartAt;
  const end = event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || start;
  const saleStartAt = event.primarySaleStart || event.salesStartAt || start || '';
  const saleEndAt = event.primarySaleEnd || event.salesEndAt || end || saleStartAt;

  return {
    id: FALLBACK_ROUND_ID,
    title: '기본 회차',
    eventDate: datePart(start),
    startTime: timePart(start),
    endTime: timePart(end),
    saleStartAt,
    saleEndAt,
    useGlobalSalePeriod: true,
    displayStartAt: start,
    displayEndAt: end,
  };
}

function normalizeRound(round: EventRound, index: number, event: EventDetail): DisplayRound {
  const fallback = buildFallbackRound(event);
  return {
    ...round,
    title: round.title || `${index + 1}회차`,
    eventDate: round.eventDate || fallback.eventDate,
    startTime: round.startTime || fallback.startTime,
    endTime: round.endTime || fallback.endTime,
    saleStartAt: round.saleStartAt || event.primarySaleStart || event.salesStartAt || fallback.saleStartAt,
    saleEndAt: round.saleEndAt || event.primarySaleEnd || event.salesEndAt || fallback.saleEndAt,
    useGlobalSalePeriod: round.useGlobalSalePeriod ?? true,
  };
}

function displayRoundsOf(event: EventDetail | null): DisplayRound[] {
  if (!event) return [];
  if (event.rounds?.length) return event.rounds.map((round, index) => normalizeRound(round, index, event));
  return [buildFallbackRound(event)];
}

function roundKey(round: DisplayRound, index: number) {
  return round.id || `round-${index}`;
}

function roundLabel(round: DisplayRound, index: number) {
  return round.title || `${index + 1}회차`;
}

function roundTimeLabel(round: DisplayRound) {
  const start = formatCompactDateTime(roundStartAt(round));
  const end = formatCompactDateTime(roundEndAt(round));
  if (start === '-' && end === '-') return '-';
  if (start === end || end === '-') return start;
  return `${start} ~ ${end}`;
}

function roundKeyOfTicket(ticket: TicketDetail, rounds: DisplayRound[]) {
  if (ticket.eventRoundId) {
    const matchedIndex = rounds.findIndex((round) => round.id && String(round.id) === String(ticket.eventRoundId));
    if (matchedIndex >= 0) return roundKey(rounds[matchedIndex], matchedIndex);
  }

  const match = String(ticket.seatInfo || ticket.sectionName || '').match(/^(\d+)회차[-\s]/);
  if (match) {
    const roundIndex = Number(match[1]) - 1;
    if (rounds[roundIndex]) return roundKey(rounds[roundIndex], roundIndex);
  }

  if (rounds.length === 1) return roundKey(rounds[0], 0);
  return '__unassigned-round__';
}

function sectionNameOf(ticket: TicketDetail) {
  const source = String(ticket.sectionName || ticket.seatInfo || '').trim();
  const withoutSeatNumber = source.replace(/-\d+$/, '');
  return withoutSeatNumber.replace(/^\d+회차-/, '') || 'GENERAL';
}

function minWei(values: Array<string | undefined>) {
  const prices = values.filter((value): value is string => Boolean(value));
  if (!prices.length) return undefined;
  return prices.sort((a, b) => {
    try {
      return BigInt(a) < BigInt(b) ? -1 : 1;
    } catch {
      return Number(a) - Number(b);
    }
  })[0];
}

function priceLabel(value?: string) {
  if (!value) return '-';
  const eth = weiToEth(value);
  return eth === value ? `${value} WEI` : eth;
}

function shortDateTime(value?: string) {
  const formatted = formatCompactDateTime(value);
  return formatted === '-' ? '-' : formatted;
}

function saleStateOf(args: { saleStartAt?: string; saleEndAt?: string; soldOut: boolean }): SaleState {
  const now = Date.now();
  const saleStart = args.saleStartAt ? new Date(args.saleStartAt).getTime() : NaN;
  const saleEnd = args.saleEndAt ? new Date(args.saleEndAt).getTime() : NaN;

  if (args.soldOut) return { label: '매진', tone: 'red' };
  if (!Number.isNaN(saleStart) && now < saleStart) return { label: '예매 예정', tone: 'yellow' };
  if (!Number.isNaN(saleEnd) && now > saleEnd) return { label: '판매 종료', tone: 'gray' };
  return { label: '예매 가능', tone: 'green' };
}

function groupTicketsBySection(tickets: TicketDetail[], round: DisplayRound): SectionGroup[] {
  const grouped = new Map<string, TicketDetail[]>();
  tickets.forEach((ticket) => {
    const key = sectionNameOf(ticket);
    grouped.set(key, [...(grouped.get(key) ?? []), ticket]);
  });

  return [...grouped.entries()]
    .map(([sectionName, sectionTickets]) => {
      const availableCount = sectionTickets.filter(isAvailable).length;
      const first = sectionTickets[0];
      const saleStartAt = first?.saleStartAt || round.saleStartAt;
      const saleEndAt = first?.saleEndAt || round.saleEndAt;
      return {
        key: sectionName,
        sectionName,
        tickets: [...sectionTickets].sort((a, b) => String(a.seatInfo).localeCompare(String(b.seatInfo), 'ko-KR', { numeric: true })),
        availableCount,
        minPriceWei: minWei(sectionTickets.map((ticket) => ticket.originalPriceWei || ticket.priceWei)),
        resaleEnabled: first?.resaleEnabled ?? false,
        resaleCapRate: first?.resaleCapRate,
        saleEndAt,
        saleState: saleStateOf({ saleStartAt, saleEndAt, soldOut: availableCount === 0 }),
      };
    })
    .sort((a, b) => b.availableCount - a.availableCount || a.sectionName.localeCompare(b.sectionName, 'ko-KR', { numeric: true }));
}

function eventPeriod(event: EventDetail, rounds: DisplayRound[]) {
  const start = event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || roundStartAt(rounds[0]);
  const end = event.eventEndAt || event.endsAt || roundEndAt(rounds[rounds.length - 1]) || start;
  const startText = formatCompactDateTime(start);
  const endText = formatCompactDateTime(end);
  if (startText === endText || endText === '-') return startText;
  return `${startText} ~ ${endText}`;
}

function badgeToneStyle(tone: SaleState['tone'] | 'blue') {
  if (tone === 'blue') return styles.badge_blue;
  if (tone === 'green') return styles.badge_green;
  if (tone === 'yellow') return styles.badge_yellow;
  if (tone === 'red') return styles.badge_red;
  return styles.badge_gray;
}

function Badge({ label, tone }: { label: string; tone: SaleState['tone'] | 'blue' }) {
  return <Text style={[styles.badge, badgeToneStyle(tone)]}>{label}</Text>;
}

function InfoTile({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

export default function EventDetailPage({ route, navigation }: any) {
  const { eventId } = route.params;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [resales, setResales] = useState<ResaleListing[]>([]);
  const [seatQuery, setSeatQuery] = useState('');
  const [selectedRoundKey, setSelectedRoundKey] = useState<string | null>(null);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(null);
  const [primaryTicketPage, setPrimaryTicketPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [eventData, ticketData, resaleData] = await Promise.all([
          backendApi.getEvent(eventId),
          backendApi.getEventTickets(eventId),
          backendApi.getResaleListings({ size: 50 }),
        ]);
        const rounds = displayRoundsOf(eventData);
        setEvent({ ...eventData, rounds });
        setTickets(ticketData);
        setSelectedRoundKey(rounds[0] ? roundKey(rounds[0], 0) : null);
        setSelectedSectionKey(null);
        setSeatQuery('');
        setPrimaryTicketPage(1);
        setResales((resaleData.items ?? []).filter((listing) => String(listing.eventId) === String(eventId)));
      } catch (error: any) {
        Alert.alert('오류', error.message || '이벤트 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const rounds = useMemo(() => displayRoundsOf(event), [event]);
  const selectedRoundIndex = Math.max(0, rounds.findIndex((round, index) => roundKey(round, index) === selectedRoundKey));
  const selectedRound = rounds[selectedRoundIndex] || rounds[0];
  const activeRoundKey = selectedRound ? roundKey(selectedRound, selectedRoundIndex) : null;

  const roundTickets = useMemo(
    () => (activeRoundKey ? tickets.filter((ticket) => roundKeyOfTicket(ticket, rounds) === activeRoundKey) : []),
    [activeRoundKey, rounds, tickets],
  );

  const sectionGroups = useMemo(
    () => (selectedRound ? groupTicketsBySection(roundTickets, selectedRound) : []),
    [roundTickets, selectedRound],
  );

  useEffect(() => {
    setSelectedSectionKey((current) => {
      if (current && sectionGroups.some((group) => group.key === current)) return current;
      return sectionGroups[0]?.key ?? null;
    });
    setPrimaryTicketPage(1);
  }, [sectionGroups]);

  const selectedSection = sectionGroups.find((group) => group.key === selectedSectionKey) || sectionGroups[0] || null;
  const query = seatQuery.trim().toUpperCase();
  const filteredTickets = (selectedSection?.tickets ?? []).filter((ticket) => {
    const seatInfo = String(ticket.seatInfo ?? '').toUpperCase();
    return !query || seatInfo.includes(query);
  });
  const totalPrimaryTicketPages = Math.max(1, Math.ceil(filteredTickets.length / PRIMARY_TICKET_PAGE_SIZE));
  const currentPrimaryTicketPage = Math.min(primaryTicketPage, totalPrimaryTicketPages);
  const pagedPrimaryTickets = filteredTickets.slice(
    (currentPrimaryTicketPage - 1) * PRIMARY_TICKET_PAGE_SIZE,
    currentPrimaryTicketPage * PRIMARY_TICKET_PAGE_SIZE,
  );

  const roundCards = rounds.map((round, index) => {
    const key = roundKey(round, index);
    const targetTickets = tickets.filter((ticket) => roundKeyOfTicket(ticket, rounds) === key);
    const availableCount = targetTickets.filter(isAvailable).length;
    return {
      key,
      round,
      index,
      availableCount,
      minPriceWei: minWei(targetTickets.map((ticket) => ticket.originalPriceWei || ticket.priceWei)) || event?.ticketPriceWei,
      saleState: saleStateOf({ saleStartAt: round.saleStartAt, saleEndAt: round.saleEndAt, soldOut: availableCount === 0 }),
    };
  });

  const resetTicketPage = () => setPrimaryTicketPage(1);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (!event) {
    return <View style={styles.center}><Text>이벤트를 찾을 수 없습니다.</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.posterCard}>
        {resolveImageUrl(event.imageUrl) ? (
          <Image
            source={{ uri: resolveImageUrl(event.imageUrl)! }}
            style={styles.posterImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.posterFallback}>
            <Text style={styles.posterFallbackText}>{String(event.name || event.title || 'E').slice(0, 1)}</Text>
          </View>
        )}
      </View>

      <View style={styles.hero}>
        <View style={styles.badgeRow}>
          <Badge label={formatEventCategory(event.category)} tone="blue" />
          <Badge label={formatEventStatus(event.status)} tone="gray" />
        </View>
        <Text style={styles.stepLabel}>1단계 · 이벤트 상세</Text>
        <Text style={styles.title}>{event.name || event.title || '제목 없음'}</Text>
        <Text style={styles.description}>{event.description || '상세 설명이 없습니다.'}</Text>
        <View style={styles.infoGrid}>
          <InfoTile label="장소" value={event.venueDetail || event.location?.address || event.venue} />
          <InfoTile label="카테고리" value={formatEventCategory(event.category)} />
          <InfoTile label="전체 기간" value={eventPeriod(event, rounds)} />
          <InfoTile label="주최자" value={event.organizerName || event.organizerId} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>어떤 회차를 예매할까요?</Text>
          <Text style={styles.sectionHint}>회차 {rounds.length}개 · 날짜와 판매 상태를 먼저 확인하세요.</Text>
        </View>
      </View>

      <View style={styles.roundList}>
        {roundCards.map(({ key, round, index, availableCount, minPriceWei, saleState }) => (
          <TouchableOpacity
            key={key}
            style={[styles.roundCard, activeRoundKey === key && styles.activeCard]}
            activeOpacity={0.86}
            onPress={() => {
              setSelectedRoundKey(key);
              setSelectedSectionKey(null);
              setSeatQuery('');
              resetTicketPage();
            }}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{roundLabel(round, index)}</Text>
              <Badge label={saleState.label} tone={saleState.tone} />
            </View>
            <Text style={styles.cardMeta}>{roundTimeLabel(round)}</Text>
            <View style={styles.policyList}>
              <Text style={styles.policyItem}>시작가 {priceLabel(minPriceWei)}</Text>
              <Text style={styles.policyItem}>잔여 {availableCount}장</Text>
              <Text style={[styles.policyItem, availableCount === 0 && styles.soldOutText]}>
                {availableCount === 0 ? '즉시 매진' : '예매 가능'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>2단계 · 구역/좌석 정책</Text>
          <Text style={styles.sectionHint}>{selectedRound ? roundLabel(selectedRound, selectedRoundIndex) : '회차를 선택하세요'}</Text>
        </View>
      </View>

      <View style={styles.sectionGrid}>
        {sectionGroups.map((group) => (
          <TouchableOpacity
            key={group.key}
            style={[styles.sectionCard, selectedSection?.key === group.key && styles.activeCard]}
            activeOpacity={0.86}
            onPress={() => {
              setSelectedSectionKey(group.key);
              setSeatQuery('');
              resetTicketPage();
            }}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{group.sectionName}</Text>
              <Badge label={group.saleState.label} tone={group.saleState.tone} />
            </View>
            <View style={styles.policyList}>
              <Text style={styles.policyItem}>가격 {priceLabel(group.minPriceWei || event.ticketPriceWei)}</Text>
              <Text style={styles.policyItem}>잔여 {group.availableCount}장</Text>
              <Text style={styles.policyItem}>
                {group.resaleEnabled ? `리셀 가능 · 최대 ${Math.round((group.resaleCapRate ?? 0) / 100)}%` : '리셀 불가'}
              </Text>
              <Text style={styles.policyItem}>판매 종료 {shortDateTime(group.saleEndAt)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {!sectionGroups.length ? <Text style={styles.empty}>선택한 회차에 등록된 좌석 정책이 없습니다.</Text> : null}

      {selectedSection ? (
        <>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>3단계 · 티켓 선택</Text>
              <Text style={styles.sectionHint}>{selectedSection.sectionName} · {filteredTickets.length}개</Text>
            </View>
          </View>

          <TextInput
            style={styles.seatSearchInput}
            value={seatQuery}
            onChangeText={(value) => {
              setSeatQuery(value);
              resetTicketPage();
            }}
            placeholder="좌석 검색 예: VIP-3"
            autoCapitalize="characters"
            returnKeyType="search"
          />

          <FlatList
            data={pagedPrimaryTickets}
            scrollEnabled={false}
            keyExtractor={(item) => String(item.id ?? item.ticketId)}
            ListEmptyComponent={<Text style={styles.empty}>조건에 맞는 티켓이 없습니다.</Text>}
            renderItem={({ item }) => {
              const ticketState = saleStateOf({
                saleStartAt: item.saleStartAt || selectedRound?.saleStartAt,
                saleEndAt: item.saleEndAt || selectedSection.saleEndAt,
                soldOut: !isAvailable(item),
              });
              const purchasable = isAvailable(item) && ticketState.tone === 'green';
              return (
                <TouchableOpacity
                  style={[styles.ticketRow, !purchasable && styles.disabledTicketRow]}
                  disabled={!purchasable}
                  onPress={() => navigation.navigate('TicketPurchase', { ticketId: item.id ?? item.ticketId, eventId })}
                >
                  <View style={styles.ticketCopy}>
                    <Text style={styles.rowTitle}>{item.seatInfo}</Text>
                    <Text style={styles.rowMeta}>{priceLabel(item.originalPriceWei || item.priceWei || event.ticketPriceWei)}</Text>
                    <Text style={styles.rowMeta}>
                      {item.resaleEnabled ? `리셀 가능 · 최대 ${Math.round((item.resaleCapRate ?? 0) / 100)}%` : '리셀 불가'} · 판매 종료 {shortDateTime(item.saleEndAt || selectedSection.saleEndAt)}
                    </Text>
                  </View>
                  <Text style={[styles.rowAction, !purchasable && styles.disabledAction]}>{purchasable ? '예매' : ticketState.label}</Text>
                </TouchableOpacity>
              );
            }}
          />

          {filteredTickets.length > PRIMARY_TICKET_PAGE_SIZE ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageNavButton, currentPrimaryTicketPage === 1 && styles.disabledPageButton]}
                disabled={currentPrimaryTicketPage === 1}
                onPress={() => setPrimaryTicketPage((page) => Math.max(1, page - 1))}
              >
                <Text style={[styles.pageNavText, currentPrimaryTicketPage === 1 && styles.disabledPageText]}>이전</Text>
              </TouchableOpacity>
              <Text style={styles.pageText}>{currentPrimaryTicketPage} / {totalPrimaryTicketPages}</Text>
              <TouchableOpacity
                style={[styles.pageNavButton, currentPrimaryTicketPage === totalPrimaryTicketPages && styles.disabledPageButton]}
                disabled={currentPrimaryTicketPage === totalPrimaryTicketPages}
                onPress={() => setPrimaryTicketPage((page) => Math.min(totalPrimaryTicketPages, page + 1))}
              >
                <Text style={[styles.pageNavText, currentPrimaryTicketPage === totalPrimaryTicketPages && styles.disabledPageText]}>다음</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>이 이벤트의 리셀 티켓</Text>
        <Text style={styles.sectionHint}>{resales.length}개</Text>
      </View>
      <FlatList
        data={resales.slice(0, 5)}
        scrollEnabled={false}
        keyExtractor={(item) => String(item.id ?? item.listingId)}
        ListEmptyComponent={<Text style={styles.empty}>이 이벤트에 등록된 리셀 티켓이 없습니다.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.ticketRow} onPress={() => navigation.navigate('ResaleDetail', { listingId: item.id ?? item.listingId })}>
            <View>
              <Text style={styles.rowTitle}>티켓 {String(item.ticketId).slice(0, 8)}</Text>
              <Text style={styles.rowMeta}>{priceLabel(item.priceWei ?? item.price)}</Text>
            </View>
            <Text style={styles.rowAction}>보기</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('ResaleList', { eventId })}>
        <Text style={styles.secondaryButtonText}>이 이벤트 리셀 목록 보기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  posterCard: { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginBottom: 12 },
  posterImage: { width: '100%', aspectRatio: 3 / 4 },
  posterFallback: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  posterFallbackText: { color: '#2563EB', fontSize: 54, fontWeight: '900' },
  hero: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  badge_blue: { backgroundColor: '#EFF6FF', color: '#2563EB' },
  badge_green: { backgroundColor: '#DCFCE7', color: '#166534' },
  badge_yellow: { backgroundColor: '#FEF3C7', color: '#B45309' },
  badge_red: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  badge_gray: { backgroundColor: '#F1F5F9', color: '#475569' },
  stepLabel: { color: '#2563EB', fontSize: 12, fontWeight: '900', marginBottom: 5 },
  title: { color: '#0F172A', fontSize: 25, fontWeight: '900', marginBottom: 8 },
  description: { color: '#475569', fontSize: 14, lineHeight: 21 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  infoTile: { width: '48%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#F8FAFC', padding: 10 },
  infoLabel: { color: '#64748B', fontSize: 11, fontWeight: '900', marginBottom: 5 },
  infoValue: { color: '#0F172A', fontSize: 13, fontWeight: '900', lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, marginBottom: 10, gap: 10 },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  sectionHint: { color: '#64748B', fontSize: 12, fontWeight: '800', marginTop: 4 },
  roundList: { gap: 10 },
  roundCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  activeCard: { borderWidth: 2, borderColor: '#2563EB', backgroundColor: '#F8FBFF' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, color: '#0F172A', fontSize: 15, fontWeight: '900' },
  cardMeta: { marginTop: 7, color: '#475569', fontSize: 13, fontWeight: '800' },
  policyList: { marginTop: 10, gap: 5 },
  policyItem: { color: '#334155', fontSize: 13, fontWeight: '800', lineHeight: 18 },
  soldOutText: { color: '#B91C1C' },
  sectionGrid: { gap: 10 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  seatSearchInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, marginBottom: 10, color: '#0F172A' },
  ticketRow: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 13, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  disabledTicketRow: { opacity: 0.62, backgroundColor: '#F8FAFC' },
  ticketCopy: { flex: 1 },
  rowTitle: { color: '#0F172A', fontWeight: '900', marginBottom: 4 },
  rowMeta: { color: '#64748B', fontSize: 12, fontWeight: '800', lineHeight: 18 },
  rowAction: { color: '#2563EB', fontWeight: '900' },
  disabledAction: { color: '#64748B' },
  empty: { color: '#94A3B8', paddingVertical: 14, textAlign: 'center', fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 2, marginBottom: 14 },
  pageNavButton: { minWidth: 58, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#FFFFFF', alignItems: 'center' },
  disabledPageButton: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  pageNavText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  disabledPageText: { color: '#94A3B8' },
  pageText: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 8, backgroundColor: '#EFF6FF' },
  secondaryButtonText: { color: '#2563EB', fontWeight: '900' },
});
