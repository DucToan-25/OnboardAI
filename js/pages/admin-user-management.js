import * as people from '../data/people.js';
import { listDepartments } from '../data/resources.js';
import { element, actionButton, createStatusBadge, fillSelect } from '../common/renderers.js';
import { openFormTemplate } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';
import { ROLE_LABELS } from '../config/roles.js';

export async function initPage({ ui }) {
  const root = document.querySelector('#main-content'); const region = name => root.querySelector(`[data-region="${name}"]`);
  const filters = region('user-filters'); let users = []; let departments = []; let hires = [];
  function render() {
    users = people.listUsers(); departments = listDepartments(); hires = people.listHires();
    fillSelect(filters.elements.departmentId, departments.map(item => ({ value: item.id, label: item.name })), 'Tất cả phòng ban');
    const values = Object.fromEntries(new FormData(filters));
    const visible = users.filter(user => (!values.search || `${user.fullName} ${user.email}`.toLowerCase().includes(values.search.trim().toLowerCase())) && ['role', 'status', 'departmentId'].every(key => !values[key] || values[key] === user[key]));
    region('user-rows').replaceChildren(...visible.map(user => {
      const row = element('tr'); row.dataset.id = user.id;
      const name = element('td'); name.append(element('strong', '', user.fullName), element('p', 'admin-users__meta', user.email));
      const status = element('td'); status.append(createStatusBadge('users', user.status));
      const actions = element('td', 'table__actions'); actions.append(actionButton('Sửa', 'edit-user', user.id), actionButton(user.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt', 'toggle-user', user.id));
      row.append(name, element('td', '', ROLE_LABELS[user.role]), element('td', '', departments.find(item => item.id === user.departmentId)?.name || '—'), status, actions); return row;
    }));
    region('user-summary').textContent = `${visible.length} / ${users.length} tài khoản`;
    ui.setViewState(region('user-state'), { status: visible.length ? 'ready' : 'empty', message: 'Không có tài khoản phù hợp.' });
  }
  function edit(user = null) {
    let operation = null;
    const hire = user && hires.find(item => item.userId === user.id);
    const options = people.getAssignmentOptions();
    openFormTemplate('open-user-form', { title: user ? 'Sửa tài khoản' : 'Thêm tài khoản', fill(form) {
      fillSelect(form.elements.departmentId, departments.filter(item => item.status === 'active' || item.id === user?.departmentId).map(item => ({ value: item.id, label: item.name })), 'Chưa gán phòng ban');
      fillSelect(form.elements.mentorId, options.users.filter(item => item.role === 'mentor' && (item.status === 'active' || item.id === hire?.mentorId)).map(item => ({ value: item.id, label: `${item.fullName}${item.status === 'active' ? '' : ' (ngừng hoạt động)'}` })), 'Chưa gán mentor');
      fillSelect(form.elements.journeyId, options.journeys.filter(item => item.status === 'active' || item.id === hire?.journeyId).map(item => ({ value: item.id, label: item.title })), 'Chưa gán hành trình');
      for (const key of ['fullName', 'email', 'role', 'departmentId', 'jobTitle', 'status']) if (user) form.elements[key].value = user[key] || '';
      for (const key of ['mentorId', 'journeyId', 'startDate']) if (hire) form.elements[key].value = hire[key] || '';
      form.elements.password.required = !user; form.elements.password.autocomplete = 'new-password';
      function sync() {
        for (const key of ['mentorId', 'journeyId', 'startDate']) { form.elements[key].disabled = form.elements.role.value !== 'newHire'; form.elements[key].closest('.form-field').hidden = form.elements.role.value !== 'newHire'; }
      }
      form.elements.role.addEventListener('change', sync); sync();
    }, onSave(form) {
      const values = Object.fromEntries(new FormData(form));
      const hireInput = { mentorId: values.mentorId || null, journeyId: values.journeyId || null, startDate: values.startDate || null, departmentId: values.departmentId || null, jobTitle: values.jobTitle || null };
      const input = Object.fromEntries(['fullName', 'email', 'password', 'role', 'departmentId', 'jobTitle', 'status'].map(key => [key, values[key]]));
      input.departmentId ||= null; input.jobTitle ||= null;
      if (user) {
        if (!input.password) delete input.password;
        people.updateUserAccount(user.id, input, input.role === 'newHire' ? hireInput : {});
      } else if (input.role === 'newHire') {
        operation ||= people.prepareNewHireCreation(); people.createNewHireAccount(input, hireInput, operation);
      } else people.createUser(input);
      render(); ui.showToast({ message: 'Đã lưu tài khoản và hồ sơ liên quan.', type: 'success' });
    } });
  }
  filters.addEventListener('submit', event => event.preventDefault()); filters.addEventListener('input', render);
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    try {
      if (button.dataset.action === 'open-user-form') edit();
      const user = users.find(item => item.id === button.dataset.id);
      if (button.dataset.action === 'edit-user' && user) edit(user);
      if (button.dataset.action === 'toggle-user' && user && await ui.confirmAction({ title: 'Thay đổi trạng thái tài khoản?', message: `${user.fullName}: ${user.status === 'active' ? 'vô hiệu hóa' : 'kích hoạt'}. Quyền truy cập sẽ được kiểm tra lại.`, tone: user.status === 'active' ? 'danger' : 'primary' })) { people.updateUser(user.id, { status: user.status === 'active' ? 'inactive' : 'active' }); render(); }
    } catch (error) { showError(error); }
  });
  watchData(['users', 'newHires', 'departments', 'journeys'], render, region('user-state'));
}
