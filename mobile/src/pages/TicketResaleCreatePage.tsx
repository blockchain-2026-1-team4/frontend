import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from '../components/TextInput';
import WalletRequiredView from '../components/WalletRequiredView';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { ethToWei, formatEventDate, formatTicketStatus, formatTicketValidity, isEventEnded, weiToEthValue } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail, UserProfile } from '../types/api';

function normalizeResaleFailure(cause: any) {
  const message = errorMessage(cause, '리셀 등록에 실패했습니다.');
  if (message.includes('소유') || message.includes('owner') || message.includes('FORBIDDEN')) {
    return '본인 소유 티켓만 리셀할 수 있습니다.';
  }
  if (message.includes('이미') || message.includes('LISTED') || message.includes('등록 중')) {
    return '이미 판매 등록된 티켓입니다.';
  }
  if (message.includes('사용') || message.includes('USED')) {
    return '사용 완료된 티켓은 리셀할 수 없습니다.';
  }
  if (message.includes('종료')) {
    return '종료된 이벤트의 티켓은 리셀 등록할 수 없습니다.';
  }
  if (message.includes('만료') || message.includes('EXPIRED')) {
    return '만료된 티켓은 리셀할 수 없습니다.';
  }
  if (message.includes('허용') || message.includes('정책') || message.includes('resaleAllowed')) {
    return '리셀 정책상 판매가 제한된 티켓입니다.';
  }
  if (message.includes('기간')) {
    return '현재는 이 티켓을 리셀할 수 있는 기간이 아닙니다.';
  }
  if (message.includes('상한') || message.includes('가격')) {
    return '리셀 가능 가격을 초과했습니다.';
  }
  if (message.includes('활성') || message.includes('이벤트')) {
    return '판매 가능한 이벤트의 티켓만 리셀할 수 있습니다.';
  }
  return message;
}

function localBlockReason(ticket: TicketDetail | null, event: EventDetail | null) {
  const status = String(ticket?.status ?? '').toUpperCase();
  const now = Date.now();

  if (status === 'LISTED') return '이미 판매 등록된 티켓입니다.';
  if (status === 'USED') return '사용 완료된 티켓은 리셀할 수 없습니다.';
  if (status === 'AVAILABLE') return '구매 완료된 본인 티켓만 리셀할 수 있습니다.';
  if (event?.status && event.status !== 'PUBLISHED') return '판매 가능한 이벤트의 티켓만 리셀할 수 있습니다.';
  if (isEventEnded(event)) return '종료된 이벤트의 티켓은 리셀 등록할 수 없습니다.';
  if (ticket && ticket.resaleEnabled === false) return '리셀 정책상 판매가 제한된 티켓입니다.';
  if (event && event.resaleAllowed === false) return '이 이벤트는 리셀을 허용하지 않습니다.';
  if (event?.resaleStart && now < new Date(event.resaleStart).getTime()) return '아직 리셀 가능 기간이 아닙니다.';
  if (event?.resaleEnd && now > new Date(event.resaleEnd).getTime()) return '리셀 가능 기간이 종료되었습니다.';
  return '';
}

export default function TicketResaleCreatePage({ route, navigation }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [validity, setValidity] = useState<Record<string, unknown> | null>(null);
  const [priceEth, setPriceEth] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [ticketData, validityData, meData] = await Promise.all([
          backendApi.getTicket(String(ticketId)),
          backendApi.getTicketValidity(String(ticketId)),
          backendApi.getMe().catch(() => null),
        ]);
        const eventData = ticketData.eventId ? await backendApi.getEvent(String(ticketData.eventId)).catch(() => null) : null;
        setTicket(ticketData);
        setEvent(eventData);
        setValidity(validityData);
        setMe(meData);
        const initialEth = weiToEthValue(ticketData.originalPriceWei ?? ticketData.priceWei);
        setPriceEth(initialEth);
      } catch (error: any) {
        Alert.alert('오류', errorMessage(error, '티켓 정보를 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [ticketId]);

  const blockReason = useMemo(() => localBlockReason(ticket, event), [ticket, event]);

  const handleCreateResale = async () => {
    if (blockReason) {
      setFeedback(blockReason);
      Alert.alert('리셀 등록 불가', blockReason);
      return;
    }
    const ethNum = Number(priceEth);
    if (!priceEth || Number.isNaN(ethNum) || ethNum <= 0) {
      const message = '리셀 가격을 ETH 단위로 입력해주세요. (예: 0.1)';
      setFeedback(message);
      Alert.alert('입력 오류', message);
      return;
    }

    setSubmitting(true);
    setFeedback('');
    try {
      const priceWei = ethToWei(priceEth);
      const listing = await backendApi.createResale(String(ticketId), priceWei);
      navigation.replace('ResaleRegisterComplete', { listingId: listing.id ?? listing.listingId, ticketId });
    } catch (error: any) {
      const message = normalizeResaleFailure(error);
      setFeedback(message);
      Alert.alert('등록 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  if (!me?.walletAddress?.trim()) return <WalletRequiredView navigation={navigation} feature="리셀 등록" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>티켓 리셀 등록</Text>
      <Text style={styles.description}>판매 가격을 입력하면 공식 리셀 목록에 등록됩니다.</Text>

      <View style={styles.card}>
        <Info label="이벤트" value={event?.name || event?.title || ticket?.eventName || ticket?.eventTitle || '-'} />
        <Info label="일시" value={formatEventDate(event?.eventAt || event?.eventDateTime || ticket?.eventDateTime)} />
        <Info label="좌석" value={ticket?.seatInfo || String(ticketId)} />
        <Info label="상태" value={formatTicketStatus(ticket?.status)} />
        <Info label="사용 가능 여부" value={formatTicketValidity(validity)} />
      </View>

      {blockReason ? (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{blockReason}</Text>
        </View>
      ) : null}

      <View style={styles.inputContainer}>
        <Text style={styles.label}>리셀 가격 (ETH)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={priceEth}
            onChangeText={setPriceEth}
            placeholder="예: 0.1"
            keyboardType="decimal-pad"
          />
          <Text style={styles.unit}>ETH</Text>
        </View>
      </View>

      {feedback && feedback !== blockReason ? (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.submitButton, (submitting || Boolean(blockReason)) && styles.disabledButton]}
        onPress={handleCreateResale}
        disabled={submitting}
      >
        <Text style={styles.submitButtonText}>
          {submitting ? '등록 중...' : blockReason ? '리셀 등록 불가' : '리셀 등록하기'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 20, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 12, color: '#0F172A' },
  description: { fontSize: 15, color: '#64748B', lineHeight: 22, marginBottom: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  infoRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  infoValue: { color: '#0F172A', fontWeight: '900' },
  inputContainer: { marginTop: 8, marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '900', color: '#334155', marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 15,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  unit: { fontSize: 16, fontWeight: '900', color: '#334155', minWidth: 36 },
  feedbackBox: { marginBottom: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 12 },
  feedbackText: { color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  submitButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 14, alignItems: 'center' },
  disabledButton: { opacity: 0.55 },
  submitButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
});
