const pad = (n) => String(n).padStart(2, '0');

// 本地日期 'YYYY-MM-DD'
export function today(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 本地时间 'YYYY-MM-DDTHH:mm'，和 datetime-local 的值同格式，可以直接比较字符串
export const localDateTime = (d = new Date()) => `${today(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return today(new Date(y, m - 1, d + n));
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekday(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
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

// 两个 'YYYY-MM-DD' 之间差几天（按日历日算，不受夏令时影响）
export function daysBetween(fromKey, toKey) {
  const utc = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(toKey) - utc(fromKey)) / 86_400_000);
}

export const daysUntil = (dateKey) => daysBetween(today(), dateKey);

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
