<<<<<<< HEAD
/**
 * UI-11 — Chi tiết tài liệu.
 * Đọc qua resources.getDocument(id); link quay lại theo role.
 */
import { showToast, setViewState } from '../common/ui.js';
import { formatDate } from '../common/format.js';
import { ensurePreviewSession } from '../data/auth.js';
import { initStore } from '../data/store.js';
import { getDocument } from '../data/resources.js';

const DOC_STATUS = Object.freeze({
  draft: { label: 'Bản nháp', tone: 'neutral' },
  active: { label: 'Đã phát hành', tone: 'success' },
  archived: { label: 'Đã lưu trữ', tone: 'warning' },
});

const root = () => document.querySelector('#main-content');
const region = (name) => root()?.querySelector(`[data-region="${name}"]`);

function showError(error) {
  console.error(error);
  showToast({ message: error?.message || 'Không tải được tài liệu.', type: 'error' });
}

export async function initPage({ currentUser } = {}) {
  try {
    await initStore();
    const roleHint = currentUser?.role
      || new URLSearchParams(location.search).get('role')
      || 'newHire';
    const role = ['newHire', 'mentor', 'hr', 'admin'].includes(roleHint) ? roleHint : 'newHire';
    const user = await ensurePreviewSession(role);

    const id = new URLSearchParams(location.search).get('id');
    const back = region('document-back') || root()?.querySelector('[data-region="document-back"] a, a[data-region="document-back"]');
    const backHref = user.role === 'newHire'
      ? `newhire-document-library.html?role=newHire`
      : `hr-document-library.html?role=${encodeURIComponent(user.role)}`;
    if (back) {
      if (back.tagName === 'A') back.href = backHref;
      else {
        const link = back.querySelector('a');
        if (link) link.href = backHref;
      }
    }

    if (!id) {
      region('detail-layout') && (region('detail-layout').hidden = true);
      const stateEl = region('detail-state');
      if (stateEl) {
        stateEl.hidden = false;
        setViewState(stateEl, { status: 'empty', message: 'Thiếu mã tài liệu trên URL (?id=...).' });
      }
      return;
    }

    const doc = await getDocument(id);

    const titleEl = region('document-title');
    if (titleEl) titleEl.textContent = doc.title || id;
    document.title = `${doc.title || id} | OnboardAI`;

    const metaEl = region('document-meta');
    if (metaEl) {
      const day = (doc.updatedAt || doc.createdAt || '').slice(0, 10);
      metaEl.textContent = `${doc.category || 'Tài liệu'} · Cập nhật ${formatDate(day)}`;
    }

    const statusEl = region('document-status');
    if (statusEl) {
      const meta = DOC_STATUS[doc.status] || { label: doc.status, tone: 'neutral' };
      statusEl.replaceChildren();
      const span = document.createElement('span');
      span.className = `badge badge--${meta.tone}`;
      span.textContent = meta.label;
      statusEl.append(span);
    }

    const contentEl = region('document-content');
    if (contentEl) {
      contentEl.replaceChildren();
      const section = document.createElement('section');
      section.className = 'doc-detail__section';
      const h2 = document.createElement('h2');
      h2.className = 'doc-detail__heading';
      h2.textContent = doc.title || 'Nội dung';
      const p = document.createElement('p');
      p.textContent = doc.description || 'Chưa có mô tả chi tiết trong dữ liệu.';
      if (doc.fileUrl) {
        const file = document.createElement('p');
        const a = document.createElement('a');
        a.href = doc.fileUrl;
        a.textContent = 'Mở tệp đính kèm';
        a.target = '_blank';
        a.rel = 'noopener';
        file.append(a);
        section.append(h2, p, file);
      } else {
        section.append(h2, p);
      }
      contentEl.append(section);
    }

    const toc = region('document-toc');
    if (toc) {
      toc.replaceChildren();
      const a = document.createElement('a');
      a.href = '#document-section-1';
      a.textContent = doc.title || 'Nội dung';
      toc.append(a);
    }
  } catch (error) {
    showError(error);
    region('detail-layout') && (region('detail-layout').hidden = true);
    const stateEl = region('detail-state');
    if (stateEl) {
      stateEl.hidden = false;
      setViewState(stateEl, {
        status: 'error',
        message: error?.message || 'Không tải được tài liệu.',
      });
=======
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
      region('document-content').append(element('p', '', item.description), element('p', 'form-field__hint', 'Tệp tài liệu chưa được cung cấp trong dự án. Liên hệ HR để nhận bản đầy đủ.'));
      region('detail-layout').hidden = false;
      region('document-toc').closest('nav').hidden = true;
      ui.setViewState(region('detail-state'), { status: 'ready' });
    } catch (error) {
      region('document-title').textContent = 'Không thể mở tài liệu';
      region('detail-layout').hidden = true;
      ui.setViewState(region('detail-state'), { status: 'error', message: error.message });
>>>>>>> 906d77f (Update localstorage sv1)
    }
    document.title = region('document-title').textContent + ' | OnboardAI';
  }
<<<<<<< HEAD
=======
  watchData(['documents', 'users'], render, region('detail-state'));
>>>>>>> 906d77f (Update localstorage sv1)
}
