import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { showDialog } from '../lib/dialog';
import { formatCompactDateTime, formatEventCategory, formatEventStatus, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventRound, ResaleListing, TicketDetail } from '../types/api';

const PRIMARY_TICKET_PAGE_SIZE = 12;
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

type IconName = 'arrowLeft' | 'heart' | 'share' | 'map' | 'category' | 'calendar' | 'shield' | 'chevron' | 'refresh' | 'seat' | 'ticket';

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

function capRateLabel(value?: number) {
  if (!value) return '-';
  return `${Math.round(value / 100)}%`;
}

function eventTitle(event?: EventDetail | null) {
  return event?.name || event?.title || '제목 없음';
}

function eventVenue(event?: EventDetail | null) {
  return event?.venueDetail || event?.location?.address || event?.location?.name || event?.venue || '-';
}

function compactId(value?: string | number | null) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  if (text.length <= 14) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
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

function Icon({ name, color = '#64748B', size = 20 }: { name: IconName; color?: string; size?: number }) {
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  if (name === 'arrowLeft') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M15 18l-6-6 6-6" {...common} /></Svg>;
  if (name === 'heart') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M20.8 6.6a5.2 5.2 0 00-7.4 0L12 8l-1.4-1.4a5.2 5.2 0 00-7.4 7.4L12 22l8.8-8a5.2 5.2 0 000-7.4z" {...common} /></Svg>;
  if (name === 'share') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="18" cy="5" r="3" {...common} /><Circle cx="6" cy="12" r="3" {...common} /><Circle cx="18" cy="19" r="3" {...common} /><Path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" {...common} /></Svg>;
  if (name === 'map') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 21s7-4.4 7-11a7 7 0 10-14 0c0 6.6 7 11 7 11z" {...common} /><Circle cx="12" cy="10" r="2.5" {...common} /></Svg>;
  if (name === 'category') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 6h16M4 12h16M4 18h10" {...common} /></Svg>;
  if (name === 'calendar') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="5" width="16" height="15" rx="2" {...common} /><Path d="M8 3v4M16 3v4M4 10h16" {...common} /></Svg>;
  if (name === 'shield') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zM9 12l2 2 4-5" {...common} /></Svg>;
  if (name === 'refresh') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M20 11a8 8 0 00-14.2-4.9L4 8M4 4v4h4M4 13a8 8 0 0014.2 4.9L20 16M16 16h4v4" {...common} /></Svg>;
  if (name === 'seat') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M7 11V6a3 3 0 016 0v5M6 11h10a3 3 0 013 3v5H5v-5a3 3 0 013-3zM8 19v2M16 19v2" {...common} /></Svg>;
  if (name === 'ticket') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 6h14v4a2 2 0 000 4v4H5v-4a2 2 0 000-4V6zM9 8v8" {...common} /></Svg>;
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M9 18l6-6-6-6" {...common} /></Svg>;
}

function InfoBox({ icon, label, value, link, onLinkPress }: { icon: IconName; label: string; value?: string | number | null; link?: string; onLinkPress?: () => void }) {
  return (
    <View style={styles.infoBox}>
      <View style={styles.infoIcon}><Icon name={icon} size={18} color="#534AB7" /></View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
      {link ? (
        onLinkPress
          ? <TouchableOpacity onPress={onLinkPress} activeOpacity={0.7}><Text style={styles.link}>{link}</Text></TouchableOpacity>
          : <Text style={styles.link}>{link}</Text>
      ) : null}
    </View>
  );
}

