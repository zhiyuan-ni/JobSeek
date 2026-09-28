import * as actions from '../actions.js';
import { fileUrl } from '../api.js';
import * as store from '../store.js';
import { reachedIndex } from '../model/application.js';
import { columnIndex } from '../model/constants.js';
import { h, patchChildren } from '../ui/dom.js';
import { openModal, toast } from '../ui/dialogs.js';
import { field } from '../ui/widgets.js';
import { fmtSize, fmtTimestamp } from '../utils/format.js';

export function mountResumes(root) {
  const grid = h('div', { class: 'resume-grid' });
  root.replaceChildren(
    h(
      'div',
      { class: 'page-header' },
      h(
        'div',
        null,
        h('h1', null, '简历库'),
        h('p', { class: 'muted' }, '每个版本的 PDF 上传后不能替换，这样总能查到当初投出去的是哪一版。改了简历就上传一个新版本。'),
      ),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: openUploadModal }, '+ 上传新版本'),
    ),
    grid,
  );

  function render() {
    const { resumes, applications } = store.getState();
    const sorted = [...resumes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    patchChildren(
      grid,
      sorted.length
        ? sorted.map((r) => renderResume(r, applications))
        : h('div', { class: 'empty-state' }, '还没有简历，先上传第一份 PDF 吧。'),
    );
  }

  render();
  return store.subscribe(render);
}

function renderResume(resume, applications) {
  const used = applications.filter((a) => a.resumeId === resume.id);
  const screened = used.filter((a) => reachedIndex(a) >= columnIndex('test')).length;

  return h(
    'article',
    { class: 'resume-card' },
    h('input', {
      class: 'resume-name',
      type: 'text',
      value: resume.name,
      'data-key': `res:${resume.id}:name`,
      onchange: (e) => actions.updateResume(resume.id, { name: e.target.value.trim() || resume.name }),
    }),
    h('textarea', {
      class: 'resume-note',
      rows: 2,
      value: resume.note,
      placeholder: '备注：这版改了什么、适合投哪类岗位…',
      'data-key': `res:${resume.id}:note`,
      onchange: (e) => actions.updateResume(resume.id, { note: e.target.value.trim() }),
    }),
    h('div', { class: 'resume-meta' }, `${resume.fileName} · ${fmtSize(resume.size)} · 上传于 ${fmtTimestamp(resume.createdAt)}`),
    h(
      'div',
      { class: 'resume-stats' },
      h('span', null, h('b', null, used.length), ' 次投递'),
      h('span', { title: '进入笔试/测评或更后面的阶段' }, h('b', null, screened), ' 次过筛'),
    ),
    used.length > 0 &&
      h(
        'div',
        { class: 'chips' },
        used.map((a) => h('a', { class: 'chip', href: `#/board/${a.id}` }, [a.company || '未命名', a.position].filter(Boolean).join(' · '))),
      ),
    h(
      'div',
      { class: 'card-actions' },
      h('a', { class: 'btn btn-small', href: fileUrl('resumes', resume.id), target: '_blank', rel: 'noopener' }, '查看 PDF'),
      h('button', { type: 'button', class: 'btn btn-small btn-danger-ghost', onclick: () => actions.deleteResume(resume.id) }, '删除'),
    ),
  );
}

function openUploadModal() {
  const name = h('input', { type: 'text', required: true, placeholder: '如：后端 v3 - 加了字节实习' });
  const note = h('textarea', { rows: 3, placeholder: '这版改了什么、适合投哪类岗位（可选）' });
  const file = h('input', {
    type: 'file',
    accept: 'application/pdf,.pdf',
    required: true,
    onchange: () => {
      if (!name.value && file.files[0]) name.value = file.files[0].name.replace(/\.pdf$/i, '');
    },
  });

  openModal({
    title: '上传简历版本',
    body: h('div', { class: 'form-stack' }, field('PDF 文件', file), field('版本名', name), field('备注', note)),
    actions: [
      { label: '取消' },
      {
        label: '上传',
        primary: true,
        variant: 'primary',
        onClick: async () => {
          await actions.createResume({ name: name.value.trim(), note: note.value.trim(), file: file.files[0] });
          toast('简历已上传');
        },
      },
    ],
  });
}
