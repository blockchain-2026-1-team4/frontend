import type { EventRound, EventSummary, TicketDetail } from '../types/api';

const TICKET_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: '판매 가능',
  SOLD: '소유 중',
  LISTED: '리셀 판매중',
  USED: '사용 완료',
  CANCELLED: '취소됨',
};

const TICKET_ENTRY_STATUS_LABEL: Record<string, string> = {
  SOLD: '입장 가능',
  LISTED: '입장 가능',
  USED: '체크인 완료',
  CANCELLED: '사용 불가',
};

const VALIDITY_REASON_LABEL: Record<string, string> = {
  VALID: '사용 가능',
  INVALID: '사용 불가',
  USED: '이미 사용됨',
  EXPIRED: '만료',
  CANCELED: '취소',
  CANCELLED: '취소',
  NOT_OWNER: '소유자 불일치',
};

const EVENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PUBLISHED: '게시중',
  INACTIVE: '비공개',
  CANCELLED: '이벤트 취소',
};

export type DisplayStatus = {
  label: string;
  tone: 'neutral' | 'blue' | 'green' | 'yellow' | 'red' | 'gray';
};

function normalized(value?: string | null) {
  return String(value ?? '').toUpperCase();
}

function timeOf(value?: string | null) {
  if (!value) return NaN;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? NaN : time;
}

function roundStartAt(round?: EventRound) {
  if (!round?.eventDate || !round?.startTime) return NaN;
  return timeOf(`${round.eventDate}T${round.startTime}`);
}

function roundEndAt(round?: EventRound) {
  if (!round?.eventDate || !round?.endTime) return NaN;
  return timeOf(`${round.eventDate}T${round.endTime}`);
}

export function formatTicketStatus(status?: string | null) {
  const key = normalized(status);
  return TICKET_STATUS_LABEL[key] ?? status ?? '-';
}

export function formatTicketEntryStatus(status?: string | null) {
  const key = normalized(status);
  return TICKET_ENTRY_STATUS_LABEL[key] ?? formatTicketStatus(status);
}

export function isTicketUsableForEntry(status?: string | null) {
  const key = normalized(status);
  return key === 'SOLD' || key === 'LISTED';
}

export function formatTicketValidity(validity?: Record<string, unknown> | null) {
  if (!validity) return '-';
  if (validity.valid === false) {
    const reason = normalized(String(validity.reason ?? 'INVALID'));
    return VALIDITY_REASON_LABEL[reason] ?? '사용 불가';
  }
  return '사용 가능';
}

export function formatEventDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

export function formatEventRange(start?: string | null, end?: string | null) {
  const startText = formatEventDate(start);
  const endText = formatEventDate(end);
  if (startText === '-' && endText === '-') return '-';
  if (startText === endText || endText === '-') return startText;
  return `${startText} ~ ${endText}`;
}

