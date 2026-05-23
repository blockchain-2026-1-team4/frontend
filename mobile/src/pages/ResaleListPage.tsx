import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventDetail, ResaleListing } from '../types/api';

type SortMode = 'latest' | 'priceAsc' | 'priceDesc';

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

function eventDateOf(item: ResaleListing, eventMap: Record<string, EventDetail>) {
  const event = eventMap[String(item.eventId)];
  return event?.eventAt || event?.eventDateTime || item.createdAt || '';
}

function seatLabelOf(item: ResaleListing) {
  return item.seatInfo ? `좌석 ${item.seatInfo}` : `티켓 ${String(item.ticketId).slice(0, 8)}`;
}

function statusLabelOf(status?: string) {
  const normalized = String(status ?? '').toUpperCase();
  if (['ACTIVE', 'LISTED', 'OPEN', 'ON_SALE'].includes(normalized)) return '판매중';
  if (['SOLD', 'COMPLETED', 'PURCHASED'].includes(normalized)) return '판매완료';
  if (['CANCELED', 'CANCELLED', 'CLOSED'].includes(normalized)) return '취소됨';
  if (['EXPIRED'].includes(normalized)) return '만료됨';
  return status || '-';
}

function priceValueOf(item: ResaleListing) {
  try {
    return BigInt(item.priceWei ?? item.price ?? '0');
  } catch {
    return BigInt(0);
  }
}

export default function ResaleListPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId;
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [eventMap, setEventMap] = useState<Record<string, EventDetail>>({});
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await backendApi.getResaleListings({ size: 50 });
        const items = data.items ?? [];
        // TODO: Replace client-side filtering when backend supports eventId on GET /resale-listings.
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

        setListings(filteredItems);
        setEventMap(Object.fromEntries(eventEntries.filter((entry): entry is readonly [string, EventDetail] => entry !== null)));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const visibleListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = listings.filter((item) => {
      if (!normalizedQuery) return true;

      const eventTitle = eventTitleOf(item, eventMap).toLowerCase();
      const seatLabel = seatLabelOf(item).toLowerCase();
      return eventTitle.includes(normalizedQuery) || seatLabel.includes(normalizedQuery);
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'priceAsc') {
        return priceValueOf(a) < priceValueOf(b) ? -1 : priceValueOf(a) > priceValueOf(b) ? 1 : 0;
      }
      if (sortMode === 'priceDesc') {
        return priceValueOf(a) > priceValueOf(b) ? -1 : priceValueOf(a) < priceValueOf(b) ? 1 : 0;
      }

      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }, [eventMap, listings, query, sortMode]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  const headerTitle = eventId ? '이 이벤트의 리셀 티켓' : '전체 리셀 티켓';
  const headerDescription = eventId
    ? '현재 이벤트에 등록된 리셀 티켓입니다.'
    : '현재 등록된 모든 이벤트의 리셀 티켓입니다.';

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleListings}
        keyExtractor={listingKey}
        contentContainerStyle={styles.list}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerDescription}>{headerDescription}</Text>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="이벤트명 또는 좌석 검색"
              returnKeyType="search"
            />
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.sortChip, sortMode === option.id && styles.activeSortChip]}
                  onPress={() => setSortMode(option.id)}
                >
                  <Text style={[styles.sortText, sortMode === option.id && styles.activeSortText]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const eventDate = eventDateOf(item, eventMap);

          return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ResaleDetail', { listingId: item.id ?? item.listingId })}>
              <View style={styles.cardHeader}>
                <Text style={styles.status}>{statusLabelOf(item.status)}</Text>
                <Text style={styles.price}>{item.priceWei ?? item.price} WEI</Text>
              </View>
              <Text style={styles.title}>{eventTitleOf(item, eventMap)}</Text>
              <Text style={styles.seat}>{seatLabelOf(item)}</Text>
              <Text style={styles.meta}>{eventDate ? new Date(eventDate).toLocaleString() : '-'}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>조건에 맞는 리셀 티켓이 없습니다.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  header: { marginBottom: 14 },
  headerTitle: { color: '#212529', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  headerDescription: { color: '#868E96', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 10, padding: 13, marginBottom: 10 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip: { borderWidth: 1, borderColor: '#DDE2E8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  activeSortChip: { backgroundColor: '#E7F1FF', borderColor: '#B7D7FF' },
  sortText: { color: '#495057', fontSize: 12, fontWeight: '800' },
  activeSortText: { color: '#007AFF' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  status: { color: '#007AFF', fontSize: 12, fontWeight: '900' },
  price: { color: '#212529', fontWeight: '900' },
  title: { color: '#212529', fontSize: 17, fontWeight: '900', marginBottom: 7 },
  seat: { color: '#495057', fontSize: 14, fontWeight: '800', marginBottom: 5 },
  meta: { color: '#868E96', fontSize: 13, marginBottom: 3 },
  empty: { textAlign: 'center', color: '#868E96', paddingVertical: 100 },
});
