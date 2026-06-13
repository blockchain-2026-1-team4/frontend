import type { EventDetail, EventSummary, TicketDetail } from '../types/api';

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple';

export type TicketFlowStatus = {
  label: string;
  tone: Tone;
};

export function ticketIdOf(ticket?: TicketDetail | null) {
  return ticket?.id ? String(ticket.id) : ticket?.ticketId != null ? String(ticket.ticketId) : '';
}

export function compactId(value?: string | number | null, front = 8, back = 5) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  if (text.length <= front + back + 3) return text;
  return `${text.slice(0, front)}...${text.slice(-back)}`;
}

export function eventTitle(event?: EventSummary | null, ticket?: TicketDetail | null) {
  return event?.name || event?.title || ticket?.eventTitle || ticket?.eventName || '이벤트';
}

export function eventVenue(event?: EventSummary | null, ticket?: TicketDetail | null) {
  return event?.location?.name || event?.location?.address || event?.venue || ticket?.venue || '-';
}

export function eventDateValue(event?: EventSummary | null, ticket?: TicketDetail | null) {
  return event?.eventStartAt || event?.startsAt || event?.eventAt || event?.eventDateTime || ticket?.eventDateTime;
}

export function eventEndValue(event?: EventSummary | null) {
  return event?.eventEndAt || event?.endsAt || event?.eventAt || event?.eventDateTime;
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (next: number) => String(next).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function eventDateLabel(event?: EventSummary | null, ticket?: TicketDetail | null) {
  return formatDateTime(eventDateValue(event, ticket));
}

export function isEventEnded(event?: EventSummary | null) {
  const end = eventEndValue(event);
  if (!end) return false;
  const time = new Date(end).getTime();
  return !Number.isNaN(time) && Date.now() > time;
}

export function sectionNameOf(ticket?: TicketDetail | null) {
  const source = String(ticket?.sectionName || ticket?.seatInfo || '').trim();
  return source.replace(/-\d+$/, '').replace(/^\d+회차-/, '') || '-';
}

export function ownerAddressOf(ticket?: TicketDetail | null) {
  return ticket?.ownerWalletAddress || ticket?.ownerAddress || '';
}

export function weiToEthLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '-';
  try {
    const wei = BigInt(String(value));
    const whole = wei / 1_000_000_000_000_000_000n;
    const fraction = String(wei % 1_000_000_000_000_000_000n).padStart(18, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction} KAIA` : `${whole} KAIA`;
  } catch {
    return String(value);
  }
}

export function weiToEthInputValue(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '';
  try {
    const wei = BigInt(String(value));
    const whole = wei / 1_000_000_000_000_000_000n;
    const fraction = String(wei % 1_000_000_000_000_000_000n).padStart(18, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : `${whole}`;
  } catch {
    return '';
  }
}

export function ethToWeiValue(ethValue: string) {
  const normalized = ethValue.trim();
  if (!normalized) return '0';
  try {
    const [whole, fraction = ''] = normalized.split('.');
    const fractionPadded = `${fraction}${'0'.repeat(18)}`.slice(0, 18);
    return `${BigInt(whole || '0') * 1_000_000_000_000_000_000n + BigInt(fractionPadded || '0')}`;
  } catch {
    return '0';
  }
}

export function eventCategoryLabel(category?: string | null) {
  const labels: Record<string, string> = {
    CONCERT: '공연',
    PERFORMANCE: '공연',
    SHOW: '공연',
    EXHIBITION: '전시',
    SPORTS: '스포츠',
    FESTIVAL: '페스티벌',
    CONFERENCE: '컨퍼런스',
    ETC: '기타',
    OTHER: '기타',
  };
  const key = String(category ?? '').toUpperCase();
  return labels[key] ?? category ?? '기타';
}

export function ticketStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    AVAILABLE: '판매 가능',
    SOLD: '보유 중',
    LISTED: '리셀 판매중',
    USED: '사용 완료',
    CANCELLED: '취소됨',
  };
  const key = String(status ?? '').toUpperCase();
  return labels[key] ?? status ?? '-';
}

const CHECK_IN_OPEN_BEFORE_MS = 30 * 60 * 1000;

type RoundTimes = { startMs: number; endMs: number };

/**
 * 리스팅/티켓이 속한 회차의 시작·종료 시간을 반환한다.
 * 판단 불가 시 null 반환 (→ '상태 확인 필요' 또는 숨김 처리).
 * 1차: roundId → event.rounds 매칭
 * 2차: eventDateTime 날짜 → round.eventDate 매칭
 * 3차: 이벤트 레벨 날짜 fallback
 */
export function resolveRoundTimes(
  roundId: string | null | undefined,
  eventDateTime: string | null | undefined,
  event: EventSummary,
): RoundTimes | null {
  if (event.rounds?.length) {
    // 1차: roundId 매칭
    let round = roundId
      ? event.rounds.find((r) => r.id != null && String(r.id) === roundId)
      : undefined;

    // 2차: eventDateTime 날짜로 매칭
    if (!round && eventDateTime) {
      const ticketDate = eventDateTime.slice(0, 10);
      round = event.rounds.find((r) => r.eventDate?.slice(0, 10) === ticketDate);
    }

    if (round) {
      const startStr = round.startTime ? `${round.eventDate}T${round.startTime}` : round.eventDate;
      const endStr   = round.endTime   ? `${round.eventDate}T${round.endTime}`   : round.eventDate;
      const startMs  = startStr ? new Date(startStr).getTime() : NaN;
      const endMs    = endStr   ? new Date(endStr).getTime()   : NaN;
      if (!Number.isNaN(endMs)) return { startMs, endMs };
    }
  }

  // 3차: 이벤트 레벨 fallback
  const endValue   = eventEndValue(event);
  const startValue = event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime;
  const endMs      = endValue   ? new Date(endValue).getTime()   : NaN;
  const startMs    = startValue ? new Date(startValue).getTime() : NaN;
  if (!Number.isNaN(endMs)) return { startMs, endMs };

  // eventDateTime param fallback
  if (eventDateTime) {
    const ms = new Date(eventDateTime).getTime();
    if (!Number.isNaN(ms)) return { startMs: ms, endMs: ms };
  }

  // 4차: 판단 불가
  return null;
}

export function ticketEntryStatus(ticket?: TicketDetail | null, event?: EventSummary | null): TicketFlowStatus {
  if (!ticket) return { label: '사용 불가', tone: 'gray' };

  const status = String(ticket.status ?? '').toUpperCase();
  const now = Date.now();

  if (status === 'USED') return { label: '사용 불가', tone: 'gray' };
  if (status === 'CANCELLED') return { label: '사용 불가', tone: 'red' };
  if (String(event?.status ?? '').toUpperCase() === 'CANCELLED') return { label: '사용 불가', tone: 'red' };
  if (!event) return { label: '사용 불가', tone: 'gray' };

  const times = resolveRoundTimes(
    ticket.eventRoundId ? String(ticket.eventRoundId) : null,
    ticket.eventDateTime,
    event,
  );
  if (!times) return { label: '사용 불가', tone: 'gray' };

  const { startMs, endMs } = times;
  const roundEnded  = now >= endMs;
  const checkInOpen = !Number.isNaN(startMs) && now >= startMs - CHECK_IN_OPEN_BEFORE_MS && !roundEnded;

  if (status === 'LISTED') return { label: '사용 불가', tone: 'gray' };
  if (status === 'SOLD' && roundEnded) return { label: '사용 불가', tone: 'gray' };
  if (status === 'SOLD' && checkInOpen) return { label: '사용 가능', tone: 'green' };
  if (status === 'SOLD') return { label: '사용 불가', tone: 'gray' };

  return { label: '사용 불가', tone: 'gray' };
}

/** 사용 불가 사유 문구 (보조 텍스트용). 사용 가능하면 null */
export function ticketEntryReason(ticket?: TicketDetail | null, event?: EventSummary | null): string | null {
  if (!ticket) return '상태 확인 필요';
  const status = String(ticket.status ?? '').toUpperCase();
  const now = Date.now();
  if (status === 'USED') return '사용 완료';
  if (status === 'CANCELLED') return '취소됨';
  if (String(event?.status ?? '').toUpperCase() === 'CANCELLED') return '이벤트 취소';
  if (!event) return '상태 확인 필요';
  const times = resolveRoundTimes(
    ticket.eventRoundId ? String(ticket.eventRoundId) : null,
    ticket.eventDateTime,
    event,
  );
  if (!times) return '상태 확인 필요';
  const { startMs, endMs } = times;
  const roundEnded  = now >= endMs;
  if (roundEnded) return '사용 기간 종료';
  if (status === 'LISTED') return '리셀 중';
  const checkInOpen = !Number.isNaN(startMs) && now >= startMs - CHECK_IN_OPEN_BEFORE_MS;
  if (status === 'SOLD' && checkInOpen) return null;
  if (status === 'SOLD') return '사용 전';
  return '상태 확인 필요';
}

export function entryStatusOf(ticket?: TicketDetail | null, event?: EventSummary | null): TicketFlowStatus {
  return ticketEntryStatus(ticket, event);
}

export function displayStatusOf(ticket?: TicketDetail | null, event?: EventSummary | null): TicketFlowStatus {
  return ticketEntryStatus(ticket, event);
}

export function validityLabel(validity?: Record<string, unknown> | null) {
  if (!validity) return '-';
  if (validity.valid === false) {
    const reason = String(validity.reason ?? '').toUpperCase();
    if (reason === 'USED') return '이미 사용됨';
    if (reason === 'EXPIRED') return '만료됨';
    if (reason === 'CANCELED') return '취소됨';
    if (reason === 'NOT_OWNER') return '소유자 불일치';
    return '사용 불가';
  }
  return '입장 가능';
}

export function resaleCapPercent(ticket?: TicketDetail | null, event?: EventSummary | null) {
  const capRate = ticket?.resaleCapRate ?? event?.maxResalePriceRate;
  if (!capRate) return null;
  return Math.round(capRate / 100);
}

export function resalePolicyLabel(ticket?: TicketDetail | null, event?: EventSummary | null) {
  const enabled = ticket?.resaleEnabled ?? event?.resaleAllowed ?? false;
  if (!enabled) return '불가';
  const cap = resaleCapPercent(ticket, event);
  return cap ? `허용 · 최대 ${cap}%` : '허용';
}

export function canRegisterResale(ticket?: TicketDetail | null, event?: EventSummary | null) {
  const status = String(ticket?.status ?? '').toUpperCase();
  if (status !== 'SOLD') return false;
  if (isEventEnded(event)) return false;
  if (ticket?.resaleEnabled === false) return false;
  if (event?.resaleAllowed === false) return false;
  const now = Date.now();
  const resaleStart = event?.resaleStart ? new Date(event.resaleStart).getTime() : NaN;
  const resaleEnd = event?.resaleEnd ? new Date(event.resaleEnd).getTime() : NaN;
  if (!Number.isNaN(resaleStart) && now < resaleStart) return false;
  if (!Number.isNaN(resaleEnd) && now > resaleEnd) return false;
  return true;
}

export function maxResalePriceLabel(ticket?: TicketDetail | null, event?: EventDetail | null) {
  const base = ticket?.originalPriceWei ?? ticket?.priceWei ?? event?.ticketPriceWei;
  const capRate = ticket?.resaleCapRate ?? event?.maxResalePriceRate;
  if (!base || !capRate) return '-';
  try {
    const max = (BigInt(String(base)) * BigInt(String(capRate))) / 10000n;
    return weiToEthLabel(max.toString());
  } catch {
    return '-';
  }
}

export function resaleDeadlineLabel(ticket?: TicketDetail | null, event?: EventSummary | null) {
  return formatDateTime(ticket?.saleEndAt || event?.resaleEnd || event?.primarySaleEnd || event?.salesEndAt || eventDateValue(event, ticket));
}
