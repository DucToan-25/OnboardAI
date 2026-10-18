import { bindForm, openFormTemplate } from '../common/page-ui.js';
export async function initPage() {
  const root = document.querySelector('#main-content');
  const form = root.querySelector('[data-region="login-form"]');
  bindForm(form);
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'toggle-password') {
      const password = form.elements.password;
      const visible = password.type === 'password';
      password.type = visible ? 'text' : 'password';
      button.textContent = visible ? 'Ẩn' : 'Hiện';
      button.setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      button.setAttribute('aria-pressed', String(visible));
    }
    if (['forgot-password', 'contact-hr'].includes(button.dataset.action)) openFormTemplate(button.dataset.action);
  });
}
