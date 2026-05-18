import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { DisputeRecord } from '../types/api';

const STATUS_LABEL: Record<string, string> = {
  OPEN: '접수',
  REVIEWING: '검토중',
  RESOLVED: '해결',
  REJECTED: '반려',
};

const TYPE_LABEL: Record<string, string> = {
  TICKET_NOT_DELIVERED: '티켓 미전달',
  PAYMENT_ISSUE: '결제 문제',
  FRAUD_SUSPECTED: '사기 의심',
  OTHER: '기타',
};

export default function MyDisputesPage({ navigation }: any) {
  const [items, setItems] = useState<DisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Disputes</Text>
        <Text style={styles.title}>내 분쟁 신고</Text>
        <Text style={styles.subtitle}>내가 접수한 신고와 관리자 처리 상태를 확인합니다.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('DisputeCreate')}>
          <Text style={styles.buttonText}>새 분쟁 신고</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item, index) => String(item.id ?? index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>접수한 분쟁 신고가 없습니다.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.status}>{STATUS_LABEL[item.status ?? 'OPEN'] ?? item.status ?? '접수'}</Text>
            <Text style={styles.cardTitle}>{TYPE_LABEL[item.type ?? 'OTHER'] ?? item.type ?? '분쟁'}</Text>
            <Text style={styles.meta}>티켓 {item.ticketId ?? '-'} · 리셀 {item.resaleListingId ?? '-'}</Text>
            <Text style={styles.description}>{item.description}</Text>
            {item.resolutionNote ? <Text style={styles.note}>처리 메모: {item.resolutionNote}</Text> : null}
          </View>
        )}
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
  empty: { color: '#94A3B8', textAlign: 'center', marginTop: 40, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  status: { color: '#2563EB', fontWeight: '900', marginBottom: 6 },
  cardTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  meta: { marginTop: 6, color: '#64748B', fontSize: 12 },
  description: { marginTop: 10, color: '#334155', lineHeight: 20 },
  note: { marginTop: 10, color: '#166534', fontWeight: '800', lineHeight: 20 },
});
