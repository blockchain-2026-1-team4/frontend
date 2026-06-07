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

export function scheduleStateLabel(schedule: EntrySchedule) {
  const state = scheduleState(schedule);
  return state === 'today' ? '오늘' : state === 'ended' ? '종료' : '예정';
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

