import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import { formatEventDate } from '../lib/ticketDisplay';
import type { EventDetail, ResaleListing, UserProfile } from '../types/api';

type SortMode = 'latest' | 'priceAsc' | 'priceDesc';
type ScopeMode = 'all' | 'mine';

type ResaleEventGroup = {
  eventId: string;
  event?: EventDetail;
  listings: ResaleListing[];
};

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'latest', label: '최신순' },
  { id: 'priceAsc', label: '낮은 가격순' },
  { id: 'priceDesc', label: '높은 가격순' },
];

function listingKey(item: ResaleListing) {
  return String(item.id ?? item.listingId);
}

function eventTitleOf(item: ResaleListing, eventMap: Record<string, EventDetail>) {
  const event = eventMap[String(item.eventId)];
  return item.eventName || event?.name || event?.title || '이벤트명 확인 중';
}

function groupTitleOf(group: ResaleEventGroup) {
  return group.event?.name || group.event?.title || group.listings[0]?.eventName || '이벤트명 확인 중';
}

function eventDateOf(item: ResaleListing, eventMap: Record<string, EventDetail>) {
  const event = eventMap[String(item.eventId)];
  return event?.eventAt || event?.eventDateTime || item.createdAt || '';
}

function groupDateOf(group: ResaleEventGroup) {
  return group.event?.eventAt || group.event?.eventDateTime || group.listings[0]?.createdAt || '';
}

function seatLabelOf(item: ResaleListing) {
  return item.seatInfo ? `좌석 ${item.seatInfo}` : `티켓 ${String(item.ticketId).slice(0, 8)}`;
}

function statusLabelOf(status?: string) {
  const normalized = String(status ?? '').toUpperCase();
  if (['ACTIVE', 'LISTED', 'OPEN', 'ON_SALE'].includes(normalized)) return '판매중';
  if (['SOLD', 'COMPLETED', 'PURCHASED'].includes(normalized)) return '판매완료';
  if (['CANCELED', 'CANCELLED', 'CLOSED'].includes(normalized)) return '취소됨';
  if (normalized === 'EXPIRED') return '만료됨';
  return status || '-';
}

function priceValueOf(item: ResaleListing) {
  try {
    return BigInt(item.priceWei ?? item.price ?? '0');
  } catch {
    return BigInt(0);
  }
}

function minPriceOf(listings: ResaleListing[]) {
  const [first] = [...listings].sort((a, b) => (
    priceValueOf(a) < priceValueOf(b) ? -1 : priceValueOf(a) > priceValueOf(b) ? 1 : 0
  ));

  return first?.priceWei ?? first?.price ?? '-';
}

