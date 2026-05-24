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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';

type EventRoundDraft = {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  useGlobalSalePeriod: boolean;
  saleStartDate: string;
  saleEndDate: string;
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
const MINUTE_OPTIONS = ['00', '05', '10', '15', '20', '30', '40', '45', '50'];

const FIELD_OFFSET: Record<string, number> = {
  category: 100,
  name: 170,
  venue: 260,
  description: 330,
  rounds: 560,
  globalSale: 860,
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

function toStartOfDayIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function toEndOfDayIso(date: string) {
  return new Date(`${date}T23:59:00`).toISOString();
}

function roundStartIso(round: EventRoundDraft) {
  return new Date(`${round.eventDate}T${round.startTime}:00`).toISOString();
}

function roundEndIso(round: EventRoundDraft) {
  return new Date(`${round.eventDate}T${round.endTime}:00`).toISOString();
}

function buildRound(index: number, eventDate: string, saleStart: string, saleEnd: string, useGlobalSalePeriod = true): EventRoundDraft {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    title: `${index + 1}회차`,
    eventDate,
    startTime: index === 0 ? '19:00' : '14:00',
    endTime: index === 0 ? '21:00' : '16:00',
    useGlobalSalePeriod,
    saleStartDate: saleStart,
    saleEndDate: saleEnd,
  };
}

function earliestRoundDate(rounds: EventRoundDraft[]) {
  return [...rounds].sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0]?.eventDate || localDate(new Date());
}

function defaultSaleEndForRounds(rounds: EventRoundDraft[]) {
  return addDays(earliestRoundDate(rounds), -1);
}

