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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { showDialog } from '../lib/dialog';
import { getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, OrganizerApplication, UserProfile } from '../types/api';

type IconName = 'arrow-left' | 'bell' | 'calendar' | 'broadcast' | 'ticket' | 'users' | 'plus' | 'list' | 'qr' | 'pin';

const APPLICATION_LABEL: Record<string, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  REJECTED: '반려',
};

const STATUS_BADGE: Record<string, { label: string; style: 'live' | 'soon' | 'draft' }> = {
  PUBLISHED: { label: '게시중', style: 'live' },
  DRAFT: { label: '초안', style: 'draft' },
  INACTIVE: { label: '비공개', style: 'draft' },
};

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

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
  if (!dateStr) return { month: '--', day: '--' };
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return { month: '--', day: '--' };
  return {
    month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(date.getDate()).padStart(2, '0'),
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

function eventTimeLabel(dateStr?: string | null) {
  if (!dateStr) return '시간 미정';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '시간 미정';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function ticketCountLabel(event: EventSummary) {
  const sold = Number(event.soldTicketCount ?? 0);
  const total = Number(event.totalTicketCount ?? 0);
  if (total > 0) return `티켓 ${sold}/${total}`;
  return '티켓 미발행';
}

function getEventBadge(event: EventSummary): { label: string; style: 'live' | 'soon' | 'draft' } {
  const status = String(event.status ?? '').toUpperCase();
  if (STATUS_BADGE[status]) return STATUS_BADGE[status];

  const nextTime = getNextRoundTime(event);
  if (!Number.isNaN(nextTime) && nextTime - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    return { label: '마감임박', style: 'soon' };
  }
  return { label: status || '상태 없음', style: 'draft' };
}

function AppIcon({ name, color = '#534AB7', size = 18 }: { name: IconName; color?: string; size?: number }) {
  const stroke = color;
  const common = { fill: 'none', stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'arrow-left' ? <Path {...common} d="M19 12H5m7 7-7-7 7-7" /> : null}
      {name === 'bell' ? (
        <>
          <Path {...common} d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z" />
          <Path {...common} d="M9.5 20a2.5 2.5 0 0 0 5 0" />
        </>
      ) : null}
      {name === 'calendar' ? (
        <>
          <Rect {...common} x={4} y={5} width={16} height={15} rx={2} />
          <Path {...common} d="M8 3v4m8-4v4M4 10h16" />
        </>
      ) : null}
      {name === 'broadcast' ? (
        <>
          <Circle {...common} cx={12} cy={12} r={2} />
          <Path {...common} d="M16.24 7.76a6 6 0 0 1 0 8.48M7.76 16.24a6 6 0 0 1 0-8.48M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
        </>
      ) : null}
      {name === 'ticket' ? <Path {...common} d="M4 9a3 3 0 0 0 0 6v3h16v-3a3 3 0 0 0 0-6V6H4v3Zm8-2v10" /> : null}
      {name === 'users' ? (
        <>
          <Path {...common} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <Circle {...common} cx={9.5} cy={7} r={4} />
          <Path {...common} d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      ) : null}
      {name === 'plus' ? <Path {...common} d="M12 5v14M5 12h14" /> : null}
      {name === 'list' ? <Path {...common} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> : null}
      {name === 'qr' ? (
        <>
          <Path {...common} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
          <Path {...common} d="M14 14h2v2h-2zM18 14h2v6h-6v-2h4zM14 18h2" />
        </>
      ) : null}
      {name === 'pin' ? (
        <>
          <Path {...common} d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <Circle {...common} cx={12} cy={10} r={3} />
        </>
      ) : null}
    </Svg>
  );
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
  const publishedEvents = events.filter((event) => String(event.status ?? '').toUpperCase() === 'PUBLISHED').length;
  const todayScheduledEvents = events.filter((event) => {
    const status = String(event.status ?? '').toUpperCase();
    if (status === 'CANCELLED') return false;
    const nextRoundTime = getNextRoundTime(event);
    return !Number.isNaN(nextRoundTime) && isToday(new Date(nextRoundTime).toISOString());
  }).length;

  const upcomingEvents = events
    .filter((event) => String(event.status ?? '').toUpperCase() !== 'CANCELLED')
    .sort((left, right) => {
      const leftTime = getNextRoundTime(left);
      const rightTime = getNextRoundTime(right);
      return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime) - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
    })
    .slice(0, 3);

  const load = useCallback(async () => {
    try {
      const me = await backendApi.getMe();
      setProfile(me);
      setContactEmail((current) => current || me.email || '');

      const myApplications = await backendApi.getMyOrganizerApplications().catch(() => []);
      setApplications([...(myApplications ?? [])].sort((a, b) => applicationTime(b) - applicationTime(a)));

      if (me.roles?.includes('ORGANIZER') || me.roles?.includes('ADMIN')) {
        const eventPage = await backendApi.getMyEvents({ page: 0, size: 100 });
        const myEvents = eventPage.items ?? [];
        setEvents(myEvents);

        const ticketLists = await Promise.all(myEvents.map((event) => backendApi.getEventTickets(event.id).catch(() => [])));
        const allTickets = ticketLists.flat();
        const todayCheckedIn = allTickets.filter((ticket) => ticket.status === 'USED' && isToday(ticket.usedAt || ticket.updatedAt || ticket.createdAt)).length;

        setTicketMetrics({
          checkedInTickets: todayCheckedIn,
          totalTickets: allTickets.length,
          totalParticipants: allTickets.filter((ticket) => ticket.status === 'USED').length,
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
      const status = latestStatus ? APPLICATION_LABEL[latestStatus] ?? latestStatus : '신청 이력 없음';
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
      const visibleMessage = message.includes('businessName') || message.includes('상호') ? '상호명을 입력해주세요.' : message;
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
      <HeroLinearGradient
        colors={['#1A1A2E', '#2D2B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}
      >
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={goBack}>
            <AppIcon name="arrow-left" color="rgba(255,255,255,0.78)" size={22} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="알림" style={styles.notificationButton} onPress={showNotifications}>
            <AppIcon name="bell" color="rgba(255,255,255,0.86)" size={18} />
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>Organizer</Text>
        <Text style={styles.heroTitle}>주최자 센터</Text>
        <Text style={styles.heroSub}>이벤트 등록부터 티켓 발급, 체크인 운영까지 한곳에서 관리하세요.</Text>
        <View style={styles.todayChip}>
          <View style={styles.todayDot} />
          <Text style={styles.todayChipText}>{formatTodayChip(todayScheduledEvents)}</Text>
        </View>
      </HeroLinearGradient>

      {blockedMessage ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>계정 사용 불가</Text>
          <Text style={styles.cardText}>{blockedMessage}</Text>
          <TouchableOpacity style={[styles.secondaryButton, { marginHorizontal: 0 }]} onPress={() => navigation.navigate('OrganizerLogout')}>
            <Text style={styles.secondaryButtonText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      ) : !isOrganizer ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>주최자 승인 신청</Text>
          <Text style={styles.cardText}>
            이벤트를 등록하려면 관리자 승인이 필요합니다. 신청 상태는 이 화면에서 확인할 수 있습니다.
          </Text>
          {latestApplication ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>최근 신청 상태</Text>
              <Text style={styles.statusValue}>{APPLICATION_LABEL[latestStatus ?? 'PENDING'] ?? latestStatus}</Text>
              <Text style={styles.statusMeta}>{latestApplication.businessName ?? businessName}</Text>
            </View>
          ) : null}
          {canApply ? (
            <>
              <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="상호명" />
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
        <>
          <View style={styles.metricGrid}>
            <MetricCard icon="calendar" iconBg="#EEEDFE" iconColor="#534AB7" value={totalEvents} label="전체 이벤트" />
            <MetricCard icon="broadcast" iconBg="#E1F5EE" iconColor="#0F6E56" value={publishedEvents} label="게시중 이벤트" trend="전월 대비 +3" />
            <MetricCard icon="ticket" iconBg="#FAEEDA" iconColor="#854F0B" value={ticketMetrics.totalTickets} label="총 발급 티켓" />
            <MetricCard icon="users" iconBg="#E6F1FB" iconColor="#185FA5" value={ticketMetrics.totalParticipants} label="누적 체크인" />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>빠른 실행</Text>
          </View>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('EventCreate')}>
              <View style={styles.primaryActionIcon}>
                <AppIcon name="plus" color="#FFFFFF" size={19} />
              </View>
              <Text style={styles.primaryActionText}>새 이벤트 등록</Text>
            </TouchableOpacity>
            <QuickAction icon="list" title="내 이벤트" subtitle="전체 목록 보기" onPress={() => navigation.navigate('MyEvents')} />
            <QuickAction icon="qr" title="체크인 관리" subtitle="QR 스캔" onPress={() => navigation.navigate('CheckInHome')} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>오늘 체크인 현황</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CheckInHome')}>
              <Text style={styles.sectionLink}>전체 보기</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.checkinRow}>
            <View style={styles.checkinLeft}>
              <View style={styles.checkinCircle}>
                <AppIcon name="pin" color="#185FA5" size={16} />
              </View>
              <View>
                <Text style={styles.checkinTitle}>{todayScheduledEvents > 0 ? '오늘 운영 중인 이벤트' : '오늘 예정 이벤트 없음'}</Text>
                <Text style={styles.checkinSub}>{ticketMetrics.checkedInTickets.toLocaleString()}명 체크인 완료</Text>
              </View>
            </View>
            <View style={styles.progressWrap}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, ticketMetrics.checkedInTickets)}%` }]} />
              </View>
              <Text style={styles.progressPct}>{ticketMetrics.checkedInTickets}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>다가오는 이벤트</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MyEvents')}>
              <Text style={styles.sectionLink}>더 보기</Text>
            </TouchableOpacity>
          </View>
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => {
              const nextTime = getNextRoundTime(event);
              const dateStr = !Number.isNaN(nextTime) ? new Date(nextTime).toISOString() : null;
              const { month, day } = formatDate(dateStr);
              const badge = getEventBadge(event);
              const isDraft = badge.style === 'draft';
              return (
                <TouchableOpacity key={event.id} style={styles.eventItem} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: event.id })}>
                  <View style={[styles.eventDateBox, isDraft && styles.eventDateBoxGray]}>
                    <Text style={[styles.eventMonth, isDraft && styles.eventMonthGray]}>{month}</Text>
                    <Text style={[styles.eventDay, isDraft && styles.eventDayGray]}>{day}</Text>
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventName} numberOfLines={1}>{eventTitle(event)}</Text>
                    <Text style={styles.eventMeta}>{eventTimeLabel(dateStr)} · {ticketCountLabel(event)}</Text>
                  </View>
                  <View style={[styles.eventBadge, styles[`badge_${badge.style}` as keyof typeof styles] as any]}>
                    <Text style={[styles.eventBadgeText, styles[`badgeText_${badge.style}` as keyof typeof styles] as any]}>
                      {badge.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>다가오는 이벤트가 없습니다.</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('EventCreate')}>
                <Text style={styles.emptyButtonText}>이벤트 등록</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function MetricCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  trend,
}: {
  icon: IconName;
  iconBg: string;
  iconColor: string;
  value: number;
  label: string;
  trend?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: iconBg }]}>
        <AppIcon name={icon} color={iconColor} size={16} />
      </View>
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {trend ? <Text style={styles.metricTrend}>{trend}</Text> : null}
    </View>
  );
}

function QuickAction({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress}>
      <View style={styles.quickIconWrap}>
        <AppIcon name={icon} color="#534AB7" size={17} />
      </View>
      <View style={styles.quickText}>
        <Text style={styles.quickBtnLabel}>{title}</Text>
        <Text style={styles.quickBtnSub}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },

  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  notificationButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  todayChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: -20, marginBottom: 16 },
  metricCard: { width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  metricIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  metricValue: { fontSize: 25, fontWeight: '800', color: '#1A1A2E', lineHeight: 29 },
  metricLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  metricTrend: { fontSize: 10, color: '#0F6E56', marginTop: 4 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  sectionLink: { fontSize: 11, color: '#534AB7', fontWeight: '700' },

  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 18 },
  primaryAction: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  quickBtn: { flex: 1, minWidth: '47%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickIconWrap: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  quickText: { flex: 1, minWidth: 0 },
  quickBtnLabel: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  quickBtnSub: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },

  checkinRow: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  checkinLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  checkinCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center' },
  checkinTitle: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  checkinSub: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: { width: 60, height: 5, borderRadius: 99, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 99, backgroundColor: '#534AB7' },
  progressPct: { fontSize: 11, fontWeight: '800', color: '#534AB7', minWidth: 16, textAlign: 'right' },

  eventItem: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventDateBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  eventDateBoxGray: { backgroundColor: '#F3F4F6' },
  eventMonth: { fontSize: 8, fontWeight: '800', color: '#534AB7', textTransform: 'uppercase' },
  eventMonthGray: { color: '#9CA3AF' },
  eventDay: { fontSize: 16, fontWeight: '900', color: '#3C3489', lineHeight: 18 },
  eventDayGray: { color: '#6B7280' },
  eventInfo: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  eventMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  eventBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  eventBadgeText: { fontSize: 9, fontWeight: '800' },
  badge_live: { backgroundColor: '#E1F5EE' },
  badgeText_live: { color: '#0F6E56' },
  badge_soon: { backgroundColor: '#FAEEDA' },
  badgeText_soon: { color: '#854F0B' },
  badge_draft: { backgroundColor: '#F3F4F6' },
  badgeText_draft: { color: '#9CA3AF' },

  emptyBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 16, alignItems: 'center' },
  emptyTitle: { color: '#6B7280', fontSize: 13, fontWeight: '800' },
  emptyButton: { backgroundColor: '#1A1A2E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '800' },

  primaryButton: { backgroundColor: '#1A1A2E', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginHorizontal: 16, marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginHorizontal: 16 },
  secondaryButtonText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', margin: 16 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 21 },
  statusBox: { marginTop: 14, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#EFF6FF' },
  statusLabel: { color: '#534AB7', fontSize: 12, fontWeight: '700' },
  statusValue: { marginTop: 4, fontSize: 18, fontWeight: '800', color: '#3C3489' },
  statusMeta: { marginTop: 3, color: '#475569' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, marginTop: 10, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  feedbackBox: { marginTop: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 12 },
  feedbackText: { color: '#B91C1C', fontWeight: '700', lineHeight: 20 },
});
