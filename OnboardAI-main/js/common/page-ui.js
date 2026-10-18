import { applyFormErrors, validateForm } from './validation.js';
import { openModal, showToast, setViewState } from './ui.js';

export function notifyUnavailable() {
  showToast({ message: 'Chức năng này chưa được kết nối dữ liệu.', type: 'info' });
}

export function validateFields(form) {
  const values = {}; const rules = {}; const errors = {};
  for (const control of form.elements) {
    if (!control.name || control.disabled || control.readOnly || ['submit', 'button', 'checkbox'].includes(control.type)) continue;
    values[control.name] = control.value.trim();
    rules[control.name] = [];
    if (control.required) rules[control.name].push({ type: 'required', message: 'Vui lòng điền trường này.' });
    const type = { email: 'email', tel: 'phone', date: 'date', 'datetime-local': 'datetime', url: 'url' }[control.type];
    if (type) rules[control.name].push({ type });
    if (control.maxLength > 0) rules[control.name].push({ type: 'maxLength', maxLength: control.maxLength });
    if (control.type === 'number' && control.value !== '') {
      const number = Number(control.value);
      if (!Number.isFinite(number) || (control.min !== '' && number < Number(control.min)) || (control.max !== '' && number > Number(control.max))) errors[control.name] = 'Giá trị nằm ngoài giới hạn cho phép.';
    }
  }
  Object.assign(errors, validateForm(values, rules).errors);
  applyFormErrors(form, errors);
  return !Object.keys(errors).length;
}

export function bindForm(form, onValid = notifyUnavailable) {
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (validateFields(form)) onValid(form);
  });
  form.addEventListener('reset', () => applyFormErrors(form, {}));
}

export function openFormTemplate(action, { title, fill } = {}) {
  const template = document.querySelector(`template[data-template="${action}"]`);
  if (!template) { notifyUnavailable(); return; }
  const content = document.createElement('div');
  content.append(template.content.cloneNode(true));
  const form = content.querySelector('form');
  if (fill && form) fill(form);
  const modal = openModal({ title: title || template.dataset.title, content });
  bindForm(form);
  content.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.type === 'button' && /^(Hủy|Đóng|Quay lại)$/.test(button.textContent.trim())) modal.close();
  });
  return modal;
}

// Bộ lọc chỉ ẩn/hiện các hàng HTML tĩnh, không đọc hoặc ghi kho dữ liệu.
export function bindFilters({ form, items, state, summary, noun = 'kết quả' }) {
  if (!form) return;
  const rows = [...items];
  function filter() {
    let count = 0;
    for (const row of rows) {
      const text = row.textContent.replace(/\s+/g, ' ').toLocaleLowerCase('vi');
      const match = [...form.elements].filter(control => control.name && !control.disabled).every(control => {
        if (!control.value || control.type === 'submit') return true;
        const value = control.tagName === 'SELECT' ? control.selectedOptions[0]?.textContent.trim() : control.value.trim();
        return text.includes((value || '').toLocaleLowerCase('vi'));
      });
      row.hidden = !match;
      if (match) count++;
    }
    if (state) setViewState(state, { status: count ? 'ready' : 'empty', message: 'Không có nội dung phù hợp bộ lọc.' });
    if (summary) summary.textContent = `${count} / ${rows.length} ${noun}`;
  }
  form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
}

export function openRowDetail(button) {
  const row = button.closest('tr');
  if (!row) { notifyUnavailable(); return; }
  const headings = [...row.closest('table').querySelectorAll('thead th')];
  const content = document.createElement('dl'); content.className = 'form__grid';
  [...row.cells].forEach((cell, index) => {
    if (cell.classList.contains('table__actions')) return;
    const term = document.createElement('dt'); term.textContent = headings[index]?.textContent.trim() || '';
    const description = document.createElement('dd');
    const copy = cell.cloneNode(true);
    copy.querySelectorAll('button').forEach(node => node.replaceWith(document.createTextNode(node.textContent.trim())));
    description.textContent = copy.textContent.replace(/\s+/g, ' ').trim();
    content.append(term, description);
  });
  openModal({ title: 'Thông tin chi tiết', content });
}

export function fillFromRow(form, row, columns) {
  if (!row) return;
  for (const [name, source] of Object.entries(columns)) {
    const [index, selector] = Array.isArray(source) ? source : [source];
    const control = form.elements.namedItem(name); const cell = row.cells[index];
    if (!control || !cell) continue;
    const value = (cell.querySelector(selector || 'strong') || cell).textContent.trim();
    if (control.tagName === 'SELECT') control.value = [...control.options].find(option => option.textContent.trim() === value)?.value || '';
    else control.value = value;
  }
}

export function initTablePage({ prefix, template, columns = {}, filterRegion = `${prefix}-filters`, rowsRegion = `${prefix}-rows`, stateRegion = `${prefix}-state`, summaryRegion = `${prefix}-summary` }) {
  const root = document.querySelector('#main-content');
  const region = name => root.querySelector(`[data-region="${name}"]`);
  bindFilters({ form: region(filterRegion), items: region(rowsRegion)?.children || [], state: region(stateRegion), summary: region(summaryRegion) });
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit') return;
    const action = button.dataset.action;
    if (action === template) openFormTemplate(template);
    else if (action.startsWith('edit-') && template) openFormTemplate(template, {
      title: 'Chỉnh sửa thông tin', fill: form => fillFromRow(form, button.closest('tr'), columns),
    });
    else if (action.startsWith('view-') || action.startsWith('open-')) openRowDetail(button);
    else notifyUnavailable();
  });
}
