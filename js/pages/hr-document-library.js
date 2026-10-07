import { createStatusBadge, createField } from '../common/renderers.js';
import { formatDateTime } from '../common/format.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { STATUS_META } from '../config/statuses.js';
import { ROLE_LABELS } from '../config/roles.js';

export async function initPage({ currentUser, repository, permissions, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('document-filters');
  let documents = [];
  let departments = [];
  let documentDraft = null;
  let busy = false;
  let ready = false;
  const canCreate = permissions.can(currentUser, 'documents:create');
  filters.elements.status.replaceChildren(new Option('Tất cả trạng thái', ''), ...Object.entries(STATUS_META.documents).map(([value, meta]) => new Option(meta.label, value)));

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function button(label, action, variant = 'secondary') {
    const element = node('button', `btn btn--${variant} btn--sm`, label);
    element.type = 'button'; element.dataset.action = action;
    return element;
  }

  if (canCreate) region('library-actions').append(button('Thêm tài liệu', 'open-document-form', 'primary'));

  function renderPreview(record) {
    documentDraft = structuredClone(record);
    const preview = region('document-preview'); preview.hidden = false; preview.replaceChildren();
    const header = node('div', 'card__header'); header.append(node('h2', 'card__title', 'Tài liệu xem trước'), createStatusBadge('documents', record.status));
    const notice = node('div', 'alert alert--info'); notice.append(node('p', 'alert__message', 'Bản xem trước trong trang này. Chưa cập nhật kho tài liệu hoặc phạm vi đọc chính thức.'));
    const body = node('div', 'card__body');
    body.append(node('h3', '', record.title), node('p', 'form-field__hint', record.category),
      node('p', 'form-field__hint', `Vai trò được đọc: ${record.audienceRoles.map((role) => ROLE_LABELS[role]).join(', ')}.`),
      node('p', 'form-field__hint', `Phòng ban: ${record.departmentIds.length ? record.departmentIds.map((id) => departments.find((department) => department.id === id)?.name || id).join(', ') : 'Tất cả phòng ban'}.`),
      node('p', 'hr-library__preview', record.content));
    preview.append(header, notice, body, button('Bỏ bản xem trước', 'discard-document-preview'));
  }

  function openDocumentForm({ mode = 'create', recordId = null, initialValues = {} } = {}) {
    if (!ready) return;
    const record = recordId ? documents.find((item) => item.id === recordId) : null;
    if (!permissions.can(currentUser, `documents:${mode === 'edit' ? 'update' : 'create'}`, record || {})) return;
    const baseline = record ? structuredClone(record) : { title: '', category: '', content: '', status: 'draft', audienceRoles: Object.keys(ROLE_LABELS), departmentIds: [], ...initialValues };
    const form = node('form', 'form'); form.noValidate = true;
    form.append(createField({ name: 'title', label: 'Tiêu đề', required: true, value: baseline.title }),
      createField({ name: 'category', label: 'Chủ đề', required: true, value: baseline.category }),
      createField({ name: 'status', label: 'Trạng thái', type: 'select', value: baseline.status, options: Object.entries(STATUS_META.documents).map(([value, meta]) => ({ value, label: meta.label })) }),
      createField({ name: 'audienceRoles', label: 'Vai trò được đọc', type: 'select', required: true, options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })), hint: 'Chọn một hoặc nhiều vai trò (Ctrl/Cmd khi dùng chuột).' }),
      createField({ name: 'departmentIds', label: 'Phạm vi phòng ban', type: 'select', options: departments.map((department) => ({ value: department.id, label: department.name })), hint: 'Để trống để áp dụng mọi phòng ban. Ctrl/Cmd để chọn nhiều.' }),
      createField({ name: 'content', label: 'Nội dung', type: 'textarea', value: baseline.content, required: true }));
    for (const name of ['audienceRoles', 'departmentIds']) {
      form.elements[name].multiple = true;
      for (const option of form.elements[name].options) option.selected = baseline[name].includes(option.value);
    }
    const editable = permissions.getEditableFields(currentUser, 'documents', record || baseline);
    for (const name of ['title', 'category', 'content']) form.elements[name].readOnly = !editable.includes(name);
    for (const name of ['status', 'audienceRoles', 'departmentIds']) form.elements[name].disabled = !editable.includes(name);
    const actions = node('div', 'modal__footer'); const cancel = button('Hủy', 'cancel-document-form'); const preview = button('Xem trước tài liệu', 'preview-document', 'primary'); preview.type = 'submit'; actions.append(cancel, preview); form.append(actions);
    let allowClose = false;
    let submitting = false;

    function readValues() {
      const values = Object.fromEntries(new FormData(form));
      values.audienceRoles = [...form.elements.audienceRoles.selectedOptions].map((option) => option.value);
      values.departmentIds = [...form.elements.departmentIds.selectedOptions].map((option) => option.value);
      return values;
    }

    const modal = ui.openModal({ title: mode === 'edit' ? 'Sửa tài liệu' : 'Thêm tài liệu', content: form, onClose: async () => {
      if (submitting) return false;
      const values = readValues();
      const dirty = ['title', 'category', 'content', 'status'].some((name) => values[name] !== baseline[name])
        || ['audienceRoles', 'departmentIds'].some((name) => [...values[name]].sort().join('|') !== [...baseline[name]].sort().join('|'));
      return allowClose || !dirty || await ui.confirmAction({ title: 'Hủy thay đổi tài liệu?', message: 'Các thay đổi trên form sẽ bị bỏ.', confirmLabel: 'Bỏ thay đổi', tone: 'danger' });
    } });
    cancel.addEventListener('click', () => modal.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;
      const values = readValues();
      const result = validateForm(values, {
        title: [{ type: 'required', message: 'Nhập tiêu đề.' }, { type: 'maxLength', maxLength: 200, message: 'Tiêu đề tối đa 200 ký tự.' }],
        category: [{ type: 'required', message: 'Nhập chủ đề.' }, { type: 'maxLength', maxLength: 100, message: 'Chủ đề tối đa 100 ký tự.' }],
        content: [{ type: 'required', message: 'Nhập nội dung.' }, { type: 'maxLength', maxLength: 20000, message: 'Nội dung tối đa 20.000 ký tự.' }],
      });
      if (!values.audienceRoles.length || values.audienceRoles.some((role) => !ROLE_LABELS[role])) result.errors.audienceRoles = 'Chọn ít nhất một vai trò hợp lệ.';
      if (values.departmentIds.some((id) => !departments.some((department) => department.id === id))) result.errors.departmentIds = 'Phòng ban không hợp lệ.';
      if (!STATUS_META.documents[values.status]) result.errors.status = 'Trạng thái không hợp lệ.';
      applyFormErrors(form, result.errors);
      if (Object.keys(result.errors).length) return;
      submitting = true; preview.disabled = true;
      try {
        if (values.status !== baseline.status && ['published', 'archived'].includes(values.status)) {
          const archive = values.status === 'archived';
          if (!permissions.can(currentUser, `documents:${archive ? 'archive' : 'publish'}`, record || {})) return;
          if (!await ui.confirmAction({ title: archive ? 'Lưu trữ tài liệu?' : 'Phát hành tài liệu?', message: `Xem trước chuyển “${values.title}” sang ${STATUS_META.documents[values.status].label.toLocaleLowerCase('vi')}?`, confirmLabel: 'Xác nhận xem trước', tone: archive ? 'danger' : 'primary' })) return;
        }
        renderPreview({ ...baseline, id: recordId || `preview-document-${crypto.randomUUID()}`, title: values.title.trim(), category: values.category.trim(), content: values.content.trim(), status: values.status,
          audienceRoles: values.audienceRoles, departmentIds: values.departmentIds, updatedById: currentUser.id, updatedAt: new Date().toISOString() });
        allowClose = true;
      } finally { submitting = false; preview.disabled = false; }
      if (allowClose) await modal.close();
    });
  }

  function render() {
    if (!ready) return;
    const values = Object.fromEntries(new FormData(filters));
    const search = values.search.trim().toLocaleLowerCase('vi');
    const matches = documents.filter((doc) => (!values.status || doc.status === values.status) && (!values.category || doc.category === values.category)
      && (!search || doc.title.toLocaleLowerCase('vi').includes(search)));
    const rows = region('document-rows'); rows.replaceChildren();
    for (const doc of matches) {
      const row = node('tr'); row.dataset.id = doc.id;
      const title = node('td'); const link = node('a', '', doc.title); link.href = `document-detail.html?${new URLSearchParams({ id: doc.id })}`; title.append(link);
      const category = node('td', '', doc.category); const status = node('td'); status.append(createStatusBadge('documents', doc.status));
      const updated = node('td', 'table__cell--nowrap', formatDateTime(doc.updatedAt));
      const actions = node('td', 'table__actions'); const open = node('a', 'btn btn--secondary btn--sm', 'Đọc'); open.href = link.href; actions.append(open);
      if (permissions.can(currentUser, 'documents:update', doc)) { const edit = button('Sửa', 'edit-document', 'ghost'); edit.dataset.id = doc.id; actions.append(edit); }
      if (doc.status === 'draft' && permissions.can(currentUser, 'documents:publish', doc)) { const publish = button('Phát hành', 'publish-document', 'primary'); publish.dataset.id = doc.id; actions.append(publish); }
      if (doc.status !== 'archived' && permissions.can(currentUser, 'documents:archive', doc)) { const archive = button('Lưu trữ', 'archive-document', 'danger'); archive.dataset.id = doc.id; actions.append(archive); }
      row.append(title, category, status, updated, actions); rows.append(row);
    }
    region('document-table-wrap').hidden = !matches.length;
    region('document-count').textContent = `${matches.length} / ${documents.length} tài liệu`;
    ui.setViewState(region('library-state'), { status: matches.length ? 'ready' : 'empty', message: documents.length ? 'Không có tài liệu phù hợp bộ lọc.' : 'Chưa có tài liệu trong phạm vi của bạn.' });
  }

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || busy) return;
    const action = target.dataset.action;
    if (!ready && action !== 'retry-library') return;
    if (action === 'open-document-form') { openDocumentForm({ mode: 'create' }); return; }
    if (action === 'discard-document-preview') { documentDraft = null; region('document-preview').replaceChildren(); region('document-preview').hidden = true; return; }
    if (action === 'retry-library') { await loadData(); return; }
    const doc = documents.find((item) => item.id === target.dataset.id);
    if (!doc) return;
    if (action === 'edit-document') { openDocumentForm({ mode: 'edit', recordId: doc.id }); return; }
    if (!['publish-document', 'archive-document'].includes(action)) return;
    const archive = action === 'archive-document';
    if (!permissions.can(currentUser, `documents:${archive ? 'archive' : 'publish'}`, doc)) return;
    busy = true;
    try {
      if (await ui.confirmAction({ title: archive ? 'Lưu trữ tài liệu?' : 'Phát hành tài liệu?', message: `Xem trước ${archive ? 'lưu trữ' : 'phát hành'} “${doc.title}”? Kho tài liệu vẫn giữ bản ghi hiện tại.`, confirmLabel: 'Xác nhận xem trước', tone: archive ? 'danger' : 'primary' })) renderPreview({ ...structuredClone(doc), status: archive ? 'archived' : 'published', updatedById: currentUser.id, updatedAt: new Date().toISOString() });
    } finally { busy = false; }
  });
  filters.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  filters.addEventListener('input', render);

  async function loadData() {
    ready = false;
    const add = region('library-actions').querySelector('[data-action="open-document-form"]');
    if (add) add.disabled = true;
    region('document-table-wrap').hidden = true;
    region('document-preview').hidden = true;
    ui.setViewState(region('library-state'), { status: 'loading', message: 'Đang tải thư viện…' });
    try {
      const [{ items }, { items: departmentItems }] = await Promise.all([repository.list('documents'), repository.list('departments')]);
      documents = items; departments = departmentItems;
      filters.elements.category.replaceChildren(new Option('Tất cả chủ đề', ''), ...[...new Set(documents.map((doc) => doc.category).filter(Boolean))].sort().map((category) => new Option(category, category)));
      if (!canCreate) { filters.elements.status.replaceChildren(new Option(STATUS_META.documents.published.label, 'published')); filters.elements.status.disabled = true; }
      ready = true;
      if (add) add.disabled = false;
      render();
    } catch (error) {
      ui.setViewState(region('library-state'), { status: 'error', message: error.message || 'Không tải được thư viện.' }); region('library-state').append(button('Thử lại', 'retry-library'));
    }
  }
  window.addEventListener('pagehide', () => { documentDraft = null; documents = []; }, { once: true });
  await loadData();
}
