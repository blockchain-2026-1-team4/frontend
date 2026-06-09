import React, { useCallback, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { EventCategorySummary, EventFlowHero, EventFlowNotice, EventFlowTopBar, EventFormGroup } from '../components/EventFlowKit';
import { FlowBadge, TicketIcon, flowShadow } from '../components/TicketFlowKit';
import { TextInput } from '../components/TextInput';
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

type FormIconName = 'tag' | 'align' | 'photo' | 'calendar' | 'upload';

function FormIcon({ name, color = '#534AB7', size = 14 }: { name: FormIconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'tag' ? <Path {...common} d="M20 10 12 2H5v7l8 8a2 2 0 0 0 3 0l4-4a2 2 0 0 0 0-3ZM8 7h.01" /> : null}
      {name === 'align' ? <Path {...common} d="M4 6h16M4 12h12M4 18h16" /> : null}
      {name === 'photo' ? <Path {...common} d="M4 5h16v14H4V5Zm4 8 2.5-3 3 4 2-2.5L20 17M8 9h.01" /> : null}
      {name === 'calendar' ? <Path {...common} d="M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /> : null}
      {name === 'upload' ? <Path {...common} d="M12 16V4m0 0 4 4m-4-4-4 4M5 20h14" /> : null}
    </Svg>
  );
}

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

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
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

function normalizeDate(value?: string | null, fallback = localDate(new Date())) {
  if (!value) return fallback;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : localDate(parsed);
}

function normalizeTime(value?: string | null, fallback = '19:00') {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return `${String(Math.min(23, Math.max(0, Number(match[1])))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, Number(match[2])))).padStart(2, '0')}`;
}

function toDateTimeIso(date: string, time: string) {
  return new Date(`${normalizeDate(date)}T${normalizeTime(time)}:00`).toISOString();
}

function roundStartIso(round: RoundDraft) {
  return toDateTimeIso(round.eventDate, round.startTime);
}

function roundEndIso(round: RoundDraft) {
  return toDateTimeIso(round.eventDate, round.endTime);
}

function defaultBackendSaleWindow(firstRoundStartIso: string, lastRoundStartIso: string) {
  const firstStart = new Date(firstRoundStartIso);
  const lastStart = new Date(lastRoundStartIso);
  const saleEnd = Number.isNaN(lastStart.getTime()) ? (Number.isNaN(firstStart.getTime()) ? new Date() : firstStart) : lastStart;
  const now = new Date();
  const saleStart = now < saleEnd ? now : new Date(saleEnd.getTime() - 24 * 60 * 60 * 1000);
  return {
    saleStartAt: saleStart.toISOString(),
    saleEndAt: saleEnd.toISOString(),
  };
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

function normalizeCategory(category?: string | null) {
  if (String(category ?? '').toUpperCase() === 'CONFERENCE') {
    return 'ETC';
  }
  return category || 'CONCERT';
}

function toRoundDraft(round: EventRound, index: number): RoundDraft {
  return {
    id: round.id || `${Date.now()}-${index}`,
    title: round.title || `${index + 1}회차`,
    eventDate: normalizeDate(round.eventDate),
    startTime: normalizeTime(round.startTime),
    endTime: normalizeTime(round.endTime, '21:00'),
  };
}

function fallbackRound(event: EventDetail): RoundDraft {
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
  };
}

export default function EventSettingsPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const mode = (route?.params?.mode as 'info' | 'schedule' | 'status' | undefined) ?? 'info';
  const today = useMemo(() => localDate(new Date()), []);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('CONCERT');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [poster, setPoster] = useState<PosterAsset | null>(null);
  const [posterRemoved, setPosterRemoved] = useState(false);
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);
  const [rounds, setRounds] = useState<RoundDraft[]>([]);
  const [expandedRoundIds, setExpandedRoundIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [issuedTicketCount, setIssuedTicketCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [statusDraft, setStatusDraft] = useState('PUBLISHED');
  const [statusSaving, setStatusSaving] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const dirtyRef = useRef(false);

  const markedRounds = rounds.map((round, index) => ({ date: round.eventDate, label: `${index + 1}회차` }));
  const scheduleLocked = issuedTicketCount > 0;

  const load = useCallback(async () => {
    if (!eventId) {
      setLoadError('이벤트 정보가 없어 수정 화면을 열 수 없습니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setLoadError('');
      const [detail, issuedTickets] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => []),
      ]);
      const nextRounds = detail.rounds?.length
        ? detail.rounds.map((round, index) => toRoundDraft(round, index))
        : [fallbackRound(detail)];
      setEvent(detail);
      setName(detail.name || detail.title || '');
      setCategory(normalizeCategory(detail.category));
      setVenue(detail.venue || detail.location?.name || '');
      setDescription(detail.description || '');
      setImageUrl(detail.imageUrl || '');
      setPoster(null);
      setPosterRemoved(false);
      setPosterPreviewOpen(false);
      setRounds(nextRounds);
      setExpandedRoundIds(nextRounds[0] ? [nextRounds[0].id] : []);
      setIssuedTicketCount(issuedTickets.length);
      setStatusDraft(detail.status || 'PUBLISHED');
      setErrors([]);
      dirtyRef.current = false;
    } catch (error: any) {
      const message = errorMessage(error, '이벤트 정보를 불러오지 못했습니다.');
      setLoadError(message);
      Alert.alert('이벤트 정보 로드 실패', message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

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
      dirtyRef.current = true;
    }
  };

  const updateRound = (id: string, patch: Partial<RoundDraft>) => {
    if (scheduleLocked) return;
    setRounds((current) => current.map((round) => (round.id === id ? { ...round, ...patch } : round)));
    dirtyRef.current = true;
  };

  const addRound = () => {
    if (scheduleLocked) {
      Alert.alert('공연 일정 수정 불가', '이미 발행된 티켓이 있어 공연 일정은 변경할 수 없습니다.');
      return;
    }
    setRounds((current) => {
      const nextDate = addDays(current.at(-1)?.eventDate || localDate(new Date()), 1);
      const next = {
        id: `${Date.now()}-${current.length}`,
        title: `${current.length + 1}회차`,
        eventDate: nextDate,
        startTime: '19:00',
        endTime: '21:00',
      };
      setExpandedRoundIds([next.id]);
      return [...current, next];
    });
  };

  const removeRound = (id: string) => {
    if (scheduleLocked) {
      Alert.alert('공연 일정 수정 불가', '이미 발행된 티켓이 있어 공연 일정은 변경할 수 없습니다.');
      return;
    }
    setRounds((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((round) => round.id !== id).map((round, index) => ({ ...round, title: `${index + 1}회차` }));
      setExpandedRoundIds((expanded) => expanded.filter((item) => item !== id));
      return next;
    });
  };

  const confirmRemoveRound = (id: string, index: number) => {
    Alert.alert('회차 삭제', `${index + 1}회차를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => removeRound(id) },
    ]);
  };

  const validate = () => {
    const nextErrors: string[] = [];
    if (!category) nextErrors.push('카테고리를 선택해주세요.');
    if (!name.trim()) nextErrors.push('이름을 입력해주세요.');
    if (!venue.trim()) nextErrors.push('장소를 입력해주세요.');
    if (!description.trim()) nextErrors.push('소개를 입력해주세요.');
    rounds.forEach((round, index) => {
      const roundNo = index + 1;
      if (!round.eventDate || !round.startTime || !round.endTime) nextErrors.push(`[공연 일정] ${roundNo}회차의 공연일과 시간을 입력해주세요.`);
      if (round.endTime <= round.startTime) nextErrors.push(`[공연 일정] ${roundNo}회차 공연 종료 시간은 공연 시작 시간 이후로 설정해주세요.`);
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
    const backendSaleWindow = defaultBackendSaleWindow(roundStartIso(firstRound), roundStartIso(lastRound));
    const updatePayload: Record<string, unknown> = {
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
    };
    if (!scheduleLocked) {
      Object.assign(updatePayload, {
        eventAt: roundStartIso(firstRound),
        eventStartAt: roundStartIso(firstRound),
        eventEndAt: roundEndIso(lastRound),
        startsAt: roundStartIso(firstRound),
        endsAt: roundEndIso(lastRound),
        primarySaleStart: backendSaleWindow.saleStartAt,
        primarySaleEnd: backendSaleWindow.saleEndAt,
        salesStartAt: backendSaleWindow.saleStartAt,
        salesEndAt: backendSaleWindow.saleEndAt,
        rounds: sortedRounds.map((round, index) => ({
          title: round.title || `${index + 1}회차`,
          eventDate: round.eventDate,
          startTime: round.startTime,
          endTime: round.endTime,
          useGlobalSalePeriod: true,
          saleStartAt: backendSaleWindow.saleStartAt,
          saleEndAt: backendSaleWindow.saleEndAt,
        })),
      });
    }
    setSaving(true);
    try {
      await backendApi.updateEvent(event.id, updatePayload);
      if (poster) {
        await backendApi.uploadEventImage(event.id, posterFile(poster));
      }
      dirtyRef.current = false;
      Alert.alert('저장 완료', '이벤트 정보가 수정되었습니다.');
      await load();
      navigation.navigate('OrganizerEventDetail', { eventId: event.id });
    } catch (error: any) {
      Alert.alert('저장 실패', errorMessage(error, '이벤트 정보를 수정하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = async () => {
    if (!event) return;
    if (event.adminCanceled && statusDraft !== 'CANCELLED') {
      Alert.alert('변경 불가', '관리자가 취소한 이벤트는 주최자가 복구할 수 없습니다.');
      return;
    }
    const applyStatus = async () => {
      setStatusSaving(true);
      try {
        await backendApi.updateEventStatus(event.id, { status: statusDraft });
        Alert.alert('저장 완료', '이벤트 상태가 변경되었습니다.');
        navigation.navigate('OrganizerEventDetail', { eventId: event.id });
      } catch (error: any) {
        Alert.alert('상태 변경 실패', errorMessage(error, '이벤트 상태를 변경하지 못했습니다.'));
      } finally {
        setStatusSaving(false);
      }
    };
    if (statusDraft === 'CANCELLED' && String(event.status).toUpperCase() !== 'CANCELLED') {
      if (Platform.OS === 'web') {
        if (!window.confirm('취소 후 되돌릴 수 없습니다. 이벤트를 취소하시겠습니까?')) return;
        await applyStatus();
      } else {
        Alert.alert('이벤트 취소', '취소 후 되돌릴 수 없습니다. 이벤트를 취소하시겠습니까?', [
          { text: '돌아가기', style: 'cancel' },
          { text: '취소 확정', style: 'destructive', onPress: () => void applyStatus() },
        ]);
      }
      return;
    }
    await applyStatus();
  };

  const handleBack = () => {
    if (mode !== 'status' && dirtyRef.current) {
      Alert.alert(
        '변경사항이 있습니다',
        '저장하지 않고 나가시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '나가기', style: 'destructive', onPress: () => navigation.goBack() },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (loadError && !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>이벤트 수정 화면을 열 수 없습니다.</Text>
        <Text style={styles.emptyText}>{loadError}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('MyEvents')}>
          <Text style={styles.primaryButtonText}>이벤트 목록으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const modeMeta = {
    info: {
      eyebrow: 'Event Settings',
      title: '기본 정보 수정',
      topBadge: '저장 가능',
      topTone: 'green' as const,
      heroBadge: '기본 정보',
      heroTitle: '사용자에게 보이는\n이벤트 정보를 수정하세요.',
      heroMeta: '이름, 장소, 소개, 포스터는 판매 중에도 수정할 수 있습니다.',
    },
    schedule: {
      eyebrow: 'Schedule Settings',
      title: '회차 일정 관리',
      topBadge: scheduleLocked ? '제한 수정' : '수정 가능',
      topTone: scheduleLocked ? 'yellow' as const : 'green' as const,
      heroBadge: '회차 일정',
      heroTitle: '회차별 날짜와\n시간을 관리하세요.',
      heroMeta: '이미 발행된 티켓이 있는 회차는 일정 변경이 제한됩니다.',
    },
    status: {
      eyebrow: 'Event Status',
      title: '이벤트 상태 변경',
      topBadge: String(event?.status).toUpperCase() === 'PUBLISHED' ? '판매 중' : String(event?.status).toUpperCase() === 'CANCELLED' ? '취소' : '비공개',
      topTone: String(event?.status).toUpperCase() === 'PUBLISHED' ? 'green' as const : String(event?.status).toUpperCase() === 'CANCELLED' ? 'red' as const : 'gray' as const,
      heroBadge: '공개 상태',
      heroTitle: '판매와 노출 상태를\n관리하세요.',
      heroMeta: '취소는 되돌릴 수 없으므로 사용자 안내가 필요합니다.',
    },
  }[mode];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} stickyHeaderIndices={[0]}>
        <EventFlowTopBar eyebrow={modeMeta.eyebrow} title={modeMeta.title} badge={modeMeta.topBadge} badgeTone={modeMeta.topTone} onBack={handleBack} />
        <EventFlowHero badge={modeMeta.heroBadge} title={modeMeta.heroTitle} meta={modeMeta.heroMeta} imageUrl={posterPreviewUri || null} />

        {mode === 'info' ? <>
        <View style={[styles.card, styles.fieldCard]}>
          <View style={styles.formSectionHead}>
            <View style={[styles.formSectionIcon, { backgroundColor: '#EEEDFE' }]}>
              <FormIcon name="tag" color="#534AB7" />
            </View>
            <View><Text style={styles.formSectionTitle}>이벤트 기본 정보</Text><Text style={styles.formSectionSub}>목록과 상세 화면에 표시되는 정보입니다.</Text></View>
          </View>
          <EventFormGroup icon="category" label="카테고리" helper="이벤트 목록의 필터와 배지에 표시됩니다.">
            <EventCategorySummary label={EVENT_CATEGORIES.find((item) => item.value === category)?.label || '공연'} onPress={() => setCategoryOpen((value) => !value)} />
            {categoryOpen ? (
              <View style={styles.categoryGrid}>
                {EVENT_CATEGORIES.map((item) => (
                  <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.activeCategoryChip]} onPress={() => { setCategory(item.value); dirtyRef.current = true; setCategoryOpen(false); }}>
                    <Text style={[styles.categoryChipText, category === item.value && styles.activeCategoryChipText]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </EventFormGroup>
          <EventFormGroup icon="ticket" label="이벤트 이름" helper="사용자에게 가장 크게 표시되는 제목입니다." value={name} onChangeText={(v) => { setName(v); dirtyRef.current = true; }} />
          <EventFormGroup icon="map" label="장소" helper="목록, 상세, 티켓 QR 화면에 함께 표시됩니다." value={venue} onChangeText={(v) => { setVenue(v); dirtyRef.current = true; }} />
        </View>

        <View style={[styles.card, styles.fieldCard]}>
          <View style={styles.formSectionHead}>
            <View style={[styles.formSectionIcon, { backgroundColor: '#E6F1FB' }]}>
              <FormIcon name="align" color="#185FA5" />
            </View>
            <View><Text style={styles.formSectionTitle}>소개 문구</Text><Text style={styles.formSectionSub}>사용자가 상세 화면에서 확인하는 설명입니다.</Text></View>
          </View>
          <EventFormGroup
            icon="align"
            label="소개 문구"
            helper="출연진, 운영 시간, 입장 안내를 포함하면 좋습니다."
            value={description}
            onChangeText={(v) => { setDescription(v); dirtyRef.current = true; }}
            placeholder="공연 소개, 출연진, 운영 시간, 입장 안내, 주의사항 등을 입력해주세요."
            multiline
            count={`${description.length}/500`}
          />
        </View>

        <View style={[styles.card, styles.fieldCard]}>
          <View style={styles.formSectionHead}>
            <View style={[styles.formSectionIcon, { backgroundColor: '#E1F5EE' }]}>
              <FormIcon name="photo" color="#0F6E56" />
            </View>
            <View><Text style={styles.formSectionTitle}>포스터</Text><Text style={styles.formSectionSub}>탐색, 상세, 티켓 화면에 공통으로 사용됩니다.</Text></View>
          </View>
          <View style={styles.posterUpload}>
            {posterPreviewUri ? (
              <TouchableOpacity activeOpacity={0.88} onPress={() => setPosterPreviewOpen(true)}>
                <Image source={{ uri: posterPreviewUri }} style={styles.posterPreview} />
              </TouchableOpacity>
            ) : <View style={styles.posterFallback}><Text style={styles.posterFallbackText}>LIVE{'\n'}POSTER</Text></View>}
            <View style={styles.uploadInfo}>
              <Text style={styles.uploadTitle}>현재 포스터</Text>
              <Text style={styles.uploadSubtitle}>권장 비율 3:4. 이벤트 목록에서 가장 먼저 보입니다.</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={pickPoster}>
                <FormIcon name="upload" color="#534AB7" size={13} />
                <Text style={styles.uploadButtonText}>이미지 변경</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </> : null}

        {mode === 'schedule' ? <>
        <View style={styles.sectionWrap}>
          <EventFlowNotice
            tone={scheduleLocked ? 'orange' : 'green'}
            title={scheduleLocked ? `이미 발행된 티켓 ${issuedTicketCount.toLocaleString()}장이 있습니다.` : '모든 회차 일정을 수정할 수 있습니다.'}
            subtitle={scheduleLocked ? '사용자 혼선을 막기 위해 주요 일정 변경은 제한됩니다.' : '티켓 발행 전에는 날짜와 시간을 자유롭게 변경할 수 있습니다.'}
          />
        </View>
        <View style={[styles.card, styles.scheduleCard]}>
          <View style={styles.roundList}>
            {rounds.map((round, index) => {
              const expanded = expandedRoundIds.includes(round.id);
              return (
                <View key={round.id} style={styles.roundItem}>
                  <TouchableOpacity style={styles.roundHead} onPress={() => setExpandedRoundIds((current) => current.includes(round.id) ? current.filter((item) => item !== round.id) : [...current, round.id])}>
                    <View style={styles.roundNum}>
                      <Text style={styles.roundNumText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roundTitle}>{index + 1}회차 · {formatDotDate(round.eventDate)}</Text>
                      <Text style={styles.roundTime}>{round.startTime} ~ {round.endTime}</Text>
                    </View>
                    <FlowBadge label={scheduleLocked ? '제한 수정' : '수정 가능'} tone={scheduleLocked ? 'yellow' : 'green'} />
                  </TouchableOpacity>
                  {expanded ? (
                    <View style={styles.roundBody}>
                      <Text style={styles.fieldLbl}>이벤트 날짜</Text>
                      <SingleDatePicker value={round.eventDate} onChange={(value) => updateRound(round.id, { eventDate: value })} markedRounds={markedRounds} disabled={scheduleLocked} />
                      <View style={[styles.fieldRow, { marginTop: 8 }]}>
                        <View style={styles.fieldBox}>
                          <Text style={styles.fieldLbl}>시작 시간</Text>
                          <TimeWheelPicker label="이벤트 시작 시간" value={round.startTime} onChange={(value) => updateRound(round.id, { startTime: value })} disabled={scheduleLocked} />
                        </View>
                        <View style={styles.fieldBox}>
                          <Text style={styles.fieldLbl}>종료 시간</Text>
                          <TimeWheelPicker label="이벤트 종료 시간" value={round.endTime} onChange={(value) => updateRound(round.id, { endTime: value })} disabled={scheduleLocked} />
                        </View>
                      </View>
                      <Text style={styles.fieldLbl}>회차 제목</Text>
                      <TextInput
                        style={[styles.input, scheduleLocked && styles.disabledButton]}
                        value={round.title}
                        editable={!scheduleLocked}
                        onChangeText={(value) => updateRound(round.id, { title: value })}
                        placeholder={`${index + 1}회차`}
                      />
                      <TouchableOpacity style={styles.roundSaveBtn} onPress={() => setExpandedRoundIds((current) => current.filter((item) => item !== round.id))}>
                        <Text style={styles.roundSaveBtnText}>회차 저장</Text>
                      </TouchableOpacity>
                      {rounds.length > 1 && !scheduleLocked ? (
                        <TouchableOpacity style={styles.roundDelBtn} onPress={() => confirmRemoveRound(round.id, index)}>
                          <Text style={styles.roundDelBtnText}>이 회차 삭제</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
          <TouchableOpacity style={[styles.addRoundBtn, scheduleLocked && styles.disabledButton]} disabled={scheduleLocked} onPress={addRound}>
            <Text style={styles.addRoundBtnText}>+ 회차 추가</Text>
          </TouchableOpacity>
        </View>
        </> : null}

        {mode === 'status' ? (
          <View style={styles.sectionWrap}>
            <EventFlowNotice
              tone="orange"
              title={`현재 상태: ${String(event?.status).toUpperCase() === 'PUBLISHED' ? '판매 중' : String(event?.status).toUpperCase() === 'CANCELLED' ? '취소' : '비공개'}`}
              subtitle="게시중 이벤트는 사용자 앱의 탐색 화면에 표시됩니다."
            />
            <StatusOption active={statusDraft === 'PUBLISHED'} icon="broadcast" title="게시중" subtitle="사용자에게 이벤트가 공개되고 예매가 가능합니다." tone="purple" disabled={String(event?.status).toUpperCase() === 'CANCELLED'} onPress={() => setStatusDraft('PUBLISHED')} />
            <StatusOption active={statusDraft === 'INACTIVE'} icon="eyeOff" title="비공개" subtitle="목록에서 숨깁니다. 기존 티켓은 유지됩니다." tone="purple" disabled={String(event?.status).toUpperCase() === 'CANCELLED'} onPress={() => setStatusDraft('INACTIVE')} />
            <StatusOption active={statusDraft === 'CANCELLED'} icon="x" title="이벤트 취소" subtitle="취소 후 되돌릴 수 없습니다." tone="red" onPress={() => setStatusDraft('CANCELLED')} />
          </View>
        ) : null}

        {mode !== 'status' && errors.length > 0 ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>오류</Text>
            {errors.map((message) => <Text key={message} style={styles.errorItem}>· {message}</Text>)}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.primaryButton, (saving || statusSaving) && styles.disabledButton]} disabled={saving || statusSaving} onPress={mode === 'status' ? saveStatus : save}>
          <Text style={styles.primaryButtonText}>{mode === 'status' ? statusSaving ? '저장 중...' : '상태 변경 저장' : saving ? '저장 중...' : mode === 'schedule' ? '회차 저장' : '수정 완료'}</Text>
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

function StatusOption({
  active,
  icon,
  title,
  subtitle,
  tone,
  disabled,
  onPress,
}: {
  active: boolean;
  icon: 'broadcast' | 'eyeOff' | 'x';
  title: string;
  subtitle: string;
  tone: 'purple' | 'red';
  disabled?: boolean;
  onPress: () => void;
}) {
  const danger = tone === 'red';
  return (
    <TouchableOpacity style={[styles.statusOption, active && styles.statusOptionActive, danger && styles.statusOptionDanger, disabled && styles.disabledButton]} disabled={disabled} onPress={onPress}>
      <View style={[styles.statusOptionIcon, danger && styles.statusOptionIconDanger]}>
        <TicketIcon name={icon} color={danger ? '#DC2626' : '#534AB7'} size={20} />
      </View>
      <View style={styles.statusOptionCopy}>
        <Text style={[styles.statusOptionTitle, danger && styles.statusOptionTitleDanger]}>{title}</Text>
        <Text style={styles.statusOptionSubtitle}>{subtitle}</Text>
      </View>
      {active ? <FlowBadge label="현재" tone={danger ? 'red' : 'green'} /> : null}
    </TouchableOpacity>
  );
}

function SingleDatePicker({ value, onChange, markedRounds = [], disabled = false }: { value: string; onChange: (date: string) => void; markedRounds?: MarkedRoundDate[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity style={[styles.compactPickerButton, disabled && styles.disabledButton]} disabled={disabled} onPress={() => setOpen(true)}>
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

function TimeWheelPicker({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (time: string) => void; disabled?: boolean }) {
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
      <TouchableOpacity style={[styles.compactPickerButton, disabled && styles.disabledButton]} disabled={disabled} onPress={openWheel}>
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
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  scroll: { flex: 1 },
  content: { paddingBottom: 118 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 8, color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  hero: { paddingHorizontal: 18, paddingBottom: 28 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  heroBackButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', lineHeight: 25 },
  heroSub: { color: 'rgba(255,255,255,0.48)', fontSize: 11, lineHeight: 17, marginTop: 3 },
  card: { marginTop: 0, marginHorizontal: 16, marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', ...flowShadow },
  fieldCard: { padding: 0, borderWidth: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  scheduleCard: { padding: 0, overflow: 'visible', borderWidth: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  sectionWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  formSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 2 },
  formSectionIcon: { width: 36, height: 36, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  formSectionTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  formSectionSub: { fontSize: 10, color: '#64748B', lineHeight: 14, marginTop: 3 },
  label: { marginBottom: 8, color: '#26364F', fontSize: 12, fontWeight: '900' },
  helpText: { marginTop: 7, color: '#94A3B8', fontSize: 10, lineHeight: 15 },
  lockedNotice: { marginTop: 8, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, color: '#92400E', fontSize: 12, fontWeight: '800', lineHeight: 18 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, paddingHorizontal: 15, paddingVertical: 14, backgroundColor: '#FFFFFF', color: '#0F172A', fontSize: 15, fontWeight: '800', marginBottom: 12, ...flowShadow },
  filledInput: { borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  textArea: { minHeight: 128, maxHeight: 180, textAlignVertical: 'top', fontWeight: '500' },
  posterUpload: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, ...flowShadow },
  posterPreview: { width: 92, height: 122, borderRadius: 20, backgroundColor: '#E2E8F0' },
  posterFallback: { width: 92, height: 122, borderRadius: 20, justifyContent: 'flex-end', padding: 10, backgroundColor: '#534AB7' },
  posterFallbackText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  uploadInfo: { flex: 1, minWidth: 0 },
  uploadTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900', marginBottom: 5 },
  uploadSubtitle: { color: '#64748B', fontSize: 11, lineHeight: 16, marginBottom: 12 },
  uploadButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 14, backgroundColor: '#EEEDFE' },
  uploadButtonText: { color: '#534AB7', fontSize: 12, fontWeight: '900' },
  posterPlaceholder: { minHeight: 96, borderWidth: 1.5, borderColor: '#CECBF6', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFE', padding: 18 },
  posterPlaceholderText: { color: '#B4B2A9', fontSize: 11, fontWeight: '800', textAlign: 'center', lineHeight: 16, marginBottom: 8 },
  posterZoneButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEEDFE', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7 },
  posterZoneButtonText: { color: '#534AB7', fontSize: 11, fontWeight: '900' },
  posterActionRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  posterButton: { flex: 1, borderWidth: 1, borderColor: '#534AB7', borderRadius: 8, paddingVertical: 11, alignItems: 'center', backgroundColor: '#EEEDFE' },
  posterButtonText: { color: '#534AB7', fontWeight: '900', fontSize: 13 },
  posterDeleteButton: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  posterDeleteText: { color: '#B91C1C', fontWeight: '900', fontSize: 13 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#534AB7' },
  roundDescBlock: { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 6 },
  warnBox: { backgroundColor: '#FAEEDA', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 8 },
  warnText: { fontSize: 10, color: '#854F0B', fontWeight: '600', lineHeight: 15, flex: 1 },
  roundList: { gap: 6 },
  roundItem: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  roundHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: '#FBFAFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  roundNum: { width: 34, height: 34, borderRadius: 13, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roundNumText: { fontSize: 13, fontWeight: '900', color: '#534AB7' },
  roundTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  roundTime: { fontSize: 10, color: '#64748B', marginTop: 3 },
  roundChev: { fontSize: 13, color: '#B4B2A9' },
  roundChevOpen: { transform: [{ rotate: '180deg' }] },
  roundBody: { backgroundColor: '#FFFFFF', padding: 14 },
  fieldFull: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF', marginBottom: 8 },
  fieldVal: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  fieldUnit: { fontSize: 10, color: '#9CA3AF' },
  fieldRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fieldBox: { flex: 1 },
  fieldLbl: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 3 },
  roundSaveBtn: { backgroundColor: '#534AB7', borderRadius: 17, paddingVertical: 13, alignItems: 'center' },
  roundSaveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  roundDelBtn: { backgroundColor: '#FCEBEB', borderRadius: 8, paddingVertical: 9, alignItems: 'center', marginTop: 6 },
  roundDelBtnText: { color: '#A32D2D', fontSize: 11, fontWeight: '700' },
  addRoundBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9C2FF', borderRadius: 18, paddingVertical: 14, backgroundColor: '#FBFAFF', marginTop: 10, marginHorizontal: 16, marginBottom: 14 },
  addRoundBtnText: { fontSize: 13, fontWeight: '900', color: '#534AB7' },
  roundBox: { marginTop: 9, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF' },
  roundHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundHeaderCopy: { flex: 1 },
  roundSummary: { marginTop: 4, color: '#64748B', fontSize: 13, fontWeight: '800' },
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
  saleCompleteButton: { marginTop: 10, borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 11, backgroundColor: '#EFF6FF', alignItems: 'center' },
  saleCompleteText: { color: '#2563EB', fontWeight: '900' },
  rangePickerBox: { marginTop: 9 },
  rangePickerTitle: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  rangePickerValue: { marginTop: 3, color: '#0F172A', fontWeight: '900' },
  compactPickerButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  activePickerButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  compactPickerCopy: { flex: 1 },
  compactPickerText: { color: '#0F172A', fontWeight: '900' },
  compactPickerAction: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
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
  bottomBar: { borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 16, paddingVertical: 12 },
  primaryButton: { backgroundColor: '#534AB7', borderRadius: 17, paddingVertical: 16, alignItems: 'center', ...flowShadow },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewImage: { width: '88%', aspectRatio: 3 / 4, borderRadius: 8 },
  previewClose: { marginTop: 16, color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  statusOption: { padding: 13, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 18, backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  statusOptionActive: { borderWidth: 2, borderColor: '#534AB7', backgroundColor: '#FBFAFF' },
  statusOptionDanger: { borderColor: '#FECDD3' },
  statusOptionIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  statusOptionIconDanger: { backgroundColor: '#FEE2E2' },
  statusOptionCopy: { flex: 1, minWidth: 0 },
  statusOptionTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 3 },
  statusOptionTitleDanger: { color: '#DC2626' },
  statusOptionSubtitle: { color: '#64748B', fontSize: 10, lineHeight: 14 },
});
