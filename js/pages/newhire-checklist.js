import { getMyHire } from '../data/people.js';
import { getTasksForHire, getProgress, updateTaskStatus } from '../data/tasks.js';
import { TASK_STATUSES } from '../config/statuses.js';
import { createTaskItem, createTaskBadge, createField, element, actionButton } from '../common/renderers.js';
import { formatDate } from '../common/format.js';
import { watchData, showError } from '../common/data-ui.js';
import { notifyUnavailable, openFormTemplate, validateFields } from '../common/page-ui.js';

export async function initPage({ ui }) {
  const root = document.querySelector('#main-content');
  const region = name => root.querySelector(`[data-region="${name}"]`);
  const status = region('status-filter'); const search = region('search');
  status.replaceChildren(new Option('Tất cả', ''), ...Object.entries(TASK_STATUSES).filter(([key]) => key !== 'archived').map(([key, value]) => new Option(value.label, key)));
  function render() {
    const hire = getMyHire();
    const tasks = hire ? getTasksForHire(hire.id).filter(item => item.status !== 'archived') : [];
    const progress = hire ? getProgress(hire.id) : { completed: 0, total: 0, percent: 0 };
    region('label').textContent = progress.total ? `Tiến độ hội nhập: ${progress.completed}/${progress.total} nhiệm vụ` : 'Chưa có nhiệm vụ';
    region('percent').textContent = `${progress.percent}%`;
    region('task-progress').querySelector('progress').value = progress.percent;
    const query = search.value.trim().toLocaleLowerCase('vi');
    const visible = tasks.filter(item => (!status.value || item.status === status.value) && `${item.title} ${item.description || ''}`.toLocaleLowerCase('vi').includes(query));
    region('journey-tasks').replaceChildren(...visible.map(task => {
      const row = element('tr'); row.dataset.id = task.id;
      const title = element('td'); title.append(createTaskItem(task, { link: false }));
      const state = element('td'); state.append(createTaskBadge(task.status));
      const actions = element('td', 'table__actions'); actions.append(actionButton('Xem', 'open-task', task.id, 'ghost'));
      row.append(title, element('td', '', formatDate(task.dueDate)), state, actions); return row;
    }));
    region('personal-tasks').replaceChildren();
    region('task-summary').textContent = `${visible.length} / ${tasks.length} nhiệm vụ`;
    ui.setViewState(region('task-state'), { status: visible.length ? 'ready' : 'empty', message: !hire ? 'Chưa có hồ sơ hội nhập. Vui lòng liên hệ HR.' : !tasks.length ? 'Chưa có nhiệm vụ.' : 'Không có nhiệm vụ phù hợp bộ lọc.' });
  }
  const refresh = watchData(['tasks', 'newHires'], render, region('task-state'));
  search.addEventListener('input', refresh); status.addEventListener('change', refresh);
  function openTask(id) {
    const hire = getMyHire();
    const task = hire && getTasksForHire(hire.id).find(item => item.id === id && item.status !== 'archived');
    if (!task) throw new Error('Nhiệm vụ không tồn tại hoặc không thuộc hồ sơ của bạn.');
    const content = document.querySelector('template[data-template="open-task"]').content.cloneNode(true);
    const form = content.querySelector('form');
    form.querySelector('[data-region="task-title"]').textContent = task.title;
    form.querySelector('[data-region="task-badge"]').replaceChildren(createTaskBadge(task.status));
    form.querySelector('[data-region="task-due"]').textContent = `Hạn hoàn thành: ${formatDate(task.dueDate)}`;
    form.querySelector('[data-region="description"]').textContent = task.description || 'Chưa có mô tả.';
    form.querySelector('.alert__message').textContent = 'Cập nhật trạng thái nhiệm vụ của bạn. Thay đổi được lưu trên trình duyệt.';
    form.querySelector('[data-region="result-fields"]').replaceChildren(createField({ name: 'status', label: 'Trạng thái', type: 'select', value: task.status, required: true, options: Object.entries(TASK_STATUSES).filter(([key]) => key !== 'archived').map(([value, entry]) => ({ value, label: entry.label })) }));
    form.querySelector('[data-region="result-fields"]').previousElementSibling.textContent = 'Tiến độ của bạn';
    const submit = form.querySelector('[type="submit"]'); submit.hidden = false; submit.textContent = 'Lưu trạng thái';
    const wrapper = element('div'); wrapper.append(content);
    const modal = ui.openModal({ title: 'Chi tiết nhiệm vụ', content: wrapper });
    wrapper.querySelector('[data-action="cancel-task-result"]').addEventListener('click', () => modal.close());
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!validateFields(form)) return;
      submit.disabled = true;
      try {
        updateTaskStatus(id, form.elements.status.value);
        await modal.close(); refresh();
        ui.showToast({ message: 'Đã lưu trạng thái nhiệm vụ.', type: 'success' });
      } catch (error) { showError(error); } finally { submit.disabled = false; }
    });
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    try {
      if (button.dataset.action === 'open-task') openTask(button.dataset.id);
      if (button.dataset.action === 'add-personal-task') {
        const modal = openFormTemplate('add-personal-task');
        if (!modal) notifyUnavailable();
      }
    } catch (error) { showError(error); }
  });
  const id = new URLSearchParams(location.search).get('id');
  if (id) { try { openTask(id); } catch (error) { showError(error); } }
}
