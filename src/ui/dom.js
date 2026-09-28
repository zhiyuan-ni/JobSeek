// 极简的 DOM 构造工具。文本一律走 textContent，不拼 HTML 字符串

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let value;
  for (const [key, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (key === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (key === 'dataset') Object.assign(el.dataset, v);
    else if (key === 'value') value = v;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), v);
    else el.setAttribute(key, v === true ? '' : v);
  }
  appendChildren(el, children);
  // select 的 value 要等 option 都插进去之后再设
  if (value !== undefined) el.value = value;
  return el;
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
}

// 字符串数组或 { id, name } 数组 → select 的选项
export function options(list, { empty } = {}) {
  const opts = list.map((x) => (typeof x === 'string' ? { value: x, label: x } : { value: x.id, label: x.name }));
  return empty === undefined ? opts : [{ value: '', label: empty }, ...opts];
}

export function selectEl(opts, value, props = {}) {
  return h(
    'select',
    { ...props, value: value ?? '' },
    opts.map((o) => h('option', { value: String(o.value) }, o.label)),
  );
}

// 整块重绘，但保住带 data-key 的输入框的焦点、未提交的输入和光标位置
export function patchChildren(container, ...nodes) {
  const active = document.activeElement;
  let saved = null;
  if (active && container.contains(active) && active.dataset.key) {
    saved = {
      key: active.dataset.key,
      value: active.type === 'file' ? undefined : active.value,
      start: active.selectionStart,
      end: active.selectionEnd,
    };
  }
  container.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
  if (!saved) return;
  const next = container.querySelector(`[data-key="${CSS.escape(saved.key)}"]`);
  if (!next) return;
  if (saved.value !== undefined) next.value = saved.value;
  next.focus({ preventScroll: true });
  try {
    if (saved.start != null) next.setSelectionRange(saved.start, saved.end);
  } catch {}
}
