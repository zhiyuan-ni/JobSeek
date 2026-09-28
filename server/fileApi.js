// Vite 插件：在 dev / preview 服务器上挂一个只允许本机访问的小 API，
// 把投递数据（db.json）和 PDF 读写到项目下的 data/ 目录。
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_KINDS = new Set(['resumes', 'jds']);
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const MAX_DB_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default function fileApi({ dir = 'data' } = {}) {
  let dataDir;
  let dbLock = Promise.resolve();

  // 串行化 db 写入，避免两个请求同时通过版本检查
  const withDbLock = (fn) => {
    const run = dbLock.then(fn);
    dbLock = run.catch(() => {});
    return run;
  };

  async function handle(req, res) {
    assertLocal(req);
    const { pathname } = new URL(req.url, 'http://localhost');
    const parts = pathname.split('/').filter(Boolean);

    if (parts.length === 1 && parts[0] === 'db') {
      if (req.method === 'GET') return sendJson(res, 200, await readDb(dataDir));
      if (req.method === 'PUT') {
        const body = await readBody(req, MAX_DB_BYTES);
        const { status, payload } = await withDbLock(() => writeDb(dataDir, body, req.headers['x-rev']));
        return sendJson(res, status, payload);
      }
    }

    if (parts.length === 3 && parts[0] === 'files') {
      const [, kind, id] = parts;
      if (!FILE_KINDS.has(kind) || !ID_RE.test(id)) throw new HttpError(400, '无效的文件路径');
      const file = path.join(dataDir, kind, `${id}.pdf`);
      if (req.method === 'GET') return sendPdf(res, file);
      if (req.method === 'PUT') {
        const size = await writePdf(file, await readBody(req, MAX_PDF_BYTES));
        return sendJson(res, 200, { size });
      }
      if (req.method === 'DELETE') {
        await fs.rm(file, { force: true });
        return sendJson(res, 200, { ok: true });
      }
    }

    throw new HttpError(404, `不支持的请求：${req.method} ${pathname}`);
  }

  const middleware = (req, res) => {
    handle(req, res).catch((err) => sendError(res, err));
  };

  return {
    name: 'jobseek-file-api',
    configResolved(config) {
      dataDir = path.resolve(config.root, dir);
    },
    // 直接注册（不走 post hook），保证排在 Vite 的 SPA fallback 之前
    configureServer(server) {
      server.middlewares.use('/api', middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', middleware);
    },
  };
}

// 只接受本机来源：挡住局域网访问、DNS rebinding 和其他网站的跨站写入
function assertLocal(req) {
  const host = req.headers.host ?? '';
  const hostname = host.replace(/:\d+$/, '');
  if (!LOCAL_HOSTNAMES.has(hostname) && !hostname.endsWith('.localhost')) {
    throw new HttpError(403, '只允许通过 localhost 访问');
  }
  const { origin } = req.headers;
  if (origin !== undefined) {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {}
    if (!sameOrigin) throw new HttpError(403, '拒绝跨站请求');
  }
}

const dbFile = (dataDir) => path.join(dataDir, 'db.json');

async function readDb(dataDir) {
  try {
    return JSON.parse(await fs.readFile(dbFile(dataDir), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { rev: 0 };
    if (err instanceof SyntaxError) throw new HttpError(500, `data/db.json 不是合法的 JSON：${err.message}`);
    throw err;
  }
}

async function writeDb(dataDir, body, revHeader) {
  let data;
  try {
    data = JSON.parse(body.toString('utf8'));
  } catch {
    throw new HttpError(400, '请求体不是合法的 JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, '数据格式错误');

  // 乐观锁：客户端带上它读到的 rev，对不上说明别的标签页已经写过
  const current = await readDb(dataDir);
  const currentRev = current.rev ?? 0;
  if (Number(revHeader) !== currentRev) return { status: 409, payload: current };

  delete data.rev;
  const rev = currentRev + 1;
  await backupDaily(dataDir);
  await writeAtomic(dbFile(dataDir), `${JSON.stringify({ rev, ...data }, null, 2)}\n`);
  return { status: 200, payload: { rev } };
}

// 每天第一次写入前，把上一版数据复制到 data/backups/db-YYYY-MM-DD.json
async function backupDaily(dataDir) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const target = path.join(dataDir, 'backups', `db-${day}.json`);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(dbFile(dataDir), target, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if (err.code !== 'EEXIST' && err.code !== 'ENOENT') throw err;
  }
}

async function writeAtomic(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, file);
}

async function writePdf(file, body) {
  // PDF 规范允许文件头前有少量垃圾字节，所以在前 1KB 里找
  if (!body.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
    throw new HttpError(415, '只支持 PDF 文件');
  }
  await writeAtomic(file, body);
  return body.length;
}

async function sendPdf(res, file) {
  let stat;
  try {
    stat = await fs.stat(file);
  } catch (err) {
    if (err.code === 'ENOENT') throw new HttpError(404, '文件不存在');
    throw err;
  }
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': stat.size,
    'Content-Disposition': 'inline',
    'Cache-Control': 'no-store',
  });
  createReadStream(file)
    .on('error', (err) => res.destroy(err))
    .pipe(res);
}

function readBody(req, limit) {
  const tooLarge = () => new HttpError(413, `超过大小上限 ${limit / 1024 / 1024} MB`);
  if (Number(req.headers['content-length']) > limit) return Promise.reject(tooLarge());
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    req.on('end', () => (size > limit ? reject(tooLarge()) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error('[jobseek-file-api]', err);
  if (res.headersSent) return res.destroy();
  sendJson(res, status, { error: err.message });
}
