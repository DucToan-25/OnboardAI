import { formatDateTime } from '../common/format.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { confirmAction } from '../common/ui.js';

export async function initPage({ repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const form = region('settings-form');
  let record = null;
  let draft = null;

  function fillForm(values) {
    form.elements.question.value = values.question || '';
    form.elements.answer.value = values.answer || '';
    form.elements.explanation.value = values.explanation || '';
    applyFormErrors(form, {});
  }

  function readForm() {
    return {
      question: form.elements.question.value.trim(),
      answer: form.elements.answer.value.trim(),
      explanation: form.elements.explanation.value.trim(),
    };
  }

  function renderNotes() {
    const list = region('notes-list');
    list.replaceChildren();
    const notes = Array.isArray(record?.notes) ? record.notes : [];
    if (!notes.length) {
      const empty = document.createElement('p');
      empty.className = 'form-field__hint';
      empty.textContent = 'Chưa có ghi chú chính sách nào.';
      list.append(empty);
      return;
    }
    for (const note of notes) {
      const card = document.createElement('article');
      card.className = 'card card--compact';
      card.dataset.id = note.id;
      const title = document.createElement('h3');
      title.className = 'card__title';
      title.textContent = note.title;
      const meta = document.createElement('p');
      meta.className = 'admin-settings__note-meta';
      const id = document.createElement('span');
      id.textContent = note.id;
      const updated = document.createElement('span');
      updated.textContent = `Cập nhật: ${formatDateTime(note.updatedAt)}`;
      meta.append(id, updated);
      const body = document.createElement('p');
      body.textContent = note.body;
      card.append(title, meta, body);
      if (Array.isArray(note.documentIds) && note.documentIds.length) {
        const sources = document.createElement('div');
        sources.className = 'admin-settings__note-sources';
        const label = document.createElement('span');
        label.className = 'form-field__hint';
        label.textContent = 'Nguồn:';
        sources.append(label);
        for (const documentId of note.documentIds) {
          const link = document.createElement('a');
          link.href = `document-detail.html?${new URLSearchParams({ id: documentId })}`;
          link.textContent = documentId;
          sources.append(link);
        }
        card.append(sources);
      }
      list.append(card);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readForm();
    const { isValid, errors } = validateForm(values, {
      question: [{ type: 'required', message: 'Nhập câu hỏi mẫu.' }],
      answer: [{ type: 'required', message: 'Nhập câu trả lời mẫu.' }],
    });
    applyFormErrors(form, errors);
    if (!isValid) return;
    draft = values;
    region('settings-notice').hidden = false;
    ui.showToast({ message: 'Xem trước thành công. Bản giao diện chưa lưu cấu hình.', type: 'info' });
  });

  root.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    if (action === 'reset-settings') {
      const ok = await confirmAction({
        title: 'Khôi phục cấu hình mặc định?',
        message: 'Các trường mẫu sẽ trở về nội dung mặc định của bản xem trước (xem trước, chưa ghi hệ thống).',
        confirmLabel: 'Khôi phục',
        tone: 'danger',
      });
      if (!ok) return;
      fillForm({ question: '', answer: '', explanation: '' });
      draft = null;
      region('settings-notice').hidden = false;
      ui.showToast({ message: 'Đã khôi phục biểu mẫu mặc định (chưa ghi hệ thống).', type: 'info' });
    }
    if (action === 'cancel-settings') {
      fillForm(draft || {
        question: record?.aiPreview?.question || '',
        answer: record?.aiPreview?.answer || '',
        explanation: record?.aiPreview?.explanation || '',
      });
      region('settings-notice').hidden = true;
      ui.showToast({ message: 'Đã hủy thay đổi trên biểu mẫu.', type: 'info' });
    }
  });

  async function loadData() {
    ui.setViewState(region('settings-state'), { status: 'loading', message: 'Đang tải cấu hình hệ thống…' });
    try {
      record = await repository.get('settings', 'system');
      fillForm({
        question: record?.aiPreview?.question || '',
        answer: record?.aiPreview?.answer || '',
        explanation: record?.aiPreview?.explanation || '',
      });
      region('settings-record').textContent = `Bản ghi: ${record.id}`;
      renderNotes();
      region('settings-section').hidden = false;
      ui.setViewState(region('settings-state'), { status: 'ready' });
      ui.initTabs(region('settings-tabs'));
    } catch (error) {
      ui.setViewState(region('settings-state'), { status: 'error', message: error.message || 'Không tải được cấu hình hệ thống.' });
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true });
      region('settings-state').append(retry);
    }
  }

  await loadData();
}
