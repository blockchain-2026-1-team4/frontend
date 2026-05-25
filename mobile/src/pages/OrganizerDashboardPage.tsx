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
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
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

  const isOrganizer = profile?.roles?.includes('ORGANIZER') || profile?.roles?.includes('ADMIN');
  const blockedMessage = accountStatusMessage(profile?.status);
  const latestApplication = applications[0];
  const latestStatus = latestApplication?.status ?? null;
  const canApply = !latestApplication || latestStatus === 'REJECTED';
  const totalEvents = events.length;
  const publishedEvents = events.filter((event) => event.status === 'PUBLISHED').length;
  const todayScheduledEvents = events.filter((event) => {
    const status = String(event.status ?? '').toUpperCase();
    if (status === 'CANCELLED') return false;
    const nextRoundTime = getNextRoundTime(event);
    return !Number.isNaN(nextRoundTime) && isToday(new Date(nextRoundTime).toISOString());
  }).length;
  const [ticketMetrics, setTicketMetrics] = useState({
    checkedInTickets: 0,
  });

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

        const ticketLists = await Promise.all(
          myEvents.map((event) => backendApi.getEventTickets(event.id).catch(() => [])),
        );
        const allTickets = ticketLists.flat();
        const todayCheckedInTickets = allTickets.filter((ticket) => ticket.status === 'USED' && isToday(ticket.usedAt || ticket.updatedAt || ticket.createdAt)).length;

        setTicketMetrics({
          checkedInTickets: todayCheckedInTickets,
        });
      } else {
        setEvents([]);
        setTicketMetrics({ checkedInTickets: 0 });
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
      const timer = setInterval(() => {
        void load();
      }, 7000);

      return () => clearInterval(timer);
    }, [load]),
  );

  const refresh = () => {
    setRefreshing(true);
    void load();
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
        <ActivityIndicator size="large" color="#2563EB" />
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Organizer</Text>
            <Text style={styles.title}>주최자 센터</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>이벤트 등록부터 티켓 발행, 체크인 운영까지 한 곳에서 관리합니다.</Text>
      </View>

      {blockedMessage ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>계정 사용 불가</Text>
          <Text style={styles.cardText}>{blockedMessage}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('OrganizerLogout')}>
            <Text style={styles.secondaryButtonText}>로그아웃</Text>
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
              <TextInput
                style={styles.input}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="연락 이메일"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="활동 계획 또는 소개" multiline />
              {feedback ? (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackText}>{feedback}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabledButton]} disabled={submitting} onPress={submitApplication}>
                <Text style={styles.primaryButtonText}>{submitting ? '신청 중...' : '승인 신청하기'}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.metricGrid}>
            <Metric label="전체 이벤트" value={totalEvents} />
            <Metric label="게시중 이벤트" value={publishedEvents} />
          </View>
          <View style={[styles.metricGrid, { marginTop: 8 }]}> 
            <Metric label="오늘 예정 이벤트" value={todayScheduledEvents} />
            <Metric label="오늘 체크인" value={ticketMetrics.checkedInTickets} />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('EventCreate')}>
              <Text style={styles.primaryButtonText}>이벤트 등록</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('MyEvents')}>
              <Text style={styles.secondaryButtonText}>내 이벤트</Text>
            </TouchableOpacity>
          </View>

        </>
      )}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  header: { marginBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 12 },
  cardTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 21 },
  statusBox: { marginTop: 14, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#EFF6FF' },
  statusLabel: { color: '#2563EB', fontSize: 12, fontWeight: '800' },
  statusValue: { marginTop: 4, fontSize: 18, fontWeight: '900', color: '#1E40AF' },
  statusMeta: { marginTop: 3, color: '#475569' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, marginTop: 10, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  feedbackBox: { marginTop: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 12 },
  feedbackText: { color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  metricGrid: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  actions: { marginTop: 16 },
});
