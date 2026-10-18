import { openFormTemplate } from '../common/page-ui.js';
export async function initPage() {
  document.querySelector('[data-action="contact-mentor"]')?.addEventListener('click', () => openFormTemplate('contact-mentor'));
}
