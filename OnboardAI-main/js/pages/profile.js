import { bindForm } from '../common/page-ui.js';
import { ROLE_LABELS } from '../config/roles.js';
export async function initPage({ currentUser }) {
  const form = document.querySelector('[data-region="profile-form"]');
  bindForm(form);
  document.querySelector('[data-action="reset-profile"]').addEventListener('click', () => form.reset());
  document.querySelector('.profile__identity .badge').textContent = ROLE_LABELS[currentUser.role];
  for (const row of document.querySelectorAll('.profile__metadata-row')) {
    const label = row.querySelector('dt').textContent.trim();
    if (['Ngày bắt đầu', 'Mentor'].includes(label)) row.hidden = currentUser.role !== 'newhire';
  }
}
