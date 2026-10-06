import { createField, createStatusBadge } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { confirmAction, openModal } from '../common/ui.js';

export async function initPage({ repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('department-filters');
  let departments = [];
  let users = [];

  const usersOf = (departmentId) => users.filter((u) => u.departmentId === departmentId);

  function openDepartmentForm({ mode = 'create', recordId = null } = {}) {
    const record = departments.find((d) => d.id === recordId) || null;
    const content = document.createElement('div');
    const form = document.createElement('form');
    form.className = 'form';
    form.noValidate = true;
    const fields = document.createElement('div');
    fields.className = 'form__grid';
    fields.append(
      createField({ name: 'name', label: 'Tên phòng ban', required: true, value: record?.name || '' }),
      createField({ name: 'description', label: 'Mô tả', type: 'textarea', value: record?.description || '' }),
      createField({
        name: 'status', label: 'Trạng thái', type: 'select', value: record?.status || 'active',
        options: [
          { value: 'active', label: 'Hoạt động' },
          { value: 'archived', label: 'Đã lưu trữ' },
        ],
      }),
    );
    form.append(fields);
    if (record) {
      const reference = document.createElement('p');
      reference.className = 'form-field__hint';
      reference.textContent = `Mã phòng ban giữ nguyên: ${record.id} · ${usersOf(record.id).length} tài khoản đang tham chiếu.`;
      form.append(reference);
    }
    const notice = document.createElement('div');
    notice.className = 'alert alert--info';
    notice.hidden = true;
    const noticeText = document.createElement('p');
    noticeText.className = 'alert__message';
    noticeText.textContent = 'Bản xem trước — chưa ghi phòng ban vào kho.';
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
    const modal = openModal({ title: mode === 'edit' ? 'Sửa phòng ban' : 'Thêm phòng ban', content });
    cancel.addEventListener('click', () => modal.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const { isValid, errors } = validateForm(values, {
        name: [{ type: 'required', message: 'Nhập tên phòng ban.' }],
      });
      applyFormErrors(form, errors);
      if (!isValid) return;
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
      acts.append(detail, edit);
      if (department.status !== 'archived') {
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
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const { action, id } = trigger.dataset;
    if (action === 'open-department-form') openDepartmentForm({ mode: 'create' });
    if (action === 'edit-department') openDepartmentForm({ mode: 'edit', recordId: id });
    if (action === 'view-department') {
      const department = departments.find((d) => d.id === id);
      if (department) openDetail(department);
    }
    if (action === 'archive-department') {
      const department = departments.find((d) => d.id === id);
      if (!department) return;
      const referenced = usersOf(department.id).length;
      const ok = await confirmAction({
        title: 'Lưu trữ phòng ban?',
        message: referenced
          ? `«${department.name}» có ${referenced} tài khoản đang tham chiếu. Lưu trữ chỉ đổi trạng thái bản ghi (xem trước), không vô hiệu hóa tài khoản.`
          : `«${department.name}» sẽ chuyển sang trạng thái lưu trữ (xem trước).`,
        confirmLabel: 'Lưu trữ',
        tone: 'danger',
      });
      if (ok) ui.showToast({ message: 'Xem trước: chưa lưu trữ thật trong kho.', type: 'info' });
    }
  });

  async function loadData() {
    ui.setViewState(region('department-state'), { status: 'loading', message: 'Đang tải danh sách phòng ban…' });
    try {
      const [{ items: departmentList }, { items: userList }] = await Promise.all([
        repository.list('departments'),
        repository.list('users'),
      ]);
      departments = departmentList;
      users = userList;
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
