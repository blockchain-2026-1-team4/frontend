import type { EventRound, EventSummary, TicketDetail } from '../types/api';

const TICKET_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: '판매 가능',
  SOLD: '보유 중',
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
  tone: 'neutral' | 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple';
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
  return timeOf(`${round.eventDate}T${round.startTime}Z`);
}

function roundEndAt(round?: EventRound) {
  if (!round?.eventDate || !round?.endTime) return NaN;
  return timeOf(`${round.eventDate}T${round.endTime}Z`);
}

// 회차에 속하는 티켓을 반환한다.
// round.id → eventDate 순으로 매칭. 매칭 불가 시 null 반환 (allTickets fallback 없음).
export function matchTicketsToRound(
  round: { id?: string | number | null; eventDate?: string | null } | null | undefined,
  allTickets: TicketDetail[],
): TicketDetail[] | null {
  if (!round) return allTickets;
  const roundId = round.id != null ? String(round.id) : null;
  if (roundId) {
    return allTickets.filter((t) => t.eventRoundId != null && String(t.eventRoundId) === roundId);
  }
  if (round.eventDate) {
    const prefix = round.eventDate.slice(0, 10);
    return allTickets.filter((t) => t.eventDateTime?.slice(0, 10) === prefix);
  }
  return null;
}

export function getEventStartTime(event?: EventSummary | null) {
  if (!event) return NaN;
  const roundStarts = event.rounds?.map(roundStartAt).filter((value) => !Number.isNaN(value)) ?? [];
  return roundStarts.length
    ? Math.min(...roundStarts)
    : timeOf(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime);
}

export function getEventEndTime(event?: EventSummary | null) {
  if (!event) return NaN;
  const roundEnds = event.rounds?.map(roundEndAt).filter((value) => !Number.isNaN(value)) ?? [];
  return roundEnds.length
    ? Math.max(...roundEnds)
    : timeOf(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime);
}

export function isEventEnded(event?: EventSummary | null, now = new Date()) {
  const endTime = getEventEndTime(event);
  return !Number.isNaN(endTime) && now.getTime() > endTime;
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
    CONFERENCE: '컨퍼런스',
  };
  const key = normalized(category);
  return labels[key] ?? category ?? '기타';
}

export function formatEventStatus(status?: string | null) {
  const key = normalized(status);
  return EVENT_STATUS_LABEL[key] ?? status ?? '-';
}

/** 운영자 화면용 이벤트 상태 배지 */
export function getEventDisplayStatus(event?: EventSummary | null, now = new Date()): DisplayStatus {
  if (!event) return { label: '-', tone: 'gray' };
  const status = normalized(event.status);
  if (status === 'CANCELLED') return { label: '취소', tone: 'red' };
  if (status === 'DRAFT') return { label: '초안', tone: 'gray' };
  if (status === 'INACTIVE') return { label: '비공개', tone: 'purple' };
  const nowMs = now.getTime();
  const hasActive = (event.rounds ?? []).some((r) => isRoundActiveNow(r, event, undefined, nowMs));
  return hasActive ? { label: '진행 중', tone: 'green' } : { label: '종료', tone: 'gray' };
}

/** 사용자 화면 정렬 우선순위: 예매 가능 이벤트를 앞에 */
export function userSortRank(event?: EventSummary | null, now = new Date()): number {
  if (!event) return 99;
  return isEventListedNow(event, undefined, now.getTime()) ? 0 : 99;
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
  if (isEventEnded(event, now)) {
    return '마지막 회차 · 종료';
  }
  const nextTime = getNextRoundTime(event, now);
  if (Number.isNaN(nextTime)) return '다음 회차 · -';
  return `다음 회차 · ${formatCompactDateTime(new Date(nextTime).toISOString())}`;
}

const CHECK_IN_OPEN_MINUTES = 30;

