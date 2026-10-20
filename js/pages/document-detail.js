import { ROLE_LIBRARY } from '../config/roles.js';
import { getDocument } from '../data/resources.js';
import { element } from '../common/renderers.js';
import { formatDateTime } from '../common/format.js';
import { watchData } from '../common/data-ui.js';

export async function initPage({ currentUser, ui }) {
  const root = document.querySelector('#main-content');
  const region = name => root.querySelector(`[data-region="${name}"]`);
  const id = new URLSearchParams(location.search).get('id');
  root.querySelector('[data-region="document-back"] a').href = ROLE_LIBRARY[currentUser.role] + '.html';
  function render() {
    region('document-content').replaceChildren();
    region('document-toc').replaceChildren();
    region('document-status').replaceChildren();
    region('document-meta').textContent = '';
    try {
      const item = getDocument(id);
      region('document-title').textContent = item.title;
      region('document-meta').textContent = `${item.category} · Cập nhật ${formatDateTime(item.updatedAt)}`;
      region('document-status').append(element('span', 'badge badge--info', item.status === 'active' ? 'Đã phát hành' : item.status === 'draft' ? 'Bản nháp' : 'Đã lưu trữ'));
      region('document-content').append(element('p', '', item.description));
      if (/^https?:\/\//i.test(item.fileUrl ?? '')) {
        const link = element('a', 'btn btn--primary', 'Mở tài liệu');
        link.href = item.fileUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
        region('document-content').append(link);
      } else {
        region('document-content').append(element('p', 'form-field__hint', 'Tệp tài liệu chưa được cung cấp trong dự án. Liên hệ HR để nhận bản đầy đủ.'));
      }
      region('detail-layout').hidden = false;
      region('document-toc').closest('nav').hidden = true;
      ui.setViewState(region('detail-state'), { status: 'ready' });
    } catch (error) {
      region('document-title').textContent = 'Không thể mở tài liệu';
      region('detail-layout').hidden = true;
      ui.setViewState(region('detail-state'), { status: 'error', message: error.message });
    }
    document.title = region('document-title').textContent + ' | OnboardAI';
  }
  watchData(['documents', 'users'], render, region('detail-state'));
}
