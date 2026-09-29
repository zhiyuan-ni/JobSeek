import * as actions from '../actions.js';
import * as store from '../store.js';
import { buildAgenda } from '../model/agenda.js';
import { currentRound, reachedIndex, roundLabel, staleDays } from '../model/application.js';
import {
  CATEGORIES,
  COLUMNS,
  OUTCOMES,
  PRIORITIES,
  ROUND_STATUSES,
  STALE_DAYS,
  WISHES,
  columnIndex,
  nameOf,
} from '../model/constants.js';
import { h, options, patchChildren, selectEl } from '../ui/dom.js';
import { daysUntil, fmtDate, fmtDateTime, hoursUntil } from '../utils/format.js';
import { renderAgenda } from './agenda.js';
import { openDetail, openedId } from './detail.js';
import { openNewAppModal } from './newApp.js';

const FILTER_KEY = 'jobseek.boardFilters';
const DRAG_TYPE = 'application/x-jobseek-app';
const DEFAULT_FILTERS = { q: '', category: '', priority: '', resumeId: '', collapseClosed: false, collapseAgenda: false, staleOnly: false };

function loadFilters() {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}'), staleOnly: false };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

// 「只看没动静」是临时的排查模式，不记住，免得下次打开看板只剩几张卡片
function saveFilters({ staleOnly, ...filters }) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
  } catch {}
}

export function mountBoard(root) {
  const filters = loadFilters();
  const stats = h('div', { class: 'stats' });
  const agenda = h('div', { class: 'agenda-slot' });
  const board = h('div', { class: 'board' });

  const setFilter = (patch) => {
    Object.assign(filters, patch);
    saveFilters(filters);
    render();
  };

  function render() {
    const all = store.getState().applications;
    const apps = all.filter((a) => matches(a, filters));
    patchChildren(stats, renderStats(apps, filters, setFilter));
    // 提醒不受筛选影响，免得筛掉了就漏看
    patchChildren(
      agenda,
      renderAgenda(buildAgenda(all), {
        collapsed: filters.collapseAgenda,
        onToggle: () => setFilter({ collapseAgenda: !filters.collapseAgenda }),
      }),
    );
    patchChildren(
      board,
      COLUMNS.map((col) => renderColumn(col, apps.filter((a) => a.phase === col.id), filters, setFilter)),
    );
  }

  root.replaceChildren(renderToolbar(filters, setFilter), stats, agenda, board);
  render();

  // 时间在走：每分钟重算日程和「48 小时内」高亮；正在拖卡片时跳过，免得打断
  const timer = setInterval(() => {
    if (!document.querySelector('.card.dragging')) render();
  }, 60_000);
  const unsubscribe = store.subscribe(render);
  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}

function matches(app, f) {
  if (f.category && app.category !== f.category) return false;
  if (f.priority && app.priority !== Number(f.priority)) return false;
  if (f.resumeId && app.resumeId !== f.resumeId) return false;
  if (f.staleOnly && staleDays(app) == null) return false;
  const q = f.q.trim().toLowerCase();
  if (!q) return true;
  return [app.company, app.position, app.notes, app.cities.join(' '), ...app.rounds.map((r) => r.note)].some((t) =>
    t?.toLowerCase().includes(q),
  );
}

function renderToolbar(filters, setFilter) {
  const { resumes } = store.getState();
  if (filters.resumeId && !resumes.some((r) => r.id === filters.resumeId)) filters.resumeId = '';
  const priorityOpts = PRIORITIES.map((p) => ({ id: p.id, name: `意向：${p.name}` }));

  return h(
    'div',
    { class: 'toolbar' },
    h('input', {
      type: 'search',
      class: 'search',
      placeholder: '搜索公司、岗位、备注…',
      value: filters.q,
      oninput: (e) => setFilter({ q: e.target.value }),
    }),
    selectEl(options(CATEGORIES, { empty: '全部类别' }), filters.category, {
      onchange: (e) => setFilter({ category: e.target.value }),
    }),
    selectEl(options(priorityOpts, { empty: '全部意向' }), filters.priority, {
      onchange: (e) => setFilter({ priority: e.target.value }),
    }),
    resumes.length > 0 &&
      selectEl(options(resumes, { empty: '全部简历版本' }), filters.resumeId, {
        onchange: (e) => setFilter({ resumeId: e.target.value }),
      }),
    h('div', { class: 'spacer' }),
    h('button', { type: 'button', class: 'btn btn-primary', onclick: openNewAppModal }, '+ 新建投递'),
  );
}

