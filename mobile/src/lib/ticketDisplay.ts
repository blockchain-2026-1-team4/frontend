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
  // 1. CANCELLED
  if (status === 'CANCELLED') return { label: '취소', tone: 'red' };
  // 2. DRAFT
  if (status === 'DRAFT') return { label: '초안', tone: 'gray' };
  // 3. INACTIVE
  if (status === 'INACTIVE') return { label: '비공개', tone: 'purple' };

  // PUBLISHED only from here
  const current = now.getTime();
  const total = Number(event.totalTicketCount ?? 0);
  const remaining = Number(event.remainingTicketCount ?? 0);
  const sold = Number(event.soldTicketCount ?? 0);
  const issued = total > 0 ? total - remaining : sold;

  type RoundInfo = { startMs: number; endMs: number; saleStartMs: number; saleEndMs: number };
  const rounds: RoundInfo[] = event.rounds?.length
    ? event.rounds.map((r) => ({
        startMs: roundStartAt(r),
        endMs: roundEndAt(r),
        saleStartMs: timeOf(r.saleStartAt || event.primarySaleStart || event.salesStartAt),
        saleEndMs: timeOf(r.saleEndAt || event.primarySaleEnd || event.salesEndAt),
      }))
    : [{
        startMs: timeOf(event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime),
        endMs: timeOf(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime),
        saleStartMs: timeOf(event.primarySaleStart || event.salesStartAt),
        saleEndMs: timeOf(event.primarySaleEnd || event.salesEndAt),
      }];

  // 4. 모든 회차 종료
  const datedRounds = rounds.filter((r) => !Number.isNaN(r.endMs));
  if (datedRounds.length > 0 && datedRounds.every((r) => current >= r.endMs)) {
    return { label: '종료', tone: 'gray' };
  }

  // 5. 발행 티켓 없음
  if (issued <= 0) return { label: '티켓 미발행', tone: 'gray' };

  // 6. 현재 진행 중인 회차 있음 (시작 후 + 미종료)
  const hasOngoing = rounds.some(
    (r) => !Number.isNaN(r.startMs) && current >= r.startMs && (Number.isNaN(r.endMs) || current < r.endMs),
  );
  if (hasOngoing) return { label: '개최중', tone: 'green' };

  // 7. 판매기간 내 + 잔여 티켓 있음
  const hasSaleActive = rounds.some((r) => {
    const notEnded = Number.isNaN(r.endMs) || current < r.endMs;
    const saleStarted = Number.isNaN(r.saleStartMs) || current >= r.saleStartMs;
    const saleNotEnded = Number.isNaN(r.saleEndMs) || current <= r.saleEndMs;
    return notEnded && saleStarted && saleNotEnded;
  });
  if (hasSaleActive && remaining > 0) return { label: '판매 중', tone: 'green' };

  // 8. 판매 시작 전인 회차 있음
  const hasPreSale = rounds.some(
    (r) => (Number.isNaN(r.endMs) || current < r.endMs) && !Number.isNaN(r.saleStartMs) && current < r.saleStartMs,
  );
  if (hasPreSale) return { label: '판매 예정', tone: 'yellow' };

  // 9. 발행 티켓 있음 + 잔여 티켓 없음
  if (issued > 0 && remaining === 0) return { label: '매진', tone: 'red' };

  // 10. 판매 종료 + 아직 시작 전인 회차 있음
  const hasSaleEndedFutureRound = rounds.some(
    (r) => (Number.isNaN(r.startMs) || current < r.startMs) && !Number.isNaN(r.saleEndMs) && current >= r.saleEndMs,
  );
  if (hasSaleEndedFutureRound) return { label: '판매 종료', tone: 'gray' };

  // 11. 그 외
  return { label: '운영 중', tone: 'green' };
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

