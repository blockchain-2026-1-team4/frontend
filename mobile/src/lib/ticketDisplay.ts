const TICKET_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: '판매 가능',
  LISTED: '리셀 중',
  ISSUED: '소유 중',
  OWNED: '소유 중',
  SOLD: '소유 중',
  USED: '사용 완료',
  EXPIRED: '만료',
  CANCELED: '취소',
  CANCELLED: '취소',
};

const TICKET_ENTRY_STATUS_LABEL: Record<string, string> = {
  LISTED: '리셀 중',
  ISSUED: '입장 가능',
  OWNED: '입장 가능',
  SOLD: '입장 가능',
  USED: '체크인 완료',
  EXPIRED: '만료',
  CANCELED: '사용 불가',
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
  PUBLISHED: '게시됨',
  SALES_OPEN: '판매 중',
  SALES_CLOSED: '판매 종료',
  ENDED: '종료',
  ACTIVE: '운영 중',
  INACTIVE: '운영 중지',
  CANCELED: '취소',
  CANCELLED: '취소',
};

export function formatTicketStatus(status?: string | null) {
  const key = status?.toUpperCase() ?? '';
  return TICKET_STATUS_LABEL[key] ?? status ?? '-';
}

export function formatTicketEntryStatus(status?: string | null) {
  const key = status?.toUpperCase() ?? '';
  return TICKET_ENTRY_STATUS_LABEL[key] ?? formatTicketStatus(status);
}

export function isTicketUsableForEntry(status?: string | null) {
  const key = status?.toUpperCase() ?? '';
  return key === 'SOLD' || key === 'ISSUED' || key === 'OWNED' || key === 'LISTED';
}

export function formatTicketValidity(validity?: Record<string, unknown> | null) {
  if (!validity) return '-';
  if (validity.valid === false) {
    const reason = String(validity.reason ?? 'INVALID').toUpperCase();
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
  const key = status?.toUpperCase() ?? '';
  return EVENT_STATUS_LABEL[key] ?? status ?? '-';
}

export function formatSalesStatus(start?: string | null, end?: string | null, now = new Date()) {
  const startTime = start ? new Date(start).getTime() : NaN;
  const endTime = end ? new Date(end).getTime() : NaN;
  const current = now.getTime();
  if (!Number.isNaN(startTime) && current < startTime) return '판매 예정';
  if (!Number.isNaN(endTime) && current > endTime) return '판매 종료';
  if (!Number.isNaN(startTime) || !Number.isNaN(endTime)) return '판매 중';
  return '-';
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
