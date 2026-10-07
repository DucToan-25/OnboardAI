import { createField, createStatusBadge } from '../common/renderers.js';
import { formatDate } from '../common/format.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { confirmAction, openModal } from '../common/ui.js';
import { STATUS_META } from '../config/statuses.js';

export async function initPage({ currentUser, permissions, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('journey-filters');
  const createButton = root.querySelector('[data-action="open-journey-form"]');
  let ready = false;
  let journeys = [];
  let departments = [];
  let assignments = [];
  let newHires = [];
  let users = [];

  const departmentName = (id) => departments.find((d) => d.id === id)?.name || '—';
  const assignmentsOf = (journeyId) => assignments.filter((a) => a.journeyId === journeyId);
  const statusOptions = Object.entries(STATUS_META.journeys).map(([value, meta]) => ({ value, label: meta.label }));
  createButton.hidden = !permissions.can(currentUser, 'journeys:create');
  createButton.disabled = true;
  filters.elements.status.replaceChildren(new Option('Tất cả', ''), ...statusOptions.map(({ value, label }) => new Option(label, value)));

  function openJourneyForm({ mode = 'create', recordId = null, initialValues = {} } = {}) {
    if (!ready) return;
    const record = journeys.find((j) => j.id === recordId) || null;
    if ((mode === 'edit' && !record) || !permissions.can(currentUser, `journeys:${mode === 'edit' ? 'update' : 'create'}`, record || {})) return;
    const editableFields = permissions.getEditableFields(currentUser, 'journeys', record || {});
    const initial = { status: 'draft', ...record, ...initialValues };
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
      createField({ name: 'name', label: 'Tên hành trình', required: true, value: initial.name || '' }),
      createField({
        name: 'departmentId', label: 'Phòng ban', type: 'select', required: true,
        value: initial.departmentId || '',
        options: [{ value: '', label: '— Chọn phòng ban —' }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
      }),
      createField({
        name: 'status', label: 'Trạng thái', type: 'select', value: initial.status || 'draft',
        options: statusOptions,
      }),
      createField({
        name: 'steps', label: 'Các bước mẫu', type: 'textarea',
        value: Array.isArray(initial.steps) ? initial.steps.join('\n') : '',
        hint: 'Mỗi bước một dòng.',
      }),
    );
    form.append(fields);
    for (const control of form.elements) {
      if (editableFields.includes(control.name)) continue;
      if (control.tagName === 'SELECT') control.disabled = true;
      else control.readOnly = true;
    }
    const notice = document.createElement('div');
    notice.className = 'alert alert--info';
    notice.hidden = !draft;
    const noticeText = document.createElement('p');
    noticeText.className = 'alert__message';
    noticeText.textContent = draft
      ? `Bản nháp của «${initial.name || 'Hành trình mới'}»: ${STATUS_META.journeys[record?.status]?.label || 'Chưa tạo'} → ${STATUS_META.journeys[draft.values.status]?.label || 'Chưa xác định'}. Hủy để bỏ bản nháp; mẫu gốc và hành trình đã gán chưa thay đổi.`
      : 'Bản xem trước — chưa ghi mẫu hành trình vào kho.';
    notice.append(noticeText);
    const actions = document.createElement('div');
    actions.className = 'modal__footer';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn btn--secondary'; cancel.textContent = 'Hủy';
    const save = document.createElement('button');
    save.type = 'submit'; save.className = 'btn btn--primary';
    save.textContent = mode === 'edit' ? 'Lưu thay đổi' : 'Tạo hành trình';
    actions.append(cancel, save);
    form.append(notice, actions);
    content.append(form);
    const modal = openModal({ title: mode === 'edit' ? 'Sửa mẫu hành trình' : 'Tạo mẫu hành trình', content, onClose: () => { draft = null; } });
    cancel.addEventListener('click', () => modal.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!permissions.can(currentUser, `journeys:${mode === 'edit' ? 'update' : 'create'}`, record || {})) return;
      const values = { ...record, ...Object.fromEntries([...new FormData(form).entries()].map(([name, value]) => [name, String(value).trim()])) };
      const { isValid, errors } = validateForm(values, {
        name: [{ type: 'required', message: 'Nhập tên hành trình.' }],
        departmentId: [{ type: 'required', message: 'Chọn phòng ban.' }],
      });
      if (!departments.some((department) => department.id === values.departmentId)) errors.departmentId = 'Chọn phòng ban trong danh sách.';
      if (!STATUS_META.journeys[values.status]) errors.status = 'Chọn trạng thái hợp lệ.';
      applyFormErrors(form, errors);
      if (!isValid || Object.keys(errors).length) return;
      if (values.status === 'archived' && record?.status !== 'archived' && draft?.values.status !== 'archived') {
        if (!permissions.can(currentUser, 'journeys:archive', record || {})) return;
        const accepted = await confirmAction({ title: 'Xem trước lưu trữ mẫu hành trình?', message: record ? `«${record.name}» có ${assignmentsOf(record.id).length} nhân sự đã được gán. Thao tác chỉ thay đổi bản nháp.` : 'Mẫu hành trình mới sẽ được xem trước ở trạng thái lưu trữ.', confirmLabel: 'Lưu trữ', tone: 'danger' });
        if (!accepted) return;
      }
      draft = { mode, recordId, values: Object.fromEntries(editableFields.map((name) => [name, name === 'steps' ? String(values.steps || '').split('\n').map((step) => step.trim()).filter(Boolean) : values[name]])) };
      noticeText.textContent = `Bản xem trước: «${draft.values.name}» có ${draft.values.steps?.length || 0} bước. Chưa ghi mẫu hành trình vào kho.`;
      notice.hidden = false;
      ui.showToast({ message: 'Xem trước thành công. Bản giao diện chưa lưu mẫu hành trình.', type: 'info' });
    });
  }

  function openDetail(journey) {
    const content = document.createElement('div');
    content.className = 'hr-journeys__detail';
    const meta = document.createElement('div');
    meta.className = 'hr-journeys__meta';
    const dept = document.createElement('span');
    dept.textContent = `Phòng ban: ${departmentName(journey.departmentId)}`;
    meta.append(dept, createStatusBadge('journeys', journey.status));
    const stepsHeading = document.createElement('h3');
    stepsHeading.className = 'card__title';
    stepsHeading.textContent = 'Các bước mẫu';
    const steps = document.createElement('ol');
    steps.className = 'hr-journeys__steps';
    const stepList = Array.isArray(journey.steps) && journey.steps.length ? journey.steps : ['Chưa có bước mẫu nào.'];
    for (const step of stepList) {
      const item = document.createElement('li');
      item.textContent = step;
      steps.append(item);
    }
    const assignHeading = document.createElement('h3');
    assignHeading.className = 'card__title';
    assignHeading.textContent = 'Nhân sự đã gán';
    const assignList = document.createElement('div');
    const related = assignmentsOf(journey.id);
    if (!related.length) {
      const empty = document.createElement('p');
      empty.className = 'form-field__hint';
      empty.textContent = 'Chưa có nhân sự gán vào hành trình này.';
      assignList.append(empty);
    } else {
      for (const assignment of related) {
        const newHire = newHires.find((nh) => nh.id === assignment.newHireId);
        const person = users.find((u) => u.id === newHire?.userId);
        const row = document.createElement('div');
        row.className = 'hr-journeys__assignment';
        const name = document.createElement('span');
        name.textContent = person?.fullName || '—';
        const rowMeta = document.createElement('span');
        rowMeta.className = 'hr-journeys__meta';
        const start = document.createElement('span');
        start.textContent = `Bắt đầu: ${formatDate(assignment.startDate)}`;
        rowMeta.append(start, createStatusBadge('journeyAssignments', assignment.status));
        row.append(name, rowMeta);
        assignList.append(row);
      }
    }
    content.append(meta, stepsHeading, steps, assignHeading, assignList);
    openModal({ title: journey.name, content });
  }

  function render() {
    if (!ready) return;
    const search = filters.elements.search.value.trim().toLocaleLowerCase('vi');
    const status = filters.elements.status.value;
    const departmentId = filters.elements.departmentId.value;
    const matches = journeys.filter((journey) => {
      if (status && journey.status !== status) return false;
      if (departmentId && journey.departmentId !== departmentId) return false;
      if (!search) return true;
      return `${journey.name} ${departmentName(journey.departmentId)}`.toLocaleLowerCase('vi').includes(search);
    });
    const tbody = region('journey-rows');
    tbody.replaceChildren();
    for (const journey of matches) {
      const tr = document.createElement('tr');
      tr.dataset.id = journey.id;
      const name = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = journey.name;
      name.append(strong);
      const dept = document.createElement('td');
      dept.textContent = departmentName(journey.departmentId);
      const steps = document.createElement('td');
      steps.className = 'table__cell--numeric';
      steps.textContent = String(Array.isArray(journey.steps) ? journey.steps.length : 0);
      const people = document.createElement('td');
      people.className = 'table__cell--numeric';
      people.textContent = String(assignmentsOf(journey.id).length);
      const st = document.createElement('td');
      st.append(createStatusBadge('journeys', journey.status));
      const acts = document.createElement('td');
      acts.className = 'table__actions';
      const detail = document.createElement('button');
      detail.type = 'button'; detail.className = 'btn btn--ghost btn--sm';
      detail.dataset.action = 'view-journey'; detail.dataset.id = journey.id; detail.textContent = 'Chi tiết';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn--secondary btn--sm';
      edit.dataset.action = 'edit-journey'; edit.dataset.id = journey.id; edit.textContent = 'Sửa';
      acts.append(detail);
      if (permissions.can(currentUser, 'journeys:update', journey)) acts.append(edit);
      if (journey.status !== 'archived' && permissions.can(currentUser, 'journeys:archive', journey)) {
        const archive = document.createElement('button');
        archive.type = 'button'; archive.className = 'btn btn--danger btn--sm';
        archive.dataset.action = 'archive-journey'; archive.dataset.id = journey.id; archive.textContent = 'Lưu trữ';
        acts.append(archive);
      }
      tr.append(name, dept, steps, people, st, acts);
      tbody.append(tr);
    }
    region('journey-table').hidden = matches.length === 0;
    region('journey-summary').textContent = `${matches.length} / ${journeys.length} mẫu hành trình`;
    ui.setViewState(region('journey-state'), {
      status: matches.length ? 'ready' : 'empty',
      message: journeys.length ? 'Không có hành trình phù hợp bộ lọc.' : 'Chưa có mẫu hành trình nào.',
    });
  }

  root.addEventListener('click', async (event) => {
    if (!ready) return;
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const { action, id } = trigger.dataset;
    if (action === 'open-journey-form') openJourneyForm({ mode: 'create' });
    if (action === 'edit-journey') openJourneyForm({ mode: 'edit', recordId: id });
    if (action === 'view-journey') {
      const journey = journeys.find((j) => j.id === id);
      if (journey && permissions.can(currentUser, 'journeys:read', journey)) openDetail(journey);
    }
    if (action === 'archive-journey') {
      const journey = journeys.find((j) => j.id === id);
      if (!journey || !permissions.can(currentUser, 'journeys:archive', journey)) return;
      const referenced = assignmentsOf(journey.id).length;
      const ok = await confirmAction({
        title: 'Lưu trữ mẫu hành trình?',
        message: `«${journey.name}» sẽ chuyển sang trạng thái lưu trữ (xem trước).${referenced ? ` Hiện có ${referenced} nhân sự đang gán vào mẫu này.` : ''}`,
        confirmLabel: 'Lưu trữ',
        tone: 'danger',
      });
      if (ok) openJourneyForm({ mode: 'edit', recordId: journey.id, initialValues: { status: 'archived' } });
    }
  });

  async function loadData() {
    ready = false;
    createButton.disabled = true;
    region('journey-table').hidden = true;
    region('journey-summary').textContent = '';
    ui.setViewState(region('journey-state'), { status: 'loading', message: 'Đang tải dữ liệu hành trình…' });
    try {
      const [{ items: journeyList }, { items: departmentList }, { items: assignmentList }, { items: newHireList }, { items: userList }] = await Promise.all([
        repository.list('journeys'),
        repository.list('departments'),
        repository.list('journeyAssignments'),
        repository.list('newHires'),
        repository.list('users'),
      ]);
      journeys = journeyList;
      departments = departmentList;
      assignments = assignmentList;
      newHires = newHireList;
      users = userList;
      filters.elements.departmentId.replaceChildren(
        new Option('Tất cả phòng ban', ''),
        ...departments.map((d) => new Option(d.name, d.id)),
      );
      ready = true;
      createButton.disabled = false;
      render();
    } catch (error) {
      ui.setViewState(region('journey-state'), { status: 'error', message: error.message || 'Không tải được dữ liệu hành trình.' });
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true });
      region('journey-state').append(retry);
    }
  }

  filters.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  filters.elements.search.addEventListener('input', render);
  filters.elements.status.addEventListener('change', render);
  filters.elements.departmentId.addEventListener('change', render);
  await loadData();
}
