import { getPreviewHome } from '../config/roles.js';

export async function initPage({ currentUser, pageId }) {
  const root = document.querySelector('#main-content');
  const forbidden = pageId === '403';
  root.querySelector('[data-region="error-code"]').textContent = pageId;
  root.querySelector('[data-region="error-title"]').textContent = forbidden ? 'Bạn không có quyền truy cập' : 'Không tìm thấy trang';
  root.querySelector('[data-region="error-description"]').textContent = forbidden ? 'Tài khoản hiện tại chưa được phép mở trang này.' : 'Trang bạn cần có thể đã thay đổi hoặc không còn tồn tại.';
  const actions = root.querySelector('[data-region="error-actions"]');
  const home = document.createElement('a'); home.className = 'btn btn--primary'; home.href = currentUser ? getPreviewHome(currentUser.role) : 'login.html';
  home.textContent = currentUser ? 'Về trang tổng quan' : 'Về đăng nhập';
  const other = document.createElement(forbidden ? 'a' : 'button'); other.className = 'btn btn--secondary';
  if (forbidden) { other.href = 'login.html'; other.textContent = 'Đổi tài khoản'; }
  else {
    other.type = 'button'; other.textContent = 'Quay lại';
    other.addEventListener('click', () => {
      const previous = document.referrer ? new URL(document.referrer) : null;
      if (previous?.origin === location.origin && history.length > 1) history.back();
      else location.assign(home.href);
    });
  }
  actions.replaceChildren(home, other);
}
