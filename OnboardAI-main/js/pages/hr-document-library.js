/**
 * UI-10 — Thư viện tài liệu dùng chung (HR/Admin/Mentor).
 * Nối resources.js; mentor chỉ đọc tài liệu active.
 */
import { bindForm } from '../common/page-ui.js';
import { showToast, setViewState, confirmAction, openModal } from '../common/ui.js';
import { formatDate } from '../common/format.js';
import { ensurePreviewSession } from '../data/auth.js';
import { initStore } from '../data/store.js';
import {
  listDocuments, createDocument, updateDocument, archiveDocument,
} from '../data/resources.js';

const DOC_STATUS = Object.freeze({
  draft: { label: 'Bản nháp', tone: 'neutral' },
  active: { label: 'Đã phát hành', tone: 'success' },
  archived: { label: 'Đã lưu trữ', tone: 'warning' },
});

const WRITE_ROLES = new Set(['hr', 'admin']);

const root = () => document.querySelector('#main-content');
const region = (name) => root()?.querySelector(`[data-region="${name}"]`);

const state = { user: null, documents: [], canWrite: false };

function badge(label, tone) {
  const span = document.createElement('span');
  span.className = `badge badge--${tone ?? 'neutral'}`;
  span.textContent = label;
  return span;
}

function showError(error) {
  console.error(error);
  showToast({ message: error?.message || 'Có lỗi khi thao tác tài liệu.', type: 'error' });
}

async function loadDocuments() {
  state.documents = await listDocuments({});
}

function renderRow(doc) {
  const tr = document.createElement('tr');
  tr.dataset.id = doc.id;
  tr.dataset.status = doc.status;

  const titleTd = document.createElement('td');
  const link = document.createElement('a');
  link.href = `document-detail.html?id=${encodeURIComponent(doc.id)}&role=${encodeURIComponent(state.user.role)}`;
  link.textContent = doc.title || doc.id;
  titleTd.append(link);

  const catTd = document.createElement('td');
  catTd.textContent = doc.category || '—';

  const statusTd = document.createElement('td');
  const meta = DOC_STATUS[doc.status] || { label: doc.status, tone: 'neutral' };
  statusTd.append(badge(meta.label, meta.tone));

  const updatedTd = document.createElement('td');
  updatedTd.className = 'table__cell--nowrap';
  const day = (doc.updatedAt || doc.createdAt || '').slice(0, 10);
  updatedTd.textContent = formatDate(day);

  const actionsTd = document.createElement('td');
  actionsTd.className = 'table__actions';
  if (state.canWrite && doc.status !== 'archived') {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--ghost btn--sm';
    editBtn.dataset.action = 'edit-document';
    editBtn.dataset.id = doc.id;
    editBtn.textContent = 'Sửa';
    const archBtn = document.createElement('button');
    archBtn.type = 'button';
    archBtn.className = 'btn btn--danger btn--sm';
    archBtn.dataset.action = 'archive-document';
    archBtn.dataset.id = doc.id;
    archBtn.textContent = 'Lưu trữ';
    actionsTd.append(editBtn, archBtn);
  }

  tr.append(titleTd, catTd, statusTd, updatedTd, actionsTd);
  return tr;
}

function applyFilter() {
  const form = region('document-filters');
  const tbody = region('document-rows');
  if (!tbody) return;
  const search = (form?.elements?.namedItem('search')?.value || '').trim().toLowerCase();
  const statusRaw = form?.elements?.namedItem('status')?.value || '';
  // HTML có thể dùng published; contract dùng active
  const statusMap = { published: 'active', draft: 'draft', archived: 'archived', active: 'active' };
  const status = statusMap[statusRaw] || statusRaw;

  let visible = 0;
  for (const row of tbody.children) {
    const doc = state.documents.find((d) => d.id === row.dataset.id);
    if (!doc) {
      row.hidden = true;
      continue;
    }
    const text = `${doc.title} ${doc.category}`.toLowerCase();
    const matchSearch = !search || text.includes(search);
    const matchStatus = !status || doc.status === status;
    const show = matchSearch && matchStatus;
    row.hidden = !show;
    if (show) visible += 1;
  }

  const summary = region('document-count');
  if (summary) summary.textContent = `${visible} / ${state.documents.length} tài liệu`;

  const stateEl = region('library-state');
  if (stateEl) {
    setViewState(stateEl, {
      status: visible ? 'ready' : 'empty',
      message: state.documents.length ? 'Không có tài liệu phù hợp bộ lọc.' : 'Chưa có tài liệu.',
    });
  }
}

