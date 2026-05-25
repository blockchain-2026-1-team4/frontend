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

  if (!Number.isNaN(firstStart) && !Number.isNaN(lastEnd) && current >= firstStart && current <= lastEnd) {
    return { label: '공연 중', tone: 'green' };
  }
  if (!Number.isNaN(lastEnd) && current > lastEnd) return { label: '종료', tone: 'gray' };
  if (event.soldOut || event.remainingTicketCount === 0) return { label: '매진', tone: 'red' };

  const saleStart = event.salesStartAt || event.primarySaleStart;
  const saleEnd = event.salesEndAt || event.primarySaleEnd;
  const saleStartTime = timeOf(saleStart);
  const saleEndTime = timeOf(saleEnd);
  if (!Number.isNaN(saleStartTime) && current < saleStartTime) return { label: '판매 예정', tone: 'yellow' };
  if (!Number.isNaN(saleEndTime) && current > saleEndTime) return { label: '종료', tone: 'gray' };
  if (!Number.isNaN(saleStartTime) || !Number.isNaN(saleEndTime)) return { label: '판매 중', tone: 'blue' };

  return { label: '판매 예정', tone: 'yellow' };
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
