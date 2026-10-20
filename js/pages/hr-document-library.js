import * as resources from '../data/resources.js';
import { element, actionButton, createStatusBadge, fillSelect } from '../common/renderers.js';
import { openFormTemplate } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';
import { formatDateTime } from '../common/format.js';

export async function initPage({ currentUser, ui }) {
  const root = document.querySelector('#main-content'); const region = name => root.querySelector(`[data-region="${name}"]`);
  const filters = region('document-filters'); const writable = ['hr', 'admin'].includes(currentUser.role); let documents = [];
  if (!writable) region('library-actions')?.replaceChildren();
  function render() {
    documents = resources.getReadableDocuments();
    const categories = [...new Set(documents.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    fillSelect(filters.elements.category, categories.map(value => ({ value, label: value })), 'Tất cả chủ đề');
    const query = Object.fromEntries(new FormData(filters));
    const visible = resources.listDocuments(query);
    region('document-rows').replaceChildren(...visible.map(item => {
      const row = element('tr'); row.dataset.id = item.id;
      const title = element('td'); const link = element('a', '', item.title); link.href = `document-detail.html?${new URLSearchParams({ id: item.id })}`; title.append(link);
      const status = element('td'); status.append(createStatusBadge('documents', item.status));
      const actions = element('td', 'table__actions');
      if (writable) {
        actions.append(actionButton('Sửa', 'edit-document', item.id));
        if (item.status === 'draft') actions.append(actionButton('Phát hành', 'publish-document', item.id, 'primary'));
        actions.append(actionButton(item.status === 'archived' ? 'Khôi phục bản nháp' : 'Lưu trữ', item.status === 'archived' ? 'restore-document' : 'archive-document', item.id));
      }
      row.append(title, element('td', '', item.category), status, element('td', '', formatDateTime(item.updatedAt)), actions); return row;
    }));
    region('document-count').textContent = `${visible.length} / ${documents.length} tài liệu`;
    ui.setViewState(region('library-state'), { status: visible.length ? 'ready' : 'empty', message: 'Không có tài liệu phù hợp.' });
  }
  function edit(item = null) {
    if (!writable) return;
    openFormTemplate('open-document-form', { title: item ? 'Sửa tài liệu' : 'Thêm tài liệu nháp', fill(form) {
      fillSelect(form.elements.departmentId, resources.listDepartments().filter(dept => dept.status === 'active' || dept.id === item?.departmentId).map(dept => ({ value: dept.id, label: dept.name })), 'Mọi phòng ban');
      if (item) for (const key of ['title', 'category', 'description', 'fileUrl', 'departmentId', 'targetRole']) form.elements[key].value = item[key] || '';
    }, onSave(form) {
      const values = Object.fromEntries(new FormData(form)); values.departmentId ||= null;
      if (item) resources.updateDocument(item.id, values); else resources.createDocument(values);
      render(); ui.showToast({ message: 'Đã lưu tài liệu.', type: 'success' });
    } });
  }
  filters.addEventListener('submit', event => event.preventDefault()); filters.addEventListener('input', render);
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]'); if (!button || !writable) return;
    try {
      const { action, id } = button.dataset;
      if (['create-document', 'open-document-form'].includes(action)) edit();
      const item = documents.find(doc => doc.id === id); if (!item) return;
      if (action === 'edit-document') edit(item);
      const status = { 'publish-document': 'active', 'archive-document': 'archived', 'restore-document': 'draft' }[action];
      if (status && await ui.confirmAction({ title: `${button.textContent}?`, message: item.title, tone: status === 'archived' ? 'danger' : 'primary' })) { resources.updateDocument(id, { status }); render(); }
    } catch (error) { showError(error); }
  });
  watchData(['documents', 'users', 'departments'], render, region('library-state'));
}
