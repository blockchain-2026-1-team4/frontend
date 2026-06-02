import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { resolveImageUrl } from '../lib/config';
import { formatEventCategory, formatEventRange, formatEventStatus, getEventDisplayStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

type DetailIconName = 'edit' | 'eye' | 'ticket' | 'chart' | 'qr' | 'tag' | 'cart' | 'broadcast' | 'eye-off' | 'x-icon';

function DetailIcon({ name, color = '#534AB7', size = 16 }: { name: DetailIconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'edit' ? <Path {...common} d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /> : null}
      {name === 'eye' ? <Path {...common} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /> : null}
      {name === 'ticket' ? <Path {...common} d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Zm8-1v12" /> : null}
      {name === 'chart' ? <Path {...common} d="M4 19V5m4 14v-7m4 7V8m4 11v-4m4 4H3" /> : null}
      {name === 'qr' ? <Path {...common} d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v6h-2v-6Zm-4 4h2v2h-2v-2Z" /> : null}
      {name === 'tag' ? <Path {...common} d="M20 10 12 2H5v7l8 8a2 2 0 0 0 3 0l4-4a2 2 0 0 0 0-3ZM8 7h.01" /> : null}
      {name === 'cart' ? <Path {...common} d="M6 6h15l-2 8H8L6 3H3m6 17h.01M18 20h.01" /> : null}
      {name === 'broadcast' ? <Path {...common} d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M15.457 7.519a6 6 0 0 1 0 8.962M18.929 4.048a11 11 0 0 1 0 15.904M8.543 7.519a6 6 0 0 0 0 8.962M5.071 4.048a11 11 0 0 0 0 15.904" /> : null}
      {name === 'eye-off' ? <Path {...common} d="M3 3l18 18M10.584 10.587a2 2 0 0 0 2.828 2.829M9.363 5.365A9.466 9.466 0 0 1 12 5c4 0 7.333 2.333 10 7-1.496 2.585-3.15 4.427-4.9 5.5M6.979 6.979C4.244 8.262 2.65 10.12 1 12c2.667 4.667 6 7 10 7a9.674 9.674 0 0 0 4.943-1.31" /> : null}
      {name === 'x-icon' ? <Path {...common} d="M6 6l12 12M6 18L18 6" /> : null}
    </Svg>
  );
}

function eventTitle(event: EventDetail) {
  return event.name || event.title || '이벤트';
}

function eventStart(event: EventDetail) {
  return event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || '';
}

function eventEnd(event: EventDetail) {
  return event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime || '';
}

function roundSummary(event: EventDetail) {
  const rounds = event.rounds ?? [];
  if (rounds.length === 0) return formatEventRange(eventStart(event), eventEnd(event));
  const first = rounds[0];
  const firstText = `${first.title || '1회차'} · ${first.eventDate} ${String(first.startTime).slice(0, 5)}`;
  return rounds.length === 1 ? firstText : `${firstText} 외 ${rounds.length - 1}개 회차`;
}

const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  neutral: { bg: '#F3F4F6', text: '#6B7280' },
  blue: { bg: '#EEEDFE', text: '#534AB7' },
  green: { bg: '#E1F5EE', text: '#0F6E56' },
  yellow: { bg: '#FAEEDA', text: '#854F0B' },
  red: { bg: '#FEE2E2', text: '#B91C1C' },
  gray: { bg: '#E5E7EB', text: '#6B7280' },
};

export default function OrganizerEventDetailPage({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusDraft, setStatusDraft] = useState('ACTIVE');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusAccordionOpen, setStatusAccordionOpen] = useState(false);

  const soldTickets = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
  const usedTickets = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
  const totalTickets = event?.totalTicketCount && event.totalTicketCount > 0 ? event.totalTicketCount : tickets.length;
  const displayStatus = getEventDisplayStatus(event);

  const load = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const detail = await backendApi.getEvent(eventId);
      const eventTickets = await backendApi.getEventTickets(eventId).catch(() => []);
      setEvent(detail);
      setStatusDraft(detail.status || 'ACTIVE');
      setTickets(eventTickets);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveStatus = async (newStatus: string) => {
    if (!event) return;
    if (event.adminCanceled && newStatus !== 'CANCELED') {
      Alert.alert('변경 불가', '관리자가 취소한 이벤트는 주최자가 복구할 수 없습니다.');
      return;
    }
    setStatusSaving(true);
    try {
      await backendApi.updateEventStatus(event.id, { status: newStatus });
      setStatusDraft(newStatus);
      Alert.alert('저장 완료', '이벤트 상태가 변경되었습니다.');
      await load();
    } catch (error: any) {
      Alert.alert('상태 변경 실패', errorMessage(error, '이벤트 상태를 변경하지 못했습니다.'));
    } finally {
      setStatusSaving(false);
    }
  };

  const isCancelled = statusDraft === 'CANCELED';

  const handleStatusSelect = (newStatus: string) => {
    if (newStatus === statusDraft || statusSaving) return;
    if (isCancelled && newStatus !== 'CANCELED') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        window.alert('변경 불가\n취소된 이벤트는 되돌릴 수 없습니다.');
        return;
      }
      Alert.alert('변경 불가', '취소된 이벤트는 되돌릴 수 없습니다.');
      return;
    }
    if (newStatus === 'CANCELED') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm('이벤트 취소\n취소 후 되돌릴 수 없습니다. 이벤트를 취소하시겠습니까?')) {
          void saveStatus(newStatus);
        }
        return;
      }
      Alert.alert(
        '이벤트 취소',
        '취소 후 되돌릴 수 없습니다. 이벤트를 취소하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '확인', style: 'destructive', onPress: () => void saveStatus(newStatus) },
        ]
      );
      return;
    }
    void saveStatus(newStatus);
  };

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('MyEvents');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
        <Text style={styles.loadingText}>이벤트 상세 정보를 불러오고 있습니다.</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>이벤트를 찾을 수 없습니다.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={goBack}>
          <Text style={styles.primaryButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tone = STATUS_TONE[displayStatus.tone] ?? STATUS_TONE.neutral;
  const posterUri = resolveImageUrl(event.imageUrl);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, posterUri && styles.posterHero, { paddingTop: Math.max(insets.top + 14, 36) }]}>
        {posterUri ? (
          <>
            <Image source={{ uri: posterUri }} style={styles.posterHeroImage} resizeMode="cover" />
            <View style={styles.posterHeroOverlay} />
          </>
        ) : null}
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
            <BackIcon />
          </TouchableOpacity>
          <View style={[styles.statusChipHero, { backgroundColor: tone.bg }]}>
            <Text style={[styles.statusChipHeroText, { color: tone.text }]}>{displayStatus.label}</Text>
          </View>
        </View>
        <Text style={styles.eyebrow}>{formatEventCategory(event.category).toUpperCase()}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>{eventTitle(event)}</Text>
        <Text style={styles.heroSub} numberOfLines={1}>장소 {event.venue || '-'}</Text>
        <View style={styles.heroChip}>
          <View style={styles.heroDot} />
          <Text style={styles.heroChipText}>{roundSummary(event)}</Text>
        </View>
      </HeroGradient>

      <View style={styles.metricGrid}>
        <MetricCard icon="ticket" label="총 티켓" value={totalTickets} bg="#EEEDFE" color="#534AB7" />
        <MetricCard icon="tag" label="발행" value={tickets.length} bg="#E6F1FB" color="#185FA5" />
        <MetricCard icon="cart" label="판매" value={soldTickets} bg="#E1F5EE" color="#0F6E56" />
        <MetricCard icon="qr" label="체크인" value={usedTickets} bg="#FAEEDA" color="#854F0B" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>이벤트 관리</Text>
      </View>
      <View style={styles.manageCard}>
        <TouchableOpacity style={styles.manageActionRow} onPress={() => navigation.navigate('EventSettings', { eventId: event.id })}>
          <View style={[styles.manageIcon, { backgroundColor: '#EEEDFE' }]}>
            <DetailIcon name="edit" color="#534AB7" size={15} />
          </View>
          <View style={styles.manageCopy}>
            <Text style={styles.manageTitle}>이벤트 수정</Text>
            <Text style={styles.manageSub}>기본 정보, 포스터, 회차 일정 수정</Text>
          </View>
          <Text style={styles.manageChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.manageActionRow, !statusAccordionOpen && styles.manageActionRowLast]}
          onPress={() => setStatusAccordionOpen((prev) => !prev)}
        >
          <View style={[styles.manageIcon, { backgroundColor: '#F3F4F6' }]}>
            <DetailIcon name="eye" color="#6B7280" size={15} />
          </View>
          <View style={styles.manageCopy}>
            <Text style={styles.manageTitle}>이벤트 상태 변경</Text>
            <Text style={styles.manageSub}>현재: {displayStatus.label} · 눌러서 변경</Text>
          </View>
          <Text style={[styles.manageChevron, statusAccordionOpen && styles.manageChevronOpen]}>›</Text>
        </TouchableOpacity>

        {statusAccordionOpen ? (
          <View style={styles.accordionBody}>
            <Text style={styles.accordionHint}>
              {'게시 여부와 취소 여부를 관리합니다. 판매·공연 상태는 일정과 티켓 수량으로 자동 계산됩니다.'}
              {event.adminCanceled ? '\n관리자가 취소한 이벤트는 주최자가 복구할 수 없습니다.' : ''}
            </Text>
            <View style={styles.statusOptionList}>
              <TouchableOpacity
                style={[styles.statusOptionRow, statusDraft === 'ACTIVE' && styles.statusOptionRowCurrent, isCancelled && styles.statusOptionRowDisabled]}
                disabled={statusSaving || !!event.adminCanceled || isCancelled}
                onPress={() => handleStatusSelect('ACTIVE')}
              >
                <View style={[styles.statusOptionIcon, { backgroundColor: '#EEEDFE' }]}>
                  <DetailIcon name="broadcast" color="#534AB7" size={14} />
                </View>
                <View style={styles.statusOptionCopy}>
                  <Text style={[styles.statusOptionTitle, statusDraft === 'ACTIVE' && styles.statusOptionTitleActive]}>게시중</Text>
                  <Text style={styles.statusOptionSub}>사용자에게 이벤트가 공개됩니다.</Text>
                </View>
                {statusDraft === 'ACTIVE' ? (
                  <View style={styles.statusCurrentBadge}>
                    <Text style={styles.statusCurrentBadgeText}>현재</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusOptionRow, statusDraft === 'INACTIVE' && styles.statusOptionRowCurrent, isCancelled && styles.statusOptionRowDisabled]}
                disabled={statusSaving || (!!event.adminCanceled && statusDraft !== 'CANCELED') || isCancelled}
                onPress={() => handleStatusSelect('INACTIVE')}
              >
                <View style={[styles.statusOptionIcon, { backgroundColor: '#F3F4F6' }]}>
                  <DetailIcon name="eye-off" color="#6B7280" size={14} />
                </View>
                <View style={styles.statusOptionCopy}>
                  <Text style={[styles.statusOptionTitle, statusDraft === 'INACTIVE' && styles.statusOptionTitleActive]}>비공개</Text>
                  <Text style={styles.statusOptionSub}>이벤트가 목록에서 숨겨집니다.</Text>
                </View>
                {statusDraft === 'INACTIVE' ? (
                  <View style={styles.statusCurrentBadge}>
                    <Text style={styles.statusCurrentBadgeText}>현재</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusOptionRow, styles.statusOptionRowDanger, statusDraft === 'CANCELED' && styles.statusOptionRowCurrent]}
                disabled={statusSaving}
                onPress={() => handleStatusSelect('CANCELED')}
              >
                <View style={[styles.statusOptionIcon, { backgroundColor: '#FCEBEB' }]}>
                  <DetailIcon name="x-icon" color="#A32D2D" size={14} />
                </View>
                <View style={styles.statusOptionCopy}>
                  <Text style={[styles.statusOptionTitle, { color: '#A32D2D' }]}>이벤트 취소</Text>
                  <Text style={[styles.statusOptionSub, { color: '#A32D2D', opacity: 0.7 }]}>취소 후 되돌릴 수 없습니다.</Text>
                </View>
                {statusDraft === 'CANCELED' ? (
                  <View style={styles.statusCurrentBadge}>
                    <Text style={styles.statusCurrentBadgeText}>현재</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionDivider} />

      <View style={styles.ticketZone}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>티켓 운영</Text>
        </View>
        <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id, returnTo: 'detail' })}>
          <View style={styles.primaryActionIcon}>
            <DetailIcon name="ticket" color="#FFFFFF" size={17} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.primaryActionText}>티켓 발행</Text>
            <Text style={styles.primaryActionSub}>좌석과 판매 정책을 설정합니다.</Text>
          </View>
          <DetailIcon name="chart" color="rgba(255,255,255,0.4)" size={16} />
        </TouchableOpacity>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('SalesStatus', { eventId: event.id })}>
          <View style={[styles.actionIcon, { backgroundColor: '#E6F1FB' }]}>
            <DetailIcon name="chart" color="#185FA5" size={14} />
          </View>
          <Text style={styles.actionBtnText}>판매 현황</Text>
          <Text style={[styles.actionBtnValue, { color: '#185FA5' }]}>{soldTickets.toLocaleString()}<Text style={styles.actionBtnTotal}>/{totalTickets.toLocaleString()}</Text></Text>
          <Text style={styles.actionBtnSub}>좌석 · 리셀</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CheckInStatus', { eventId: event.id })}>
          <View style={[styles.actionIcon, { backgroundColor: '#E1F5EE' }]}>
            <DetailIcon name="qr" color="#0F6E56" size={14} />
          </View>
          <Text style={styles.actionBtnText}>체크인 현황</Text>
          <Text style={[styles.actionBtnValue, { color: '#0F6E56' }]}>{usedTickets.toLocaleString()}<Text style={styles.actionBtnTotal}>/{totalTickets.toLocaleString()}</Text></Text>
          <Text style={styles.actionBtnSub}>입장 처리</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 12 }} />
      </View>
    </ScrollView>
  );
}

