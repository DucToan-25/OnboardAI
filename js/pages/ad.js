import { bindFilters, fillFromRow, openFormTemplate, openRowDetail } from '../common/page-ui.js';
import { confirmAction, showToast } from '../common/ui.js';
import { isSafeUrl } from '../common/validation.js';

const STATUS_LABELS = Object.freeze({
  draft: 'Bản nháp',
  published: 'Đã phát hành',
  archived: 'Đã lưu trữ',
});

function getFormValues(form) {
  return {
    title: String(form.elements.namedItem('title')?.value || '').trim(),
    category: String(form.elements.namedItem('category')?.value || '').trim(),
    status: String(form.elements.namedItem('status')?.value || ''),
    audienceRoles: [...form.elements.namedItem('audienceRoles').selectedOptions].map(option => option.textContent.trim()),
    departmentIds: [...form.elements.namedItem('departmentIds').selectedOptions].map(option => option.textContent.trim()),
    content: String(form.elements.namedItem('content')?.value || '').trim(),
    url: String(form.elements.namedItem('url')?.value || '').trim(),
  };
}

function previewDocument(form, { mode = 'create', recordId = '' } = {}) {
  const values = getFormValues(form);
  const preview = document.querySelector('[data-region="document-preview"]');
  const header = document.createElement('div');
  header.className = 'card__header';
  const title = document.createElement('h2');
  title.className = 'card__title';
  title.textContent = Bản xem trước: ${values.title};
  const body = document.createElement('div');
  body.className = 'card__body';
  const category = document.createElement('p');
  category.textContent = Chủ đề: ${values.category};
  const status = document.createElement('p');
  status.textContent = Trạng thái dự kiến: ${STATUS_LABELS[values.status] || STATUS_LABELS.draft};
  const audience = document.createElement('p');
  audience.textContent = Vai trò được đọc: ${values.audienceRoles.join(', ') || 'Chưa chọn'};
  const departments = document.createElement('p');
  departments.textContent = Phạm vi phòng ban: ${values.departmentIds.join(', ') || 'Tất cả phòng ban'};
  const content = document.createElement('p');
  content.textContent = values.content;
  body.append(category, status, audience, departments, content);

  if (values.url && isSafeUrl(values.url)) {
    const link = document.createElement('a');
    link.href = values.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Mở tài liệu đã liên kết');
    link.textContent = values.url;
    body.append(link);
  }

  const note = document.createElement('div');
  note.className = 'alert alert--info';
  note.textContent = mode === 'edit'
    ? Đây chỉ là bản xem trước thay đổi cho tài liệu ${recordId}; dữ liệu gốc chưa bị thay đổi hoặc lưu.
    : 'Đây chỉ là bản xem trước; tài liệu và liên kết chưa được lưu.';
  header.append(title);
  preview.replaceChildren(header, body, note);
  preview.hidden = false;
  void form.closest('.modal')?.querySelector('[data-action="close-modal"]')?.click();
  preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast({ message: 'Đã tạo bản xem trước; chưa lưu dữ liệu.', type: 'info' });
}

function findDocumentRow(button, rowsRegion) {
  const id = button.dataset.id;
  const row = button.closest('tr');
  if (!id || !row || row.dataset.id !== id || !rowsRegion.contains(row)) {
    showToast({ message: 'Không xác định được tài liệu cần thao tác.', type: 'error' });
    return null;
  }
  return row;
}

function getDocumentTitle(row) {
  return row.cells[0]?.querySelector('a')?.textContent.trim() || 'tài liệu này';
}

function openDocumentEditor(button, rowsRegion) {
  const row = findDocumentRow(button, rowsRegion);
  if (!row) return;
  const recordId = row.dataset.id;
  openFormTemplate('open-document-form', {
    title: 'Chỉnh sửa tài liệu',
    fill: form => {
      fillFromRow(form, row, { title: 0, category: 1, status: [2, '.badge'] });
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = 'Xem trước thay đổi';
      const note = document.createElement('div');
      note.className = 'alert alert--warning';
      note.textContent = 'Bản giao diện chỉ có tiêu đề, chủ đề và trạng thái của tài liệu mẫu. Nội dung, liên kết và phạm vi đọc bên dưới là dữ liệu nhập cho bản xem trước, chưa được tải từ hồ sơ tài liệu.';
      form.prepend(note);
    },
    onValid: form => previewDocument(form, { mode: 'edit', recordId }),
  });
}

async function confirmDocumentAction(action, button, rowsRegion) {
  const row = findDocumentRow(button, rowsRegion);
  if (!row) return;
  const title = getDocumentTitle(row);
  const isPublish = action === 'publish-document';
  const confirmed = await confirmAction({
    title: isPublish ? 'Xác nhận phát hành tài liệu' : 'Xác nhận lưu trữ tài liệu',
    message: isPublish
      ? Bạn có muốn phát hành “${title}” không? Bản giao diện sẽ không thay đổi trạng thái dữ liệu.
      : Bạn có muốn lưu trữ “${title}” không? Bản giao diện sẽ không thay đổi trạng thái dữ liệu.,
    confirmLabel: isPublish ? 'Xác nhận phát hành' : 'Xác nhận lưu trữ',
    tone: isPublish ? 'primary' : 'danger',
  });
  if (!confirmed) return;
  showToast({
    message: Đã xác nhận thao tác với “${title}”, nhưng dữ liệu chưa được thay đổi vì chức năng lưu chưa kết nối.,
    type: 'info',
  });
}

export async function initPage({ currentUser }) {
  const root = document.querySelector('#main-content');
  const rowsRegion = root.querySelector('[data-region="document-rows"]');
  const count = root.querySelector('[data-region="document-count"]');
  const filters = root.querySelector('[data-region="document-filters"]');
  const state = root.querySelector('[data-region="library-state"]');
  const actions = root.querySelector('[data-region="library-actions"]');
  const rows = [...rowsRegion.querySelectorAll('tr')];

  for (const link of rowsRegion.querySelectorAll('a[href^="document-detail.html"]')) {
    const params = new URLSearchParams(link.search);
    params.set('role', currentUser.role);
    link.search = params.toString();
  }

  if (currentUser.role === 'mentor') {
    actions.replaceChildren();
    for (const row of rows) {
      if (row.querySelector('.badge')?.textContent.trim() !== STATUS_LABELS.published) row.remove();
      else row.querySelectorAll('button').forEach(button => button.remove());
    }
  }

  bindFilters({ form: filters, items: rowsRegion.children, state, summary: count, noun: 'tài liệu' });
  count.textContent = ${rowsRegion.querySelectorAll('tr').length} tài liệu;

  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action } = button.dataset;
    if (action === 'open-document-form') {
      openFormTemplate('open-document-form', {
        fill: form => {
          const submit = form.querySelector('button[type="submit"]');
          if (submit) submit.textContent = 'Xem trước tài liệu';
        },
        onValid: form => previewDocument(form),
      });
    } else if (action === 'edit-document') {
      openDocumentEditor(button, rowsRegion);
    } else if (action === 'archive-document' || action === 'publish-document') {
      void confirmDocumentAction(action, button, rowsRegion);
    } else if (action.startsWith('view-') || action.startsWith('open-')) {
      openRowDetail(button);
    }
  });
}