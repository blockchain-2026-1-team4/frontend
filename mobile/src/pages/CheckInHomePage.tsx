import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, TicketDetail } from '../types/api';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

type CheckInEvent = { event: EventSummary; tickets: TicketDetail[] };
type CheckInSection = '오늘 일정' | '향후 일정' | '종료된 이벤트';

function formatStartSummary(startTime: number, now = new Date()) {
  if (Number.isNaN(startTime)) return '-';
  const start = new Date(startTime);
  const pad = (value: number) => String(value).padStart(2, '0');
  const timeText = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const today = now.toDateString() === start.toDateString();
  if (today) return `오늘 ${timeText} 시작`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.toDateString() === start.toDateString()) return `내일 ${timeText} 시작`;
  return `${start.getMonth() + 1}/${start.getDate()} ${timeText} 시작`;
}

function checkInSection(item: CheckInEvent, now = new Date()): CheckInSection {
  const ticketCount = item.event.totalTicketCount && item.event.totalTicketCount > 0 ? item.event.totalTicketCount : item.tickets.length;
  const startTime = getNextRoundTime(item.event, now);
  const end = new Date(item.event.eventEndAt || item.event.endsAt || '').getTime();
  if (!Number.isNaN(end) && now.getTime() > end) return '종료된 이벤트';
  if (ticketCount === 0 || Number.isNaN(startTime)) {
    return new Date(startTime).toDateString() === now.toDateString() ? '오늘 일정' : '향후 일정';
  }
  const startDate = new Date(startTime);
  if (startDate.toDateString() === now.toDateString()) return '오늘 일정';
  return startTime - now.getTime() <= 3 * 24 * 60 * 60 * 1000 ? '향후 일정' : '향후 일정';
}

const SECTION_CONFIG: Record<CheckInSection, { color: string; bg: string; dot: string }> = {
  '오늘 일정': { color: '#0F6E56', bg: '#E1F5EE', dot: '#6EE7B7' },
  '향후 일정': { color: '#534AB7', bg: '#EEEDFE', dot: '#A89CF7' },
  '종료된 이벤트': { color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
};

export default function CheckInHomePage({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const [items, setItems] = useState<CheckInEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await backendApi.getMyEvents({ page: 0, size: 30 });
      const publishedEvents = (page.items ?? []).filter((event) => event.status === 'PUBLISHED');
      const withTickets = await Promise.all(
        publishedEvents.map(async (event) => ({
          event,
          tickets: await backendApi.getEventTickets(event.id).catch(() => [] as TicketDetail[]),
        })),
      );
      setItems(withTickets);
    } catch (error: any) {
      Alert.alert('체크인 홈 로드 실패', errorMessage(error, '체크인 운영 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const groupedEvents = useMemo<Record<CheckInSection, CheckInEvent[]>>(() => {
    const groups: Record<CheckInSection, CheckInEvent[]> = {
      '오늘 일정': [],
      '향후 일정': [],
      '종료된 이벤트': [],
    };
    items.forEach((item) => {
      groups[checkInSection(item)].push(item);
    });
    return groups;
  }, [items]);

  const todayEvents = groupedEvents['오늘 일정'];
  const todayActionable = todayEvents.filter((item) => {
    const ticketCount = item.event.totalTicketCount && item.event.totalTicketCount > 0 ? item.event.totalTicketCount : item.tickets.length;
    return ticketCount > 0;
  }).length;

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('OrganizerDashboard');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
        <Text style={styles.loadingText}>체크인 운영 화면을 준비하고 있습니다.</Text>
      </View>
    );
  }

  const sections: CheckInSection[] = ['오늘 일정', '향후 일정', '종료된 이벤트'];

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}>
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>CHECK-IN OPERATIONS</Text>
        <Text style={styles.heroTitle}>체크인 허브</Text>
        <Text style={styles.heroSub}>체크인 운영 현황을 한눈에 확인하고 바로 처리합니다.</Text>
        <View style={styles.heroChip}>
          <View style={[styles.heroDot, todayEvents.length > 0 && styles.heroDotActive]} />
          <Text style={styles.heroChipText}>
            {todayEvents.length === 0 ? '오늘 예정 이벤트 없음' : `오늘 이벤트 ${todayEvents.length}개 · 처리 가능 ${todayActionable}개`}
          </Text>
        </View>
      </HeroGradient>

      {sections.map((section) => {
        const events = groupedEvents[section];
        const config = SECTION_CONFIG[section];
        const ticketMissing = events.filter((item) => {
          const count = item.event.totalTicketCount && item.event.totalTicketCount > 0 ? item.event.totalTicketCount : item.tickets.length;
          return count === 0;
        }).length;

        return (
          <View key={section} style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionLeft}>
                <View style={[styles.sectionDot, { backgroundColor: config.dot }]} />
                <Text style={styles.sectionTitle}>{section}</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.countBadgeText, { color: config.color }]}>{events.length}건</Text>
              </View>
            </View>

            <Text style={styles.summaryMeta}>
              {section === '오늘 일정' && events.length === 0
                ? '오늘 예정된 이벤트가 없습니다.'
                : section === '오늘 일정'
                  ? `처리 가능 ${events.length - ticketMissing}건 · 티켓 미발행 ${ticketMissing}건`
                  : section === '향후 일정'
                    ? `체크인 예정 ${events.length}건 · 티켓 미발행 ${ticketMissing}건`
                    : `종료된 체크인 이벤트 ${events.length}건`}
            </Text>

            <TouchableOpacity
              style={[styles.sectionButton, { borderColor: config.color }]}
              onPress={() => navigation.navigate('CheckInEventList', { section })}
            >
              <Text style={[styles.sectionButtonText, { color: config.color }]}>목록 보기</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9CA3AF' },
  heroDotActive: { backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, marginTop: 14 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '800' },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  countBadgeText: { fontSize: 11, fontWeight: '800' },
  summaryMeta: { color: '#6B7280', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  sectionButton: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  sectionButtonText: { fontWeight: '800', fontSize: 13 },
});
