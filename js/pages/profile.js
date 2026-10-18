import { getMyProfile, updateMyProfile } from '../data/people.js';
import { resetDemoData } from '../data/store.js';
import { createAvatar, createField, element, actionButton } from '../common/renderers.js';
import { validateFields } from '../common/page-ui.js';
import { applyFormErrors } from '../common/validation.js';
import { watchData, showError } from '../common/data-ui.js';
import { ROLE_LABELS } from '../config/roles.js';
import { formatDate } from '../common/format.js';

export async function initPage({ ui }) {
  const region = name => document.querySelector(`[data-region="${name}"]`);
  const form = region('profile-form');
  function render() {
    const { user, hire, department, mentor } = getMyProfile();
    const identity = element('div', 'profile__identity');
    identity.append(createAvatar(user, { size: 'lg' }), element('p', 'profile__name', user.fullName), element('p', 'profile__job', user.jobTitle || 'Chưa cập nhật'), element('span', 'badge badge--info', ROLE_LABELS[user.role]));
    const metadata = element('dl', 'profile__metadata');
    for (const [label, value] of [['Mã tài khoản', user.id], ['Phòng ban', department?.name || 'Chưa phân công'], ...(hire ? [['Ngày bắt đầu', formatDate(hire.startDate)], ['Mentor', mentor?.fullName || 'Chưa phân công']] : [])]) {
      const row = element('div', 'profile__metadata-row'); row.append(element('dt', 'profile__metadata-label', label), element('dd', 'profile__metadata-value', value)); metadata.append(row);
    }
    region('profile-summary').replaceChildren(identity, metadata);
    region('profile-fields').replaceChildren(
      createField({ name: 'fullName', label: 'Họ và tên', value: user.fullName, required: true }),
      createField({ name: 'email', label: 'Email', type: 'email', value: user.email, required: true }),
      createField({ name: 'jobTitle', label: 'Chức danh', value: user.jobTitle, readOnly: true }),
      createField({ name: 'role', label: 'Vai trò', value: ROLE_LABELS[user.role], readOnly: true }));
    region('profile-preview').hidden = true;
    ui.setViewState(region('profile-state'), { status: 'ready' });
  }
  const refresh = watchData(['users', 'newHires', 'departments'], render, region('profile-state'));
  form.addEventListener('submit', event => {
    event.preventDefault(); if (!validateFields(form)) return;
    try {
      updateMyProfile({ fullName: form.elements.fullName.value, email: form.elements.email.value });
      refresh(); ui.showToast({ message: 'Đã lưu hồ sơ trên trình duyệt này.', type: 'success' });
    } catch (error) {
      if (/^Email/.test(error.message)) applyFormErrors(form, { email: error.message });
      else showError(error);
    }
  });
  document.querySelector('[data-action="reset-profile"]').addEventListener('click', refresh);
  const reset = actionButton('Đặt lại dữ liệu demo', 'reset-demo');
  form.querySelector('.form__actions').append(reset);
  reset.addEventListener('click', async () => {
    if (!await ui.confirmAction({ title: 'Đặt lại dữ liệu demo?', message: 'Xóa toàn bộ thay đổi OnboardAI trên trình duyệt này, đăng xuất và nạp lại JSON ban đầu. Dữ liệu website khác được giữ nguyên.', tone: 'danger' })) return;
    reset.disabled = true;
    try { await resetDemoData(); location.assign('login.html'); } catch (error) { showError(error); reset.disabled = false; }
  });
}
