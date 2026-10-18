/*
 * people.js — users và newHires.
 * OWNER: SV1. CHƯA TRIỂN KHAI: SV3 chỉ bàn giao chữ ký theo hợp đồng mục 3.3
 * (OnboardAI_QuyTac_LocalStorage.md) để màn hình Admin/HR của SV3 gọi đúng tên hàm.
 * Mọi hàm ném MODULE_NOT_READY với thông báo rõ; KHÔNG trả dữ liệu giả, KHÔNG lưu gì cả.
 * SV1 thay thân hàm bằng logic thật (kiểm tra quyền, email duy nhất, liên kết userId…).
 */
import { StoreError } from './store.js';

function notReady(method) {
  return new StoreError(
    'MODULE_NOT_READY',
    `people.js (${method}) chưa được SV1 triển khai. Màn hình hiển thị trạng thái chờ; không báo lưu thành công giả.`,
  );
}

// Danh sách tài khoản cho trang quản trị (Admin). Trả { items, total } hoặc throw.
export async function listUsers(query = {}) { throw notReady('listUsers'); }

// Tạo tài khoản (+ hồ sơ newHire nếu role là newHire); kiểm tra email duy nhất và liên kết.
export async function createUser(input) { throw notReady('createUser'); }

// Sửa tài khoản theo id; Admin; không sửa được id/role tùy ý ngoài quy tắc quản trị.
export async function updateUser(id, patch) { throw notReady('updateUser'); }

// Vô hiệu hóa/khôi phục tài khoản (active ↔ inactive); lần kiểm tra quyền kế tiếp phải phản ánh ngay.
export async function setUserStatus(id, status) { throw notReady('setUserStatus'); }

// Danh sách hồ sơ newHires; filter theo mentorId/departmentId/status.
export async function listNewHires(query = {}) { throw notReady('listNewHires'); }

// Hồ sơ newHire của chính người đang đăng nhập (newHires.userId === currentUser.id).
export async function getMyHire() { throw notReady('getMyHire'); }

// Nhân sự mới tự sửa các trường cá nhân được phép (fullName, email…).
export async function updateMyProfile(patch) { throw notReady('updateMyProfile'); }

// HR/Admin tạo hồ sơ nhân sự mới và gán mentor/journey (gọi assertJourneyAssignable của organization).
export async function createNewHireProfile(input) { throw notReady('createNewHireProfile'); }

// Đổi mentor của một hồ sơ; mentee list của mentor cũ/mới phải đổi theo.
export async function assignMentor(hireId, mentorUserId) { throw notReady('assignMentor'); }
