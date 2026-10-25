import {
  listMyHistory,
  getHistory,
  saveHistoryDraft,
  decideHistory,
  archiveHistory,
  deleteHistory,
} from '../data/ai-history.js';
import { getDocument } from '../data/resources.js';
import { element, actionButton, createField } from '../common/renderers.js';
import { validateFields } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';
import { formatDateTime } from '../common/format.js';
import { askPolicyWithAi } from '../services/ai-service.js';
import { getAiMode, AI_MODES } from '../config/ai-config.js';
import {
  createAiStatusBar,
  createAiSourceBadge,
  createAiErrorNotice,
} from '../common/ai-ui.js';

export async function initPage({ ui }) {
  const region = (name) => document.querySelector(`[data-region="${name}"]`);
  const form = region('question-form');
  form.elements.question.value = '';
  form.elements.question.maxLength = 2000;
  let draft = null;
  let selectedId = null;
  let generating = false;

  // Gắn thanh trạng thái AI (Status Bar) ngay trước form câu hỏi
  const statusBar = createAiStatusBar({
    ui,
    onModeChange: () => {
      render();
    },
  });
  form.before(statusBar);

  function sourceLink(item) {
    if (!item.result.sourceDocumentId) {
      return element('p', 'form-field__hint', 'Chưa có nguồn tài liệu phù hợp. Hãy xác nhận với HR.');
    }
    try {
      const source = getDocument(item.result.sourceDocumentId);
      const link = element('a', 'btn btn--ghost btn--sm', `Nguồn: ${source.title}`);
      link.href = `document-detail.html?${new URLSearchParams({ id: source.id })}`;
      return link;
    } catch {
      return element('p', 'form-field__hint', 'Nguồn hiện không còn khả dụng với tài khoản của bạn.');
    }
  }

  function currentItem(history) {
    return draft || history.find((item) => item.id === selectedId) || null;
  }

  function render() {
    const history = listMyHistory('policyQA');
    const selected = currentItem(history);
    const conversation = region('conversation');
    conversation.replaceChildren();

    if (selected) {
      const source = selected.aiSource || (selected.reason?.includes('Google Gemini') ? 'gemini' : 'mock');
      const badge = createAiSourceBadge(source, selected.model);

      const headerRow = element('div', 'ai-result__header');

      const questionLabel = element('p', 'nh-ai-help__question', selected.input);
      headerRow.append(questionLabel, badge);

      conversation.append(
        headerRow,
        element('h3', 'nh-ai-help__result-heading', 'Câu trả lời'),
        element('p', 'nh-ai-help__answer', selected.result.answer),
        element('h3', 'nh-ai-help__result-heading', 'Vì sao có câu trả lời này?'),
        element('p', 'form-field__hint', selected.reason),
        sourceLink(selected),
      );

      if (selected.result.uncertain) {
        conversation.append(
          element(
            'p',
            'alert alert--warning',
            'Kết quả chưa chắc chắn hoặc chưa có quy định nội bộ cụ thể; vui lòng xác nhận với HR trước khi áp dụng.',
          ),
        );
      }

      const actions = element('div', 'nh-ai-help__note-actions');
      if (draft) {
        actions.append(
          actionButton('Chấp nhận', 'accept-draft', draft.draftId, 'primary'),
          actionButton('Sửa', 'edit-draft', draft.draftId),
          actionButton('Từ chối', 'reject-draft', draft.draftId),
          actionButton('Tạo lại', 'regenerate-draft', draft.draftId),
          actionButton('Lưu', 'save-draft', draft.draftId),
        );
      } else {
        if (selected.decision === 'pending') {
          actions.append(
            actionButton('Chấp nhận', 'accept-saved', selected.id, 'primary'),
            actionButton('Từ chối', 'reject-saved', selected.id),
          );
        }
        actions.append(
          actionButton('Tạo bản nháp mới', 'regenerate-saved', selected.id),
          actionButton('Đã lưu', 'saved-state', selected.id),
        );
        actions.lastElementChild.disabled = true;
      }
      conversation.append(actions);
      conversation.hidden = false;
      conversation.classList.remove('view-state', 'view-state--empty', 'view-state--loading', 'view-state--error');
      conversation.setAttribute('aria-busy', 'false');
    } else if (!generating) {
      const mode = getAiMode();
      ui.setViewState(conversation, {
        status: 'empty',
        message: mode === AI_MODES.GEMINI
          ? 'Nhập câu hỏi để gửi tới Google Gemini API (đối chiếu tài liệu nội bộ).'
          : 'Nhập câu hỏi để tra cứu chính sách từ dữ liệu mẫu (Mock Mode).',
      });
    }

    const notes = region('saved-notes');
    notes.replaceChildren(...history.map((item) => {
      const note = element('article', 'nh-ai-help__note');
      note.append(
        element('h3', 'nh-ai-help__note-heading', item.input),
        element(
          'p',
          'nh-ai-help__note-meta',
          `${formatDateTime(item.createdAt)} · ${{ pending: 'Chờ quyết định', accepted: 'Đã chấp nhận', rejected: 'Đã từ chối' }[item.decision]}`,
        ),
        element('p', 'nh-ai-help__note-body', item.result.answer),
      );
      const actions = element('div', 'nh-ai-help__note-actions');
      actions.append(
        actionButton('Xem', 'view-answer', item.id, 'ghost'),
        actionButton('Lưu trữ', 'archive-note', item.id, 'ghost'),
        actionButton('Xóa', 'delete-note', item.id, 'ghost'),
      );
      note.append(actions);
      return note;
    }));
    if (!history.length) notes.append(element('p', 'form-field__hint', 'Chưa có lịch sử hỏi đáp.'));
  }

  const refresh = watchData(['aiHistory', 'documents'], render);

  async function generate(question, { forceMock = false } = {}) {
    if (generating) return;
    generating = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const conversation = region('conversation');
    conversation.hidden = false;

    const activeMode = forceMock ? AI_MODES.MOCK : getAiMode();
    ui.setViewState(conversation, {
      status: 'loading',
      message: activeMode === AI_MODES.GEMINI
        ? 'Đang gửi câu hỏi tới Google Gemini API và đối chiếu tài liệu…'
        : 'Đang tra cứu dữ liệu mẫu…',
    });

    try {
      draft = await askPolicyWithAi(question, { forceMock });
      selectedId = null;
      render();
    } catch (error) {
      if (error?.code === 'SUPERSEDED') return;
      draft = null;
      conversation.replaceChildren(
        createAiErrorNotice({
          error,
          onRetry: () => generate(question),
          onFallbackMock: () => generate(question, { forceMock: true }),
          ui,
        }),
      );
      conversation.classList.remove('view-state', 'view-state--empty', 'view-state--loading');
      conversation.hidden = false;
    } finally {
      generating = false;
      submit.disabled = false;
    }
  }

  function persistDraft(decision) {
    const saved = saveHistoryDraft(draft, decision);
    draft = null;
    selectedId = saved.id;
    refresh();
    return saved;
  }

  function editDraft() {
    const editor = element('form', 'form');
    editor.noValidate = true;
    editor.append(createField({
      name: 'answer',
      label: 'Câu trả lời cá nhân',
      type: 'textarea',
      value: draft.result.answer,
      required: true,
    }));
    const actions = element('div', 'form__actions');
    const cancel = actionButton('Hủy', 'cancel-edit');
    const save = actionButton('Áp dụng vào bản nháp', 'save-edit', undefined, 'primary');
    save.type = 'submit';
    actions.append(cancel, save);
    editor.append(actions);
    const modal = ui.openModal({ title: 'Sửa bản nháp câu trả lời', content: editor });
    cancel.addEventListener('click', () => modal.close());
    editor.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateFields(editor)) return;
      draft = {
        ...draft,
        result: { ...draft.result, answer: editor.elements.answer.value.trim() },
      };
      await modal.close();
      render();
      ui.showToast({ message: 'Đã cập nhật bản nháp; chưa ghi vào lịch sử.', type: 'success' });
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (validateFields(form)) void generate(form.elements.question.value);
  });

  document.querySelector('#main-content').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-id][data-action]');
    if (!button) return;
    const { id, action } = button.dataset;
    try {
      if (action === 'view-answer') {
        draft = null;
        selectedId = id;
        render();
      } else if (action === 'regenerate-draft') {
        await generate(draft.input);
      } else if (action === 'regenerate-saved') {
        await generate(getHistory(id).input);
      } else if (action === 'edit-draft') {
        editDraft();
      } else if (action === 'save-draft') {
        persistDraft('pending');
        ui.showToast({ message: 'Đã lưu câu trả lời đúng một lần vào lịch sử.', type: 'success' });
      } else if (action === 'accept-draft' || action === 'reject-draft') {
        persistDraft(action === 'accept-draft' ? 'accepted' : 'rejected');
        ui.showToast({ message: 'Đã lưu câu trả lời và quyết định.', type: 'success' });
      } else if (action === 'accept-saved' || action === 'reject-saved') {
        decideHistory(id, action === 'accept-saved' ? 'accepted' : 'rejected');
        refresh();
      } else if (action === 'archive-note') {
        if (await ui.confirmAction({
          title: 'Lưu trữ lịch sử hỏi đáp?',
          message: 'Bản ghi sẽ được ẩn khỏi danh sách hiện tại nhưng vẫn còn trong dữ liệu đối chiếu.',
        })) {
          archiveHistory(id);
          if (selectedId === id) selectedId = null;
          refresh();
        }
      } else if (action === 'delete-note' && await ui.confirmAction({
        title: 'Xóa lịch sử hỏi đáp?',
        message: 'Xóa vĩnh viễn câu hỏi và câu trả lời đã lưu của bạn.',
        tone: 'danger',
      })) {
        deleteHistory(id);
        if (selectedId === id) selectedId = null;
        refresh();
      }
    } catch (error) {
      showError(error);
    }
  });

  render();
}
