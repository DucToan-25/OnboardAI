import { bindForm, bindFilters, notifyUnavailable } from '../common/page-ui.js';
export async function initPage() {
  const region = name => document.querySelector('[data-region="' + name + '"]');
  const form = region('checkin-form'); bindForm(form);
  const requestedId = new URLSearchParams(location.search).get('newHireId');
  if (requestedId && [...form.elements.newHireId.options].some(option => option.value === requestedId)) form.elements.newHireId.value = requestedId;
  bindFilters({ form: region('checkin-filters'), items: region('checkin-list').children, state: region('checkin-state') });
  document.querySelector('#main-content').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit') return;
    if (['reset-checkin','open-checkin-form'].includes(button.dataset.action)) form.reset();
    else if (button.dataset.action === 'edit-checkin') {
      const item = button.closest('.mentor-checkin__item');
      const name = item.querySelector('strong').textContent.trim();
      form.elements.newHireId.value = [...form.elements.newHireId.options].find(option => option.textContent.trim() === name)?.value || '';
      const date = item.querySelector('.form-field__hint').textContent.trim().match(/(\d{2}:\d{2}) (\d{2})\/(\d{2})\/(\d{4})/);
      if (date) form.elements.scheduledAt.value = `${date[4]}-${date[3]}-${date[2]}T${date[1]}`;
      form.elements.situation.value = item.querySelector('.mentor-checkin__note').textContent.trim();
      form.scrollIntoView({ block: 'center' });
    }
    else notifyUnavailable();
  });
}
