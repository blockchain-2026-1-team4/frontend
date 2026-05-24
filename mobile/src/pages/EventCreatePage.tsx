import React, { useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
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

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

const FIELD_OFFSET: Record<string, number> = {
  category: 100,
  name: 180,
  venue: 270,
  description: 360,
  rounds: 650,
  globalSale: 920,
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

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return `${date.getMonth() + 1}/${date.getDate()}`;
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

function buildRound(index: number, eventDate: string, globalSaleStart: string, globalSaleEnd: string): EventRoundDraft {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    title: `${index + 1}회차`,
    eventDate,
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
  const initialRound = useMemo(() => buildRound(0, defaultEventDate, defaultSaleStart, defaultSaleEnd), [defaultEventDate, defaultSaleEnd, defaultSaleStart]);

  const [category, setCategory] = useState('CONCERT');
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [venuePlaceId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [descriptionHeight, setDescriptionHeight] = useState(104);
  const [poster, setPoster] = useState<PosterAsset | null>(null);
  const [rounds, setRounds] = useState<EventRoundDraft[]>([initialRound]);
  const [expandedRoundIds, setExpandedRoundIds] = useState<string[]>([]);
  const [globalSaleStart, setGlobalSaleStart] = useState(defaultSaleStart);
  const [globalSaleEnd, setGlobalSaleEnd] = useState(defaultSaleEnd);
  const [salePeriodExpanded, setSalePeriodExpanded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateRound = (id: string, patch: Partial<EventRoundDraft>) => {
    setRounds((current) => current.map((round) => (round.id === id ? { ...round, ...patch } : round)));
  };

  const toggleRound = (id: string) => {
    setExpandedRoundIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const addRound = () => {
    setRounds((current) => {
      const nextDate = addDays(current.at(-1)?.eventDate || defaultEventDate, 1);
      const next = buildRound(current.length, nextDate, globalSaleStart, globalSaleEnd);
      setExpandedRoundIds([next.id]);
      return [...current, next];
    });
  };

  const removeRound = (id: string) => {
    setRounds((current) => current.filter((round) => round.id !== id).map((round, index) => ({ ...round, title: `${index + 1}회차` })));
    setExpandedRoundIds((current) => current.filter((item) => item !== id));
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
      if (nextInvalid.rounds) setExpandedRoundIds(rounds.map((round) => round.id));
      if (nextInvalid.globalSale) setSalePeriodExpanded(true);
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
        <Text style={styles.subtitle}>공연 일정인 회차를 먼저 만들고, 이후 티켓 판매 기간과 좌석 정책을 설정합니다.</Text>

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
          <Text style={styles.helpText}>공연장 이름 또는 행사 장소를 입력해주세요.</Text>

          <Text style={styles.label}>이벤트 소개</Text>
          <TextInput
            style={[styles.input, styles.textArea, { height: descriptionHeight }, invalidFields.description && styles.invalidInput]}
            value={description}
            onChangeText={setDescription}
            onContentSizeChange={(event) => setDescriptionHeight(Math.max(104, Math.min(220, event.nativeEvent.contentSize.height + 18)))}
            placeholder="공연 소개, 출연진, 운영 시간, 입장 안내, 주의사항 등을 입력해주세요."
            multiline
          />

          <Text style={styles.label}>포스터</Text>
          <View style={styles.posterRow}>
            {poster ? <Image source={{ uri: poster.uri }} style={styles.posterPreview} /> : <View style={styles.posterPlaceholder}><Text style={styles.posterPlaceholderText}>No Image</Text></View>}
            <View style={styles.posterActions}>
              <TouchableOpacity style={styles.posterButton} onPress={pickPoster}>
                <Text style={styles.posterButtonText}>{poster ? '이미지 변경' : '파일 선택'}</Text>
              </TouchableOpacity>
              {poster ? (
                <TouchableOpacity style={styles.removePosterButton} onPress={() => setPoster(null)}>
                  <Text style={styles.removePosterText}>삭제</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <Text style={styles.helpText}>선택 사항입니다. 이미지 없이도 이벤트를 생성할 수 있습니다.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>회차 설정</Text>
          <Text style={styles.helpText}>짧은 기간 반복 공연은 회차로 묶고, 한 달 이상 차이나거나 장소가 바뀌면 별도 이벤트로 관리하는 것을 권장합니다.</Text>
          {rounds.map((round, index) => {
            const expanded = expandedRoundIds.includes(round.id);
            return (
              <View key={round.id} style={[styles.roundBox, invalidFields.rounds && styles.invalidRound]}>
                <TouchableOpacity style={styles.roundHeader} onPress={() => toggleRound(round.id)} activeOpacity={0.8}>
                  <View style={styles.roundHeaderCopy}>
                    <Text style={styles.roundTitle}>{expanded ? '▼' : '▶'} {index + 1}회차 · {formatShortDate(round.eventDate)} {round.startTime}</Text>
                    <Text style={styles.roundSummary}>{round.startTime} ~ {round.endTime} · {round.useGlobalSalePeriod ? '기본 티켓 판매 기간' : '회차별 판매 기간'}</Text>
                  </View>
                  {rounds.length > 1 ? (
                    <TouchableOpacity style={styles.deleteButton} onPress={() => removeRound(round.id)}>
                      <Text style={styles.deleteText}>삭제</Text>
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.roundBody}>
                    <Text style={styles.label}>공연일</Text>
                    <SingleDatePicker value={round.eventDate} onChange={(value) => updateRound(round.id, { eventDate: value })} />

                    <View style={styles.timeFieldGrid}>
                      <TimeDropdown label="시작 시간" value={round.startTime} onChange={(value) => updateRound(round.id, { startTime: value })} />
                      <TimeDropdown label="종료 시간" value={round.endTime} onChange={(value) => updateRound(round.id, { endTime: value })} />
                    </View>

                    <TouchableOpacity style={styles.checkRow} onPress={() => updateRound(round.id, { useGlobalSalePeriod: !round.useGlobalSalePeriod })}>
                      <Text style={[styles.checkbox, round.useGlobalSalePeriod && styles.checkedBox]}>{round.useGlobalSalePeriod ? '✓' : ''}</Text>
                      <Text style={styles.checkLabel}>기본 티켓 판매 기간 사용</Text>
                    </TouchableOpacity>
                    {!round.useGlobalSalePeriod ? (
                      <CompactRangePicker
                        title="회차별 티켓 판매 기간"
                        startDate={round.saleStartDate}
                        endDate={round.saleEndDate}
                        onChange={(start, end) => updateRound(round.id, { saleStartDate: start, saleEndDate: end })}
                      />
                    ) : null}
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
          <TouchableOpacity style={styles.saleHeader} onPress={() => setSalePeriodExpanded((value) => !value)}>
            <View>
              <Text style={styles.cardTitle}>티켓 판매 기간</Text>
              <Text style={styles.saleSummary}>{globalSaleStart || '시작일'} ~ {globalSaleEnd || '종료일'}</Text>
            </View>
            <Text style={styles.collapseText}>{salePeriodExpanded ? '접기' : '펼치기'}</Text>
          </TouchableOpacity>
          {salePeriodExpanded ? (
            <>
              <Text style={styles.helpText}>회차에서 별도 판매 기간을 쓰지 않으면 이 기간이 적용됩니다.</Text>
              <CompactRangePicker title="기본 티켓 판매 기간" startDate={globalSaleStart} endDate={globalSaleEnd} onChange={(start, end) => {
                setGlobalSaleStart(start);
                setGlobalSaleEnd(end);
                setRounds((current) => current.map((round) => round.useGlobalSalePeriod ? { ...round, saleStartDate: start, saleEndDate: end } : round));
              }} />
            </>
          ) : null}
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

function MonthCalendar({
  selectedStart,
  selectedEnd,
  onSelect,
}: {
  selectedStart: string;
  selectedEnd?: string;
  onSelect: (date: string) => void;
}) {
  const base = new Date(`${selectedStart || localDate(new Date())}T00:00:00`);
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, () => ''),
    ...Array.from({ length: daysInMonth }, (_, index) => localDate(new Date(base.getFullYear(), base.getMonth(), index + 1))),
  ];

  return (
    <View style={styles.calendar}>
      <Text style={styles.calendarTitle}>{base.getFullYear()}년 {base.getMonth() + 1}월</Text>
      <View style={styles.weekRow}>{['일', '월', '화', '수', '목', '금', '토'].map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}</View>
      <View style={styles.dayGrid}>
        {cells.map((date, index) => {
          const selected = date && (date === selectedStart || date === selectedEnd);
          const inRange = date && selectedStart && selectedEnd && date > selectedStart && date < selectedEnd;
          return (
            <TouchableOpacity key={`${date}-${index}`} style={[styles.dayCell, selected && styles.selectedDay, inRange && styles.rangeDay]} disabled={!date} onPress={() => onSelect(date)}>
              <Text style={[styles.dayText, selected && styles.selectedDayText]}>{date ? Number(date.slice(-2)) : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SingleDatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity style={styles.compactPickerButton} onPress={() => setOpen((current) => !current)}>
        <Text style={styles.compactPickerText}>공연일 {value}</Text>
        <Text style={styles.compactPickerAction}>{open ? '닫기' : '선택'}</Text>
      </TouchableOpacity>
      {open ? (
        <MonthCalendar
          selectedStart={value}
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
  startDate,
  endDate,
  onChange,
}: {
  title: string;
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);
  const select = (date: string) => {
    if (selectingStart) {
      onChange(date, endDate && endDate >= date ? endDate : '');
      setSelectingStart(false);
      return;
    }
    if (date < startDate) onChange(date, startDate);
    else onChange(startDate, date);
    setSelectingStart(true);
    setOpen(false);
  };

  return (
    <View style={styles.rangePickerBox}>
      <TouchableOpacity style={styles.compactPickerButton} onPress={() => setOpen((current) => !current)}>
        <View style={styles.compactPickerCopy}>
          <Text style={styles.rangePickerTitle}>{title}</Text>
          <Text style={styles.rangePickerValue}>{startDate || '시작일'} ~ {endDate || '종료일'}</Text>
        </View>
        <Text style={styles.compactPickerAction}>{open ? '닫기' : '선택'}</Text>
      </TouchableOpacity>
      {open ? (
        <>
          <View style={styles.rangeModeRow}>
            <TouchableOpacity style={[styles.rangeModeButton, selectingStart && styles.activeRangeMode]} onPress={() => setSelectingStart(true)}>
              <Text style={[styles.rangeModeText, selectingStart && styles.activeRangeModeText]}>시작일</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.rangeModeButton, !selectingStart && styles.activeRangeMode]} onPress={() => setSelectingStart(false)}>
              <Text style={[styles.rangeModeText, !selectingStart && styles.activeRangeModeText]}>종료일</Text>
            </TouchableOpacity>
          </View>
          <MonthCalendar selectedStart={startDate} selectedEnd={endDate} onSelect={select} />
        </>
      ) : null}
    </View>
  );
}

function TimeDropdown({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  const [open, setOpen] = useState(false);
  const nearbyOptions = TIME_OPTIONS.filter((time) => Math.abs(TIME_OPTIONS.indexOf(time) - TIME_OPTIONS.indexOf(value)) <= 4);
  const options = nearbyOptions.length > 0 ? nearbyOptions : TIME_OPTIONS;
  return (
    <View style={styles.timeField}>
      <Text style={styles.timeLabel}>{label}</Text>
      <TouchableOpacity style={styles.timeSelectButton} onPress={() => setOpen((current) => !current)}>
        <Text style={styles.timeValue}>{value}</Text>
        <Text style={styles.compactPickerAction}>{open ? '닫기' : '선택'}</Text>
      </TouchableOpacity>
      {open ? (
        <ScrollView style={styles.timeDropdown} nestedScrollEnabled>
          {options.map((time) => (
            <TouchableOpacity key={time} style={[styles.timeOption, time === value && styles.activeTimeOption]} onPress={() => { onChange(time); setOpen(false); }}>
              <Text style={[styles.timeOptionText, time === value && styles.activeTimeOptionText]}>{time}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 16, paddingBottom: 88 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 3, fontSize: 27, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 6, color: '#64748B', fontSize: 13, lineHeight: 19 },
  card: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  label: { marginTop: 10, marginBottom: 5, color: '#334155', fontSize: 13, fontWeight: '800' },
  helpText: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 17 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#2563EB' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, backgroundColor: '#FFFFFF', color: '#0F172A' },
  invalidInput: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  textArea: { minHeight: 104, maxHeight: 220, textAlignVertical: 'top' },
  posterRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  posterPreview: { width: 72, height: 96, borderRadius: 8, backgroundColor: '#E2E8F0' },
  posterPlaceholder: { width: 72, height: 96, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  posterPlaceholderText: { color: '#94A3B8', fontSize: 11, fontWeight: '900' },
  posterActions: { flex: 1, gap: 8 },
  posterButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, backgroundColor: '#FFFFFF', alignItems: 'center' },
  posterButtonText: { color: '#0F172A', fontWeight: '900' },
  removePosterButton: { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, padding: 10, backgroundColor: '#FEF2F2', alignItems: 'center' },
  removePosterText: { color: '#DC2626', fontWeight: '900' },
  roundBox: { marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  invalidRound: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  roundHeader: { padding: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  roundHeaderCopy: { flex: 1 },
  roundTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  roundSummary: { marginTop: 4, color: '#64748B', fontSize: 12, fontWeight: '700' },
  deleteButton: { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#FEF2F2' },
  deleteText: { color: '#DC2626', fontWeight: '900', fontSize: 12 },
  roundBody: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 10, paddingTop: 3 },
  compactPickerButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  compactPickerCopy: { flex: 1 },
  compactPickerText: { color: '#0F172A', fontWeight: '900' },
  compactPickerAction: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  calendar: { marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 9, backgroundColor: '#F8FAFC' },
  calendarTitle: { color: '#0F172A', fontWeight: '900', marginBottom: 7 },
  weekRow: { flexDirection: 'row' },
  weekText: { width: `${100 / 7}%`, textAlign: 'center', color: '#64748B', fontSize: 11, fontWeight: '900' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1.1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  selectedDay: { backgroundColor: '#2563EB' },
  rangeDay: { backgroundColor: '#DBEAFE' },
  dayText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  selectedDayText: { color: '#FFFFFF' },
  timeFieldGrid: { gap: 8, marginTop: 10 },
  timeField: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 9, backgroundColor: '#F8FAFC' },
  timeLabel: { color: '#64748B', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  timeSelectButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 11, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeValue: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  timeDropdown: { marginTop: 8, maxHeight: 176, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  timeOption: { paddingVertical: 11, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  activeTimeOption: { backgroundColor: '#EFF6FF' },
  timeOptionText: { color: '#475569', fontWeight: '900' },
  activeTimeOptionText: { color: '#2563EB' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', textAlign: 'center', color: '#FFFFFF', fontWeight: '900', lineHeight: 20 },
  checkedBox: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkLabel: { color: '#0F172A', fontWeight: '800' },
  addRoundButton: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 12, backgroundColor: '#EFF6FF' },
  addRoundButtonText: { color: '#2563EB', fontSize: 15, fontWeight: '900' },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  saleSummary: { marginTop: 5, color: '#64748B', fontSize: 12, fontWeight: '800' },
  collapseText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  rangePickerBox: { marginTop: 10 },
  rangePickerTitle: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  rangePickerValue: { marginTop: 3, color: '#0F172A', fontWeight: '900' },
  rangeModeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rangeModeButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 9, alignItems: 'center', backgroundColor: '#FFFFFF' },
  activeRangeMode: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  rangeModeText: { color: '#475569', fontWeight: '900', fontSize: 12 },
  activeRangeModeText: { color: '#2563EB' },
  errorPanel: { marginTop: 14, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12 },
  errorTitle: { color: '#B91C1C', fontWeight: '900', marginBottom: 6 },
  errorItem: { color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