function renderStats(apps, filters, setFilter) {
  const reached = apps.map(reachedIndex);
  const atLeast = (col) => reached.filter((i) => i >= columnIndex(col)).length;
  const applied = atLeast('applied');
  const interviewed = atLeast('interview');
  const offers = atLeast('offer');
  const active = apps.filter((a) => ['applied', 'test', 'interview'].includes(a.phase)).length;
  const rate = (n) => (applied ? `${Math.round((n / applied) * 100)}%` : '—');

  const stat = (label, value, hint) =>
    h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label), hint && h('span', { class: 'stat-hint' }, hint));
  return [
    stat('总计', apps.length),
    stat('已投递', applied),
    stat('进行中', active),
    stat('进入面试', interviewed, rate(interviewed)),
    stat('Offer', offers, rate(offers)),
    renderStaleToggle(apps.filter((a) => staleDays(a) != null).length, filters, setFilter),
  ];
}

function renderStaleToggle(count, filters, setFilter) {
  const on = filters.staleOnly;
  const limits = COLUMNS.filter((c) => STALE_DAYS[c.id])
    .map((c) => `${c.name} ${STALE_DAYS[c.id]} 天`)
    .join('、');
  return h(
    'button',
    {
      type: 'button',
      class: ['stat', 'stat-toggle', count > 0 && 'stat-warn', on && 'active'],
      'aria-pressed': String(on),
      title: on ? '显示全部投递' : `只看很久没有进展的投递（${limits}）`,
      onclick: () => setFilter({ staleOnly: !on }),
    },
    h('span', { class: 'stat-value' }, count),
    h('span', { class: 'stat-label' }, '没动静'),
    on && h('span', { class: 'stat-hint' }, '只看这些 ✕'),
  );
}

function renderColumn(col, apps, filters, setFilter) {
  const collapsed = col.id === 'closed' && filters.collapseClosed;
  const empty = col.id === 'todo' ? '点右上角「新建投递」' : '把卡片拖到这里';

  const section = h(
    'section',
    { class: ['column', `col-${col.id}`, collapsed && 'collapsed'], dataset: { col: col.id } },
    h(
      'header',
      { class: 'column-header' },
      h('span', { class: 'column-dot' }),
      h('h2', null, col.name),
      h('span', { class: 'column-count' }, apps.length),
      col.id === 'closed' &&
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            title: collapsed ? '展开' : '折叠',
            onclick: () => setFilter({ collapseClosed: !collapsed }),
          },
          collapsed ? '▸' : '▾',
        ),
    ),
    !collapsed &&
      h(
        'div',
        { class: 'column-body' },
        sortApps(col.id, apps).map(renderCard),
        !apps.length && h('div', { class: 'column-empty' }, empty),
      ),
  );

  section.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    section.classList.add('drop-over');
  });
  section.addEventListener('dragleave', (e) => {
    if (!section.contains(e.relatedTarget)) section.classList.remove('drop-over');
  });
  section.addEventListener('drop', (e) => {
    section.classList.remove('drop-over');
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    actions.moveToColumn(id, col.id);
  });
  return section;
}

