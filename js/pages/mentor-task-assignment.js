import { bindForm, bindFilters, notifyUnavailable, openRowDetail, fillFromRow } from '../common/page-ui.js';
export async function initPage() {
  const root = document.querySelector('#main-content');
  const region = name => root.querySelector('[data-region="' + name + '"]');
  const form = region('task-form');
  const requestedId = new URLSearchParams(location.search).get('newHireId');
  if (requestedId && [...form.elements.newHireId.options].some(option => option.value === requestedId)) form.elements.newHireId.value = requestedId;
  bindForm(form); bindForm(region('checklist-form'));
  bindFilters({ form: region('task-filters'), items: region('task-rows').children, state: region('task-state'), summary: region('task-count'), noun: 'nhiệm vụ' });
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit') return;
    const action = button.dataset.action;
    if (['reset-task','new-task'].includes(action)) form.reset();
    else if (action === 'edit-task') { fillFromRow(form, button.closest('tr'), { title: 0, newHireId: 1 }); form.scrollIntoView({ block: 'center' }); }
    else if (action === 'view-task') openRowDetail(button);
    else notifyUnavailable();
  });
}
