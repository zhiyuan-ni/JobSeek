// 内存中的唯一数据源。commit 同步修改并通知视图，然后在后台整体写回 data/db.json
import * as api from './api.js';
import { normalizeDb } from './model/db.js';
import { toast } from './ui/dialogs.js';

let state = null;
let rev = 0;
let saving = false;
let dirty = false;
const listeners = new Set();

export const getState = () => state;
export const isSaving = () => saving || dirty;
export const findApp = (id) => state.applications.find((a) => a.id === id);
export const findResume = (id) => state.resumes.find((r) => r.id === id);
export const findTemplate = (id) => state.templates.find((t) => t.id === id);

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of [...listeners]) fn(state);
}

function load(raw) {
  const { rev: r = 0, ...data } = raw;
  rev = r;
  const { db, changed } = normalizeDb(data);
  state = db;
  return changed;
}

export async function init() {
  if (load(await api.loadDb())) persist();
}

// 切回标签页时拉一次最新数据，减少多标签页之间的冲突
export async function refresh() {
  if (saving || dirty) return;
  const raw = await api.loadDb();
  if ((raw.rev ?? 0) === rev || saving || dirty) return;
  load(raw);
  notify();
}

export function commit(mutate) {
  mutate(state);
  notify();
  persist();
}

// 保存串行进行；保存期间的新改动合并成下一次写入
async function persist() {
  dirty = true;
  if (saving) return;
  saving = true;
  try {
    while (dirty) {
      dirty = false;
      ({ rev } = await api.saveDb(state, rev));
    }
  } catch (err) {
    dirty = false;
    if (err instanceof api.ConflictError) {
      load(err.current);
      // 让重绘直接显示最新数据，而不是保留输入框里的旧内容
      document.activeElement?.blur();
      notify();
      toast('数据在另一个标签页里改过，已加载最新版本，刚才的改动需要重做', 'error');
    } else {
      toast(`保存失败：${err.message}`, 'error');
    }
  } finally {
    saving = false;
  }
}
