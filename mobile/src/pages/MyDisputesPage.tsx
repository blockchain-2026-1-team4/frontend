import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { DisputeRecord } from '../types/api';

const STATUS_LABEL: Record<string, string> = {
  OPEN: '접수됨',
  RECEIVED: '접수됨',
  REVIEWING: '처리 중',
  PROCESSING: '처리 중',
  RESOLVED: '해결 완료',
  REJECTED: '반려',
  CLOSED: '종료',
  CANCELED: '취소됨',
  CANCELLED: '취소됨',
};

const TYPE_LABEL: Record<string, string> = {
  TICKET_NOT_DELIVERED: '티켓 미전달',
  PAYMENT_ISSUE: '결제 문제',
  FRAUD_SUSPECTED: '사기 의심',
  OTHER: '기타',
};

const EDITABLE_STATUSES = new Set(['OPEN', 'RECEIVED']);
const PROCESSING_STATUSES = new Set(['REVIEWING', 'PROCESSING']);
const DONE_STATUSES = new Set(['RESOLVED', 'REJECTED', 'CLOSED', 'CANCELED', 'CANCELLED']);

function getStatusBadge(status?: string) {
  const key = status?.toUpperCase() ?? 'OPEN';
  if (EDITABLE_STATUSES.has(key)) return { label: '수정/취소 가능', style: styles.badgeEditable, textStyle: styles.badgeEditableText };
  if (PROCESSING_STATUSES.has(key)) return { label: '처리 중', style: styles.badgeProcessing, textStyle: styles.badgeProcessingText };
  if (DONE_STATUSES.has(key)) return { label: STATUS_LABEL[key] ?? '완료', style: styles.badgeDone, textStyle: styles.badgeDoneText };
  return { label: STATUS_LABEL[key] ?? key, style: styles.badgeDefault, textStyle: styles.badgeDefaultText };
}

export default function MyDisputesPage({ navigation }: any) {
  const [items, setItems] = useState<DisputeRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cancelingId, setCancelingId] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await backendApi.getMyDisputes({ size: 50 });
      setItems(data.items ?? []);
    } catch (cause: any) {
      setError(errorMessage(cause, '분쟁 내역을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filteredItems = useMemo(() => {
    if (statusFilter === 'ALL') return items;
    if (statusFilter === 'ACTIVE') return items.filter((item) => {
      const status = item.status?.toUpperCase() ?? 'OPEN';
      return EDITABLE_STATUSES.has(status) || PROCESSING_STATUSES.has(status);
    });
    if (statusFilter === 'DONE') return items.filter((item) => DONE_STATUSES.has(item.status?.toUpperCase() ?? ''));
    return items;
  }, [items, statusFilter]);

  const cancelDispute = (item: DisputeRecord) => {
    const disputeId = String(item.id ?? '');
    if (!disputeId) return;
    Alert.alert('분쟁 신고 취소', '접수한 분쟁 신고를 취소할까요?', [
      { text: '아니요', style: 'cancel' },
      {
        text: '취소하기',
        style: 'destructive',
        onPress: async () => {
          setCancelingId(disputeId);
          try {
            await backendApi.cancelDispute(disputeId);
            Alert.alert('취소 완료', '분쟁 신고가 취소되었습니다.');
            await load();
          } catch (cause: any) {
            Alert.alert('취소 실패', errorMessage(cause, '처리 중이거나 완료된 분쟁 신고는 취소할 수 없습니다.'));
          } finally {
            setCancelingId('');
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Disputes</Text>
        <Text style={styles.title}>내 분쟁 신고</Text>
        <Text style={styles.subtitle}>접수한 신고의 처리 상태를 확인하고, 접수 단계 신고는 수정하거나 취소할 수 있습니다.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('DisputeCreate')}>
          <Text style={styles.buttonText}>새 분쟁 신고</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={filteredItems}
        keyExtractor={(item, index) => String(item.id ?? index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListHeaderComponent={(
          <View style={styles.filterRow}>
            {[
              { id: 'ALL', label: '전체' },
              { id: 'ACTIVE', label: '처리중' },
              { id: 'DONE', label: '완료' },
            ].map((item) => (
              <TouchableOpacity key={item.id} style={[styles.filterChip, statusFilter === item.id && styles.activeFilterChip]} onPress={() => setStatusFilter(item.id)}>
                <Text style={[styles.filterText, statusFilter === item.id && styles.activeFilterText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>접수한 분쟁 신고가 없습니다.</Text>}
        renderItem={({ item }) => {
          const statusKey = item.status?.toUpperCase() ?? 'OPEN';
          const editable = EDITABLE_STATUSES.has(statusKey);
          const badge = getStatusBadge(statusKey);
          const disabled = cancelingId === String(item.id ?? '');

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.status}>{STATUS_LABEL[statusKey] ?? item.status ?? '접수됨'}</Text>
                <View style={[styles.badge, badge.style]}>
                  <Text style={[styles.badgeText, badge.textStyle]}>{badge.label}</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{TYPE_LABEL[item.type ?? 'OTHER'] ?? item.type ?? '분쟁'}</Text>
              <Text style={styles.meta}>티켓 {item.ticketId ?? '-'} · 리셀 {item.resaleListingId ?? '-'}</Text>
              <Text style={styles.description}>{item.description}</Text>
              {item.resolutionNote ? <Text style={styles.note}>처리 메모: {item.resolutionNote}</Text> : null}
              {editable ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.editButton, styles.actionButton]} onPress={() => navigation.navigate('DisputeCreate', { dispute: item })}>
                    <Text style={styles.editButtonText}>신고 내용 수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelButton, styles.actionButton, disabled && styles.disabled]} disabled={disabled} onPress={() => cancelDispute(item)}>
                    <Text style={styles.cancelButtonText}>{disabled ? '취소 중...' : '신고 취소'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  header: { padding: 18, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  button: { marginTop: 14, backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  error: { marginTop: 12, color: '#DC2626', fontWeight: '800' },
  list: { padding: 18, paddingBottom: 96 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeFilterChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  activeFilterText: { color: '#2563EB' },
  empty: { color: '#94A3B8', textAlign: 'center', marginTop: 40, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  status: { color: '#2563EB', fontWeight: '900', marginBottom: 6 },
  cardTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  meta: { marginTop: 6, color: '#64748B', fontSize: 12 },
  description: { marginTop: 10, color: '#334155', lineHeight: 20 },
  note: { marginTop: 10, color: '#166534', fontWeight: '800', lineHeight: 20 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: '900' },
  badgeEditable: { backgroundColor: '#EFF6FF' },
  badgeEditableText: { color: '#2563EB' },
  badgeProcessing: { backgroundColor: '#FFF7ED' },
  badgeProcessingText: { color: '#C2410C' },
  badgeDone: { backgroundColor: '#F1F5F9' },
  badgeDoneText: { color: '#475569' },
  badgeDefault: { backgroundColor: '#F8FAFC' },
  badgeDefaultText: { color: '#64748B' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionButton: { flex: 1 },
  editButton: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  editButtonText: { color: '#2563EB', fontWeight: '900' },
  cancelButton: { borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  cancelButtonText: { color: '#DC2626', fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
