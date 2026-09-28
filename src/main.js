import './styles.css';
import { buildAgenda } from './model/agenda.js';
import * as store from './store.js';
import { h } from './ui/dom.js';
import { mountBoard } from './views/board.js';
import { closeDetail, openDetail } from './views/detail.js';
import { mountResumes } from './views/resumes.js';
import { mountTemplates } from './views/templates.js';

// 每个视图的 mount 返回卸载函数
const ROUTES = {
  board: { title: '看板', mount: mountBoard },
  resumes: { title: '简历库', mount: mountResumes },
  templates: { title: '流程模板', mount: mountTemplates },
};

const main = h('main', { class: 'view' });
const navLinks = Object.entries(ROUTES).map(([name, r]) => h('a', { href: `#/${name}`, dataset: { route: name } }, r.title));
let current = { name: null, unmount: null };

// #/board、#/board/<投递 id>、#/resumes、#/templates
function route() {
  const [, name = 'board', arg = ''] = location.hash.match(/^#\/([^/]+)(?:\/(.+))?/) ?? [];
  const view = name in ROUTES ? name : 'board';
  if (view !== current.name) {
    closeDetail();
    current.unmount?.();
    main.className = `view view-${view}`;
    current = { name: view, unmount: ROUTES[view].mount(main) };
    navLinks.forEach((a) => a.classList.toggle('active', a.dataset.route === view));
  }
  if (view === 'board' && arg) openDetail(decodeURIComponent(arg));
}

async function start() {
  document.getElementById('app').replaceChildren(
    h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand' }, 'JobSeek', h('span', { class: 'brand-sub' }, '校招投递追踪')),
      h('nav', { class: 'nav' }, navLinks),
    ),
    main,
  );

  try {
    await store.init();
  } catch (err) {
    main.replaceChildren(
      h(
        'div',
        { class: 'fatal' },
        h('h2', null, '数据加载失败'),
        h('p', null, err.message),
        h('p', { class: 'muted' }, '请确认是用 npm run dev 启动的。如果 data/db.json 损坏了，可以从 data/backups/ 里拷一份回来。'),
      ),
    );
    return;
  }

  // 文件拖到非上传区域时，别让浏览器直接打开它
  for (const type of ['dragover', 'drop']) {
    window.addEventListener(type, (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') store.refresh().catch(() => {});
  });
  window.addEventListener('focus', () => store.refresh().catch(() => {}));
  window.addEventListener('beforeunload', (e) => {
    if (store.isSaving()) e.preventDefault();
  });
  window.addEventListener('hashchange', route);
  route();

  store.subscribe(updateTitle);
  setInterval(updateTitle, 60_000);
  updateTitle();
}

// 标签页标题带上「今天还有几项 + 几项待更新」，切到别的页面也能看到
const BASE_TITLE = document.title;

function updateTitle() {
  const { todayCount, attentionCount } = buildAgenda(store.getState().applications);
  const n = todayCount + attentionCount;
  document.title = n ? `(${n}) ${BASE_TITLE}` : BASE_TITLE;
}

start();
