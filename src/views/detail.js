// 投递详情抽屉：改动即时保存（input 的 change 事件），数据变化后整块重绘
import * as actions from '../actions.js';
import { fileUrl } from '../api.js';
import * as store from '../store.js';
import { currentRound, roundLabel, roundType } from '../model/application.js';
import {
  CATEGORIES,
  CHANNELS,
  COLUMNS,
  OUTCOMES,
  PRIORITIES,
  ROUND_COLUMNS,
  ROUND_STATUSES,
  ROUND_TYPES,
  WISHES,
  nameOf,
} from '../model/constants.js';
import { h, options, patchChildren, selectEl } from '../ui/dom.js';
import { promptText, showMenu } from '../ui/dialogs.js';
import { field, iconBtn, roundTypeMenu } from '../ui/widgets.js';
import { fmtDateTime, fmtSize, fmtTimestamp, normalizeUrl, safeUrl, splitList } from '../utils/format.js';

let panel = null;

export const openedId = () => panel?.id ?? null;

export function openDetail(id) {
  if (!store.findApp(id)) return;
  if (!panel) {
    const body = h('div', { class: 'drawer-body' });
    const el = h('aside', { class: 'drawer', 'aria-label': '投递详情' }, body);
    document.body.append(el);
    panel = { id, el, body, unsubscribe: store.subscribe(render) };
    document.addEventListener('keydown', onKeydown);
  } else if (panel.id !== id) {
    panel.id = id;
    panel.el.scrollTop = 0;
  }
  render();
  markSelected(id);
  if (!location.hash || location.hash.startsWith('#/board')) history.replaceState(null, '', `#/board/${id}`);
}

export function closeDetail() {
  if (!panel) return;
  panel.unsubscribe();
  panel.el.remove();
  panel = null;
  document.removeEventListener('keydown', onKeydown);
  markSelected(null);
  if (location.hash.startsWith('#/board/')) history.replaceState(null, '', '#/board');
}

function onKeydown(e) {
  // 弹窗或菜单开着时，Esc 留给它们
  if (e.key !== 'Escape' || document.querySelector('dialog[open], .menu')) return;
  closeDetail();
}

function markSelected(id) {
  document.querySelectorAll('.card.selected').forEach((el) => el.classList.remove('selected'));
  if (id) document.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.classList.add('selected');
}

function render() {
  const app = panel && store.findApp(panel.id);
  if (!app) return closeDetail();
  patchChildren(
    panel.body,
    renderHeader(app),
    section('基本信息', renderBasics(app)),
    section('简历与 JD', renderAttachments(app)),
    section('流程', renderRounds(app), '节点标为「已约 / 待结果 / 通过」时，卡片会自动前移到对应列'),
    section('备注', renderNotes(app)),
    h('footer', { class: 'drawer-footer' }, `创建于 ${fmtTimestamp(app.createdAt)} · 最后更新 ${fmtTimestamp(app.updatedAt)}`),
  );
}

const section = (title, content, hint) =>
  h('section', { class: 'drawer-section' }, h('h3', null, title, hint && h('span', { class: 'section-hint' }, hint)), content);

function renderHeader(app) {
  const round = currentRound(app);
  return h(
    'header',
    { class: 'drawer-header' },
    h('div', { class: 'drawer-title' }, h('h2', null, app.company || '未命名公司'), h('p', null, app.position || '未填写岗位')),
    h(
      'div',
      { class: 'drawer-actions' },
      h('button', { type: 'button', class: 'btn btn-small btn-danger-ghost', onclick: () => actions.deleteApp(app.id) }, '删除'),
      iconBtn('✕', '关闭（Esc）', closeDetail),
    ),
    h(
      'div',
      { class: 'drawer-phase' },
      selectEl(options(COLUMNS), app.phase, {
        'data-key': 'phase',
        class: ['phase-select', `col-${app.phase}`].join(' '),
        title: '看板列',
        onchange: async (e) => {
          await actions.moveToColumn(app.id, e.target.value);
          render(); // 选了「已结束」又取消时把下拉框复原
        },
      }),
      app.phase === 'closed' &&
        selectEl(options(OUTCOMES), app.outcome, {
          'data-key': 'outcome',
          title: '结果',
          onchange: (e) => actions.updateApp(app.id, { outcome: e.target.value }),
        }),
      round &&
        h(
          'span',
          { class: ['current-round', `s-${round.status}`].join(' ') },
          h('span', { class: 'status-dot' }),
          `当前：${roundLabel(round)} · ${nameOf(ROUND_STATUSES, round.status)}`,
          round.scheduledAt && ` · ${fmtDateTime(round.scheduledAt)}`,
        ),
    ),
  );
}