function posterFile(asset: PosterAsset) {
  const name = asset.fileName || `poster-${Date.now()}.jpg`;
  const type = asset.mimeType || (name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  return { uri: asset.uri, name, type };
}

export default function EventCreatePage({ navigation }: any) {
  const scrollRef = useRef<ScrollView | null>(null);
  const today = useMemo(() => localDate(new Date()), []);
  const defaultEventDate = useMemo(() => addDays(today, 14), [today]);
  const defaultSaleStart = today;
  const defaultSaleEnd = useMemo(() => addDays(defaultEventDate, -1), [defaultEventDate]);
  const initialRound = useMemo(() => buildRound(0, defaultEventDate, defaultSaleStart, defaultSaleEnd), [defaultEventDate, defaultSaleEnd, defaultSaleStart]);

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
  const [globalSaleStart, setGlobalSaleStart] = useState(defaultSaleStart);
  const [globalSaleEnd, setGlobalSaleEnd] = useState(defaultSaleEnd);
  const [roundSaleOverrideEnabled, setRoundSaleOverrideEnabled] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateRound = (id: string, patch: Partial<EventRoundDraft>) => {
    setRounds((current) => {
      const nextRounds = current.map((round) => (round.id === id ? { ...round, ...patch } : round));
      if (patch.eventDate) {
        const nextSaleEnd = defaultSaleEndForRounds(nextRounds);
        setGlobalSaleEnd(nextSaleEnd);
        return nextRounds.map((round) => {
          if (!roundSaleOverrideEnabled || round.useGlobalSalePeriod) {
            return { ...round, saleEndDate: nextSaleEnd };
          }
          if (round.id === id) {
            return { ...round, saleEndDate: addDays(round.eventDate, -1) };
          }
          return round;
        });
      }
      return nextRounds;
    });
  };

  const toggleRound = (id: string) => {
    setExpandedRoundIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const saveRound = (id: string) => {
    const target = rounds.find((round) => round.id === id);
    if (target) {
      const startsAt = new Date(`${target.eventDate}T${target.startTime}:00`);
      const endsAt = new Date(`${target.eventDate}T${target.endTime}:00`);
      if (endsAt <= startsAt) {
        setErrors(['종료 시간은 시작 시간보다 늦어야 합니다.']);
        setInvalidFields({ rounds: true });
        return;
      }
    }
    setErrors([]);
    setInvalidFields((current) => ({ ...current, rounds: false }));
    setExpandedRoundIds((current) => current.filter((item) => item !== id));
  };

  const setGlobalSalePeriod = (start: string, end: string) => {
    setGlobalSaleStart(start);
    setGlobalSaleEnd(end);
    setRounds((current) => current.map((round) => (
      roundSaleOverrideEnabled
        ? round
        : { ...round, saleStartDate: start, saleEndDate: end, useGlobalSalePeriod: true }
    )));
  };

  const setRoundSaleOverride = (enabled: boolean) => {
    setRoundSaleOverrideEnabled(enabled);
    setRounds((current) => current.map((round) => ({
      ...round,
      useGlobalSalePeriod: !enabled,
      saleStartDate: enabled ? globalSaleStart : round.saleStartDate,
      saleEndDate: enabled ? globalSaleEnd : round.saleEndDate,
    })));
  };

  const addRound = () => {
    setRounds((current) => {
      const nextDate = addDays(current.at(-1)?.eventDate || defaultEventDate, 1);
      const next = buildRound(current.length, nextDate, globalSaleStart, globalSaleEnd, !roundSaleOverrideEnabled);
      setExpandedRoundIds([next.id]);
      return [...current, next];
    });
  };

  const removeRound = (id: string) => {
    if (rounds.length <= 1) return;
    const roundIndex = rounds.findIndex((round) => round.id === id);
    if (roundIndex < 0) return;
    Alert.alert('회차 삭제', `${roundIndex + 1}회차를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          setRounds((latest) => {
            const nextRounds = latest.filter((round) => round.id !== id).map((round, index) => ({ ...round, title: `${index + 1}회차` }));
            const nextSaleEnd = defaultSaleEndForRounds(nextRounds);
            setGlobalSaleEnd(nextSaleEnd);
            return nextRounds.map((round) => (
              !roundSaleOverrideEnabled || round.useGlobalSalePeriod
                ? { ...round, saleEndDate: nextSaleEnd }
                : round
            ));
          });
          setExpandedRoundIds((current) => current.filter((item) => item !== id));
        },
      },
    ]);
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

    if (!category) {
      nextErrors.push('카테고리를 선택해주세요.');
      nextInvalid.category = true;
    }
    if (!name.trim()) {
      nextErrors.push('이벤트명을 입력해주세요.');
      nextInvalid.name = true;
    }
    if (!venue.trim()) {
      nextErrors.push('장소를 입력해주세요.');
      nextInvalid.venue = true;
    }
    if (!description.trim()) {
      nextErrors.push('이벤트 소개를 입력해주세요.');
      nextInvalid.description = true;
    }
    if (rounds.length === 0) {
      nextErrors.push('최소 1개 회차가 필요합니다.');
      nextInvalid.rounds = true;
    }
    if (!globalSaleStart || !globalSaleEnd || globalSaleEnd < globalSaleStart) {
      nextErrors.push('티켓 판매 기간을 올바르게 선택해주세요.');
      nextInvalid.globalSale = true;
    }

    const ranges = rounds.map((round, index) => {
      const roundNumber = index + 1;
      const startsAt = new Date(`${round.eventDate}T${round.startTime}:00`);
      const endsAt = new Date(`${round.eventDate}T${round.endTime}:00`);
      const saleStart = round.useGlobalSalePeriod ? globalSaleStart : round.saleStartDate;
      const saleEnd = round.useGlobalSalePeriod ? globalSaleEnd : round.saleEndDate;

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        nextErrors.push(`${roundNumber}회차 시간을 설정해주세요.`);
        nextInvalid.rounds = true;
      } else if (endsAt <= startsAt) {
        nextErrors.push(`${roundNumber}회차 종료 시간은 시작 시간보다 늦어야 합니다. overnight 공연은 현재 지원하지 않습니다.`);
        nextInvalid.rounds = true;
      }
      if (!saleStart || !saleEnd || saleEnd < saleStart) {
        nextErrors.push(`${roundNumber}회차 판매 기간을 올바르게 선택해주세요.`);
        nextInvalid.globalSale = true;
      }
      if (saleEnd && new Date(`${saleEnd}T23:59:00`) > startsAt) {
        nextErrors.push(`${roundNumber}회차 판매 종료일은 공연 시작 이후일 수 없습니다.`);
        nextInvalid.globalSale = true;
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
        primarySaleStart: toStartOfDayIso(globalSaleStart),
        primarySaleEnd: toEndOfDayIso(globalSaleEnd),
        salesStartAt: toStartOfDayIso(globalSaleStart),
        salesEndAt: toEndOfDayIso(globalSaleEnd),
        ticketPriceWei: '1',
        totalTicketCount: 0,
        resaleAllowed: false,
        maxResalePriceRate: 10000,
        resaleStart: null,
        resaleEnd: null,
        rounds: sortedRounds.map((round, index) => {
          const saleStart = round.useGlobalSalePeriod ? globalSaleStart : round.saleStartDate;
          const saleEnd = round.useGlobalSalePeriod ? globalSaleEnd : round.saleEndDate;
          return {
            title: round.title || `${index + 1}회차`,
            eventDate: round.eventDate,
            startTime: round.startTime,
            endTime: round.endTime,
            useGlobalSalePeriod: round.useGlobalSalePeriod,
            saleStartAt: toStartOfDayIso(saleStart),
            saleEndAt: toEndOfDayIso(saleEnd),
          };
        }),
      });

      if (poster) {
        try {
          await backendApi.uploadEventImage(createdEvent.id, posterFile(poster));
        } catch (uploadError: any) {
          Alert.alert('포스터 업로드 실패', errorMessage(uploadError, '이벤트는 생성되었지만 포스터 업로드에 실패했습니다. 이벤트 설정에서 다시 업로드할 수 있습니다.'));
        }
      }

      Alert.alert('등록 완료', '이벤트가 등록되었습니다. 티켓 설정으로 이동합니다.');
      navigation.replace('TicketIssue', { eventId: createdEvent.id });
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
        <Text style={styles.eyebrow}>Event Create</Text>
        <Text style={styles.title}>이벤트 등록</Text>
        <Text style={styles.subtitle}>이벤트 등록 후 티켓과 좌석 정보를 설정합니다.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.categoryGrid}>
            {EVENT_CATEGORIES.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.activeCategoryChip]} onPress={() => setCategory(item.value)}>
                <Text style={[styles.categoryChipText, category === item.value && styles.activeCategoryChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>이벤트명</Text>
          <TextInput style={[styles.input, invalidFields.name && styles.invalidInput]} value={name} onChangeText={setName} placeholder="예: TRUST LIVE 2026" />
          <Text style={styles.helpText}>사용자에게 표시될 이벤트명을 입력해주세요.</Text>

          <Text style={styles.label}>장소</Text>
          <TextInput style={[styles.input, invalidFields.venue && styles.invalidInput]} value={venue} onChangeText={setVenue} placeholder="예: 올림픽공원 KSPO DOME" />

          <Text style={styles.label}>이벤트 소개</Text>
          <TextInput
            style={[styles.input, styles.textArea, { height: descriptionHeight }, invalidFields.description && styles.invalidInput]}
            value={description}
            onChangeText={setDescription}
            onContentSizeChange={(event) => setDescriptionHeight(Math.max(76, Math.min(180, event.nativeEvent.contentSize.height + 12)))}
            placeholder="공연 소개, 출연진, 운영 시간, 입장 안내, 주의사항 등을 입력해주세요."
            multiline
          />

          <Text style={styles.label}>포스터</Text>
          {poster ? (
            <TouchableOpacity onPress={() => setPosterPreviewOpen(true)} activeOpacity={0.88}>
              <Image source={{ uri: poster.uri }} style={styles.posterPreview} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.posterPlaceholder} activeOpacity={0.86} onPress={pickPoster}>
              <Text style={styles.posterPlaceholderText}>포스터 없음</Text>
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
          <Text style={styles.cardTitle}>공연 일정</Text>
          <Text style={styles.helpText}>공연 회차별로 날짜와 시간을 설정하세요.</Text>
          <Text style={styles.helpText}>장소나 일정 차이가 큰 경우 별도 이벤트 등록을 권장합니다.</Text>
          {rounds.map((round, index) => {
            const expanded = expandedRoundIds.includes(round.id);
            const canDelete = rounds.length > 1;
            return (
              <View key={round.id} style={styles.roundBox}>
                <View style={styles.roundHeader}>
                  <TouchableOpacity style={styles.roundHeaderCopy} onPress={() => toggleRound(round.id)} activeOpacity={0.82}>
                    <Text style={styles.roundTitle}>{expanded ? '▼' : '▶'} {index + 1}회차 · {formatDotDate(round.eventDate)}</Text>
                    <Text style={styles.roundSummary}>{round.startTime} ~ {round.endTime}</Text>
                  </TouchableOpacity>
                  {canDelete ? (
                    <TouchableOpacity style={styles.compactDeleteButton} onPress={() => removeRound(round.id)}>
                      <Text style={styles.compactDeleteText}>삭제</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {expanded ? (
                  <View style={styles.roundBody}>
                    <View style={styles.flatField}>
                      <Text style={styles.flatLabel}>공연일</Text>
                      <SingleDatePicker
                        value={round.eventDate}
                        onChange={(value) => updateRound(round.id, { eventDate: value })}
                        markedRounds={rounds.map((item, itemIndex) => ({ date: item.eventDate, label: `${itemIndex + 1}회차` }))}
                      />
                    </View>
                    <View style={styles.flatField}>
                      <Text style={styles.flatLabel}>시작 시간</Text>
                      <TimeDropdown value={round.startTime} onChange={(value) => updateRound(round.id, { startTime: value })} />
                    </View>
                    <View style={styles.flatField}>
                      <Text style={styles.flatLabel}>종료 시간</Text>
                      <TimeDropdown value={round.endTime} onChange={(value) => updateRound(round.id, { endTime: value })} />
                    </View>
                    <TouchableOpacity style={styles.applyRoundButton} onPress={() => saveRound(round.id)}>
                      <Text style={styles.applyRoundText}>회차 저장</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}

          <TouchableOpacity style={styles.addRoundButton} onPress={addRound}>
            <Text style={styles.addRoundButtonText}>+ 회차 추가</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, invalidFields.globalSale && styles.invalidRound]}>
          <View style={styles.saleHeader}>
            <View style={styles.saleHeaderCopy}>
              <Text style={styles.cardTitle}>티켓 판매 기간</Text>
              <Text style={styles.saleRangeText}>{formatDotDate(globalSaleStart)} ~ {formatDotDate(globalSaleEnd)}</Text>
            </View>
          </View>
          <View style={styles.saleBody}>
            {!roundSaleOverrideEnabled ? (
              <CompactRangePicker
                title="티켓 판매 기간"
                compactTitle="전체 판매 기간"
                startDate={globalSaleStart}
                endDate={globalSaleEnd}
                onChange={setGlobalSalePeriod}
                ctaLabel="판매 기간 변경"
                markedRounds={rounds.map((round, index) => ({ date: round.eventDate, label: `${index + 1}회차` }))}
              />
            ) : null}
            {!roundSaleOverrideEnabled ? (
              <Text style={styles.helpText}>회차별로 판매 기간을 따로 설정할 수 있습니다. 활성화하면 현재 티켓 판매 기간이 각 회차에 복사됩니다.</Text>
            ) : null}
            <TouchableOpacity style={styles.checkRow} onPress={() => setRoundSaleOverride(!roundSaleOverrideEnabled)}>
              <Text style={[styles.checkbox, roundSaleOverrideEnabled && styles.checkedBox]}>{roundSaleOverrideEnabled ? '✓' : ''}</Text>
              <Text style={styles.checkLabel}>회차별 판매 기간 설정</Text>
            </TouchableOpacity>
            {roundSaleOverrideEnabled ? (
              <View style={styles.roundSaleList}>
                {rounds.map((round, index) => (
                  <CompactRangePicker
                    key={round.id}
                    title={`${index + 1}회차 판매 기간`}
                    compactTitle={`${index + 1}회차`}
                    startDate={round.saleStartDate}
                    endDate={round.saleEndDate}
                    onChange={(start, end) => updateRound(round.id, { saleStartDate: start, saleEndDate: end, useGlobalSalePeriod: false })}
                    markedRounds={rounds.map((item, itemIndex) => ({ date: item.eventDate, label: `${itemIndex + 1}회차` }))}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {errors.length > 0 ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>오류</Text>
            {errors.map((message) => <Text key={message} style={styles.errorItem}>· {message}</Text>)}
          </View>
        ) : null}

        <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabledButton]} disabled={submitting} onPress={createEvent}>
          <Text style={styles.primaryButtonText}>{submitting ? '등록 중...' : '티켓 설정으로 이동'}</Text>
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
              {roundMarker ? <Text style={[styles.roundMarkerText, selected && styles.selectedDayText]} numberOfLines={1}>{roundMarker}</Text> : null}
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
  return (
    <View style={styles.flatPicker}>
      <TouchableOpacity style={styles.compactPickerButton} onPress={() => setOpen((current) => !current)}>
        <Text style={styles.compactPickerText}>{formatDotDate(value)}</Text>
        <Text style={styles.compactPickerAction}>{open ? '닫기' : '선택'}</Text>
      </TouchableOpacity>
      {open ? (
        <MonthCalendar
          selectedStart={value}
          markedRounds={markedRounds}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function CompactRangePicker({
  title,
  compactTitle,
  ctaLabel = '기간 선택',
  markedRounds = [],
  startDate,
  endDate,
  onChange,
}: {
  title: string;
  compactTitle?: string;
  ctaLabel?: string;
  markedRounds?: MarkedRoundDate[];
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
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
    if (draftStart && draftEnd) {
      onChange(draftStart, draftEnd);
    }
    setOpen(false);
  };

  return (
    <View style={styles.rangePickerBox}>
      <TouchableOpacity style={styles.compactPickerButton} onPress={openSheet}>
        <View style={styles.compactPickerCopy}>
          <Text style={styles.rangePickerTitle}>{compactTitle || title}</Text>
          {compactTitle ? (
            <Text style={styles.rangePickerValue}>{formatDotDate(startDate)} ~ {formatDotDate(endDate)}</Text>
          ) : (
            <>
              <Text style={styles.rangePickerValue}><Text style={styles.saleStartText}>판매 시작:</Text> {formatDotDate(startDate)}</Text>
              <Text style={styles.rangePickerValue}><Text style={styles.saleEndText}>판매 종료:</Text> {formatDotDate(endDate)}</Text>
            </>
          )}
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

function TimeDropdown({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const [openPart, setOpenPart] = useState<'hour' | 'minute' | null>(null);
  const [hour = '00', minute = '00'] = value.split(':');

  const setTimePart = (part: 'hour' | 'minute', nextValue: string) => {
    onChange(part === 'hour' ? `${nextValue}:${minute}` : `${hour}:${nextValue}`);
    setOpenPart(null);
  };

  return (
    <View style={styles.timePickerRow}>
      <View style={styles.timePickerCol}>
        <TouchableOpacity style={styles.compactPickerButton} onPress={() => setOpenPart(openPart === 'hour' ? null : 'hour')}>
          <Text style={styles.timeValue}>{hour}시</Text>
          <Text style={styles.compactPickerAction}>▼</Text>
        </TouchableOpacity>
        {openPart === 'hour' ? (
          <ScrollView style={styles.timeDropdown} nestedScrollEnabled>
            {HOUR_OPTIONS.map((option) => (
              <TouchableOpacity key={option} style={[styles.timeOption, option === hour && styles.activeTimeOption]} onPress={() => setTimePart('hour', option)}>
                <Text style={[styles.timeOptionText, option === hour && styles.activeTimeOptionText]}>{option}시</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.timePickerCol}>
        <TouchableOpacity style={styles.compactPickerButton} onPress={() => setOpenPart(openPart === 'minute' ? null : 'minute')}>
          <Text style={styles.timeValue}>{minute}분</Text>
          <Text style={styles.compactPickerAction}>▼</Text>
        </TouchableOpacity>
        {openPart === 'minute' ? (
          <ScrollView style={styles.timeDropdown} nestedScrollEnabled>
            {MINUTE_OPTIONS.map((option) => (
              <TouchableOpacity key={option} style={[styles.timeOption, option === minute && styles.activeTimeOption]} onPress={() => setTimePart('minute', option)}>
                <Text style={[styles.timeOptionText, option === minute && styles.activeTimeOptionText]}>{option}분</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 14, paddingBottom: 84 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 3, fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 6, color: '#64748B', fontSize: 13, lineHeight: 19 },
  card: {
    marginTop: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  label: { marginTop: 9, marginBottom: 5, color: '#334155', fontSize: 13, fontWeight: '800' },
  helpText: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 17 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#2563EB' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF', color: '#0F172A' },
  invalidInput: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  textArea: { minHeight: 76, maxHeight: 180, textAlignVertical: 'top' },
  posterPreview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8, backgroundColor: '#E2E8F0' },
  posterPlaceholder: { width: '100%', minHeight: 72, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  posterPlaceholderText: { color: '#94A3B8', fontSize: 13, fontWeight: '900' },
  posterActionRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  posterButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, backgroundColor: '#FFFFFF', alignItems: 'center' },
  posterButtonText: { color: '#0F172A', fontWeight: '900' },
  posterDeleteButton: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  posterDeleteText: { color: '#B91C1C', fontWeight: '900' },
  roundBox: { marginTop: 9, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF' },
  invalidRound: { borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  roundHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundHeaderCopy: { flex: 1 },
  roundTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  roundSummary: { marginTop: 4, color: '#64748B', fontSize: 13, fontWeight: '800' },
  compactDeleteButton: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF7F7' },
  compactDeleteText: { color: '#B91C1C', fontWeight: '800', fontSize: 12 },
  roundBody: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 8 },
  flatField: { marginTop: 7 },
  flatLabel: { color: '#334155', fontSize: 12, fontWeight: '900', marginBottom: 5 },
  flatPicker: { flex: 1 },
  compactPickerButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  compactPickerCopy: { flex: 1 },
  compactPickerText: { color: '#0F172A', fontWeight: '900' },
  compactPickerAction: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  calendar: { marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 8, backgroundColor: '#FFFFFF' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  calendarTitle: { color: '#0F172A', fontWeight: '900' },
  monthButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  monthButtonText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  weekRow: { flexDirection: 'row' },
  weekText: { width: `${100 / 7}%`, textAlign: 'center', color: '#64748B', fontSize: 11, fontWeight: '900' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1.1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  emptyDayCell: { backgroundColor: '#F8FAFC', opacity: 0.45 },
  selectedDay: { backgroundColor: '#2563EB' },
  rangeDay: { backgroundColor: '#DBEAFE' },
  dayText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  roundMarkerText: { marginTop: 1, color: '#64748B', fontSize: 8, fontWeight: '900' },
  emptyDayText: { color: 'transparent' },
  selectedDayText: { color: '#FFFFFF' },
  timePickerRow: { flexDirection: 'row', gap: 8 },
  timePickerCol: { flex: 1 },
  timeValue: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  timeDropdown: { marginTop: 7, maxHeight: 164, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  timeOption: { paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  activeTimeOption: { backgroundColor: '#EFF6FF' },
  timeOptionText: { color: '#475569', fontWeight: '900' },
  activeTimeOptionText: { color: '#2563EB' },
  applyRoundButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 11, backgroundColor: '#F8FAFC', alignItems: 'center' },
  applyRoundText: { color: '#0F172A', fontWeight: '900' },
  addRoundButton: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 11, backgroundColor: '#EFF6FF' },
  addRoundButtonText: { color: '#2563EB', fontSize: 15, fontWeight: '900' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', textAlign: 'center', color: '#FFFFFF', fontWeight: '900', lineHeight: 20 },
  checkedBox: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkLabel: { color: '#0F172A', fontWeight: '800' },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  saleHeaderCopy: { flex: 1 },
  saleRangeText: { marginTop: 6, color: '#0F172A', fontSize: 15, fontWeight: '900' },
  saleSummary: { marginTop: 4, color: '#64748B', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  saleBody: { marginTop: 2 },
  rangePickerBox: { marginTop: 9 },
  rangePickerTitle: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  rangePickerValue: { marginTop: 3, color: '#0F172A', fontWeight: '900' },
  saleStartText: { color: '#3B82C4', fontWeight: '900' },
  saleEndText: { color: '#C2414B', fontWeight: '900' },
  roundSaleList: { marginTop: 2 },
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
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewImage: { width: '88%', aspectRatio: 3 / 4, borderRadius: 8 },
  previewClose: { marginTop: 18, color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
