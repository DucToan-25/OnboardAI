import * as tasks from '../data/tasks.js';
import * as history from '../data/ai-history.js';
import { getHireSummaries } from '../data/people.js';
import { element, actionButton, createField, createStatusBadge, fillSelect, createTaskResult } from '../common/renderers.js';
import { bindForm } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';
import { formatDate } from '../common/format.js';
import { STATUS_META } from '../config/statuses.js';

export async function initPage({ ui }) {
  const root = document.querySelector('#main-content');
  const region = name => root.querySelector(`[data-region="${name}"]`);
  const form = region('task-form'); const aiForm = region('checklist-form'); const filters = region('task-filters');
  let hires = []; let items = []; let editingId = null; let selectedHistory = null;
  const requestedId = new URLSearchParams(location.search).get('newHireId');
  fillSelect(filters.elements.status, Object.entries(STATUS_META.tasks).map(([value, meta]) => ({ value, label: meta.label })), 'Tất cả trạng thái');
  function render() {
    hires = getHireSummaries();
    const inScope = id => hires.some(hire => hire.id === id);
    if (form.elements.newHireId.value && !inScope(form.elements.newHireId.value)) reset();
    if (aiForm.elements.newHireId.value && !inScope(aiForm.elements.newHireId.value)) {
      aiForm.reset(); selectedHistory = null; region('checklist-result').replaceChildren(); region('checklist-result').hidden = true;
      ui.setViewState(region('checklist-state'), { status: 'empty', message: 'Phân công mentee đã thay đổi. Hãy chọn lại mentee.' });
    }
    const options = hires.map(hire => ({ value: hire.id, label: hire.user?.fullName || hire.userId }));
    for (const target of [form, aiForm, filters]) fillSelect(target.elements.newHireId, options, target === filters ? 'Tất cả mentee' : 'Chọn mentee');
    items = hires.flatMap(hire => tasks.getTasksForHire(hire.id));
    const search = filters.elements.search.value.trim().toLowerCase();
    const visible = items.filter(item => (!filters.elements.newHireId.value || item.newHireId === filters.elements.newHireId.value) && (!filters.elements.status.value || item.status === filters.elements.status.value) && (!search || item.title.toLowerCase().includes(search)));
    region('task-rows').replaceChildren(...visible.map(item => {
      const row = element('tr'); row.dataset.id = item.id;
      const title = element('td'); title.append(actionButton(item.title, 'view-task', item.id, 'ghost'));
      if (item.linkIssue) title.append(element('p', 'form-field__hint', item.linkIssue));
      const status = element('td'); status.append(createStatusBadge('tasks', item.status));
      const actions = element('td', 'table__actions'); actions.append(actionButton('Sửa', 'edit-task', item.id), actionButton(item.status === 'archived' ? 'Khôi phục' : 'Lưu trữ', item.status === 'archived' ? 'restore-task' : 'archive-task', item.id));
      row.append(title, element('td', '', hires.find(hire => hire.id === item.newHireId)?.user?.fullName || item.newHireId), element('td', '', formatDate(item.dueDate)), status, actions); return row;
    }));
    region('task-count').textContent = `${visible.length} / ${items.length} nhiệm vụ`;
    ui.setViewState(region('task-state'), { status: visible.length ? 'ready' : 'empty', message: 'Không có nhiệm vụ phù hợp.' });
    renderHistory();
  }
  function reset() { editingId = null; form.reset(); form.elements.newHireId.disabled = false; region('task-form-title').textContent = 'Giao nhiệm vụ mới'; }
  bindForm(form, target => {
    const values = Object.fromEntries(new FormData(target));
    if (editingId) tasks.updateTask(editingId, { title: values.title, description: values.description, dueDate: values.dueDate, category: values.category, priority: values.priority });
    else tasks.createTask(values);
    reset(); render(); ui.showToast({ message: 'Đã lưu nhiệm vụ.', type: 'success' });
  });
  function showHistory(item) {
    selectedHistory = item.id;
    const panel = region('checklist-result'); panel.hidden = false; panel.replaceChildren();
    panel.append(element('p', 'ai-panel__explanation', item.reason), element('p', 'form-field__hint', `Quyết định: ${item.decision === 'pending' ? 'Chờ duyệt' : item.decision === 'accepted' ? 'Đã áp dụng' : 'Đã từ chối'}`));
    const list = element('ol');
    item.result.items.forEach(task => list.append(element('li', '', `${task.title} · Hạn ${formatDate(task.dueDate)}`))); panel.append(list);
    const actions = element('div', 'ai-panel__actions');
    if (item.decision === 'pending') actions.append(actionButton('Chấp nhận và giao việc', 'accept-checklist'), actionButton('Sửa', 'edit-checklist'), actionButton('Từ chối', 'reject-checklist'));
    actions.append(actionButton('Tạo lại', 'rerun-checklist'), actionButton('Lưu', 'save-checklist')); panel.append(actions);
  }
  function renderHistory() {
    const list = region('checklist-history'); if (!list) return;
    list.replaceChildren(...history.listMyHistory('checklistPersonalizer').map(item => actionButton(`${item.input} · ${item.decision}`, 'open-checklist', item.id, 'ghost')));
  }
  let generating = false;
  async function generate() {
    if (generating) return;
    generating = true;
    region('checklist-result').hidden = true;
    ui.setViewState(region('checklist-state'), { status: 'loading', message: 'Đang tạo gợi ý…' });
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const item = tasks.suggestChecklist(aiForm.elements.newHireId.value, aiForm.elements.goal.value);
      const dueDate = aiForm.elements.dueDate.value || null;
      const next = history.updateHistory(item.id, { result: { items: item.result.items.map(task => ({ ...task, dueDate })) } });
      showHistory(next); renderHistory(); ui.setViewState(region('checklist-state'), { status: 'ready' });
    } catch (error) { ui.setViewState(region('checklist-state'), { status: 'error', message: error.message }); }
    finally { generating = false; }
  }
  bindForm(aiForm, generate);
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
      } else if (action === 'open-checklist') showHistory(history.getHistory(id));
      else if (action === 'accept-checklist') { button.disabled = true; tasks.applyChecklist(selectedHistory); showHistory(history.getHistory(selectedHistory)); render(); }
      else if (action === 'reject-checklist') { showHistory(history.decideHistory(selectedHistory, 'rejected')); renderHistory(); }
      else if (action === 'save-checklist') {
        history.getHistory(selectedHistory);
        ui.showToast({ message: 'Kết quả đã được lưu trong lịch sử.', type: 'success' });
      }
      else if (action === 'rerun-checklist') {
        const item = history.getHistory(selectedHistory); aiForm.elements.newHireId.value = item.newHireId; aiForm.elements.goal.value = item.input; generate();
      } else if (action === 'edit-checklist') {
        const item = history.getHistory(selectedHistory); const editor = element('form', 'form');
        item.result.items.forEach((task, index) => {
          editor.append(createField({ name: `title-${index}`, label: `Nhiệm vụ ${index + 1}`, value: task.title, required: true }), createField({ name: `date-${index}`, label: 'Hạn hoàn thành', type: 'date', value: task.dueDate }));
        });
        const submit = element('button', 'btn btn--primary', 'Lưu chỉnh sửa'); submit.type = 'submit'; editor.append(submit);
        const modal = ui.openModal({ title: 'Sửa checklist đề xuất', content: editor });
        bindForm(editor, target => {
          const result = { items: item.result.items.map((task, index) => ({ ...task, title: target.elements[`title-${index}`].value, dueDate: target.elements[`date-${index}`].value || null })) };
          showHistory(history.updateHistory(item.id, { result })); modal.close();
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
