import { createAvatar, createField, createStatusBadge } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { confirmAction, openModal } from '../common/ui.js';
import { ROLE_LABELS } from '../config/roles.js';

export async function initPage({ currentUser, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('user-filters');
  let users = [];
  let departments = [];

  const departmentName = (id) => departments.find((d) => d.id === id)?.name || '—';
  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

  function openUserForm({ mode = 'create', recordId = null } = {}) {
    const record = users.find((u) => u.id === recordId) || null;
    const content = document.createElement('div');
    const form = document.createElement('form');
    form.className = 'form';
    form.noValidate = true;
    const fields = document.createElement('div');
    fields.className = 'form__grid';
    fields.append(
      createField({ name: 'fullName', label: 'Họ và tên', required: true, value: record?.fullName || '' }),
      createField({ name: 'email', label: 'Email', type: 'email', required: true, value: record?.email || '' }),
      createField({ name: 'phone', label: 'Số điện thoại', value: record?.phone || '' }),
      createField({
        name: 'role', label: 'Vai trò', type: 'select', required: true,
        value: record?.role || 'newhire', options: roleOptions,
      }),
      createField({
        name: 'departmentId', label: 'Phòng ban', type: 'select',
        value: record?.departmentId || '',
        options: [{ value: '', label: '— Chưa gán —' }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
      }),
      createField({ name: 'jobTitle', label: 'Chức danh', value: record?.jobTitle || '' }),
      createField({
        name: 'status', label: 'Trạng thái', type: 'select', value: record?.status || 'active',
        options: [
          { value: 'active', label: 'Hoạt động' },
          { value: 'disabled', label: 'Vô hiệu hóa' },
        ],
      }),
    );
    form.append(fields);
    if (record) {
      const reference = document.createElement('p');
      reference.className = 'form-field__hint';
      reference.textContent = `Mã tài khoản giữ nguyên: ${record.id}. Vai trò và phòng ban chỉ xem trước ở đợt này.`;
      form.append(reference);
    }
    const notice = document.createElement('div');
    notice.className = 'alert alert--info';
    notice.hidden = true;
    const noticeText = document.createElement('p');
    noticeText.className = 'alert__message';
    noticeText.textContent = 'Bản xem trước — chưa ghi tài khoản vào kho.';
    notice.append(noticeText);
    const actions = document.createElement('div');
    actions.className = 'modal__footer';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn btn--secondary'; cancel.textContent = 'Hủy';
    const save = document.createElement('button');
    save.type = 'submit'; save.className = 'btn btn--primary';
    save.textContent = mode === 'edit' ? 'Lưu thay đổi' : 'Thêm tài khoản';
    actions.append(cancel, save);
    form.append(notice, actions);
    content.append(form);
    const modal = openModal({ title: mode === 'edit' ? 'Sửa tài khoản' : 'Thêm tài khoản', content });
    cancel.addEventListener('click', () => modal.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const { isValid, errors } = validateForm(values, {
        fullName: [{ type: 'required', message: 'Nhập họ và tên.' }],
        email: [
          { type: 'required', message: 'Nhập email.' },
          { type: 'email', message: 'Email chưa đúng định dạng.' },
        ],
      });
      applyFormErrors(form, errors);
      if (!isValid) return;
      notice.hidden = false;
      ui.showToast({ message: 'Xem trước thành công. Bản giao diện chưa lưu tài khoản.', type: 'info' });
    });
  }

  function render() {
    const search = filters.elements.search.value.trim().toLocaleLowerCase('vi');
    const role = filters.elements.role.value;
    const status = filters.elements.status.value;
    const departmentId = filters.elements.departmentId.value;
    const matches = users.filter((user) => {
      if (role && user.role !== role) return false;
      if (status && user.status !== status) return false;
      if (departmentId && user.departmentId !== departmentId) return false;
      if (!search) return true;
      return `${user.fullName} ${user.email}`.toLocaleLowerCase('vi').includes(search);
    });
    const tbody = region('user-rows');
    tbody.replaceChildren();
    for (const user of matches) {
      const tr = document.createElement('tr');
      tr.dataset.id = user.id;
      const account = document.createElement('td');
      const wrap = document.createElement('div');
      wrap.className = 'admin-users__account';
      wrap.append(createAvatar(user, { size: 'sm' }));
      const text = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = user.fullName;
      const email = document.createElement('p');
      email.className = 'admin-users__meta';
      email.textContent = user.email;
      text.append(strong, email);
      wrap.append(text);
      account.append(wrap);
      const roleTd = document.createElement('td');
      roleTd.textContent = ROLE_LABELS[user.role] || user.role;
      const dept = document.createElement('td');
      dept.textContent = departmentName(user.departmentId);
      const st = document.createElement('td');
      st.append(createStatusBadge('users', user.status));
      const acts = document.createElement('td');
      acts.className = 'table__actions';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn--secondary btn--sm';
      edit.dataset.action = 'edit-user'; edit.dataset.id = user.id; edit.textContent = 'Sửa';
      acts.append(edit);
      if (user.id !== currentUser.id) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = user.status === 'active' ? 'btn btn--danger btn--sm' : 'btn btn--ghost btn--sm';
        toggle.dataset.action = user.status === 'active' ? 'disable-user' : 'restore-user';
        toggle.dataset.id = user.id;
        toggle.textContent = user.status === 'active' ? 'Vô hiệu hóa' : 'Khôi phục';
        acts.append(toggle);
      }
      tr.append(account, roleTd, dept, st, acts);
      tbody.append(tr);
    }
    region('user-table').hidden = matches.length === 0;
    region('user-summary').textContent = `${matches.length} / ${users.length} tài khoản`;
    ui.setViewState(region('user-state'), {
      status: matches.length ? 'ready' : 'empty',
      message: users.length ? 'Không có tài khoản phù hợp bộ lọc.' : 'Chưa có tài khoản nào.',
    });
  }

  root.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const { action, id } = trigger.dataset;
    if (action === 'open-user-form') openUserForm({ mode: 'create' });
    if (action === 'edit-user') openUserForm({ mode: 'edit', recordId: id });
    if (action === 'disable-user') {
      const user = users.find((u) => u.id === id);
      if (!user) return;
      const ok = await confirmAction({
        title: 'Vô hiệu hóa tài khoản?',
        message: `«${user.fullName}» sẽ không đăng nhập được sau khi thao tác này được áp dụng (xem trước).`,
        confirmLabel: 'Vô hiệu hóa',
        tone: 'danger',
      });
      if (ok) ui.showToast({ message: 'Xem trước: chưa vô hiệu hóa thật trong kho.', type: 'info' });
    }
    if (action === 'restore-user') {
      const user = users.find((u) => u.id === id);
      if (!user) return;
      const ok = await confirmAction({
        title: 'Khôi phục tài khoản?',
        message: `«${user.fullName}» sẽ chuyển lại trạng thái hoạt động sau khi thao tác được áp dụng (xem trước).`,
        confirmLabel: 'Khôi phục',
        tone: 'primary',
      });
      if (ok) ui.showToast({ message: 'Xem trước: chưa khôi phục thật trong kho.', type: 'info' });
    }
  });

  async function loadData() {
    ui.setViewState(region('user-state'), { status: 'loading', message: 'Đang tải danh sách tài khoản…' });
    try {
      const [{ items: userList }, { items: departmentList }] = await Promise.all([
        repository.list('users'),
        repository.list('departments'),
      ]);
      users = userList;
      departments = departmentList;
      filters.elements.role.replaceChildren(
        new Option('Tất cả vai trò', ''),
        ...roleOptions.map((option) => new Option(option.label, option.value)),
      );
      filters.elements.departmentId.replaceChildren(
        new Option('Tất cả phòng ban', ''),
        ...departments.map((d) => new Option(d.name, d.id)),
      );
      render();
    } catch (error) {
      ui.setViewState(region('user-state'), { status: 'error', message: error.message || 'Không tải được danh sách tài khoản.' });
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true });
      region('user-state').append(retry);
    }
  }

  filters.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  filters.elements.search.addEventListener('input', render);
  filters.elements.role.addEventListener('change', render);
  filters.elements.status.addEventListener('change', render);
  filters.elements.departmentId.addEventListener('change', render);
  await loadData();
}
