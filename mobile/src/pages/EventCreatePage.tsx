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

function localTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function buildRound(index: number, eventDate: string, saleStart: string, saleEnd: string, useGlobalSalePeriod = true): EventRoundDraft {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    title: `${index + 1}회차`,
    eventDate,
    startTime: index === 0 ? '19:00' : '14:00',
    endTime: index === 0 ? '21:00' : '16:00',
    useGlobalSalePeriod,
    saleStartDate: saleStart,
    saleStartTime: localTime(new Date()),
    saleEndDate: saleEnd,
    saleEndTime: index === 0 ? '21:00' : '16:00',
  };
}

function earliestRoundDate(rounds: EventRoundDraft[]) {
  return [...rounds].sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0]?.eventDate || localDate(new Date());
}

function defaultSaleEndForRounds(rounds: EventRoundDraft[]) {
  return earliestRoundDate(rounds);
}

function posterFile(asset: PosterAsset) {
  const name = asset.fileName || `poster-${Date.now()}.jpg`;
  const type = asset.mimeType || (name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  return { uri: asset.uri, name, type };
}

export default function EventCreatePage({ navigation }: any) {
  const scrollRef = useRef<ScrollView | null>(null);
  const today = useMemo(() => localDate(new Date()), []);
  const nowTime = useMemo(() => localTime(new Date()), []);
  const defaultEventDate = useMemo(() => addDays(today, 14), [today]);
  const defaultSaleStart = today;
  const defaultSaleEnd = useMemo(() => defaultEventDate, [defaultEventDate]);
  const initialRound = useMemo(() => buildRound(0, defaultEventDate, defaultSaleStart, defaultSaleEnd, false), [defaultEventDate, defaultSaleEnd, defaultSaleStart]);

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
  const [globalSaleStartTime, setGlobalSaleStartTime] = useState(nowTime);
  const [globalSaleEnd, setGlobalSaleEnd] = useState(defaultSaleEnd);
  const [globalSaleEndTime, setGlobalSaleEndTime] = useState('21:00');
  const [roundSaleOverrideEnabled, setRoundSaleOverrideEnabled] = useState(true);
  const [globalSaleExpanded, setGlobalSaleExpanded] = useState(true);
  const [globalSaleCompleted, setGlobalSaleCompleted] = useState(false);
  const [saleRoundCompletedIds, setSaleRoundCompletedIds] = useState<Record<string, boolean>>({});
  const [activeSaleRoundId, setActiveSaleRoundId] = useState<string | null>(null);
  const [saleRoundErrors, setSaleRoundErrors] = useState<Record<string, string[]>>({});
  const [roundAcknowledgedIds, setRoundAcknowledgedIds] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [roundMessages, setRoundMessages] = useState<Record<string, string[]>>({});
  const [saleMessages, setSaleMessages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const updateRound = (id: string, patch: Partial<EventRoundDraft>) => {
    setRounds((current) => {
      const nextRounds = current.map((round) => (round.id === id ? { ...round, ...patch } : round));
      if (patch.saleStartDate || patch.saleStartTime || patch.saleEndDate || patch.saleEndTime) {
        setSaleRoundErrors((current) => ({ ...current, [id]: [] }));
        setSaleRoundCompletedIds((current) => ({ ...current, [id]: false }));
      }
      if (patch.eventDate || patch.startTime || patch.endTime) {
        setRoundAcknowledgedIds((current) => ({ ...current, [id]: false }));
      }
      if (patch.eventDate) {
        const nextSaleEnd = defaultSaleEndForRounds(nextRounds);
        setGlobalSaleEnd(nextSaleEnd);
        return nextRounds.map((round) => {
          if (!roundSaleOverrideEnabled || round.useGlobalSalePeriod) {
            return { ...round, saleEndDate: nextSaleEnd, saleEndTime: '21:00' };
          }
          if (round.id === id) {
            return { ...round, saleEndDate: round.eventDate, saleEndTime: round.endTime };
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

  const saveRound = async (id: string) => {
    const target = rounds.find((round) => round.id === id);
    if (target) {
      const startsAt = toDateTimeIso(target.eventDate, target.startTime);
      const endsAt = toDateTimeIso(target.eventDate, target.endTime);
      if (endsAt <= startsAt) {
        setRoundMessages((current) => ({ ...current, [id]: ['종료 시간이 시작 시간보다 빠릅니다. 다음 날 종료되는 일정으로 처리됩니다.'] }));
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

  const completeSaleRound = (round: EventRoundDraft) => {
    const messages: string[] = [];
    const saleStart = toDateTimeIso(round.saleStartDate, round.saleStartTime);
    const saleEnd = toDateTimeIso(round.saleEndDate, round.saleEndTime);
    const roundStart = roundStartIso(round);

    if (saleStart < new Date().toISOString()) {
      messages.push('판매 시작 일시는 현재 시각보다 빠를 수 없습니다.');
    }
    if (saleEnd < saleStart) {
      messages.push('판매 종료 일시는 시작 일시보다 빨라야 합니다.');
    }
    if (saleEnd > roundStart) {
      messages.push('판매 종료 일시는 공연 시작 일시보다 빠르거나 같아야 합니다.');
    }

    setSaleRoundErrors((current) => ({ ...current, [round.id]: messages }));
    if (messages.length === 0) {
      setSaleRoundCompletedIds((current) => ({ ...current, [round.id]: true }));
      setActiveSaleRoundId(null);
    } else {
      setSaleRoundCompletedIds((current) => ({ ...current, [round.id]: false }));
    }
  };

  const completeGlobalSalePeriod = () => {
    const messages: string[] = [];
    const globalStart = toDateTimeIso(globalSaleStart, globalSaleStartTime);
    const globalEnd = toDateTimeIso(globalSaleEnd, globalSaleEndTime);

    if (globalStart < new Date().toISOString()) {
      messages.push('전체 판매 시작 일시는 현재 시각보다 빠를 수 없습니다.');
    }
    if (globalEnd < globalStart) {
      messages.push('전체 판매 종료 일시는 시작 일시보다 빨라야 합니다.');
    }
    rounds.forEach((round, index) => {
      if (globalEnd > roundStartIso(round)) {
        messages.push(`${index + 1}회차 판매 종료 일시는 공연 시작 일시보다 빠르거나 같아야 합니다.`);
      }
    });

    setSaleMessages(messages);
    if (messages.length === 0) {
      setGlobalSaleCompleted(true);
      setGlobalSaleExpanded(false);
    } else {
      setGlobalSaleCompleted(false);
    }
  };

  const syncGlobalSaleToRounds = (
    nextStartDate = globalSaleStart,
    nextStartTime = globalSaleStartTime,
    nextEndDate = globalSaleEnd,
    nextEndTime = globalSaleEndTime,
  ) => {
    if (roundSaleOverrideEnabled) return;
    setRounds((current) => current.map((round) => ({
      ...round,
      saleStartDate: nextStartDate,
      saleStartTime: nextStartTime,
      saleEndDate: nextEndDate,
      saleEndTime: nextEndTime,
      useGlobalSalePeriod: true,
    })));
  };

  const updateGlobalSaleStartDate = (date: string) => {
    setGlobalSaleStart(date);
    setGlobalSaleCompleted(false);
    syncGlobalSaleToRounds(date, globalSaleStartTime, globalSaleEnd, globalSaleEndTime);
  };

  const updateGlobalSaleStartTime = (time: string) => {
    setGlobalSaleStartTime(time);
    setGlobalSaleCompleted(false);
    syncGlobalSaleToRounds(globalSaleStart, time, globalSaleEnd, globalSaleEndTime);
  };

  const updateGlobalSaleEndDate = (date: string) => {
    setGlobalSaleEnd(date);
    setGlobalSaleCompleted(false);
    syncGlobalSaleToRounds(globalSaleStart, globalSaleStartTime, date, globalSaleEndTime);
  };

  const updateGlobalSaleEndTime = (time: string) => {
    setGlobalSaleEndTime(time);
    setGlobalSaleCompleted(false);
    syncGlobalSaleToRounds(globalSaleStart, globalSaleStartTime, globalSaleEnd, time);
  };

  const setRoundSaleOverride = (enabled: boolean) => {
    setRoundSaleOverrideEnabled(enabled);
    setGlobalSaleExpanded(true);
    setActiveSaleRoundId(null);
    setSaleMessages([]);
    setSaleRoundErrors({});
    setGlobalSaleCompleted(false);
    setSaleRoundCompletedIds({});
    setRounds((current) => current.map((round) => ({
      ...round,
      useGlobalSalePeriod: !enabled,
      saleStartDate: enabled ? today : globalSaleStart,
      saleStartTime: enabled ? nowTime : globalSaleStartTime,
      saleEndDate: enabled ? round.eventDate : globalSaleEnd,
      saleEndTime: enabled ? round.endTime : globalSaleEndTime,
    })));
  };

  const addRound = () => {
    setRounds((current) => {
      const nextDate = addDays(current.at(-1)?.eventDate || defaultEventDate, 1);
      const next = buildRound(current.length, nextDate, roundSaleOverrideEnabled ? today : globalSaleStart, roundSaleOverrideEnabled ? nextDate : globalSaleEnd, !roundSaleOverrideEnabled);
      const preparedNext = {
        ...next,
        saleStartTime: roundSaleOverrideEnabled ? nowTime : globalSaleStartTime,
        saleEndTime: roundSaleOverrideEnabled ? next.endTime : globalSaleEndTime,
      };
      setExpandedRoundIds([preparedNext.id]);
      return [...current, preparedNext];
    });
  };

  const removeRound = (id: string) => {
    setRounds((latest) => {
      if (latest.length <= 1) return latest;
      const nextRounds = latest.filter((round) => round.id !== id).map((round, index) => ({ ...round, title: `${index + 1}회차` }));
      const nextSaleEnd = defaultSaleEndForRounds(nextRounds);
      setGlobalSaleEnd(nextSaleEnd);
      setExpandedRoundIds((current) => current.filter((item) => item !== id));
      setRoundMessages((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      if (activeSaleRoundId === id) setActiveSaleRoundId(null);
      return nextRounds.map((round) => (
        !roundSaleOverrideEnabled || round.useGlobalSalePeriod
          ? { ...round, saleEndDate: nextSaleEnd, saleEndTime: '21:00' }
          : round
      ));
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
    const nextSaleMessages: string[] = [];
    const nextSaleRoundErrors: Record<string, string[]> = {};

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

    const ranges = rounds.map((round, index) => {
      const roundNumber = index + 1;
      const startsAt = new Date(toDateTimeIso(round.eventDate, round.startTime));
      const endsAtRaw = new Date(toDateTimeIso(round.eventDate, round.endTime));
      const endsAt = endsAtRaw <= startsAt ? new Date(endsAtRaw.getTime() + 24 * 60 * 60 * 1000) : endsAtRaw;
      const saleStartDate = round.useGlobalSalePeriod ? globalSaleStart : round.saleStartDate;
      const saleStartTime = round.useGlobalSalePeriod ? globalSaleStartTime : round.saleStartTime;
      const saleEndDate = round.useGlobalSalePeriod ? globalSaleEnd : round.saleEndDate;
      const saleEndTime = round.useGlobalSalePeriod ? globalSaleEndTime : round.saleEndTime;
      const saleStart = toDateTimeIso(saleStartDate, saleStartTime);
      const saleEnd = toDateTimeIso(saleEndDate, saleEndTime);

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        nextErrors.push(`${roundNumber}회차 시간을 설정해주세요.`);
        nextInvalid.rounds = true;
      } else if (endsAtRaw <= startsAt) {
        nextRoundMessages[round.id] = ['종료 시간이 시작 시간보다 빠릅니다. 다음 날 종료되는 일정으로 처리됩니다.'];
      } else {
        nextRoundMessages[round.id] = [];
      }
      if (roundSaleOverrideEnabled) {
        const saleRoundMessages: string[] = [];
        if (saleStart < new Date().toISOString()) {
          saleRoundMessages.push('판매 시작 일시는 현재 시각보다 빠를 수 없습니다.');
        }
        if (saleEnd < saleStart) {
          saleRoundMessages.push('판매 종료 일시는 시작 일시보다 빨라야 합니다.');
        }
        if (saleEnd > startsAt.toISOString()) {
          saleRoundMessages.push('판매 종료 일시는 공연 시작 일시보다 빠르거나 같아야 합니다.');
        }
        nextSaleRoundErrors[round.id] = saleRoundMessages;
      } else {
        if (saleStart < new Date().toISOString()) {
          nextSaleMessages.push(`${roundNumber}회차 판매 시작 일시는 현재 시각보다 빠를 수 없습니다.`);
          nextInvalid.globalSale = true;
        }
        if (saleEnd < saleStart) {
          nextSaleMessages.push(`${roundNumber}회차 판매 시작 일시는 판매 종료 일시보다 빨라야 합니다.`);
          nextInvalid.globalSale = true;
        }
        if (saleEnd > startsAt.toISOString()) {
          nextSaleMessages.push(`${roundNumber}회차 판매 종료 일시는 공연 시작 일시보다 빠르거나 같아야 합니다.`);
          nextInvalid.globalSale = true;
        }
      }

      return { index, startsAt, endsAt, saleStart, saleEnd };
    }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    ranges.forEach((range, index) => {
      const next = ranges[index + 1];
      if (next && range.endsAt > next.startsAt) {
        nextErrors.push(`${range.index + 1}회차와 ${next.index + 1}회차 시간이 서로 겹칩니다.`);
        nextInvalid.rounds = true;
      }
    });

    if (!roundSaleOverrideEnabled) {
      const globalStart = toDateTimeIso(globalSaleStart, globalSaleStartTime);
      const globalEnd = toDateTimeIso(globalSaleEnd, globalSaleEndTime);
      if (globalStart < new Date().toISOString()) {
        nextSaleMessages.push('전체 판매 시작 일시는 현재 시각보다 빠를 수 없습니다.');
        nextInvalid.globalSale = true;
      }
      if (globalEnd < globalStart) {
        nextSaleMessages.push('전체 판매 시작 일시는 판매 종료 일시보다 빨라야 합니다.');
        nextInvalid.globalSale = true;
      }
      ranges.forEach((range, index) => {
        if (globalEnd > range.startsAt.toISOString()) {
          nextSaleMessages.push(`${index + 1}회차 판매 종료 일시는 공연 시작 일시보다 빠르거나 같아야 합니다.`);
          nextInvalid.globalSale = true;
        }
      });
    }

    const hasBlockingIssues = nextErrors.length > 0 || nextSaleMessages.length > 0 || Object.values(nextSaleRoundErrors).some((messages) => messages.length > 0);

    setErrors(nextErrors);
    setInvalidFields(nextInvalid);
    setRoundMessages(nextRoundMessages);
    if (!roundSaleOverrideEnabled) {
      setSaleMessages(nextSaleMessages);
      setSaleRoundErrors({});
    }
    if (roundSaleOverrideEnabled) {
      setSaleRoundErrors(nextSaleRoundErrors);
      setSaleMessages([]);
    }
    if (hasBlockingIssues) {
      if (nextInvalid.rounds) setExpandedRoundIds(rounds.map((round) => round.id));
      if (roundSaleOverrideEnabled) {
        const firstSaleRoundId = Object.entries(nextSaleRoundErrors).find(([, messages]) => messages.length > 0)?.[0];
        if (firstSaleRoundId) setActiveSaleRoundId(firstSaleRoundId);
      }
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
    const saleStartTimes = sortedRounds.map((round) => roundSaleOverrideEnabled ? toDateTimeIso(round.saleStartDate, round.saleStartTime) : toDateTimeIso(globalSaleStart, globalSaleStartTime));
    const saleEndTimes = sortedRounds.map((round) => roundSaleOverrideEnabled ? toDateTimeIso(round.saleEndDate, round.saleEndTime) : toDateTimeIso(globalSaleEnd, globalSaleEndTime));
    const effectiveSaleStart = saleStartTimes.sort()[0];
    const effectiveSaleEnd = saleEndTimes.sort()[saleEndTimes.length - 1];

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
        primarySaleStart: effectiveSaleStart,
        primarySaleEnd: effectiveSaleEnd,
        salesStartAt: effectiveSaleStart,
        salesEndAt: effectiveSaleEnd,
        ticketPriceWei: '1',
        totalTicketCount: 0,
        resaleAllowed: false,
        maxResalePriceRate: 10000,
        resaleStart: null,
        resaleEnd: null,
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

          <Text style={styles.label}>이름</Text>
          <TextInput style={[styles.input, invalidFields.name && styles.invalidInput]} value={name} onChangeText={setName} placeholder="예: TRUST LIVE 2026" />
          <Text style={styles.helpText}>사용자에게 표시될 이벤트 이름을 입력해주세요.</Text>

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
          <Text style={styles.cardTitle}>일정</Text>
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
                      <Text style={styles.flatLabel}>이벤트 날짜</Text>
                      <SingleDatePicker
                        value={round.eventDate}
                        onChange={(value) => updateRound(round.id, { eventDate: value })}
                        markedRounds={rounds.map((item, itemIndex) => ({ date: item.eventDate, label: `${itemIndex + 1}회차` }))}
                      />
                    </View>
                    <View style={styles.flatField}>
                      <Text style={styles.flatLabel}>이벤트 시작 시간</Text>
                      <TimeWheelPicker label="시작 시간" value={round.startTime} onChange={(value) => updateRound(round.id, { startTime: value })} />
                    </View>
                    <View style={styles.flatField}>
                      <Text style={styles.flatLabel}>이벤트 종료 시간</Text>
                      <TimeWheelPicker label="종료 시간" value={round.endTime} onChange={(value) => updateRound(round.id, { endTime: value })} />
                    </View>
                    {roundMessages[round.id]?.length ? (
                      <View style={styles.inlineWarningBox}>
                        {roundMessages[round.id].map((message) => <Text key={message} style={styles.inlineWarningText}>· {message}</Text>)}
                        <TouchableOpacity style={styles.warningAgreeButton} onPress={() => setRoundAcknowledgedIds((current) => ({ ...current, [round.id]: true }))}>
                          <Text style={styles.warningAgreeText}>{roundAcknowledgedIds[round.id] ? '동의됨' : '동의'}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <TouchableOpacity style={styles.applyRoundButton} onPress={() => void saveRound(round.id)}>
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
              <Text style={styles.roundTitle}>티켓 판매 기간</Text>
            </View>
          </View>
          <View style={styles.saleBody}>
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

            {roundSaleOverrideEnabled ? (
              Object.values(saleRoundErrors).some((messages) => messages.length > 0) ? (
                <View style={styles.inlineWarningBox}>
                  {Object.entries(saleRoundErrors).flatMap(([roundId, messages]) => messages.map((message) => <Text key={`${roundId}-${message}`} style={styles.inlineWarningText}>· {message}</Text>))}
                </View>
              ) : null
            ) : saleMessages.length > 0 ? (
              <View style={styles.inlineWarningBox}>
                {saleMessages.map((message) => <Text key={message} style={styles.inlineWarningText}>· {message}</Text>)}
              </View>
            ) : null}

            {!roundSaleOverrideEnabled ? (
              <View style={styles.salePeriodBlock}>
                <TouchableOpacity style={styles.roundHeader} onPress={() => setGlobalSaleExpanded((current) => !current)} activeOpacity={0.82}>
                  <View style={styles.roundHeaderCopy}>
                    <Text style={styles.roundTitle}>{globalSaleExpanded ? '▼' : '▶'} 전체 판매 기간 설정</Text>
                    {!globalSaleExpanded ? (
                      <Text style={styles.roundSummary}>{formatDateTime(globalSaleStart, globalSaleStartTime)} ~ {formatDateTime(globalSaleEnd, globalSaleEndTime)}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
                {globalSaleExpanded ? (
                  <View style={styles.saleBody}>
                    <View style={styles.saleBoundaryGroup}>
                      <View style={styles.saleBoundaryCard}>
                        <Text style={styles.saleBoundaryTitle}>판매 시작</Text>
                        <View style={styles.saleBoundaryRow}>
                          <View style={styles.saleBoundaryField}>
                            <Text style={styles.flatLabel}>날짜</Text>
                            <SingleDatePicker value={globalSaleStart} onChange={updateGlobalSaleStartDate} markedRounds={rounds.map((round, index) => ({ date: round.eventDate, label: `${index + 1}회차` }))} />
                          </View>
                          <View style={styles.saleBoundaryField}>
                            <Text style={styles.flatLabel}>시간</Text>
                            <TimeWheelPickerBase label="판매 시작 시간" value={globalSaleStartTime} onChange={updateGlobalSaleStartTime} />
                          </View>
                        </View>
                      </View>
                      <View style={styles.saleBoundaryCard}>
                        <Text style={styles.saleBoundaryTitle}>판매 종료</Text>
                        <View style={styles.saleBoundaryRow}>
                          <View style={styles.saleBoundaryField}>
                            <Text style={styles.flatLabel}>날짜</Text>
                            <SingleDatePicker value={globalSaleEnd} onChange={updateGlobalSaleEndDate} markedRounds={rounds.map((round, index) => ({ date: round.eventDate, label: `${index + 1}회차` }))} />
                          </View>
                          <View style={styles.saleBoundaryField}>
                            <Text style={styles.flatLabel}>시간</Text>
                            <TimeWheelPickerBase label="판매 종료 시간" value={globalSaleEndTime} onChange={updateGlobalSaleEndTime} />
                          </View>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.saleCompleteButton} onPress={completeGlobalSalePeriod}>
                      <Text style={styles.saleCompleteText}>완료</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}

            {roundSaleOverrideEnabled ? (
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
                                <SingleDatePicker value={round.saleStartDate} onChange={(value) => updateRound(round.id, { saleStartDate: value, useGlobalSalePeriod: false })} markedRounds={rounds.map((item, itemIndex) => ({ date: item.eventDate, label: `${itemIndex + 1}회차` }))} />
                              </View>
                              <View style={styles.saleBoundaryField}>
                                <Text style={styles.flatLabel}>시간</Text>
                                <TimeWheelPickerBase label="판매 시작 시간" value={round.saleStartTime} onChange={(value) => updateRound(round.id, { saleStartTime: value, useGlobalSalePeriod: false })} />
                              </View>
                            </View>
                          </View>
                          <View style={styles.saleBoundaryCard}>
                            <Text style={styles.saleBoundaryTitle}>판매 종료</Text>
                            <View style={styles.saleBoundaryRow}>
                              <View style={styles.saleBoundaryField}>
                                <Text style={styles.flatLabel}>날짜</Text>
                                <SingleDatePicker value={round.saleEndDate} onChange={(value) => updateRound(round.id, { saleEndDate: value, useGlobalSalePeriod: false })} markedRounds={rounds.map((item, itemIndex) => ({ date: item.eventDate, label: `${itemIndex + 1}회차` }))} />
                              </View>
                              <View style={styles.saleBoundaryField}>
                                <Text style={styles.flatLabel}>시간</Text>
                                <TimeWheelPickerBase label="판매 종료 시간" value={round.saleEndTime} onChange={(value) => updateRound(round.id, { saleEndTime: value, useGlobalSalePeriod: false })} />
                              </View>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity style={styles.applyRoundButton} onPress={() => completeSaleRound(round)}>
                          <Text style={styles.applyRoundText}>완료</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
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

function CompactRangePicker({
  title,
  compactTitle,
  ctaLabel = '기간 변경',
  markedRounds = [],
  startDate,
  endDate,
  onChange,
  active = false,
  summaryRounds = [],
  summaryActiveRoundId = null,
  onOpen,
  onClose,
}: {
  title: string;
  compactTitle?: string;
  ctaLabel?: string;
  markedRounds?: MarkedRoundDate[];
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  active?: boolean;
  summaryRounds?: EventRoundDraft[];
  summaryActiveRoundId?: string | null;
  onOpen?: () => void;
  onClose?: () => void;
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
    onOpen?.();
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
    onClose?.();
  };

  return (
    <View style={styles.rangePickerBox}>
      <TouchableOpacity style={[styles.compactPickerButton, active && styles.activePickerButton]} onPress={openSheet}>
        <View style={styles.compactPickerCopy}>
          <Text style={styles.rangePickerTitle}>{compactTitle || title}</Text>
          <Text style={styles.rangePickerValue}>{formatDotDate(startDate)} ~ {formatDotDate(endDate)}</Text>
        </View>
        <Text style={styles.compactPickerAction}>{ctaLabel}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => { setOpen(false); onClose?.(); }}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => { setOpen(false); onClose?.(); }} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <SaleRoundStrip
              rounds={summaryRounds.length > 0 ? summaryRounds : markedRounds.map((item, index) => ({
                id: `${item.date}-${index}`,
                title: item.label,
                eventDate: item.date,
                startTime: '00:00',
                endTime: '00:00',
                useGlobalSalePeriod: true,
                saleStartDate: startDate,
                saleStartTime: '00:00',
                saleEndDate: endDate,
                saleEndTime: '00:00',
              }))}
              activeRoundId={summaryActiveRoundId}
              perRound={!!summaryActiveRoundId}
            />
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

function SaleRoundStrip({
  rounds,
  activeRoundId,
  perRound,
}: {
  rounds: EventRoundDraft[];
  activeRoundId: string | null;
  perRound: boolean;
}) {
  return (
    <View style={styles.saleRoundStrip}>
      {perRound ? (
        rounds.map((round, index) => {
          const active = round.id === activeRoundId;
          return (
            <View key={round.id} style={[styles.saleRoundChip, active && styles.saleRoundChipActive]}>
              <Text style={[styles.saleRoundChipText, active && styles.saleRoundChipTextActive]}>{`[${index + 1}회차 · ${formatShortDate(round.eventDate)}]`}</Text>
            </View>
          );
        })
      ) : (
        rounds.map((round, index) => (
          <View key={round.id} style={styles.saleRoundChip}>
            <Text style={styles.saleRoundChipText}>{`[${index + 1}회차 · ${formatShortDate(round.eventDate)}]`}</Text>
          </View>
        ))
      )}
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
  inlineWarningBox: { marginTop: 8, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10 },
  inlineWarningText: { color: '#B45309', fontSize: 12, fontWeight: '800', lineHeight: 18 },
  warningAgreeButton: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FEF3C7' },
  warningAgreeText: { color: '#B45309', fontSize: 12, fontWeight: '900' },
  flatPicker: { flex: 1 },
  compactPickerButton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  activePickerButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
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
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1.1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, paddingVertical: 4 },
  emptyDayCell: { backgroundColor: '#F8FAFC', opacity: 0.45 },
  selectedDay: { backgroundColor: '#2563EB' },
  rangeDay: { backgroundColor: '#DBEAFE' },
  dayText: { color: '#0F172A', fontWeight: '800', fontSize: 12 },
  roundMarkerText: { marginTop: 1, color: '#64748B', fontSize: 8, fontWeight: '900' },
  dayCellInner: { alignItems: 'center', gap: 3 },
  markerPillRow: { marginTop: 2, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3 },
  markerBadge: { marginTop: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  markerBadgeSelected: { backgroundColor: '#1E40AF' },
  markerBadgeText: { color: '#2563EB', fontSize: 10, fontWeight: '900' },
  markerBadgeTextSelected: { color: '#FFFFFF' },
  emptyDayText: { color: 'transparent' },
  selectedDayText: { color: '#FFFFFF' },
  timeSinglePicker: { flex: 1 },
  timeSingleValue: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  timeDropdown: { marginTop: 7, maxHeight: 164, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  timeOption: { paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  activeTimeOption: { backgroundColor: '#EFF6FF' },
  timeOptionText: { color: '#475569', fontWeight: '900' },
  activeTimeOptionText: { color: '#2563EB' },
  applyRoundButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 11, backgroundColor: '#F8FAFC', alignItems: 'center' },
  applyRoundText: { color: '#0F172A', fontWeight: '900' },
  saleCompleteButton: { marginTop: 10, borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 11, backgroundColor: '#EFF6FF', alignItems: 'center' },
  saleCompleteText: { color: '#2563EB', fontWeight: '900' },
  addRoundButton: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 11, backgroundColor: '#EFF6FF' },
  addRoundButtonText: { color: '#2563EB', fontSize: 15, fontWeight: '900' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', textAlign: 'center', color: '#FFFFFF', fontWeight: '900', lineHeight: 20 },
  checkedBox: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkLabel: { color: '#0F172A', fontWeight: '800' },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  saleHeaderCopy: { flex: 1 },
  salePeriodBlock: { marginTop: 4 },
  saleBoundaryGroup: { marginTop: 8, gap: 10 },
  saleBoundaryCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF' },
  saleBoundaryTitle: { color: '#2563EB', fontSize: 13, fontWeight: '900', marginBottom: 8 },
  saleBoundaryRow: { flexDirection: 'row', gap: 8 },
  saleBoundaryField: { flex: 1 },
  saleTimeGrid: { gap: 8, marginTop: 8 },
  roundSaleItem: { marginTop: 8 },
  saleRoundStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  saleRoundChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  saleRoundChipMuted: { backgroundColor: '#F8FAFC' },
  saleRoundChipActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  saleRoundChipText: { color: '#334155', fontSize: 12, fontWeight: '900' },
  saleRoundChipTextActive: { color: '#2563EB' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modeButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF' },
  activeModeButton: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  modeButtonText: { color: '#0F172A', fontWeight: '900' },
  modeHint: { marginTop: 6, color: '#64748B', fontSize: 12 },
  saleRangeText: { marginTop: 6, color: '#0F172A', fontSize: 15, fontWeight: '900' },
  saleSummary: { marginTop: 4, color: '#64748B', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  saleBody: { marginTop: 2 },
  rangePickerBox: { marginTop: 9 },
  rangePickerTitle: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  rangePickerValue: { marginTop: 3, color: '#0F172A', fontWeight: '900' },
  roundSaleList: { marginTop: 2 },
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
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewImage: { width: '88%', aspectRatio: 3 / 4, borderRadius: 8 },
  previewClose: { marginTop: 18, color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
