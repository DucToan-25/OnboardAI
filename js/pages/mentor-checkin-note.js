import { getHireSummaries } from '../data/people.js';
import { listCheckins, createCheckin, updateCheckin } from '../data/resources.js';
import { element, actionButton, createStatusBadge, fillSelect } from '../common/renderers.js';
import { bindForm } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';
import { formatDateTime, toDateTimeInput, fromDateTimeInput } from '../common/format.js';

export async function initPage({ ui }) {
  const root = document.querySelector('#main-content');
  const region = name => root.querySelector(`[data-region="${name}"]`);
  const form = region('checkin-form'); const filters = region('checkin-filters');
  let hires = []; let records = []; let editing = null;
  function render() { 
    hires = getHireSummaries(); records = listCheckins();
    console.log('DEBUG: Tổng số bản ghi check-in:', records.length);
    const selectedHire = form.elements.newHireId.value;
    if (selectedHire && !hires.some(hire => hire.id === selectedHire)) {
      reset();
      ui.setViewState(region('url-state'), { status: 'error', message: 'Phân công mentee đã thay đổi. Bản ghi nháp đã được bỏ.' });
    }
    const options = hires.map(hire => ({ value: hire.id, label: hire.user?.fullName || hire.userId }));
    fillSelect(form.elements.newHireId, options, 'Chọn mentee'); fillSelect(filters.elements.newHireId, options, 'Tất cả mentee');
    const visible = records.filter(item => !filters.elements.newHireId.value || item.newHireId === filters.elements.newHireId.value);
    region('checkin-list').replaceChildren(...visible.map(item => {
      const article = element('article', 'mentor-checkin__item'); article.dataset.id = item.id;
      
      const head = element('div', 'mentor-checkin__item-head');
      head.append(element('strong', '', hires.find(hire => hire.id === item.newHireId)?.user?.fullName || item.newHireId), createStatusBadge('checkins', item.status));
      const actions = element('div', 'mentor-checkin__actions'); actions.append(actionButton('Sửa', 'edit-checkin', item.id));
      if (item.status !== 'cancelled') actions.append(actionButton('Hủy lịch', 'cancel-checkin', item.id, 'danger'));
      article.append(head, element('p', 'form-field__hint', `${item.id} · ${formatDateTime(item.scheduledAt)}`), element('p', 'mentor-checkin__note', item.note || 'Chưa có ghi chú.'), element('p', '', item.nextAction || ''), actions);
      if (item.conflictingIds.length) article.append(element('p', 'alert alert--warning', `Trùng lịch với ${item.conflictingIds.join(', ')}. Ghi chú vẫn được giữ riêng; xác nhận với nhóm trước khi hủy hoặc đổi lịch.`));
      return article;
    }));
    ui.setViewState(region('checkin-state'), { status: visible.length ? 'ready' : 'empty', message: 'Chưa có lịch check-in phù hợp.' });
  }
  function reset() { editing = null; form.reset(); form.elements.newHireId.disabled = false; region('form-title').textContent = 'Nội dung trao đổi'; }
  function edit(item) {
    editing = item; form.elements.newHireId.value = item.newHireId; form.elements.newHireId.disabled = true;
    form.elements.scheduledAt.value = toDateTimeInput(item.scheduledAt);
    form.elements.note.value = item.note || ''; form.elements.nextAction.value = item.nextAction || ''; form.elements.status.value = item.status;
    region('form-title').textContent = 'Sửa check-in'; form.scrollIntoView({ block: 'center' });
  }
  bindForm(form, target => {
    const values = Object.fromEntries(new FormData(target));
    values.scheduledAt = editing && values.scheduledAt === toDateTimeInput(editing.scheduledAt) ? editing.scheduledAt : fromDateTimeInput(values.scheduledAt);
    try {
      if (editing) updateCheckin(editing.id, values); else createCheckin(values);
    } catch (error) {
      if (error.existingId) {
        const existing = listCheckins().find(item => item.id === error.existingId);
        if (existing) edit(existing);
      }
      throw error;
    }
    reset(); render(); ui.showToast({ message: 'Đã lưu check-in.', type: 'success' });
  });
  filters.addEventListener('submit', event => event.preventDefault()); filters.addEventListener('change', render);
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]'); if (!button || button.type === 'submit') return;
    try {
      if (['reset-checkin', 'open-checkin-form'].includes(button.dataset.action)) reset();
      if (button.dataset.action === 'edit-checkin') edit(records.find(item => item.id === button.dataset.id));
      if (button.dataset.action === 'cancel-checkin' && await ui.confirmAction({ title: 'Hủy lịch check-in?', message: 'Lịch và ghi chú được giữ để đối chiếu.', tone: 'danger' })) { updateCheckin(button.dataset.id, { status: 'cancelled' }); render(); }
    } catch (error) { showError(error); }
  });
  render();
  const requested = new URLSearchParams(location.search).get('newHireId');
  if (requested && hires.some(hire => hire.id === requested)) { form.elements.newHireId.value = requested; filters.elements.newHireId.value = requested; }
  else if (requested) ui.setViewState(region('url-state'), { status: 'error', message: 'Mentee không tồn tại hoặc không thuộc phạm vi của bạn.' });
  watchData(['users', 'newHires', 'checkins'], render, region('checkin-state'));
}
