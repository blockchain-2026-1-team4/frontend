import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const DEFAULT_SEAT_SECTIONS = ['A', 'B', 'C', 'D', 'VIP'];
const PAGE_SIZE = 12;
const MAX_VISIBLE_PAGES = 4;

function buildSeats(count: number, section: string, startNumber: number) {
  return Array.from({ length: count }, (_, index) => `${section}-${startNumber + index}`);
}

function ticketKey(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.seatInfo);
}

function seatNumber(seat?: string) {
  const value = Number(String(seat || '').split('-')[1]);
  return Number.isFinite(value) ? value : 0;
}

function nextSeatNumber(tickets: TicketDetail[], section: string) {
  const numbers = tickets
    .map((ticket) => ticket.seatInfo)
    .filter((seat) => seat.startsWith(`${section}-`))
    .map((seat) => Number(seat.split('-')[1]))
    .filter((value) => Number.isInteger(value) && value > 0);
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
}

function seatSectionOf(seatInfo?: string) {
  const normalized = String(seatInfo ?? '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.startsWith('VIP')) return 'VIP';
  return normalized.split(/[-\s]/)[0];
}

export default function TicketIssuePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issueCount, setIssueCount] = useState('10');
  const [seatSections, setSeatSections] = useState(DEFAULT_SEAT_SECTIONS);
  const [seatSectionsDraft, setSeatSectionsDraft] = useState<string[]>(DEFAULT_SEAT_SECTIONS);
  const [seatSection, setSeatSection] = useState('A');
  const [newSection, setNewSection] = useState('');
  const [startNumber, setStartNumber] = useState('1');
  const [query, setQuery] = useState('');
  const [selectedSeatSection, setSelectedSeatSection] = useState('전체');
  const [sortMode, setSortMode] = useState<'latest' | 'seat'>('latest');
  const [page, setPage] = useState(1);
  const [issuing, setIssuing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const totalCount = event?.totalTicketCount ?? 0;
  const issuedCount = tickets.length;
  const remainingCount = Math.max(totalCount - issuedCount, 0);
  const recentTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 5),
    [tickets],
  );

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('티켓 발행 불가', statusMessage);
        navigation.goBack();
        return;
      }

      const [eventDetail, issuedTickets] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => []),
      ]);
      const sectionsFromTickets = Array.from(new Set(issuedTickets.map((ticket) => String(ticket.seatInfo || '').split('-')[0]).filter(Boolean)));
      const merged = Array.from(new Set([...(DEFAULT_SEAT_SECTIONS.map((s) => s.toUpperCase())), ...sectionsFromTickets.map((s) => String(s).toUpperCase())]));
      const defaults = Array.from(new Set(DEFAULT_SEAT_SECTIONS.map((s) => String(s).toUpperCase())));
      const rest = merged.filter((s) => !defaults.includes(s)).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
      const finalSections = [...defaults, ...rest];
      setSeatSections(finalSections);
      setSeatSectionsDraft(finalSections);
      setEvent(eventDetail);
      setTickets(issuedTickets);
      setStartNumber(String(nextSeatNumber(issuedTickets, seatSection)));
      setPage(1);
    } catch (error: any) {
      const message = errorMessage(error, '현재 발행 정보를 불러오지 못했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert('티켓 정보 로드 실패', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation, seatSection]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const previewSeats = useMemo(() => {
    const count = Number(issueCount);
    const start = Number(startNumber);
    if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(start) || start <= 0) return [];
    return buildSeats(Math.min(count, 8), seatSection, start);
  }, [issueCount, seatSection, startNumber]);

  const ticketSeatFilters = useMemo(() => {
    const sections = Array.from(new Set([...seatSections, ...tickets.map((ticket) => seatSectionOf(ticket.seatInfo)).filter(Boolean)])).sort((a, b) =>
      a.localeCompare(b, 'ko-KR', { numeric: true }),
    );
    return ['전체', ...sections];
  }, [seatSections, tickets]);

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = tickets.filter((ticket) => {
      const seatInfo = String(ticket.seatInfo || '').toLowerCase();
      const matchesQuery = !normalized || seatInfo.includes(normalized);
      const matchesSection = selectedSeatSection === '전체' || seatSectionOf(ticket.seatInfo) === selectedSeatSection;
      return matchesQuery && matchesSection;
    });
    return [...base].sort((a, b) => {
      if (sortMode === 'seat') {
        const sectionCompare = String(a.seatInfo || '').localeCompare(String(b.seatInfo || ''), 'ko-KR', { numeric: true });
        return sectionCompare || seatNumber(a.seatInfo) - seatNumber(b.seatInfo);
      }
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [query, selectedSeatSection, sortMode, tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTickets = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    const half = Math.floor(MAX_VISIBLE_PAGES / 2);
    const start = Math.max(1, Math.min(currentPage - half, totalPages - MAX_VISIBLE_PAGES + 1));
    const end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const setAllRemaining = () => {
    setIssueCount(String(remainingCount));
  };

  const selectSection = (section: string) => {
    setSeatSection(section);
    setStartNumber(String(nextSeatNumber(tickets, section)));
  };

  const addSection = () => {
    let value = String(newSection || '').toUpperCase().trim();
    value = value.replace(/[^A-Z0-9\s-]/g, '').trim();
    if (!value) {
      setNewSection('');
      return;
    }

    setSeatSectionsDraft((current) => {
      const merged = Array.from(new Set([...current.map((s) => String(s).toUpperCase()), value]));
      const defaults = Array.from(new Set(DEFAULT_SEAT_SECTIONS.map((s) => s.toUpperCase())));
      const rest = merged.filter((s) => !defaults.includes(s)).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
      return [...defaults, ...rest];
    });

    setNewSection('');
    selectSection(value);
  };

  const removeSection = (section: string) => {
    if (DEFAULT_SEAT_SECTIONS.includes(section)) return;
    const hasIssuedSeats = tickets.some((ticket) => seatSectionOf(ticket.seatInfo) === section);
    if (hasIssuedSeats) {
      Alert.alert('구역 삭제 불가', '이미 발행된 좌석이 있는 구역은 삭제할 수 없습니다.');
      return;
    }

    setSeatSectionsDraft((current) => current.filter((item) => item !== section));
    if (seatSection === section) {
      selectSection(DEFAULT_SEAT_SECTIONS[0]);
    }
  };

  const saveSections = () => {
    setSeatSections(seatSectionsDraft);
    Alert.alert('구역 저장', '구역 변경사항이 저장되었습니다.');
  };

  const cancelSectionChanges = () => {
    setSeatSectionsDraft(seatSections);
  };

  const showError = (title: string, message: string) => {
    setFeedback({ type: 'error', message });
    Alert.alert(title, message);
  };

  const issue = async () => {
    setFeedback(null);

    if (!eventId) {
      showError('이벤트 없음', '티켓을 발행할 이벤트를 찾지 못했습니다.');
      return;
    }
    if (remainingCount <= 0) {
      showError('발행 불가', '이 이벤트는 총 티켓 수만큼 모두 발행되었습니다.');
      return;
    }

    const count = Number(issueCount);
    const start = Number(startNumber);
    if (!Number.isInteger(count) || count <= 0) {
      showError('입력 오류', '이번 발행 수량은 1 이상의 정수여야 합니다.');
      return;
    }
    if (count > remainingCount) {
      showError('입력 오류', `남은 미발행 티켓은 ${remainingCount}장입니다.`);
      return;
    }
    if (!Number.isInteger(start) || start <= 0) {
      showError('입력 오류', '시작 번호는 1 이상의 정수여야 합니다.');
      return;
    }

    const seatInfos = buildSeats(count, seatSection, start);
    const existingSeats = new Set(tickets.map((ticket) => ticket.seatInfo));
    const duplicatedSeat = seatInfos.find((seat) => existingSeats.has(seat));
    if (duplicatedSeat) {
      showError('좌석 중복', `${duplicatedSeat} 좌석은 이미 발행되었습니다. 시작 번호를 조정해주세요.`);
      return;
    }

    setIssuing(true);
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        showError('티켓 발행 불가', statusMessage);
        return;
      }

      const issued = await backendApi.issueTickets(eventId, { seatInfos });
      const message = `${issued.length}장의 티켓을 발행했습니다.`;
      setFeedback({ type: 'success', message });
      Alert.alert('티켓 발행 완료', message);
      await load();
    } catch (error: any) {
      showError('티켓 발행 실패', errorMessage(error, '티켓을 발행하지 못했습니다.'));
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>티켓 발행 정보를 확인하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Ticket Issue</Text>
      <Text style={styles.title}>티켓 발행</Text>
      <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'}의 미발행 티켓을 좌석 단위로 생성합니다.</Text>

      {feedback ? (
        <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
          <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <Summary label="총 발행 티켓" value={totalCount || '-'} />
        <Summary label="발행 완료 티켓" value={issuedCount} />
        <Summary label="미발행 티켓" value={remainingCount} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>발행 영역</Text>
        <Text style={styles.helpText}>기본 구역을 선택하거나 직접 구역을 추가할 수 있습니다.</Text>

        <Text style={styles.label}>좌석 구역</Text>
        <View style={styles.sectionGrid}>
          {seatSectionsDraft.map((section) => (
            <View key={section} style={styles.sectionChipGroup}>
              <TouchableOpacity style={[styles.sectionChip, seatSection === section && styles.activeSectionChip]} onPress={() => selectSection(section)}>
                <Text style={[styles.sectionChipText, seatSection === section && styles.activeSectionChipText]}>{section}</Text>
              </TouchableOpacity>
              {!DEFAULT_SEAT_SECTIONS.includes(section) ? (
                <TouchableOpacity style={styles.sectionDeleteButton} onPress={() => removeSection(section)}>
                  <Text style={styles.sectionDeleteText}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.addSectionRow}>
          <TextInput style={[styles.input, styles.addSectionInput]} value={newSection} onChangeText={setNewSection} placeholder="FLOOR, R석 등" autoCapitalize="characters" />
          <TouchableOpacity style={styles.addSectionButton} onPress={addSection}>
            <Text style={styles.addSectionButtonText}>추가</Text>
          </TouchableOpacity>
        </View>

        {JSON.stringify(seatSectionsDraft) !== JSON.stringify(seatSections) ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={styles.primaryButton} onPress={saveSections}>
              <Text style={styles.primaryButtonText}>구역 변경 저장</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={cancelSectionChanges}>
              <Text style={styles.secondaryButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.label}>시작 번호</Text>
        <TextInput style={styles.input} value={startNumber} onChangeText={setStartNumber} keyboardType="number-pad" inputMode="numeric" />

        <Text style={styles.label}>이번 발행 수량</Text>
        <View style={styles.countRow}>
          <TextInput style={[styles.input, styles.countInput]} value={issueCount} onChangeText={setIssueCount} keyboardType="number-pad" inputMode="numeric" />
          <Shortcut label="1장" onPress={() => setIssueCount('1')} />
          <Shortcut label="10장" onPress={() => setIssueCount('10')} />
          <Shortcut label="전체" onPress={setAllRemaining} />
        </View>

        <Text style={styles.previewLabel}>발행될 좌석</Text>
        <Text style={styles.previewText}>{previewSeats.join(', ') || '-'}</Text>
        {Number(issueCount) > 8 ? <Text style={styles.helpText}>외 {Number(issueCount) - 8}장이 이어서 생성됩니다.</Text> : null}
      </View>

      <TouchableOpacity style={[styles.primaryButton, (issuing || remainingCount <= 0) && styles.disabledButton]} disabled={issuing || remainingCount <= 0} onPress={issue}>
        <Text style={styles.primaryButtonText}>{issuing ? '발행 중...' : remainingCount <= 0 ? '발행 완료' : '티켓 발행'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('TicketExplore', { eventId })}>
        <Text style={styles.secondaryButtonText}>전체 발행 좌석 보기</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>최근 발행 티켓 미리보기</Text>
          <Text style={styles.pageText}>{recentTickets.length}건</Text>
        </View>
        {recentTickets.length === 0 ? (
          <Text style={styles.emptyText}>최근 발행 티켓이 없습니다.</Text>
        ) : (
          recentTickets.map((ticket) => (
            <View key={ticketKey(ticket)} style={styles.ticketRow}>
              <View>
                <Text style={styles.ticketSeat}>{ticket.seatInfo}</Text>
                <Text style={styles.ticketMeta}>{ticket.ownerWalletAddress || ticket.ownerAddress || '미판매'}</Text>
              </View>
              <Text style={styles.ticketStatus}>{formatTicketStatus(ticket.status)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Summary({ label, value }: { label: string; value: number | string }) {
  return <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

function Shortcut({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.countShortcut} onPress={onPress}><Text style={styles.countShortcutText}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  summaryValue: { marginTop: 7, color: '#0F172A', fontSize: 22, fontWeight: '900' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  helpText: { marginTop: 8, color: '#64748B', fontSize: 12, lineHeight: 18 },
  label: { marginTop: 14, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionChipGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeSectionChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  sectionChipText: { color: '#475569', fontWeight: '900' },
  activeSectionChipText: { color: '#2563EB' },
  sectionDeleteButton: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  sectionDeleteText: { color: '#DC2626', fontSize: 18, lineHeight: 18, fontWeight: '900' },
  addSectionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addSectionInput: { flex: 1 },
  addSectionButton: { backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  addSectionButtonText: { color: '#FFFFFF', fontWeight: '900' },
  countRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countInput: { flex: 1 },
  countShortcut: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  countShortcutText: { color: '#0F172A', fontWeight: '900', fontSize: 12 },
  previewLabel: { marginTop: 14, color: '#64748B', fontSize: 12, fontWeight: '800' },
  previewText: { marginTop: 5, color: '#0F172A', fontWeight: '800', lineHeight: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  filterList: { gap: 8, marginTop: 10, paddingBottom: 8 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterChipText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  activeFilterChipText: { color: '#2563EB' },
  sortRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  sortButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  activeSortButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  sortButtonText: { color: '#475569', fontWeight: '900' },
  activeSortButtonText: { color: '#2563EB' },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketSeat: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  ticketStatus: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900', alignSelf: 'flex-start' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  pageNumberButton: { minWidth: 36, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activePageNumberButton: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  pageNumberText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  activePageNumberText: { color: '#FFFFFF' },
  emptyText: { color: '#94A3B8', paddingVertical: 18, textAlign: 'center' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
