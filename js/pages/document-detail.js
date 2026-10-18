import { ROLE_LIBRARY } from '../config/roles.js';
export async function initPage({ currentUser, ui }) {
  const root = document.querySelector('#main-content');
  const id = new URLSearchParams(location.search).get('id');
  if (id && id !== 'doc-001') {
    const template = [...document.querySelectorAll('template[data-document]')].find(item => item.dataset.document === id);
    if (template) root.replaceChildren(template.content.cloneNode(true));
    else {
      root.querySelector('[data-region="document-title"]').textContent = 'Không tìm thấy tài liệu';
      root.querySelector('[data-region="detail-layout"]').hidden = true;
      ui.setViewState(root.querySelector('[data-region="detail-state"]'), { status: 'empty', message: 'Tài liệu này chưa có trong bản giao diện.' });
    }
  }
  const back = root.querySelector('[data-region="document-back"]');
  if (back) back.href = ROLE_LIBRARY[currentUser.role] + '.html?' + new URLSearchParams({ role: currentUser.role });
  document.title = root.querySelector('h1').textContent.trim() + ' | OnboardAI';
}
