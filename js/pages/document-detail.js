import { createStatusBadge } from '../common/renderers.js';
import { formatDate } from '../common/format.js';
import { ROUTES } from '../config/routes.js';

export async function initPage({ currentUser, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const libraryId = currentUser.role === 'newhire' ? 'newhire-document-library' : 'hr-document-library';
  const back = document.createElement('a'); back.className = 'btn btn--secondary';
  back.href = ROUTES[libraryId].available ? `${libraryId}.html` : 'profile.html';
  back.textContent = ROUTES[libraryId].available ? '← Quay lại thư viện' : '← Về hồ sơ';
  region('document-back').append(back);
  if (!ROUTES[libraryId].available) {
    const note = document.createElement('p'); note.className = 'form-field__hint'; note.textContent = 'Thư viện quản lý chưa có trong bản bàn giao SV1.'; region('document-back').append(note);
  }
  async function loadData() {
    ui.setViewState(region('detail-state'), { status: 'loading', message: 'Đang tải tài liệu…' });
    try {
      const id = new URLSearchParams(location.search).get('id');
      if (!id) throw Object.assign(new Error('Chưa chọn tài liệu. Hãy mở một tài liệu từ thư viện.'), { code: 'NOT_FOUND' });
      const record = await repository.get('documents', id);
      region('document-title').textContent = record.title;
      document.title = `${record.title} | OnboardAI`;
      region('document-meta').textContent = `${record.category} · Cập nhật ${formatDate(record.updatedAt.slice(0, 10))}`;
      region('document-status').replaceChildren(createStatusBadge('documents', record.status));
      const body = region('document-content'); const toc = region('document-toc');
      body.replaceChildren(); toc.replaceChildren(); toc.className = 'doc-detail__toc-links';
      const paragraphs = String(record.content || '').split(/\n\s*\n/).filter(Boolean);
      paragraphs.forEach((paragraph, index) => {
        const section = document.createElement('section'); section.className = 'doc-detail__section'; section.id = `document-section-${index + 1}`;
        const lines = paragraph.split('\n');
        if (/^\d+\./.test(lines[0])) {
          const heading = document.createElement('h2'); heading.className = 'doc-detail__heading'; heading.textContent = lines.shift();
          section.append(heading);
          const link = document.createElement('a'); link.href = `#${section.id}`; link.textContent = heading.textContent; toc.append(link);
        }
        const copy = document.createElement('p'); copy.textContent = lines.join('\n'); section.append(copy); body.append(section);
      });
      if (!paragraphs.length) ui.setViewState(body, { status: 'empty', message: 'Tài liệu chưa có nội dung.' });
      if (!toc.children.length) toc.textContent = 'Tài liệu không chia mục.';
      region('detail-layout').hidden = false;
      ui.setViewState(region('detail-state'), { status: 'ready' });
    } catch (error) {
      const message = error.code === 'FORBIDDEN' ? 'Bạn không có quyền đọc tài liệu này.' : error.message;
      ui.setViewState(region('detail-state'), { status: 'error', message });
      if (!['NOT_FOUND', 'FORBIDDEN'].includes(error.code)) {
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
        retry.addEventListener('click', loadData, { once: true }); region('detail-state').append(retry);
      }
    }
  }
  await loadData();
}
