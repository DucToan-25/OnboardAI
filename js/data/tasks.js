/*
 * tasks.js — nhiệm vụ onboarding và tiến độ.
 * OWNER: SV2. CHƯA TRIỂN KHAI: SV3 chỉ bàn giao chữ ký theo hợp đồng mục 4.1
 * (OnboardAI_QuyTac_LocalStorage.md) để SV1 (checklist) và SV3 (HR dashboard,
 * Progress Risk) gọi đúng tên hàm. Mọi hàm ném MODULE_NOT_READY; KHÔNG trả
 * phần trăm giả. SV2 thay thân hàm bằng logic thật (quyền theo newHire/mentor,
 * completedAt, mẫu số = task không archived).
 */
import { StoreError } from './store.js';

function notReady(method) {
  return new StoreError(
    'MODULE_NOT_READY',
    `tasks.js (${method}) chưa được SV2 triển khai. Màn hình hiển thị trạng thái chờ; không tính tiến độ giả.`,
  );
}

// Task của một nhân sự mới (loại archived khi tính tiến độ).
export async function getTasksForHire(hireId) { throw notReady('getTasksForHire'); }

// Tạo task; mentor chỉ cho mentee của mình; lấy assignedTo từ hồ sơ, journeyId đã gán.
export async function createTask(input) { throw notReady('createTask'); }

// Sửa task theo quyền; chặn thay assignedTo/journeyId ngoài quy tắc.
export async function updateTask(taskId, patch) { throw notReady('updateTask'); }

// newHire: todo/inProgress/blocked/completed; mentor/HR/Admin theo quyền; xử lý completedAt.
export async function updateTaskStatus(taskId, status) { throw notReady('updateTaskStatus'); }

// Lưu trữ task (HR/Admin hoặc chủ thẩm quyền); mẫu số tiến độ đổi theo.
export async function archiveTask(taskId) { throw notReady('archiveTask'); }

// Tiến độ chung: completed / tổng task không archived; 0 khi không có task (mục 2.7).
export async function getProgress(hireId) { throw notReady('getProgress'); }
