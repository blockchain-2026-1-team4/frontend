import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventSummary } from '../types/api';

const CATEGORIES = [
  { id: 'ALL', label: '전체', icon: '🎟️' },
  { id: 'CONCERT', label: '콘서트', icon: '🎸' },
  { id: 'SPORTS', label: '스포츠', icon: '⚽' },
  { id: 'EXHIBITION', label: '전시', icon: '🎨' },
  { id: 'THEATER', label: '뮤지컬', icon: '🎭' },
];

export default function UserHomePage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const loadEvents = async (search?: string, category?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.query = search;
      if (category && category !== 'ALL') params.category = category;
      
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

  const renderEventItem = ({ item }: { item: EventSummary }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
    >
      <View style={styles.cardImagePlaceholder}>
        <Text style={{ fontSize: 32 }}>🎟️</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardCategory}>{item.category}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardVenue}>{item.venue}</Text>
        <Text style={styles.cardDate}>
          {new Date(item.eventDateTime).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="이벤트를 찾아보세요"
          onSubmitEditing={() => loadEvents(keyword, selectedCategory)}
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => loadEvents(keyword, selectedCategory)}>
          <Text style={styles.searchButtonText}>검색</Text>
        </TouchableOpacity>
      </View>

      {/* Category List */}
      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryItem,
                selectedCategory === cat.id && styles.selectedCategoryItem
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text style={[
                styles.categoryLabel,
                selectedCategory === cat.id && styles.selectedCategoryLabel
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>해당하는 이벤트가 없습니다.</Text>
            </View>
          }
        />
      )}

      {/* Footer Nav */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('ResaleList')}>
          <Text style={styles.navIcon}>🔄</Text>
          <Text style={styles.navText}>리셀</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navText, { color: '#007AFF' }]}>홈</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('MyTickets')}>
          <Text style={styles.navIcon}>🎟️</Text>
          <Text style={styles.navText}>티켓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('MyPage')}>
          <Text style={styles.navIcon}>👤</Text>
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
  searchInput: { flex: 1, backgroundColor: '#f5f5f5', padding: 10, borderRadius: 8 },
  searchButton: { backgroundColor: '#007AFF', paddingHorizontal: 15, borderRadius: 8, justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontWeight: 'bold' },
  categoryWrapper: { paddingVertical: 10, backgroundColor: '#fff' },
  categoryList: { paddingHorizontal: 15, gap: 15 },
  categoryItem: { alignItems: 'center', minWidth: 60, padding: 8, borderRadius: 12 },
  selectedCategoryItem: { backgroundColor: '#e7f3ff' },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryLabel: { fontSize: 12, color: '#666' },
  selectedCategoryLabel: { color: '#007AFF', fontWeight: 'bold' },
  list: { padding: 15 },
  listHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, overflow: 'hidden', borderWeight: 1, borderColor: '#eee', borderWidth: 1 },
  cardImagePlaceholder: { width: 100, height: 100, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, padding: 12 },
  cardCategory: { fontSize: 10, color: '#007AFF', fontWeight: 'bold', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardVenue: { fontSize: 13, color: '#666', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#999' },
  emptyContainer: { paddingVertical: 100, alignItems: 'center' },
  emptyText: { color: '#999' },
  footer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingBottom: 20, paddingTop: 10 },
  navButton: { flex: 1, alignItems: 'center' },
  navIcon: { fontSize: 20, marginBottom: 4 },
  navText: { fontSize: 11, color: '#999' },
});
