<<<<<<< HEAD
/**
 * UI-12 — Trang lỗi 403/404 dùng chung.
 */
export async function initPage({ pageId } = {}) {
  const code = pageId === '404' ? '404' : '403';
  const actions = document.querySelector('[data-region="error-actions"]');
  if (!actions) return;

  for (const link of actions.querySelectorAll('a')) {
    link.href = 'login.html';
    link.textContent = 'Về đăng nhập';
  }
  // Chỉ giữ một link đăng nhập
  const links = [...actions.querySelectorAll('a')];
  links.slice(1).forEach((el) => el.remove());

  const backBtn = actions.querySelector('button');
  backBtn?.addEventListener('click', () => {
    if (document.referrer) {
      try {
        if (new URL(document.referrer).origin === location.origin && history.length > 1) {
          history.back();
          return;
        }
      } catch {
        /* ignore */
      }
    }
    location.assign('../index.html');
=======
import { ROLE_HOME } from '../config/roles.js';

export async function initPage({ currentUser }) {
  const actions = document.querySelector('[data-region="error-actions"]');
  for (const link of actions.querySelectorAll('a')) { link.href = currentUser ? ROLE_HOME[currentUser.role] : 'login.html'; link.textContent = currentUser ? 'Về trang của bạn' : 'Về đăng nhập'; }
  if (actions.querySelectorAll('a').length > 1) actions.querySelectorAll('a')[1].remove();
  actions.querySelector('button')?.addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.assign('../index.html');
>>>>>>> 906d77f (Update localstorage sv1)
  });

  const title = document.querySelector('h1');
  if (title && code === '404') {
    title.textContent = title.textContent.includes('404') ? title.textContent : '404 — Không tìm thấy trang';
  }
}