function MapThumb() {
  return (
    <View style={styles.mapThumb}>
      <View style={styles.mapRingA} />
      <View style={styles.mapRingB} />
      <View style={styles.mapField} />
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
  const [selectedTicketKey, setSelectedTicketKey] = useState<string | null>(null);
  const [primaryTicketPage, setPrimaryTicketPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [eventData, ticketData, resaleData] = await Promise.all([
          backendApi.getEvent(eventId),
          backendApi.getEventTickets(eventId).catch(() => [] as TicketDetail[]),
          backendApi.getResaleListings({ size: 50 }).catch(() => ({ items: [] as ResaleListing[] })),
        ]);
        const rounds = displayRoundsOf(eventData);
        setEvent({ ...eventData, rounds });
        setTickets(ticketData);
        setSelectedRoundKey(rounds[0] ? roundKey(rounds[0], 0) : null);
        setSelectedSectionKey(null);
        setSelectedTicketKey(null);
        setSeatQuery('');
        setPrimaryTicketPage(1);
        setResales((resaleData.items ?? []).filter((listing) => String(listing.eventId) === String(eventId)));
      } catch (error: any) {
        showDialog('오류', error.message || '이벤트 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [eventId]);

  const rounds = useMemo(() => displayRoundsOf(event), [event]);
  const selectedRoundIndex = Math.max(0, rounds.findIndex((round, index) => roundKey(round, index) === selectedRoundKey));
  const selectedRound = rounds[selectedRoundIndex] || rounds[0];
  const activeRoundKey = selectedRound ? roundKey(selectedRound, selectedRoundIndex) : null;

  // 이벤트 상태가 PUBLISHED가 아니면 구매 불가 (CANCELLED, INACTIVE, DRAFT 등)
  const eventStatus = String(event?.status ?? '').toUpperCase();
  const isEventSalable = eventStatus === 'PUBLISHED';
  const unsalableState: SaleState = eventStatus === 'CANCELLED'
    ? { label: '이벤트 취소', tone: 'red' }
    : { label: '판매 불가', tone: 'gray' };

  const roundTickets = useMemo(
    () => (activeRoundKey ? tickets.filter((ticket) => roundKeyOfTicket(ticket, rounds) === activeRoundKey) : []),
    [activeRoundKey, rounds, tickets],
  );

  const sectionGroups = useMemo(() => {
    if (!selectedRound) return [];
    const groups = groupTicketsBySection(roundTickets, selectedRound);
    if (!isEventSalable) {
      return groups.map((g) => ({ ...g, availableCount: 0, saleState: unsalableState }));
    }
    return groups;
  }, [roundTickets, selectedRound, isEventSalable, unsalableState]);

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
  const purchasableTickets = !isEventSalable ? [] : filteredTickets.filter((ticket) => {
    const ticketState = saleStateOf({
      saleStartAt: ticket.saleStartAt || selectedRound?.saleStartAt,
      saleEndAt: ticket.saleEndAt || selectedSection?.saleEndAt,
      soldOut: !isAvailable(ticket),
    });
    return isAvailable(ticket) && ticketState.tone === 'green';
  });
  const totalPrimaryTicketPages = Math.max(1, Math.ceil(filteredTickets.length / PRIMARY_TICKET_PAGE_SIZE));
  const currentPrimaryTicketPage = Math.min(primaryTicketPage, totalPrimaryTicketPages);
  const pagedPrimaryTickets = filteredTickets.slice(
    (currentPrimaryTicketPage - 1) * PRIMARY_TICKET_PAGE_SIZE,
    currentPrimaryTicketPage * PRIMARY_TICKET_PAGE_SIZE,
  );
  const selectedTicket = purchasableTickets.find((ticket) => String(ticket.id ?? ticket.ticketId) === selectedTicketKey) || purchasableTickets[0] || null;

  useEffect(() => {
    const first = purchasableTickets[0];
    setSelectedTicketKey((current) => {
      if (current && purchasableTickets.some((ticket) => String(ticket.id ?? ticket.ticketId) === current)) return current;
      return first ? String(first.id ?? first.ticketId) : null;
    });
  }, [purchasableTickets]);

  const roundCards = rounds.map((round, index) => {
    const key = roundKey(round, index);
    const targetTickets = tickets.filter((ticket) => roundKeyOfTicket(ticket, rounds) === key);
    const availableCount = isEventSalable ? targetTickets.filter(isAvailable).length : 0;
    return {
      key,
      round,
      index,
      availableCount,
      minPriceWei: minWei(targetTickets.map((ticket) => ticket.originalPriceWei || ticket.priceWei)) || event?.ticketPriceWei,
      saleState: isEventSalable
        ? saleStateOf({ saleStartAt: round.saleStartAt, saleEndAt: round.saleEndAt, soldOut: availableCount === 0 })
        : unsalableState,
    };
  });

  const resetTicketPage = () => setPrimaryTicketPage(1);
  const heroImage = resolveImageUrl(event?.imageUrl);
  const stickyPrice = priceLabel(selectedTicket?.originalPriceWei || selectedTicket?.priceWei || selectedSection?.minPriceWei || event?.ticketPriceWei);

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('EventList');
  };

  const goToCheckout = () => {
    if (!selectedTicket) {
      showDialog('좌석 선택', '예매 가능한 좌석을 먼저 선택해주세요.');
      return;
    }
    navigation.navigate('TicketPurchase', { ticketId: selectedTicket.id ?? selectedTicket.ticketId, eventId });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;
  }

  if (!event) {
    return <View style={styles.center}><Text style={styles.empty}>이벤트를 찾을 수 없습니다.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconButton} onPress={goBack} activeOpacity={0.84}>
          <Icon name="arrowLeft" size={20} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>이벤트 상세</Text>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.84} onPress={() => showDialog('준비 중', '좋아요 기능은 준비 중입니다.')}><Icon name="heart" size={19} /></TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.84} onPress={() => showDialog('준비 중', '공유 기능은 준비 중입니다.')}><Icon name="share" size={19} /></TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A1A2E', '#534AB7', '#1D9E75']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.detailHero}>
          {heroImage ? <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <View style={styles.heroDim} />
          <View style={styles.posterLine}>
            <LinearGradient colors={['#0C447C', '#185FA5', '#639922']} style={styles.miniPoster} />
            <LinearGradient colors={['#2C2C2A', '#5F5E5A', '#534AB7']} style={styles.miniPoster} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.glassBadge}>{formatEventStatus(event.status)}</Text>
            <Text style={styles.heroTitle}>{eventTitle(event)}</Text>
            <Text style={styles.heroMeta}>{eventVenue(event)} · {eventPeriod(event, rounds)}</Text>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.detailCard}>
            <View style={styles.pillRow}>
              <Text style={[styles.pill, styles.pillActive]}>이벤트 상세</Text>
              <Text style={styles.pill}>공식 발행 티켓</Text>
            </View>
            <Text style={styles.eventTitle}>{eventTitle(event)}</Text>
            <Text style={styles.description}>{event.description || '상세 설명이 없습니다.'}</Text>
            <View style={styles.infoGrid}>
              <InfoBox icon="map" label="장소" value={eventVenue(event)} link="지도 보기" onLinkPress={() => showDialog('준비 중', '지도보기는 준비 중입니다.')} />
              <InfoBox icon="category" label="카테고리" value={formatEventCategory(event.category)} />
              <InfoBox icon="calendar" label="전체 기간" value={eventPeriod(event, rounds)} />
              <InfoBox icon="shield" label="발행 주최자" value={event.organizerName || compactId(event.organizerId)} link="주최자 정보" onLinkPress={() => showDialog('준비 중', '주최자 정보는 준비 중입니다.')} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.head}>
            <View>
              <Text style={styles.headTitle}>회차 선택</Text>
              <Text style={styles.headSub}>날짜와 판매 상태를 확인하세요</Text>
            </View>
          </View>
          <View style={styles.roundList}>
            {roundCards.map(({ key, round, index, availableCount, minPriceWei, saleState }) => (
              <TouchableOpacity
                key={key}
                style={[styles.roundCard, activeRoundKey === key && styles.roundCardActive]}
                activeOpacity={0.86}
                onPress={() => {
                  setSelectedRoundKey(key);
                  setSelectedSectionKey(null);
                  setSelectedTicketKey(null);
                  setSeatQuery('');
                  resetTicketPage();
                }}
              >
                <View style={styles.roundTop}>
                  <Text style={styles.roundName}>{roundLabel(round, index)}</Text>
                  <Badge label={saleState.label} tone={saleState.tone} />
                </View>
                <Text style={styles.roundTime}>{roundTimeLabel(round)}</Text>
                <View style={styles.roundMeta}>
                  <Text style={styles.roundMetaText}>시작가 <Text style={styles.roundMetaStrong}>{priceLabel(minPriceWei)}</Text></Text>
                  <Text style={styles.roundMetaText}>잔여 <Text style={styles.roundMetaStrong}>{availableCount}장</Text></Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.head}>
            <View>
              <Text style={styles.headTitle}>구역/좌석 선택</Text>
              <Text style={styles.headSub}>원하는 구역을 선택하면 좌석 목록이 표시됩니다</Text>
            </View>
          </View>
          <View style={styles.zoneList}>
            {sectionGroups.map((group, index) => {
              const active = selectedSection?.key === group.key;
              return (
                <TouchableOpacity
                  key={group.key}
                  style={[styles.zone, active && styles.zoneActive]}
                  activeOpacity={0.86}
                  onPress={() => {
                    setSelectedSectionKey(group.key);
                    setSelectedTicketKey(null);
                    setSeatQuery('');
                    resetTicketPage();
                  }}
                >
                  <MapThumb />
                  <View style={styles.zoneInfo}>
                    <View style={styles.zoneTop}>
                      <Text style={styles.zoneName}>{group.sectionName}</Text>
                      {index < 2 ? <Text style={[styles.tag, index === 0 ? styles.tagPurple : styles.tagOrange]}>{index === 0 ? '인기' : '프리미엄'}</Text> : null}
                    </View>
                    <Text style={styles.zonePrice}>가격 {priceLabel(group.minPriceWei || event.ticketPriceWei)} ~</Text>
                    <Text style={styles.zoneMeta}>
                      잔여 {group.availableCount}장 · {group.resaleEnabled ? `리셀 가능 · 최대 ${capRateLabel(group.resaleCapRate)}` : '리셀 불가'}
                    </Text>
                  </View>
                  <Icon name="chevron" size={18} color="#64748B" />
                </TouchableOpacity>
              );
            })}
          </View>
          {!sectionGroups.length ? <Text style={styles.empty}>선택한 회차에 등록된 좌석 정책이 없습니다.</Text> : null}
        </View>

        {selectedSection ? (
          <View style={styles.section}>
            <View style={styles.head}>
              <View>
                <Text style={styles.headTitle}>좌석 목록</Text>
                <Text style={styles.headSub}>{selectedSection.sectionName} · 잔여 {selectedSection.availableCount}장</Text>
              </View>
            </View>
            <TextInput
              style={styles.seatSearch}
              value={seatQuery}
              onChangeText={(value) => {
                setSeatQuery(value);
                resetTicketPage();
              }}
              placeholder="좌석 검색 예: VIP-3"
              autoCapitalize="characters"
              returnKeyType="search"
            />
            <View style={styles.seatList}>
              {pagedPrimaryTickets.length ? pagedPrimaryTickets.map((ticket) => {
                const key = String(ticket.id ?? ticket.ticketId);
                const ticketState = saleStateOf({
                  saleStartAt: ticket.saleStartAt || selectedRound?.saleStartAt,
                  saleEndAt: ticket.saleEndAt || selectedSection.saleEndAt,
                  soldOut: !isAvailable(ticket),
                });
                const purchasable = isAvailable(ticket) && ticketState.tone === 'green';
                const selected = selectedTicketKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.seatRow, selected && styles.seatRowActive, !purchasable && styles.seatRowDisabled]}
                    disabled={!purchasable}
                    activeOpacity={0.86}
                    onPress={() => setSelectedTicketKey(key)}
                  >
                    <View style={styles.seatCopy}>
                      <Text style={styles.seatName}>{ticket.seatInfo}</Text>
                      <Text style={styles.seatMeta}>
                        {ticket.resaleEnabled ? `리셀 가능 · 최대 ${capRateLabel(ticket.resaleCapRate)}` : '리셀 불가'} · 판매 종료 {shortDateTime(ticket.saleEndAt || selectedSection.saleEndAt)}
                      </Text>
                    </View>
                    <View style={styles.seatRight}>
                      <Text style={styles.seatPrice}>{priceLabel(ticket.originalPriceWei || ticket.priceWei || event.ticketPriceWei)}</Text>
                      <Text style={[styles.seatState, !purchasable && styles.seatStateDisabled]}>{purchasable ? (selected ? '선택됨' : '선택') : ticketState.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }) : <Text style={styles.empty}>조건에 맞는 티켓이 없습니다.</Text>}
            </View>

            {filteredTickets.length > PRIMARY_TICKET_PAGE_SIZE ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageButton, currentPrimaryTicketPage === 1 && styles.pageButtonDisabled]}
                  disabled={currentPrimaryTicketPage === 1}
                  onPress={() => setPrimaryTicketPage((page) => Math.max(1, page - 1))}
                >
                  <Text style={[styles.pageButtonText, currentPrimaryTicketPage === 1 && styles.pageButtonTextDisabled]}>이전</Text>
                </TouchableOpacity>
                <Text style={styles.pageText}>{currentPrimaryTicketPage} / {totalPrimaryTicketPages}</Text>
                <TouchableOpacity
                  style={[styles.pageButton, currentPrimaryTicketPage === totalPrimaryTicketPages && styles.pageButtonDisabled]}
                  disabled={currentPrimaryTicketPage === totalPrimaryTicketPages}
                  onPress={() => setPrimaryTicketPage((page) => Math.min(totalPrimaryTicketPages, page + 1))}
                >
                  <Text style={[styles.pageButtonText, currentPrimaryTicketPage === totalPrimaryTicketPages && styles.pageButtonTextDisabled]}>다음</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <TouchableOpacity style={styles.resale} activeOpacity={0.86} onPress={() => navigation.navigate('ResaleList', { eventId })}>
            <View style={styles.resaleIcon}><Icon name="refresh" size={23} color="#A89CF7" /></View>
            <View style={styles.resaleCopy}>
              <Text style={styles.resaleTitle}>이 이벤트의 리셀 티켓</Text>
              <Text style={styles.resaleSub}>공식 티켓이 매진되었거나 원하는 좌석이 없을 때 리셀 목록을 확인합니다.</Text>
            </View>
            <Text style={styles.resaleCount}>{resales.length}개</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.stickyBuy}>
        <View style={styles.buyPrice}>
          <Text style={styles.buyLabel}>최저가</Text>
          <Text style={styles.buyValue} numberOfLines={1}>{stickyPrice}</Text>
        </View>
        <TouchableOpacity style={[styles.buyButton, !selectedTicket && styles.buyButtonDisabled]} disabled={!selectedTicket} onPress={goToCheckout} activeOpacity={0.88}>
          <Icon name="seat" size={20} color="#FFFFFF" />
          <Text style={styles.buyButtonText}>좌석 선택하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  scroll: { flex: 1 },
  content: { paddingBottom: 150 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F7FB' },
  topbar: {
    backgroundColor: 'rgba(246,247,251,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  topActions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  detailHero: { height: 270, marginHorizontal: 16, marginTop: 14, marginBottom: 14, borderRadius: 28, overflow: 'hidden', position: 'relative', ...shadow },
  heroDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  posterLine: { position: 'absolute', top: 18, right: -12, flexDirection: 'row', gap: 8, transform: [{ rotate: '8deg' }], opacity: 0.78 },
  miniPoster: { width: 62, height: 88, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroBody: { position: 'absolute', left: 17, right: 17, bottom: 17, zIndex: 2 },
  glassBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    color: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    marginBottom: 9,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', lineHeight: 32, letterSpacing: 0, marginBottom: 8 },
  heroMeta: { color: 'rgba(255,255,255,0.74)', fontSize: 11, fontWeight: '700', lineHeight: 17 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  detailCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 18, ...shadow },
  pillRow: { flexDirection: 'row', gap: 7, marginBottom: 12, flexWrap: 'wrap' },
  pill: { fontSize: 11, fontWeight: '900', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F1F5F9', color: '#64748B', overflow: 'hidden' },
  pillActive: { backgroundColor: '#EEEDFE', color: '#534AB7' },
  eventTitle: { fontSize: 22, fontWeight: '900', lineHeight: 27, color: '#0F172A', letterSpacing: 0, marginBottom: 11 },
  description: { fontSize: 13, lineHeight: 22, color: '#526177', marginBottom: 16, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoBox: { width: '48.8%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 17, padding: 12 },
  infoIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  infoLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 4 },
  infoValue: { fontSize: 12, fontWeight: '900', color: '#0F172A', lineHeight: 17 },
  link: { fontSize: 11, fontWeight: '900', color: '#534AB7', marginTop: 5 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  headTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  headSub: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '700' },
  roundList: { gap: 10 },
  roundCard: { padding: 14, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, backgroundColor: '#FFFFFF', ...shadow },
  roundCardActive: { borderWidth: 2, borderColor: '#534AB7', backgroundColor: '#FFFFFF' },
  roundTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  roundName: { flex: 1, fontSize: 16, fontWeight: '900', color: '#0F172A' },
  roundTime: { fontSize: 13, fontWeight: '800', color: '#26364F', marginBottom: 8 },
  roundMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  roundMetaText: { fontSize: 12, color: '#64748B', fontWeight: '800' },
  roundMetaStrong: { color: '#0F172A', fontWeight: '900' },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 10, fontWeight: '900' },
  badge_blue: { backgroundColor: '#EEEDFE', color: '#534AB7' },
  badge_green: { backgroundColor: '#E1F5EE', color: '#0F6E56' },
  badge_yellow: { backgroundColor: '#FFF3E6', color: '#F97316' },
  badge_red: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  badge_gray: { backgroundColor: '#F1F5F9', color: '#64748B' },
  zoneList: { gap: 10 },
  zone: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, padding: 11, flexDirection: 'row', gap: 12, alignItems: 'center', ...shadow },
  zoneActive: { borderWidth: 2, borderColor: '#534AB7', backgroundColor: '#FBFAFF' },
  mapThumb: { width: 76, height: 76, borderRadius: 17, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  mapRingA: { position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 10, borderColor: '#DBEAFE' },
  mapRingB: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 8, borderColor: '#C7D2FE' },
  mapField: { position: 'absolute', left: 13, right: 13, bottom: 12, height: 15, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, backgroundColor: '#4ADE80', opacity: 0.82 },
  zoneInfo: { flex: 1, minWidth: 0 },
  zoneTop: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  zoneName: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  tag: { fontSize: 10, fontWeight: '900', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, overflow: 'hidden' },
  tagPurple: { backgroundColor: '#EEEDFE', color: '#534AB7' },
  tagOrange: { backgroundColor: '#FFF3E6', color: '#F97316' },
  zonePrice: { fontSize: 12, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  zoneMeta: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  seatSearch: { height: 44, borderWidth: 1, borderColor: '#D9E1EE', backgroundColor: '#FFFFFF', borderRadius: 15, paddingHorizontal: 13, fontSize: 13, color: '#334155', marginBottom: 10 },
  seatList: { gap: 9 },
  seatRow: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  seatRowActive: { borderWidth: 2, borderColor: '#534AB7', backgroundColor: '#FBFAFF' },
  seatRowDisabled: { opacity: 0.55, backgroundColor: '#F8FAFC' },
  seatCopy: { flex: 1, minWidth: 0 },
  seatName: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
  seatMeta: { fontSize: 11, color: '#64748B', fontWeight: '700', lineHeight: 16 },
  seatRight: { alignItems: 'flex-end', gap: 3 },
  seatPrice: { fontSize: 13, fontWeight: '900', color: '#1A1A2E' },
  seatState: { fontSize: 11, fontWeight: '900', color: '#534AB7' },
  seatStateDisabled: { color: '#64748B' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  pageButton: { minWidth: 58, paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: '#D8D4FF', backgroundColor: '#FFFFFF', alignItems: 'center' },
  pageButtonDisabled: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  pageButtonText: { color: '#534AB7', fontSize: 12, fontWeight: '900' },
  pageButtonTextDisabled: { color: '#94A3B8' },
  pageText: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  resale: { backgroundColor: '#1A1A2E', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resaleIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(168,156,247,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resaleCopy: { flex: 1, minWidth: 0 },
  resaleTitle: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  resaleSub: { fontSize: 10, color: 'rgba(255,255,255,0.58)', lineHeight: 14, fontWeight: '700' },
  resaleCount: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  stickyBuy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 35,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  buyPrice: { width: 112 },
  buyLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', marginBottom: 3 },
  buyValue: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  buyButton: { flex: 1, height: 52, borderRadius: 17, backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...shadow },
  buyButtonDisabled: { opacity: 0.55 },
  buyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  empty: { color: '#94A3B8', paddingVertical: 18, textAlign: 'center', fontWeight: '800' },
});