// SOLD:      공연 시작 30분 전 ~ 종료 → 입장 가능 / 그 전 → 보유 중 / 종료 후 → 사용 기간 종료
// AVAILABLE: 공연 종료 후 → 판매 종료
// LISTED:    공연 종료 후 → 판매 종료
export function getTicketDisplayStatus(
  ticket?: TicketDetail | null,
  event?: EventSummary | null,
  now = new Date(),
): DisplayStatus {
  if (!ticket) return { label: '-', tone: 'gray' };
  const status = normalized(ticket.status);

  if (status === 'CANCELLED') return { label: '취소됨', tone: 'red' };
  if (status === 'USED') return { label: '체크인 완료', tone: 'gray' };

  if (event) {
    const current = now.getTime();
    const roundStarts = event.rounds?.map(roundStartAt).filter((v) => !Number.isNaN(v)) ?? [];
    const roundEnds = event.rounds?.map(roundEndAt).filter((v) => !Number.isNaN(v)) ?? [];
    const firstStart = roundStarts.length
      ? Math.min(...roundStarts)
      : timeOf(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime);
    const lastEnd = roundEnds.length
      ? Math.max(...roundEnds)
      : timeOf(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime);

    const eventEnded = !Number.isNaN(lastEnd) && current > lastEnd;
    const checkInOpenAt = Number.isNaN(firstStart) ? NaN : firstStart - CHECK_IN_OPEN_MINUTES * 60_000;
    const isCheckInOpen = !Number.isNaN(checkInOpenAt) && current >= checkInOpenAt && !eventEnded;

    if (status === 'SOLD') {
      if (eventEnded) return { label: '사용 기간 종료', tone: 'gray' };
      if (isCheckInOpen) return { label: '입장 가능', tone: 'green' };
      return { label: '보유 중', tone: 'blue' };
    }
    if (status === 'AVAILABLE') {
      return eventEnded
        ? { label: '판매 종료', tone: 'gray' }
        : { label: '판매 가능', tone: 'blue' };
    }
    if (status === 'LISTED') {
      return eventEnded
        ? { label: '판매 종료', tone: 'gray' }
        : { label: '리셀 판매중', tone: 'yellow' };
    }
  }

  // 이벤트 정보 없을 때 fallback
  if (status === 'SOLD') return { label: '보유 중', tone: 'blue' };
  if (status === 'AVAILABLE') return { label: '판매 가능', tone: 'blue' };
  if (status === 'LISTED') return { label: '리셀 판매중', tone: 'yellow' };

  return { label: formatTicketStatus(ticket.status), tone: 'neutral' };
}

export function operationSortRank(event?: EventSummary | null, now = new Date()): number {
  if (!event) return 99;
  const status = normalized(event.status);
  if (status === 'CANCELLED') return 4;
  if (status === 'INACTIVE')  return 3;
  if (status === 'DRAFT')     return 2;
  const nowMs = now.getTime();
  const hasActive = (event.rounds ?? []).some((r) => isRoundActiveNow(r, event, undefined, nowMs));
  return hasActive ? 0 : 1;
}

export function salesSortRank(event?: EventSummary | null, now = new Date()): number {
  if (!event) return 99;
  if (normalized(event.status) !== 'PUBLISHED') return 99;
  const nowMs = now.getTime();
  const hasActive = (event.rounds ?? []).some((r) => isRoundActiveNow(r, event, undefined, nowMs));
  return hasActive ? 0 : 1;
}

// ═══════════════════════════════════════════════════════════════════════════
//  행동 가능 여부 판정 (공통 시간 판정 → 구매 · 사용 · 리셀 가능 여부)
// ═══════════════════════════════════════════════════════════════════════════

export type RoundMs = {
  saleStartMs:  number;
  saleEndMs:    number;
  roundStartMs: number;
  roundEndMs:   number;
};

/** 회차(없으면 이벤트 전체) 기준 시간 정보를 ms 단위로 추출 */
export function getRoundMs(
  round: EventRound | null | undefined,
  event: EventSummary,
): RoundMs {
  return {
    saleStartMs:  timeOf(round?.saleStartAt  || event.primarySaleStart || event.salesStartAt),
    saleEndMs:    timeOf(round?.saleEndAt    || event.primarySaleEnd   || event.salesEndAt),
    roundStartMs: round
      ? roundStartAt(round)
      : timeOf(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime),
    roundEndMs: round
      ? roundEndAt(round)
      : timeOf(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime),
  };
}

/** ticket.eventRoundId 로 event.rounds 에서 해당 회차를 찾는다 */
export function findTicketRound(
  ticket: TicketDetail,
  event: EventSummary,
): EventRound | undefined {
  if (ticket.eventRoundId == null || !event.rounds?.length) return undefined;
  return event.rounds.find((r) => r.id != null && String(r.id) === String(ticket.eventRoundId));
}

// ── 원자 판정식 ────────────────────────────────────────────────────────────
// NaN(미설정) 처리 원칙:
//   saleStart  미설정 → isSaleStarted = false  (판매 미시작 가정)
//   saleEnd    미설정 → isSaleEnded   = false  (판매 미종료 가정)
//   roundStart 미설정 → isRoundStarted = false
//   roundEnd   미설정 → isRoundEnded  = false

export function isSaleStarted(rms: RoundMs, nowMs: number)  { return !Number.isNaN(rms.saleStartMs)  && rms.saleStartMs  <= nowMs; }
export function isSaleEnded(rms: RoundMs, nowMs: number)    { return !Number.isNaN(rms.saleEndMs)    && rms.saleEndMs    <= nowMs; }
export function isRoundStarted(rms: RoundMs, nowMs: number) { return !Number.isNaN(rms.roundStartMs) && rms.roundStartMs <= nowMs; }
export function isRoundEnded(rms: RoundMs, nowMs: number)   { return !Number.isNaN(rms.roundEndMs)   && rms.roundEndMs   <= nowMs; }
export function isCheckInOpen(rms: RoundMs, nowMs: number) {
  if (Number.isNaN(rms.roundStartMs)) return false;
  return rms.roundStartMs - CHECK_IN_OPEN_MINUTES * 60_000 <= nowMs;
}