function renderBasics(app) {
  const update = (patch) => actions.updateApp(app.id, patch);
  const text = (key, label, attrs = {}) =>
    field(
      label,
      h('input', {
        type: 'text',
        value: app[key],
        'data-key': `f:${key}`,
        onchange: (e) => update({ [key]: e.target.value.trim() }),
        ...attrs,
      }),
    );
  const date = (key, label) =>
    field(label, h('input', { type: 'date', value: app[key], 'data-key': `f:${key}`, onchange: (e) => update({ [key]: e.target.value }) }));
  const select = (key, label, opts, parse) =>
    field(label, selectEl(opts, app[key], { 'data-key': `f:${key}`, onchange: (e) => update({ [key]: parse(e.target.value) }) }));
  const link = (key, label) => {
    const url = safeUrl(app[key]);
    return field(
      label,
      h(
        'div',
        { class: 'input-with-action' },
        h('input', {
          type: 'text',
          inputmode: 'url',
          value: app[key],
          placeholder: 'https://',
          'data-key': `f:${key}`,
          onchange: (e) => update({ [key]: normalizeUrl(e.target.value) }),
        }),
        url && h('a', { class: 'btn btn-small', href: url, target: '_blank', rel: 'noopener noreferrer' }, '打开'),
      ),
      { wide: true },
    );
  };
  const str = (v) => v;

  return h(
    'div',
    { class: 'form-grid' },
    text('company', '公司', { placeholder: '如：字节跳动' }),
    text('position', '岗位', { placeholder: '如：后端开发工程师' }),
    select('category', '类别', options(CATEGORIES, { empty: '—' }), str),
    select('priority', '意向度', options(PRIORITIES), Number),
    select('wish', '志愿', options(WISHES, { empty: '—' }), (v) => (v ? Number(v) : null)),
    select('channel', '渠道', options(CHANNELS, { empty: '—' }), str),
    field(
      '城市',
      h('input', {
        type: 'text',
        value: app.cities.join('、'),
        placeholder: '多个用顿号或逗号隔开',
        'data-key': 'f:cities',
        onchange: (e) => update({ cities: splitList(e.target.value) }),
      }),
    ),
    text('referralCode', '内推码'),
    date('appliedAt', '投递日期'),
    date('deadline', '投递截止'),
    link('portalUrl', '校招官网（查进度）'),
    link('jdUrl', 'JD 链接'),
  );
}

function renderAttachments(app) {
  const resumes = [...store.getState().resumes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const resume = app.resumeId ? store.findResume(app.resumeId) : null;
  const pdfLink = (href, label, cls = 'btn btn-small') => h('a', { class: cls, href, target: '_blank', rel: 'noopener' }, label);

  const resumeRow = h(
    'div',
    { class: 'attach-row' },
    h('span', { class: 'attach-label' }, '简历版本'),
    resumes.length
      ? selectEl(options(resumes, { empty: '— 未选择 —' }), app.resumeId, {
          'data-key': 'f:resumeId',
          onchange: (e) => actions.updateApp(app.id, { resumeId: e.target.value || null }),
        })
      : h('span', { class: 'muted grow' }, '简历库还是空的'),
    resume && pdfLink(fileUrl('resumes', resume.id), '查看'),
    h('a', { class: 'btn btn-small btn-ghost', href: '#/resumes' }, '管理简历库'),
  );

  const picker = h('input', {
    type: 'file',
    accept: 'application/pdf,.pdf',
    hidden: true,
    onchange: (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) actions.uploadJd(app.id, file);
    },
  });
  const jd = app.jdFile;
  const jdRow = h(
    'div',
    { class: 'attach-row', title: '也可以把 PDF 直接拖到这里' },
    h('span', { class: 'attach-label' }, 'JD（PDF）'),
    jd
      ? [
          pdfLink(fileUrl('jds', app.id), jd.name, 'file-link'),
          h('span', { class: 'muted grow' }, fmtSize(jd.size)),
          h('button', { type: 'button', class: 'btn btn-small', onclick: () => picker.click() }, '替换'),
          h('button', { type: 'button', class: 'btn btn-small btn-danger-ghost', onclick: () => actions.removeJd(app.id) }, '删除'),
        ]
      : [
          h('span', { class: 'muted grow' }, '拖入 PDF 或'),
          h('button', { type: 'button', class: 'btn btn-small btn-primary', onclick: () => picker.click() }, '上传 PDF'),
        ],
    picker,
  );
  jdRow.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    jdRow.classList.add('drop-over');
  });
  jdRow.addEventListener('dragleave', (e) => {
    if (!jdRow.contains(e.relatedTarget)) jdRow.classList.remove('drop-over');
  });
  jdRow.addEventListener('drop', (e) => {
    e.preventDefault();
    jdRow.classList.remove('drop-over');
    const file = e.dataTransfer.files[0];
    if (file) actions.uploadJd(app.id, file);
  });

  return [resumeRow, jdRow];
}

