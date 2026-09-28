// 与 server/fileApi.js 对应的前端封装

export class ConflictError extends Error {
  constructor(current) {
    super('数据已在其他标签页被修改');
    this.current = current;
  }
}

async function toError(res) {
  let message = `${res.status} ${res.statusText}`;
  try {
    message = (await res.json()).error ?? message;
  } catch {}
  return new Error(message);
}

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw await toError(res);
  return res;
}

export async function loadDb() {
  return (await request('/api/db')).json();
}

export async function saveDb(data, rev) {
  const res = await fetch('/api/db', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Rev': String(rev) },
    body: JSON.stringify(data),
  });
  if (res.status === 409) throw new ConflictError(await res.json());
  if (!res.ok) throw await toError(res);
  return res.json();
}

export const fileUrl = (kind, id) => `/api/files/${kind}/${id}`;

export async function uploadFile(kind, id, file) {
  await request(fileUrl(kind, id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  });
}

export async function deleteFile(kind, id) {
  await request(fileUrl(kind, id), { method: 'DELETE' });
}
