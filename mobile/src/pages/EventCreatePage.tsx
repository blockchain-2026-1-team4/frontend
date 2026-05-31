import React, { useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

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

type EventRoundDraft = {
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

const EVENT_CATEGORIES = [
  { value: 'CONCERT', label: '공연' },
  { value: 'SPORTS', label: '스포츠' },
  { value: 'EXHIBITION', label: '전시' },
  { value: 'FESTIVAL', label: '페스티벌' },
  { value: 'ETC', label: '기타' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTE_OPTIONS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const FIELD_OFFSET: Record<string, number> = {
  category: 100,
  name: 170,
  venue: 260,
  description: 330,
  rounds: 560,
};

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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}.${month}.${day}`;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(valueDate: string, valueTime: string) {
  return `${formatDotDate(valueDate)} ${valueTime}`;
}

function toStartOfDayIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function toEndOfDayIso(date: string) {
  return new Date(`${date}T23:59:00`).toISOString();
}

function toDateTimeIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function confirmOvernightRound(message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(message));
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      '회차 저장',
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: '확인', onPress: () => resolve(true) },
      ],
      { cancelable: true },
    );
  });
}

function compareDateTime(dateA: string, timeA: string, dateB: string, timeB: string) {
  return new Date(`${dateA}T${timeA}:00`).getTime() - new Date(`${dateB}T${timeB}:00`).getTime();
}

function addDaysToDateTime(date: string, time: string, days: number) {
  const next = new Date(`${date}T${time}:00`);
  next.setDate(next.getDate() + days);
  return next;
}

function roundStartIso(round: EventRoundDraft) {
  return toDateTimeIso(round.eventDate, round.startTime);
}

function roundEndIso(round: EventRoundDraft) {
  const start = toDateTimeIso(round.eventDate, round.startTime);
  const end = toDateTimeIso(round.eventDate, round.endTime);
  if (end <= start) {
    return addDaysToDateTime(round.eventDate, round.endTime, 1).toISOString();
  }
  return end;
}

function defaultBackendSaleWindow(eventStartIso: string) {
  const eventStart = new Date(eventStartIso);
  const saleEnd = Number.isNaN(eventStart.getTime()) ? new Date() : eventStart;
  const now = new Date();
  const saleStart = now < saleEnd ? now : new Date(saleEnd.getTime() - 24 * 60 * 60 * 1000);
  return {
    saleStartAt: saleStart.toISOString(),
    saleEndAt: saleEnd.toISOString(),
  };
}

function buildRound(index: number, eventDate: string): EventRoundDraft {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    title: `${index + 1}회차`,
    eventDate,
    startTime: index === 0 ? '19:00' : '14:00',
    endTime: index === 0 ? '21:00' : '16:00',
  };
}

function posterFile(asset: PosterAsset) {
  // Derive extension from mimeType so iOS HEIC→JPEG conversion doesn't leave a .heic filename
  // that the backend would reject (ALLOWED_EXTENSIONS = jpg, jpeg, png, webp).
  const mimeType = asset.mimeType || 'image/jpeg';
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const name = `poster-${Date.now()}.${ext}`;
  return { uri: asset.uri, name, type: mimeType };
}

export default function EventCreatePage({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const today = useMemo(() => localDate(new Date()), []);
  const defaultEventDate = useMemo(() => addDays(today, 14), [today]);
  const initialRound = useMemo(() => buildRound(0, defaultEventDate), [defaultEventDate]);

  const [category, setCategory] = useState('CONCERT');
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [venuePlaceId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [descriptionHeight, setDescriptionHeight] = useState(76);
  const [poster, setPoster] = useState<PosterAsset | null>(null);
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);
  const [rounds, setRounds] = useState<EventRoundDraft[]>([initialRound]);
  const [expandedRoundIds, setExpandedRoundIds] = useState<string[]>([]);
  const [roundAcknowledgedIds, setRoundAcknowledgedIds] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [roundMessages, setRoundMessages] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const filledInputStyle = (_value: string, invalid?: boolean) => [
    styles.input,
    styles.filledInput,
    invalid && styles.invalidInput,
  ];

  const updateRound = (id: string, patch: Partial<EventRoundDraft>) => {
    setRounds((current) => {
      const nextRounds = current.map((round) => (round.id === id ? { ...round, ...patch } : round));
      if (patch.eventDate || patch.startTime || patch.endTime) {
        setRoundAcknowledgedIds((current) => ({ ...current, [id]: false }));
      }
      return nextRounds;
    });
  };

  const toggleRound = (id: string) => {
    setExpandedRoundIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const saveRound = async (id: string) => {
    const target = rounds.find((round) => round.id === id);
    if (target) {
      const startsAt = toDateTimeIso(target.eventDate, target.startTime);
      const endsAt = toDateTimeIso(target.eventDate, target.endTime);
      if (endsAt <= startsAt) {
        setRoundMessages((current) => ({ ...current, [id]: ['[공연 일정] 공연 종료 시간이 공연 시작 시간보다 빠릅니다. 다음 날 종료 일정으로 처리됩니다.'] }));
        setErrors([]);
        setInvalidFields((current) => ({ ...current, rounds: false }));
        if (!roundAcknowledgedIds[id]) {
          return;
        }
        setExpandedRoundIds((current) => current.filter((item) => item !== id));
        return;
      }
    }
    setRoundMessages((current) => ({ ...current, [id]: [] }));
    setRoundAcknowledgedIds((current) => ({ ...current, [id]: false }));
    setErrors([]);
    setInvalidFields((current) => ({ ...current, rounds: false }));
    setExpandedRoundIds((current) => current.filter((item) => item !== id));
  };

  const addRound = () => {
    setRounds((current) => {
      const nextDate = addDays(current.at(-1)?.eventDate || defaultEventDate, 1);
      const preparedNext = buildRound(current.length, nextDate);
      setExpandedRoundIds([preparedNext.id]);
      return [...current, preparedNext];
    });
  };

  const removeRound = (id: string) => {
    setRounds((latest) => {
      if (latest.length <= 1) return latest;
      const nextRounds = latest
        .filter((round) => round.id !== id)
        .map((round, newIndex) => {
          const oldIndex = latest.findIndex((item) => item.id === round.id);
          const wasAutoTitle = !round.title || round.title === `${oldIndex + 1}회차`;
          return wasAutoTitle ? { ...round, title: `${newIndex + 1}회차` } : round;
        });
      setExpandedRoundIds((current) => current.filter((item) => item !== id));
      setRoundMessages((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return nextRounds;
    });
  };

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
    }
  };

  const validate = () => {
    const nextErrors: string[] = [];
    const nextInvalid: Record<string, boolean> = {};
    const nextRoundMessages: Record<string, string[]> = {};

    if (!category) {
      nextErrors.push('카테고리를 선택해야 합니다.');
      nextInvalid.category = true;
    }
    if (!name.trim()) {
      nextErrors.push('이벤트 이름을 입력해야 합니다.');
      nextInvalid.name = true;
    }
    if (!venue.trim()) {
      nextErrors.push('장소를 입력해야 합니다.');
      nextInvalid.venue = true;
    }
    if (!description.trim()) {
      nextErrors.push('소개를 입력해야 합니다.');
      nextInvalid.description = true;
    }
    if (rounds.length === 0) {
      nextErrors.push('최소 1개의 회차를 등록해야 합니다.');
      nextInvalid.rounds = true;
    }

    const ranges = rounds.map((round, index) => {
      const roundNumber = index + 1;
      const startsAt = new Date(toDateTimeIso(round.eventDate, round.startTime));
      const endsAtRaw = new Date(toDateTimeIso(round.eventDate, round.endTime));
      const endsAt = endsAtRaw <= startsAt ? new Date(endsAtRaw.getTime() + 24 * 60 * 60 * 1000) : endsAtRaw;

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        nextErrors.push(`[공연 일정] ${roundNumber}회차의 공연일과 시간을 입력해주세요.`);
        nextInvalid.rounds = true;
      } else if (endsAtRaw <= startsAt) {
        nextRoundMessages[round.id] = ['[공연 일정] 공연 종료 시간이 공연 시작 시간보다 빠릅니다. 다음 날 종료 일정으로 처리됩니다.'];
      } else {
        nextRoundMessages[round.id] = [];
      }

      return { index, startsAt, endsAt };
    }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    ranges.forEach((range, index) => {
      const next = ranges[index + 1];
      if (next && range.endsAt > next.startsAt) {
        nextErrors.push(`${range.index + 1}회차와 ${next.index + 1}회차 시간이 서로 겹칩니다.`);
        nextInvalid.rounds = true;
      }
    });

    setErrors(nextErrors);
    setInvalidFields(nextInvalid);
    setRoundMessages(nextRoundMessages);
    if (nextErrors.length > 0) {
      if (nextInvalid.rounds) setExpandedRoundIds(rounds.map((round) => round.id));
      const firstField = Object.keys(FIELD_OFFSET).find((field) => nextInvalid[field]);
      scrollRef.current?.scrollTo({ y: FIELD_OFFSET[firstField || 'category'], animated: true });
      return false;
    }
    return true;
  };

  const createEvent = async () => {
    if (!validate()) return;

    const sortedRounds = [...rounds].sort((a, b) => roundStartIso(a).localeCompare(roundStartIso(b)));
    const firstRound = sortedRounds[0];
    const lastRound = [...sortedRounds].sort((a, b) => roundEndIso(b).localeCompare(roundEndIso(a)))[0];
    const backendSaleWindow = defaultBackendSaleWindow(roundStartIso(firstRound));

    setSubmitting(true);
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        setErrors([statusMessage]);
        return;
      }

      const createdEvent = await backendApi.createEvent({
        name: name.trim(),
        category,
        venue: venue.trim(),
        location: {
          name: venue.trim(),
          address: venue.trim(),
          placeId: venuePlaceId,
          latitude: null,
          longitude: null,
        },
        venuePlaceId,
        description: description.trim(),
        imageUrl: null,
        eventAt: roundStartIso(firstRound),
        eventStartAt: roundStartIso(firstRound),
        eventEndAt: roundEndIso(lastRound),
        startsAt: roundStartIso(firstRound),
        endsAt: roundEndIso(lastRound),
        primarySaleStart: backendSaleWindow.saleStartAt,
        primarySaleEnd: backendSaleWindow.saleEndAt,
        salesStartAt: backendSaleWindow.saleStartAt,
        salesEndAt: backendSaleWindow.saleEndAt,
        ticketPriceWei: '1',
        totalTicketCount: 0,
        resaleAllowed: false,
        maxResalePriceRate: 10000,
        resaleStart: null,
        resaleEnd: null,
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
      const createdEventId = createdEvent.id || (createdEvent as any).eventId;
      const createdEventIdParam = createdEventId ? String(createdEventId) : '';

      if (!createdEventIdParam) {
        setErrors(['이벤트가 생성됐지만 식별자를 확인하지 못했습니다. 내 이벤트 목록에서 다시 확인해주세요.']);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }

      if (poster) {
        try {
          await backendApi.uploadEventImage(createdEventIdParam, posterFile(poster));
        } catch (uploadError: any) {
          Alert.alert('포스터 업로드 실패', errorMessage(uploadError, '이벤트는 생성되었지만 포스터 업로드에 실패했습니다. 이벤트 설정에서 다시 업로드할 수 있습니다.'));
        }
      }

      Alert.alert('등록 완료', '이벤트가 등록되었습니다. 다음 단계에서 티켓을 설정합니다.');
      navigation.replace('TicketIssue', { eventId: createdEventIdParam, returnTo: 'create' });
    } catch (error: any) {
      setErrors([errorMessage(error, '이벤트를 등록하지 못했습니다.')]);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
        <HeroGradient colors={['#1A1A2E', '#2D2B6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Math.max(insets.top + 14, 36) }]}>
          <View style={styles.heroTopBar}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.heroBackButton} onPress={() => navigation.goBack()}>
              <BackIcon />
            </TouchableOpacity>
            <Text style={styles.heroEyebrow}>EVENT CREATE</Text>
          </View>
          <Text style={styles.heroTitle}>이벤트 등록</Text>
          <Text style={styles.heroSub}>이벤트 등록 후 티켓과 좌석 정보를 설정합니다.</Text>
        </HeroGradient>

        <View style={styles.card}>
          <View style={styles.formSectionHead}>
            <View style={[styles.formSectionIcon, { backgroundColor: '#EEEDFE' }]}>
              <FormIcon name="tag" color="#534AB7" />
            </View>
            <Text style={styles.formSectionTitle}>기본 정보</Text>
          </View>
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.categoryGrid}>
            {EVENT_CATEGORIES.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.activeCategoryChip]} onPress={() => setCategory(item.value)}>
                <Text style={[styles.categoryChipText, category === item.value && styles.activeCategoryChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>이름</Text>
          <TextInput style={filledInputStyle(name, invalidFields.name)} value={name} onChangeText={setName} placeholder="예: TRUST LIVE 2026" />
          <Text style={styles.helpText}>사용자에게 표시될 이벤트 이름을 입력해주세요.</Text>

          <Text style={styles.label}>장소</Text>
          <TextInput style={filledInputStyle(venue, invalidFields.venue)} value={venue} onChangeText={setVenue} placeholder="예: 올림픽공원 KSPO DOME" />
        </View>

        <View style={styles.card}>
          <View style={styles.formSectionHead}>
            <View style={[styles.formSectionIcon, { backgroundColor: '#E6F1FB' }]}>
              <FormIcon name="align" color="#185FA5" />
            </View>
            <Text style={[styles.formSectionTitle, { color: '#185FA5' }]}>소개</Text>
          </View>
          <TextInput
            style={[styles.input, styles.filledInput, styles.textArea, { height: descriptionHeight }, invalidFields.description && styles.invalidInput]}
            value={description}
            onChangeText={setDescription}
            onContentSizeChange={(event) => setDescriptionHeight(Math.max(76, Math.min(180, event.nativeEvent.contentSize.height + 12)))}
            placeholder="공연 소개, 출연진, 운영 시간, 입장 안내, 주의사항 등을 입력해주세요."
            multiline
          />
        </View>

        <View style={styles.card}>
          <View style={styles.formSectionHead}>
            <View style={[styles.formSectionIcon, { backgroundColor: '#E1F5EE' }]}>
              <FormIcon name="photo" color="#0F6E56" />
            </View>
            <Text style={[styles.formSectionTitle, { color: '#0F6E56' }]}>포스터 <Text style={styles.optionalText}>(선택)</Text></Text>
          </View>
          {poster ? (
            <TouchableOpacity onPress={() => setPosterPreviewOpen(true)} activeOpacity={0.88}>
              <Image source={{ uri: poster.uri }} style={styles.posterPreview} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.posterPlaceholder} activeOpacity={0.86} onPress={pickPoster}>
              <Text style={styles.posterPlaceholderText}>포스터를 등록하면 이벤트 목록과 상세에 표시됩니다.</Text>
              <View style={styles.posterZoneButton}>
                <FormIcon name="upload" color="#534AB7" size={12} />
                <Text style={styles.posterZoneButtonText}>이미지 선택</Text>
              </View>
            </TouchableOpacity>
          )}
          <View style={styles.posterActionRow}>
            <TouchableOpacity style={styles.posterButton} onPress={pickPoster}>
              <Text style={styles.posterButtonText}>{poster ? '다른 포스터 등록' : '포스터 등록'}</Text>
            </TouchableOpacity>
            {poster ? (
              <TouchableOpacity style={[styles.posterButton, styles.posterDeleteButton]} onPress={() => setPoster(null)}>
                <Text style={styles.posterDeleteText}>포스터 제거</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.helpText}>사용자에게 보여질 포스터 이미지를 등록하세요.</Text>
        </View>

        <View style={[styles.card, invalidFields.rounds && styles.invalidRound]}>
          <View style={styles.formSectionHead}>
            <View style={[styles.formSectionIcon, { backgroundColor: '#FAEEDA' }]}>
              <FormIcon name="calendar" color="#854F0B" />
            </View>
            <Text style={[styles.formSectionTitle, { color: '#854F0B' }]}>회차 일정</Text>
          </View>
          <View style={styles.roundDescBlock}>
            <Text style={styles.cardTitle}>일정</Text>
            <Text style={styles.helpText}>회차별로 날짜와 시간을 설정하세요.</Text>
            <Text style={styles.helpText}>장소나 일정 차이가 큰 경우 별도 이벤트 등록을 권장합니다.</Text>
          </View>
          <View style={styles.roundList}>
            {rounds.map((round, index) => {
              const expanded = expandedRoundIds.includes(round.id);
              const canDelete = rounds.length > 1;
              return (
                <View key={round.id} style={styles.roundItem}>
                  <TouchableOpacity style={styles.roundHead} onPress={() => toggleRound(round.id)} activeOpacity={0.82}>
                    <View style={styles.roundNum}>
                      <Text style={styles.roundNumText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roundTitle}>{round.title || `${index + 1}회차`} · {formatDotDate(round.eventDate)}</Text>
                      <Text style={styles.roundTime}>{round.startTime} ~ {round.endTime}</Text>
                    </View>
                    <Text style={[styles.roundChev, expanded && styles.roundChevOpen]}>›</Text>
                  </TouchableOpacity>

                  {expanded ? (
                    <View style={styles.roundBody}>
                      <View style={styles.flatField}>
                        <Text style={styles.fieldLbl}>이벤트 날짜</Text>
                        <SingleDatePicker
                          value={round.eventDate}
                          onChange={(value) => updateRound(round.id, { eventDate: value })}
                          markedRounds={rounds.map((item, itemIndex) => ({ date: item.eventDate, label: `${itemIndex + 1}회차` }))}
                        />
                      </View>
                      <View style={[styles.fieldRow, { marginTop: 8 }]}>
                        <View style={styles.fieldBox}>
                          <Text style={styles.fieldLbl}>시작 시간</Text>
                          <TimeWheelPicker label="이벤트 시작 시간" value={round.startTime} onChange={(value) => updateRound(round.id, { startTime: value })} />
                        </View>
                        <View style={styles.fieldBox}>
                          <Text style={styles.fieldLbl}>종료 시간</Text>
                          <TimeWheelPicker label="이벤트 종료 시간" value={round.endTime} onChange={(value) => updateRound(round.id, { endTime: value })} />
                        </View>
                      </View>
                      <View style={styles.flatField}>
                        <Text style={styles.fieldLbl}>회차 제목 (선택)</Text>
                        <TextInput
                          style={styles.input}
                          value={round.title}
                          onChangeText={(value) => updateRound(round.id, { title: value })}
                          placeholder={`${index + 1}회차`}
                        />
                      </View>
                      {roundMessages[round.id]?.length ? (
                        <View style={styles.inlineWarningBox}>
                          {roundMessages[round.id].map((message) => <Text key={message} style={styles.inlineWarningText}>· {message}</Text>)}
                          <TouchableOpacity style={styles.warningAgreeButton} onPress={() => setRoundAcknowledgedIds((current) => ({ ...current, [round.id]: true }))}>
                            <Text style={styles.warningAgreeText}>{roundAcknowledgedIds[round.id] ? '동의됨' : '동의'}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      <TouchableOpacity style={styles.roundSaveBtn} onPress={() => void saveRound(round.id)}>
                        <Text style={styles.roundSaveBtnText}>회차 저장</Text>
                      </TouchableOpacity>
                      {canDelete ? (
                        <TouchableOpacity style={styles.roundDelBtn} onPress={() => removeRound(round.id)}>
                          <Text style={styles.roundDelBtnText}>이 회차 삭제</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.addRoundBtn} onPress={addRound}>
            <Text style={styles.addRoundBtnText}>+ 회차 추가</Text>
          </TouchableOpacity>
        </View>

        {errors.length > 0 ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>오류</Text>
            {errors.map((message) => <Text key={message} style={styles.errorItem}>· {message}</Text>)}
          </View>
        ) : null}

        <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabledButton]} disabled={submitting} onPress={createEvent}>
          <Text style={styles.primaryButtonText}>{submitting ? '등록 중...' : '다음: 티켓 설정'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={posterPreviewOpen} transparent animationType="fade" onRequestClose={() => setPosterPreviewOpen(false)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPosterPreviewOpen(false)}>
          {poster ? <Image source={{ uri: poster.uri }} style={styles.previewImage} resizeMode="contain" /> : null}
          <Text style={styles.previewClose}>닫기</Text>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function MonthCalendar({
  selectedStart,
  selectedEnd,
  markedRounds = [],
  onSelect,
}: {
  selectedStart: string;
  selectedEnd?: string;
  markedRounds?: MarkedRoundDate[];
  onSelect: (date: string) => void;
}) {
  const selectedDate = new Date(`${selectedStart || localDate(new Date())}T00:00:00`);
  const [visibleMonth, setVisibleMonth] = useState(localDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)));
  const base = new Date(`${visibleMonth}T00:00:00`);
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, index) => localDate(new Date(base.getFullYear(), base.getMonth(), index + 1)));
  const cells = [
    ...Array.from({ length: firstDay }, () => ''),
    ...monthDates,
    ...Array.from({ length: 42 - firstDay - monthDates.length }, () => ''),
  ];

  const moveMonth = (amount: number) => {
    const next = new Date(base.getFullYear(), base.getMonth() + amount, 1);
    setVisibleMonth(localDate(next));
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity style={styles.monthButton} onPress={() => moveMonth(-1)}>
          <Text style={styles.monthButtonText}>이전</Text>
        </TouchableOpacity>
        <Text style={styles.calendarTitle}>{base.getFullYear()}년 {base.getMonth() + 1}월</Text>
        <TouchableOpacity style={styles.monthButton} onPress={() => moveMonth(1)}>
          <Text style={styles.monthButtonText}>다음</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.weekRow}>{['일', '월', '화', '수', '목', '금', '토'].map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}</View>
      <View style={styles.dayGrid}>
        {cells.map((date, index) => {
          const selected = date && (date === selectedStart || date === selectedEnd);
          const inRange = date && selectedStart && selectedEnd && date > selectedStart && date < selectedEnd;
          const roundMarker = date ? markedRounds.filter((round) => round.date === date).map((round) => round.label).join(', ') : '';
          return (
            <TouchableOpacity key={`${date}-${index}`} style={[styles.dayCell, !date && styles.emptyDayCell, selected && styles.selectedDay, inRange && styles.rangeDay]} disabled={!date} onPress={() => onSelect(date)}>
              <Text style={[styles.dayText, !date && styles.emptyDayText, selected && styles.selectedDayText]}>{date ? Number(date.slice(-2)) : ''}</Text>
              {roundMarker ? (
                <View style={[styles.markerBadge, selected && styles.markerBadgeSelected]}>
                  <Text style={[styles.markerBadgeText, selected && styles.markerBadgeTextSelected]} numberOfLines={1}>{roundMarker}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SingleDatePicker({
  value,
  markedRounds = [],
  onChange,
}: {
  value: string;
  markedRounds?: MarkedRoundDate[];
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(value);

  const complete = () => {
    onChange(draftDate);
    setOpen(false);
  };

  return (
    <View style={styles.flatPicker}>
      <TouchableOpacity style={styles.compactPickerButton} onPress={() => {
        setDraftDate(value);
        setOpen(true);
      }}>
        <Text style={styles.compactPickerText}>{formatDotDate(value)}</Text>
        <Text style={styles.compactPickerAction}>{open ? '닫기' : '선택'}</Text>
      </TouchableOpacity>
      {open ? (
        <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setOpen(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>이벤트 날짜</Text>
              <MonthCalendar
                selectedStart={draftDate}
                markedRounds={markedRounds}
                onSelect={(date) => setDraftDate(date)}
              />
              <TouchableOpacity style={styles.sheetDoneButton} onPress={complete}>
                <Text style={styles.sheetDoneText}>완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function TimeWheelPicker({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  return <TimeWheelPickerBase label={label} value={value} onChange={onChange} />;
}

function TimeWheelPickerBase({
  label,
  value,
  onChange,
  onOpen,
  onClose,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = value.split(':');
  const [draftHour, setDraftHour] = useState(hour || '00');
  const [draftMinute, setDraftMinute] = useState(minute || '00');

  const openWheel = () => {
    const [nextHour, nextMinute] = value.split(':');
    setDraftHour(nextHour || '00');
    setDraftMinute(nextMinute || '00');
    setOpen(true);
    onOpen?.();
  };

  const complete = () => {
    onChange(`${draftHour}:${draftMinute}`);
    setOpen(false);
    onClose?.();
  };

  return (
    <View style={styles.timeSinglePicker}>
      <TouchableOpacity style={styles.compactPickerButton} onPress={openWheel}>
        <Text style={styles.timeSingleValue}>{`[${value}]`}</Text>
        <Text style={styles.compactPickerAction}>선택</Text>
      </TouchableOpacity>
      {open ? (
        <Modal transparent animationType="slide" onRequestClose={() => { setOpen(false); onClose?.(); }}>
          <View style={styles.sheetOverlay}>
            <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => { setOpen(false); onClose?.(); }} />
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{label}</Text>
              <View style={styles.timeWheelRow}>
                <View style={styles.timeWheelCol}>
                  <Text style={styles.timeWheelLabel}>hour</Text>
                  <ScrollView style={styles.timeWheelList} nestedScrollEnabled>
                    {HOUR_OPTIONS.map((option) => (
                      <TouchableOpacity key={option} style={[styles.timeWheelItem, option === draftHour && styles.timeWheelItemActive]} onPress={() => setDraftHour(option)}>
                        <Text style={[styles.timeWheelItemText, option === draftHour && styles.timeWheelItemTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.timeWheelCol}>
                  <Text style={styles.timeWheelLabel}>minute</Text>
                  <ScrollView style={styles.timeWheelList} nestedScrollEnabled>
                    {MINUTE_OPTIONS.map((option) => (
                      <TouchableOpacity key={option} style={[styles.timeWheelItem, option === draftMinute && styles.timeWheelItemActive]} onPress={() => setDraftMinute(option)}>
                        <Text style={[styles.timeWheelItemText, option === draftMinute && styles.timeWheelItemTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <TouchableOpacity style={styles.sheetDoneButton} onPress={complete}>
                <Text style={styles.sheetDoneText}>완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 84 },
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  heroBackButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18 },
  card: {
    marginTop: 11,
    marginHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  cardTitle: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  formSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: -12, marginTop: -12, marginBottom: 11, padding: 11, borderBottomWidth: 0.5, borderBottomColor: '#F5F5F5', backgroundColor: '#FAFAFA' },
  inlineSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13, marginBottom: 7 },
  formSectionIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  formSectionTitle: { fontSize: 11, fontWeight: '900', color: '#534AB7' },
  optionalText: { fontSize: 10, fontWeight: '500', color: '#B4B2A9' },
  label: { marginTop: 9, marginBottom: 5, color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
  helpText: { marginTop: 5, color: '#9CA3AF', fontSize: 12, lineHeight: 17 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  categoryChip: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  categoryChipText: { color: '#6B7280', fontWeight: '700', fontSize: 13 },
  activeCategoryChipText: { color: '#534AB7' },
  input: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, backgroundColor: '#FFFFFF', color: '#1A1A2E' },
  filledInput: { borderColor: '#CECBF6', backgroundColor: '#FAFAFE' },
  invalidInput: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  textArea: { minHeight: 76, maxHeight: 180, textAlignVertical: 'top' },
  posterPreview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: '#E5E7EB' },
  posterPlaceholder: { width: '100%', minHeight: 96, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CECBF6', backgroundColor: '#FAFAFE', alignItems: 'center', justifyContent: 'center', padding: 18 },
  posterPlaceholderText: { color: '#B4B2A9', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 16, marginBottom: 8 },
  posterZoneButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEEDFE', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7 },
  posterZoneButtonText: { color: '#534AB7', fontSize: 11, fontWeight: '800' },
  posterActionRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  posterButton: { flex: 1, borderWidth: 0.5, borderColor: '#534AB7', borderRadius: 8, padding: 11, backgroundColor: '#EEEDFE', alignItems: 'center' },
  posterButtonText: { color: '#534AB7', fontWeight: '800' },
  posterDeleteButton: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  posterDeleteText: { color: '#B91C1C', fontWeight: '800' },
  roundList: { gap: 6 },
  roundItem: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden' },
  roundHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: '#FFFFFF' },
  roundNum: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roundNumText: { fontSize: 10, fontWeight: '800', color: '#534AB7' },
  roundTime: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  roundChev: { fontSize: 13, color: '#B4B2A9' },
  roundChevOpen: { transform: [{ rotate: '180deg' }] },
  fieldRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fieldBox: { flex: 1 },
  fieldLbl: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 },
  roundSaveBtn: { backgroundColor: '#1A1A2E', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  roundSaveBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  roundDelBtn: { backgroundColor: '#FCEBEB', borderRadius: 8, paddingVertical: 9, alignItems: 'center', marginTop: 6 },
  roundDelBtnText: { color: '#A32D2D', fontSize: 11, fontWeight: '700' },
  addRoundBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CECBF6', borderRadius: 10, paddingVertical: 10, backgroundColor: '#FAFAFE', marginTop: 6 },
  addRoundBtnText: { fontSize: 11, fontWeight: '700', color: '#534AB7' },
  roundBox: { marginTop: 9, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#FFFFFF' },
  invalidRound: { borderWidth: 0.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  roundHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundHeaderCopy: { flex: 1 },
  roundTitle: { color: '#1A1A2E', fontSize: 11, fontWeight: '700' },
  roundSummary: { marginTop: 4, color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  compactDeleteButton: { borderWidth: 0.5, borderColor: '#FECACA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF2F2' },
  compactDeleteText: { color: '#B91C1C', fontWeight: '700', fontSize: 12 },
  roundDescBlock: { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 6 },
  roundBody: { backgroundColor: '#FAFAFA', borderTopWidth: 0.5, borderTopColor: '#F3F4F6', padding: 12 },
  flatField: { marginTop: 7 },
  flatLabel: { color: '#1A1A2E', fontSize: 12, fontWeight: '700', marginBottom: 5 },
  inlineWarningBox: { marginTop: 8, borderWidth: 0.5, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10 },
  inlineWarningText: { color: '#B45309', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  warningAgreeButton: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FEF3C7' },
  warningAgreeText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  flatPicker: { flex: 1 },
  compactPickerButton: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  activePickerButton: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  compactPickerCopy: { flex: 1 },
  compactPickerText: { color: '#1A1A2E', fontWeight: '800' },
  compactPickerAction: { color: '#534AB7', fontWeight: '800', fontSize: 12 },
  calendar: { marginTop: 8, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 8, backgroundColor: '#FFFFFF' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  calendarTitle: { color: '#1A1A2E', fontWeight: '800' },
  monthButton: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  monthButtonText: { color: '#534AB7', fontSize: 12, fontWeight: '800' },
  weekRow: { flexDirection: 'row' },
  weekText: { width: `${100 / 7}%`, textAlign: 'center', color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1.1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, paddingVertical: 4 },
  emptyDayCell: { backgroundColor: '#F5F5F5', opacity: 0.45 },
  selectedDay: { backgroundColor: '#534AB7' },
  rangeDay: { backgroundColor: '#EEEDFE' },
  dayText: { color: '#1A1A2E', fontWeight: '800', fontSize: 12 },
  roundMarkerText: { marginTop: 1, color: '#9CA3AF', fontSize: 8, fontWeight: '700' },
  dayCellInner: { alignItems: 'center', gap: 3 },
  markerPillRow: { marginTop: 2, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3 },
  markerBadge: { marginTop: 4, backgroundColor: '#EEEDFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  markerBadgeSelected: { backgroundColor: '#3C3489' },
  markerBadgeText: { color: '#534AB7', fontSize: 10, fontWeight: '800' },
  markerBadgeTextSelected: { color: '#FFFFFF' },
  emptyDayText: { color: 'transparent' },
  selectedDayText: { color: '#FFFFFF' },
  timeSinglePicker: { flex: 1 },
  timeSingleValue: { color: '#1A1A2E', fontSize: 16, fontWeight: '800' },
  timeDropdown: { marginTop: 7, maxHeight: 164, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF' },
  timeOption: { paddingVertical: 10, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  activeTimeOption: { backgroundColor: '#EEEDFE' },
  timeOptionText: { color: '#6B7280', fontWeight: '700' },
  activeTimeOptionText: { color: '#534AB7' },
  applyRoundButton: { marginTop: 10, borderWidth: 0.5, borderColor: '#534AB7', borderRadius: 8, paddingVertical: 11, backgroundColor: '#EEEDFE', alignItems: 'center' },
  applyRoundText: { color: '#534AB7', fontWeight: '800' },
  saleCompleteButton: { marginTop: 10, borderWidth: 0.5, borderColor: '#534AB7', borderRadius: 8, paddingVertical: 11, backgroundColor: '#EEEDFE', alignItems: 'center' },
  saleCompleteText: { color: '#534AB7', fontWeight: '800' },
  addRoundButton: { borderWidth: 0.5, borderColor: '#534AB7', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 11, backgroundColor: '#EEEDFE' },
  addRoundButtonText: { color: '#534AB7', fontSize: 14, fontWeight: '800' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 0.5, borderColor: '#E5E7EB', textAlign: 'center', color: '#FFFFFF', fontWeight: '800', lineHeight: 20 },
  checkedBox: { backgroundColor: '#534AB7', borderColor: '#534AB7' },
  checkLabel: { color: '#1A1A2E', fontWeight: '700' },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  saleHeaderCopy: { flex: 1 },
  salePeriodBlock: { marginTop: 4 },
  saleBoundaryGroup: { marginTop: 8, gap: 10 },
  saleBoundaryCard: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, backgroundColor: '#FFFFFF' },
  saleBoundaryTitle: { color: '#534AB7', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  saleBoundaryRow: { flexDirection: 'row', gap: 8 },
  saleBoundaryField: { flex: 1 },
  saleTimeGrid: { gap: 8, marginTop: 8 },
  saleRoundStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  saleRoundChip: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  saleRoundChipMuted: { backgroundColor: '#F5F5F5' },
  saleRoundChipActive: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  saleRoundChipText: { color: '#1A1A2E', fontSize: 12, fontWeight: '700' },
  saleRoundChipTextActive: { color: '#534AB7' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modeButton: { flex: 1, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, backgroundColor: '#FFFFFF' },
  activeModeButton: { borderColor: '#534AB7', backgroundColor: '#EEEDFE' },
  modeButtonText: { color: '#1A1A2E', fontWeight: '700' },
  modeHint: { marginTop: 6, color: '#9CA3AF', fontSize: 12 },
  saleRangeText: { marginTop: 6, color: '#1A1A2E', fontSize: 14, fontWeight: '800' },
  saleSummary: { marginTop: 4, color: '#9CA3AF', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  saleBody: { marginTop: 2 },
  rangePickerBox: { marginTop: 9 },
  rangePickerTitle: { color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  rangePickerValue: { marginTop: 3, color: '#1A1A2E', fontWeight: '800' },
  timeWheelRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  timeWheelCol: { flex: 1 },
  timeWheelLabel: { marginBottom: 6, color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  timeWheelList: { maxHeight: 240, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#FFFFFF' },
  timeWheelItem: { paddingVertical: 11, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  timeWheelItemActive: { backgroundColor: '#EEEDFE' },
  timeWheelItemText: { color: '#6B7280', fontWeight: '700' },
  timeWheelItemTextActive: { color: '#534AB7' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.36)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, paddingBottom: 22 },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  sheetHelp: { marginTop: 6, color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  sheetStateText: { marginTop: 4, color: '#534AB7', fontSize: 13, fontWeight: '800' },
  sheetDoneButton: { marginTop: 10, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#1A1A2E' },
  sheetDoneText: { color: '#FFFFFF', fontWeight: '800' },
  errorPanel: { marginTop: 13, marginHorizontal: 14, borderWidth: 0.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 },
  errorTitle: { color: '#B91C1C', fontWeight: '800', marginBottom: 6 },
  errorItem: { color: '#B91C1C', fontWeight: '700', lineHeight: 20 },
  primaryButton: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12, marginHorizontal: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewImage: { width: '88%', aspectRatio: 3 / 4, borderRadius: 10 },
  previewClose: { marginTop: 18, color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
