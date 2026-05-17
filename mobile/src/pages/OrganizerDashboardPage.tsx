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
import type { EventSummary, OrganizerApplication, UserProfile } from '../types/api';

function eventTitle(event: EventSummary) {
  return event.name || event.title || '제목 없는 이벤트';
}

function eventDate(event: EventSummary) {
  const value = event.eventAt || event.eventDateTime;
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR');
}

function sortCanceledLast(events: EventSummary[]) {
  return [...events].sort((a, b) => {
    if (a.status === 'CANCELED' && b.status !== 'CANCELED') return 1;
    if (a.status !== 'CANCELED' && b.status === 'CANCELED') return -1;
    const aTime = new Date(a.eventAt || a.eventDateTime || '').getTime();
    const bTime = new Date(b.eventAt || b.eventDateTime || '').getTime();
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
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

export default function OrganizerDashboardPage({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [applications, setApplications] = useState<OrganizerApplication[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isOrganizer = profile?.roles?.includes('ORGANIZER') || profile?.roles?.includes('ADMIN');
  const blockedMessage = accountStatusMessage(profile?.status);
  const latestApplication = applications[0];
  const latestStatus = latestApplication?.status ?? null;
  const canApply = !latestApplication || latestStatus === 'REJECTED';
  const activeEvents = events.filter((event) => event.status === 'ACTIVE').length;
  const soldTickets = events.reduce((sum, event) => sum + (event.soldTicketCount ?? 0), 0);

  const load = useCallback(async () => {
    try {
      const me = await backendApi.getMe();
      setProfile(me);
      setContactEmail((current) => current || me.email || '');

      const myApplications = await backendApi.getMyOrganizerApplications().catch(() => []);
      setApplications([...(myApplications ?? [])].sort((a, b) => applicationTime(b) - applicationTime(a)));

      if (me.roles?.includes('ORGANIZER') || me.roles?.includes('ADMIN')) {
        const eventPage = await backendApi.getMyEvents({ page: 0, size: 5 });
        setEvents(sortCanceledLast(eventPage.items ?? []));
      } else {
        setEvents([]);
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
    if (!businessName.trim() || !contactEmail.trim()) {
      Alert.alert('입력 필요', '상호명과 연락 이메일을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await backendApi.submitOrganizerApplication({
        businessName: businessName.trim(),
        contactEmail: contactEmail.trim(),
        description: description.trim() || null,
      });
      setBusinessName('');
      setDescription('');
      Alert.alert('신청 완료', '주최자 승인 신청을 접수했습니다.');
      await load();
    } catch (error: any) {
      Alert.alert('신청 실패', error.message || '신청을 처리하지 못했습니다.');
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
            <Text style={styles.eyebrow}>Organizer Console</Text>
            <Text style={styles.title}>주최자 센터</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('OrganizerProfile')}>
            <Text style={styles.profileButtonText}>내 정보</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>이벤트 등록, 판매 현황 확인, 주최자 승인 신청을 한 곳에서 처리합니다.</Text>
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
          <Text style={styles.cardText}>
            이벤트를 등록하려면 관리자 승인이 필요합니다. 신청 후 승인 상태는 이 화면에서 확인할 수 있습니다.
          </Text>

          {latestApplication ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>최근 신청 상태</Text>
              <Text style={styles.statusValue}>{APPLICATION_LABEL[latestStatus ?? 'PENDING'] ?? latestStatus}</Text>
              <Text style={styles.statusMeta}>{latestApplication.businessName ?? businessName}</Text>
              {latestStatus === 'PENDING' ? (
                <Text style={styles.statusHelp}>관리자 승인 전까지 새 신청을 보낼 수 없습니다. 아래로 당겨 새로고침하면 최신 상태를 확인합니다.</Text>
              ) : null}
              {latestStatus === 'REJECTED' ? (
                <Text style={styles.statusHelp}>거절되었습니다. 내용을 보완해서 다시 신청해 주세요.</Text>
              ) : null}
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

              <TouchableOpacity
                style={[styles.primaryButton, submitting && styles.disabledButton]}
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
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>운영 이벤트</Text>
              <Text style={styles.metricValue}>{events.length}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>활성 이벤트</Text>
              <Text style={styles.metricValue}>{activeEvents}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>판매 티켓</Text>
              <Text style={styles.metricValue}>{soldTickets}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('EventCreate')}>
              <Text style={styles.primaryButtonText}>이벤트 등록</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('MyEvents')}>
              <Text style={styles.secondaryButtonText}>내 이벤트 관리</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.cardTitle}>최근 이벤트</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyEvents')}>
                <Text style={styles.linkText}>전체 보기</Text>
              </TouchableOpacity>
            </View>

            {events.length === 0 ? (
              <Text style={styles.emptyText}>아직 등록한 이벤트가 없습니다.</Text>
            ) : (
              events.map((event) => (
                <TouchableOpacity key={event.id} style={styles.eventRow} onPress={() => navigation.navigate('OrganizerEventDetail', { eventId: event.id })}>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{eventTitle(event)}</Text>
                    <Text style={styles.eventMeta}>{event.venue} · {eventDate(event)}</Text>
                  </View>
                  <Text style={styles.badge}>{event.status}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  header: { marginBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  profileButton: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  profileButtonText: { color: '#0F172A', fontWeight: '900' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 12 },
  cardTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 21 },
  statusBox: { marginTop: 14, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#EFF6FF' },
  statusLabel: { color: '#2563EB', fontSize: 12, fontWeight: '800' },
  statusValue: { marginTop: 4, fontSize: 18, fontWeight: '900', color: '#1E40AF' },
  statusMeta: { marginTop: 3, color: '#475569' },
  statusHelp: { marginTop: 8, color: '#475569', fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, marginTop: 10, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  metricGrid: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  actions: { marginTop: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  linkText: { color: '#2563EB', fontWeight: '800' },
  emptyText: { color: '#94A3B8', paddingVertical: 18, textAlign: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  eventInfo: { flex: 1, paddingRight: 10 },
  eventTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  eventMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
});