// 사용자 화면 전용 상태 해석: 숨김(null) 또는 사용자용 라벨/톤 반환
// tickets를 제공하면 회차별 실제 발행/잔여 수량으로 정확히 계산한다.
// tickets가 없으면 event 집계값(이벤트 수준)으로 근사 계산한다.
export function getUserEventDisplayStatus(
  event?: EventSummary | null,
  tickets?: TicketDetail[] | null,
  now = new Date(),
): DisplayStatus | null {
  if (!event) return null;
  if (normalized(event.status) !== 'PUBLISHED') return null;

  const current = now.getTime();
  const rounds = event.rounds ?? [];

  type RoundTimes = { endTime: number; saleStart: number; saleEnd: number };
  const roundTimeList: RoundTimes[] = rounds.length
    ? rounds.map((r) => ({
        endTime: r.eventDate && r.endTime ? timeOf(`${r.eventDate}T${r.endTime}Z`) : timeOf(r.eventDate),
        saleStart: timeOf(r.saleStartAt || event.primarySaleStart || event.salesStartAt),
        saleEnd: timeOf(r.saleEndAt || event.primarySaleEnd || event.salesEndAt),
      }))
    : [{
        endTime: timeOf(event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime),
        saleStart: timeOf(event.primarySaleStart || event.salesStartAt),
        saleEnd: timeOf(event.primarySaleEnd || event.salesEndAt),
      }];

  type RoundPhase = 'ended' | 'pre_sale' | 'on_sale' | 'sale_ended' | 'no_date';
  const classify = ({ endTime, saleStart, saleEnd }: RoundTimes): RoundPhase => {
    if (!Number.isNaN(endTime) && current > endTime) return 'ended';
    if (!Number.isNaN(saleStart) && current < saleStart) return 'pre_sale';
    if (!Number.isNaN(saleEnd) && current > saleEnd) return 'sale_ended';
    if (!Number.isNaN(saleStart) || !Number.isNaN(saleEnd)) return 'on_sale';
    return 'no_date';
  };

  const allPhases = roundTimeList.map(classify);
  const futurePhases = allPhases.filter((p) => p !== 'ended');

  // 모든 회차 종료 → 숨김
  if (futurePhases.length === 0) return null;

  if (tickets != null) {
    // ── 회차별 실제 티켓 매칭 경로 ──────────────────────────────────
    // rounds가 없으면 이벤트 단일 회차로 처리 (null → matchTicketsToRound가 allTickets 반환)
    const roundList: (typeof rounds[number] | null)[] = rounds.length ? rounds : [null];
    const roundInfos = roundList.map((r, i) => {
      const phase = allPhases[i] ?? 'no_date';
      if (phase === 'ended') return { phase, issued: 0, available: 0 };
      const matched = matchTicketsToRound(r, tickets);
      // 매칭 실패(null) = 회차 ID·날짜 없음 → 티켓 미발행으로 간주
      const issued = matched?.length ?? 0;
      const available = matched?.filter((t) => normalized(t.status) === 'AVAILABLE').length ?? 0;
      return { phase, issued, available };
    });

    const futureInfos = roundInfos.filter(({ phase }) => phase !== 'ended');

    // 모든 미래 회차에 발행 티켓이 없음 → 판매 준비중
    if (futureInfos.every(({ issued }) => issued === 0)) return { label: '판매 준비중', tone: 'gray' };

    // 예매 가능: on_sale 회차 + 해당 회차 available > 0
    if (futureInfos.some(({ phase, issued, available }) => phase === 'on_sale' && issued > 0 && available > 0)) {
      return { label: '예매 가능', tone: 'blue' };
    }
    // 오픈 예정: pre_sale 회차 + 해당 회차 available > 0
    if (futureInfos.some(({ phase, issued, available }) => phase === 'pre_sale' && issued > 0 && available > 0)) {
      return { label: '오픈 예정', tone: 'yellow' };
    }
    // 매진: 판매 기간 회차는 있으나 available = 0 (티켓은 발행됐지만 소진)
    if (futureInfos.some(({ phase, issued, available }) => (phase === 'on_sale' || phase === 'pre_sale') && issued > 0 && available === 0)) {
      return { label: '매진', tone: 'red' };
    }
    // 예매 종료
    if (futureInfos.every(({ phase }) => phase === 'sale_ended')) return { label: '예매 종료', tone: 'gray' };
    // 그 외 (no_date 등)
    return { label: '판매 준비중', tone: 'gray' };
  }

  // ── 이벤트 집계값 경로 (tickets 미제공 시) ──────────────────────────
  // 티켓 API 없이 목록 페이지 등에서 호출될 때 사용. 회차별 세분화 불가로 근사 결과.
  const total = Number(event.totalTicketCount ?? 0);
  const remaining = Number(event.remainingTicketCount ?? 0);
  const sold = Number(event.soldTicketCount ?? 0);
  const issued = total > 0 ? total - remaining : sold;

  if (issued <= 0) return { label: '판매 준비중', tone: 'gray' };

  const isSoldOut = Boolean(event.soldOut) || (remaining === 0 && issued > 0);
  const hasOnSale  = futurePhases.some((p) => p === 'on_sale');
  const hasPreSale = futurePhases.some((p) => p === 'pre_sale');

  if (hasOnSale && !isSoldOut) return { label: '예매 가능', tone: 'blue' };
  if (hasPreSale && !isSoldOut) return { label: '오픈 예정', tone: 'yellow' };
  if ((hasOnSale || hasPreSale) && isSoldOut) return { label: '매진', tone: 'red' };
  if (futurePhases.every((p) => p === 'sale_ended')) return { label: '예매 종료', tone: 'gray' };
  if (futurePhases.every((p) => p === 'no_date')) return { label: '판매 준비중', tone: 'gray' };
  return null;
}

