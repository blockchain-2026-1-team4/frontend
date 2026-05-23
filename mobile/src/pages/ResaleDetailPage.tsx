import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { EventDetail, ResaleListing, TicketDetail, UserProfile } from '../types/api';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '판매중',
  SOLD: '판매완료',
  CLOSED: '판매종료',
  CANCELED: '취소됨',
  CANCELLED: '취소됨',
};

function statusLabel(status?: string) {
  const key = status?.toUpperCase() ?? '';
  return STATUS_LABEL[key] ?? status ?? '-';
}

function blockedPurchaseMessage(listing: ResaleListing | null, isMyListing: boolean) {
  if (!listing) return '리셀 티켓 정보를 확인할 수 없습니다.';
  const status = listing.status?.toUpperCase();
  if (isMyListing) return '본인이 등록한 리셀 티켓은 구매할 수 없습니다.';
  if (status === 'SOLD') return '이미 판매 완료된 리셀 티켓입니다.';
  if (status === 'CLOSED') return '판매가 종료된 리셀 티켓입니다.';
  if (status === 'CANCELED' || status === 'CANCELLED') return '취소된 리셀 티켓입니다.';
  if (status !== 'ACTIVE') return '현재 구매할 수 없는 리셀 티켓입니다.';
  return '';
}

export default function ResaleDetailPage({ route, navigation }: any) {
  const { listingId } = route.params;
  const [listing, setListing] = useState<ResaleListing | null>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const listingData = await backendApi.getResaleListing(String(listingId));
        setListing(listingData);
        const [ticketData, eventData, meData] = await Promise.all([
          backendApi.getTicket(String(listingData.ticketId)),
          backendApi.getEvent(String(listingData.eventId)),
          backendApi.getMe().catch(() => null),
        ]);
        setTicket(ticketData);
        setEvent(eventData);
        setMe(meData);
      } catch (cause: any) {
        Alert.alert('오류', errorMessage(cause, '리셀 티켓 정보를 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [listingId]);

  const isMyListing = Boolean(listing?.sellerId && me?.id && listing.sellerId === me.id);
  const blockMessage = useMemo(() => blockedPurchaseMessage(listing, isMyListing), [listing, isMyListing]);
  const isBlocked = Boolean(blockMessage);

  const buttonText = useMemo(() => {
    if (submitting) return '구매 처리 중...';
    if (isMyListing) return '내가 등록한 티켓';
    const status = listing?.status?.toUpperCase();
    if (status === 'SOLD') return '판매완료';
    if (status === 'CLOSED') return '판매종료';
    if (status === 'CANCELED' || status === 'CANCELLED') return '취소됨';
    if (status !== 'ACTIVE') return '구매 불가';
    return '리셀 티켓 구매하기';
  }, [isMyListing, listing?.status, submitting]);

  const purchase = async () => {
    if (blockMessage) {
      setFeedback(blockMessage);
      Alert.alert('구매 불가', blockMessage);
      return;
    }

    setSubmitting(true);
    setFeedback('');
    try {
      const purchased = await backendApi.purchaseResale(String(listingId));
      navigation.replace('PurchaseComplete', {
        type: 'resale',
        listingId: purchased.id ?? purchased.listingId,
        ticketId: purchased.ticketId,
        eventId: purchased.eventId,
      });
    } catch (cause: any) {
      const message = errorMessage(cause, '리셀 티켓 구매에 실패했습니다.');
      setFeedback(message);
      Alert.alert('구매 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!listing) return <View style={styles.center}><Text>리셀 등록을 찾을 수 없습니다.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.status}>{statusLabel(listing.status)}</Text>
        <Text style={styles.title}>{event?.name || listing.eventName || '리셀 티켓'}</Text>
        <Text style={styles.meta}>{event?.venue || '-'}</Text>
        <Text style={styles.meta}>{event?.eventAt ? new Date(event.eventAt).toLocaleString() : '-'}</Text>
      </View>

      <View style={styles.card}>
        <Info label="좌석" value={ticket?.seatInfo || listing.seatInfo || '-'} />
        <Info label="리셀 가격" value={`${listing.priceWei ?? listing.price ?? '-'} WEI`} />
        <Info label="티켓 ID" value={String(listing.ticketId)} />
      </View>

      {(feedback || isBlocked) ? (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{feedback || blockMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.button, (submitting || isBlocked) && styles.disabledButton]}
        disabled={submitting}
        onPress={purchase}
      >
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('DisputeCreate', { resaleListingId: listing.id ?? listing.listingId, ticketId: listing.ticketId })}
      >
        <Text style={styles.secondaryButtonText}>이 리셀 거래 분쟁 신고</Text>
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E9ECEF' },
  status: { color: '#007AFF', fontWeight: '900', marginBottom: 8 },
  title: { color: '#212529', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  meta: { color: '#868E96', marginBottom: 4 },
  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  infoLabel: { color: '#868E96', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  infoValue: { color: '#212529', fontWeight: '900' },
  feedbackBox: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: 12, padding: 12, marginBottom: 12 },
  feedbackText: { color: '#9A3412', fontWeight: '800', lineHeight: 20 },
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  disabledButton: { backgroundColor: '#94A3B8' },
  secondaryButton: { borderWidth: 1, borderColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '900' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
