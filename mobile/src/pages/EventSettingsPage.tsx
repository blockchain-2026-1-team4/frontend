import React, { useCallback, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { config } from '../lib/config';
import type { EventDetail, EventRound } from '../types/api';

type RoundDraft = {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  useGlobalSalePeriod: boolean;
  saleStartDate: string;
  saleStartTime: string;
  saleEndDate: string;
  saleEndTime: string;
};

type PosterAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

type MarkedRoundDate = {
  date: string;
  label: string;
};

const EVENT_CATEGORIES = [
  { value: 'CONCERT', label: '공연' },
  { value: 'SPORTS', label: '스포츠' },
  { value: 'EXHIBITION', label: '전시' },
  { value: 'FESTIVAL', label: '페스티벌' },
  { value: 'ETC', label: '기타' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTE_OPTIONS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function dateFromIso(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return localDate(date);
}

function timeFromIso(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (target: number) => String(target).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDotDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(date: string, time: string) {
  return `${formatDotDate(date)} ${time}`;
}

function toDateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function roundStartIso(round: RoundDraft) {
  return toDateTimeIso(round.eventDate, round.startTime);
}

function roundEndIso(round: RoundDraft) {
  return toDateTimeIso(round.eventDate, round.endTime);
}

function defaultSaleEnd(rounds: RoundDraft[]) {
  return [...rounds].sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0]?.eventDate || localDate(new Date());
}

function posterFile(asset: PosterAsset) {
  const fallbackName = asset.uri.split('/').pop() || `event-poster-${Date.now()}.jpg`;
  return {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || 'image/jpeg',
  };
}

function imageSourceUri(value: string) {
  if (!value) return '';
  if (/^(https?:|file:|data:)/i.test(value)) return value;
  const apiRoot = config.apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  return `${apiRoot}${value.startsWith('/') ? '' : '/'}${value}`;
}

function toRoundDraft(round: EventRound, index: number, saleStart: string, saleStartTime: string, saleEnd: string, saleEndTime: string): RoundDraft {
  return {
    id: round.id || `${Date.now()}-${index}`,
    title: round.title || `${index + 1}회차`,
    eventDate: round.eventDate,
    startTime: round.startTime,
    endTime: round.endTime,
    useGlobalSalePeriod: round.useGlobalSalePeriod,
    saleStartDate: dateFromIso(round.saleStartAt) || saleStart,
    saleStartTime: timeFromIso(round.saleStartAt) || saleStartTime,
    saleEndDate: dateFromIso(round.saleEndAt) || saleEnd,
    saleEndTime: timeFromIso(round.saleEndAt) || saleEndTime,
  };
}

function fallbackRound(event: EventDetail, saleStart: string, saleStartTime: string, saleEnd: string, saleEndTime: string): RoundDraft {
  const startsAt = event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || new Date().toISOString();
  const endsAt = event.eventEndAt || event.endsAt || startsAt;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    id: 'fallback-1',
    title: '1회차',
    eventDate: localDate(start),
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    useGlobalSalePeriod: true,
    saleStartDate: saleStart,
    saleStartTime,
    saleEndDate: saleEnd,
    saleEndTime,
  };
}

export default function EventSettingsPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const today = useMemo(() => localDate(new Date()), []);
  const nowTime = useMemo(() => localTime(new Date()), []);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('CONCERT');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionHeight, setDescriptionHeight] = useState(76);
  const [imageUrl, setImageUrl] = useState('');
  const [poster, setPoster] = useState<PosterAsset | null>(null);
  const [posterRemoved, setPosterRemoved] = useState(false);
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);
  const [rounds, setRounds] = useState<RoundDraft[]>([]);
  const [expandedRoundIds, setExpandedRoundIds] = useState<string[]>([]);
  const [globalSaleStart, setGlobalSaleStart] = useState(today);
  const [globalSaleStartTime, setGlobalSaleStartTime] = useState(nowTime);
  const [globalSaleEnd, setGlobalSaleEnd] = useState(today);
  const [globalSaleEndTime, setGlobalSaleEndTime] = useState('21:00');
  const [roundSaleOverrideEnabled, setRoundSaleOverrideEnabled] = useState(false);
  const [activeSaleRoundId, setActiveSaleRoundId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const markedRounds = rounds.map((round, index) => ({ date: round.eventDate, label: `${index + 1}회차` }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await backendApi.getEvent(eventId);
      const saleStart = dateFromIso(detail.primarySaleStart || detail.salesStartAt) || today;
      const saleStartTime = timeFromIso(detail.primarySaleStart || detail.salesStartAt) || nowTime;
      const saleEnd = dateFromIso(detail.primarySaleEnd || detail.salesEndAt) || saleStart;
      const saleEndTime = timeFromIso(detail.primarySaleEnd || detail.salesEndAt) || '21:00';
      const nextRounds = detail.rounds?.length
        ? detail.rounds.map((round, index) => toRoundDraft(round, index, saleStart, saleStartTime, saleEnd, saleEndTime))
        : [fallbackRound(detail, saleStart, saleStartTime, saleEnd, saleEndTime)];
      setEvent(detail);
      setName(detail.name || detail.title || '');
      setCategory(detail.category || 'CONCERT');
      setVenue(detail.venue || detail.location?.name || '');
      setDescription(detail.description || '');
      setImageUrl(detail.imageUrl || '');
      setPoster(null);
      setPosterRemoved(false);
      setPosterPreviewOpen(false);
      setRounds(nextRounds);
      setGlobalSaleStart(saleStart);
      setGlobalSaleStartTime(saleStartTime);
      setGlobalSaleEnd(saleEnd);
      setGlobalSaleEndTime(saleEndTime);
      setRoundSaleOverrideEnabled(nextRounds.some((round) => !round.useGlobalSalePeriod));
      setActiveSaleRoundId(null);
      setExpandedRoundIds([]);
      setErrors([]);
    } catch (error: any) {
      Alert.alert('이벤트 정보 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [eventId, nowTime, today]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const posterPreviewUri = poster?.uri || (!posterRemoved ? imageSourceUri(imageUrl) : '');

  const pickPoster = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '포스터 이미지를 선택하려면 사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setPoster(result.assets[0]);
      setPosterRemoved(false);
    }
  };

  const updateRound = (id: string, patch: Partial<RoundDraft>) => {
    setRounds((current) => {
      const next = current.map((round) => (round.id === id ? { ...round, ...patch } : round));
      if (patch.eventDate) {
        const nextSaleEnd = defaultSaleEnd(next);
        setGlobalSaleEnd(nextSaleEnd);
        return next.map((round) => {
          if (!roundSaleOverrideEnabled || round.useGlobalSalePeriod) {
            return { ...round, saleEndDate: nextSaleEnd, saleEndTime: globalSaleEndTime };
          }
          if (round.id === id) {
            return { ...round, saleEndDate: round.eventDate, saleEndTime: round.endTime };
          }
          return round;
        });
      }
      return next;
    });
  };

  const addRound = () => {
    setRounds((current) => {
      const nextDate = addDays(current.at(-1)?.eventDate || localDate(new Date()), 1);
      const next = {
        id: `${Date.now()}-${current.length}`,
        title: `${current.length + 1}회차`,
        eventDate: nextDate,
        startTime: '19:00',
        endTime: '21:00',
        useGlobalSalePeriod: !roundSaleOverrideEnabled,
        saleStartDate: roundSaleOverrideEnabled ? today : globalSaleStart,
        saleStartTime: roundSaleOverrideEnabled ? nowTime : globalSaleStartTime,
        saleEndDate: roundSaleOverrideEnabled ? nextDate : globalSaleEnd,
        saleEndTime: roundSaleOverrideEnabled ? '21:00' : globalSaleEndTime,
      };
      setExpandedRoundIds([next.id]);
      return [...current, next];
    });
  };

  const removeRound = (id: string) => {
    setRounds((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((round) => round.id !== id).map((round, index) => ({ ...round, title: `${index + 1}회차` }));
      const nextSaleEnd = defaultSaleEnd(next);
      setGlobalSaleEnd(nextSaleEnd);
      setExpandedRoundIds((expanded) => expanded.filter((item) => item !== id));
      if (activeSaleRoundId === id) setActiveSaleRoundId(null);
      return next.map((round) => (!roundSaleOverrideEnabled || round.useGlobalSalePeriod ? { ...round, saleEndDate: nextSaleEnd, saleEndTime: globalSaleEndTime } : round));
    });
  };

  const confirmRemoveRound = (id: string, index: number) => {
    Alert.alert('회차 삭제', `${index + 1}회차를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => removeRound(id) },
    ]);
  };

  const setRoundSaleOverride = (enabled: boolean) => {
    setRoundSaleOverrideEnabled(enabled);
    setActiveSaleRoundId(null);
    setRounds((current) => current.map((round) => ({
      ...round,
      useGlobalSalePeriod: !enabled,
      saleStartDate: enabled ? globalSaleStart : round.saleStartDate,
      saleStartTime: enabled ? globalSaleStartTime : round.saleStartTime,
      saleEndDate: enabled ? globalSaleEnd : round.saleEndDate,
      saleEndTime: enabled ? globalSaleEndTime : round.saleEndTime,
    })));
  };

  const updateGlobalSale = (startDate: string, endDate: string) => {
    setGlobalSaleStart(startDate);
    setGlobalSaleEnd(endDate);
    if (!roundSaleOverrideEnabled) {
      setRounds((current) => current.map((round) => ({ ...round, saleStartDate: startDate, saleEndDate: endDate, useGlobalSalePeriod: true })));
    }
  };

  const validate = () => {
    const nextErrors: string[] = [];
    if (!category) nextErrors.push('카테고리를 선택해주세요.');
    if (!name.trim()) nextErrors.push('이름을 입력해주세요.');
    if (!venue.trim()) nextErrors.push('장소를 입력해주세요.');
    if (!description.trim()) nextErrors.push('소개를 입력해주세요.');
    if (!globalSaleStart || !globalSaleEnd || toDateTimeIso(globalSaleEnd, globalSaleEndTime) < toDateTimeIso(globalSaleStart, globalSaleStartTime)) {
      nextErrors.push('티켓 판매 시작과 종료를 다시 확인해주세요.');
    }
    rounds.forEach((round, index) => {
      const roundNo = index + 1;
      if (!round.eventDate || !round.startTime || !round.endTime) nextErrors.push(`${roundNo}회차 날짜와 시간을 입력해주세요.`);
      if (round.endTime <= round.startTime) nextErrors.push(`${roundNo}회차 종료 시간은 시작 시간 이후로 설정해주세요.`);
      const saleStart = round.useGlobalSalePeriod ? toDateTimeIso(globalSaleStart, globalSaleStartTime) : toDateTimeIso(round.saleStartDate, round.saleStartTime);
      const saleEnd = round.useGlobalSalePeriod ? toDateTimeIso(globalSaleEnd, globalSaleEndTime) : toDateTimeIso(round.saleEndDate, round.saleEndTime);
      if (saleEnd < saleStart) nextErrors.push(`${roundNo}회차 판매 종료는 판매 시작 이후로 설정해주세요.`);
      if (saleEnd > roundStartIso(round)) nextErrors.push(`${roundNo}회차 판매는 공연 시작 전까지만 열 수 있습니다.`);
    });
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      setExpandedRoundIds(rounds.map((round) => round.id));
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!event || !validate()) return;
    const sortedRounds = [...rounds].sort((a, b) => roundStartIso(a).localeCompare(roundStartIso(b)));
    const firstRound = sortedRounds[0];
    const lastRound = [...sortedRounds].sort((a, b) => roundEndIso(b).localeCompare(roundEndIso(a)))[0];
    const saleStartTimes = sortedRounds.map((round) => roundSaleOverrideEnabled ? toDateTimeIso(round.saleStartDate, round.saleStartTime) : toDateTimeIso(globalSaleStart, globalSaleStartTime));
    const saleEndTimes = sortedRounds.map((round) => roundSaleOverrideEnabled ? toDateTimeIso(round.saleEndDate, round.saleEndTime) : toDateTimeIso(globalSaleEnd, globalSaleEndTime));
    const effectiveSaleStart = saleStartTimes.sort()[0];
    const effectiveSaleEnd = saleEndTimes.sort()[saleEndTimes.length - 1];
    setSaving(true);
    try {
      await backendApi.updateEvent(event.id, {
        name: name.trim(),
        category,
        venue: venue.trim(),
        location: {
          name: venue.trim(),
          address: venue.trim(),
          placeId: event.venuePlaceId || event.location?.placeId || null,
          latitude: event.location?.latitude ?? null,
          longitude: event.location?.longitude ?? null,
        },
        venuePlaceId: event.venuePlaceId || event.location?.placeId || null,
        description: description.trim(),
        imageUrl: posterRemoved ? null : imageUrl.trim() || null,
        removeImage: posterRemoved,
        eventAt: roundStartIso(firstRound),
        eventStartAt: roundStartIso(firstRound),
        eventEndAt: roundEndIso(lastRound),
        startsAt: roundStartIso(firstRound),
        endsAt: roundEndIso(lastRound),
        primarySaleStart: effectiveSaleStart,
        primarySaleEnd: effectiveSaleEnd,
        salesStartAt: effectiveSaleStart,
        salesEndAt: effectiveSaleEnd,
        rounds: sortedRounds.map((round, index) => {
          const saleStart = roundSaleOverrideEnabled ? toDateTimeIso(round.saleStartDate, round.saleStartTime) : toDateTimeIso(globalSaleStart, globalSaleStartTime);
          const saleEnd = roundSaleOverrideEnabled ? toDateTimeIso(round.saleEndDate, round.saleEndTime) : toDateTimeIso(globalSaleEnd, globalSaleEndTime);
          return {
            title: round.title || `${index + 1}회차`,
            eventDate: round.eventDate,
            startTime: round.startTime,
            endTime: round.endTime,
            useGlobalSalePeriod: round.useGlobalSalePeriod,
            saleStartAt: saleStart,
            saleEndAt: saleEnd,
          };
        }),
      });
      if (poster) {
        await backendApi.uploadEventImage(event.id, posterFile(poster));
      }
      Alert.alert('저장 완료', '이벤트 정보가 수정되었습니다.');
      await load();
      navigation.navigate('OrganizerEventDetail', { eventId: event.id });
    } catch (error: any) {
      Alert.alert('저장 실패', errorMessage(error, '이벤트 정보를 수정하지 못했습니다.'));
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
        <Text style={styles.title}>이벤트 수정</Text>
        <Text style={styles.subtitle}>이벤트 정보를 수정한 후 티켓과 좌석 설정을 이어서 관리할 수 있습니다.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>기본 정보</Text>
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.categoryGrid}>
            {EVENT_CATEGORIES.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.activeCategoryChip]} onPress={() => setCategory(item.value)}>
                <Text style={[styles.categoryChipText, category === item.value && styles.activeCategoryChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>이름</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예: TRUST LIVE 2026" />
          <Text style={styles.helpText}>사용자에게 표시될 이벤트 이름을 입력해주세요.</Text>

          <Text style={styles.label}>장소</Text>
          <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="예: 올림픽공원 KSPO DOME" />

          <Text style={styles.label}>소개</Text>
          <TextInput
            style={[styles.input, styles.textArea, { height: descriptionHeight }]}
            value={description}
            onChangeText={setDescription}
            onContentSizeChange={(inputEvent) => setDescriptionHeight(Math.max(76, Math.min(180, inputEvent.nativeEvent.contentSize.height + 12)))}
            placeholder="공연 소개, 출연진, 운영 시간, 입장 안내, 주의사항 등을 입력해주세요."
            multiline
          />

          <Text style={styles.label}>포스터</Text>
          {posterPreviewUri ? (
            <TouchableOpacity activeOpacity={0.88} onPress={() => setPosterPreviewOpen(true)}>
              <Image source={{ uri: posterPreviewUri }} style={styles.posterPreview} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.posterPlaceholder} activeOpacity={0.88} onPress={pickPoster}>
              <Text style={styles.posterPlaceholderText}>포스터 없음</Text>
            </TouchableOpacity>
          )}
          <View style={styles.posterActionRow}>
            <TouchableOpacity style={styles.posterButton} onPress={pickPoster}>
              <Text style={styles.posterButtonText}>{posterPreviewUri ? '다른 포스터 등록' : '포스터 등록'}</Text>
            </TouchableOpacity>
            {posterPreviewUri ? (
              <TouchableOpacity
                style={[styles.posterButton, styles.posterDeleteButton]}
                onPress={() => {
                  setPoster(null);
                  setPosterRemoved(true);
                  setImageUrl('');
                }}
              >
                <Text style={styles.posterDeleteText}>포스터 제거</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.helpText}>사용자에게 보여질 포스터 이미지를 등록하세요.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>일정</Text>
          <Text style={styles.helpText}>공연 회차별로 날짜와 시간을 설정하세요.</Text>
          <Text style={styles.helpText}>장소나 일정 차이가 큰 경우 별도 이벤트 등록을 권장합니다.</Text>
          {rounds.map((round, index) => {
            const expanded = expandedRoundIds.includes(round.id);
            return (
              <View key={round.id} style={styles.roundBox}>
                <View style={styles.roundHeader}>
                  <TouchableOpacity style={styles.roundHeaderCopy} onPress={() => setExpandedRoundIds((current) => current.includes(round.id) ? current.filter((item) => item !== round.id) : [...current, round.id])}>
                    <Text style={styles.roundTitle}>{expanded ? '▼' : '▶'} {index + 1}회차 · {formatDotDate(round.eventDate)}</Text>
                    <Text style={styles.roundSummary}>{round.startTime} ~ {round.endTime}</Text>
                  </TouchableOpacity>
                  {rounds.length > 1 ? (
                    <TouchableOpacity style={styles.deleteButton} onPress={() => confirmRemoveRound(round.id, index)}>
                      <Text style={styles.deleteButtonText}>삭제</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {expanded ? (
                  <View style={styles.roundBody}>
                    <Text style={styles.label}>공연일</Text>
                    <SingleDatePicker value={round.eventDate} onChange={(value) => updateRound(round.id, { eventDate: value })} markedRounds={markedRounds} />
                    <View style={styles.timeRow}>
                      <View style={styles.timeCol}>
                        <Text style={styles.label}>시작 시간</Text>
                        <TimeWheelPicker label="시작 시간" value={round.startTime} onChange={(value) => updateRound(round.id, { startTime: value })} />
                      </View>
                      <View style={styles.timeCol}>
                        <Text style={styles.label}>종료 시간</Text>
                        <TimeWheelPicker label="종료 시간" value={round.endTime} onChange={(value) => updateRound(round.id, { endTime: value })} />
                      </View>
                    </View>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setExpandedRoundIds((current) => current.filter((item) => item !== round.id))}>
                      <Text style={styles.secondaryButtonText}>회차 저장</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
          <TouchableOpacity style={styles.addButton} onPress={addRound}>
            <Text style={styles.addButtonText}>+ 회차 추가</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>티켓 판매 기간</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity style={[styles.modeButton, !roundSaleOverrideEnabled && styles.activeModeButton]} onPress={() => setRoundSaleOverride(false)}>
              <Text style={styles.modeButtonText}>전체 판매 기간 설정</Text>
              <Text style={styles.modeHint}>모든 회차에 같은 판매 기간을 적용합니다.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeButton, roundSaleOverrideEnabled && styles.activeModeButton]} onPress={() => setRoundSaleOverride(true)}>
              <Text style={styles.modeButtonText}>회차별 판매 기간 설정</Text>
              <Text style={styles.modeHint}>회차마다 다른 판매 기간을 설정합니다.</Text>
            </TouchableOpacity>
          </View>

          {!roundSaleOverrideEnabled ? (
            <View style={styles.salePeriodBlock}>
              <Text style={styles.saleRangeText}>{formatDateTime(globalSaleStart, globalSaleStartTime)} ~ {formatDateTime(globalSaleEnd, globalSaleEndTime)}</Text>
              <View style={styles.saleBoundaryGroup}>
                <View style={styles.saleBoundaryCard}>
                  <Text style={styles.saleBoundaryTitle}>판매 시작</Text>
                  <View style={styles.saleBoundaryRow}>
                    <View style={styles.saleBoundaryField}>
                      <Text style={styles.flatLabel}>날짜</Text>
                      <SingleDatePicker value={globalSaleStart} onChange={(value) => updateGlobalSale(value, globalSaleEnd)} markedRounds={markedRounds} />
                    </View>
                    <View style={styles.saleBoundaryField}>
                      <Text style={styles.flatLabel}>시간</Text>
                      <TimeWheelPicker label="판매 시작 시간" value={globalSaleStartTime} onChange={setGlobalSaleStartTime} />
                    </View>
                  </View>
                </View>
                <View style={styles.saleBoundaryCard}>
                  <Text style={styles.saleBoundaryTitle}>판매 종료</Text>
                  <View style={styles.saleBoundaryRow}>
                    <View style={styles.saleBoundaryField}>
                      <Text style={styles.flatLabel}>날짜</Text>
                      <SingleDatePicker value={globalSaleEnd} onChange={(value) => updateGlobalSale(globalSaleStart, value)} markedRounds={markedRounds} />
                    </View>
                    <View style={styles.saleBoundaryField}>
                      <Text style={styles.flatLabel}>시간</Text>
                      <TimeWheelPicker label="판매 종료 시간" value={globalSaleEndTime} onChange={setGlobalSaleEndTime} />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.roundSaleList}>
              {rounds.map((round, index) => (
                <View key={round.id} style={styles.roundSaleItem}>
                  <TouchableOpacity style={styles.roundHeader} onPress={() => setActiveSaleRoundId((current) => current === round.id ? null : round.id)} activeOpacity={0.82}>
                    <View style={styles.roundHeaderCopy}>
                      <Text style={styles.roundTitle}>{activeSaleRoundId === round.id ? '▼' : '▶'} {index + 1}회차 판매 기간</Text>
                      <Text style={styles.roundSummary}>{formatDateTime(round.saleStartDate, round.saleStartTime)} ~ {formatDateTime(round.saleEndDate, round.saleEndTime)}</Text>
                    </View>
                  </TouchableOpacity>
                  {activeSaleRoundId === round.id ? (
                    <View style={styles.saleBody}>
                      <View style={styles.saleBoundaryGroup}>
                        <View style={styles.saleBoundaryCard}>
                          <Text style={styles.saleBoundaryTitle}>판매 시작</Text>
                          <View style={styles.saleBoundaryRow}>
                            <View style={styles.saleBoundaryField}>
                              <Text style={styles.flatLabel}>날짜</Text>
                              <SingleDatePicker value={round.saleStartDate} onChange={(value) => updateRound(round.id, { saleStartDate: value, useGlobalSalePeriod: false })} markedRounds={markedRounds} />
                            </View>
                            <View style={styles.saleBoundaryField}>
                              <Text style={styles.flatLabel}>시간</Text>
                              <TimeWheelPicker label="판매 시작 시간" value={round.saleStartTime} onChange={(value) => updateRound(round.id, { saleStartTime: value, useGlobalSalePeriod: false })} />
                            </View>
                          </View>
                        </View>
                        <View style={styles.saleBoundaryCard}>
                          <Text style={styles.saleBoundaryTitle}>판매 종료</Text>
                          <View style={styles.saleBoundaryRow}>
                            <View style={styles.saleBoundaryField}>
                              <Text style={styles.flatLabel}>날짜</Text>
                              <SingleDatePicker value={round.saleEndDate} onChange={(value) => updateRound(round.id, { saleEndDate: value, useGlobalSalePeriod: false })} markedRounds={markedRounds} />
                            </View>
                            <View style={styles.saleBoundaryField}>
                              <Text style={styles.flatLabel}>시간</Text>
                              <TimeWheelPicker label="판매 종료 시간" value={round.saleEndTime} onChange={(value) => updateRound(round.id, { saleEndTime: value, useGlobalSalePeriod: false })} />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {errors.length > 0 ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>오류</Text>
            {errors.map((message) => <Text key={message} style={styles.errorItem}>· {message}</Text>)}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={save}>
          <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '수정 완료'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={posterPreviewOpen} transparent animationType="fade" onRequestClose={() => setPosterPreviewOpen(false)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPosterPreviewOpen(false)}>
          {posterPreviewUri ? <Image source={{ uri: posterPreviewUri }} style={styles.previewImage} resizeMode="contain" /> : null}
          <Text style={styles.previewClose}>닫기</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function SingleDatePicker({ value, onChange, markedRounds = [] }: { value: string; onChange: (date: string) => void; markedRounds?: MarkedRoundDate[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity style={styles.compactPickerButton} onPress={() => setOpen(true)}>
        <Text style={styles.compactPickerText}>{formatDotDate(value)}</Text>
        <Text style={styles.compactPickerAction}>선택</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>공연일 선택</Text>
            <MonthCalendar selectedStart={value} markedRounds={markedRounds} onSelect={(date) => { onChange(date); setOpen(false); }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CompactRangePicker({
  title,
  compactTitle,
  ctaLabel,
  markedRounds = [],
  startDate,
  endDate,
  onChange,
  active = false,
  summaryRounds = [],
  summaryActiveRoundId = null,
}: {
  title: string;
  compactTitle: string;
  ctaLabel: string;
  markedRounds?: MarkedRoundDate[];
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  active?: boolean;
  summaryRounds?: RoundDraft[];
  summaryActiveRoundId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [selectingStart, setSelectingStart] = useState(true);

  const openSheet = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setSelectingStart(true);
    setOpen(true);
  };

  const select = (date: string) => {
    if (selectingStart) {
      setDraftStart(date);
      setDraftEnd('');
      setSelectingStart(false);
      return;
    }
    if (date < draftStart) {
      setDraftStart(date);
      setDraftEnd(draftStart);
    } else {
      setDraftEnd(date);
    }
  };

  const complete = () => {
    if (draftStart && draftEnd) onChange(draftStart, draftEnd);
    setOpen(false);
  };

  return (
    <View style={styles.rangePickerBox}>
      <TouchableOpacity style={[styles.compactPickerButton, active && styles.activePickerButton]} onPress={openSheet}>
        <View style={styles.compactPickerCopy}>
          <Text style={styles.rangePickerTitle}>{compactTitle}</Text>
          <Text style={styles.rangePickerValue}>{formatDotDate(startDate)} ~ {formatDotDate(endDate)}</Text>
        </View>
        <Text style={styles.compactPickerAction}>{ctaLabel}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <Text style={styles.sheetHelp}>판매 시작일과 종료일을 선택하세요.</Text>
            <Text style={styles.sheetStateText}>{selectingStart ? '판매 시작일을 선택하세요.' : '판매 종료일을 선택하세요.'}</Text>
            <SaleRoundStrip rounds={summaryRounds} markedRounds={markedRounds} activeRoundId={summaryActiveRoundId} />
            <MonthCalendar selectedStart={draftStart} selectedEnd={draftEnd} markedRounds={markedRounds} onSelect={select} />
            <TouchableOpacity style={[styles.sheetDoneButton, (!draftStart || !draftEnd) && styles.disabledButton]} disabled={!draftStart || !draftEnd} onPress={complete}>
              <Text style={styles.sheetDoneText}>완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SaleRoundStrip({ rounds, markedRounds, activeRoundId }: { rounds: RoundDraft[]; markedRounds: MarkedRoundDate[]; activeRoundId: string | null }) {
  const items = rounds.length > 0 ? rounds.map((round, index) => ({ id: round.id, label: `${index + 1}회차 · ${formatShortDate(round.eventDate)}` })) : markedRounds.map((round) => ({ id: round.date, label: `${round.label} · ${formatShortDate(round.date)}` }));
  return (
    <View style={styles.saleRoundStrip}>
      {items.map((item) => {
        const active = item.id === activeRoundId;
        return (
          <View key={item.id} style={[styles.saleRoundChip, active && styles.saleRoundChipActive]}>
            <Text style={[styles.saleRoundChipText, active && styles.saleRoundChipTextActive]}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function MonthCalendar({ selectedStart, selectedEnd, markedRounds = [], onSelect }: { selectedStart: string; selectedEnd?: string; markedRounds?: MarkedRoundDate[]; onSelect: (date: string) => void }) {
  const initialDate = selectedStart || localDate(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(`${initialDate}T00:00:00`));
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: Array<{ date: string; day: number; inMonth: boolean }> = [];

  for (let index = 0; index < 42; index += 1) {
    const dayOffset = index - firstDay.getDay() + 1;
    const cellDate = new Date(year, month, dayOffset);
    cells.push({ date: localDate(cellDate), day: cellDate.getDate(), inMonth: cellDate.getMonth() === month });
  }

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity style={styles.monthButton} onPress={() => moveMonth(-1)}>
          <Text style={styles.monthButtonText}>이전</Text>
        </TouchableOpacity>
        <Text style={styles.calendarTitle}>{year}.{String(month + 1).padStart(2, '0')}</Text>
        <TouchableOpacity style={styles.monthButton} onPress={() => moveMonth(1)}>
          <Text style={styles.monthButtonText}>다음</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.weekRow}>
        {['일', '월', '화', '수', '목', '금', '토'].map((label) => <Text key={label} style={styles.weekText}>{label}</Text>)}
      </View>
      <View style={styles.dayGrid}>
        {cells.map((cell) => {
          const selected = cell.date === selectedStart || cell.date === selectedEnd;
          const inRange = selectedEnd ? cell.date >= selectedStart && cell.date <= selectedEnd : false;
          const marks = markedRounds.filter((round) => round.date === cell.date);
          return (
            <TouchableOpacity
              key={cell.date}
              style={[styles.dayCell, !cell.inMonth && styles.emptyDayCell, inRange && styles.rangeDay, selected && styles.selectedDay]}
              disabled={!cell.inMonth}
              onPress={() => onSelect(cell.date)}
            >
              <Text style={[styles.dayText, !cell.inMonth && styles.emptyDayText, selected && styles.selectedDayText]}>{cell.day}</Text>
              {marks.slice(0, 2).map((mark) => (
                <Text key={mark.label} style={[styles.roundMarkerText, selected && styles.selectedDayText]}>{mark.label}</Text>
              ))}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TimeWheelPicker({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = value.split(':');
  const [draftHour, setDraftHour] = useState(hour || '00');
  const [draftMinute, setDraftMinute] = useState(minute || '00');

  const openWheel = () => {
    const [nextHour, nextMinute] = value.split(':');
    setDraftHour(nextHour || '00');
    setDraftMinute(nextMinute || '00');
    setOpen(true);
  };

  const complete = () => {
    onChange(`${draftHour}:${draftMinute}`);
    setOpen(false);
  };

  return (
    <View>
      <TouchableOpacity style={styles.compactPickerButton} onPress={openWheel}>
        <Text style={styles.timeSingleValue}>{value}</Text>
        <Text style={styles.compactPickerAction}>선택</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={styles.timeWheelRow}>
              <TimeColumn label="시" options={HOUR_OPTIONS} value={draftHour} onChange={setDraftHour} />
              <TimeColumn label="분" options={MINUTE_OPTIONS} value={draftMinute} onChange={setDraftMinute} />
            </View>
            <TouchableOpacity style={styles.sheetDoneButton} onPress={complete}>
              <Text style={styles.sheetDoneText}>완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimeColumn({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.timeWheelCol}>
      <Text style={styles.timeWheelLabel}>{label}</Text>
      <ScrollView style={styles.timeWheelList} nestedScrollEnabled>
        {options.map((option) => (
          <TouchableOpacity key={option} style={[styles.timeWheelItem, option === value && styles.timeWheelItemActive]} onPress={() => onChange(option)}>
            <Text style={[styles.timeWheelItemText, option === value && styles.timeWheelItemTextActive]}>{label === '시' ? `${option}시` : `${option}분`}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 3, fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 6, color: '#64748B', fontSize: 13, lineHeight: 19 },
  card: { marginTop: 11, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  label: { marginTop: 9, marginBottom: 5, color: '#334155', fontSize: 13, fontWeight: '800' },
  helpText: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 17 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 76, maxHeight: 180, textAlignVertical: 'top' },
  posterPreview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8, backgroundColor: '#E2E8F0' },
  posterPlaceholder: { minHeight: 86, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  posterPlaceholderText: { color: '#64748B', fontSize: 13, fontWeight: '800' },
  posterActionRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  posterButton: { flex: 1, borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 11, alignItems: 'center', backgroundColor: '#EFF6FF' },
  posterButtonText: { color: '#2563EB', fontWeight: '900', fontSize: 13 },
  posterDeleteButton: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  posterDeleteText: { color: '#B91C1C', fontWeight: '900', fontSize: 13 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#2563EB' },
  roundBox: { marginTop: 9, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF' },
  roundHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundHeaderCopy: { flex: 1 },
  roundTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  roundSummary: { marginTop: 4, color: '#64748B', fontSize: 13, fontWeight: '800' },
  roundBody: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 10 },
  deleteButton: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF7F7' },
  deleteButtonText: { color: '#B91C1C', fontWeight: '800', fontSize: 12 },
  addButton: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 11, backgroundColor: '#EFF6FF' },
  addButtonText: { color: '#2563EB', fontSize: 15, fontWeight: '900' },
  secondaryButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 11, backgroundColor: '#F8FAFC', alignItems: 'center' },
  secondaryButtonText: { color: '#0F172A', fontWeight: '900' },
  timeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  timeCol: { flex: 1 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modeButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF' },
  activeModeButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  modeButtonText: { color: '#0F172A', fontWeight: '900' },
  modeHint: { marginTop: 6, color: '#64748B', fontSize: 12 },
  salePeriodBlock: { marginTop: 4 },
  saleRangeText: { marginTop: 8, color: '#0F172A', fontSize: 15, fontWeight: '900' },
  saleBody: { marginTop: 2 },
  saleBoundaryGroup: { marginTop: 8, gap: 10 },
  saleBoundaryCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF' },
  saleBoundaryTitle: { color: '#2563EB', fontSize: 13, fontWeight: '900', marginBottom: 8 },
  saleBoundaryRow: { flexDirection: 'row', gap: 8 },
  saleBoundaryField: { flex: 1 },
  flatLabel: { color: '#334155', fontSize: 12, fontWeight: '900', marginBottom: 5 },
  rangePickerBox: { marginTop: 9 },
  rangePickerTitle: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  rangePickerValue: { marginTop: 3, color: '#0F172A', fontWeight: '900' },
  compactPickerButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  activePickerButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  compactPickerCopy: { flex: 1 },
  compactPickerText: { color: '#0F172A', fontWeight: '900' },
  compactPickerAction: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  roundSaleList: { marginTop: 2 },
  roundSaleItem: { marginTop: 8 },
  saleRoundStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 8 },
  saleRoundChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  saleRoundChipActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  saleRoundChipText: { color: '#334155', fontSize: 12, fontWeight: '900' },
  saleRoundChipTextActive: { color: '#2563EB' },
  calendar: { marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 8, backgroundColor: '#FFFFFF' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  calendarTitle: { color: '#0F172A', fontWeight: '900' },
  monthButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  monthButtonText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  weekRow: { flexDirection: 'row' },
  weekText: { width: `${100 / 7}%`, textAlign: 'center', color: '#64748B', fontSize: 11, fontWeight: '900' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1.1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, paddingVertical: 4 },
  emptyDayCell: { backgroundColor: '#F8FAFC', opacity: 0.45 },
  selectedDay: { backgroundColor: '#2563EB' },
  rangeDay: { backgroundColor: '#DBEAFE' },
  dayText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  roundMarkerText: { marginTop: 1, color: '#64748B', fontSize: 8, fontWeight: '900' },
  emptyDayText: { color: 'transparent' },
  selectedDayText: { color: '#FFFFFF' },
  timeSingleValue: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  timeWheelRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  timeWheelCol: { flex: 1 },
  timeWheelLabel: { marginBottom: 6, color: '#64748B', fontSize: 12, fontWeight: '900' },
  timeWheelList: { maxHeight: 240, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  timeWheelItem: { paddingVertical: 11, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  timeWheelItemActive: { backgroundColor: '#EFF6FF' },
  timeWheelItemText: { color: '#475569', fontWeight: '900' },
  timeWheelItemTextActive: { color: '#2563EB' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.36)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, paddingBottom: 22 },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  sheetHelp: { marginTop: 6, color: '#64748B', fontSize: 12, fontWeight: '700' },
  sheetStateText: { marginTop: 4, color: '#2563EB', fontSize: 13, fontWeight: '900' },
  sheetDoneButton: { marginTop: 10, borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#0F172A' },
  sheetDoneText: { color: '#FFFFFF', fontWeight: '900' },
  errorPanel: { marginTop: 13, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12 },
  errorTitle: { color: '#B91C1C', fontWeight: '900', marginBottom: 6 },
  errorItem: { color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  bottomBar: { borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 14 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewImage: { width: '88%', aspectRatio: 3 / 4, borderRadius: 8 },
  previewClose: { marginTop: 16, color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});
