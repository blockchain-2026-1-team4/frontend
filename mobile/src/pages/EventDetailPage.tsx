import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventDetail, ResaleListing, TicketDetail } from '../types/api';

const PRIMARY_TICKET_PAGE_SIZE = 20;
const SEAT_FILTERS = ['전체', 'A', 'B', 'C', 'D', 'VIP'];

function seatSectionOf(seatInfo?: string) {
  const normalized = String(seatInfo ?? '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.startsWith('VIP')) return 'VIP';
  return normalized.split(/[-\s]/)[0];
}

export default function EventDetailPage({ route, navigation }: any) {
  const { eventId } = route.params;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [resales, setResales] = useState<ResaleListing[]>([]);
  const [seatQuery, setSeatQuery] = useState('');
  const [selectedSeatSection, setSelectedSeatSection] = useState('전체');
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
        setEvent(eventData);
        setTickets(ticketData);
        setPrimaryTicketPage(1);
        // TODO: Replace client-side filtering when backend adds GET /resale-listings?eventId=...
        setResales((resaleData.items ?? []).filter((listing) => String(listing.eventId) === String(eventId)));
      } catch (error: any) {
        Alert.alert('오류', error.message || '이벤트 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const availableTickets = useMemo(
    () => tickets.filter((ticket) => ['ISSUED', 'AVAILABLE'].includes(String(ticket.status))),
    [tickets],
  );

  const filteredPrimaryTickets = useMemo(() => {
    const query = seatQuery.trim().toUpperCase();

    return availableTickets.filter((ticket) => {
      const seatInfo = String(ticket.seatInfo ?? '').toUpperCase();
      const matchesSection = selectedSeatSection === '전체' || seatSectionOf(ticket.seatInfo) === selectedSeatSection;
      const matchesQuery = !query || seatInfo.includes(query);
      return matchesSection && matchesQuery;
    });
  }, [availableTickets, seatQuery, selectedSeatSection]);

  const totalPrimaryTicketPages = Math.max(1, Math.ceil(filteredPrimaryTickets.length / PRIMARY_TICKET_PAGE_SIZE));
  const currentPrimaryTicketPage = Math.min(primaryTicketPage, totalPrimaryTicketPages);
  const pagedPrimaryTickets = useMemo(() => {
    const startIndex = (currentPrimaryTicketPage - 1) * PRIMARY_TICKET_PAGE_SIZE;
    return filteredPrimaryTickets.slice(startIndex, startIndex + PRIMARY_TICKET_PAGE_SIZE);
  }, [currentPrimaryTicketPage, filteredPrimaryTickets]);

  const primaryPageNumbers = useMemo(() => {
    const maxVisiblePages = 4;
    const half = Math.floor(maxVisiblePages / 2);
    const start = Math.max(1, Math.min(currentPrimaryTicketPage - half, totalPrimaryTicketPages - maxVisiblePages + 1));
    const end = Math.min(totalPrimaryTicketPages, start + maxVisiblePages - 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPrimaryTicketPage, totalPrimaryTicketPages]);

  const resetTicketPage = () => {
    setPrimaryTicketPage(1);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  if (!event) {
    return <View style={styles.center}><Text>이벤트를 찾을 수 없습니다.</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.category}>{event.category}</Text>
        <Text style={styles.title}>{event.name || event.title}</Text>
        <Text style={styles.meta}>{event.venue}</Text>
        <Text style={styles.meta}>{event.eventAt ? new Date(event.eventAt).toLocaleString() : '-'}</Text>
      </View>

      <Text style={styles.description}>{event.description || '상세 설명이 없습니다.'}</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{event.remainingTicketCount ?? '-'}</Text>
          <Text style={styles.summaryLabel}>잔여 티켓</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{event.ticketPriceWei ?? '-'}</Text>
          <Text style={styles.summaryLabel}>1차 가격(WEI)</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>1차 판매 티켓</Text>
        <Text style={styles.sectionHint}>
          {filteredPrimaryTickets.length > 0
            ? `${currentPrimaryTicketPage} / ${totalPrimaryTicketPages}페이지 · ${filteredPrimaryTickets.length}개`
            : '0개'}
        </Text>
      </View>

      <TextInput
        style={styles.seatSearchInput}
        value={seatQuery}
        onChangeText={(value) => {
          setSeatQuery(value);
          resetTicketPage();
        }}
        placeholder="좌석 검색 예: A-12, VIP-3"
        autoCapitalize="characters"
        returnKeyType="search"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seatFilterList}>
        {SEAT_FILTERS.map((section) => (
          <TouchableOpacity
            key={section}
            style={[styles.seatFilterChip, selectedSeatSection === section && styles.activeSeatFilterChip]}
            onPress={() => {
              setSelectedSeatSection(section);
              resetTicketPage();
            }}
          >
            <Text style={[styles.seatFilterText, selectedSeatSection === section && styles.activeSeatFilterText]}>
              {section}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={pagedPrimaryTickets}
        scrollEnabled={false}
        keyExtractor={(item) => String(item.id ?? item.ticketId)}
        ListEmptyComponent={<Text style={styles.empty}>조건에 맞는 1차 판매 티켓이 없습니다.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.ticketRow} onPress={() => navigation.navigate('TicketPurchase', { ticketId: item.id ?? item.ticketId, eventId })}>
            <View>
              <Text style={styles.rowTitle}>{item.seatInfo}</Text>
              <Text style={styles.rowMeta}>{item.originalPriceWei ?? item.priceWei ?? event.ticketPriceWei} WEI</Text>
            </View>
            <Text style={styles.rowAction}>예매</Text>
          </TouchableOpacity>
        )}
      />

      {filteredPrimaryTickets.length > PRIMARY_TICKET_PAGE_SIZE ? (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageNavButton, currentPrimaryTicketPage === 1 && styles.disabledPageButton]}
            disabled={currentPrimaryTicketPage === 1}
            onPress={() => setPrimaryTicketPage((page) => Math.max(1, page - 1))}
          >
            <Text style={[styles.pageNavText, currentPrimaryTicketPage === 1 && styles.disabledPageText]}>이전</Text>
          </TouchableOpacity>

          {primaryPageNumbers.map((page) => (
            <TouchableOpacity
              key={page}
              style={[styles.pageNumberButton, currentPrimaryTicketPage === page && styles.activePageNumberButton]}
              onPress={() => setPrimaryTicketPage(page)}
            >
              <Text style={[styles.pageNumberText, currentPrimaryTicketPage === page && styles.activePageNumberText]}>
                {page}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.pageNavButton, currentPrimaryTicketPage === totalPrimaryTicketPages && styles.disabledPageButton]}
            disabled={currentPrimaryTicketPage === totalPrimaryTicketPages}
            onPress={() => setPrimaryTicketPage((page) => Math.min(totalPrimaryTicketPages, page + 1))}
          >
            <Text style={[styles.pageNavText, currentPrimaryTicketPage === totalPrimaryTicketPages && styles.disabledPageText]}>다음</Text>
          </TouchableOpacity>
        </View>
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
              <Text style={styles.rowMeta}>{item.priceWei ?? item.price} WEI</Text>
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { backgroundColor: '#fff', borderRadius: 12, padding: 22, borderWidth: 1, borderColor: '#E9ECEF', marginBottom: 16 },
  category: { color: '#007AFF', fontWeight: '900', marginBottom: 8 },
  title: { fontSize: 25, fontWeight: '900', color: '#212529', marginBottom: 10 },
  meta: { color: '#495057', fontSize: 14, marginBottom: 4 },
  description: { color: '#495057', fontSize: 15, lineHeight: 22, marginBottom: 18 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E9ECEF' },
  summaryValue: { color: '#212529', fontSize: 18, fontWeight: '900' },
  summaryLabel: { color: '#868E96', fontSize: 12, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  sectionTitle: { color: '#212529', fontSize: 17, fontWeight: '900' },
  sectionHint: { color: '#868E96', fontSize: 12 },
  seatSearchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 10, padding: 13, marginBottom: 10 },
  seatFilterList: { gap: 8, paddingBottom: 12 },
  seatFilterChip: { borderWidth: 1, borderColor: '#DDE2E8', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#fff' },
  activeSeatFilterChip: { backgroundColor: '#E7F1FF', borderColor: '#B7D7FF' },
  seatFilterText: { color: '#495057', fontSize: 13, fontWeight: '800' },
  activeSeatFilterText: { color: '#007AFF' },
  ticketRow: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E9ECEF' },
  rowTitle: { color: '#212529', fontWeight: '900', marginBottom: 4 },
  rowMeta: { color: '#868E96', fontSize: 13 },
  rowAction: { color: '#007AFF', fontWeight: '900' },
  empty: { color: '#868E96', paddingVertical: 16 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2, marginBottom: 14 },
  pageNavButton: { minWidth: 52, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#D0E4FF', backgroundColor: '#fff', alignItems: 'center' },
  disabledPageButton: { borderColor: '#E9ECEF', backgroundColor: '#F8F9FA' },
  pageNavText: { color: '#007AFF', fontSize: 12, fontWeight: '900' },
  disabledPageText: { color: '#ADB5BD' },
  pageNumberButton: { minWidth: 36, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: '#E9ECEF', backgroundColor: '#fff', alignItems: 'center' },
  activePageNumberButton: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  pageNumberText: { color: '#495057', fontSize: 12, fontWeight: '900' },
  activePageNumberText: { color: '#fff' },
  secondaryButton: { borderWidth: 1, borderColor: '#007AFF', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  secondaryButtonText: { color: '#007AFF', fontWeight: '900' },
});
