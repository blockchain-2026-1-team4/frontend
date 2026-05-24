import React, { useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  KeyboardAvoidingView,
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

const EVENT_CATEGORIES = [
  { value: 'CONCERT', label: '공연' },
  { value: 'SPORTS', label: '스포츠' },
  { value: 'EXHIBITION', label: '전시' },
  { value: 'FESTIVAL', label: '페스티벌' },
  { value: 'ETC', label: '기타' },
];

const TIME_OPTIONS = Array.from({ length: 32 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const FIELD_OFFSET: Record<string, number> = {
  category: 120,
  name: 210,
  venue: 310,
  description: 540,
  globalSale: 690,
  rounds: 980,
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

function buildRound(index: number, baseDate: string, globalSaleStart: string, globalSaleEnd: string): EventRoundDraft {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    title: `${index + 1}회차`,
    eventDate: addDays(baseDate, index),
    startTime: index === 0 ? '19:00' : '14:00',
    endTime: index === 0 ? '21:00' : '16:00',
    useGlobalSalePeriod: true,
    saleStartDate: globalSaleStart,
    saleEndDate: globalSaleEnd,
  };
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
  const defaultSaleStart = useMemo(() => addDays(today, 1), [today]);
  const defaultSaleEnd = useMemo(() => addDays(defaultEventDate, -1), [defaultEventDate]);

  const [category, setCategory] = useState('CONCERT');
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [venuePlaceId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [poster, setPoster] = useState<PosterAsset | null>(null);
  const [globalSaleStart, setGlobalSaleStart] = useState(defaultSaleStart);
  const [globalSaleEnd, setGlobalSaleEnd] = useState(defaultSaleEnd);
  const [rounds, setRounds] = useState<EventRoundDraft[]>([buildRound(0, defaultEventDate, defaultSaleStart, defaultSaleEnd)]);
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateRound = (id: string, patch: Partial<EventRoundDraft>) => {
    setRounds((current) => current.map((round) => (round.id === id ? { ...round, ...patch } : round)));
  };

  const addRound = () => {
    setRounds((current) => {
      const next = buildRound(current.length, addDays(current.at(-1)?.eventDate || defaultEventDate, 1), globalSaleStart, globalSaleEnd);
      return [...current, { ...next, eventDate: addDays(current.at(-1)?.eventDate || defaultEventDate, 1) }];
    });
  };

  const removeRound = (id: string) => {
    setRounds((current) => current.filter((round) => round.id !== id).map((round, index) => ({ ...round, title: `${index + 1}회차` })));
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
    if (!globalSaleStart || !globalSaleEnd || globalSaleEnd < globalSaleStart) {
      nextErrors.push('이벤트 기본 판매 기간을 올바르게 선택해주세요.');
      nextInvalid.globalSale = true;
    }
    if (rounds.length === 0) {
      nextErrors.push('최소 1개 회차가 필요합니다.');
      nextInvalid.rounds = true;
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
        nextErrors.push(`${roundNumber}회차 종료 시간은 시작 시간보다 늦어야 합니다.`);
        nextInvalid.rounds = true;
      }

      if (!saleStart || !saleEnd || saleEnd < saleStart) {
        nextErrors.push(`${roundNumber}회차 판매 기간을 올바르게 선택해주세요.`);
        nextInvalid.rounds = true;
      }
      if (saleEnd && new Date(`${saleEnd}T23:59:00`) > startsAt) {
        nextErrors.push(`${roundNumber}회차 판매 종료일은 공연 시작 이후일 수 없습니다.`);
        nextInvalid.rounds = true;
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
        <Text style={styles.subtitle}>기본 정보와 회차 운영 정보를 먼저 등록하고, 가격과 좌석 정책은 다음 단계에서 설정합니다.</Text>

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
          <Text style={styles.helpText}>현재는 직접 입력하며, 추후 placeId 기반 지도 검색과 연결할 수 있는 구조로 저장됩니다.</Text>

          <Text style={styles.label}>포스터</Text>
          <TouchableOpacity style={styles.posterButton} onPress={pickPoster}>
            <Text style={styles.posterButtonText}>{poster ? poster.fileName || '선택된 이미지' : '파일 선택'}</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>선택 사항입니다. 이미지 없이도 이벤트를 생성할 수 있습니다.</Text>

          <Text style={styles.label}>이벤트 소개</Text>
          <TextInput
            style={[styles.input, styles.textArea, invalidFields.description && styles.invalidInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="공연 소개, 출연진, 운영 시간, 입장 안내, 주의사항 등을 입력해주세요."
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>이벤트 기본 판매 기간</Text>
          <Text style={styles.helpText}>회차에서 별도 판매 기간을 쓰지 않으면 이 기간이 적용됩니다.</Text>
          <CalendarRange startDate={globalSaleStart} endDate={globalSaleEnd} onChange={(start, end) => {
            setGlobalSaleStart(start);
            setGlobalSaleEnd(end);
            setRounds((current) => current.map((round) => round.useGlobalSalePeriod ? { ...round, saleStartDate: start, saleEndDate: end } : round));
          }} />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.cardTitle}>회차</Text>
            <TouchableOpacity style={styles.smallButton} onPress={addRound}>
              <Text style={styles.smallButtonText}>+ 회차 추가</Text>
            </TouchableOpacity>
          </View>
          {rounds.map((round, index) => (
            <View key={round.id} style={[styles.roundBox, invalidFields.rounds && styles.invalidRound]}>
              <View style={styles.sectionHead}>
                <Text style={styles.roundTitle}>{index + 1}회차</Text>
                {rounds.length > 1 ? (
                  <TouchableOpacity onPress={() => removeRound(round.id)}>
                    <Text style={styles.deleteText}>회차 삭제</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.label}>공연일</Text>
              <SingleDatePicker value={round.eventDate} onChange={(value) => updateRound(round.id, { eventDate: value })} />
              <Text style={styles.label}>시간</Text>
              <View style={styles.timeRow}>
                <TimeSelect value={round.startTime} onChange={(value) => updateRound(round.id, { startTime: value })} />
                <Text style={styles.timeDivider}>~</Text>
                <TimeSelect value={round.endTime} onChange={(value) => updateRound(round.id, { endTime: value })} />
              </View>
              <TouchableOpacity style={styles.checkRow} onPress={() => updateRound(round.id, { useGlobalSalePeriod: !round.useGlobalSalePeriod })}>
                <Text style={[styles.checkbox, round.useGlobalSalePeriod && styles.checkedBox]}>{round.useGlobalSalePeriod ? '✓' : ''}</Text>
                <Text style={styles.checkLabel}>이벤트 기본 판매 기간 사용</Text>
              </TouchableOpacity>
              {!round.useGlobalSalePeriod ? (
                <CalendarRange startDate={round.saleStartDate} endDate={round.saleEndDate} onChange={(start, end) => updateRound(round.id, { saleStartDate: start, saleEndDate: end })} />
              ) : null}
            </View>
          ))}
        </View>

        {errors.length > 0 ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>오류</Text>
            {errors.map((message) => <Text key={message} style={styles.errorItem}>• {message}</Text>)}
          </View>
        ) : null}

        <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabledButton]} disabled={submitting} onPress={createEvent}>
          <Text style={styles.primaryButtonText}>{submitting ? '등록 중...' : '이벤트 등록 후 티켓 설정'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CalendarRange({ startDate, endDate, onChange }: { startDate: string; endDate: string; onChange: (start: string, end: string) => void }) {
  const base = new Date(`${startDate || localDate(new Date())}T00:00:00`);
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, () => ''),
    ...Array.from({ length: daysInMonth }, (_, index) => localDate(new Date(base.getFullYear(), base.getMonth(), index + 1))),
  ];

  const select = (date: string) => {
    if (!startDate || (startDate && endDate)) {
      onChange(date, '');
      return;
    }
    if (date < startDate) onChange(date, startDate);
    else onChange(startDate, date);
  };

  return (
    <View style={styles.calendar}>
      <Text style={styles.calendarTitle}>{base.getFullYear()}년 {base.getMonth() + 1}월</Text>
      <View style={styles.weekRow}>{['일', '월', '화', '수', '목', '금', '토'].map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}</View>
      <View style={styles.dayGrid}>
        {cells.map((date, index) => {
          const selected = date && (date === startDate || date === endDate);
          const inRange = date && startDate && endDate && date > startDate && date < endDate;
          return (
            <TouchableOpacity key={`${date}-${index}`} style={[styles.dayCell, selected && styles.selectedDay, inRange && styles.rangeDay]} disabled={!date} onPress={() => select(date)}>
              <Text style={[styles.dayText, selected && styles.selectedDayText]}>{date ? Number(date.slice(-2)) : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.rangeText}>{startDate || '시작일'} ~ {endDate || '종료일'}</Text>
    </View>
  );
}

function SingleDatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  return <CalendarRange startDate={value} endDate={value} onChange={(start) => onChange(start)} />;
}

function TimeSelect({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeList}>
      {TIME_OPTIONS.map((time) => (
        <TouchableOpacity key={time} style={[styles.timeChip, value === time && styles.activeTimeChip]} onPress={() => onChange(time)}>
          <Text style={[styles.timeChipText, value === time && styles.activeTimeChipText]}>{time}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  helpText: { marginTop: 6, color: '#64748B', fontSize: 12, lineHeight: 18 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#2563EB' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  invalidInput: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  posterButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 13, backgroundColor: '#FFFFFF' },
  posterButtonText: { color: '#0F172A', fontWeight: '900' },
  calendar: { marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, backgroundColor: '#F8FAFC' },
  calendarTitle: { color: '#0F172A', fontWeight: '900', marginBottom: 8 },
  weekRow: { flexDirection: 'row' },
  weekText: { width: `${100 / 7}%`, textAlign: 'center', color: '#64748B', fontSize: 11, fontWeight: '900' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  selectedDay: { backgroundColor: '#2563EB' },
  rangeDay: { backgroundColor: '#DBEAFE' },
  dayText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  selectedDayText: { color: '#FFFFFF' },
  rangeText: { marginTop: 8, color: '#475569', fontSize: 12, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  smallButton: { borderRadius: 8, backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  roundBox: { marginTop: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF' },
  invalidRound: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  roundTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  deleteText: { color: '#DC2626', fontWeight: '900', fontSize: 12 },
  timeRow: { gap: 8 },
  timeDivider: { alignSelf: 'center', color: '#64748B', fontWeight: '900', marginVertical: 4 },
  timeList: { gap: 8, paddingVertical: 4 },
  timeChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#FFFFFF' },
  activeTimeChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  timeChipText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  activeTimeChipText: { color: '#2563EB' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', textAlign: 'center', color: '#FFFFFF', fontWeight: '900', lineHeight: 20 },
  checkedBox: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkLabel: { color: '#0F172A', fontWeight: '800' },
  errorPanel: { marginTop: 16, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12 },
  errorTitle: { color: '#B91C1C', fontWeight: '900', marginBottom: 6 },
  errorItem: { color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
