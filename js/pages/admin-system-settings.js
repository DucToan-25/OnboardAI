import { getSystemSettings, updateSystemSettings, getDataUpdateBackup, restoreDataUpdateBackup } from '../data/settings.js';
import { listUsers } from '../data/people.js';
import { listDepartments, getReadableDocuments } from '../data/resources.js';
import { resetDemoData } from '../data/store.js';
import { bindForm } from '../common/page-ui.js';
import { watchData, showError } from '../common/data-ui.js';
import { initOrganizationManagement } from '../common/organization-ui.js';
import { ROLE_MENUS, ROLE_LABELS } from '../config/roles.js';
import { element } from '../common/renderers.js';

export async function initPage({ ui }) {
  const region = name => document.querySelector(`[data-region="${name}"]`);
  const form = region('settings-form'); let dirty = false;
  function fill() {
    const record = getSystemSettings();
    for (const [key, value] of Object.entries(record)) if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value ?? '';
    dirty = false; ui.setViewState(region('settings-form-state'), { status: 'ready' });
  }
  fill();
  form.addEventListener('input', () => { dirty = true; });
  bindForm(form, target => { updateSystemSettings(Object.fromEntries(new FormData(target))); fill(); ui.showToast({ message: 'Đã lưu cấu hình.', type: 'success' }); });
  document.querySelector('[data-action="cancel-settings"]').addEventListener('click', fill);
  document.querySelector('[data-action="reset-settings"]').addEventListener('click', async () => { if (await ui.confirmAction({ title: 'Khôi phục biểu mẫu?', message: 'Bỏ các thay đổi đang nhập và đọc lại cấu hình đã lưu.' })) fill(); });
  document.querySelector('[data-action="reset-demo-data"]')?.addEventListener('click', async () => {
    if (!await ui.confirmAction({ title: 'Đặt lại dữ liệu demo?', message: 'Xóa các thay đổi OnboardAI và đăng xuất. Các dữ liệu website khác được giữ nguyên.', tone: 'danger' })) return;
    try { await resetDemoData(); location.assign('login.html'); } catch (error) { showError(error); }
  });
  const backup = getDataUpdateBackup();
  const backupButton = document.querySelector('[data-action="restore-seed-backup"]');
  const backupState = region('seed-backup-state');
  if (backupButton) backupButton.disabled = !backup;
  if (backupState) backupState.textContent = backup
    ? `Bản sao ${backup.collections.join(', ')} được tạo lúc ${new Date(backup.createdAt).toLocaleString('vi-VN')}.`
    : 'Chưa có bản sao trước cập nhật version.';
  backupButton?.addEventListener('click', async () => {
    if (!await ui.confirmAction({ title: 'Khôi phục dữ liệu trước cập nhật?', message: 'Các collection trong bản sao sẽ thay dữ liệu hiện tại. Version đã nạp được giữ nguyên để tránh tự ghi đè lại.', tone: 'danger' })) return;
    try { restoreDataUpdateBackup(); location.reload(); } catch (error) { showError(error); }
  });
  watchData(['settings'], () => {
    if (dirty) ui.setViewState(region('settings-form-state'), { status: 'empty', message: 'Cấu hình đã thay đổi ở tab khác. Bấm Hủy thay đổi để đọc bản mới nhất, hoặc kiểm tra trước khi lưu.' });
    else fill();
  }, region('settings-form-state'));
  watchData(['users', 'departments', 'documents'], () => {
    region('users-count').textContent = listUsers().length;
    region('departments-count').textContent = listDepartments().length;
    region('documents-count').textContent = getReadableDocuments().filter(item => item.status === 'active').length;
  }, region('settings-state'));
  const roles = region('role-scope');
  if (roles) roles.replaceChildren(...Object.entries(ROLE_MENUS).map(([role, menu]) => {
    const row = element('tr'); row.append(element('td', '', ROLE_LABELS[role]), element('td', '', menu.map(item => item.label).join(', '))); return row;
  }));
  initOrganizationManagement();
}
