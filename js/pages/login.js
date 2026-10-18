import { validateFields, openFormTemplate } from '../common/page-ui.js';
import { login } from '../common/auth.js';
import { ROLE_HOME } from '../config/roles.js';

export async function initPage({ ui }) {
  const root = document.querySelector('#main-content');
  const form = root.querySelector('[data-region="login-form"]');
  form.addEventListener('submit', event => {
    event.preventDefault(); if (!validateFields(form)) return;
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    try {
      const user = login(form.elements.email.value, form.elements.password.value);
      form.elements.password.value = '';
      location.assign(ROLE_HOME[user.role]);
    } catch (error) {
      ui.setViewState(root.querySelector('[data-region="login-state"]'), { status: 'error', message: error.message });
    } finally { button.disabled = false; }
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'toggle-password') {
      const password = form.elements.password; const visible = password.type === 'password';
      password.type = visible ? 'text' : 'password'; button.textContent = visible ? 'Ẩn' : 'Hiện';
      button.setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'); button.setAttribute('aria-pressed', String(visible));
    }
    if (['forgot-password', 'contact-hr'].includes(button.dataset.action)) openFormTemplate(button.dataset.action);
  });
}
