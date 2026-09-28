// 看板顶部的「近 7 天」面板：日程、投递截止，以及过了时间还没更新的事项
import * as actions from '../actions.js';
import { roundLabel } from '../model/application.js';
import { h } from '../ui/dom.js';
import { fmtDate, fmtDateTime, weekday } from '../utils/format.js';
import { openDetail } from './detail.js';

const companyOf = (app) => app.company || '未命名公司';

export function renderAgenda(agenda, { collapsed, onToggle }) {
  const { days, overdue, missed, todayCount, upcomingCount, attentionCount } = agenda;
  const header = h(
    'header',
    { class: 'agenda-header' },
    h('h2', null, '近 7 天'),
    h('span', { class: 'agenda-summary' }, `今天 ${todayCount} 项 · 7 天内 ${upcomingCount} 项`),
    attentionCount > 0 && h('span', { class: 'agenda-warn' }, `${attentionCount} 项待更新`),
    h(
      'button',
      { type: 'button', class: 'icon-btn', title: collapsed ? '展开' : '折叠', 'aria-expanded': String(!collapsed), onclick: onToggle },
      collapsed ? '▸' : '▾',
    ),
  );
  if (collapsed) return h('section', { class: 'agenda collapsed' }, header);

  return h(
    'section',
    { class: 'agenda' },
    header,
    attentionCount > 0 && renderAttention(overdue, missed),
    upcomingCount > 0
      ? h('div', { class: 'agenda-days' }, days.map(renderDay))
      : h('p', { class: 'agenda-empty' }, '接下来 7 天没有笔试、面试或投递截止。给轮次填上时间、给待投递的岗位填上截止日，就会出现在这里。'),
  );
}

function renderDay(day, index) {
  const label = ['今天', '明天'][index] ?? weekday(day.date);
  return h(
    'div',
    { class: ['agenda-day', index === 0 && 'today'] },
    h('div', { class: 'agenda-day-head' }, h('b', null, label), h('span', null, fmtDate(day.date))),
    day.items.length ? h('ul', { class: 'agenda-items' }, day.items.map(renderItem)) : h('div', { class: 'agenda-none' }, '—'),
  );
}

function renderItem(item) {
  const { app } = item;
  if (item.kind === 'deadline') {
    const position = app.position || '未填写岗位';
    return h(
      'li',
      null,
      h(
        'button',
        { type: 'button', class: 'agenda-item is-deadline', title: `${companyOf(app)} · ${position}：投递截止`, onclick: () => openDetail(app.id) },
        h('span', { class: 'agenda-time' }, '截止'),
        h('span', { class: 'agenda-text' }, `${companyOf(app)} · ${position}`),
      ),
    );
  }
  const { round } = item;
  return h(
    'li',
    null,
    h(
      'button',
      {
        type: 'button',
        class: ['agenda-item', `col-${round.column}`],
        title: [companyOf(app), app.position, roundLabel(round)].filter(Boolean).join(' · '),
        onclick: () => openDetail(app.id, { roundId: round.id }),
      },
      h('span', { class: 'agenda-time' }, round.scheduledAt.slice(11, 16)),
      h('span', { class: 'agenda-text' }, `${companyOf(app)} · ${roundLabel(round)}`),
    ),
  );
}

// 过了时间的轮次直接在这里补结果；过了截止还没投的岗位直接处理掉
function renderAttention(overdue, missed) {
  const quick = (label, onclick) => h('button', { type: 'button', class: 'btn btn-small', onclick }, label);
  const link = (text, onclick) => h('button', { type: 'button', class: 'attention-link', onclick }, text);

  return h(
    'div',
    { class: 'agenda-attention' },
    overdue.map(({ app, round }) =>
      h(
        'div',
        { class: 'attention-item' },
        link(`${companyOf(app)} · ${roundLabel(round)}`, () => openDetail(app.id, { roundId: round.id })),
        h('span', { class: 'attention-meta' }, `${fmtDateTime(round.scheduledAt)} 已过，结果如何？`),
        quick('待结果', () => actions.setRoundStatus(app.id, round.id, 'awaiting')),
        quick('通过', () => actions.setRoundStatus(app.id, round.id, 'passed')),
        quick('未通过', () => actions.setRoundStatus(app.id, round.id, 'failed')),
      ),
    ),
    missed.map(({ app }) =>
      h(
        'div',
        { class: 'attention-item' },
        link(`${companyOf(app)} · ${app.position || '未填写岗位'}`, () => openDetail(app.id)),
        h('span', { class: 'attention-meta' }, `${fmtDate(app.deadline)} 已截止，还在待投递`),
        quick('其实投了', () => actions.markApplied(app.id)),
        quick('放弃', () => actions.closeApp(app.id, 'withdrawn')),
      ),
    ),
  );
}