// ── 1. 좌석/티켓 구매 가능 여부 ───────────────────────────────────────────

export function ticketCanBuy(
  ticket?: TicketDetail | null,
  event?: EventSummary | null,
  round?: EventRound | null,
  nowMs = Date.now(),
): boolean {
  if (!ticket || !event) return false;
  if (normalized(event.status) !== 'PUBLISHED') return false;
  if (normalized(ticket.status) !== 'AVAILABLE') return false;
  const rms = getRoundMs(round, event);
  return (
    isSaleStarted(rms, nowMs) &&
    !isSaleEnded(rms, nowMs) &&
    !isRoundStarted(rms, nowMs) &&
    !isRoundEnded(rms, nowMs)
  );
}

export type BuyBlockReason =
  | 'event_cancelled' | 'event_not_published'
  | 'ticket_unavailable' | 'round_ended'
  | 'sale_ended' | 'pre_sale' | 'unknown';

const BUY_BLOCK_LABEL: Record<BuyBlockReason, string> = {
  event_cancelled:     '이벤트 취소',
  event_not_published: '판매 불가',
  ticket_unavailable:  '구매 불가',
  round_ended:         '판매 종료',
  sale_ended:          '판매 종료',
  pre_sale:            '판매 예정',
  unknown:             '상태 확인 필요',
};

/** ticketCanBuy === false 일 때 사유 반환. 구매 가능하면 null */
export function ticketBuyBlockReason(
  ticket?: TicketDetail | null,
  event?: EventSummary | null,
  round?: EventRound | null,
  nowMs = Date.now(),
): BuyBlockReason | null {
  if (!ticket || !event) return 'unknown';
  if (ticketCanBuy(ticket, event, round, nowMs)) return null;
  const evtStatus = normalized(event.status);
  if (evtStatus === 'CANCELLED') return 'event_cancelled';
  if (evtStatus !== 'PUBLISHED') return 'event_not_published';
  if (normalized(ticket.status) !== 'AVAILABLE') return 'ticket_unavailable';
  const rms = getRoundMs(round, event);
  if (isRoundEnded(rms, nowMs))   return 'round_ended';
  if (isRoundStarted(rms, nowMs)) return 'round_ended';   // 공연 시작 후 = 판매 종료
  if (isSaleEnded(rms, nowMs))    return 'sale_ended';
  if (!isSaleStarted(rms, nowMs)) return 'pre_sale';
  return 'unknown';
}

export function ticketBuyBlockLabel(reason?: BuyBlockReason | null): string | null {
  if (!reason) return null;
  return BUY_BLOCK_LABEL[reason] ?? '상태 확인 필요';
}

// ── 2. 구역 구매 가능 여부 ─────────────────────────────────────────────────

/** 구역(같은 sectionName) 티켓 중 하나라도 구매 가능하면 true */
export function sectionCanBuy(
  sectionTickets: TicketDetail[],
  event?: EventSummary | null,
  round?: EventRound | null,
  nowMs = Date.now(),
): boolean {
  return sectionTickets.some((t) => ticketCanBuy(t, event, round, nowMs));
}

// ── 3. 회차 활성 여부 ──────────────────────────────────────────────────────

/**
 * 회차가 "진행 중"인지 판단한다.
 * tickets 를 넘기면 section 단위 구매 가능 여부로 정확히 계산하고,
 * tickets 가 없으면 판매 기간·잔여 수량으로 근사 계산한다.
 */
export function isRoundActiveNow(
  round: EventRound,
  event: EventSummary,
  tickets?: TicketDetail[] | null,
  nowMs = Date.now(),
): boolean {
  if (normalized(event.status) !== 'PUBLISHED') return false;
  const rms = getRoundMs(round, event);
  if (isRoundEnded(rms, nowMs)) return false;

  if (tickets != null) {
    const roundTickets = tickets.filter(
      (t) => t.eventRoundId != null && String(t.eventRoundId) === String(round.id),
    );
    const bySection = new Map<string, TicketDetail[]>();
    roundTickets.forEach((t) => {
      const key = t.sectionName ?? 'default';
      bySection.set(key, [...(bySection.get(key) ?? []), t]);
    });
    if (bySection.size === 0) return false;
    return [...bySection.values()].some((st) => sectionCanBuy(st, event, round, nowMs));
  }

  // tickets 없을 때 근사: 판매 기간 활성 + 이벤트 잔여 티켓 있음
  return (
    isSaleStarted(rms, nowMs) &&
    !isSaleEnded(rms, nowMs) &&
    Number(event.remainingTicketCount ?? 0) > 0
  );
}