// 待投递按截止日排；进行中的按下一场的时间排；已结束按最近更新排
function sortApps(colId, apps) {
  const byPriority = (a, b) => b.priority - a.priority;
  const byUpdated = (a, b) => b.updatedAt.localeCompare(a.updatedAt);
  const nullsLast = (x, y) => (x ? (y ? x.localeCompare(y) : -1) : y ? 1 : 0);
  const upcoming = (app) => {
    const r = currentRound(app);
    return r?.status === 'scheduled' ? r.scheduledAt : '';
  };
  const list = [...apps];
  if (colId === 'closed') return list.sort(byUpdated);
  if (colId === 'todo') return list.sort((a, b) => nullsLast(a.deadline, b.deadline) || byPriority(a, b) || byUpdated(a, b));
  return list.sort((a, b) => nullsLast(upcoming(a), upcoming(b)) || byPriority(a, b) || byUpdated(a, b));
}

function renderCard(app) {
  const round = currentRound(app);
  const resume = app.resumeId ? store.findResume(app.resumeId) : null;
  const sub = [app.position, app.cities.join('/')].filter(Boolean).join(' · ');

  return h(
    'article',
    {
      class: ['card', openedId() === app.id && 'selected'],
      draggable: 'true',
      tabindex: '0',
      dataset: { id: app.id },
      onclick: () => openDetail(app.id),
      onkeydown: (e) => {
        if (e.key === 'Enter') openDetail(app.id);
      },
      ondragstart: (e) => {
        e.dataTransfer.setData(DRAG_TYPE, app.id);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging');
      },
      ondragend: (e) => e.currentTarget.classList.remove('dragging'),
    },
    h(
      'div',
      { class: 'card-title' },
      h('span', { class: 'card-company' }, app.company || '未命名公司'),
      app.priority === 3 && h('span', { class: 'card-star', title: '意向度：高' }, '★'),
    ),
    sub && h('div', { class: 'card-sub' }, sub),
    round && app.phase !== 'todo' && renderRoundLine(round),
    renderTags(app, resume),
  );
}

function renderRoundLine(round) {
  const scheduled = round.status === 'scheduled' && round.scheduledAt;
  const hours = scheduled ? hoursUntil(round.scheduledAt) : NaN;
  let text = `${roundLabel(round)} · ${scheduled ? fmtDateTime(round.scheduledAt) : nameOf(ROUND_STATUSES, round.status)}`;
  if (hours < 0) text += ' · 待更新';
  // 卡片窄，放不下就省略，完整内容放在悬停提示里
  return h(
    'div',
    { class: ['card-round', `s-${round.status}`, hours >= 0 && hours <= 48 && 'soon', hours < 0 && 'overdue'], title: text },
    h('span', { class: 'status-dot' }),
    h('span', { class: 'card-round-text' }, text),
  );
}

function renderTags(app, resume) {
  const tags = [];
  if (app.phase === 'todo' && app.deadline) {
    const days = daysUntil(app.deadline);
    const label = days < 0 ? `已截止 ${fmtDate(app.deadline)}` : days === 0 ? '今天截止' : `截止 ${fmtDate(app.deadline)}`;
    tags.push(h('span', { class: ['tag', days < 0 ? 'tag-expired' : days <= 3 && 'tag-danger'] }, label));
  }
  if (app.phase === 'closed' && app.outcome) {
    tags.push(h('span', { class: ['tag', `tag-outcome-${app.outcome}`] }, nameOf(OUTCOMES, app.outcome)));
  }
  const stale = staleDays(app);
  if (stale != null) {
    const title = `${nameOf(COLUMNS, app.phase)}阶段已经 ${stale} 天没有进展（超过 ${STALE_DAYS[app.phase]} 天就会标出来）`;
    tags.push(h('span', { class: 'tag tag-stale', title }, `${stale} 天没动静`));
  }
  if (app.wish) tags.push(h('span', { class: 'tag' }, nameOf(WISHES, app.wish)));
  if (resume) tags.push(h('span', { class: 'tag tag-resume', title: '简历版本' }, resume.name));
  if (app.jdFile) tags.push(h('span', { class: 'tag', title: '已上传 JD' }, 'JD'));
  return tags.length ? h('div', { class: 'card-tags' }, tags) : null;
}