function MetricCard({ icon, label, value, bg, color }: { icon: DetailIconName; label: string; value: number; bg: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: bg }]}>
        <DetailIcon name={icon} color={color} size={12} />
      </View>
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  emptyTitle: { color: '#1A1A2E', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  hero: { paddingHorizontal: 20, paddingBottom: 28, overflow: 'hidden' },
  posterHero: { minHeight: 155 },
  posterHeroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  posterHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,46,0.72)' },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  statusChipHero: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusChipHeroText: { fontSize: 11, fontWeight: '800' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  metricGrid: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, marginTop: -16, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  metricIconBox: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  metricValue: { fontSize: 17, fontWeight: '900', color: '#1A1A2E', lineHeight: 19 },
  metricLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  sectionDivider: { height: 12, backgroundColor: '#F5F5F5', marginTop: 12 },
  ticketZone: { backgroundColor: '#F5F5F5', paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 6, marginTop: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  primaryAction: { marginHorizontal: 16, backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginBottom: 8, flexDirection: 'row', gap: 12 },
  primaryActionIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  primaryActionSub: { color: 'rgba(255,255,255,0.58)', fontSize: 11, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 18 },
  actionBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: '#E5E7EB' },
  actionIcon: { width: 28, height: 28, borderRadius: 8, marginBottom: 9, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
  actionBtnValue: { fontSize: 15, fontWeight: '900', lineHeight: 18, marginTop: 4 },
  actionBtnTotal: { color: '#9CA3AF', fontSize: 10, fontWeight: '500' },
  actionBtnSub: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', marginTop: 3 },
  card: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  manageRow: { flexDirection: 'row', gap: 8 },
  manageBtn: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  manageBtnText: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
  manageCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E7EB', overflow: 'hidden' },
  manageActionRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  manageActionRowLast: { borderBottomWidth: 0 },
  manageChevronOpen: { transform: [{ rotate: '90deg' }] },
  accordionBody: { borderTopWidth: 0.5, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA', padding: 12 },
  accordionHint: { fontSize: 10, color: '#9CA3AF', lineHeight: 15, marginBottom: 10 },
  statusOptionList: { gap: 6 },
  statusOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 0.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  statusOptionRowCurrent: { borderColor: '#534AB7', backgroundColor: '#FAFAFE' },
  statusOptionRowDanger: { borderColor: '#F7C1C1', backgroundColor: '#FCEBEB' },
  statusOptionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statusOptionCopy: { flex: 1, minWidth: 0 },
  statusOptionTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  statusOptionTitleActive: { color: '#534AB7' },
  statusOptionSub: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  statusCurrentBadge: { backgroundColor: '#EEEDFE', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  statusCurrentBadgeText: { color: '#534AB7', fontSize: 9, fontWeight: '700', overflow: 'hidden' },
  statusOptionRowDisabled: { opacity: 0.38 },
  manageIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  manageCopy: { flex: 1, minWidth: 0 },
  manageTitle: { color: '#1A1A2E', fontSize: 13, fontWeight: '800' },
  manageSub: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginTop: 2 },
  manageChevron: { color: '#B4B2A9', fontSize: 22, lineHeight: 24 },
  divider: { height: 0.5, backgroundColor: '#E5E7EB', marginVertical: 14 },
  subTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  descriptionText: { color: '#6B7280', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  warningText: { color: '#B91C1C', fontSize: 12, fontWeight: '700', lineHeight: 18, marginBottom: 10 },
  statusGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusChip: { flex: 1, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F5F5F5' },
  activeStatusChip: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  statusChipText: { color: '#6B7280', fontWeight: '700', fontSize: 12 },
  activeStatusChipText: { color: '#534AB7' },
  statusSaveBtn: { borderWidth: 0.5, borderColor: '#534AB7', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#EEEDFE' },
  statusSaveBtnText: { color: '#534AB7', fontSize: 13, fontWeight: '800' },
  primaryButton: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
});
