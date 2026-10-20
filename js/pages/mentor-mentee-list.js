import { getHireSummaries } from '../data/people.js';
import { getProgress, getTasksForHire } from '../data/tasks.js';
import { element, actionButton, createStatusBadge, fillSelect, createTaskResult } from '../common/renderers.js';
import { formatDate, getTodayDate } from '../common/format.js';
import { watchData } from '../common/data-ui.js';
import { STATUS_META } from '../config/statuses.js';

export async function initPage({ ui }) {
  const root = document.querySelector('#main-content');
  const region = name => root.querySelector(`[data-region="${name}"]`);
  const filters = region('mentee-filters');
  fillSelect(filters.elements.status, Object.entries(STATUS_META.newHires).map(([value, meta]) => ({ value, label: meta.label })), 'Tất cả trạng thái');
  let hires = [];
  function render() {
    hires = getHireSummaries();
    const search = filters.elements.search.value.trim().toLocaleLowerCase('vi');
    const status = filters.elements.status.value;
    const visible = hires.filter(hire => (!status || hire.status === status) && (!search || `${hire.user?.fullName} ${hire.user?.email}`.toLocaleLowerCase('vi').includes(search)));
    const values = [hires.length, hires.filter(hire => hire.status === 'inProgress').length, hires.filter(hire => getTasksForHire(hire.id).some(task => task.status === 'blocked' || task.status !== 'completed' && task.status !== 'archived' && task.dueDate && task.dueDate < getTodayDate())).length];
    region('mentee-stats').querySelectorAll('.stat-card__value').forEach((node, index) => { node.textContent = values[index]; });
    region('mentee-rows').replaceChildren(...visible.map(hire => {
      const row = element('tr'); row.dataset.id = hire.id;
      const name = element('td'); name.append(element('strong', '', hire.user?.fullName || hire.userId), element('p', 'form-field__hint', hire.user?.email || ''));
      const progress = getProgress(hire.id);
      const statusCell = element('td'); statusCell.append(createStatusBadge('newHires', hire.status));
      const actions = element('td', 'table__actions'); actions.append(actionButton('Chi tiết', 'open-mentee', hire.id));
      for (const [page, title] of [['mentor-task-assignment', 'Giao việc'], ['mentor-checkin-note', 'Check-in']]) {
        const link = element('a', 'btn btn--ghost btn--sm', title); link.href = `${page}.html?${new URLSearchParams({ newHireId: hire.id })}`; actions.append(link);
      }
      row.append(name, element('td', '', hire.department?.name || '—'), element('td', '', formatDate(hire.startDate)), element('td', '', `${progress.percent}% (${progress.completed}/${progress.total})`), statusCell, actions);
      return row;
    }));
    ui.setViewState(region('list-state'), { status: visible.length ? 'ready' : 'empty', message: 'Không có mentee phù hợp.' });
  }
  filters.addEventListener('submit', event => event.preventDefault());
  filters.addEventListener('input', render);
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action="open-mentee"]');
    const hire = button && hires.find(item => item.id === button.dataset.id);
    if (!hire) return;
    const content = element('div');
    content.append(element('p', '', `Hành trình: ${hire.journey?.title || 'Chưa gán'}`), element('p', '', hire.notes || 'Chưa có ghi chú.'));
    for (const task of getTasksForHire(hire.id)) {
      const line = element('p', '', `${task.title} · ${formatDate(task.dueDate)} `); line.append(createStatusBadge('tasks', task.status)); content.append(line);
      if (task.result) content.append(createTaskResult(task));
    }
    ui.openModal({ title: hire.user?.fullName || hire.userId, content });
  });
  watchData(['newHires', 'users', 'tasks', 'departments', 'journeys'], render, region('list-state'));
}