// ── 4. 이벤트 목록 노출 여부 ───────────────────────────────────────────────

/** PUBLISHED + 진행 중 회차가 하나 이상 있으면 true */
export function isEventListedNow(
  event: EventSummary,
  tickets?: TicketDetail[] | null,
  nowMs = Date.now(),
): boolean {
  if (normalized(event.status) !== 'PUBLISHED') return false;
  const rounds = event.rounds ?? [];
  if (rounds.length === 0) return false;
  return rounds.some((r) => isRoundActiveNow(r, event, tickets, nowMs));
}

// ── 5. 구매한 티켓 사용 가능 여부 ─────────────────────────────────────────

export function myTicketUsable(
  ticket?: TicketDetail | null,
  event?: EventSummary | null,
  round?: EventRound | null,
  nowMs = Date.now(),
): boolean {
  if (!ticket || !event) return false;
  if (normalized(ticket.status) !== 'SOLD') return false;
  if (normalized(event.status) !== 'PUBLISHED') return false;
  const rms = getRoundMs(round, event);
  return isCheckInOpen(rms, nowMs) && !isRoundEnded(rms, nowMs);
}

export type UseBlockReason =
  | 'used' | 'cancelled' | 'event_cancelled' | 'event_not_published'
  | 'listed' | 'round_ended' | 'before_checkin' | 'ticket_not_sold' | 'unknown';

const USE_BLOCK_LABEL: Record<UseBlockReason, string> = {
  used:                '사용 완료',
  cancelled:           '취소됨',
  event_cancelled:     '이벤트 취소',
  event_not_published: '사용 불가',
  listed:              '리셀 중',
  round_ended:         '사용 기간 종료',
  before_checkin:      '사용 전',
  ticket_not_sold:     '사용 불가',
  unknown:             '상태 확인 필요',
};

/** myTicketUsable === false 일 때 사유 반환. 사용 가능하면 null */
export function myTicketUseBlockReason(
  ticket?: TicketDetail | null,
  event?: EventSummary | null,
  round?: EventRound | null,
  nowMs = Date.now(),
): UseBlockReason | null {
  if (!ticket || !event) return 'unknown';
  if (myTicketUsable(ticket, event, round, nowMs)) return null;
  const ticketStatus = normalized(ticket.status);
  if (ticketStatus === 'USED')      return 'used';
  if (ticketStatus === 'CANCELLED') return 'cancelled';
  const evtStatus = normalized(event.status);
  if (evtStatus === 'CANCELLED') return 'event_cancelled';
  if (evtStatus !== 'PUBLISHED') return 'event_not_published';
  if (ticketStatus === 'LISTED')    return 'listed';
  const rms = getRoundMs(round, event);
  if (isRoundEnded(rms, nowMs))    return 'round_ended';
  if (!isCheckInOpen(rms, nowMs))  return 'before_checkin';
  if (ticketStatus !== 'SOLD')     return 'ticket_not_sold';
  return 'unknown';
}

export function myTicketUseBlockLabel(reason?: UseBlockReason | null): string | null {
  if (!reason) return null;
  return USE_BLOCK_LABEL[reason] ?? '상태 확인 필요';
}

// ── 6. 리셀 상태 ──────────────────────────────────────────────────────────

export type ResaleState = 'active' | 'completed' | 'hidden';

export function resaleListingState(
  listing: { status?: string | null },
  ticket: TicketDetail,
  event: EventSummary,
  round?: EventRound | null,
  nowMs = Date.now(),
): ResaleState {
  const listingStatus = normalized(listing.status);
  if (listingStatus === 'SOLD') return 'completed';
  if (normalized(event.status) !== 'PUBLISHED') return 'hidden';
  if (listingStatus === 'CLOSED' || listingStatus === 'CANCELED') return 'hidden';
  if (normalized(ticket.status) !== 'LISTED') return 'hidden';
  const rms = getRoundMs(round, event);
  if (isRoundStarted(rms, nowMs) || isRoundEnded(rms, nowMs)) return 'hidden';
  if (Number.isNaN(rms.roundStartMs) && Number.isNaN(rms.roundEndMs)) return 'hidden';
  if (listingStatus === 'ACTIVE') return 'active';
  return 'hidden';
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

export function weiToEthValue(wei?: string | number | null): string {
  if (wei === undefined || wei === null || wei === '') return '';
  try {
    const value = BigInt(String(wei));
    const whole = value / 1_000_000_000_000_000_000n;
    const fraction = String(value % 1_000_000_000_000_000_000n).padStart(18, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : `${whole}`;
  } catch {
    return '';
  }
}

export function ethToWei(ethValue: string): string {
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
