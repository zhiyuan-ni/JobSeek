import { h } from './dom.js';
import { ROUND_COLUMNS, ROUND_TYPES } from '../model/constants.js';

export function field(label, control, { wide = false } = {}) {
  return h('label', { class: ['field', wide && 'wide'] }, h('span', { class: 'field-label' }, label), control);
}

export function iconBtn(text, title, onclick, disabled = false) {
  return h('button', { type: 'button', class: 'icon-btn', title, 'aria-label': title, onclick, disabled }, text);
}

// 流程节点类型菜单，按归属的看板列分组
export function roundTypeMenu(onPick) {
  const items = [];
  for (const col of ROUND_COLUMNS) {
    items.push({ header: col.name });
    for (const t of ROUND_TYPES.filter((t) => t.column === col.id)) {
      items.push({ label: t.name, onSelect: () => onPick(t.id) });
    }
  }
  items.push({ header: '其他' }, { label: '自定义…', onSelect: () => onPick('custom') });
  return items;
}
