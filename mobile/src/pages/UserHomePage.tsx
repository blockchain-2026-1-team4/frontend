import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { backendApi } from '../lib/backend';
import { formatEventCategory, formatEventDate, getEventDisplayStatus, getNextRoundTime, operationSortRank, getUserEventDisplayStatus, formatNextRoundLabel, weiToEth, userSortRank } from '../lib/ticketDisplay';
import type { EventSummary } from '../types/api';

const CATEGORIES = [
  { id: 'ALL', label: '전체' },
  { id: 'CONCERT', label: '공연' },
  { id: 'SPORTS', label: '스포츠' },
  { id: 'EXHIBITION', label: '전시' },
  { id: 'FESTIVAL', label: '페스티벌' },
  { id: 'ETC', label: '기타' },
];

function eventName(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

export default function UserHomePage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const sortedEvents = useMemo(() => {
    // 사용자에게 노출할 수 있는 이벤트만 남기고, 사용자 우선순위로 정렬
    const visible = events.filter((e) => getUserEventDisplayStatus(e) !== null);
    return [...visible].sort((left, right) => {
      const rankDiff = userSortRank(left) - userSortRank(right);
      if (rankDiff !== 0) return rankDiff;
      const leftTime = getNextRoundTime(left);
      const rightTime = getNextRoundTime(right);
      return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime) - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
    });
  }, [events]);

  const loadEvents = async (search = keyword, category = selectedCategory) => {
    setLoading(true);
    try {
      const params: { query?: string; category?: string; size?: number } = { size: 30 };
      if (search.trim()) params.query = search.trim();
      if (category !== 'ALL') params.category = category;
      const data = await backendApi.getEvents(params);
      setEvents(data.items ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents(keyword, selectedCategory);
  }, [selectedCategory]);

  const submitSearch = () => {
    navigation.navigate('EventList', {
      query: keyword.trim(),
      category: selectedCategory === 'ALL' ? undefined : selectedCategory,
    });
  };

  const renderEventItem = ({ item }: { item: EventSummary }) => {
    const userStatus = getUserEventDisplayStatus(item);
    const badgeLabel = userStatus?.label;
    const hideForUser = userStatus === null;

    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}>
        {(item as any).imageUrl ? (
          <Image source={{ uri: (item as any).imageUrl }} style={styles.poster} resizeMode="cover" />
        ) : null}

        <Text style={styles.cardTitle} numberOfLines={2}>{eventName(item)}</Text>

        <View style={styles.metaTop}>
          <Text style={styles.category}>{formatEventCategory(item.category)}</Text>
          {!hideForUser && badgeLabel ? <Text style={styles.status}>{badgeLabel}</Text> : null}
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.meta}>{item.venue || '-'}</Text>
          <Text style={styles.meta}>{formatNextRoundLabel(item)}</Text>
        </View>

        <View style={styles.actionRow}>
          <Text style={styles.price}>{weiToEth(item.ticketPriceWei) === '-' ? '가격 정보 없음' : `${weiToEth(item.ticketPriceWei)}`}</Text>
          <Text style={styles.actionText}>상세 보기</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterPanel}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="이벤트를 검색하세요"
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={submitSearch}>
            <Text style={styles.searchButtonText}>검색</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryItem, selectedCategory === cat.id && styles.selectedCategoryItem]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.categoryLabel, selectedCategory === cat.id && styles.selectedCategoryLabel]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={sortedEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEventItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.listHeader}>진행 중인 이벤트</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>표시할 이벤트가 없습니다.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterPanel: { backgroundColor: '#FFFFFF', padding: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  searchContainer: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 12, color: '#0F172A' },
  searchButton: { backgroundColor: '#2563EB', paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontWeight: '900' },
  categoryList: { paddingTop: 12, gap: 8 },
  categoryItem: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  selectedCategoryItem: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  categoryLabel: { fontSize: 13, color: '#475569', fontWeight: '800' },
  selectedCategoryLabel: { color: '#2563EB' },
  list: { padding: 16, paddingBottom: 96 },
  listHeader: { fontSize: 18, fontWeight: '900', marginBottom: 14, color: '#0F172A' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, padding: 16, borderColor: '#E2E8F0', borderWidth: 1 },
  poster: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  metaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  category: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  status: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#EFF6FF', color: '#2563EB', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  cardTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10, color: '#0F172A', lineHeight: 24 },
  metaBlock: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  meta: { fontSize: 13, color: '#64748B', marginBottom: 3 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  price: { color: '#0F172A', fontSize: 13, fontWeight: '800', flex: 1, paddingRight: 8 },
  actionText: { color: '#2563EB', fontWeight: '900' },
  emptyText: { paddingVertical: 80, textAlign: 'center', color: '#94A3B8', fontWeight: '800' },
});
