// 所有修改数据的操作集中在这里，视图只负责调用
import * as api from './api.js';
import * as store from './store.js';
import {
  moveApp,
  moveItem,
  newApplication,
  newRound,
  now,
  retypeRound,
  roundLabel,
  roundsFromTemplate,
  syncPhaseFromRounds,
  templateRound,
  uid,
} from './model/application.js';
import { confirmDialog, pickOutcome, toast } from './ui/dialogs.js';

const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const appTitle = (app) => [app.company || '未命名公司', app.position].filter(Boolean).join(' · ');

function editApp(id, mutate) {
  store.commit((s) => {
    const app = s.applications.find((a) => a.id === id);
    if (!app) return;
    mutate(app);
    app.updatedAt = now();
  });
}

// —— 投递 ——

export function createApp(fields, templateId) {
  const app = newApplication(fields);
  const template = templateId ? store.findTemplate(templateId) : null;
  if (template) app.rounds = roundsFromTemplate(template);
  store.commit((s) => s.applications.push(app));
  return app.id;
}

export function updateApp(id, patch) {
  editApp(id, (app) => Object.assign(app, patch));
}

export async function deleteApp(id) {
  const app = store.findApp(id);
  if (!app) return;
  const ok = await confirmDialog(`删除「${appTitle(app)}」？流程记录和 JD 附件会一起删除，无法撤销。`, {
    title: '删除投递',
    okText: '删除',
    danger: true,
  });
  if (!ok) return;
  store.commit((s) => {
    s.applications = s.applications.filter((a) => a.id !== id);
  });
  if (app.jdFile) api.deleteFile('jds', id).catch(() => {});
}

export async function moveToColumn(id, column) {
  const app = store.findApp(id);
  if (!app || app.phase === column) return;
  let outcome = null;
  if (column === 'closed') {
    outcome = await pickOutcome();
    if (!outcome) return;
  }
  editApp(id, (a) => moveApp(a, column, outcome));
}

// —— 流程节点 ——

function editRound(appId, roundId, mutate) {
  editApp(appId, (app) => {
    const round = app.rounds.find((r) => r.id === roundId);
    if (!round) return;
    mutate(round);
    syncPhaseFromRounds(app);
  });
}

export function insertRound(appId, index, type) {
  editApp(appId, (app) => app.rounds.splice(index, 0, newRound(type)));
}

export function updateRound(appId, roundId, patch) {
  editRound(appId, roundId, (r) => Object.assign(r, patch));
}

export function changeRoundType(appId, roundId, type) {
  editRound(appId, roundId, (r) => retypeRound(r, type));
}

export async function setRoundStatus(appId, roundId, status) {
  updateRound(appId, roundId, { status });
  const app = store.findApp(appId);
  const round = app?.rounds.find((r) => r.id === roundId);
  if (status !== 'failed' || !round || app.phase === 'closed') return;
  const ok = await confirmDialog(`「${roundLabel(round)}」没通过，要把这条投递移到「已结束 · 挂了」吗？`, {
    okText: '移到已结束',
  });
  if (ok) editApp(appId, (a) => moveApp(a, 'closed', 'rejected'));
}

export function moveRound(appId, roundId, delta) {
  editApp(appId, (app) => moveItem(app.rounds, app.rounds.findIndex((r) => r.id === roundId), delta));
}

export async function removeRound(appId, roundId) {
  const round = store.findApp(appId)?.rounds.find((r) => r.id === roundId);
  if (!round) return;
  if (round.note) {
    const ok = await confirmDialog(`删除「${roundLabel(round)}」？它的备注也会一起删除。`, { okText: '删除', danger: true });
    if (!ok) return;
  }
  editApp(appId, (app) => {
    app.rounds = app.rounds.filter((r) => r.id !== roundId);
  });
}

export async function applyTemplate(appId, templateId) {
  const app = store.findApp(appId);
  const template = store.findTemplate(templateId);
  if (!app || !template) return;
  if (app.rounds.length) {
    const ok = await confirmDialog(`用模板「${template.name}」替换现有的 ${app.rounds.length} 个节点？`, {
      okText: '替换',
      danger: true,
    });
    if (!ok) return;
  }
  editApp(appId, (a) => {
    a.rounds = roundsFromTemplate(template);
  });
}

