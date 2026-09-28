const pad = (n) => String(n).padStart(2, '0');

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// '2026-10-01' → '10/01'
export function fmtDate(value) {
  if (!value) return '';
  const [, m, d] = value.slice(0, 10).split('-');
  return `${m}/${d}`;
}

// '2026-10-08T15:00' → '10/08 15:00'
export function fmtDateTime(value) {
  if (!value) return '';
  const [date, time = ''] = value.split('T');
  return `${fmtDate(date)} ${time.slice(0, 5)}`.trim();
}

// ISO 时间戳 → '2026-10-08 15:00'
export function fmtTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - start) / 86_400_000);
}

// datetime-local 的值不带时区，按本地时间解析
export const hoursUntil = (value) => (new Date(value) - Date.now()) / 3_600_000;

export function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const splitList = (value) =>
  value
    .split(/[,，、;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export function normalizeUrl(value) {
  const v = value.trim();
  if (!v) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}

// 只把 http(s) 链接渲染成可点击的，避免 javascript: 之类
export const safeUrl = (value) => (/^https?:\/\//i.test(value ?? '') ? value : null);
