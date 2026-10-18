import { showToast, setViewState } from '../common/ui.js';
import { initTablePage } from '../common/page-ui.js';
import * as resources from '../data/resources.js';

const root = () => document.querySelector('#main-content');
const region = (name) => root().querySelector(`[data-region="${name}"]`);

// Trang quản lý phòng ban gọi resources.js (SV2) theo hợp đồng mục 5.5.
// resources.js hiện ném MODULE_NOT_READY: hiển thị trạng thái chờ rõ ràng,
// không giữ dữ liệu tĩnh giả và không báo lưu thành công giả.
export async function initPage() {
  const state = region('department-state');
  try {
    await resources.listDepartments();
    // Khi SV2 hoàn tất module, nhánh này render dữ liệu thật tại đây.
    setViewState(state, { status: 'ready', message: '' });
  } catch (error) {
    setViewState(state, {
      status: 'error',
      message: error?.message || 'Danh sách phòng ban đang chờ module resources.js (SV2).',
    });
  }

  initTablePage({
    prefix: 'department',
    template: 'open-department-form',
    columns: {
      name: 0,
      description: 1,
      status: 3,
    },
  });

  root().addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit') return;
    const action = button.dataset.action;
    if (!['open-department-form', 'edit-department'].includes(action)) return;
    try {
      await resources.listDepartments();
    } catch (error) {
      showToast({ message: error?.message || 'Chức năng quản lý phòng ban chờ module resources.js (SV2).', type: 'info' });
    }
  });
}

