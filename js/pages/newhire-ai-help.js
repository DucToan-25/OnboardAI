import { createField } from '../common/renderers.js';
import { applyFormErrors, validateForm } from '../common/validation.js';
import { formatDate } from '../common/format.js';

export async function initPage({ repository, ui }) {
  const root = document.querySelector('#main-content');
  const form = root.querySelector('[data-region="question-form"]');
  const conversation = root.querySelector('[data-region="conversation"]');
  const notesRoot = root.querySelector('[data-region="saved-notes"]');
  const ask = form.querySelector('[data-action="ask-policy"]');
  let fixture;
  let draft = null;
  let notes = [];
  let processing = false;
  let deleting = false;
  let generation = 0;
  const accessibleDocuments = new Map();

  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function button(label, action, variant = 'secondary') {
    const control = node('button', `btn btn--${variant} btn--sm`, label);
    control.type = 'button'; control.dataset.action = action;
    return control;
  }
  function sources(ids) {
    const links = node('div', 'ai-panel__sources');
    for (const id of ids) {
      const record = accessibleDocuments.get(id);
      if (!record) continue;
      const link = node('a', '', record.title);
      link.href = `document-detail.html?${new URLSearchParams({ id })}`;
      links.append(link);
    }
    return links;
  }
  function resetConversation() {
    conversation.hidden = false;
    conversation.classList.remove('view-state', 'view-state--loading', 'view-state--error', 'view-state--empty');
    conversation.removeAttribute('role'); conversation.removeAttribute('aria-busy');
    conversation.replaceChildren();
  }
  function renderDraft() {
    resetConversation();
    if (!draft) {
      ui.setViewState(conversation, { status: 'empty', message: 'Nhập câu hỏi để xem luồng trả lời và nguồn tham khảo.' });
      return;
    }
    const title = node('h3', 'nh-ai-help__result-heading', 'Câu trả lời mẫu');
    const question = node('p', 'nh-ai-help__question', draft.question);
    const answer = node('div', 'ai-panel__result');
    answer.append(node('p', 'nh-ai-help__answer', draft.answer));
    const explanation = node('div', 'ai-panel__explanation');
    explanation.append(node('h3', 'nh-ai-help__result-heading', 'Vì sao có câu trả lời này?'), node('p', 'form-field__hint', draft.explanation), sources(draft.documentIds));
    const actions = node('div', 'ai-panel__actions');
    const accept = button(draft.accepted ? 'Đã chấp nhận' : 'Chấp nhận', 'accept-answer', 'primary');
    accept.disabled = draft.accepted;
    actions.append(accept, button('Sửa', 'edit-answer'), button('Từ chối', 'reject-answer'), button('Tạo lại', 'regenerate-answer'), button('Lưu', 'save-answer'));
    conversation.append(title, question, answer, explanation, actions);
    if (draft.accepted) conversation.append(node('p', 'form-field__hint', 'Đã chấp nhận bản xem trước. Chính sách và hồ sơ gốc không thay đổi.'));
  }
  function renderNotes() {
    notesRoot.hidden = false;
    notesRoot.classList.remove('view-state', 'view-state--empty');
    notesRoot.replaceChildren();
    if (!notes.length) {
      ui.setViewState(notesRoot, { status: 'empty', message: 'Chưa có ghi chú xem trước.' });
    } else for (const note of notes) {
      const article = node('article', 'nh-ai-help__note'); article.dataset.id = note.id;
      const actions = node('div', 'nh-ai-help__note-actions');
      for (const [label, action] of [['Sửa', 'edit-note'], ['Xóa', 'delete-note']]) {
        const control = button(label, action, 'ghost'); control.dataset.id = note.id;
        control.setAttribute('aria-label', `${label} ghi chú ${note.title}`); actions.append(control);
      }
      article.append(node('h3', 'nh-ai-help__note-heading', note.title), node('p', 'nh-ai-help__note-body', note.body),
        node('p', 'nh-ai-help__note-meta', formatDate(note.updatedAt.slice(0, 10))), sources(note.documentIds), actions);
      notesRoot.append(article);
    }
    const library = node('a', 'btn btn--ghost btn--sm', 'Mở thư viện tài liệu'); library.href = 'newhire-document-library.html'; notesRoot.append(library);
  }
  async function generate() {
    if (processing || !fixture) return;
    const values = { question: form.elements.question.value.trim() };
    const validation = validateForm(values, { question: [
      { type: 'required', message: 'Vui lòng nhập câu hỏi của bạn.' },
      { type: 'maxLength', maxLength: 1000, message: 'Câu hỏi tối đa 1.000 ký tự.' },
    ] });
    applyFormErrors(form, validation.errors);
    if (!validation.isValid) return;
    processing = true;
    const thisGeneration = ++generation;
    ask.disabled = true; ask.classList.add('is-loading');
    const scenario = form.elements.scenario.value;
    form.elements.scenario.disabled = true;
    draft = null;
    ui.setViewState(conversation, { status: 'loading', message: 'Đang chuẩn bị câu trả lời minh họa…' });
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (generation !== thisGeneration) return;
    try {
      if (scenario === 'error') throw new Error('Minh họa lỗi xử lý: chưa thể tạo câu trả lời. Bạn có thể thử lại.');
      if (scenario === 'insufficient' || !fixture.documentIds.every((id) => accessibleDocuments.has(id))) {
        ui.setViewState(conversation, { status: 'empty', message: 'Chưa đủ nguồn tài liệu trong phạm vi của bạn để trả lời câu hỏi này. Hãy mở thư viện hoặc trao đổi với HR.' });
        const link = node('a', 'btn btn--secondary', 'Mở thư viện'); link.href = 'newhire-document-library.html'; conversation.append(link);
        return;
      }
      draft = { question: values.question, answer: fixture.answer, explanation: fixture.explanation, documentIds: [...fixture.documentIds], accepted: false };
      renderDraft();
    } catch (error) {
      ui.setViewState(conversation, { status: 'error', message: error.message });
      conversation.append(button('Thử lại với dữ liệu mẫu', 'retry-answer'));
    } finally {
      processing = false; ask.disabled = false; ask.classList.remove('is-loading'); form.elements.scenario.disabled = false;
    }
  }
  function openEditor({ mode, recordId }) {
    const record = mode === 'note' ? notes.find((item) => item.id === recordId) : draft;
    if (!record) return;
    const initial = { title: mode === 'note' ? record.title : record.question, body: mode === 'note' ? record.body : record.answer };
    const editor = node('form', 'form nh-ai-help__editor'); editor.noValidate = true;
    editor.append(createField({ name: 'title', label: mode === 'note' ? 'Tiêu đề ghi chú' : 'Câu hỏi', value: initial.title, required: true }),
      createField({ name: 'body', label: 'Nội dung ghi chú', type: 'textarea', value: initial.body, required: true }));
    const notice = node('div', 'alert alert--info');
    notice.append(node('p', 'alert__title', 'Nguồn tham khảo'), sources(record.documentIds), node('p', 'form-field__hint', 'Chỉnh sửa ghi chú không thay đổi tài liệu chính sách gốc.'));
    const actions = node('div', 'form__actions');
    const cancel = button('Hủy', 'cancel-note'); const save = button('Lưu ghi chú', 'save-note', 'primary'); save.type = 'submit';
    actions.append(cancel, save); editor.append(notice, actions);
    let allowClose = false;
    const modal = ui.openModal({ title: 'Sửa ghi chú AI', content: editor, onClose: async () => {
      const dirty = editor.elements.title.value !== initial.title || editor.elements.body.value !== initial.body;
      return allowClose || !dirty || await ui.confirmAction({ title: 'Hủy thay đổi chưa lưu?', message: 'Nội dung ghi chú đang chỉnh sửa sẽ bị bỏ.', confirmLabel: 'Bỏ thay đổi', tone: 'danger' });
    } });
    cancel.addEventListener('click', () => modal.close());
    editor.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = { title: editor.elements.title.value.trim(), body: editor.elements.body.value.trim() };
      const result = validateForm(values, {
        title: [{ type: 'required', message: 'Vui lòng nhập tiêu đề.' }, { type: 'maxLength', maxLength: 200, message: 'Tiêu đề tối đa 200 ký tự.' }],
        body: [{ type: 'required', message: 'Vui lòng nhập nội dung.' }, { type: 'maxLength', maxLength: 5000, message: 'Nội dung tối đa 5.000 ký tự.' }],
      });
      applyFormErrors(editor, result.errors);
      if (!result.isValid) return;
      if (mode === 'note') {
        notes = notes.map((note) => note.id === recordId ? { ...note, ...values, updatedAt: new Date().toISOString() } : note);
        renderNotes();
      } else {
        draft = { ...draft, question: values.title, answer: values.body, accepted: false };
        renderDraft();
      }
      allowClose = true; await modal.close();
      ui.showToast({ message: 'Đã cập nhật ghi chú trong bản xem trước. Chưa lưu vào kho.', type: 'info' });
    });
  }
  async function loadData() {
    ask.disabled = true;
    ui.setViewState(conversation, { status: 'loading', message: 'Đang tải nội dung minh họa…' });
    try {
      fixture = (await repository.get('settings', 'system')).aiPreview;
      if (!fixture) throw new Error('Chưa có dữ liệu minh họa cho trợ giúp AI.');
      const ids = [...new Set([...fixture.documentIds, ...(fixture.notes || []).flatMap((note) => note.documentIds)])];
      const records = await Promise.allSettled(ids.map((id) => repository.get('documents', id)));
      accessibleDocuments.clear();
      for (const result of records) if (result.status === 'fulfilled') accessibleDocuments.set(result.value.id, result.value);
      notes = structuredClone(fixture.notes || []).filter((note) => note.documentIds.every((id) => accessibleDocuments.has(id)));
      form.elements.question.value = fixture.question;
      draft = fixture.documentIds.every((id) => accessibleDocuments.has(id)) ? { ...structuredClone(fixture), accepted: false } : null;
      renderDraft(); renderNotes(); ask.disabled = false;
    } catch (error) {
      ui.setViewState(conversation, { status: 'error', message: error.message || 'Không tải được nội dung minh họa.' });
      conversation.append(button('Thử lại', 'reload-ai'));
    }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); void generate(); });
  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || processing) return;
    const action = target.dataset.action;
    if (action === 'reload-ai') await loadData();
    if (action === 'retry-answer') { form.elements.scenario.value = 'success'; await generate(); }
    if (action === 'regenerate-answer') await generate();
    if (action === 'accept-answer' && draft) { draft.accepted = true; renderDraft(); }
    if (action === 'reject-answer' && draft) { draft = null; renderDraft(); ui.showToast({ message: 'Đã từ chối câu trả lời mẫu.', type: 'info' }); }
    if (action === 'edit-answer' && draft) openEditor({ mode: 'answer' });
    if (action === 'edit-note') openEditor({ mode: 'note', recordId: target.dataset.id });
    if (action === 'save-answer' && draft) {
      notes.unshift({ id: `preview-note-${crypto.randomUUID()}`, title: draft.question, body: draft.answer, documentIds: [...draft.documentIds], updatedAt: new Date().toISOString() });
      renderNotes(); ui.showToast({ message: 'Ghi chú được giữ trong bản xem trước của trang này; chưa lưu vào kho.', type: 'info' });
    }
    if (action === 'delete-note' && !deleting) {
      const id = target.dataset.id; const note = notes.find((item) => item.id === id);
      if (!note) return;
      deleting = true;
      try {
        if (await ui.confirmAction({ title: 'Xác nhận xóa', message: `Xóa ghi chú “${note.title}” khỏi bản xem trước?`, confirmLabel: 'Xóa ghi chú', tone: 'danger' })) {
          notes = notes.filter((item) => item.id !== id); renderNotes();
        }
      } finally { deleting = false; }
    }
  });
  window.addEventListener('pagehide', () => { generation += 1; draft = null; notes = []; accessibleDocuments.clear(); }, { once: true });
  await loadData();
}
