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
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  OrganizerEmpty,
  OrganizerHero,
  OrganizerSectionHead,
  OrganizerTopBar,
  organizerColors,
} from '../components/OrganizerTabKit';
import { FlowBadge, flowShadow } from '../components/TicketFlowKit';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { clearAccessToken } from '../lib/auth';
import { backendApi } from '../lib/backend';
import { showDialog } from '../lib/dialog';
import { getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, OrganizerApplication, UserProfile } from '../types/api';

type IconName = 'bell' | 'calendar' | 'broadcast' | 'ticket' | 'users' | 'plus' | 'list' | 'qr' | 'pin';

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

function formatDate(dateStr?: string | null) {
  if (!dateStr) return { month: '--', day: '--' };
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return { month: '--', day: '--' };
  return {
    month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(date.getDate()).padStart(2, '0'),
  };
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
  return total > 0 ? `티켓 ${sold}/${total}` : '티켓 미발행';
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
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
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
          <Path {...common} d="M16.24 7.76a6 6 0 0 1 0 8.48M7.76 16.24a6 6 0 0 1 0-8.48" />
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

export default function OrganizerDashboardPage({ navigation }: any) {
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
  const [ticketMetrics, setTicketMetrics] = useState({ checkedInTickets: 0, totalTickets: 0, totalParticipants: 0 });

  const isOrganizer = profile?.roles?.includes('ORGANIZER') || profile?.roles?.includes('ADMIN');
  const blockedMessage = accountStatusMessage(profile?.status);
  const latestApplication = applications[0];
  const latestStatus = latestApplication?.status ?? null;
  const canApply = !latestApplication || latestStatus === 'REJECTED';

  const totalEvents = events.length;
  const publishedEvents = events.filter((event) => String(event.status ?? '').toUpperCase() === 'PUBLISHED').length;
  const todayScheduledEvents = events.filter((event) => {
    if (String(event.status ?? '').toUpperCase() === 'CANCELLED') return false;
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
      const httpStatus = (error as any)?.response?.status ?? (error as any)?.status;
      if (httpStatus === 401) {
        navigation.reset({ index: 0, routes: [{ name: 'Auth', params: { initialRole: 'ORGANIZER' } }] });
        return;
      }
      Alert.alert('주최자 정보 로드 실패', errorMessage(error, '정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

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
    const todayText = todayScheduledEvents === 0 ? '오늘 예정된 이벤트가 없습니다.' : `오늘 예정된 이벤트가 ${todayScheduledEvents}개 있습니다.`;
    const checkInText = ticketMetrics.checkedInTickets === 0 ? '오늘 입장 처리된 티켓은 아직 없습니다.' : `오늘 입장 처리 ${ticketMetrics.checkedInTickets}건이 있습니다.`;
    showDialog('알림', `${todayText}\n${checkInText}`);
  };

  const handleLogout = async () => {
    try {
      await clearAccessToken();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error: any) {
      Alert.alert('로그아웃 실패', errorMessage(error, '세션을 종료하지 못했습니다.'));
    }
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
    <ScrollView style={styles.mockContainer} contentContainerStyle={styles.mockContent} stickyHeaderIndices={[0]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <OrganizerTopBar eyebrow="Organizer" title="주최자 센터" rightIcon="bell" rightLabel="알림" onRightPress={showNotifications} />
      <OrganizerHero
        size="lg"
        badge="오늘 해야 할 일"
        title={todayScheduledEvents === 0 ? '오늘 운영할 이벤트는\n없습니다.' : `오늘 운영할 이벤트는\n${todayScheduledEvents}개 있습니다.`}
        meta="다가오는 이벤트와 티켓 판매 상태를 먼저 확인하세요."
      />

      {blockedMessage ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>계정 사용 불가</Text>
          <Text style={styles.cardText}>{blockedMessage}</Text>
          <TouchableOpacity style={[styles.primaryButton, { marginHorizontal: 0 }]} onPress={handleLogout}>
            <Text style={styles.primaryButtonText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      ) : !isOrganizer ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>주최자 승인 신청</Text>
          <Text style={styles.cardText}>이벤트를 등록하려면 관리자 승인이 필요합니다. 신청 상태는 이 화면에서 확인할 수 있습니다.</Text>
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
              <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} placeholder="연락 이메일" autoCapitalize="none" keyboardType="email-address" />
              <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="활동 계획 또는 소개" multiline />
              {feedback ? <View style={styles.feedbackBox}><Text style={styles.feedbackText}>{feedback}</Text></View> : null}
              <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabledButton, { marginHorizontal: 0, marginTop: 12 }]} disabled={submitting} onPress={submitApplication}>
                <Text style={styles.primaryButtonText}>{submitting ? '신청 중...' : '승인 신청하기'}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : (
        <>
          <OrganizerSectionHead title="빠른 실행" subtitle="자주 쓰는 운영 작업" />
          <View style={styles.quickActions}>
            <QuickAction icon="plus" title="새 이벤트 등록" subtitle="회차/티켓 생성" tone="purple" onPress={() => navigation.navigate('EventCreate')} />
            <QuickAction icon="qr" title="일정 관리" subtitle="입장 운영" tone="green" onPress={() => navigation.navigate('CheckInHome')} />
            <QuickAction icon="calendar" title="내 이벤트" subtitle="전체 목록" tone="blue" onPress={() => navigation.navigate('MyEvents')} />
            <QuickAction icon="ticket" title="티켓 판매" subtitle="판매 현황" tone="orange" onPress={() => navigation.navigate('SalesStatus')} />
          </View>

          <OrganizerSectionHead title="다가오는 운영 이벤트" subtitle="가장 가까운 일정" actionLabel="더 보기" onAction={() => navigation.navigate('MyEvents')} />
          {upcomingEvents.length > 0 ? upcomingEvents.slice(0, 1).map((event) => {
            const nextTime = getNextRoundTime(event);
            const dateStr = !Number.isNaN(nextTime) ? new Date(nextTime).toISOString() : null;
            const { month, day } = formatDate(dateStr);
            const badge = getEventBadge(event);
            const sold = Number(event.soldTicketCount ?? 0);
            const total = Number(event.totalTicketCount ?? 0);
            const pct = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;
            return (
              <TouchableOpacity key={event.id} style={styles.upcomingCard} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: event.id })}>
                <View style={styles.upcomingTop}>
                  <View style={styles.upcomingDate}>
                    <Text style={styles.upcomingMonth}>{month}</Text>
                    <Text style={styles.upcomingDay}>{day}</Text>
                  </View>
                  <View style={styles.upcomingCopy}>
                    <Text style={styles.upcomingName} numberOfLines={2}>{eventTitle(event)}</Text>
                    <Text style={styles.upcomingMeta}>{event.venue || '장소 미정'} · {eventTimeLabel(dateStr)}</Text>
                  </View>
                  <FlowBadge label={badge.label} tone={badge.style === 'live' ? 'green' : badge.style === 'soon' ? 'yellow' : 'gray'} />
                </View>
                <View style={styles.upcomingProgressTop}>
                  <Text style={styles.upcomingProgressLabel}>{ticketCountLabel(event)}</Text>
                  <Text style={styles.upcomingProgressValue}>{pct}%</Text>
                </View>
                <View style={styles.upcomingProgressBg}><View style={[styles.upcomingProgressFill, { width: `${pct}%` }]} /></View>
              </TouchableOpacity>
            );
          }) : (
            <OrganizerEmpty title="다가오는 이벤트가 없습니다." actionLabel="이벤트 등록" onAction={() => navigation.navigate('EventCreate')} />
          )}

          <OrganizerSectionHead title="운영 통계" subtitle="전체 누적 기준" />
          <View style={styles.metricGrid}>
            <MetricCard icon="calendar" iconBg="#EEEDFE" iconColor="#534AB7" value={totalEvents} label="전체 이벤트" />
            <MetricCard icon="broadcast" iconBg="#E1F5EE" iconColor="#0F6E56" value={publishedEvents} label="게시중 이벤트" trend="진행 대기" />
            <MetricCard icon="ticket" iconBg="#FAEEDA" iconColor="#854F0B" value={ticketMetrics.totalTickets} label="총 발급 티켓" />
            <MetricCard icon="users" iconBg="#E6F1FB" iconColor="#185FA5" value={ticketMetrics.totalParticipants} label="누적 체크인" />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function MetricCard({ icon, iconBg, iconColor, value, label, trend }: { icon: IconName; iconBg: string; iconColor: string; value: number; label: string; trend?: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: iconBg }]}><AppIcon name={icon} color={iconColor} size={15} /></View>
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {trend ? <Text style={styles.metricTrend}>{trend}</Text> : null}
    </View>
  );
}

