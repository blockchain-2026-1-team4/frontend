import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { EventDetail } from '../types/api';

const EVENT_CATEGORIES = [
  { value: 'CONCERT', label: '공연' },
  { value: 'SPORTS', label: '스포츠' },
  { value: 'EXHIBITION', label: '전시' },
  { value: 'FESTIVAL', label: '페스티벌' },
  { value: 'ETC', label: '기타' },
];

export default function EventSettingsPage({ route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('CONCERT');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [eventAt, setEventAt] = useState('');
  const [resaleAllowed, setResaleAllowed] = useState(true);
  const [maxResaleRate, setMaxResaleRate] = useState('120');
  const [resaleStart, setResaleStart] = useState('');
  const [resaleEnd, setResaleEnd] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [statusDraft, setStatusDraft] = useState('ACTIVE');
  const [resaleOpen, setResaleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const statusDescription =
    status === 'ACTIVE'
      ? '판매와 체크인이 가능한 상태입니다.'
      : status === 'INACTIVE'
        ? '운영중지 상태입니다. 판매/체크인이 일시 중단됩니다.'
        : '이벤트 취소 상태입니다. 이벤트 자체가 취소되어 복구가 제한될 수 있습니다.';

  const load = useCallback(async () => {
    try {
      const detail = await backendApi.getEvent(eventId);
      setEvent(detail);
      setName(detail.name || detail.title || '');
      setCategory(detail.category || 'CONCERT');
      setVenue(detail.venue || '');
      setDescription(detail.description || '');
      setImageUrl(detail.imageUrl || '');
      setEventAt((detail.eventAt || detail.eventDateTime || '').slice(0, 16));
      setResaleAllowed(detail.resaleAllowed ?? true);
      setMaxResaleRate(String((detail.maxResalePriceRate ?? 12000) / 100));
      setResaleStart((detail.resaleStart || '').slice(0, 16));
      setResaleEnd((detail.resaleEnd || '').slice(0, 16));
      setStatus(detail.status || 'ACTIVE');
      setStatusDraft(detail.status || 'ACTIVE');
    } catch (error: any) {
      Alert.alert('이벤트 정보 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (!event) return;
    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.updateEvent(event.id, {
        name: name.trim(),
        category,
        venue: venue.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        eventAt: eventAt ? new Date(eventAt).toISOString() : null,
      });
      setFeedback('이벤트 정보가 저장되었습니다.');
      Alert.alert('저장 완료', '이벤트 정보가 저장되었습니다.');
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '이벤트 정보를 수정하지 못했습니다.');
      setFeedback(message);
      Alert.alert('저장 실패', message);
    } finally {
      setSaving(false);
    }
  };

  const saveResalePolicy = async () => {
    if (!event) return;
    const rate = Number(maxResaleRate);
    if (Number.isNaN(rate) || rate < 100) {
      const message = '최대 리셀 가격 비율은 100 이상이어야 합니다.';
      setFeedback(message);
      Alert.alert('입력 오류', message);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.updateResalePolicy(event.id, {
        resaleAllowed,
        maxResalePriceRate: Math.round(rate * 100),
        resaleStart: resaleAllowed && resaleStart ? new Date(resaleStart).toISOString() : null,
        resaleEnd: resaleAllowed && resaleEnd ? new Date(resaleEnd).toISOString() : null,
      });
      setFeedback('리셀 정책이 저장되었습니다.');
      Alert.alert('저장 완료', '리셀 정책이 저장되었습니다.');
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '리셀 정책을 수정하지 못했습니다.');
      setFeedback(message);
      Alert.alert('저장 실패', message);
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = async (nextStatus: string) => {
    if (!event) return;
    if (event.adminCanceled && nextStatus !== 'CANCELED') {
      const message = '관리자가 취소한 이벤트는 주최자 앱에서 복구할 수 없습니다.';
      setFeedback(message);
      Alert.alert('복구 권한 없음', message);
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.updateEventStatus(event.id, { status: nextStatus });
      setStatus(nextStatus);
      setStatusDraft(nextStatus);
      setFeedback('이벤트 상태가 저장되었습니다.');
      Alert.alert('저장 완료', '이벤트 상태가 저장되었습니다.');
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '이벤트 상태를 변경하지 못했습니다.');
      setFeedback(message);
      Alert.alert('상태 변경 실패', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Event Settings</Text>
        <Text style={styles.title}>이벤트 설정</Text>
        {feedback ? <View style={styles.messageBox}><Text style={styles.messageText}>{feedback}</Text></View> : null}

        <View style={[styles.card, styles.sectionBase]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>기본 정보</Text>
            <Text style={styles.sectionHint}>이벤트명, 장소, 일시를 관리합니다.</Text>
          </View>
          <Text style={styles.cardTitle}>기본 정보</Text>
          <Text style={styles.label}>이벤트명</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.categoryGrid}>
            {EVENT_CATEGORIES.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.activeCategoryChip]} onPress={() => setCategory(item.value)}>
                <Text style={[styles.categoryChipText, category === item.value && styles.activeCategoryChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>장소</Text>
          <TextInput style={styles.input} value={venue} onChangeText={setVenue} />
          <Text style={styles.label}>일시</Text>
          <TextInput style={styles.input} value={eventAt} onChangeText={setEventAt} placeholder="YYYY-MM-DDTHH:mm" />
          <Text style={styles.label}>이미지 URL</Text>
          <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." autoCapitalize="none" />
          <Text style={styles.label}>설명</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline />
        </View>

        <View style={[styles.card, styles.sectionMuted]}>
          <TouchableOpacity style={styles.collapseHeader} onPress={() => setResaleOpen((value) => !value)}>
            <View>
              <Text style={styles.sectionEyebrow}>리셀 정책</Text>
              <Text style={styles.cardTitle}>리셀 정책</Text>
            </View>
            <Text style={styles.chevron}>{resaleOpen ? '⌃' : '⌄'}</Text>
          </TouchableOpacity>
          {resaleOpen ? (
            <>
              <View style={styles.sectionDivider} />
              <TouchableOpacity style={styles.toggleRow} onPress={() => setResaleAllowed((value) => !value)}>
                <Text style={styles.toggleLabel}>리셀 허용</Text>
                <Text style={[styles.toggleBadge, resaleAllowed ? styles.toggleOn : styles.toggleOff]}>{resaleAllowed ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
              <Text style={styles.label}>최대 리셀 가격 비율 (%)</Text>
              <TextInput style={styles.input} value={maxResaleRate} onChangeText={setMaxResaleRate} keyboardType="number-pad" inputMode="numeric" />
              <Text style={styles.label}>리셀 시작</Text>
              <TextInput style={styles.input} value={resaleStart} onChangeText={setResaleStart} placeholder="YYYY-MM-DDTHH:mm" />
              <Text style={styles.label}>리셀 종료</Text>
              <TextInput style={styles.input} value={resaleEnd} onChangeText={setResaleEnd} placeholder="YYYY-MM-DDTHH:mm" />
              <TouchableOpacity style={[styles.secondaryButton, saving && styles.disabledButton]} disabled={saving} onPress={saveResalePolicy}>
                <Text style={styles.secondaryButtonText}>리셀 정책 저장</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        <View style={[styles.card, styles.sectionDanger]}>
          <TouchableOpacity style={styles.collapseHeader} onPress={() => setStatusOpen((value) => !value)}>
            <View>
              <Text style={styles.sectionEyebrow}>운영 상태 관리</Text>
              <Text style={styles.cardTitle}>이벤트 상태 변경</Text>
            </View>
            <Text style={styles.chevron}>{statusOpen ? '⌃' : '⌄'}</Text>
          </TouchableOpacity>
          {statusOpen ? (
            <>
              <View style={styles.sectionDivider} />
              {event?.adminCanceled ? (
                <Text style={styles.warningText}>관리자가 취소한 이벤트입니다. 주최자는 재활성화할 수 없습니다.</Text>
              ) : null}
              <Text style={styles.statusDescription}>운영중지 또는 이벤트 취소는 판매 및 체크인에 영향을 줄 수 있습니다.</Text>
              <View style={styles.statusGrid}>
                {[
                  { value: 'ACTIVE', label: '운영중' },
                  { value: 'INACTIVE', label: '운영중지' },
                  { value: 'CANCELED', label: '이벤트 취소' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.statusChip, statusDraft === item.value && styles.activeStatusChip]}
                    disabled={saving || (event?.adminCanceled === true && item.value !== 'CANCELED')}
                    onPress={() => setStatusDraft(item.value)}
                  >
                    <Text style={[styles.statusChipText, statusDraft === item.value && styles.activeStatusChipText]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.secondaryButton, saving && styles.disabledButton]} disabled={saving} onPress={() => saveStatus(statusDraft)}>
                <Text style={styles.secondaryButtonText}>상태 저장</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={save}>
          <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '기본 정보 저장'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 120 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  messageText: { color: '#1D4ED8', fontWeight: '800' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionBase: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  sectionMuted: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  sectionDanger: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
  sectionHeader: { marginBottom: 12 },
  sectionEyebrow: { color: '#2563EB', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  sectionHint: { marginTop: 4, color: '#64748B', fontSize: 12, lineHeight: 18 },
  sectionDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  collapseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chevron: { color: '#64748B', fontSize: 20, fontWeight: '900' },
  warningText: { marginTop: 10, color: '#B91C1C', fontSize: 13, fontWeight: '800', lineHeight: 19 },
  statusDescription: { marginTop: 10, color: '#475569', fontSize: 13, lineHeight: 19 },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#2563EB' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  statusGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statusChip: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeStatusChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  statusChipText: { color: '#475569', fontWeight: '900' },
  activeStatusChipText: { color: '#2563EB' },
  toggleRow: { marginTop: 14, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: '#0F172A', fontWeight: '800' },
  toggleBadge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '900' },
  toggleOn: { backgroundColor: '#DCFCE7', color: '#166534' },
  toggleOff: { backgroundColor: '#F1F5F9', color: '#64748B' },
  bottomBar: { borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 14 },
  disabledButton: { opacity: 0.55 },
});
