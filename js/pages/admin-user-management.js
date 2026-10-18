import { showToast, setViewState } from '../common/ui.js';
import { initTablePage } from '../common/page-ui.js';
import * as people from '../data/people.js';

const root = () => document.querySelector('#main-content');
const region = (name) => root().querySelector(`[data-region="${name}"]`);

// Trang quản lý tài khoản gọi people.js (SV1) theo hợp đồng mục 5.5.
// people.js hiện ném MODULE_NOT_READY: bảng hiển thị trạng thái chờ rõ ràng,
// không giữ dữ liệu tĩnh giả và không báo lưu thành công giả.
export async function initPage() {
  const state = region('user-state');
  try {
    await people.listUsers();
    // Khi SV1 hoàn tất module, nhánh này render dữ liệu thật tại đây.
    setViewState(state, { status: 'ready', message: '' });
  } catch (error) {
    setViewState(state, {
      status: 'error',
      message: error?.message || 'Danh sách tài khoản đang chờ module people.js (SV1).',
    });
  }

  initTablePage({
    prefix: 'user',
    template: 'open-user-form',
    columns: {
      fullName: 0,
      email: [0, '.admin-users__meta'],
      role: 1,
      departmentId: 2,
      status: 3,
    },
  });

  root().addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit') return;
    const action = button.dataset.action;
    if (!['open-user-form', 'edit-user'].includes(action)) return;
    // Form tạo/sửa chỉ mở khi module SV1 sẵn sàng; tránh gửi dữ liệu vào hàm chưa có.
    try {
      await people.listUsers();
    } catch (error) {
      showToast({ message: error?.message || 'Chức năng quản lý tài khoản chờ module people.js (SV1).', type: 'info' });
    }
  });
}

