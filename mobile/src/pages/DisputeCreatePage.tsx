import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { DisputeRecord } from '../types/api';

const DISPUTE_TYPES = [
  { value: 'TICKET_NOT_DELIVERED', label: '티켓 미전달' },
  { value: 'PAYMENT_ISSUE', label: '결제 문제' },
  { value: 'FRAUD_SUSPECTED', label: '사기 의심' },
  { value: 'OTHER', label: '기타' },
];

export default function DisputeCreatePage({ route, navigation }: any) {
  const editingDispute = route?.params?.dispute as DisputeRecord | undefined;
  const isEditing = Boolean(editingDispute?.id);

  const [type, setType] = useState(editingDispute?.type || route?.params?.type || 'OTHER');
  const [ticketId, setTicketId] = useState(
    editingDispute?.ticketId ? String(editingDispute.ticketId) : route?.params?.ticketId ? String(route.params.ticketId) : '',
  );
  const [resaleListingId, setResaleListingId] = useState(
    editingDispute?.resaleListingId
      ? String(editingDispute.resaleListingId)
      : route?.params?.resaleListingId
        ? String(route.params.resaleListingId)
        : '',
  );
  const [description, setDescription] = useState(editingDispute?.description || '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const title = isEditing ? '분쟁 신고 수정' : '분쟁 신고';
  const submitText = useMemo(() => {
    if (submitting) return isEditing ? '수정 중...' : '접수 중...';
    return isEditing ? '분쟁 신고 수정' : '분쟁 신고 접수';
  }, [isEditing, submitting]);

  const submit = async () => {
    if (!isEditing && !ticketId.trim() && !resaleListingId.trim()) {
      Alert.alert('입력 필요', '티켓 ID 또는 리셀 거래 ID 중 하나가 필요합니다.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('입력 필요', '분쟁 내용을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setFeedback('');
    try {
      if (isEditing && editingDispute?.id) {
        await backendApi.updateDispute(String(editingDispute.id), {
          type,
          description: description.trim(),
        });
        Alert.alert('수정 완료', '분쟁 신고 내용이 수정되었습니다.');
      } else {
        await backendApi.createDispute({
          ticketId: ticketId.trim() || null,
          resaleListingId: resaleListingId.trim() || null,
          type,
          description: description.trim(),
        });
        Alert.alert('신고 완료', '분쟁 신고가 접수되었습니다.');
      }
      navigation.replace('MyDisputes');
    } catch (cause: any) {
      const message = errorMessage(
        cause,
        isEditing ? '분쟁 신고를 수정하지 못했습니다.' : '분쟁 신고를 접수하지 못했습니다.',
      );
      const visibleMessage = message.includes('이미 처리 중') ? '이미 처리 중인 분쟁 신고가 있습니다.' : message;
      setFeedback(visibleMessage);
      Alert.alert(isEditing ? '수정 실패' : '신고 실패', visibleMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Dispute</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {isEditing ? '접수 단계의 분쟁 신고 사유와 내용을 수정합니다.' : '리셀 거래 또는 티켓 문제를 관리자에게 신고합니다.'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>분쟁 유형</Text>
        <View style={styles.typeGrid}>
          {DISPUTE_TYPES.map((item) => (
            <TouchableOpacity key={item.value} style={[styles.typeChip, type === item.value && styles.activeTypeChip]} onPress={() => setType(item.value)}>
              <Text style={[styles.typeChipText, type === item.value && styles.activeTypeChipText]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>티켓 ID</Text>
        <TextInput
          style={[styles.input, isEditing && styles.readOnlyInput]}
          value={ticketId}
          onChangeText={setTicketId}
          placeholder="선택 입력"
          autoCapitalize="none"
          editable={!isEditing}
        />
        <Text style={styles.label}>리셀 거래 ID</Text>
        <TextInput
          style={[styles.input, isEditing && styles.readOnlyInput]}
          value={resaleListingId}
          onChangeText={setResaleListingId}
          placeholder="선택 입력"
          autoCapitalize="none"
          editable={!isEditing}
        />
        {isEditing ? <Text style={styles.helper}>신고 수정 시에는 분쟁 유형과 신고 내용만 변경할 수 있습니다.</Text> : null}

        <Text style={styles.label}>신고 내용</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="상황을 구체적으로 입력해 주세요."
          multiline
        />
      </View>

      {feedback ? (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.submitButton, submitting && styles.disabled]} disabled={submitting} onPress={submit}>
        <Text style={styles.submitButtonText}>{submitText}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  readOnlyInput: { backgroundColor: '#F8FAFC', color: '#64748B' },
  helper: { marginTop: 8, color: '#64748B', fontSize: 12, lineHeight: 18 },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeTypeChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  typeChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeTypeChipText: { color: '#2563EB' },
  feedbackBox: { marginTop: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 12 },
  feedbackText: { color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  submitButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
