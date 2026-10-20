import { ROLE_HOME } from '../config/roles.js';

export async function initPage({ currentUser, pageId }) {
  const actions = document.querySelector('[data-region="error-actions"]');
  for (const link of actions.querySelectorAll('a')) { link.href = currentUser ? ROLE_HOME[currentUser.role] : 'login.html'; link.textContent = currentUser ? 'Về trang của bạn' : 'Về đăng nhập'; }
  if (actions.querySelectorAll('a').length > 1) actions.querySelectorAll('a')[1].remove();
  actions.querySelector('button')?.addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.assign('../index.html');
  });

  const title = document.querySelector('h1');
  if (title && pageId === '404') {
    title.textContent = title.textContent.includes('404') ? title.textContent : '404 — Không tìm thấy trang';
  }
}