// 사용자 화면 정렬 우선순위: 낮을수록 앞에 노출
export function userSortRank(event?: EventSummary | null, now = new Date()): number {
  if (!event) return 99;
  const userStatus = getUserEventDisplayStatus(event, undefined, now);
  // null은 비공개/초안/취소 등 사용자에겐 보이지 않음 → 매우 뒤로
  if (userStatus === null) return 99;
  const label = userStatus.label;
  const ranks: Record<string, number> = {
    '예매 가능':  0,
    '오픈 예정':  1,
    '매진':       2,
    '예매 종료':  3,
    '판매 준비중': 4,
  };
  return ranks[label] ?? 5;
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
  if (base.label === '취소' || base.label === '개최중' || base.label === '종료') return base;

  const issued = tickets.length || Number(event.totalTicketCount ?? 0) - Number(event.remainingTicketCount ?? 0);
  const total = Number(event.totalTicketCount ?? 0);
  if (issued <= 0) return { label: '티켓 미발행', tone: 'gray' };
  if (total > 0 && issued >= total) return { label: '발행 완료', tone: 'green' };
  return { label: '일부 발행', tone: 'yellow' };
}

const CHECK_IN_OPEN_MINUTES = 30;

// event 파라미터가 있으면 이벤트 타이밍을 고려해 상태를 세분화한다.
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

export function eventDisplaySortRank(event?: EventSummary | null, now = new Date()) {
  const status = getEventDisplayStatus(event, now).label;
  const ranks: Record<string, number> = {
    '개최중':      0,
    '판매 중':     1,
    '판매 예정':   2,
    '매진':        3,
    '판매 종료':   4,
    '운영 중':     5,
    '티켓 미발행': 6,
    '종료':        7,
    '비공개':      8,
    '초안':        9,
    '취소':        10,
  };
  return ranks[status] ?? 5;
}

export function operationSortRank(event?: EventSummary | null, now = new Date()) {
  const status = getEventDisplayStatus(event, now).label;
  const ranks: Record<string, number> = {
    '개최중':      0,
    '판매 중':     1,
    '판매 예정':   2,
    '매진':        3,
    '판매 종료':   4,
    '운영 중':     5,
    '티켓 미발행': 6,
    '종료':        7,
    '비공개':      8,
    '초안':        9,
    '취소':        10,
  };
  return ranks[status] ?? 5;
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
