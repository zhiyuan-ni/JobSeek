import { COLUMNS, ROUND_TYPES, columnIndex } from './constants.js';
import { today } from '../utils/format.js';

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export const roundType = (id) => ROUND_TYPES.find((t) => t.id === id) ?? ROUND_TYPES.at(-1);
export const roundLabel = (round) => round.name || roundType(round.type).name;

// 模板里的节点只有 type / name / column
export function templateRound(type) {
  const t = roundType(type);
  return { type: t.id, name: t.column ? t.name : '', column: t.column ?? 'interview' };
}

export function newRound(type = 'custom', overrides = {}) {
  return { id: uid(), ...templateRound(type), status: 'pending', scheduledAt: '', note: '', ...overrides };
}

export function roundsFromTemplate(template) {
  return template.rounds.map(({ type, name, column }) => newRound(type, { name, column }));
}

// 改节点类型：名字还是旧类型的默认名时跟着换，自定义过的名字保留
export function retypeRound(round, type) {
  const prev = roundType(round.type);
  const next = roundType(type);
  if (!round.name || round.name === prev.name) round.name = next.column ? next.name : '';
  round.type = next.id;
  if (next.column) round.column = next.column;
}

export function moveItem(list, index, delta) {
  const j = index + delta;
  if (index < 0 || j < 0 || j >= list.length) return;
  [list[index], list[j]] = [list[j], list[index]];
}

export function newApplication(fields = {}) {
  const t = now();
  return {
    id: uid(),
    company: '',
    position: '',
    category: '',
    priority: 2,
    wish: null,
    cities: [],
    channel: '',
    referralCode: '',
    portalUrl: '',
    jdUrl: '',
    jdFile: null,
    resumeId: null,
    deadline: '',
    appliedAt: '',
    phase: 'todo',
    outcome: null,
    closedFrom: null,
    rounds: [],
    notes: '',
    createdAt: t,
    updatedAt: t,
    ...fields,
  };
}

const PROGRESSED = new Set(['scheduled', 'awaiting', 'passed', 'failed']);
const ADVANCING = new Set(['scheduled', 'awaiting', 'passed']);
const UNRESOLVED = new Set(['pending', 'scheduled', 'awaiting']);

// 当前环节：最后一个有进展的节点；如果它已通过，就取它后面第一个没取消的节点
export function currentRound(app) {
  const { rounds } = app;
  let last = -1;
  rounds.forEach((r, i) => {
    if (PROGRESSED.has(r.status)) last = i;
  });
  if (last === -1) return rounds.find((r) => r.status !== 'cancelled') ?? null;
  if (rounds[last].status === 'passed') {
    return rounds.slice(last + 1).find((r) => r.status !== 'cancelled') ?? rounds[last];
  }
  return rounds[last];
}

// 这条投递走到过的最远一列，用于统计
export function reachedIndex(app) {
  let idx = columnIndex(app.phase === 'closed' ? (app.closedFrom ?? 'todo') : app.phase);
  for (const r of app.rounds) {
    if (PROGRESSED.has(r.status)) idx = Math.max(idx, columnIndex(r.column));
  }
  if (app.appliedAt) idx = Math.max(idx, columnIndex('applied'));
  return idx;
}

// 节点有进展时，卡片自动前移到该节点所属列（只前移，不后退）
export function syncPhaseFromRounds(app) {
  if (app.phase === 'closed') return;
  let idx = columnIndex(app.phase);
  for (const r of app.rounds) {
    if (ADVANCING.has(r.status)) idx = Math.max(idx, columnIndex(r.column));
  }
  if (idx > columnIndex(app.phase)) advanceTo(app, COLUMNS[idx].id);
}

// 手动移动（拖拽或下拉）
export function moveApp(app, column, outcome = null) {
  if (column === 'closed') {
    if (app.phase !== 'closed') app.closedFrom = app.phase;
    app.phase = 'closed';
    app.outcome = outcome;
    return;
  }
  const reopening = app.phase === 'closed';
  app.outcome = null;
  app.closedFrom = null;
  if (!reopening) return advanceTo(app, column);
  app.phase = column;
  fillAppliedAt(app);
}

// 往前移时，更早阶段里还没结果的节点视为已通过；移到「已投递」时网申节点变成待结果
function advanceTo(app, column) {
  const from = columnIndex(app.phase);
  const to = columnIndex(column);
  app.phase = column;
  fillAppliedAt(app);
  if (to <= from) return;
  for (const r of app.rounds) {
    const ci = columnIndex(r.column);
    if (ci < to && UNRESOLVED.has(r.status)) r.status = 'passed';
    else if (column === 'applied' && ci === to && r.status === 'pending') r.status = 'awaiting';
  }
}

function fillAppliedAt(app) {
  if (!app.appliedAt && columnIndex(app.phase) >= columnIndex('applied')) app.appliedAt = today();
}
