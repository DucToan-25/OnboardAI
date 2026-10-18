import { openFormTemplate, bindFilters } from '../common/page-ui.js';
export async function initPage() {
  const root = document.querySelector('#main-content');
  const search = root.querySelector('[data-region="search"]');
  const filters = search.closest('form') || search.closest('.toolbar');
  if (!filters.elements) Object.defineProperty(filters, 'elements', { get: () => filters.querySelectorAll('input,select') });
  bindFilters({ form: filters, items: root.querySelectorAll('tbody tr'), state: root.querySelector('[data-region="task-state"]'), summary: root.querySelector('[data-region="task-summary"]'), noun: 'nhiệm vụ' });
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'add-personal-task') openFormTemplate('add-personal-task');
    if (button.dataset.action === 'open-task') {
      const modal = openFormTemplate('open-task');
      const row = button.closest('tr');
      if (modal && row) {
        const title = modal.element.querySelector('[data-region="task-title"]');
        if (title) title.textContent = (row.querySelector('.task-item__title') || row.cells[0]).textContent.trim();
        const due = modal.element.querySelector('[data-region="task-due"]');
        if (due) due.textContent = row.cells[1].textContent.trim();
        const description = modal.element.querySelector('[data-region="description"]');
        if (description) description.textContent = 'Hướng dẫn chi tiết sẽ được cập nhật sau.';
        modal.element.querySelector('[data-region="documents"]')?.replaceChildren();
        const badge = modal.element.querySelector('[data-region="task-badge"]');
        const status = row.querySelector('.badge');
        if (badge && status) badge.replaceChildren(status.cloneNode(true));
      }
    }
  });
  const id = new URLSearchParams(location.search).get('id');
  if (id) [...root.querySelectorAll('[data-action="open-task"]')].find(button => button.dataset.id === id)?.click();
}
