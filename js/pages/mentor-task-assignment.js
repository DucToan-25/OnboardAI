import * as tasks from '../data/tasks.js';
import * as history from '../data/ai-history.js';
import { getHireSummaries } from '../data/people.js';
import { element, actionButton, createField, createStatusBadge, fillSelect, createTaskResult } from '../common/renderers.js';
import { bindForm } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';
import { formatDate } from '../common/format.js';
import { STATUS_META } from '../config/statuses.js';
import { generateChecklistWithAi } from '../services/ai-service.js';
import { getAiMode, AI_MODES } from '../config/ai-config.js';
import {
  createAiStatusBar,
  createAiSourceBadge,
  createAiErrorNotice,
} from '../common/ai-ui.js';

const CHECKLIST_CATEGORIES = ['Hội nhập', 'Chuyên môn', 'Kỹ thuật', 'Tài liệu', 'Công cụ', 'Hành chính', 'Check-in'];
const CHECKLIST_PRIORITIES = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
];

export async function initPage({ ui }) {
  const root = document.querySelector('#main-content');
  const region = name => root.querySelector(`[data-region="${name}"]`);
  const form = region('task-form'); const aiForm = region('checklist-form'); const filters = region('task-filters');
  const requestedId = new URLSearchParams(window.location.search).get('newHireId');
  let hires = []; let items = []; let editingId = null; let selectedDraft = null; let selectedHistoryId = null;

  // Gắn thanh trạng thái AI ngay trước form gợi ý checklist
  const statusBar = createAiStatusBar({
    ui,
    onModeChange: () => {
      renderHistory();
    },
  });
  aiForm.before(statusBar);

  function render() {
    hires = getHireSummaries(); items = hires.flatMap(hire => tasks.getTasksForHire(hire.id));
    const hireOptions = hires.map(hire => {
      const name = hire.user?.fullName || hire.fullName || hire.userId;
      const dept = hire.department?.name || hire.departmentName || hire.departmentId || 'Chưa phân phòng ban';
      return {
        value: hire.id,
        label: `${name} (${dept})`,
      };
    });
    fillSelect(form.elements.newHireId, hireOptions, '— Chọn mentee —'); fillSelect(aiForm.elements.newHireId, hireOptions, '— Chọn mentee —');
    fillSelect(filters.elements.newHireId, hireOptions, 'Tất cả mentee');
    const search = filters.elements.search.value.toLowerCase().trim();
    const filterHire = filters.elements.newHireId.value; const filterStatus = filters.elements.status.value;
    const filtered = items.filter(task => {
      if (filterHire && task.newHireId !== filterHire) return false;
      if (filterStatus && task.status !== filterStatus) return false;
      return !search || task.title.toLowerCase().includes(search) || (task.description || '').toLowerCase().includes(search);
    });
    region('task-count').textContent = `${filtered.length} nhiệm vụ`;
    const tbody = region('task-rows'); tbody.replaceChildren();
    if (!filtered.length) {
      const row = element('tr'); const cell = element('td'); cell.colSpan = 5; cell.append(element('div', 'view-state view-state--empty', 'Chưa có nhiệm vụ phù hợp bộ lọc.')); row.append(cell); tbody.append(row);
    } else {
      for (const item of filtered) {
        const hire = hires.find(entry => entry.id === item.newHireId);
        const row = element('tr');
        const titleCell = element('td');
        const viewBtn = actionButton(item.title, 'view-task', item.id, 'ghost');
        titleCell.append(viewBtn);
        if (item.linkIssue) titleCell.append(element('p', 'form-field__hint', 'Nhiệm vụ cần cập nhật lại hành trình cho khớp mentee.'));
        const actions = element('div', 'table__actions');
        actions.append(actionButton('Sửa', 'edit-task', item.id, 'ghost'), actionButton(item.status === 'archived' ? 'Khôi phục' : 'Lưu trữ', item.status === 'archived' ? 'restore-task' : 'archive-task', item.id, 'ghost'));
        row.append(titleCell, element('td', '', createStatusBadge('task', item.status)), element('td', '', hire?.user?.fullName || item.newHireId), element('td', '', formatDate(item.dueDate)), element('td', '', actions));
        tbody.append(row);
      }
    }
    renderHistory();
  }
  function reset() { editingId = null; form.reset(); form.elements.newHireId.disabled = false; region('task-form-title').textContent = 'Giao nhiệm vụ mới'; }
  bindForm(form, target => {
    const values = Object.fromEntries(new FormData(target));
    if (editingId) tasks.updateTask(editingId, { title: values.title, description: values.description, dueDate: values.dueDate, category: values.category, priority: values.priority });
    else tasks.createTask(values);
    reset(); render(); ui.showToast({ message: 'Đã lưu nhiệm vụ.', type: 'success' });
  });
  function showChecklist(item) {
    const isDraft = !item.id;
    selectedDraft = isDraft ? item : null;
    selectedHistoryId = isDraft ? null : item.id;
    const panel = region('checklist-result'); panel.hidden = false; panel.replaceChildren();

    const source = item.aiSource || (item.reason?.includes('Google Gemini') ? 'gemini' : 'mock');
    const badge = createAiSourceBadge(source, item.model);

    const header = element('div', 'ai-result__header');

    const hint = element('p', 'form-field__hint', isDraft
      ? 'Bản nháp chưa được lưu vào lịch sử.'
      : `Quyết định: ${item.decision === 'pending' ? 'Chờ duyệt' : item.decision === 'accepted' ? 'Đã áp dụng' : 'Đã từ chối'}`);
    header.append(hint, badge);

    panel.append(
      header,
      element('p', 'ai-panel__explanation', item.reason),
    );
    const list = element('ol');
    item.result.items.forEach(task => {
      const row = element('li');
      row.append(
        element('strong', '', task.title),
        element('p', 'form-field__hint', `${task.category} · Ưu tiên ${task.priority} · Hạn ${formatDate(task.dueDate)}`),
        element('p', '', task.description),
        element('p', 'form-field__hint', `Lý do: ${task.reason}`),
      );
      list.append(row);
    });
    panel.append(list);
    const actions = element('div', 'ai-panel__actions');
    if (isDraft) {
      actions.append(
        actionButton('Chấp nhận và giao việc', 'accept-checklist'),
        actionButton('Sửa', 'edit-checklist'),
        actionButton('Từ chối', 'reject-checklist'),
        actionButton('Tạo lại', 'rerun-checklist'),
        actionButton('Lưu', 'save-checklist'),
      );
    } else {
      if (item.decision === 'pending') {
        actions.append(
          actionButton('Chấp nhận và giao việc', 'accept-checklist'),
          actionButton('Từ chối', 'reject-checklist'),
        );
      }
      actions.append(actionButton('Tạo bản nháp mới', 'rerun-checklist'));
      const saved = actionButton('Đã lưu', 'saved-checklist');
      saved.disabled = true;
      actions.append(saved);
    }
    panel.append(actions);
  }
  function renderHistory() {
    const list = region('checklist-history'); if (!list) return;
    list.replaceChildren(...history.listMyHistory('checklistPersonalizer').map(item => actionButton(`${item.input} · ${item.decision}`, 'open-checklist', item.id, 'ghost')));
  }
  let generating = false;
  async function generate({ forceMock = false } = {}) {
    if (generating) return;
    generating = true;
    region('checklist-result').hidden = true;
    const activeMode = forceMock ? AI_MODES.MOCK : getAiMode();
    ui.setViewState(region('checklist-state'), {
      status: 'loading',
      message: activeMode === AI_MODES.GEMINI
        ? 'Đang gửi yêu cầu tới Google Gemini API để gợi ý checklist…'
        : 'Đang tạo gợi ý từ dữ liệu mẫu…',
    });
    try {
      const hireId = aiForm.elements.newHireId.value;
      const goal = aiForm.elements.goal.value;
      const dueDate = aiForm.elements.dueDate.value || null;
      const item = await generateChecklistWithAi(hireId, goal, dueDate, { forceMock });
      showChecklist(item);
      ui.setViewState(region('checklist-state'), { status: 'ready' });
    } catch (error) {
      if (error?.code === 'SUPERSEDED') return;
      const stateElem = region('checklist-state');
      stateElem.replaceChildren(
        createAiErrorNotice({
          error,
          onRetry: () => generate(),
          onFallbackMock: () => generate({ forceMock: true }),
          ui,
        }),
      );
      stateElem.classList.remove('view-state--empty', 'view-state--loading');
      stateElem.classList.add('view-state--error');
      stateElem.hidden = false;
    } finally {
      generating = false;
    }
  }
  bindForm(aiForm, () => generate());
  filters.addEventListener('submit', event => event.preventDefault()); filters.addEventListener('input', render);
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]'); if (!button || button.type === 'submit') return;
    const { action, id } = button.dataset;
    try {
      if (['reset-task', 'new-task'].includes(action)) reset();
      else if (action === 'edit-task') {
        const item = items.find(task => task.id === id); if (!item) return;
        editingId = id;
        for (const name of ['newHireId', 'title', 'description', 'dueDate', 'category', 'priority']) form.elements[name].value = item[name] || '';
        form.elements.newHireId.disabled = true; region('task-form-title').textContent = 'Sửa nhiệm vụ'; form.scrollIntoView({ block: 'center' });
      } else if (action === 'view-task') {
        const item = items.find(task => task.id === id);
        if (item) {
          const content = element('div');
          content.append(element('p', '', item.description || 'Chưa có mô tả.'), createTaskResult(item));
          ui.openModal({ title: item.title, content });
        }
      } else if (['archive-task', 'restore-task'].includes(action)) {
        if (!await ui.confirmAction({ title: action === 'archive-task' ? 'Lưu trữ nhiệm vụ?' : 'Khôi phục nhiệm vụ?', message: 'Tiến độ sẽ được tính lại theo thay đổi này.' })) return;
        if (action === 'archive-task') tasks.archiveTask(id); else tasks.updateTask(id, { status: 'todo' }); render();
      } else if (action === 'open-checklist') showChecklist(history.getHistory(id));
      else if (action === 'accept-checklist') {
        button.disabled = true;
        const result = selectedDraft
          ? tasks.acceptChecklistDraft(selectedDraft)
          : tasks.applyChecklist(selectedHistoryId);
        selectedDraft = null;
        selectedHistoryId = result.historyId;
        showChecklist(history.getHistory(result.historyId));
        render();
      }
      else if (action === 'reject-checklist') {
        const saved = selectedDraft
          ? tasks.rejectChecklistDraft(selectedDraft)
          : history.decideHistory(selectedHistoryId, 'rejected');
        selectedDraft = null;
        selectedHistoryId = saved.id;
        showChecklist(saved);
        renderHistory();
      }
      else if (action === 'save-checklist') {
        const saved = tasks.saveChecklistDraft(selectedDraft);
        selectedDraft = null;
        selectedHistoryId = saved.id;
        showChecklist(saved);
        renderHistory();
        ui.showToast({ message: 'Kết quả đã được lưu đúng một lần trong lịch sử.', type: 'success' });
      }
      else if (action === 'rerun-checklist') {
        const item = selectedDraft || history.getHistory(selectedHistoryId);
        aiForm.elements.newHireId.value = item.newHireId;
        aiForm.elements.goal.value = item.input;
        generate();
      } else if (action === 'edit-checklist') {
        const item = selectedDraft;
        if (!item) throw new Error('Chỉ sửa bản nháp chưa lưu. Hãy tạo bản nháp mới từ lịch sử này.');
        const editor = element('form', 'form');
        item.result.items.forEach((task, index) => {
          editor.append(
            createField({ name: `title-${index}`, label: `Nhiệm vụ ${index + 1}`, value: task.title, required: true }),
            createField({ name: `description-${index}`, label: 'Mô tả', type: 'textarea', value: task.description, required: true }),
            createField({ name: `category-${index}`, label: 'Nhóm nhiệm vụ', type: 'select', value: task.category, required: true, options: CHECKLIST_CATEGORIES.map(value => ({ value, label: value })) }),
            createField({ name: `priority-${index}`, label: 'Mức ưu tiên', type: 'select', value: task.priority, required: true, options: CHECKLIST_PRIORITIES }),
            createField({ name: `date-${index}`, label: 'Hạn hoàn thành', type: 'date', value: task.dueDate }),
            createField({ name: `reason-${index}`, label: 'Lý do đề xuất', type: 'textarea', value: task.reason, required: true }),
          );
        });
        const submit = element('button', 'btn btn--primary', 'Lưu chỉnh sửa'); submit.type = 'submit'; editor.append(submit);
        const modal = ui.openModal({ title: 'Sửa checklist đề xuất', content: editor });
        bindForm(editor, target => {
          const result = { items: item.result.items.map((task, index) => ({
            ...task,
            title: target.elements[`title-${index}`].value,
            description: target.elements[`description-${index}`].value,
            category: target.elements[`category-${index}`].value,
            priority: target.elements[`priority-${index}`].value,
            dueDate: target.elements[`date-${index}`].value || null,
            reason: target.elements[`reason-${index}`].value,
          })) };
          selectedDraft = { ...item, result };
          showChecklist(selectedDraft);
          modal.close();
          ui.showToast({ message: 'Đã cập nhật bản nháp; chưa ghi vào lịch sử.', type: 'success' });
        });
      }
    } catch (error) { showError(error); }
    finally { button.disabled = false; }
  });
  render();
  if (requestedId) {
    if (hires.some(hire => hire.id === requestedId)) for (const target of [form, aiForm, filters]) target.elements.newHireId.value = requestedId;
    else ui.setViewState(region('url-state'), { status: 'error', message: 'Mentee không tồn tại hoặc không thuộc phạm vi của bạn.' });
  }
  watchData(['newHires', 'users', 'tasks', 'aiHistory'], render, region('task-state'));
}
