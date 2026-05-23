import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { backendApi } from '../lib/backend';
import { formatTicketStatus, formatTicketValidity } from '../lib/ticketDisplay';
import type { TicketDetail } from '../types/api';

export default function TicketResaleCreatePage({ route, navigation }: any) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [validity, setValidity] = useState<Record<string, unknown> | null>(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [ticketData, validityData] = await Promise.all([
          backendApi.getTicket(String(ticketId)),
          backendApi.getTicketValidity(String(ticketId)),
        ]);
        setTicket(ticketData);
        setValidity(validityData);
        setPrice(String(ticketData.originalPriceWei ?? ticketData.priceWei ?? ''));
      } catch (error: any) {
        Alert.alert('오류', error.message || '티켓 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ticketId]);

  const handleCreateResale = async () => {
    if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert('입력 오류', '판매 가격을 WEI 단위 숫자로 입력하세요.');
      return;
    }

    setSubmitting(true);
    try {
      const listing = await backendApi.createResale(String(ticketId), price);
      navigation.replace('ResaleRegisterComplete', { listingId: listing.id ?? listing.listingId, ticketId });
    } catch (error: any) {
      Alert.alert('등록 실패', error.message || '판매 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>티켓 판매 등록</Text>
      <Text style={styles.description}>판매할 가격을 입력하면 공식 리셀 목록에 등록됩니다.</Text>

      <View style={styles.card}>
        <Info label="티켓" value={ticket?.seatInfo || String(ticketId)} />
        <Info label="상태" value={formatTicketStatus(ticket?.status)} />
        <Info label="유효성" value={formatTicketValidity(validity)} />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>판매 가격(WEI)</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="예: 10000" keyboardType="numeric" />
      </View>

      <TouchableOpacity style={[styles.submitButton, submitting && styles.disabledButton]} onPress={handleCreateResale} disabled={submitting}>
        <Text style={styles.submitButtonText}>{submitting ? '등록 중...' : '판매 등록하기'}</Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 28 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 12, color: '#212529' },
  description: { fontSize: 15, color: '#868E96', lineHeight: 22, marginBottom: 24 },
  card: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 22 },
  infoRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  infoLabel: { color: '#868E96', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  infoValue: { color: '#212529', fontWeight: '900' },
  inputContainer: { marginBottom: 30 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#495057', marginBottom: 10 },
  input: { backgroundColor: '#F1F3F5', padding: 15, borderRadius: 10, fontSize: 18, fontWeight: 'bold' },
  submitButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center' },
  disabledButton: { opacity: 0.55 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
