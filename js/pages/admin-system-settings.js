import { showToast, confirmAction } from '../common/ui.js';
import { bindForm, validateFields } from '../common/page-ui.js';
import * as settings from '../data/settings.js';
import { getAll, resetDemoData } from '../data/store.js';
import * as people from '../data/people.js';
import * as resources from '../data/resources.js';
import { ensurePreviewSession } from '../data/auth.js';

// Trang quản lý hệ thống (SV3):
// - Thống kê tài khoản/phòng ban/tài liệu lấy từ store qua module (people/resources
//   đang chờ SV1/SV2 nên hiển thị "—" và ghi rõ nguồn chờ, không bịa số).
// - Cấu hình đọc/ghi qua settings.js (bản ghi system); Hủy/Khôi phục trả về
//   giá trị đã tải, không giữ bản draft dở dang.
// - Đặt lại dữ liệu demo yêu cầu xác nhận rồi gọi store.resetDemoData().
async function renderCounts() {
  const count = async (fn) => {
    try { const result = await fn(); return result.total ?? result.length ?? result.items?.length ?? '—'; } catch { return '—'; }
  };
  const region = (name) => document.querySelector(`[data-region="${name}"]`);
  region('users-count').textContent = String(await count(async () => {
    try { return (await people.listUsers()).total; } catch { return (await getAll('users')).length; }
  }));
  region('departments-count').textContent = String(await count(async () => {
    try { return (await resources.listDepartments()).total; } catch { return (await getAll('departments')).length; }
  }));
  region('documents-count').textContent = String(await count(async () => {
    try { return (await resources.listDocuments()).total; } catch { return (await getAll('documents')).length; }
  }));
}

function fillForm(form, record) {
  form.elements.namedItem('organizationName').value = record.organizationName ?? '';
  form.elements.namedItem('supportEmail').value = record.supportEmail ?? '';
  form.elements.namedItem('supportPhone').value = record.supportPhone ?? '';
  form.elements.namedItem('onboardingDays').value = record.onboardingDays ?? '';
  form.elements.namedItem('reminderDays').value = record.reminderDays ?? '';
}

function renderPreview(record) {
  const preview = document.querySelector('[data-region="settings-preview"]');
  const summary = document.querySelector('[data-region="settings-summary"]');
  if (!preview || !summary) return;
  preview.hidden = false;
  summary.replaceChildren();
  const rows = [
    ['Tổ chức', record.organizationName ?? '—'],
    ['Email hỗ trợ', record.supportEmail ?? '—'],
    ['Số điện thoại', record.supportPhone ?? '—'],
    ['Thời lượng hội nhập (ngày)', String(record.onboardingDays ?? '—')],
    ['Nhắc trước (ngày)', String(record.reminderDays ?? '—')],
  ];
  for (const [term, value] of rows) {
    const dt = document.createElement('dt'); dt.textContent = term;
    const dd = document.createElement('dd'); dd.textContent = value;
    summary.append(dt, dd);
  }
}

export async function initPage({ ui, currentUser }) {
  try {
    await ensurePreviewSession(currentUser?.role ?? 'admin');
  } catch (error) {
    const state = document.querySelector('[data-region="settings-state"]');
    if (state) ui.setViewState(state, { status: 'error', message: error.message });
    return;
  }
  const form = document.querySelector('[data-region="settings-form"]');
  let record = null;
  try {
    record = await settings.getSystemSettings();
    fillForm(form, record);
    renderPreview(record);
  } catch (error) {
    const state = document.querySelector('[data-region="settings-state"]');
    if (state) ui.setViewState(state, { status: 'error', message: error.message });
  }
  await renderCounts();

  bindForm(form, async (target) => {
    if (!validateFields(target)) return;
    try {
      const values = Object.fromEntries(new FormData(target).entries());
      record = await settings.updateSystemSettings(values);
      showToast({ message: 'Đã lưu cấu hình hệ thống.', type: 'success' });
      renderPreview(record);
    } catch (error) {
      showToast({ message: error.message, type: 'error' });
    }
  });
  document.querySelector('[data-action="cancel-settings"]').addEventListener('click', () => {
    if (record) fillForm(form, record);
  });
  document.querySelector('[data-action="reset-settings"]').addEventListener('click', async () => {
    if (await ui.confirmAction({ title: 'Khôi phục biểu mẫu?', message: 'Bỏ các thay đổi đang nhập và trở lại nội dung đã tải.', confirmLabel: 'Khôi phục', tone: 'primary' })) {
      if (record) fillForm(form, record);
    }
  });
  const resetDemo = document.querySelector('[data-action="reset-demo-data"]');
  if (resetDemo) {
    resetDemo.addEventListener('click', async () => {
      if (await ui.confirmAction({
        title: 'Đặt lại dữ liệu demo?',
        message: 'Xóa toàn bộ thay đổi LocalStorage của OnboardAI và nạp lại seed. Không thể hoàn tác.',
        confirmLabel: 'Đặt lại dữ liệu',
        tone: 'danger',
      })) {
        try {
          await resetDemoData();
          record = await settings.getSystemSettings();
          fillForm(form, record);
          renderPreview(record);
          await renderCounts();
          showToast({ message: 'Đã đặt lại dữ liệu demo.', type: 'success' });
        } catch (error) {
          showToast({ message: error.message, type: 'error' });
        }
      }
    });
  }
}

