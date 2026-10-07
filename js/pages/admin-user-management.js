import { createAvatar, createField, createStatusBadge } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { confirmAction, openModal } from '../common/ui.js';
import { ROLE_LABELS } from '../config/roles.js';
import { STATUS_META } from '../config/statuses.js';

export async function initPage({ currentUser, permissions, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('user-filters');
  const createButton = root.querySelector('[data-action="open-user-form"]');
  let ready = false;
  let users = [];
  let departments = [];

  const departmentName = (id) => departments.find((d) => d.id === id)?.name || '—';
  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
  const statusOptions = Object.entries(STATUS_META.users).map(([value, meta]) => ({ value, label: meta.label }));
  createButton.hidden = !permissions.can(currentUser, 'users:create');
  createButton.disabled = true;
  filters.elements.status.replaceChildren(new Option('Tất cả', ''), ...statusOptions.map(({ value, label }) => new Option(label, value)));

  function openUserForm({ mode = 'create', recordId = null, initialValues = {} } = {}) {
    if (!ready) return;
    const record = users.find((u) => u.id === recordId) || null;
    if ((mode === 'edit' && !record) || !permissions.can(currentUser, `users:${mode === 'edit' ? 'update' : 'create'}`, record || {})) return;
    const editableFields = permissions.getEditableFields(currentUser, 'users', record || {});
    const initial = { status: 'active', ...record, ...initialValues };
    let draft = Object.keys(initialValues).length
      ? { mode, recordId, values: Object.fromEntries(editableFields.map((name) => [name, initial[name]])) }
      : null;
    const content = document.createElement('div');
    const form = document.createElement('form');
    form.className = 'form';
    form.noValidate = true;
    const fields = document.createElement('div');
    fields.className = 'form__grid';
    fields.append(
      createField({ name: 'fullName', label: 'Họ và tên', required: true, value: initial.fullName || '' }),
      createField({ name: 'email', label: 'Email', type: 'email', required: true, value: initial.email || '' }),
      createField({ name: 'phone', label: 'Số điện thoại', type: 'tel', value: initial.phone || '' }),
      createField({
        name: 'role', label: 'Vai trò', type: 'select', required: true,
        value: initial.role || 'newhire', options: roleOptions,
      }),
      createField({
        name: 'departmentId', label: 'Phòng ban', type: 'select',
        value: initial.departmentId || '',
        options: [{ value: '', label: '— Chưa gán —' }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
      }),
      createField({ name: 'jobTitle', label: 'Chức danh', value: initial.jobTitle || '' }),
      createField({
        name: 'status', label: 'Trạng thái', type: 'select', value: initial.status || 'active',
        options: statusOptions,
      }),
    );
    form.append(fields);
    for (const control of form.elements) {
      if (editableFields.includes(control.name)) continue;
      if (control.tagName === 'SELECT') control.disabled = true;
      else control.readOnly = true;
    }
    if (record) {
      const reference = document.createElement('p');
      reference.className = 'form-field__hint';
      reference.textContent = `Mã tài khoản giữ nguyên: ${record.id}. Vai trò và phòng ban chỉ xem trước ở đợt này.`;
      form.append(reference);
    }
    const notice = document.createElement('div');
    notice.className = 'alert alert--info';
    notice.hidden = !draft;
    const noticeText = document.createElement('p');
    noticeText.className = 'alert__message';
    noticeText.textContent = draft
      ? `Bản nháp của «${initial.fullName || 'Tài khoản mới'}»: ${STATUS_META.users[record?.status]?.label || 'Chưa tạo'} → ${STATUS_META.users[draft.values.status]?.label || 'Chưa xác định'}. Hủy để bỏ bản nháp; tài khoản gốc chưa thay đổi.`
      : 'Bản xem trước — chưa ghi tài khoản vào kho.';
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
    const modal = openModal({ title: mode === 'edit' ? 'Sửa tài khoản' : 'Thêm tài khoản', content, onClose: () => { draft = null; } });
    cancel.addEventListener('click', () => modal.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!permissions.can(currentUser, `users:${mode === 'edit' ? 'update' : 'create'}`, record || {})) return;
      const values = { ...record, ...Object.fromEntries([...new FormData(form).entries()].map(([name, value]) => [name, String(value).trim()])) };
      const { isValid, errors } = validateForm(values, {
        fullName: [{ type: 'required', message: 'Nhập họ và tên.' }],
        email: [
          { type: 'required', message: 'Nhập email.' },
          { type: 'email', message: 'Email chưa đúng định dạng.' },
        ],
        phone: [{ type: 'phone', message: 'Số điện thoại chưa đúng định dạng.' }],
      });
      if (!ROLE_LABELS[values.role]) errors.role = 'Chọn vai trò trong danh sách.';
      if (!STATUS_META.users[values.status]) errors.status = 'Chọn trạng thái hợp lệ.';
      if (values.departmentId && !departments.some((department) => department.id === values.departmentId)) errors.departmentId = 'Chọn phòng ban trong danh sách.';
      if (users.some((user) => user.id !== recordId && user.email.toLocaleLowerCase('vi') === values.email?.toLocaleLowerCase('vi'))) errors.email = 'Email này đã thuộc về một tài khoản khác.';
      if (values.status === 'disabled' && record?.id === currentUser.id) errors.status = 'Không thể vô hiệu hóa tài khoản đang sử dụng.';
      applyFormErrors(form, errors);
      if (!isValid || Object.keys(errors).length) return;
      if (values.status !== record?.status && values.status !== draft?.values.status && (record || values.status === 'disabled')) {
        const action = values.status === 'disabled' ? 'disable' : 'restore';
        if (!permissions.can(currentUser, `users:${action}`, record || {})) return;
        const accepted = await confirmAction({ title: values.status === 'disabled' ? 'Xem trước vô hiệu hóa tài khoản?' : 'Xem trước khôi phục tài khoản?', message: `«${record?.fullName || values.fullName}» sẽ được xem trước ở trạng thái ${STATUS_META.users[values.status].label.toLocaleLowerCase('vi')}.`, confirmLabel: values.status === 'disabled' ? 'Vô hiệu hóa' : 'Khôi phục', tone: values.status === 'disabled' ? 'danger' : 'primary' });
        if (!accepted) return;
      }
      draft = { mode, recordId, values: Object.fromEntries(editableFields.map((name) => [name, values[name]])) };
      noticeText.textContent = `Bản xem trước: ${draft.values.fullName} (${ROLE_LABELS[draft.values.role] || 'Chưa xác định'}) — ${STATUS_META.users[draft.values.status]?.label || 'Chưa xác định'}. Chưa ghi tài khoản vào kho.`;
      notice.hidden = false;
      ui.showToast({ message: 'Xem trước thành công. Bản giao diện chưa lưu tài khoản.', type: 'info' });
    });
  }

  function render() {
    if (!ready) return;
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
      if (permissions.can(currentUser, 'users:update', user)) acts.append(edit);
      if (user.id !== currentUser.id && permissions.can(currentUser, `users:${user.status === 'active' ? 'disable' : 'restore'}`, user)) {
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
    if (!ready) return;
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const { action, id } = trigger.dataset;
    if (action === 'open-user-form') openUserForm({ mode: 'create' });
    if (action === 'edit-user') openUserForm({ mode: 'edit', recordId: id });
    if (action === 'disable-user') {
      const user = users.find((u) => u.id === id);
      if (!user || user.id === currentUser.id || !permissions.can(currentUser, 'users:disable', user)) return;
      const ok = await confirmAction({
        title: 'Vô hiệu hóa tài khoản?',
        message: `«${user.fullName}» sẽ không đăng nhập được sau khi thao tác này được áp dụng (xem trước).`,
        confirmLabel: 'Vô hiệu hóa',
        tone: 'danger',
      });
      if (ok) openUserForm({ mode: 'edit', recordId: user.id, initialValues: { status: 'disabled' } });
    }
    if (action === 'restore-user') {
      const user = users.find((u) => u.id === id);
      if (!user || !permissions.can(currentUser, 'users:restore', user)) return;
      const ok = await confirmAction({
        title: 'Khôi phục tài khoản?',
        message: `«${user.fullName}» sẽ chuyển lại trạng thái hoạt động sau khi thao tác được áp dụng (xem trước).`,
        confirmLabel: 'Khôi phục',
        tone: 'primary',
      });
      if (ok) openUserForm({ mode: 'edit', recordId: user.id, initialValues: { status: 'active' } });
    }
  });

  async function loadData() {
    ready = false;
    createButton.disabled = true;
    region('user-table').hidden = true;
    region('user-summary').textContent = '';
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
      ready = true;
      createButton.disabled = false;
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