function sortListings(listings: ResaleListing[], sortMode: SortMode) {
  return [...listings].sort((a, b) => {
    if (sortMode === 'priceAsc') {
      return priceValueOf(a) < priceValueOf(b) ? -1 : priceValueOf(a) > priceValueOf(b) ? 1 : 0;
    }
    if (sortMode === 'priceDesc') {
      return priceValueOf(a) > priceValueOf(b) ? -1 : priceValueOf(a) < priceValueOf(b) ? 1 : 0;
    }

    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
}

function isMine(listing: ResaleListing, me: UserProfile | null) {
  if (!me?.id) return false;
  return listing.sellerId === me.id || listing.buyerId === me.id;
}

export default function ResaleListPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId;
  const initialScope = route?.params?.scope === 'mine' ? 'mine' : 'all';
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [eventMap, setEventMap] = useState<Record<string, EventDetail>>({});
  const [me, setMe] = useState<UserProfile | null>(null);
  const [eventQuery, setEventQuery] = useState('');
  const [seatQuery, setSeatQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [scope, setScope] = useState<ScopeMode>(initialScope);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setScope(initialScope);
  }, [initialScope]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profile, data] = await Promise.all([
          backendApi.getMe().catch(() => null),
          backendApi.getResaleListings({ size: 100 }),
        ]);
        setMe(profile);
        const items = data.items ?? [];
        const filteredItems = eventId ? items.filter((item) => String(item.eventId) === String(eventId)) : items;
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

        const enrichedItems = await Promise.all(
          filteredItems.map(async (item) => {
            if (item.seatInfo) return item;

            try {
              const ticket = await backendApi.getTicket(String(item.ticketId));
              return { ...item, seatInfo: ticket.seatInfo };
            } catch {
              return item;
            }
          }),
        );

        setListings(enrichedItems);
        setEventMap(Object.fromEntries(eventEntries.filter((entry): entry is readonly [string, EventDetail] => entry !== null)));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [eventId]);

  const scopedListings = useMemo(
    () => (scope === 'mine' ? listings.filter((item) => isMine(item, me)) : listings),
    [listings, me, scope],
  );

  const eventGroups = useMemo(() => {
    const groups = scopedListings.reduce<Record<string, ResaleEventGroup>>((acc, listing) => {
      const id = String(listing.eventId);
      acc[id] = acc[id] ?? { eventId: id, event: eventMap[id], listings: [] };
      acc[id].listings.push(listing);
      return acc;
    }, {});

    const normalizedQuery = eventQuery.trim().toLowerCase();
    return Object.values(groups)
      .filter((group) => !normalizedQuery || groupTitleOf(group).toLowerCase().includes(normalizedQuery))
      .sort((a, b) => groupTitleOf(a).localeCompare(groupTitleOf(b)));
  }, [eventMap, eventQuery, scopedListings]);

  const visibleListings = useMemo(() => {
    const normalizedQuery = seatQuery.trim().toLowerCase();
    const filtered = scopedListings.filter((item) => {
      if (!normalizedQuery) return true;
      return seatLabelOf(item).toLowerCase().includes(normalizedQuery);
    });

    return sortListings(filtered, sortMode);
  }, [scopedListings, seatQuery, sortMode]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (!eventId) {
    return (
      <View style={styles.container}>
        <FlatList
          data={eventGroups}
          keyExtractor={(item) => item.eventId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={(
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{scope === 'mine' ? '내 리셀 티켓' : '리셀 가능한 이벤트'}</Text>
              <Text style={styles.headerDescription}>리셀 티켓이 등록된 이벤트를 선택해 티켓을 확인하세요.</Text>
              <View style={styles.filterRow}>
                {[
                  { id: 'all', label: '전체' },
                  { id: 'mine', label: '내 리셀' },
                ].map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.filterChip, scope === item.id && styles.activeFilterChip]} onPress={() => setScope(item.id as ScopeMode)}>
                    <Text style={[styles.filterText, scope === item.id && styles.activeFilterText]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.searchInput} value={eventQuery} onChangeText={setEventQuery} placeholder="이벤트명 검색" returnKeyType="search" />
            </View>
          )}
          renderItem={({ item }) => {
            const event = item.event;
            return (
              <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ResaleList', { eventId: item.eventId, scope })}>
                <View style={styles.cardHeader}>
                  <Text style={styles.status}>{item.listings.length}개 리셀 티켓</Text>
                  <Text style={styles.price}>최저 {minPriceOf(item.listings)} WEI</Text>
                </View>
                <Text style={styles.title}>{groupTitleOf(item)}</Text>
                <Text style={styles.meta}>{formatEventDate(groupDateOf(item))}</Text>
                <Text style={styles.meta}>{[event?.category, event?.venue].filter(Boolean).join(' · ') || '이벤트 정보 확인 중'}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>표시할 리셀 티켓이 없습니다.</Text>}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleListings}
        keyExtractor={listingKey}
        contentContainerStyle={styles.list}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={styles.headerTitle}>이 이벤트의 리셀 티켓</Text>
            <Text style={styles.headerDescription}>선택한 이벤트에 등록된 리셀 티켓입니다.</Text>
            <View style={styles.filterRow}>
              {[
                { id: 'all', label: '전체' },
                { id: 'mine', label: '내 리셀' },
              ].map((item) => (
                <TouchableOpacity key={item.id} style={[styles.filterChip, scope === item.id && styles.activeFilterChip]} onPress={() => setScope(item.id as ScopeMode)}>
                  <Text style={[styles.filterText, scope === item.id && styles.activeFilterText]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.searchInput} value={seatQuery} onChangeText={setSeatQuery} placeholder="좌석 검색: A-12, VIP-3" returnKeyType="search" />
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity key={option.id} style={[styles.sortChip, sortMode === option.id && styles.activeSortChip]} onPress={() => setSortMode(option.id)}>
                  <Text style={[styles.sortText, sortMode === option.id && styles.activeSortText]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ResaleDetail', { listingId: item.id ?? item.listingId })}>
            <View style={styles.cardHeader}>
              <Text style={styles.status}>{statusLabelOf(item.status)}</Text>
              <Text style={styles.price}>{item.priceWei ?? item.price} WEI</Text>
            </View>
            <Text style={styles.title}>{seatLabelOf(item)}</Text>
            <Text style={styles.meta}>{eventTitleOf(item, eventMap)}</Text>
            <Text style={styles.meta}>{formatEventDate(eventDateOf(item, eventMap))}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>조건에 맞는 리셀 티켓이 없습니다.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 96 },
  header: { marginBottom: 14 },
  headerTitle: { color: '#0F172A', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  headerDescription: { color: '#64748B', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  searchInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 13, marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  activeFilterText: { color: '#2563EB' },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeSortChip: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  sortText: { color: '#475569', fontSize: 12, fontWeight: '800' },
  activeSortText: { color: '#2563EB' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  status: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  price: { color: '#0F172A', fontWeight: '900' },
  title: { color: '#0F172A', fontSize: 17, fontWeight: '900', marginBottom: 7 },
  meta: { color: '#64748B', fontSize: 13, marginBottom: 3 },
  empty: { textAlign: 'center', color: '#94A3B8', paddingVertical: 100, fontWeight: '800' },
});
