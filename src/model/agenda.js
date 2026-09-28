import { addDays, localDateTime, today } from '../utils/format.js';

export const AGENDA_DAYS = 7;

// 还没出结果、需要按时参加的轮次
const UPCOMING = new Set(['pending', 'scheduled']);

// 从今天起 7 天的日程和截止，以及已经过点却还没更新的事项。已结束的投递不参与
export function buildAgenda(apps, now = new Date()) {
  const todayKey = today(now);
  const nowKey = localDateTime(now);
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => ({ date: addDays(todayKey, i), items: [] }));
  const lastKey = days.at(-1).date;
  const dayOf = (dateKey) => days.find((d) => d.date === dateKey);
  const overdue = []; // 时间已过，但轮次还是「待安排 / 已约」
  const missed = []; // 截止日已过，但还在「待投递」

  for (const app of apps) {
    if (app.phase === 'closed') continue;
    if (app.phase === 'todo' && app.deadline) {
      if (app.deadline < todayKey) missed.push({ kind: 'deadline', app });
      else if (app.deadline <= lastKey) dayOf(app.deadline).items.push({ kind: 'deadline', app });
    }
    for (const round of app.rounds) {
      if (!round.scheduledAt || !UPCOMING.has(round.status)) continue;
      if (round.scheduledAt < nowKey) overdue.push({ kind: 'round', app, round });
      else if (round.scheduledAt.slice(0, 10) <= lastKey) dayOf(round.scheduledAt.slice(0, 10)).items.push({ kind: 'round', app, round });
    }
  }

  // 同一天里截止排在前面，轮次按时间排
  const timeOf = (item) => (item.kind === 'deadline' ? '' : item.round.scheduledAt);
  for (const day of days) day.items.sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
  overdue.sort((a, b) => a.round.scheduledAt.localeCompare(b.round.scheduledAt));
  missed.sort((a, b) => a.app.deadline.localeCompare(b.app.deadline));

  const upcomingCount = days.reduce((n, d) => n + d.items.length, 0);
  return { days, overdue, missed, todayCount: days[0].items.length, upcomingCount, attentionCount: overdue.length + missed.length };
}
