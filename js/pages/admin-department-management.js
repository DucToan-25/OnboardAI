import { createField, createStatusBadge } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { confirmAction, openModal } from '../common/ui.js';
import { STATUS_META } from '../config/statuses.js';

export async function initPage({ currentUser, permissions, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('department-filters');
  const createButton = root.querySelector('[data-action="open-department-form"]');
  let ready = false;
  let departments = [];
  let users = [];
  let referenceCounts = new Map();

  const usersOf = (departmentId) => users.filter((u) => u.departmentId === departmentId);
  const referencesOf = (departmentId) => referenceCounts.get(departmentId) || { users: 0, journeys: 0, documents: 0 };
  const referenceText = (departmentId) => {
    const references = referencesOf(departmentId);
    return `${references.users} tài khoản, ${references.journeys} mẫu hành trình và ${references.documents} tài liệu đang tham chiếu`;
  };
  const statusOptions = Object.entries(STATUS_META.departments).map(([value, meta]) => ({ value, label: meta.label }));
  createButton.hidden = !permissions.can(currentUser, 'departments:create');
  createButton.disabled = true;
  filters.elements.status.replaceChildren(new Option('Tất cả', ''), ...statusOptions.map(({ value, label }) => new Option(label, value)));

  function openDepartmentForm({ mode = 'create', recordId = null, initialValues = {} } = {}) {
    if (!ready) return;
    const record = departments.find((d) => d.id === recordId) || null;
    if ((mode === 'edit' && !record) || !permissions.can(currentUser, `departments:${mode === 'edit' ? 'update' : 'create'}`, record || {})) return;
    const editableFields = permissions.getEditableFields(currentUser, 'departments', record || {});
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
      createField({ name: 'name', label: 'Tên phòng ban', required: true, value: initial.name || '' }),
      createField({ name: 'description', label: 'Mô tả', type: 'textarea', value: initial.description || '' }),
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
      reference.textContent = `Mã phòng ban giữ nguyên: ${record.id} · ${referenceText(record.id)}.`;
      form.append(reference);
    }
    const notice = document.createElement('div');
    notice.className = 'alert alert--info';
    notice.hidden = !draft;
    const noticeText = document.createElement('p');
    noticeText.className = 'alert__message';
    noticeText.textContent = draft
      ? `Bản nháp của «${initial.name || 'Phòng ban mới'}»: ${STATUS_META.departments[record?.status]?.label || 'Chưa tạo'} → ${STATUS_META.departments[draft.values.status]?.label || 'Chưa xác định'}. Hủy để bỏ bản nháp; phòng ban gốc chưa thay đổi.`
      : 'Bản xem trước — chưa ghi phòng ban vào kho.';
    notice.append(noticeText);
    const actions = document.createElement('div');
    actions.className = 'modal__footer';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn btn--secondary'; cancel.textContent = 'Hủy';
    const save = document.createElement('button');
    save.type = 'submit'; save.className = 'btn btn--primary';
    save.textContent = mode === 'edit' ? 'Lưu thay đổi' : 'Thêm phòng ban';
    actions.append(cancel, save);
    form.append(notice, actions);
    content.append(form);
    const modal = openModal({ title: mode === 'edit' ? 'Sửa phòng ban' : 'Thêm phòng ban', content, onClose: () => { draft = null; } });
    cancel.addEventListener('click', () => modal.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!permissions.can(currentUser, `departments:${mode === 'edit' ? 'update' : 'create'}`, record || {})) return;
      const values = { ...record, ...Object.fromEntries([...new FormData(form).entries()].map(([name, value]) => [name, String(value).trim()])) };
      const { isValid, errors } = validateForm(values, {
        name: [{ type: 'required', message: 'Nhập tên phòng ban.' }],
      });
      if (!STATUS_META.departments[values.status]) errors.status = 'Chọn trạng thái hợp lệ.';
      applyFormErrors(form, errors);
      if (!isValid || Object.keys(errors).length) return;
      if (values.status === 'archived' && record?.status !== 'archived' && draft?.values.status !== 'archived') {
        if (!permissions.can(currentUser, 'departments:archive', record || {})) return;
        const accepted = await confirmAction({ title: 'Xem trước lưu trữ phòng ban?', message: record ? `«${record.name}» có ${referenceText(record.id)}. Thao tác chỉ thay đổi bản nháp.` : 'Phòng ban mới sẽ được xem trước ở trạng thái lưu trữ.', confirmLabel: 'Lưu trữ', tone: 'danger' });
        if (!accepted) return;
      }
      draft = { mode, recordId, values: Object.fromEntries(editableFields.map((name) => [name, values[name]])) };
      noticeText.textContent = `Bản xem trước: «${draft.values.name}» — ${STATUS_META.departments[draft.values.status]?.label || 'Chưa xác định'}. Chưa ghi phòng ban vào kho.`;
      notice.hidden = false;
      ui.showToast({ message: 'Xem trước thành công. Bản giao diện chưa lưu phòng ban.', type: 'info' });
    });
  }

  function openDetail(department) {
    const content = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'admin-departments__meta';
    const id = document.createElement('span');
    id.textContent = `Mã: ${department.id}`;
    meta.append(id, createStatusBadge('departments', department.status));
    const description = document.createElement('p');
    description.className = 'form-field__hint';
    description.textContent = department.description || 'Chưa có mô tả.';
    const heading = document.createElement('h3');
    heading.className = 'card__title';
    heading.textContent = `Tài khoản tham chiếu (${usersOf(department.id).length})`;
    const people = usersOf(department.id);
    content.append(meta, description, heading);
    const references = document.createElement('p');
    references.className = 'form-field__hint';
    references.textContent = referenceText(department.id);
    content.append(references);
    if (!people.length) {
      const empty = document.createElement('p');
      empty.className = 'form-field__hint';
      empty.textContent = 'Chưa có tài khoản thuộc phòng ban này.';
      content.append(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'admin-departments__users';
      for (const person of people) {
        const item = document.createElement('li');
        item.textContent = `${person.fullName} — ${person.email}`;
        list.append(item);
      }
      content.append(list);
    }
    openModal({ title: department.name, content });
  }

  function render() {
    if (!ready) return;
    const search = filters.elements.search.value.trim().toLocaleLowerCase('vi');
    const status = filters.elements.status.value;
    const matches = departments.filter((department) => {
      if (status && department.status !== status) return false;
      if (!search) return true;
      return `${department.name} ${department.description || ''}`.toLocaleLowerCase('vi').includes(search);
    });
    const tbody = region('department-rows');
    tbody.replaceChildren();
    for (const department of matches) {
      const tr = document.createElement('tr');
      tr.dataset.id = department.id;
      const name = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = department.name;
      const code = document.createElement('p');
      code.className = 'admin-departments__code';
      code.textContent = department.id;
      name.append(strong, code);
      const description = document.createElement('td');
      description.textContent = department.description || '—';
      const count = document.createElement('td');
      count.className = 'table__cell--numeric';
      count.textContent = String(usersOf(department.id).length);
      const st = document.createElement('td');
      st.append(createStatusBadge('departments', department.status));
      const acts = document.createElement('td');
      acts.className = 'table__actions';
      const detail = document.createElement('button');
      detail.type = 'button'; detail.className = 'btn btn--ghost btn--sm';
      detail.dataset.action = 'view-department'; detail.dataset.id = department.id; detail.textContent = 'Chi tiết';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn--secondary btn--sm';
      edit.dataset.action = 'edit-department'; edit.dataset.id = department.id; edit.textContent = 'Sửa';
      acts.append(detail);
      if (permissions.can(currentUser, 'departments:update', department)) acts.append(edit);
      if (department.status !== 'archived' && permissions.can(currentUser, 'departments:archive', department)) {
        const archive = document.createElement('button');
        archive.type = 'button'; archive.className = 'btn btn--danger btn--sm';
        archive.dataset.action = 'archive-department'; archive.dataset.id = department.id; archive.textContent = 'Lưu trữ';
        acts.append(archive);
      }
      tr.append(name, description, count, st, acts);
      tbody.append(tr);
    }
    region('department-table').hidden = matches.length === 0;
    region('department-summary').textContent = `${matches.length} / ${departments.length} phòng ban`;
    ui.setViewState(region('department-state'), {
      status: matches.length ? 'ready' : 'empty',
      message: departments.length ? 'Không có phòng ban phù hợp bộ lọc.' : 'Chưa có phòng ban nào.',
    });
  }

  root.addEventListener('click', async (event) => {
    if (!ready) return;
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const { action, id } = trigger.dataset;
    if (action === 'open-department-form') openDepartmentForm({ mode: 'create' });
    if (action === 'edit-department') openDepartmentForm({ mode: 'edit', recordId: id });
    if (action === 'view-department') {
      const department = departments.find((d) => d.id === id);
      if (department && permissions.can(currentUser, 'departments:read', department)) openDetail(department);
    }
    if (action === 'archive-department') {
      const department = departments.find((d) => d.id === id);
      if (!department || !permissions.can(currentUser, 'departments:archive', department)) return;
      const references = referencesOf(department.id);
      const referenced = references.users + references.journeys + references.documents;
      const ok = await confirmAction({
        title: 'Lưu trữ phòng ban?',
        message: referenced
          ? `«${department.name}» có ${referenceText(department.id)}. Lưu trữ chỉ xem trước trạng thái phòng ban; các bản ghi tham chiếu vẫn được giữ nguyên.`
          : `«${department.name}» sẽ chuyển sang trạng thái lưu trữ (xem trước).`,
        confirmLabel: 'Lưu trữ',
        tone: 'danger',
      });
      if (ok) openDepartmentForm({ mode: 'edit', recordId: department.id, initialValues: { status: 'archived' } });
    }
  });

  async function loadData() {
    ready = false;
    createButton.disabled = true;
    region('department-table').hidden = true;
    region('department-summary').textContent = '';
    ui.setViewState(region('department-state'), { status: 'loading', message: 'Đang tải danh sách phòng ban…' });
    try {
      const [{ items: departmentList }, { items: userList }] = await Promise.all([
        repository.list('departments'),
        repository.list('users'),
      ]);
      departments = departmentList;
      users = userList;
      referenceCounts = new Map(await Promise.all(departments.map(async (department) => [department.id, await repository.getDepartmentReferences(department.id)])));
      ready = true;
      createButton.disabled = false;
      render();
    } catch (error) {
      ui.setViewState(region('department-state'), { status: 'error', message: error.message || 'Không tải được danh sách phòng ban.' });
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true });
      region('department-state').append(retry);
    }
  }

  filters.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  filters.elements.search.addEventListener('input', render);
  filters.elements.status.addEventListener('change', render);
  await loadData();
}
