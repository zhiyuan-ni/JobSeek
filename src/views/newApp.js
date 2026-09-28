import * as actions from '../actions.js';
import * as store from '../store.js';
import { roundLabel } from '../model/application.js';
import { CATEGORIES, PRIORITIES } from '../model/constants.js';
import { h, options, selectEl } from '../ui/dom.js';
import { openModal } from '../ui/dialogs.js';
import { field } from '../ui/widgets.js';
import { openDetail } from './detail.js';

// 只填最少的信息，创建后直接打开详情抽屉补全
export function openNewAppModal() {
  const { templates } = store.getState();
  const company = h('input', { type: 'text', required: true, autofocus: true, placeholder: '如：字节跳动' });
  const position = h('input', { type: 'text', required: true, placeholder: '如：后端开发工程师' });
  const category = selectEl(options(CATEGORIES, { empty: '—' }), '');
  const priority = selectEl(options(PRIORITIES), 2);
  const deadline = h('input', { type: 'date' });
  const templateOpts = templates.map((t) => ({ id: t.id, name: `${t.name}：${t.rounds.map(roundLabel).join(' → ')}` }));
  const template = selectEl(options(templateOpts, { empty: '不使用模板' }), templates[0]?.id);

  openModal({
    title: '新建投递',
    body: h(
      'div',
      { class: 'form-grid' },
      field('公司', company),
      field('岗位', position),
      field('类别', category),
      field('意向度', priority),
      field('投递截止', deadline),
      field('流程模板', template, { wide: true }),
    ),
    actions: [
      { label: '取消' },
      {
        label: '创建',
        primary: true,
        variant: 'primary',
        onClick: () => {
          const id = actions.createApp(
            {
              company: company.value.trim(),
              position: position.value.trim(),
              category: category.value,
              priority: Number(priority.value),
              deadline: deadline.value,
            },
            template.value,
          );
          openDetail(id);
        },
      },
    ],
  });
}
