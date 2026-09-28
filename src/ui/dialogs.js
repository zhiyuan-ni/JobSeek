import { h, options, selectEl } from './dom.js';
import { field } from './widgets.js';
import { OUTCOMES } from '../model/constants.js';

// 基于原生 <dialog>。action.onClick 返回 false 时不关闭；抛错会提示并保持打开
export function openModal({ title, body, actions = [], onClose }) {
  const dialog = h('dialog', { class: 'modal' });
  const buttons = actions.map((a) =>
    h('button', { type: a.primary ? 'submit' : 'button', class: ['btn', a.variant && `btn-${a.variant}`] }, a.label),
  );

  // close 事件是异步派发的；主动关闭时立即收尾，Esc 关闭时由事件收尾
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    dialog.remove();
    onClose?.();
  };
  const close = () => {
    dialog.close();
    finish();
  };

  let busy = false;
  async function run(action) {
    if (busy) return;
    busy = true;
    buttons.forEach((b) => (b.disabled = true));
    try {
      if ((await action.onClick?.()) !== false) close();
    } catch (err) {
      toast(err.message || String(err), 'error');
    } finally {
      busy = false;
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  actions.forEach((a, i) => {
    if (!a.primary) buttons[i].addEventListener('click', () => run(a));
  });
  const form = h(
    'form',
    {
      class: 'modal-form',
      onsubmit: (e) => {
        e.preventDefault();
        const primary = actions.find((a) => a.primary);
        if (primary) run(primary);
      },
    },
    h('h2', { class: 'modal-title' }, title),
    h('div', { class: 'modal-body' }, body),
    h('div', { class: 'modal-actions' }, buttons),
  );
  dialog.append(form);
  dialog.addEventListener('close', finish);
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close };
}

export function confirmDialog(message, { title = '确认', okText = '确定', danger = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    openModal({
      title,
      body: h('p', null, message),
      actions: [
        { label: '取消' },
        { label: okText, primary: true, variant: danger ? 'danger' : 'primary', onClick: () => (ok = true) },
      ],
      onClose: () => resolve(ok),
    });
  });
}

export function promptText({ title, label, value = '', okText = '确定' }) {
  return new Promise((resolve) => {
    let result = null;
    const input = h('input', { type: 'text', value, required: true, autofocus: true });
    openModal({
      title,
      body: field(label, input),
      actions: [
        { label: '取消' },
        { label: okText, primary: true, variant: 'primary', onClick: () => (result = input.value.trim() || null) },
      ],
      onClose: () => resolve(result),
    });
  });
}

export function pickOutcome(defaultId = 'rejected') {
  return new Promise((resolve) => {
    let result = null;
    const select = selectEl(options(OUTCOMES), defaultId, { autofocus: true });
    openModal({
      title: '移到「已结束」',
      body: field('结果', select),
      actions: [
        { label: '取消' },
        { label: '确定', primary: true, variant: 'primary', onClick: () => (result = select.value) },
      ],
      onClose: () => resolve(result),
    });
  });
}

// 用 popover="auto" 做下拉菜单：点外面或按 Esc 自动关闭
export function showMenu(anchor, items) {
  const menu = h(
    'div',
    { class: 'menu', popover: 'auto' },
    items.map((item) =>
      item.header
        ? h('div', { class: 'menu-header' }, item.header)
        : h(
            'button',
            {
              type: 'button',
              class: 'menu-item',
              onclick: () => {
                menu.hidePopover();
                item.onSelect();
              },
            },
            item.label,
          ),
    ),
  );
  menu.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') menu.remove();
  });
  document.body.append(menu);
  menu.showPopover();

  // 放在按钮下方或上方空间更大的一侧，超出就限高滚动，绝不盖住按钮本身
  const a = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const below = innerHeight - a.bottom - 12;
  const above = a.top - 12;
  const placeBelow = m.height <= below || below >= above;
  const height = Math.min(m.height, placeBelow ? below : above);
  menu.style.maxHeight = `${height}px`;
  menu.style.top = `${placeBelow ? a.bottom + 4 : a.top - 4 - height}px`;
  menu.style.left = `${Math.max(8, Math.min(a.left, innerWidth - m.width - 8))}px`;
}

let toastHost = null;

export function toast(message, type = 'info') {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host', popover: 'manual' });
    document.body.append(toastHost);
  }
  toastHost.append(h('div', { class: ['toast', `toast-${type}`], role: 'status' }, message));
  // 重新弹出一次，保证浮在已打开的模态框之上
  if (toastHost.matches(':popover-open')) toastHost.hidePopover();
  toastHost.showPopover();

  const el = toastHost.lastElementChild;
  setTimeout(
    () => {
      el.remove();
      if (!toastHost.childElementCount && toastHost.matches(':popover-open')) toastHost.hidePopover();
    },
    type === 'error' ? 5000 : 2500,
  );
}
