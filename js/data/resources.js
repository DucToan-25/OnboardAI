/*
 * resources.js — phòng ban, tài liệu, check-in.
 * OWNER: SV2. CHƯA TRIỂN KHAI: SV3 chỉ bàn giao chữ ký theo hợp đồng mục 4.5
 * (OnboardAI_QuyTac_LocalStorage.md) để màn hình Admin/HR của SV3 (quản lý phòng
 * ban, thư viện HR) gọi đúng tên hàm. Mọi hàm ném MODULE_NOT_READY; KHÔNG trả
 * dữ liệu giả. SV2 thay thân hàm bằng logic thật (quyền Admin với phòng ban,
 * trạng thái tài liệu, chặn trùng check-in).
 */
import { StoreError } from './store.js';

function notReady(method) {
  return new StoreError(
    'MODULE_NOT_READY',
    `resources.js (${method}) chưa được SV2 triển khai. Màn hình hiển thị trạng thái chờ; không báo lưu thành công giả.`,
  );
}

// ===== Phòng ban (Admin) =====
export async function listDepartments(query = {}) { throw notReady('listDepartments'); }
export async function createDepartment(input) { throw notReady('createDepartment'); }
export async function updateDepartment(id, patch) { throw notReady('updateDepartment'); }

// Không xóa phòng ban đang tham chiếu; dùng trạng thái inactive và trả thông báo rõ.
export async function archiveDepartment(id) { throw notReady('archiveDepartment'); }

// Số bản ghi đang tham chiếu một phòng ban (users/newHires/journeys/documents) cho trang Admin.
export async function getDepartmentReferences(departmentId) { throw notReady('getDepartmentReferences'); }

// ===== Tài liệu (HR/Admin ghi; mentor/newHire đọc theo trạng thái và đối tượng) =====
export async function listDocuments(query = {}) { throw notReady('listDocuments'); }
export async function getDocument(id) { throw notReady('getDocument'); }
export async function createDocument(input) { throw notReady('createDocument'); }
export async function updateDocument(id, patch) { throw notReady('updateDocument'); }
export async function archiveDocument(id) { throw notReady('archiveDocument'); }

// ===== Check-in (mentor giao dịch; chặn trùng newHireId + mentorId + scheduledAt) =====
export async function listCheckins(query = {}) { throw notReady('listCheckins'); }
export async function createCheckin(input) { throw notReady('createCheckin'); }
export async function updateCheckin(id, patch) { throw notReady('updateCheckin'); }
