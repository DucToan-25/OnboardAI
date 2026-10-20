import { getHireSummaries, getAssignmentOptions, createNewHireProfile, updateHire } from '../data/people.js';
import { element, actionButton, createStatusBadge, fillSelect } from './renderers.js';
import { openFormTemplate } from './page-ui.js';
import { watchData, showError } from './data-ui.js';
import { showToast, setViewState } from './ui.js';

// HR's onboarding editor uses the same people service as Admin's account editor.
export function initHireManagement() {
  const root = document.querySelector('[data-region="hire-management"]'); if (!root) return;
  const region = name => root.querySelector(`[data-region="${name}"]`); let hires = [];
  function render() {
    hires = getHireSummaries(); const search = region('hire-search').value.trim().toLowerCase();
    const visible = hires.filter(hire => !search || `${hire.user?.fullName} ${hire.user?.email}`.toLowerCase().includes(search));
    region('hire-rows').replaceChildren(...visible.map(hire => {
      const row = element('tr'); const status = element('td'); status.append(createStatusBadge('newHires', hire.status));
      const actions = element('td', 'table__actions'); actions.append(actionButton('Gán / sửa hồ sơ', 'edit-hire', hire.id));
      row.append(element('td', '', hire.user?.fullName || hire.userId), element('td', '', hire.mentor?.fullName || 'Chưa gán'), element('td', '', hire.journey?.title || 'Chưa gán'), status, actions); return row;
    }));
    setViewState(region('hire-state'), { status: visible.length ? 'ready' : 'empty', message: 'Không có hồ sơ phù hợp.' });
  }
  function edit(hire = null) {
    const choices = getAssignmentOptions();
    openFormTemplate('open-hire-form', { title: hire ? 'Sửa hồ sơ hội nhập' : 'Tạo hồ sơ cho tài khoản có sẵn', fill(form) {
      fillSelect(form.elements.userId, choices.users.filter(user => user.role === 'newHire' && (user.id === hire?.userId || !hires.some(item => item.userId === user.id))).map(user => ({ value: user.id, label: `${user.fullName} (${user.email})` })), 'Chọn tài khoản nhân sự mới');
      fillSelect(form.elements.mentorId, choices.users.filter(user => user.role === 'mentor' && (user.status === 'active' || user.id === hire?.mentorId)).map(user => ({ value: user.id, label: `${user.fullName}${user.status === 'active' ? '' : ' (ngừng hoạt động)'}` })), 'Chưa gán mentor');
      fillSelect(form.elements.journeyId, choices.journeys.filter(item => item.status === 'active' || item.id === hire?.journeyId).map(item => ({ value: item.id, label: item.title })), 'Chưa gán hành trình');
      if (hire) for (const key of ['userId', 'mentorId', 'journeyId', 'startDate', 'status', 'notes']) form.elements[key].value = hire[key] || '';
      form.elements.userId.disabled = Boolean(hire);
    }, onSave(form) {
      const values = Object.fromEntries(new FormData(form));
      for (const key of ['mentorId', 'journeyId', 'startDate']) values[key] ||= null;
      if (hire) updateHire(hire.id, values); else createNewHireProfile(values);
      render(); showToast({ message: 'Đã lưu hồ sơ hội nhập.', type: 'success' });
    } });
  }
  region('hire-search').addEventListener('input', render);
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    try {
      if (button.dataset.action === 'create-hire') edit();
      if (button.dataset.action === 'edit-hire') edit(hires.find(item => item.id === button.dataset.id));
    } catch (error) { showError(error); }
  });
  watchData(['users', 'newHires', 'journeys', 'departments'], render, region('hire-state'));
}