function QuickAction({ icon, title, subtitle, tone, onPress }: { icon: IconName; title: string; subtitle: string; tone: 'purple' | 'green' | 'blue' | 'orange'; onPress: () => void }) {
  const toneStyle = {
    purple: { backgroundColor: '#EEEDFE', color: '#534AB7' },
    green: { backgroundColor: '#DCFCE7', color: '#0F6E56' },
    blue: { backgroundColor: '#E0F2FE', color: '#0369A1' },
    orange: { backgroundColor: '#FFF3E6', color: '#A16207' },
  }[tone];
  return (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress}>
      <View style={[styles.quickIconWrap, { backgroundColor: toneStyle.backgroundColor }]}><AppIcon name={icon} color={toneStyle.color} size={18} /></View>
      <View style={styles.quickText}>
        <Text style={styles.quickBtnLabel}>{title}</Text>
        <Text style={styles.quickBtnSub}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  mockContainer: { flex: 1, backgroundColor: organizerColors.background },
  mockContent: { paddingBottom: 108 },
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  hero: { paddingHorizontal: 18, paddingBottom: 30 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', lineHeight: 26 },
  heroSub: { color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 4 },
  heroChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EE7B7' },
  heroChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  metricCard: { width: '48.5%', minHeight: 104, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 15, borderWidth: 1, borderColor: '#E5E7EB', ...flowShadow },
  metricIconBox: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  metricValue: { fontSize: 22, fontWeight: '900', color: '#1A1A2E', lineHeight: 24 },
  metricLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  metricTrend: { fontSize: 9, color: '#0F6E56', marginTop: 3, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 6, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#1A1A2E' },
  sectionLink: { fontSize: 10, color: '#534AB7', fontWeight: '900' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  primaryAction: { width: '100%', backgroundColor: '#1A1A2E', borderRadius: 12, padding: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  primaryActionIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  quickBtn: { width: '48.5%', minHeight: 66, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 12, ...flowShadow },
  quickIconWrap: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  quickText: { flex: 1, minWidth: 0 },
  quickBtnLabel: { fontSize: 13, fontWeight: '900', color: '#1A1A2E', marginBottom: 2 },
  quickBtnSub: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  upcomingCard: { marginHorizontal: 16, marginBottom: 8, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: organizerColors.border, ...flowShadow },
  upcomingTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  upcomingDate: { width: 54, height: 62, borderRadius: 17, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  upcomingMonth: { color: organizerColors.purple, fontSize: 8, fontWeight: '900' },
  upcomingDay: { color: '#3C3489', fontSize: 22, fontWeight: '900', lineHeight: 25 },
  upcomingCopy: { flex: 1, minWidth: 0 },
  upcomingName: { color: organizerColors.ink, fontSize: 14, fontWeight: '900', lineHeight: 18 },
  upcomingMeta: { color: organizerColors.muted, fontSize: 9, fontWeight: '700', marginTop: 4 },
  upcomingProgressTop: { marginTop: 14, marginBottom: 7, flexDirection: 'row', justifyContent: 'space-between' },
  upcomingProgressLabel: { color: organizerColors.muted, fontSize: 10, fontWeight: '800' },
  upcomingProgressValue: { color: organizerColors.purple, fontSize: 10, fontWeight: '900' },
  upcomingProgressBg: { height: 7, borderRadius: 999, overflow: 'hidden', backgroundColor: '#EEEDFE' },
  upcomingProgressFill: { height: '100%', borderRadius: 999, backgroundColor: organizerColors.purple },
  checkinRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 11, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  checkinLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  checkinCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center' },
  checkinTitle: { fontSize: 11, fontWeight: '900', color: '#1A1A2E' },
  checkinSub: { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '700' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  progressBarBg: { width: 56, height: 5, borderRadius: 99, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 99, backgroundColor: '#534AB7' },
  progressPct: { fontSize: 10, fontWeight: '900', color: '#534AB7', minWidth: 14, textAlign: 'right' },
  eventItem: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 11, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventDateBox: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  eventDateBoxGray: { backgroundColor: '#F3F4F6' },
  eventMonth: { fontSize: 7, fontWeight: '900', color: '#534AB7', textTransform: 'uppercase', lineHeight: 9 },
  eventMonthGray: { color: '#9CA3AF' },
  eventDay: { fontSize: 15, fontWeight: '900', color: '#3C3489', lineHeight: 17 },
  eventDayGray: { color: '#6B7280' },
  eventInfo: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 12, fontWeight: '900', color: '#1A1A2E' },
  eventMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  eventBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  eventBadgeText: { fontSize: 9, fontWeight: '900' },
  badge_live: { backgroundColor: '#E1F5EE' },
  badgeText_live: { color: '#0F6E56' },
  badge_soon: { backgroundColor: '#FAEEDA' },
  badgeText_soon: { color: '#854F0B' },
  badge_draft: { backgroundColor: '#F3F4F6' },
  badgeText_draft: { color: '#9CA3AF' },
  emptyBox: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, borderWidth: 0.5, borderColor: '#E5E7EB', marginHorizontal: 14, alignItems: 'center' },
  emptyTitle: { color: '#6B7280', fontSize: 12, fontWeight: '900' },
  emptyButton: { backgroundColor: '#1A1A2E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB', margin: 14 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 20, fontSize: 12 },
  statusBox: { marginTop: 14, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: '#EFF6FF' },
  statusLabel: { color: '#534AB7', fontSize: 11, fontWeight: '800' },
  statusValue: { marginTop: 4, fontSize: 17, fontWeight: '900', color: '#3C3489' },
  statusMeta: { marginTop: 3, color: '#475569', fontSize: 12 },
  input: { borderWidth: 0.5, borderColor: '#CBD5E1', borderRadius: 10, padding: 11, marginTop: 10, backgroundColor: '#FFFFFF', color: '#0F172A', fontSize: 12 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  feedbackBox: { marginTop: 10, backgroundColor: '#FEF2F2', borderWidth: 0.5, borderColor: '#FCA5A5', borderRadius: 10, padding: 11 },
  feedbackText: { color: '#B91C1C', fontWeight: '800', lineHeight: 18, fontSize: 12 },
  primaryButton: { backgroundColor: '#1A1A2E', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
