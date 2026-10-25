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
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.dataset.saving === 'true' || !validateFields(form)) return;
    const buttons = [...form.querySelectorAll('[type="submit"]')];
    form.dataset.saving = 'true'; buttons.forEach(button => { button.disabled = true; });
    try { await onValid(form); }
    catch (error) { showToast({ message: error.message, type: 'error' }); }
    finally { delete form.dataset.saving; buttons.forEach(button => { button.disabled = false; }); }
  });
  form.addEventListener('reset', () => applyFormErrors(form, {}));
}

export function openFormTemplate(action, { title, fill, onSave } = {}) {
  const template = document.querySelector(`template[data-template="${action}"]`);
  if (!template) { notifyUnavailable(); return; }
  const content = document.createElement('div');
  content.append(template.content.cloneNode(true));
  const form = content.querySelector('form');
  if (fill && form) fill(form);
  const modal = openModal({ title: title || template.dataset.title, content });
  bindForm(form, onSave ? async target => { await onSave(target); modal.close(); } : notifyUnavailable);
  content.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.type === 'button' && /^(Hủy|Đóng|Quay lại)$/.test(button.textContent.trim())) modal.close();
  });
  return modal;
}
