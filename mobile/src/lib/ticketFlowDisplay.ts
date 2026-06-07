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
    return fraction ? `${whole}.${fraction} ETH` : `${whole} ETH`;
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

export function entryStatusOf(ticket?: TicketDetail | null, event?: EventSummary | null): TicketFlowStatus {
  const status = String(ticket?.status ?? '').toUpperCase();
  if (status === 'USED') return { label: '체크인 완료', tone: 'gray' };
  if (status === 'CANCELLED') return { label: '사용 불가', tone: 'red' };
  if (status === 'SOLD' || status === 'LISTED') {
    if (isEventEnded(event)) return { label: '사용 기간 종료', tone: 'gray' };
    return { label: '입장 가능', tone: 'green' };
  }
  return { label: ticketStatusLabel(status), tone: status === 'AVAILABLE' ? 'blue' : 'gray' };
}

export function displayStatusOf(ticket?: TicketDetail | null, event?: EventSummary | null): TicketFlowStatus {
  const status = String(ticket?.status ?? '').toUpperCase();
  if (status === 'SOLD' || status === 'LISTED') return entryStatusOf(ticket, event);
  if (status === 'USED') return { label: '사용 완료', tone: 'gray' };
  if (status === 'CANCELLED') return { label: '취소됨', tone: 'red' };
  if (status === 'AVAILABLE') return { label: '판매 가능', tone: 'blue' };
  return { label: ticketStatusLabel(status), tone: 'gray' };
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
