import { newApplication, uid } from './application.js';
import { BUILTIN_TEMPLATES } from './templates.js';

export const DB_VERSION = 1;

// 补齐缺失字段；第一次启动时写入内置模板。changed 为 true 表示需要回写
export function normalizeDb(raw) {
  const db = {
    version: DB_VERSION,
    applications: (raw.applications ?? []).map((a) => newApplication(a)),
    resumes: raw.resumes ?? [],
    templates: raw.templates,
  };
  const changed = !Array.isArray(db.templates);
  if (changed) db.templates = BUILTIN_TEMPLATES.map((t) => ({ id: uid(), ...structuredClone(t) }));
  return { db, changed };
}
