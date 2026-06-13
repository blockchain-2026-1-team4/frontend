import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  EventFlowHero,
  EventFlowMenuRow,
  EventFlowSectionHead,
  EventFlowTopBar,
  eventFlowStyles,
} from '../components/EventFlowKit';
import { TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { issueFanClubMembershipOnChain, setMembershipPolicyOnChain } from '../lib/blockchain/client';
import { resolveImageUrl } from '../lib/config';
import { formatEventCategory, formatEventRange, getEventDisplayStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

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

function statusTone(tone: string): 'green' | 'purple' | 'gray' | 'red' | 'yellow' {
  if (tone === 'green') return 'green';
  if (tone === 'red') return 'red';
  if (tone === 'yellow') return 'yellow';
  if (tone === 'purple' || tone === 'blue') return 'purple';
  return 'gray';
}

function firstTicketPriceWei(event: EventDetail, tickets: TicketDetail[]) {
  return tickets.find((ticket) => ticket.originalPriceWei || ticket.priceWei)?.originalPriceWei
    ?? tickets.find((ticket) => ticket.originalPriceWei || ticket.priceWei)?.priceWei
    ?? event.ticketPriceWei
    ?? '';
}

function weiToKaiaLabel(value?: string | null) {
  if (!value) return '-';
  try {
    const wei = BigInt(value);
    const whole = wei / 1_000_000_000_000_000_000n;
    const fraction = (wei % 1_000_000_000_000_000_000n).toString().padStart(18, '0').replace(/0+$/, '');
    return `${fraction ? `${whole}.${fraction}` : whole.toString()} KAIA`;
  } catch {
    return `${value} wei`;
  }
}

function isValidAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export default function OrganizerEventDetailPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [membershipAddress, setMembershipAddress] = useState('');
  const [membershipBusy, setMembershipBusy] = useState<'issue' | 'policy' | null>(null);
  const [membershipStatus, setMembershipStatus] = useState('');

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    try {
      const [detail, eventTickets] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => []),
      ]);
      setEvent(detail);
      setTickets(eventTickets);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('MyEvents');
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#534AB7" /><Text style={styles.loadingText}>이벤트 상세 정보를 불러오고 있습니다.</Text></View>;
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>이벤트를 찾을 수 없습니다.</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={goBack}><Text style={styles.emptyButtonText}>돌아가기</Text></TouchableOpacity>
      </View>
    );
  }

  const soldTickets = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
  const usedTickets = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
  const totalTickets = Number(event.totalTicketCount ?? 0) || tickets.length;
  const issuedTickets = tickets.length;
  const soldPct = totalTickets > 0 ? Math.min(100, (soldTickets / totalTickets) * 100) : 0;
  const displayStatus = getEventDisplayStatus(event);
  const issuedMessage = issuedTickets > 0 ? '발행된 티켓이 있어 일정은 제한적으로 수정됩니다.' : '티켓 발행 전에는 회차 일정을 자유롭게 수정할 수 있습니다.';
  const contractEventId = event.contractEventId ? String(event.contractEventId) : '';
  const membershipPriceWei = firstTicketPriceWei(event, tickets);
  const hasMintedTicket = tickets.some((ticket) => ticket.contractTokenId);
  const canSetupMembership = Boolean(contractEventId && membershipPriceWei && hasMintedTicket);
  const membershipSetupHint = !contractEventId
    ? '티켓 발행 후 온체인 이벤트 ID가 생성되면 설정할 수 있습니다.'
    : !hasMintedTicket
      ? '티켓 민팅이 완료된 뒤 설정할 수 있습니다.'
      : membershipPriceWei
        ? `선예매 가격은 현재 티켓 가격과 같은 ${weiToKaiaLabel(membershipPriceWei)}로 설정됩니다.`
        : '티켓 가격을 확인할 수 없습니다.';

  const issueMembership = async () => {
    const address = membershipAddress.trim();
    setMembershipStatus('멤버십 NFT 발급 요청을 준비하고 있습니다.');
    if (!isValidAddress(address)) {
      setMembershipStatus('지갑 주소 형식이 올바르지 않습니다.');
      Alert.alert('지갑 주소 확인', '멤버십을 발급할 지갑 주소를 정확히 입력해주세요.');
      return;
    }
    try {
      setMembershipBusy('issue');
      setMembershipStatus('MetaMask에 FanClubMembership 발급 트랜잭션을 요청했습니다.');
      const hash = await issueFanClubMembershipOnChain(undefined, address);
      setMembershipStatus('멤버십 NFT 발급 트랜잭션이 확정되었습니다.');
      Alert.alert('멤버십 발급 완료', `FanClubMembership NFT가 발급되었습니다.\n\n${hash}`);
    } catch (error: any) {
      setMembershipStatus(errorMessage(error, '멤버십 NFT 발급에 실패했습니다.'));
      Alert.alert('멤버십 발급 실패', errorMessage(error, 'MEMBERSHIP_ISSUER_ROLE이 있는 지갑으로 서명해야 합니다.'));
    } finally {
      setMembershipBusy(null);
    }
  };

  const enableMembershipPresale = async () => {
    setMembershipStatus('팬클럽 선예매 정책 적용 요청을 준비하고 있습니다.');
    if (!canSetupMembership) {
      setMembershipStatus(membershipSetupHint);
      Alert.alert('선예매 설정 불가', membershipSetupHint);
      return;
    }
    try {
      setMembershipBusy('policy');
      const now = Math.floor(Date.now() / 1000);
      setMembershipStatus('MetaMask에 TrustTicket 선예매 정책 트랜잭션을 요청했습니다.');
      const hash = await setMembershipPolicyOnChain(
        undefined,
        contractEventId,
        membershipPriceWei,
        now - 300,
        now + 2 * 60 * 60,
        false,
      );
      setMembershipStatus('팬클럽 선예매 정책이 온체인에 적용되었습니다.');
      Alert.alert('선예매 설정 완료', `팬클럽 NFT 보유자만 현재 티켓 가격으로 구매할 수 있습니다.\n\n${hash}`);
    } catch (error: any) {
      setMembershipStatus(errorMessage(error, '팬클럽 선예매 정책 적용에 실패했습니다.'));
      Alert.alert('선예매 설정 실패', errorMessage(error, '이벤트 주최자 또는 관리자 권한이 있는 지갑으로 서명해야 합니다.'));
    } finally {
      setMembershipBusy(null);
    }
  };

  return (
    <ScrollView
      style={eventFlowStyles.container}
      contentContainerStyle={eventFlowStyles.content}
      stickyHeaderIndices={[0]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <EventFlowTopBar eyebrow="Event Console" title="이벤트 상세" badge={displayStatus.label} badgeTone={statusTone(displayStatus.tone)} onBack={goBack} />
      <EventFlowHero
        size="lg"
        badge={formatEventCategory(event.category)}
        title={eventTitle(event)}
        meta={`${event.venue || '장소 미정'} · ${roundSummary(event)}\n${issuedMessage}`}
        posters
        imageUrl={resolveImageUrl(event.imageUrl)}
      />

      <View style={styles.stats}>
        <Stat icon="ticket" value={totalTickets} label="총 티켓" />
        <Stat icon="tag" value={issuedTickets} label="발행" />
        <Stat icon="cart" value={soldTickets} label="판매" />
        <Stat icon="userCheck" value={usedTickets} label="입장" />
      </View>

      <View style={eventFlowStyles.section}>
        <EventFlowSectionHead title="이벤트 관리" subtitle="정보 수정과 공개 상태를 관리합니다." />
        <View style={[eventFlowStyles.card, styles.menuCard]}>
          <EventFlowMenuRow icon="edit" title="기본 정보 수정" subtitle="이름, 장소, 소개, 포스터를 수정합니다." onPress={() => navigation.navigate('EventSettings', { eventId: event.id, mode: 'info' })} />
          <EventFlowMenuRow icon="calendarTime" iconTone="green" title="회차 일정 관리" subtitle="발행 전 회차는 날짜와 시간을 수정할 수 있습니다." onPress={() => navigation.navigate('EventSettings', { eventId: event.id, mode: 'schedule' })} />
          <EventFlowMenuRow icon="eye" iconTone="red" title="이벤트 상태 변경" subtitle="게시중, 비공개, 취소 상태로 전환합니다." last onPress={() => navigation.navigate('EventSettings', { eventId: event.id, mode: 'status' })} />
        </View>
      </View>

      <View style={eventFlowStyles.section}>
        <EventFlowSectionHead title="티켓 운영" subtitle="발행과 판매 현황" />
        <View style={styles.operationGrid}>
          <TouchableOpacity style={[styles.operationCard, styles.operationPrimary]} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id, returnTo: 'detail' })}>
            <View style={styles.operationIcon}><TicketIcon name="ticket" color="#534AB7" size={20} /></View>
            <Text style={styles.operationTitle}>티켓 발행</Text>
            <Text style={styles.operationSubtitle}>좌석과 판매 정책을 설정합니다.</Text>
            <Text style={styles.operationLink}>설정하기  ›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.operationCard} onPress={() => navigation.navigate('SalesStatus', { eventId: event.id })}>
            <View style={styles.operationIcon}><TicketIcon name="chart" color="#534AB7" size={20} /></View>
            <Text style={styles.operationTitle}>판매 현황</Text>
            <View style={styles.progressTop}><Text style={styles.progressText}>{soldTickets}/{totalTickets}</Text><Text style={styles.progressText}>{soldPct.toFixed(soldPct < 1 && soldPct > 0 ? 1 : 0)}%</Text></View>
            <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${soldPct}%` }]} /></View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={eventFlowStyles.section}>
        <EventFlowSectionHead title="팬클럽 선예매" subtitle="Scenario B 데모 설정" />
        <View style={[eventFlowStyles.card, styles.membershipCard]}>
          <View style={styles.membershipHeader}>
            <View style={styles.membershipIcon}><TicketIcon name="userCheck" color="#24745B" size={18} /></View>
            <View style={styles.membershipHeaderText}>
              <Text style={styles.membershipTitle}>멤버십 NFT 기반 구매 제한</Text>
              <Text style={styles.membershipSubtitle}>FanClubMembership NFT 보유 지갑만 선예매 기간에 구매할 수 있게 설정합니다.</Text>
            </View>
          </View>

          <View style={styles.membershipInfoGrid}>
            <InfoCell label="온체인 이벤트" value={contractEventId ? `Event #${contractEventId}` : '티켓 발행 필요'} />
            <InfoCell label="선예매 가격" value={weiToKaiaLabel(membershipPriceWei)} />
          </View>

          <Text style={styles.fieldLabel}>멤버십 발급 대상 지갑</Text>
          <TextInput
            value={membershipAddress}
            onChangeText={setMembershipAddress}
            placeholder="0x..."
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.addressInput}
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.membershipActions}>
            <TouchableOpacity
              style={[styles.membershipButton, membershipBusy && styles.disabledButton]}
              disabled={Boolean(membershipBusy)}
              onPress={() => { void issueMembership(); }}
              accessibilityRole="button"
            >
              <Text style={styles.membershipButtonText}>{membershipBusy === 'issue' ? '발급 중...' : 'NFT 발급'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.membershipButton, styles.membershipButtonPrimary, (!canSetupMembership || Boolean(membershipBusy)) && styles.disabledButton]}
              disabled={!canSetupMembership || Boolean(membershipBusy)}
              onPress={() => { void enableMembershipPresale(); }}
              accessibilityRole="button"
            >
              <Text style={[styles.membershipButtonText, styles.membershipButtonPrimaryText]}>{membershipBusy === 'policy' ? '설정 중...' : '선예매 적용'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.membershipHint}>{membershipSetupHint}</Text>
          {membershipStatus ? <Text style={styles.membershipStatus}>{membershipStatus}</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ icon, value, label }: { icon: 'ticket' | 'tag' | 'cart' | 'userCheck'; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}><TicketIcon name={icon} color="#534AB7" size={16} /></View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#F6F7FB' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 13 },
  emptyTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  emptyButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: '#534AB7' },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 18, ...flowShadow },
  statIcon: { width: 30, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE', marginBottom: 8 },
  statValue: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  statLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', marginTop: 2 },
  menuCard: { overflow: 'hidden', ...flowShadow },
  operationGrid: { flexDirection: 'row', gap: 10 },
  operationCard: { flex: 1, minHeight: 118, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, ...flowShadow },
  operationPrimary: { borderWidth: 1.5, borderColor: '#D8D4FF', backgroundColor: '#FBFAFF' },
  operationIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE', marginBottom: 10 },
  operationTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 3 },
  operationSubtitle: { color: '#64748B', fontSize: 10, lineHeight: 14 },
  operationLink: { color: '#534AB7', fontSize: 12, fontWeight: '900', marginTop: 12 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13, marginBottom: 5 },
  progressText: { color: '#64748B', fontSize: 10, fontWeight: '900' },
  progressBg: { height: 7, borderRadius: 999, overflow: 'hidden', backgroundColor: '#EEF2F7' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#534AB7' },
  membershipCard: { padding: 16, ...flowShadow },
  membershipHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  membershipIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F5EE' },
  membershipHeaderText: { flex: 1 },
  membershipTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  membershipSubtitle: { marginTop: 3, color: '#64748B', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  membershipInfoGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  infoCell: { flex: 1, minHeight: 62, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  infoLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', marginBottom: 5 },
  infoValue: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  fieldLabel: { color: '#334155', fontSize: 11, fontWeight: '900', marginBottom: 7 },
  addressInput: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingHorizontal: 12, color: '#0F172A', fontSize: 12, fontWeight: '800' },
  membershipActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  membershipButton: { flex: 1, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  membershipButtonPrimary: { borderColor: '#24745B', backgroundColor: '#24745B' },
  membershipButtonText: { color: '#334155', fontSize: 13, fontWeight: '900' },
  membershipButtonPrimaryText: { color: '#FFFFFF' },
  disabledButton: { opacity: 0.55 },
  membershipHint: { marginTop: 10, color: '#64748B', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  membershipStatus: { marginTop: 8, color: '#24745B', fontSize: 10, lineHeight: 14, fontWeight: '900' },
});
