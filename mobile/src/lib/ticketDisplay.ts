const TICKET_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: '예매 가능',
  LISTED: '판매중',
  ISSUED: '소유중',
  OWNED: '소유중',
  SOLD: '소유중',
  USED: '사용완료',
  EXPIRED: '만료됨',
  CANCELED: '취소됨',
  CANCELLED: '취소됨',
};

const TICKET_ENTRY_STATUS_LABEL: Record<string, string> = {
  LISTED: '판매중',
  ISSUED: '입장 가능',
  OWNED: '입장 가능',
  SOLD: '입장 가능',
  USED: '체크인 완료',
  EXPIRED: '만료됨',
  CANCELED: '사용 불가',
  CANCELLED: '사용 불가',
};

const VALIDITY_REASON_LABEL: Record<string, string> = {
  VALID: '사용 가능',
  INVALID: '사용 불가',
  USED: '이미 사용됨',
  EXPIRED: '만료됨',
  CANCELED: '취소됨',
  CANCELLED: '취소됨',
  NOT_OWNER: '소유자 불일치',
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
  return value ? new Date(value).toLocaleString() : '-';
}