function renderTable() {
  const tbody = region('document-rows');
  if (!tbody) return;
  tbody.replaceChildren(...state.documents.map(renderRow));
  applyFilter();
}

function openCreateModal() {
  if (!state.canWrite) return;
  const content = document.createElement('form');
  content.className = 'form';
  content.innerHTML = `
    <div class="form-field">
      <label class="form-field__label">Tiêu đề <span class="form-field__required">*</span></label>
      <input class="form-field__control" name="title" required />
    </div>
    <div class="form-field">
      <label class="form-field__label">Danh mục</label>
      <input class="form-field__control" name="category" />
    </div>
    <div class="form-field">
      <label class="form-field__label">Mô tả</label>
      <textarea class="form-field__control" name="description"></textarea>
    </div>
    <div class="form__actions">
      <button type="submit" class="btn btn--primary">Tạo bản nháp</button>
      <button type="button" class="btn btn--secondary" data-action="close-modal">Hủy</button>
    </div>
  `;
  const modal = openModal({ title: 'Thêm tài liệu', content });
  bindForm(content, async (form) => {
    try {
      await createDocument({
        title: form.elements.title.value.trim(),
        category: form.elements.category.value.trim() || null,
        description: form.elements.description.value.trim() || null,
        status: 'draft',
      });
      showToast({ message: 'Đã tạo tài liệu nháp.', type: 'success' });
      modal.close();
      await loadDocuments();
      renderTable();
    } catch (error) {
      showError(error);
    }
  });
  content.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="close-modal"]')) modal.close();
  });
}

export async function initPage({ currentUser } = {}) {
  try {
    await initStore();
    const role = currentUser?.role || 'hr';
    state.user = await ensurePreviewSession(
      ['hr', 'admin', 'mentor'].includes(role) ? role : 'hr',
    );
    state.canWrite = WRITE_ROLES.has(state.user.role);

    // Mentor: ẩn nút quản lý
    if (!state.canWrite) {
      region('library-actions')?.replaceChildren();
    }

    await loadDocuments();
    renderTable();

    const filters = region('document-filters');
    if (filters) {
      filters.addEventListener('submit', (e) => e.preventDefault());
      filters.addEventListener('input', applyFilter);
      filters.addEventListener('change', applyFilter);
    }

    root()?.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === 'create-document' || action === 'open-document-form') {
        openCreateModal();
      } else if (action === 'archive-document' && id && state.canWrite) {
        const ok = await confirmAction({
          title: 'Lưu trữ tài liệu',
          message: 'Tài liệu sẽ không còn hiển thị cho mentor/newHire. Tiếp tục?',
          confirmLabel: 'Lưu trữ',
          tone: 'danger',
        });
        if (!ok) return;
        try {
          await archiveDocument(id);
          showToast({ message: 'Đã lưu trữ tài liệu.', type: 'success' });
          await loadDocuments();
          renderTable();
        } catch (error) {
          showError(error);
        }
      } else if (action === 'edit-document' && id && state.canWrite) {
        const doc = state.documents.find((d) => d.id === id);
        if (!doc) return;
        try {
          const nextStatus = doc.status === 'draft' ? 'active' : doc.status;
          if (doc.status === 'draft') {
            await updateDocument(id, { status: 'active' });
            showToast({ message: 'Đã phát hành tài liệu.', type: 'success' });
            await loadDocuments();
            renderTable();
          } else {
            showToast({ message: `Tài liệu đang ở trạng thái ${nextStatus}.`, type: 'info' });
          }
        } catch (error) {
          showError(error);
        }
      }
    });
  } catch (error) {
    showError(error);
    const stateEl = region('library-state');
    if (stateEl) {
      setViewState(stateEl, { status: 'error', message: error?.message || 'Không tải được thư viện.' });
    }
  }
}
