import { createStatusBadge, createField } from '../common/renderers.js';
import { formatDate } from '../common/format.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { can } from '../common/permissions.js';
import { confirmAction, openModal } from '../common/ui.js';

export async function initPage({ currentUser, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('document-filters');
  let documents = [];
  const canManage = can(currentUser, 'documents:create');

  if (canManage) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn--primary';
    add.dataset.action = 'open-document-form';
    add.textContent = 'Thêm tài liệu';
    region('library-actions').append(add);
  }

  function openDocumentForm({ mode = 'create', record = null } = {}) {
    const content = document.createElement('div');
    const form = document.createElement('form');
    form.className = 'form';
    form.noValidate = true;
    const fields = document.createElement('div');
    fields.className = 'form__grid';
    fields.append(
      createField({ name: 'title', label: 'Tiêu đề', required: true, value: record?.title || '' }),
      createField({ name: 'category', label: 'Chủ đề', required: true, value: record?.category || '' }),
      createField({ name: 'status', label: 'Trạng thái', type: 'select', value: record?.status || 'draft', options: [
        { value: 'draft', label: 'Bản nháp' },
        { value: 'published', label: 'Đã phát hành' },
        { value: 'archived', label: 'Đã lưu trữ' },
      ] }),
      createField({ name: 'content', label: 'Nội dung', type: 'textarea', value: record?.content || '', required: true }),
    );
    form.append(fields);
    const notice = document.createElement('div');
    notice.className = 'alert alert--info';
    notice.hidden = true;
    notice.innerHTML = '<p class="alert__message">Bản xem trước — chưa ghi vào kho tài liệu.</p>';
    const actions = document.createElement('div');
    actions.className = 'modal__footer';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn--secondary'; cancel.textContent = 'Hủy';
    const save = document.createElement('button'); save.type = 'submit'; save.className = 'btn btn--primary'; save.textContent = mode === 'edit' ? 'Lưu thay đổi' : 'Tạo tài liệu';
    actions.append(cancel, save);
    form.append(notice, actions);
    content.append(form);
    const modal = openModal({ title: mode === 'edit' ? 'Sửa tài liệu' : 'Thêm tài liệu', content });
    cancel.addEventListener('click', () => modal.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const { isValid, errors } = validateForm(values, {
        title: [{ type: 'required', message: 'Nhập tiêu đề.' }],
        category: [{ type: 'required', message: 'Nhập chủ đề.' }],
        content: [{ type: 'required', message: 'Nhập nội dung.' }],
      });
      applyFormErrors(form, errors);
      if (!isValid) return;
      notice.hidden = false;
      ui.showToast({ message: 'Xem trước thành công. Bản giao diện chưa lưu tài liệu.', type: 'info' });
    });
  }

  function render() {
    const search = filters.elements.search.value.trim().toLocaleLowerCase('vi');
    const status = filters.elements.status.value;
    const category = filters.elements.category.value;
    const matches = documents.filter((doc) => {
      if (status && doc.status !== status) return false;
      if (category && doc.category !== category) return false;
      if (search && !doc.title.toLocaleLowerCase('vi').includes(search)) return false;
      return true;
    });
    const tbody = region('document-rows');
    tbody.replaceChildren();
    for (const doc of matches) {
      const tr = document.createElement('tr');
      const title = document.createElement('td');
      const link = document.createElement('a');
      link.href = `document-detail.html?${new URLSearchParams({ id: doc.id })}`;
      link.textContent = doc.title;
      title.append(link);
      const cat = document.createElement('td'); cat.textContent = doc.category;
      const st = document.createElement('td'); st.append(createStatusBadge('documents', doc.status));
      const updated = document.createElement('td'); updated.className = 'table__cell--nowrap';
      updated.textContent = formatDate(doc.updatedAt?.slice(0, 10));
      const acts = document.createElement('td'); acts.className = 'table__actions';
      const open = document.createElement('a');
      open.className = 'btn btn--secondary btn--sm';
      open.href = `document-detail.html?${new URLSearchParams({ id: doc.id })}`;
      open.textContent = 'Đọc';
      acts.append(open);
      if (canManage) {
        const edit = document.createElement('button');
        edit.type = 'button'; edit.className = 'btn btn--ghost btn--sm';
        edit.textContent = 'Sửa';
        edit.addEventListener('click', () => openDocumentForm({ mode: 'edit', record: doc }));
        acts.append(edit);
        if (doc.status !== 'archived') {
          const archive = document.createElement('button');
          archive.type = 'button'; archive.className = 'btn btn--danger btn--sm';
          archive.textContent = 'Lưu trữ';
          archive.addEventListener('click', async () => {
            const ok = await confirmAction({
              title: 'Lưu trữ tài liệu?',
              message: `«${doc.title}» sẽ chuyển sang trạng thái lưu trữ (xem trước).`,
              confirmLabel: 'Lưu trữ',
              tone: 'danger',
            });
            if (ok) ui.showToast({ message: 'Xem trước: chưa lưu trữ thật trong kho.', type: 'info' });
          });
          acts.append(archive);
        }
      }
      tr.append(title, cat, st, updated, acts);
      tbody.append(tr);
    }
    region('document-table-wrap').hidden = matches.length === 0;
    region('document-count').textContent = `${matches.length} / ${documents.length} tài liệu`;
    ui.setViewState(region('library-state'), {
      status: matches.length ? 'ready' : 'empty',
      message: documents.length ? 'Không có tài liệu phù hợp bộ lọc.' : 'Chưa có tài liệu trong phạm vi của bạn.',
    });
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="open-document-form"]')) openDocumentForm({ mode: 'create' });
  });

  filters.addEventListener('submit', (e) => { e.preventDefault(); render(); });
  filters.elements.search.addEventListener('input', render);
  filters.elements.status.addEventListener('change', render);
  filters.elements.category.addEventListener('change', render);

  async function loadData() {
    ui.setViewState(region('library-state'), { status: 'loading', message: 'Đang tải thư viện…' });
    try {
      const result = await repository.list('documents');
      documents = result.items;
      const categories = [...new Set(documents.map((d) => d.category).filter(Boolean))].sort();
      filters.elements.category.replaceChildren(
        new Option('Tất cả chủ đề', ''),
        ...categories.map((c) => new Option(c, c)),
      );
      // Mentor only sees published via repository readable filter; status filter still useful for HR
      if (!canManage) {
        filters.elements.status.value = 'published';
        filters.elements.status.disabled = true;
      }
      render();
    } catch (error) {
      ui.setViewState(region('library-state'), { status: 'error', message: error.message || 'Không tải được thư viện.' });
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true });
      region('library-state').append(retry);
    }
  }

  await loadData();
}