export function formatCompactDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (next: number) => String(next).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatCompactEventRange(start?: string | null, end?: string | null) {
  const startText = formatCompactDateTime(start);
  const endText = formatCompactDateTime(end);
  if (startText === '-' && endText === '-') return '-';
  if (startText === endText || endText === '-') return startText;
  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      const sameDay =
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate();
      if (sameDay) {
        const pad = (next: number) => String(next).padStart(2, '0');
        return `${startText} ~ ${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
      }
    }
  }
  return `${startText} ~ ${endText}`;
}

export function formatEventCategory(category?: string | null) {
  const labels: Record<string, string> = {
    CONCERT: '공연',
    PERFORMANCE: '공연',
    SHOW: '공연',
    EXHIBITION: '전시',
    SPORTS: '스포츠',
    FESTIVAL: '페스티벌',
    ETC: '기타',
    OTHER: '기타',
  };
  const key = normalized(category);
  return labels[key] ?? category ?? '기타';
}

export function formatEventStatus(status?: string | null) {
  const key = normalized(status);
  return EVENT_STATUS_LABEL[key] ?? status ?? '-';
}

export function formatSalesStatus(start?: string | null, end?: string | null, now = new Date()) {
  const startTime = timeOf(start);
  const endTime = timeOf(end);
  const current = now.getTime();
  if (!Number.isNaN(startTime) && current < startTime) return '판매 예정';
  if (!Number.isNaN(endTime) && current > endTime) return '종료';
  if (!Number.isNaN(startTime) || !Number.isNaN(endTime)) return '판매 중';
  return '-';
}

export function getEventDisplayStatus(event?: EventSummary | null, now = new Date()): DisplayStatus {
  if (!event) return { label: '-', tone: 'gray' };
  const status = normalized(event.status);
  if (status === 'CANCELLED') return { label: '취소', tone: 'red' };
  if (status === 'DRAFT') return { label: '초안', tone: 'gray' };
  if (status === 'INACTIVE') return { label: '비공개', tone: 'gray' };

  const current = now.getTime();
  const roundStarts = event.rounds?.map(roundStartAt).filter((value) => !Number.isNaN(value)) ?? [];
  const roundEnds = event.rounds?.map(roundEndAt).filter((value) => !Number.isNaN(value)) ?? [];
  const firstStart = roundStarts.length ? Math.min(...roundStarts) : timeOf(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime);
  const lastEnd = roundEnds.length ? Math.max(...roundEnds) : timeOf(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime);

  const total = Number(event.totalTicketCount ?? 0);
  const remaining = Number(event.remainingTicketCount ?? 0);
  const issued = total > 0 ? total - remaining : 0;

  if (!Number.isNaN(lastEnd) && current > lastEnd) return { label: '종료', tone: 'gray' };
  if (!Number.isNaN(firstStart) && !Number.isNaN(lastEnd) && current >= firstStart && current <= lastEnd) {
    return { label: '공연 중', tone: 'green' };
  }
  if ((event.soldOut || remaining === 0) && issued > 0) return { label: '매진', tone: 'red' };

  const saleStart = event.salesStartAt || event.primarySaleStart;
  const saleEnd = event.salesEndAt || event.primarySaleEnd;
  const saleStartTime = timeOf(saleStart);
  const saleEndTime = timeOf(saleEnd);
  if (!Number.isNaN(saleStartTime) && current < saleStartTime) return { label: '판매 예정', tone: 'yellow' };
  if (!Number.isNaN(saleEndTime) && current > saleEndTime) return { label: '종료', tone: 'gray' };
  if (!Number.isNaN(saleStartTime) || !Number.isNaN(saleEndTime)) return { label: '판매 중', tone: 'blue' };

  if (issued <= 0) return { label: '티켓 미발행', tone: 'gray' };

  return { label: '판매 예정', tone: 'yellow' };
}

export function getSalesDisplayStatus(event?: EventSummary | null, now = new Date()): DisplayStatus {
  if (!event) return { label: '-', tone: 'gray' };
  const status = normalized(event.status);
  if (status === 'CANCELLED') return { label: '취소', tone: 'red' };
  if (status === 'DRAFT' || status === 'INACTIVE') return { label: '티켓 미발행', tone: 'gray' };

  const total = Number(event.totalTicketCount ?? 0);
  const remaining = Number(event.remainingTicketCount ?? 0);
  const issued = total > 0 ? total - remaining : 0;
  if (issued <= 0) return { label: '티켓 미발행', tone: 'gray' };
  if (remaining <= 0) return { label: '매진', tone: 'red' };

  const current = now.getTime();
  const saleStartTime = timeOf(event.salesStartAt || event.primarySaleStart);
  const saleEndTime = timeOf(event.salesEndAt || event.primarySaleEnd);
  if (!Number.isNaN(saleStartTime) && current < saleStartTime) return { label: '판매 예정', tone: 'yellow' };
  if (!Number.isNaN(saleEndTime) && current > saleEndTime) return { label: '판매 종료', tone: 'gray' };
  return { label: '판매 중', tone: 'blue' };
}

export function getNextRoundTime(event?: EventSummary | null, now = new Date()) {
  if (!event) return timeOf(null);
  const current = now.getTime();
  const starts = event.rounds?.map(roundStartAt).filter((value) => !Number.isNaN(value)).sort((a, b) => a - b) ?? [];
  const next = starts.find((value) => value >= current);
  if (next !== undefined) return next;
  if (starts.length) return starts[starts.length - 1];
  return timeOf(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime);
}

export function formatNextRoundLabel(event?: EventSummary | null, now = new Date()) {
  if (getEventDisplayStatus(event, now).label === '종료') {
    return '마지막 회차 · 종료';
  }
  const nextTime = getNextRoundTime(event, now);
  if (Number.isNaN(nextTime)) return '다음 회차 · -';
  return `다음 회차 · ${formatCompactDateTime(new Date(nextTime).toISOString())}`;
}

export function getOrganizerEventDisplayStatus(event?: EventSummary | null, tickets: TicketDetail[] = [], now = new Date()): DisplayStatus {
  if (!event) return { label: '-', tone: 'gray' };
  const base = getEventDisplayStatus(event, now);
  if (base.label === '취소' || base.label === '공연 중' || base.label === '종료') return base;

  const issued = tickets.length || Number(event.totalTicketCount ?? 0) - Number(event.remainingTicketCount ?? 0);
  const total = Number(event.totalTicketCount ?? 0);
  if (issued <= 0) return { label: '티켓 미발행', tone: 'gray' };
  if (total > 0 && issued >= total) return { label: '발행 완료', tone: 'green' };
  return { label: '일부 발행', tone: 'yellow' };
}

export function getTicketDisplayStatus(ticket?: TicketDetail | null): DisplayStatus {
  if (!ticket) return { label: '-', tone: 'gray' };
  const status = normalized(ticket.status);
  if (status === 'CANCELLED') return { label: '취소됨', tone: 'red' };
  if (status === 'USED') return { label: '사용 완료', tone: 'gray' };
  if (status === 'LISTED') return { label: '리셀 판매중', tone: 'yellow' };
  if (status === 'SOLD') return { label: '입장 가능', tone: 'green' };
  if (status === 'AVAILABLE') return { label: '판매 가능', tone: 'blue' };
  return { label: formatTicketStatus(ticket.status), tone: 'neutral' };
}

export function eventDisplaySortRank(event?: EventSummary | null, now = new Date()) {
  const status = getEventDisplayStatus(event, now).label;
  const ranks: Record<string, number> = {
    취소: 0,
    종료: 1,
    '공연 중': 2,
    '판매 중': 3,
    '판매 예정': 4,
    매진: 5,
    '판매 종료': 6,
    '티켓 미발행': 7,
  };
  if (status === '종료') {
    const end = event?.eventEndAt || event?.endsAt || event?.eventAt || event?.eventDateTime;
    const endTime = timeOf(end);
    const soonThreshold = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (!Number.isNaN(endTime) && endTime >= soonThreshold) return 4;
  }
  return ranks[status] ?? 2;
}

export function operationSortRank(event?: EventSummary | null, now = new Date()) {
  const status = getEventDisplayStatus(event, now).label;
  const ranks: Record<string, number> = {
    '공연 중': 0,
    '판매 중': 1,
    '판매 예정': 2,
    매진: 3,
    종료: 4,
    취소: 5,
    '티켓 미발행': 6,
    '판매 종료': 7,
  };
  return ranks[status] ?? 6;
}

export function salesSortRank(event?: EventSummary | null, now = new Date()) {
  const status = getSalesDisplayStatus(event, now).label;
  const ranks: Record<string, number> = {
    '판매 중': 0,
    '판매 예정': 1,
    매진: 2,
    '판매 종료': 3,
    '티켓 미발행': 4,
    취소: 5,
  };
  return ranks[status] ?? 4;
}

export function weiToEth(wei?: string | number | null) {
  if (wei === undefined || wei === null || wei === '') return '-';
  try {
    const value = BigInt(String(wei));
    const whole = value / 1_000_000_000_000_000_000n;
    const fraction = String(value % 1_000_000_000_000_000_000n).padStart(18, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction} ETH` : `${whole} ETH`;
  } catch {
    return String(wei);
  }
}
