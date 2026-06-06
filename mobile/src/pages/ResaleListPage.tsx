import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from '../components/TextInput';
import { FlowBadge, FlowHero, IconButton, PosterArt, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { backendApi } from '../lib/backend';
import { showDialog } from '../lib/dialog';
import {
  compactId,
  eventDateLabel,
  eventVenue,
  formatDateTime,
  isEventEnded,
  weiToEthLabel,
} from '../lib/ticketFlowDisplay';
import type { EventDetail, ResaleListing, UserProfile } from '../types/api';

type EventFilter = 'all' | 'excludeMine';
type EventSortMode = 'latest' | 'priceAsc' | 'closingSoon';
type TicketSortMode = 'latest' | 'priceAsc' | 'closingSoon';

type ResaleListingView = ResaleListing & {
  originalPriceWei?: string;
  sectionName?: string;
  saleEndAt?: string;
};

type ResaleEventGroup = {
  eventId: string;
  event?: EventDetail;
  listings: ResaleListingView[];
};

const EVENT_FILTERS: { id: EventFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'excludeMine', label: '내 리셀 제외' },
];

const EVENT_SORTS: { id: EventSortMode; label: string }[] = [
  { id: 'latest', label: '최신 등록순' },
  { id: 'priceAsc', label: '낮은 가격순' },
  { id: 'closingSoon', label: '마감 임박순' },
];

const TICKET_SORTS: { id: TicketSortMode; label: string }[] = [
  { id: 'latest', label: '최신순' },
  { id: 'priceAsc', label: '낮은 가격순' },
  { id: 'closingSoon', label: '마감 임박순' },
];

function listingKey(item: ResaleListing) {
  return String(item.id ?? item.listingId ?? item.ticketId);
}

function priceValueOf(item: ResaleListing) {
  try {
    return BigInt(item.priceWei ?? item.price ?? '0');
  } catch {
    return 0n;
  }
}

function eventDateOf(event?: EventDetail, listing?: ResaleListing) {
  return event?.eventAt || event?.eventStartAt || event?.startsAt || event?.eventDateTime || listing?.createdAt;
}

function saleEndOf(event?: EventDetail, listing?: ResaleListingView) {
  return listing?.saleEndAt || event?.resaleEnd || event?.primarySaleEnd || event?.salesEndAt || eventDateOf(event, listing);
}

function groupTitleOf(group: ResaleEventGroup) {
  return group.event?.name || group.event?.title || group.listings[0]?.eventName || '이벤트명 확인 중';
}

function groupVenueOf(group: ResaleEventGroup) {
  return eventVenue(group.event, undefined);
}

function groupDateOf(group: ResaleEventGroup) {
  return eventDateOf(group.event, group.listings[0]);
}

function minListingOf(listings: ResaleListingView[]) {
  return [...listings].sort((a, b) => (
    priceValueOf(a) < priceValueOf(b) ? -1 : priceValueOf(a) > priceValueOf(b) ? 1 : 0
  ))[0];
}

function statusLabel(status?: string) {
  const normalized = String(status ?? '').toUpperCase();
  if (['ACTIVE', 'LISTED', 'OPEN', 'ON_SALE'].includes(normalized)) return '판매중';
  if (['SOLD', 'COMPLETED', 'PURCHASED'].includes(normalized)) return '판매완료';
  if (['CLOSED', 'EXPIRED'].includes(normalized)) return '판매종료';
  if (normalized === 'CANCELED') return '취소됨';
  return status || '-';
}

function statusTone(status?: string): 'green' | 'gray' | 'red' | 'purple' {
  const label = statusLabel(status);
  if (label === '판매중') return 'green';
  if (label === '취소됨') return 'red';
  if (label === '판매완료' || label === '판매종료') return 'gray';
  return 'purple';
}

function seatLabelOf(item: ResaleListingView) {
  return item.seatInfo ? `${item.sectionName ? `${item.sectionName}-` : ''}${item.seatInfo}` : `티켓 ${compactId(item.ticketId, 6, 4)}`;
}

function sellerLabelOf(item: ResaleListing) {
  return item.sellerDisplayName || compactId(item.sellerId, 6, 4) || '판매자 확인 중';
}

function isMine(listing: ResaleListing, me: UserProfile | null) {
  return Boolean(me?.id && listing.sellerId === me.id);
}

function eventMatchesQuery(group: ResaleEventGroup, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [groupTitleOf(group), groupVenueOf(group)].some((value) => value.toLowerCase().includes(normalized));
}