function renderRounds(app) {
  const current = currentRound(app);
  const { templates } = store.getState();

  const list = app.rounds.length
    ? h('ol', { class: 'rounds' }, app.rounds.map((r, i) => renderRound(app, r, i, r === current)))
    : h('p', { class: 'empty' }, '还没有流程节点。可以套用模板，或者手动添加。');

  const toolbar = h(
    'div',
    { class: 'rounds-actions' },
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-small',
        onclick: (e) => showMenu(e.currentTarget, roundTypeMenu((type) => actions.insertRound(app.id, app.rounds.length, type))),
      },
      '+ 添加节点',
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-small',
        disabled: !templates.length,
        onclick: (e) =>
          showMenu(
            e.currentTarget,
            templates.map((t) => ({ label: t.name, onSelect: () => actions.applyTemplate(app.id, t.id) })),
          ),
      },
      '套用模板',
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-small btn-ghost',
        disabled: !app.rounds.length,
        onclick: async () => {
          const name = await promptText({
            title: '另存为流程模板',
            label: '模板名称',
            value: `${app.company || '新'}流程`,
            okText: '保存',
          });
          if (name) actions.saveRoundsAsTemplate(app.id, name);
        },
      },
      '另存为模板',
    ),
  );
  return [list, toolbar];
}

function renderRound(app, round, index, isCurrent) {
  const key = (k) => `r:${round.id}:${k}`;
  const update = (patch) => actions.updateRound(app.id, round.id, patch);
  const last = app.rounds.length - 1;

  return h(
    'li',
    { class: ['round', `s-${round.status}`, isCurrent && 'current'] },
    h('span', { class: 'round-index' }, index + 1),
    h(
      'div',
      { class: 'round-main' },
      h('input', {
        class: 'round-name',
        type: 'text',
        value: round.name,
        placeholder: roundType(round.type).name,
        'data-key': key('name'),
        onchange: (e) => update({ name: e.target.value.trim() }),
      }),
      selectEl(options(ROUND_TYPES), round.type, {
        class: 'round-type',
        title: '节点类型',
        'data-key': key('type'),
        onchange: (e) => actions.changeRoundType(app.id, round.id, e.target.value),
      }),
      selectEl(options(ROUND_STATUSES), round.status, {
        class: 'round-status',
        title: '状态',
        'data-key': key('status'),
        onchange: (e) => actions.setRoundStatus(app.id, round.id, e.target.value),
      }),
    ),
    h(
      'div',
      { class: 'round-tools' },
      iconBtn('↑', '上移', () => actions.moveRound(app.id, round.id, -1), index === 0),
      iconBtn('↓', '下移', () => actions.moveRound(app.id, round.id, 1), index === last),
      iconBtn('＋', '在下面插入一轮', (e) =>
        showMenu(e.currentTarget, roundTypeMenu((type) => actions.insertRound(app.id, index + 1, type))),
      ),
      iconBtn('✕', '删除这一轮', () => actions.removeRound(app.id, round.id)),
    ),
    h(
      'div',
      { class: 'round-sub' },
      h('input', {
        type: 'datetime-local',
        value: round.scheduledAt,
        title: '时间',
        'data-key': key('time'),
        onchange: (e) => update({ scheduledAt: e.target.value }),
      }),
      round.type === 'custom' &&
        selectEl(options(ROUND_COLUMNS), round.column, {
          title: '归属看板列',
          'data-key': key('column'),
          onchange: (e) => update({ column: e.target.value }),
        }),
      h('input', {
        class: 'round-note',
        type: 'text',
        value: round.note,
        placeholder: '备注：面试官、问了什么、感觉如何…',
        'data-key': key('note'),
        onchange: (e) => update({ note: e.target.value }),
      }),
    ),
  );
}

function renderNotes(app) {
  return h('textarea', {
    rows: 4,
    value: app.notes,
    placeholder: '公司情况、薪资、HR 联系方式、面经链接…',
    'data-key': 'f:notes',
    onchange: (e) => actions.updateApp(app.id, { notes: e.target.value }),
  });
}
