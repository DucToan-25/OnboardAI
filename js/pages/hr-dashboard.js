import { initTablePage, bindForm } from '../common/page-ui.js';
export async function initPage() {
  initTablePage({ prefix: 'dashboard' });
  bindForm(document.querySelector('[data-region="risk-form"]'));
}
