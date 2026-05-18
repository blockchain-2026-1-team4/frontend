import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventSummary } from '../types/api';

const CATEGORIES = [
  { id: 'ALL', label: '전체' },
  { id: 'CONCERT', label: '콘서트' },
  { id: 'SPORTS', label: '스포츠' },
  { id: 'EXHIBITION', label: '전시' },
  { id: 'THEATER', label: '공연' },
];

const eventName = (event: EventSummary) => event.name || event.title || '이벤트';
const eventDate = (event: EventSummary) => event.eventAt || event.eventDateTime;

export default function UserHomePage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const loadEvents = async (search = keyword, category = selectedCategory) => {
    setLoading(true);
    try {
      const params: { query?: string; category?: string; size?: number } = { size: 10 };
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
    loadEvents(keyword, selectedCategory);
  }, [selectedCategory]);

  const submitSearch = () => {
    navigation.navigate('EventList', {
      query: keyword.trim(),
      category: selectedCategory === 'ALL' ? undefined : selectedCategory,
    });
  };

  const renderEventItem = ({ item }: { item: EventSummary }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}>
      <View style={styles.poster}>
        <Text style={styles.posterText}>{item.category?.slice(0, 2) || 'TT'}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardCategory}>{item.category || 'EVENT'}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>{eventName(item)}</Text>
        <Text style={styles.cardVenue}>{item.venue}</Text>
        <Text style={styles.cardDate}>{eventDate(item) ? new Date(eventDate(item) as string).toLocaleDateString() : '-'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
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

      <View style={styles.categoryWrapper}>
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
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEventItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.listHeader}>진행 중인 이벤트</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>표시할 이벤트가 없습니다.</Text>}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('ResaleList')}>
          <Text style={styles.navText}>리셀</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Main')}>
          <Text style={[styles.navText, styles.activeNavText]}>홈</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('MyTickets')}>
          <Text style={styles.navText}>티켓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('MyPage')}>
          <Text style={styles.navText}>마이</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', padding: 15, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchInput: { flex: 1, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8 },
  searchButton: { backgroundColor: '#007AFF', paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontWeight: 'bold' },
  categoryWrapper: { paddingVertical: 10 },
  categoryList: { paddingHorizontal: 15, gap: 10 },
  categoryItem: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F1F3F5' },
  selectedCategoryItem: { backgroundColor: '#E7F1FF' },
  categoryLabel: { fontSize: 13, color: '#495057', fontWeight: '700' },
  selectedCategoryLabel: { color: '#007AFF' },
  list: { padding: 15, paddingBottom: 90 },
  listHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#212529' },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, overflow: 'hidden', borderColor: '#eee', borderWidth: 1 },
  poster: { width: 96, height: 96, backgroundColor: '#E7F1FF', justifyContent: 'center', alignItems: 'center' },
  posterText: { color: '#007AFF', fontSize: 18, fontWeight: '900' },
  cardContent: { flex: 1, padding: 12 },
  cardCategory: { fontSize: 10, color: '#007AFF', fontWeight: 'bold', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#212529' },
  cardVenue: { fontSize: 13, color: '#666', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#999' },
  emptyText: { paddingVertical: 80, textAlign: 'center', color: '#999' },
  footer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingBottom: 20, paddingTop: 10, backgroundColor: '#fff' },
  navButton: { flex: 1, alignItems: 'center' },
  navText: { fontSize: 12, color: '#999', fontWeight: '800' },
  activeNavText: { color: '#007AFF' },
});
