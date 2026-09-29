// 用演示数据重新生成 README 里的截图：npm run screenshots
// 演示数据只写在临时目录，由单独的 dev server 读取，不会碰 data/。
// 需要本机装有 Chrome / Chromium / Edge，找不到时可以用 CHROME_PATH 指定。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import fileApi from '../server/fileApi.js';
import { createDemo } from './demo-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'screenshots');
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false };

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

// setup 在页面里执行；crop 表示按这个元素的底边裁掉下方空白
const SHOTS = [
  { file: 'board.png', hash: () => '#/board', ready: '.card' },
  {
    file: 'detail.png',
    hash: (ids) => `#/board/${ids.bytedance}`,
    ready: '.drawer .round',
    // 滚到「简历与 JD」，让附件和整条流程都在画面里
    setup: `(() => {
      const section = [...document.querySelectorAll('.drawer-section')].find((s) => s.querySelector('h3').textContent.startsWith('简历与 JD'));
      document.querySelector('.drawer').scrollTop = section.offsetTop - 16;
    })()`,
  },
  { file: 'resumes.png', hash: () => '#/resumes', ready: '.resume-card', crop: '.resume-grid' },
  { file: 'templates.png', hash: () => '#/templates', ready: '.tpl-card', crop: '.tpl-list' },
  { file: 'board-dark.png', hash: () => '#/board', ready: '.card', dark: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chromePath) throw new Error('没找到 Chrome，可以用 CHROME_PATH 环境变量指定浏览器路径');

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jobseek-shots-'));
  const dataDir = path.join(tmp, 'data');
  const { db, pdfs, ids } = createDemo();
  await writeDemo(dataDir, db, pdfs);

  const server = await createServer({
    configFile: false,
    root,
    logLevel: 'error',
    plugins: [fileApi({ dir: dataDir })],
    server: { port: 5199 },
  });
  await server.listen();
  const baseUrl = server.resolvedUrls.local[0];

  let chrome;
  try {
    chrome = await launchChrome(chromePath, path.join(tmp, 'profile'));
    const { cdp } = chrome;
    await cdp.send('Emulation.setDeviceMetricsOverride', VIEWPORT);
    await fs.mkdir(outDir, { recursive: true });

    for (const shot of SHOTS) {
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: shot.dark ? 'dark' : 'light' }],
      });
      // 先切到空白页，保证每张图都是全新加载
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await cdp.send('Page.navigate', { url: `${baseUrl}${shot.hash(ids)}` });
      await poll(() => evaluate(cdp, `!!document.querySelector(${JSON.stringify(shot.ready)})`).catch(() => false));
      await evaluate(cdp, 'document.fonts.ready.then(() => true)');
      if (shot.setup) await evaluate(cdp, shot.setup);
      await sleep(600); // 等抽屉的滑入动画

      const clip = shot.crop ? await cropFor(cdp, shot.crop) : undefined;
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', ...(clip && { clip }) });
      await fs.writeFile(path.join(outDir, shot.file), Buffer.from(data, 'base64'));
      console.log(`✓ docs/screenshots/${shot.file}`);
    }
  } finally {
    await chrome?.close();
    await server.close();
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function writeDemo(dataDir, db, pdfs) {
  for (const kind of ['resumes', 'jds']) await fs.mkdir(path.join(dataDir, kind), { recursive: true });
  await fs.writeFile(path.join(dataDir, 'db.json'), JSON.stringify(db, null, 2));
  for (const { kind, id, content } of pdfs) await fs.writeFile(path.join(dataDir, kind, `${id}.pdf`), content);
}

async function cropFor(cdp, selector) {
  const bottom = await evaluate(cdp, `Math.ceil(document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().bottom) + 24`);
  return { x: 0, y: 0, width: VIEWPORT.width, height: Math.min(bottom, VIEWPORT.height), scale: 1 };
}

async function launchChrome(executable, profileDir) {
  const proc = spawn(
    executable,
    [
      '--headless=new',
      `--user-data-dir=${profileDir}`,
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--lang=zh-CN', // 日期输入框的格式在 macOS 上跟随系统地区设置，这个参数只在 Linux / Windows 上生效
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const exited = new Promise((resolve) => proc.once('exit', resolve));
  // 端口为 0 时，Chrome 会把实际端口写进 DevToolsActivePort
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  const port = await poll(async () => (await fs.readFile(portFile, 'utf8').catch(() => '')).split('\n')[0]);
  const targets = await poll(async () => {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return list.some((t) => t.type === 'page' && t.url === 'about:blank') && list;
  });
  const cdp = await connect(targets.find((t) => t.type === 'page' && t.url === 'about:blank').webSocketDebuggerUrl);
  return {
    cdp,
    async close() {
      cdp.close();
      proc.kill();
      await Promise.race([exited, sleep(3000)]);
    },
  };
}

// 最小的 Chrome DevTools Protocol 客户端（Node 自带 WebSocket）
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let seq = 0;
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      const waiter = msg.id && pending.get(msg.id);
      if (!waiter) return;
      pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(`${msg.error.message}`));
      else waiter.resolve(msg.result);
    });
    ws.addEventListener('error', reject, { once: true });
    ws.addEventListener('open', () =>
      resolve({
        send(method, params = {}) {
          const id = ++seq;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }));
        },
        close: () => ws.close(),
      }),
    );
  });
}

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

async function poll(fn, { timeout = 15_000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn().catch(() => null);
    if (value) return value;
    await sleep(interval);
  }
  throw new Error('等待超时');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
