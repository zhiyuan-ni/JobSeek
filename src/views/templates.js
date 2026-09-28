import * as actions from '../actions.js';
import * as store from '../store.js';
import { roundType } from '../model/application.js';
import { COLUMNS, ROUND_COLUMNS, ROUND_TYPES, nameOf } from '../model/constants.js';
import { h, options, patchChildren, selectEl } from '../ui/dom.js';
import { showMenu } from '../ui/dialogs.js';
import { iconBtn, roundTypeMenu } from '../ui/widgets.js';

export function mountTemplates(root) {
  const list = h('div', { class: 'tpl-list' });
  root.replaceChildren(
    h(
      'div',
      { class: 'page-header' },
      h(
        'div',
        null,
        h('h1', null, '流程模板'),
        h('p', { class: 'muted' }, '新建投递时选一个模板，自动生成流程节点。之后每条投递的流程都能单独修改，不会影响模板。'),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary',
          onclick: () => {
            const id = actions.createTemplate();
            document.querySelector(`[data-key="tpl:${id}:name"]`)?.select();
          },
        },
        '+ 新建模板',
      ),
    ),
    list,
  );

  function render() {
    const { templates } = store.getState();
    patchChildren(list, templates.length ? templates.map(renderTemplate) : h('div', { class: 'empty-state' }, '还没有模板'));
  }

  render();
  return store.subscribe(render);
}

function renderTemplate(tpl) {
  const last = tpl.rounds.length - 1;
  return h(
    'article',
    { class: 'tpl-card' },
    h(
      'div',
      { class: 'tpl-head' },
      h('input', {
        class: 'tpl-name',
        type: 'text',
        value: tpl.name,
        'data-key': `tpl:${tpl.id}:name`,
        onchange: (e) => actions.renameTemplate(tpl.id, e.target.value.trim() || tpl.name),
      }),
      h('button', { type: 'button', class: 'btn btn-small btn-danger-ghost', onclick: () => actions.deleteTemplate(tpl.id) }, '删除'),
    ),
    h(
      'ol',
      { class: 'tpl-rounds' },
      tpl.rounds.map((r, i) =>
        h(
          'li',
          { class: 'tpl-round' },
          h('span', { class: 'round-index' }, i + 1),
          h('input', {
            type: 'text',
            value: r.name,
            placeholder: roundType(r.type).name,
            'data-key': `tpl:${tpl.id}:${i}:name`,
            onchange: (e) => actions.updateTemplateRound(tpl.id, i, { name: e.target.value.trim() }),
          }),
          selectEl(options(ROUND_TYPES), r.type, {
            title: '节点类型',
            onchange: (e) => actions.changeTemplateRoundType(tpl.id, i, e.target.value),
          }),
          r.type === 'custom'
            ? selectEl(options(ROUND_COLUMNS), r.column, {
                title: '归属看板列',
                onchange: (e) => actions.updateTemplateRound(tpl.id, i, { column: e.target.value }),
              })
            : h('span', { class: 'tpl-col', title: '归属看板列' }, `→ ${nameOf(COLUMNS, r.column)}`),
          h(
            'span',
            { class: 'tpl-tools' },
            iconBtn('↑', '上移', () => actions.moveTemplateRound(tpl.id, i, -1), i === 0),
            iconBtn('↓', '下移', () => actions.moveTemplateRound(tpl.id, i, 1), i === last),
            iconBtn('✕', '删除', () => actions.removeTemplateRound(tpl.id, i)),
          ),
        ),
      ),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-small',
        onclick: (e) => showMenu(e.currentTarget, roundTypeMenu((type) => actions.addTemplateRound(tpl.id, type))),
      },
      '+ 添加节点',
    ),
  );
}
