import React, { useCallback, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { showDialog } from '../lib/dialog';
import { getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, OrganizerApplication, UserProfile } from '../types/api';

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

const APPLICATION_LABEL: Record<string, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  REJECTED: '거절됨',
};

function applicationTime(application: OrganizerApplication) {
  const value = String(application.updatedAt || application.createdAt || '');
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === new Date().toDateString();
}

function formatDate(dateStr?: string | null): { month: string; day: string } {
  if (!dateStr) return { month: '—', day: '—' };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { month: '—', day: '—' };
  return {
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function formatTodayChip(todayCount: number): string {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  if (todayCount === 0) return `오늘 예정 이벤트 없음 · ${today}`;
  return `오늘 예정 이벤트 ${todayCount}개 · ${today}`;
}

function getEventBadge(event: EventSummary): { label: string; style: 'live' | 'soon' | 'draft' } {
  const status = String(event.status ?? '').toUpperCase();
  if (status === 'DRAFT') return { label: '초안', style: 'draft' };
  if (status === 'PUBLISHED') return { label: '게시중', style: 'live' };
  return { label: status, style: 'draft' };
}

const HeroLinearGradient = LinearGradient as unknown as React.ComponentType<any>;

export default function OrganizerDashboardPage({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [applications, setApplications] = useState<OrganizerApplication[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketMetrics, setTicketMetrics] = useState({
    checkedInTickets: 0,
    totalTickets: 0,
    totalParticipants: 0,
  });

  const isOrganizer = profile?.roles?.includes('ORGANIZER') || profile?.roles?.includes('ADMIN');
  const blockedMessage = accountStatusMessage(profile?.status);
  const latestApplication = applications[0];
  const latestStatus = latestApplication?.status ?? null;
  const canApply = !latestApplication || latestStatus === 'REJECTED';

  const totalEvents = events.length;
  const publishedEvents = events.filter((e) => e.status === 'PUBLISHED').length;
  const todayScheduledEvents = events.filter((event) => {
    const status = String(event.status ?? '').toUpperCase();
    if (status === 'CANCELLED') return false;
    const nextRoundTime = getNextRoundTime(event);
    return !Number.isNaN(nextRoundTime) && isToday(new Date(nextRoundTime).toISOString());
  }).length;

  const upcomingEvents = events
    .filter((e) => String(e.status ?? '').toUpperCase() !== 'CANCELLED')
    .slice(0, 3);

  const load = useCallback(async () => {
    try {
      const me = await backendApi.getMe();
      setProfile(me);
      setContactEmail((current) => current || me.email || '');

      const myApplications = await backendApi.getMyOrganizerApplications().catch(() => []);
      setApplications(
        [...(myApplications ?? [])].sort((a, b) => applicationTime(b) - applicationTime(a)),
      );

      if (me.roles?.includes('ORGANIZER') || me.roles?.includes('ADMIN')) {
        const eventPage = await backendApi.getMyEvents({ page: 0, size: 100 });
        const myEvents = eventPage.items ?? [];
        setEvents(myEvents);

        const ticketLists = await Promise.all(
          myEvents.map((event) => backendApi.getEventTickets(event.id).catch(() => [])),
        );
        const allTickets = ticketLists.flat();
        const todayCheckedIn = allTickets.filter(
          (t) => t.status === 'USED' && isToday(t.usedAt || t.updatedAt || t.createdAt),
        ).length;

        setTicketMetrics({
          checkedInTickets: todayCheckedIn,
          totalTickets: allTickets.length,
          totalParticipants: allTickets.filter((t) => t.status === 'USED').length,
        });
      } else {
        setEvents([]);
        setTicketMetrics({ checkedInTickets: 0, totalTickets: 0, totalParticipants: 0 });
      }
    } catch (error: any) {
      Alert.alert('주최자 정보 로드 실패', errorMessage(error, '로그인이 필요합니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 7000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const goBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main');
  };

  const showNotifications = () => {
    if (blockedMessage) {
      showDialog('알림', blockedMessage);
      return;
    }

    if (!isOrganizer) {
      const status = latestStatus ? APPLICATION_LABEL[latestStatus] ?? latestStatus : '신청 내역 없음';
      showDialog('알림', `주최자 승인 상태: ${status}`);
      return;
    }

    const todayText = todayScheduledEvents === 0
      ? '오늘 예정된 이벤트가 없습니다.'
      : `오늘 예정된 이벤트가 ${todayScheduledEvents}개 있습니다.`;
    const checkInText = ticketMetrics.checkedInTickets === 0
      ? '오늘 체크인된 티켓은 아직 없습니다.'
      : `오늘 체크인 ${ticketMetrics.checkedInTickets}건이 있습니다.`;
    showDialog('알림', `${todayText}\n${checkInText}`);
  };

  const submitApplication = async () => {
    if (!businessName.trim()) {
      const message = '상호명을 입력해주세요.';
      setFeedback(message);
      Alert.alert('입력 필요', message);
      return;
    }
    if (!contactEmail.trim()) {
      const message = '연락 이메일을 입력해주세요.';
      setFeedback(message);
      Alert.alert('입력 필요', message);
      return;
    }
    setSubmitting(true);
    setFeedback('');
    try {
      await backendApi.submitOrganizerApplication({
        businessName: businessName.trim(),
        contactEmail: contactEmail.trim(),
        description: description.trim() || null,
      });
      setBusinessName('');
      setDescription('');
      Alert.alert('신청 완료', '주최자 승인 신청이 접수되었습니다.');
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '주최자 승인 신청에 실패했습니다.');
      const visibleMessage =
        message.includes('businessName') || message.includes('상호')
          ? '상호명을 입력해주세요.'
          : message;
      setFeedback(visibleMessage);
      Alert.alert('신청 실패', visibleMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
        <Text style={styles.loadingText}>주최자 정보를 확인하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {/* ── 히어로 ── */}
      <HeroLinearGradient
        colors={['#171A3D', '#24275F', '#2B2F73']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.hero, { paddingTop: Math.max(insets.top + 38, 56) }]}
      >
        <View style={styles.heroTopBar}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            style={styles.backButton}
            onPress={goBack}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path
                d="M19 12H5m7 7-7-7 7-7"
                fill="none"
                stroke="rgba(255,255,255,0.78)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.4}
              />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="알림"
            style={styles.notificationButton}
            onPress={showNotifications}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z"
                fill="none"
                stroke="rgba(255,255,255,0.82)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
              <Path
                d="M9.5 20a2.5 2.5 0 0 0 5 0"
                fill="none"
                stroke="rgba(255,255,255,0.82)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </Svg>
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>Organizer</Text>
        <Text style={styles.heroTitle}>주최자 센터</Text>
        <Text style={styles.heroSub}>이벤트 등록부터 체크인 운영까지 한 곳에서</Text>
        <View style={styles.todayChip}>
          <View style={styles.todayDot} />
          <Text style={styles.todayChipText}>{formatTodayChip(todayScheduledEvents)}</Text>
        </View>
      </HeroLinearGradient>

      {blockedMessage ? (
        /* ── 계정 차단 ── */
        <View style={styles.card}>
          <Text style={styles.cardTitle}>계정 사용 불가</Text>
          <Text style={styles.cardText}>{blockedMessage}</Text>
          <TouchableOpacity
            style={[styles.secondaryButton, { marginHorizontal: 0 }]}
            onPress={() => navigation.navigate('OrganizerLogout')}
          >
            <Text style={styles.secondaryButtonText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      ) : !isOrganizer ? (
        /* ── 미승인 주최자 신청 폼 ── */
        <View style={styles.card}>
          <Text style={styles.cardTitle}>주최자 승인 신청</Text>
          <Text style={styles.cardText}>
            이벤트를 등록하려면 관리자 승인이 필요합니다. 신청 상태는 이 화면에서 확인할 수 있습니다.
          </Text>
          {latestApplication ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>최근 신청 상태</Text>
              <Text style={styles.statusValue}>
                {APPLICATION_LABEL[latestStatus ?? 'PENDING'] ?? latestStatus}
              </Text>
              <Text style={styles.statusMeta}>{latestApplication.businessName ?? businessName}</Text>
            </View>
          ) : null}
          {canApply ? (
            <>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="상호명"
              />
              <TextInput
                style={styles.input}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="연락 이메일"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="활동 계획 또는 소개"
                multiline
              />
              {feedback ? (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackText}>{feedback}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.primaryButton, submitting && styles.disabledButton, { marginHorizontal: 0, marginTop: 12 }]}
                disabled={submitting}
                onPress={submitApplication}
              >
                <Text style={styles.primaryButtonText}>{submitting ? '신청 중...' : '승인 신청하기'}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : (
        /* ── 승인된 주최자 대시보드 ── */
        <>
          {/* 현황 카드 2×2 */}
          <View style={styles.metricGrid}>
            <MetricCard iconBg="#EEEDFE" icon="📅" value={totalEvents} label="전체 이벤트" />
            <MetricCard iconBg="#E1F5EE" icon="📡" value={publishedEvents} label="게시중 이벤트" />
          </View>
          <View style={[styles.metricGrid, { marginTop: 10 }]}>
            <MetricCard iconBg="#FAEEDA" icon="🎟" value={ticketMetrics.totalTickets} label="총 발급 티켓" />
            <MetricCard iconBg="#E6F1FB" icon="👥" value={ticketMetrics.totalParticipants} label="누적 참가자" />
          </View>

          {/* 빠른 실행 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>빠른 실행</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('EventCreate')}
          >
            <Text style={styles.primaryButtonText}>+ 새 이벤트 등록</Text>
          </TouchableOpacity>
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('MyEvents')}>
              <Text style={styles.quickBtnIcon}>📋</Text>
              <View>
                <Text style={styles.quickBtnLabel}>내 이벤트</Text>
                <Text style={styles.quickBtnSub}>전체 목록 보기</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('CheckInHome')}>
              <Text style={styles.quickBtnIcon}>📷</Text>
              <View>
                <Text style={styles.quickBtnLabel}>체크인 관리</Text>
                <Text style={styles.quickBtnSub}>QR 스캔</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 오늘 체크인 현황 (체크인이 있을 때만) */}
          {ticketMetrics.checkedInTickets > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>오늘 체크인 현황</Text>
              </View>
              <View style={styles.checkinRow}>
                <View style={styles.checkinLeft}>
                  <View style={styles.checkinCircle}>
                    <Text style={{ fontSize: 16 }}>📍</Text>
                  </View>
                  <View>
                    <Text style={styles.checkinTitle}>오늘 체크인 완료</Text>
                    <Text style={styles.checkinSub}>{ticketMetrics.checkedInTickets}명</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* 다가오는 이벤트 */}
          {upcomingEvents.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>다가오는 이벤트</Text>
                <TouchableOpacity onPress={() => navigation.navigate('MyEvents')}>
                  <Text style={styles.sectionLink}>더 보기</Text>
                </TouchableOpacity>
              </View>
              {upcomingEvents.map((event) => {
                const nextTime = getNextRoundTime(event);
                const dateStr = !Number.isNaN(nextTime) ? new Date(nextTime).toISOString() : null;
                const { month, day } = formatDate(dateStr);
                const badge = getEventBadge(event);
                const isDraft = badge.style === 'draft';
                return (
                  <View key={event.id} style={styles.eventItem}>
                    <View style={[styles.eventDateBox, isDraft && styles.eventDateBoxGray]}>
                      <Text style={[styles.eventMonth, isDraft && styles.eventMonthGray]}>{month}</Text>
                      <Text style={[styles.eventDay, isDraft && styles.eventDayGray]}>{day}</Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventName} numberOfLines={1}>{eventTitle(event)}</Text>
                      <Text style={styles.eventMeta}>
                        {dateStr
                          ? new Date(dateStr).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '시간 미정'}
                      </Text>
                    </View>
                    <View style={[styles.eventBadge, styles[`badge_${badge.style}` as keyof typeof styles] as any]}>
                      <Text style={[styles.eventBadgeText, styles[`badgeText_${badge.style}` as keyof typeof styles] as any]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function MetricCard({
  iconBg,
  icon,
  value,
  label,
}: {
  iconBg: string;
  icon: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
      </View>
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  loadingText: { marginTop: 12, color: '#9ca3af', fontSize: 14 },

  /* 히어로 */
  hero: {
    backgroundColor: '#171A3D',
    paddingHorizontal: 20,
    paddingBottom: 36,
    overflow: 'hidden',
  },
  heroGlowTitle: {
    position: 'absolute',
    left: 18,
    top: 22,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#4F46E5',
    opacity: 0.12,
  },
  heroGlowRight: {
    position: 'absolute',
    right: -90,
    top: 40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#5B4BFF',
    opacity: 0.18,
    shadowColor: '#5B4BFF',
    shadowOpacity: 0.18,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  heroGlowTopRight: {
    position: 'absolute',
    right: -20,
    top: -8,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#8A7DFF',
    opacity: 0.12,
    shadowColor: '#8A7DFF',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  heroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#a89cf7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, marginBottom: 18 },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6ee7b7' },
  todayChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },

  /* 현황 카드 */
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
  },
  metricIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: { fontSize: 24, fontWeight: '800', color: '#1a1a2e', lineHeight: 28 },
  metricLabel: { fontSize: 11, color: '#9ca3af', marginTop: 3 },

  /* 섹션 헤더 */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  sectionLink: { fontSize: 11, color: '#534AB7', fontWeight: '600' },

  /* 버튼 */
  primaryButton: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    overflow: 'hidden',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 16,
  },
  secondaryButtonText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },

  /* 빠른 실행 */
  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 10 },
  quickBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#DDD6FE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickBtnIcon: { fontSize: 20 },
  quickBtnLabel: { fontSize: 12, fontWeight: '700', color: '#2E1065' },
  quickBtnSub: { fontSize: 10, color: '#7C3AED', marginTop: 1 },

  /* 체크인 */
  checkinRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkinLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinTitle: { fontSize: 12, fontWeight: '700', color: '#1a1a2e' },
  checkinSub: { fontSize: 10, color: '#9ca3af', marginTop: 2 },

  /* 이벤트 리스트 */
  eventItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventDateBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDateBoxGray: { backgroundColor: '#f3f4f6' },
  eventMonth: { fontSize: 8, fontWeight: '700', color: '#534AB7', textTransform: 'uppercase' },
  eventMonthGray: { color: '#9ca3af' },
  eventDay: { fontSize: 16, fontWeight: '800', color: '#3C3489', lineHeight: 18 },
  eventDayGray: { color: '#6b7280' },
  eventInfo: { flex: 1 },
  eventName: { fontSize: 12, fontWeight: '700', color: '#1a1a2e' },
  eventMeta: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  eventBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  eventBadgeText: { fontSize: 9, fontWeight: '700' },
  badge_live: { backgroundColor: '#E1F5EE' },
  badgeText_live: { color: '#0F6E56' },
  badge_soon: { backgroundColor: '#FAEEDA' },
  badgeText_soon: { color: '#854F0B' },
  badge_draft: { backgroundColor: '#f3f4f6' },
  badgeText_draft: { color: '#9ca3af' },

  /* 미승인 폼 */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    margin: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 21 },
  statusBox: {
    marginTop: 14,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
  },
  statusLabel: { color: '#534AB7', fontSize: 12, fontWeight: '700' },
  statusValue: { marginTop: 4, fontSize: 18, fontWeight: '800', color: '#3C3489' },
  statusMeta: { marginTop: 3, color: '#475569' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  feedbackBox: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
  },
  feedbackText: { color: '#B91C1C', fontWeight: '700', lineHeight: 20 },
});