export function saveRoundsAsTemplate(appId, name) {
  const app = store.findApp(appId);
  if (!app) return;
  const rounds = app.rounds.map(({ type, name: roundName, column }) => ({ type, name: roundName, column }));
  store.commit((s) => s.templates.push({ id: uid(), name, rounds }));
  toast(`已保存为模板「${name}」`);
}

// —— JD 附件 ——

export async function uploadJd(appId, file) {
  if (!isPdf(file)) return toast('只支持 PDF 文件', 'error');
  try {
    await api.uploadFile('jds', appId, file);
  } catch (err) {
    return toast(`上传失败：${err.message}`, 'error');
  }
  editApp(appId, (app) => {
    app.jdFile = { name: file.name, size: file.size, uploadedAt: now() };
  });
  toast('JD 已上传');
}

export async function removeJd(appId) {
  if (!(await confirmDialog('删除这条投递的 JD 附件？', { okText: '删除', danger: true }))) return;
  try {
    await api.deleteFile('jds', appId);
  } catch (err) {
    return toast(`删除失败：${err.message}`, 'error');
  }
  editApp(appId, (app) => {
    app.jdFile = null;
  });
}

// —— 简历库 ——

export async function createResume({ name, note, file }) {
  if (!isPdf(file)) throw new Error('只支持 PDF 文件');
  const id = uid();
  await api.uploadFile('resumes', id, file);
  store.commit((s) => s.resumes.push({ id, name, note, fileName: file.name, size: file.size, createdAt: now() }));
}

export function updateResume(id, patch) {
  store.commit((s) => {
    const resume = s.resumes.find((r) => r.id === id);
    if (resume) Object.assign(resume, patch);
  });
}

export async function deleteResume(id) {
  const resume = store.findResume(id);
  if (!resume) return;
  const used = store.getState().applications.filter((a) => a.resumeId === id).length;
  const message = used
    ? `有 ${used} 条投递用了「${resume.name}」，删除后它们将不再关联简历。确定删除这个版本和它的 PDF？`
    : `确定删除「${resume.name}」和它的 PDF？`;
  if (!(await confirmDialog(message, { title: '删除简历版本', okText: '删除', danger: true }))) return;
  store.commit((s) => {
    s.resumes = s.resumes.filter((r) => r.id !== id);
    for (const app of s.applications) if (app.resumeId === id) app.resumeId = null;
  });
  api.deleteFile('resumes', id).catch(() => {});
}

// —— 流程模板 ——

function editTemplate(id, mutate) {
  store.commit((s) => {
    const template = s.templates.find((t) => t.id === id);
    if (template) mutate(template);
  });
}

export function createTemplate() {
  const id = uid();
  store.commit((s) => s.templates.push({ id, name: '新模板', rounds: [templateRound('apply')] }));
  return id;
}

export function renameTemplate(id, name) {
  editTemplate(id, (t) => {
    t.name = name;
  });
}

export function addTemplateRound(id, type) {
  editTemplate(id, (t) => t.rounds.push(templateRound(type)));
}

export function updateTemplateRound(id, index, patch) {
  editTemplate(id, (t) => Object.assign(t.rounds[index], patch));
}

export function changeTemplateRoundType(id, index, type) {
  editTemplate(id, (t) => retypeRound(t.rounds[index], type));
}

export function moveTemplateRound(id, index, delta) {
  editTemplate(id, (t) => moveItem(t.rounds, index, delta));
}

export function removeTemplateRound(id, index) {
  editTemplate(id, (t) => t.rounds.splice(index, 1));
}

export async function deleteTemplate(id) {
  const template = store.findTemplate(id);
  if (!template) return;
  const ok = await confirmDialog(`删除模板「${template.name}」？已经用它生成的投递流程不受影响。`, {
    okText: '删除',
    danger: true,
  });
  if (!ok) return;
  store.commit((s) => {
    s.templates = s.templates.filter((t) => t.id !== id);
  });
}
