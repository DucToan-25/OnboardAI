import { bindForm } from '../common/page-ui.js';
export async function initPage({ ui }) {
  const form = document.querySelector('[data-region="settings-form"]');
  bindForm(form);
  document.querySelector('[data-action="cancel-settings"]').addEventListener('click', () => form.reset());
  document.querySelector('[data-action="reset-settings"]').addEventListener('click', async () => {
    if (await ui.confirmAction({ title: 'Khôi phục biểu mẫu?', message: 'Bỏ các thay đổi đang nhập và trở lại nội dung ban đầu.', confirmLabel: 'Khôi phục', tone: 'primary' })) form.reset();
  });
}
