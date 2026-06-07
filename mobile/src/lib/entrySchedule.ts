import type { CheckInRecord, EventDetail, EventRound, EventSummary, TicketDetail } from '../types/api';

export type EntryScheduleState = 'today' | 'upcoming' | 'ended';

export type EntrySchedule = {
  event: EventSummary | EventDetail;
  round?: EventRound;
  roundId?: string;
  roundIndex: number;
  tickets: TicketDetail[];
  startTime: number;
  endTime: number;
};

export function eventTitle(event?: EventSummary | EventDetail | null) {
  return event?.name || event?.title || '이벤트';
}

function dateTimeOf(date?: string, time?: string) {
  if (!date) return NaN;
  if (!time) return new Date(date).getTime();
  return new Date(`${date}T${String(time).slice(0, 8)}`).getTime();
}

function eventTime(event: EventSummary | EventDetail, kind: 'start' | 'end') {
  const value = kind === 'start'
    ? event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime
    : event.eventEndAt || event.endsAt || event.eventAt || event.eventDateTime;
  const time = new Date(value || '').getTime();
  return Number.isNaN(time) ? NaN : time;
}

export function buildEntrySchedules(event: EventSummary | EventDetail, tickets: TicketDetail[]): EntrySchedule[] {
  const rounds = event.rounds ?? [];
  if (rounds.length === 0) {
    return [{
      event,
      roundIndex: 0,
      tickets,
      startTime: eventTime(event, 'start'),
      endTime: eventTime(event, 'end'),
    }];
  }

  return rounds.map((round, index) => {
    const roundId = round.id ? String(round.id) : undefined;
    const roundTickets = roundId
      ? tickets.filter((ticket) => ticket.eventRoundId != null && String(ticket.eventRoundId) === roundId)
      : tickets;
    return {
      event,
      round,
      roundId,
      roundIndex: index,
      tickets: roundTickets,
      startTime: dateTimeOf(round.eventDate, round.startTime),
      endTime: dateTimeOf(round.eventDate, round.endTime),
    };
  });
}

export function scheduleKey(schedule: EntrySchedule) {
  return `${schedule.event.id}:${schedule.roundId ?? 'event'}`;
}

export function scheduleTitle(schedule: EntrySchedule) {
  const roundLabel = schedule.round?.title?.trim() || (schedule.event.rounds?.length ? `${schedule.roundIndex + 1}회차` : '');
  return roundLabel ? `${eventTitle(schedule.event)} · ${roundLabel}` : eventTitle(schedule.event);
}

export function scheduleState(schedule: EntrySchedule, now = new Date()): EntryScheduleState {
  const current = now.getTime();
  if (!Number.isNaN(schedule.endTime) && current > schedule.endTime) return 'ended';
  if (!Number.isNaN(schedule.startTime) && new Date(schedule.startTime).toDateString() === now.toDateString()) return 'today';
  return 'upcoming';
}

export type ScheduleStatusBadge = {
  label: string;
  tone: 'green' | 'yellow' | 'gray' | 'red' | 'blue';
};

export function scheduleStatusBadge(schedule: EntrySchedule, now = new Date()): ScheduleStatusBadge {
  const current = now.getTime();
  const eventStatus = String(schedule.event.status ?? '').toUpperCase();

  // 1. event.status = CANCELLED → 취소
  if (eventStatus === 'CANCELLED') return { label: '취소', tone: 'red' };
  // 2. event.status = DRAFT / INACTIVE → 운영 불가
  if (eventStatus === 'DRAFT' || eventStatus === 'INACTIVE') return { label: '운영 불가', tone: 'gray' };
  // 3. 해당 회차의 발행 티켓 수 = 0 → 티켓 미발행
  if (schedule.tickets.length === 0) return { label: '티켓 미발행', tone: 'gray' };
  // 4. 회차 종료 후 → 종료
  if (!Number.isNaN(schedule.endTime) && current > schedule.endTime) return { label: '종료', tone: 'gray' };

  // 5 & 6: 오늘 날짜 회차
  const isToday = !Number.isNaN(schedule.startTime) && new Date(schedule.startTime).toDateString() === now.toDateString();
  if (isToday) {
    // 5. 오늘 날짜 + 시작 전 → 오늘 예정
    if (current < schedule.startTime) return { label: '오늘 예정', tone: 'yellow' };
    // 6. 오늘 날짜 + 시작 후 ~ 종료 전 → 입장 진행중  (step 4에서 종료 케이스 걸러짐)
    return { label: '입장 진행중', tone: 'green' };
  }

  // 7. 미래 날짜 회차 → 예정
  if (!Number.isNaN(schedule.startTime) && current < schedule.startTime) return { label: '예정', tone: 'blue' };
  // 8. 회차 날짜/시간 확인 불가 → 일정 확인 필요
  if (Number.isNaN(schedule.startTime) && Number.isNaN(schedule.endTime)) return { label: '일정 확인 필요', tone: 'gray' };
  // 9. 그 외 → 예정
  return { label: '예정', tone: 'blue' };
}

export function scheduleStateLabel(schedule: EntrySchedule) {
  return scheduleStatusBadge(schedule).label;
}

export function scheduleDateParts(schedule: EntrySchedule) {
  const date = Number.isNaN(schedule.startTime) ? null : new Date(schedule.startTime);
  return {
    month: date ? date.toLocaleString('en-US', { month: 'short' }).toUpperCase() : '--',
    day: date ? String(date.getDate()).padStart(2, '0') : '--',
    time: date ? date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '시간 미정',
    full: date ? date.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '일정 미정',
  };
}

export function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? ticket.contractTokenId ?? '');
}

export function entryTicketStats(tickets: TicketDetail[]) {
  const total = tickets.length;
  const entered = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
  return { total, entered, pending: Math.max(total - entered, 0) };
}

export function checkInResult(record: CheckInRecord) {
  return String(record.result ?? record.status ?? '').toUpperCase();
}

export function zoneOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split(/[-\s]/)[0] || '일반';
}

export function buildZoneStats(tickets: TicketDetail[], records: CheckInRecord[] = []) {
  const failedByTicket = new Map<string, number>();
  records.forEach((record) => {
    if (checkInResult(record) !== 'FAILED') return;
    const id = String(record.ticketId ?? '');
    failedByTicket.set(id, (failedByTicket.get(id) ?? 0) + 1);
  });

  const zones = new Map<string, { name: string; total: number; entered: number; failed: number }>();
  tickets.forEach((ticket) => {
    const name = zoneOf(ticket);
    const current = zones.get(name) ?? { name, total: 0, entered: 0, failed: 0 };
    current.total += 1;
    if (String(ticket.status).toUpperCase() === 'USED') current.entered += 1;
    current.failed += failedByTicket.get(ticketId(ticket)) ?? 0;
    zones.set(name, current);
  });

  return [...zones.values()]
    .map((zone) => ({ ...zone, pending: Math.max(zone.total - zone.entered, 0) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR', { numeric: true }));
}