function ticketMatchesQuery(item: ResaleListingView, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return seatLabelOf(item).toLowerCase().includes(normalized);
}

function FilterRow<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {items.map((item) => {
        const active = value === item.id;
        return (
          <TouchableOpacity key={item.id} style={[styles.filter, active && styles.filterActive]} onPress={() => onChange(item.id)} activeOpacity={0.86}>
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function SeatVisual() {
  return (
    <View style={styles.seatVisual}>
      <View style={styles.seatRingOuter} />
      <View style={styles.seatRingInner} />
      <View style={styles.seatCore} />
    </View>
  );
}

export default function ResaleListPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId ? String(route.params.eventId) : '';
  const [listings, setListings] = useState<ResaleListingView[]>([]);
  const [eventMap, setEventMap] = useState<Record<string, EventDetail>>({});
  const [me, setMe] = useState<UserProfile | null>(null);
  const [eventQuery, setEventQuery] = useState('');
  const [seatQuery, setSeatQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [eventSort, setEventSort] = useState<EventSortMode>('latest');
  const [ticketSort, setTicketSort] = useState<TicketSortMode>('latest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profile, data] = await Promise.all([
          backendApi.getMe().catch(() => null),
          backendApi.getResaleListings({ size: 100 }),
        ]);
        setMe(profile);

        const baseItems = data.items ?? [];
        const filteredItems = eventId ? baseItems.filter((item) => String(item.eventId) === eventId) : baseItems;
        const uniqueEventIds = Array.from(new Set(filteredItems.map((item) => String(item.eventId)).filter(Boolean)));
        const eventEntries = await Promise.all(
          uniqueEventIds.map(async (id) => {
            try {
              return [id, await backendApi.getEvent(id)] as const;
            } catch {
              return null;
            }
          }),
        );

        const nextEventMap = Object.fromEntries(eventEntries.filter((entry): entry is readonly [string, EventDetail] => entry !== null));
        const enrichedItems = await Promise.all(
          filteredItems.map(async (item) => {
            try {
              const ticket = await backendApi.getTicket(String(item.ticketId));
              return {
                ...item,
                seatInfo: item.seatInfo || ticket.seatInfo,
                sectionName: ticket.sectionName,
                originalPriceWei: ticket.originalPriceWei || ticket.priceWei,
                saleEndAt: ticket.saleEndAt,
              };
            } catch {
              return item;
            }
          }),
        );

        const activeItems = enrichedItems.filter((item) => !isEventEnded(nextEventMap[String(item.eventId)]));
        const endedCount = enrichedItems.length - activeItems.length;
        setListings(activeItems);
        setEventMap(nextEventMap);
        if (endedCount > 0) {
          showDialog('판매 종료', `${endedCount}개의 리셀 티켓은 공연이 종료되어 리셀마켓에서 내려갔습니다.`);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [eventId]);

  const eventGroups = useMemo(() => {
    const groups = listings.reduce<Record<string, ResaleEventGroup>>((acc, listing) => {
      const id = String(listing.eventId);
      acc[id] = acc[id] ?? { eventId: id, event: eventMap[id], listings: [] };
      acc[id].listings.push(listing);
      return acc;
    }, {});

    return Object.values(groups)
      .map((group) => ({
        ...group,
        listings: eventFilter === 'excludeMine' ? group.listings.filter((item) => !isMine(item, me)) : group.listings,
      }))
      .filter((group) => group.listings.length > 0)
      .filter((group) => eventMatchesQuery(group, eventQuery))
      .sort((a, b) => {
        if (eventSort === 'priceAsc') return priceValueOf(minListingOf(a.listings)) < priceValueOf(minListingOf(b.listings)) ? -1 : 1;
        if (eventSort === 'closingSoon') return new Date(groupDateOf(a) ?? 0).getTime() - new Date(groupDateOf(b) ?? 0).getTime();
        return new Date(groupDateOf(b) ?? 0).getTime() - new Date(groupDateOf(a) ?? 0).getTime();
      });
  }, [eventFilter, eventSort, eventMap, eventQuery, listings, me]);

  const visibleListings = useMemo(() => {
    const sorted = listings
      .filter((item) => ticketMatchesQuery(item, seatQuery))
      .map((item) => ({ ...item, saleEndAt: saleEndOf(eventMap[String(item.eventId)], item) }));

    return sorted.sort((a, b) => {
      if (ticketSort === 'priceAsc') return priceValueOf(a) < priceValueOf(b) ? -1 : priceValueOf(a) > priceValueOf(b) ? 1 : 0;
      if (ticketSort === 'closingSoon') return new Date(a.saleEndAt ?? 0).getTime() - new Date(b.saleEndAt ?? 0).getTime();
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }, [eventMap, listings, seatQuery, ticketSort]);

  const selectedEvent = eventId ? eventMap[eventId] : undefined;
  const titleForHero = selectedEvent?.name || selectedEvent?.title || visibleListings[0]?.eventName || '리셀 티켓';
  const minListing = minListingOf(visibleListings);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /></View>;

  if (!eventId) {
    return (
      <View style={styles.container}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MyPage'))} activeOpacity={0.84}>
            <IconButton><TicketIcon name="arrowLeft" size={20} /></IconButton>
          </TouchableOpacity>
          <View style={styles.topTitleWrap}>
            <Text style={styles.eyebrow}>Resale Market</Text>
            <Text style={styles.topTitle}>리셀 가능한 이벤트</Text>
          </View>
          <TouchableOpacity onPress={() => showDialog('준비 중', '리셀 필터는 준비 중입니다.')} activeOpacity={0.84}>
            <IconButton><TicketIcon name="adjustments" size={20} /></IconButton>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FlowHero
            height={176}
            style={styles.hero}
            badge="공식 리셀 마켓"
            title={'검증된 리셀 티켓을\n안전하게 거래하세요.'}
            meta="소유권과 가격 정책이 확인된 이벤트만 표시됩니다."
          />

          <View style={styles.section}>
            <View style={styles.search}>
              <TicketIcon name="search" size={19} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                value={eventQuery}
                onChangeText={setEventQuery}
                placeholder="이벤트명, 장소 검색"
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
              />
            </View>
          </View>

          <FilterRow items={EVENT_FILTERS} value={eventFilter} onChange={setEventFilter} />
          <FilterRow items={EVENT_SORTS} value={eventSort} onChange={setEventSort} />

          <View style={[styles.section, styles.headSection]}>
            <View>
              <Text style={styles.headTitle}>추천 리셀 이벤트</Text>
              <Text style={styles.headSub}>가격과 잔여 티켓을 먼저 확인하세요.</Text>
            </View>
          </View>

          {eventGroups.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotStrip}>
              {eventGroups.slice(0, 4).map((group, index) => (
                <TouchableOpacity key={`hot-${group.eventId}`} style={styles.hot} onPress={() => navigation.navigate('ResaleList', { eventId: group.eventId })} activeOpacity={0.86}>
                  <PosterArt title={groupTitleOf(group)} variant={index} style={styles.hotImg} />
                  <View style={styles.hotBody}>
                    <Text style={styles.hotName} numberOfLines={2}>{groupTitleOf(group)}</Text>
                    <Text style={styles.hotPrice}>{weiToEthLabel(minListingOf(group.listings)?.priceWei ?? minListingOf(group.listings)?.price)}~</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.eventList}>
            {eventGroups.map((group, index) => {
              const lowest = minListingOf(group.listings);
              return (
                <TouchableOpacity key={group.eventId} style={styles.eventCard} onPress={() => navigation.navigate('ResaleList', { eventId: group.eventId })} activeOpacity={0.88}>
                  <PosterArt title={groupTitleOf(group)} variant={index} style={styles.poster} />
                  <View style={styles.eventInfo}>
                    <View style={styles.eventTop}>
                      <FlowBadge label={`${group.listings.length}개 판매중`} tone="green" />
                      <Text style={styles.price}>{weiToEthLabel(lowest?.priceWei ?? lowest?.price)}</Text>
                    </View>
                    <Text style={styles.name} numberOfLines={2}>{groupTitleOf(group)}</Text>
                    <Text style={styles.meta} numberOfLines={2}>{groupVenueOf(group)} · {eventDateLabel(group.event, undefined)}</Text>
                    <View style={styles.eventFoot}>
                      <Text style={styles.meta} numberOfLines={1}>{seatLabelOf(lowest)}</Text>
                      <FlowBadge label="티켓 보기" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {!eventGroups.length ? <Text style={styles.empty}>표시할 리셀 이벤트가 없습니다.</Text> : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.navigate('ResaleList')} activeOpacity={0.84}>
          <IconButton><TicketIcon name="arrowLeft" size={20} /></IconButton>
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <Text style={styles.eyebrow}>Resale Tickets</Text>
          <Text style={styles.topTitle}>이 이벤트의 리셀 티켓</Text>
        </View>
        <IconButton><TicketIcon name="search" size={20} /></IconButton>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FlowHero
          height={176}
          style={styles.hero}
          badge={titleForHero}
          title={'판매 중인 좌석을\n선택하세요.'}
          meta={`판매중 ${visibleListings.length}개 · 최저가 ${weiToEthLabel(minListing?.priceWei ?? minListing?.price)} · ${eventVenue(selectedEvent, undefined)}`}
        />

        <View style={styles.section}>
          <View style={styles.search}>
            <TicketIcon name="search" size={19} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              value={seatQuery}
              onChangeText={setSeatQuery}
              placeholder="좌석 검색: R-1, VIP-3"
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
            />
          </View>
        </View>

        <FilterRow items={TICKET_SORTS} value={ticketSort} onChange={setTicketSort} />

        <View style={styles.ticketList}>
          {visibleListings.map((item) => {
            const event = eventMap[String(item.eventId)];
            return (
              <TouchableOpacity key={listingKey(item)} style={styles.ticketCard} onPress={() => navigation.navigate('ResaleDetail', { listingId: item.id ?? item.listingId })} activeOpacity={0.88}>
                <SeatVisual />
                <View style={styles.ticketInfo}>
                  <View style={styles.ticketTop}>
                    <FlowBadge label={statusLabel(item.status)} tone={statusTone(item.status)} />
                    <Text style={styles.price}>{weiToEthLabel(item.priceWei ?? item.price)}</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{seatLabelOf(item)}</Text>
                  <Text style={styles.meta}>
                    원가 {weiToEthLabel(item.originalPriceWei)} · 판매 종료 {formatDateTime(saleEndOf(event, item))}
                  </Text>
                  <View style={styles.seller}>
                    <View style={styles.sellerAvatar}>
                      <TicketIcon name="user" size={12} color="#534AB7" />
                    </View>
                    <Text style={styles.sellerText} numberOfLines={1}>판매자 {sellerLabelOf(item)}</Text>
                  </View>
                  <View style={styles.dealButton}>
                    <Text style={styles.dealText}>거래 상세 보기</Text>
                    <TicketIcon name="chevron" size={15} color="#534AB7" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          {!visibleListings.length ? <Text style={styles.empty}>조건에 맞는 리셀 티켓이 없습니다.</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  screen: { flex: 1 },
  content: { paddingBottom: 112 },
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
    gap: 12,
  },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0, textTransform: 'uppercase', marginBottom: 2 },
  topTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  hero: { marginHorizontal: 16, marginTop: 14, marginBottom: 14 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  search: { height: 46, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13 },
  searchInput: { flex: 1, height: 44, color: '#0F172A', fontSize: 13, fontWeight: '700', padding: 0, backgroundColor: 'transparent', borderWidth: 0 },
  filters: { gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  filter: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  headSection: { paddingBottom: 10 },
  headTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: 0 },
  headSub: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '700' },
  hotStrip: { gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  hot: { width: 150, flexShrink: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, overflow: 'hidden' },
  hotImg: { width: '100%', height: 100, borderRadius: 0 },
  hotBody: { padding: 10 },
  hotName: { fontSize: 12, fontWeight: '900', color: '#0F172A', lineHeight: 15, marginBottom: 4 },
  hotPrice: { fontSize: 12, fontWeight: '900', color: '#534AB7' },
  eventList: { gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  eventCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 26, padding: 12, flexDirection: 'row', gap: 12, ...flowShadow },
  poster: { width: 96, height: 128, borderRadius: 20 },
  eventInfo: { flex: 1, minWidth: 0 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8, alignItems: 'center' },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8, alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '900', lineHeight: 21, color: '#0F172A', letterSpacing: 0, marginBottom: 7 },
  meta: { fontSize: 11, color: '#64748B', lineHeight: 17, fontWeight: '700' },
  price: { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  eventFoot: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ticketList: { gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  ticketCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 12, flexDirection: 'row', gap: 12, ...flowShadow },
  ticketInfo: { flex: 1, minWidth: 0 },
  seatVisual: { width: 76, height: 76, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  seatRingOuter: { position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 5, borderColor: '#DBEAFE' },
  seatRingInner: { position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 4, borderColor: '#C7D2FE' },
  seatCore: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  seller: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  sellerAvatar: { width: 22, height: 22, borderRadius: 9, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  sellerText: { flex: 1, color: '#64748B', fontSize: 10, fontWeight: '900' },
  dealButton: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 },
  dealText: { fontSize: 12, fontWeight: '900', color: '#534AB7' },
  empty: { textAlign: 'center', color: '#94A3B8', paddingVertical: 40, fontWeight: '800' },
});
