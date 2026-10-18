import { askPolicy, listMyHistory, getHistory, updateHistory, decideHistory, deleteHistory } from '../data/ai-history.js';
import { getDocument } from '../data/resources.js';
import { element, actionButton, createField } from '../common/renderers.js';
import { validateFields } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';
import { formatDateTime } from '../common/format.js';

export async function initPage({ ui }) {
  const region = name => document.querySelector(`[data-region="${name}"]`);
  const form = region('question-form'); form.elements.question.value = ''; form.elements.question.maxLength = 2000;
  let selectedId = null;
  function sourceLink(item) {
    if (!item.result.sourceDocumentId) return element('p', 'form-field__hint', 'Chưa có nguồn tài liệu phù hợp. Hãy xác nhận với HR.');
    try {
      const source = getDocument(item.result.sourceDocumentId);
      const link = element('a', 'btn btn--ghost btn--sm', `Nguồn: ${source.title}`);
      link.href = `document-detail.html?${new URLSearchParams({ id: source.id })}`; return link;
    } catch { return element('p', 'form-field__hint', 'Nguồn hiện không còn khả dụng với tài khoản của bạn.'); }
  }
  function render() {
    const history = listMyHistory('policyQA');
    const selected = history.find(item => item.id === selectedId);
    const conversation = region('conversation'); conversation.replaceChildren();
    if (selected) {
      conversation.append(element('p', 'nh-ai-help__question', selected.input), element('h3', 'nh-ai-help__result-heading', 'Câu trả lời'), element('p', 'nh-ai-help__answer', selected.result.answer), element('h3', 'nh-ai-help__result-heading', 'Vì sao có câu trả lời này?'), element('p', 'form-field__hint', selected.reason), sourceLink(selected));
      const actions = element('div', 'nh-ai-help__note-actions');
      if (selected.decision === 'pending') actions.append(actionButton('Chấp nhận', 'accept-answer', selected.id, 'primary'), actionButton('Sửa', 'edit-answer', selected.id), actionButton('Từ chối', 'reject-answer', selected.id));
      actions.append(actionButton('Tạo lại', 'regenerate-answer', selected.id), actionButton('Lưu', 'save-answer', selected.id));
      conversation.append(actions);
    } else ui.setViewState(conversation, { status: 'empty', message: 'Nhập câu hỏi để tra cứu chính sách từ dữ liệu mẫu.' });
    if (selected) { conversation.hidden = false; conversation.classList.remove('view-state', 'view-state--empty', 'view-state--loading'); conversation.setAttribute('aria-busy', 'false'); }
    region('saved-notes').replaceChildren(...history.map(item => {
      const note = element('article', 'nh-ai-help__note');
      note.append(element('h3', 'nh-ai-help__note-heading', item.input), element('p', 'nh-ai-help__note-meta', `${formatDateTime(item.createdAt)} · ${{ pending: 'Chờ quyết định', accepted: 'Đã chấp nhận', rejected: 'Đã từ chối' }[item.decision]}`), element('p', 'nh-ai-help__note-body', item.result.answer));
      const actions = element('div', 'nh-ai-help__note-actions');
      actions.append(actionButton('Xem', 'view-answer', item.id, 'ghost'));
      if (item.decision === 'pending') actions.append(actionButton('Sửa', 'edit-note', item.id, 'ghost'));
      actions.append(actionButton('Xóa', 'delete-note', item.id, 'ghost')); note.append(actions); return note;
    }));
    if (!history.length) region('saved-notes').append(element('p', 'form-field__hint', 'Chưa có lịch sử hỏi đáp.'));
  }
  const refresh = watchData(['aiHistory', 'documents'], render);
  async function ask(question) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    ui.setViewState(region('conversation'), { status: 'loading', message: 'Đang tra cứu dữ liệu mẫu…' });
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      selectedId = askPolicy(question).id; refresh();
    } catch (error) {
      ui.setViewState(region('conversation'), { status: 'error', message: error.message + ' Bạn có thể gửi lại câu hỏi để thử lại.' });
    } finally { submit.disabled = false; }
  }
  form.addEventListener('submit', event => { event.preventDefault(); if (validateFields(form)) void ask(form.elements.question.value); });
  document.querySelector('#main-content').addEventListener('click', async event => {
    const button = event.target.closest('button[data-id][data-action]'); if (!button) return;
    const id = button.dataset.id; const action = button.dataset.action;
    try {
      const item = getHistory(id);
      if (action === 'view-answer') { selectedId = id; refresh(); }
      if (action === 'regenerate-answer') await ask(item.input);
      if (action === 'accept-answer' || action === 'reject-answer') { decideHistory(id, action === 'accept-answer' ? 'accepted' : 'rejected'); refresh(); }
      if (action === 'save-answer') ui.showToast({ message: 'Câu trả lời đã nằm trong lịch sử của bạn trên trình duyệt này.', type: 'success' });
      if (action === 'delete-note' && await ui.confirmAction({ title: 'Xóa lịch sử hỏi đáp?', message: 'Xóa câu hỏi và câu trả lời đã lưu của bạn.', tone: 'danger' })) {
        deleteHistory(id); if (selectedId === id) selectedId = null; refresh();
      }
      if (action === 'edit-answer' || action === 'edit-note') {
        const editor = element('form', 'form'); editor.noValidate = true;
        editor.append(createField({ name: 'answer', label: 'Câu trả lời cá nhân', type: 'textarea', value: item.result.answer, required: true }));
        const actions = element('div', 'form__actions');
        const cancel = actionButton('Hủy', 'cancel-edit'); const save = actionButton('Lưu', 'save-edit', undefined, 'primary'); save.type = 'submit';
        actions.append(cancel, save); editor.append(actions);
        const modal = ui.openModal({ title: 'Sửa câu trả lời', content: editor });
        cancel.addEventListener('click', () => modal.close());
        editor.addEventListener('submit', async submitEvent => {
          submitEvent.preventDefault(); if (!validateFields(editor)) return;
          try {
            updateHistory(id, { result: { ...getHistory(id).result, answer: editor.elements.answer.value } });
            await modal.close(); refresh(); ui.showToast({ message: 'Đã lưu câu trả lời cá nhân.', type: 'success' });
          } catch (error) { showError(error); }
        });
      }
    } catch (error) { showError(error); }
  });
}
