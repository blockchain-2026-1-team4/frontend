import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
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
  const [statusDraft, setStatusDraft] = useState('PUBLISHED');
  const [statusSaving, setStatusSaving] = useState(false);
  const [posterUploading, setPosterUploading] = useState(false);

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
      setStatusDraft(detail.status || 'PUBLISHED');
      setTickets(eventTickets);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const uploadPoster = async () => {
    if (!event) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const file = { uri: asset.uri, name: `poster-${Date.now()}.${ext}`, type: mimeType };
    setPosterUploading(true);
    try {
      await backendApi.uploadEventImage(event.id, file);
      Alert.alert('업로드 완료', '포스터가 저장되었습니다.');
      await load();
    } catch (err: any) {
      Alert.alert('업로드 실패', errorMessage(err, '포스터 업로드에 실패했습니다.'));
    } finally {
      setPosterUploading(false);
    }
  };

  const saveStatus = async () => {
    if (!event) return;
    if (event.adminCanceled && statusDraft !== 'CANCELLED') {
      Alert.alert('변경 불가', '관리자가 취소한 이벤트는 주최자가 복구할 수 없습니다.');
      return;
    }
    setStatusSaving(true);
    try {
      await backendApi.updateEventStatus(event.id, { status: statusDraft });
      Alert.alert('저장 완료', '이벤트 상태가 변경되었습니다.');
      await load();
    } catch (error: any) {
      Alert.alert('상태 변경 실패', errorMessage(error, '이벤트 상태를 변경하지 못했습니다.'));
    } finally {
      setStatusSaving(false);
    }
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
      <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, posterUri && styles.posterHero, { paddingTop: Math.max(insets.top + 20, 42) }]}>
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
        <MetricCard label="총 티켓" value={totalTickets} bg="#EEEDFE" color="#534AB7" />
        <MetricCard label="발행" value={tickets.length} bg="#F3F4F6" color="#6B7280" />
        <MetricCard label="판매" value={soldTickets} bg="#E1F5EE" color="#0F6E56" />
        <MetricCard label="체크인" value={usedTickets} bg="#E6F1FB" color="#185FA5" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>티켓 운영</Text>
      </View>
      <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id, returnTo: 'detail' })}>
        <Text style={styles.primaryActionText}>티켓 발행</Text>
      </TouchableOpacity>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('SalesStatus', { eventId: event.id })}>
          <Text style={styles.actionBtnText}>판매 현황</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CheckInStatus', { eventId: event.id })}>
          <Text style={styles.actionBtnText}>체크인 현황</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>이벤트 관리</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.manageRow}>
          <TouchableOpacity style={styles.manageBtn} onPress={() => navigation.navigate('EventSettings', { eventId: event.id })}>
            <Text style={styles.manageBtnText}>이벤트 수정</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.manageBtn, posterUploading && styles.disabledButton]}
            disabled={posterUploading}
            onPress={() => void uploadPoster()}
          >
            <Text style={styles.manageBtnText}>{posterUploading ? '업로드 중...' : event.imageUrl ? '포스터 교체' : '포스터 등록'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <Text style={styles.subTitle}>이벤트 상태 변경</Text>
        <Text style={styles.descriptionText}>게시 여부와 취소 여부를 관리합니다. 판매·공연 상태는 일정과 티켓 수량으로 자동 계산됩니다.</Text>
        {event.adminCanceled ? <Text style={styles.warningText}>관리자가 취소한 이벤트는 주최자가 복구할 수 없습니다.</Text> : null}

        <View style={styles.statusGrid}>
          {[
            { value: 'PUBLISHED', label: '게시중' },
            { value: 'INACTIVE', label: '비공개' },
            { value: 'CANCELLED', label: '이벤트 취소' },
          ].map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.statusChip, statusDraft === item.value && styles.activeStatusChip]}
              disabled={statusSaving || (event.adminCanceled === true && item.value !== 'CANCELLED')}
              onPress={() => setStatusDraft(item.value)}
            >
              <Text style={[styles.statusChipText, statusDraft === item.value && styles.activeStatusChipText]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.statusSaveBtn, statusSaving && styles.disabledButton]} disabled={statusSaving} onPress={() => void saveStatus()}>
          <Text style={styles.statusSaveBtnText}>{statusSaving ? '저장 중...' : '상태 저장'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MetricCard({ label, value, bg, color }: { label: string; value: number; bg: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: bg }]}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
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
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statusChipHero: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusChipHeroText: { fontSize: 11, fontWeight: '800' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: -16, marginBottom: 16 },
  metricCard: { width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13, borderWidth: 0.5, borderColor: '#E5E7EB' },
  metricIconBox: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  metricValue: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  metricLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  primaryAction: { marginHorizontal: 16, backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  primaryActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 18 },
  actionBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  actionBtnText: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
  card: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  manageRow: { flexDirection: 'row', gap: 8 },
  manageBtn: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  manageBtnText: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
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
