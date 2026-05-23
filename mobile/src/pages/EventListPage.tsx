import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import { formatEventDate } from '../lib/ticketDisplay';
import type { EventSummary } from '../types/api';

const CATEGORIES = [
  { id: 'ALL', label: '전체' },
  { id: 'CONCERT', label: '콘서트' },
  { id: 'SPORTS', label: '스포츠' },
  { id: 'EXHIBITION', label: '전시' },
  { id: 'FESTIVAL', label: '페스티벌' },
] as const;

const STATUS_FILTERS = [
  { id: 'ALL', label: '전체' },
  { id: 'ACTIVE', label: '예매 가능' },
  { id: 'INACTIVE', label: '준비 중' },
] as const;

function eventName(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function eventStatus(status?: string) {
  if (status === 'ACTIVE') return '예매 가능';
  if (status === 'INACTIVE') return '준비 중';
  if (status === 'CANCELED' || status === 'CANCELLED') return '취소됨';
  return status || '-';
}

export default function EventListPage({ navigation, route }: any) {
  const initialCategory = route?.params?.category ?? 'ALL';
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [query, setQuery] = useState(route?.params?.query ?? '');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_FILTERS)[number]['id']>('ALL');
  const [loading, setLoading] = useState(true);

  const loadEvents = async (nextQuery = query, nextCategory = selectedCategory) => {
    setLoading(true);
    try {
      const data = await backendApi.getEvents({
        query: nextQuery.trim() || undefined,
        category: nextCategory === 'ALL' ? undefined : nextCategory,
        size: 50,
      });
      setEvents(data.items ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents(query, selectedCategory);
  }, [selectedCategory]);

  const visibleEvents = useMemo(() => {
    if (selectedStatus === 'ALL') return events;
    return events.filter((event) => event.status === selectedStatus);
  }, [events, selectedStatus]);

  const renderEvent = ({ item }: { item: EventSummary }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}>
      <View style={styles.cardHeader}>
        <Text style={styles.category}>{item.category || 'EVENT'}</Text>
        <Text style={styles.status}>{eventStatus(item.status)}</Text>
      </View>
      <Text style={styles.title}>{eventName(item)}</Text>
      <View style={styles.metaBlock}>
        <Text style={styles.meta}>{item.venue || '-'}</Text>
        <Text style={styles.meta}>{formatEventDate(item.eventAt || item.eventDateTime)}</Text>
      </View>
      <View style={styles.actionRow}>
        <Text style={styles.price}>{item.ticketPriceWei ? `${item.ticketPriceWei} WEI` : '가격 정보 없음'}</Text>
        <Text style={styles.actionText}>상세 보기</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterPanel}>
        <Text style={styles.screenTitle}>이벤트 검색 결과</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="이벤트명, 장소 검색"
            returnKeyType="search"
            onSubmitEditing={() => loadEvents()}
          />
          <TouchableOpacity style={styles.button} onPress={() => loadEvents()}>
            <Text style={styles.buttonText}>검색</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.filterChip, selectedCategory === item.id && styles.activeFilterChip]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text style={[styles.filterText, selectedCategory === item.id && styles.activeFilterText]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.statusRow}>
          {STATUS_FILTERS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.statusChip, selectedStatus === item.id && styles.activeStatusChip]}
              onPress={() => setSelectedStatus(item.id)}
            >
              <Text style={[styles.statusText, selectedStatus === item.id && styles.activeStatusText]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <FlatList
          data={visibleEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.resultText}>검색 결과 {visibleEvents.length}건</Text>}
          renderItem={renderEvent}
          ListEmptyComponent={<Text style={styles.empty}>조건에 맞는 이벤트가 없습니다.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterPanel: { backgroundColor: '#FFFFFF', padding: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  screenTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, color: '#0F172A' },
  button: { backgroundColor: '#2563EB', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '900' },
  filterRow: { gap: 8, paddingTop: 12 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  activeFilterText: { color: '#2563EB' },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statusChip: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 9, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeStatusChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  statusText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  activeStatusText: { color: '#2563EB' },
  list: { padding: 16, paddingBottom: 96 },
  resultText: { color: '#64748B', fontSize: 12, fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, padding: 16, borderColor: '#E2E8F0', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  category: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  status: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#EFF6FF', color: '#2563EB', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  title: { fontSize: 18, fontWeight: '900', marginBottom: 10, color: '#0F172A', lineHeight: 24 },
  metaBlock: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  meta: { fontSize: 13, color: '#64748B', marginBottom: 3 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  price: { color: '#0F172A', fontSize: 13, fontWeight: '800', flex: 1, paddingRight: 8 },
  actionText: { color: '#2563EB', fontWeight: '900' },
  empty: { textAlign: 'center', color: '#94A3B8', paddingVertical: 80, fontWeight: '800' },
});
