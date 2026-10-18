import { bindForm, notifyUnavailable } from '../common/page-ui.js';
import { createField } from '../common/renderers.js';
export async function initPage({ ui }) {
  const root = document.querySelector('#main-content');
  bindForm(root.querySelector('[data-region="question-form"]'));
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit') return;
    if (button.dataset.action === 'edit-answer' || button.dataset.action === 'edit-note') {
      const note = button.closest('.nh-ai-help__note');
      const body = note?.querySelector('.nh-ai-help__note-body') || root.querySelector('.nh-ai-help__answer');
      const form = document.createElement('form'); form.className = 'form'; form.noValidate = true;
      form.append(createField({ name: 'body', label: 'Nội dung', type: 'textarea', value: body.textContent.trim(), required: true }));
      const actions = document.createElement('div'); actions.className = 'form__actions';
      const save = document.createElement('button'); save.className = 'btn btn--primary'; save.type = 'submit'; save.textContent = 'Lưu';
      const cancel = document.createElement('button'); cancel.className = 'btn btn--secondary'; cancel.type = 'button'; cancel.textContent = 'Hủy';
      actions.append(cancel, save); form.append(actions);
      const modal = ui.openModal({ title: note ? 'Sửa ghi chú' : 'Sửa câu trả lời', content: form });
      cancel.addEventListener('click', () => modal.close()); bindForm(form);
    } else notifyUnavailable();
  });
}
