import * as resources from '../data/resources.js';
import { listUsers } from '../data/people.js';
import { element, actionButton, createStatusBadge, fillSelect } from '../common/renderers.js';
import { openFormTemplate } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';

export async function initPage({ ui }) {
  const root = document.querySelector('#main-content'); const region = name => root.querySelector(`[data-region="${name}"]`);
  const filters = region('department-filters'); let departments = [];
  function render() {
    departments = resources.listDepartments(); const query = Object.fromEntries(new FormData(filters));
    const visible = resources.listDepartments(query);
    region('department-rows').replaceChildren(...visible.map(item => {
      const row = element('tr'); row.dataset.id = item.id;
      const refs = resources.getDepartmentReferences(item.id);
      const status = element('td'); status.append(createStatusBadge('departments', item.status));
      const actions = element('td', 'table__actions'); actions.append(actionButton('Chi tiết', 'view-department', item.id), actionButton('Sửa', 'edit-department', item.id), actionButton(item.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt', 'toggle-department', item.id));
      row.append(element('td', '', item.name), element('td', '', item.description || '—'), element('td', '', refs.users), status, actions); return row;
    }));
    region('department-summary').textContent = `${visible.length} / ${departments.length} phòng ban`;
    ui.setViewState(region('department-state'), { status: visible.length ? 'ready' : 'empty', message: 'Không có phòng ban phù hợp.' });
  }
  function edit(item = null) {
    openFormTemplate('open-department-form', { title: item ? 'Sửa phòng ban' : 'Thêm phòng ban', fill(form) {
      fillSelect(form.elements.managerId, listUsers().filter(user => user.status === 'active' || user.id === item?.managerId).map(user => ({ value: user.id, label: `${user.fullName}${user.status === 'active' ? '' : ' (ngừng hoạt động)'}` })), 'Chưa gán quản lý');
      if (item) for (const key of ['name', 'description', 'managerId', 'status']) form.elements[key].value = item[key] || '';
    }, onSave(form) {
      const values = Object.fromEntries(new FormData(form)); values.managerId ||= null;
      if (item) resources.updateDepartment(item.id, values); else resources.createDepartment(values);
      render(); ui.showToast({ message: 'Đã lưu phòng ban.', type: 'success' });
    } });
  }
  filters.addEventListener('submit', event => event.preventDefault()); filters.addEventListener('input', render);
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    try {
      if (button.dataset.action === 'open-department-form') edit();
      const item = departments.find(dept => dept.id === button.dataset.id); if (!item) return;
      if (button.dataset.action === 'edit-department') edit(item);
      const refs = resources.getDepartmentReferences(item.id);
      const message = `${refs.users} tài khoản, ${refs.newHires} hồ sơ, ${refs.journeys} hành trình, ${refs.documents} tài liệu tham chiếu. Liên kết được giữ nguyên khi vô hiệu hóa.`;
      if (button.dataset.action === 'view-department') ui.openModal({ title: item.name, content: element('p', '', `${item.description || ''} ${message}`) });
      if (button.dataset.action === 'toggle-department' && await ui.confirmAction({ title: 'Thay đổi trạng thái phòng ban?', message, tone: item.status === 'active' ? 'danger' : 'primary' })) { resources.updateDepartment(item.id, { status: item.status === 'active' ? 'inactive' : 'active' }); render(); }
    } catch (error) { showError(error); }
  });
  watchData(['departments', 'users', 'newHires', 'journeys', 'documents'], render, region('department-state'));
}
