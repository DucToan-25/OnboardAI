/*
 * auth.js — đăng nhập mô phỏng và kiểm tra vai trò (hợp đồng mục 2.2, 3).
 * OWNER: SV1 (cùng store.js/people.js). Bản nền do SV3 dựng để organization.js
 * kiểm tra quyền trên mỗi lần ghi; SV1 review.
 * Đăng nhập mô phỏng chỉ nhận tài khoản active; không có mật khẩu thật.
 */
import { StoreError, clearCurrentUser, getAll, getCurrentUserId, getById, setCurrentUserId } from './store.js';

const ACTIVE = 'active';

function requireUserId(userId) {
  if (typeof userId !== 'string' || !userId) {
    throw new StoreError('VALIDATION_ERROR', 'Đăng nhập cần userId chuỗi khác rỗng.');
  }
}

/** Đăng nhập mô phỏng bằng userId; chỉ tài khoản active. */
export async function login(userId) {
  requireUserId(userId);
  const user = await getById('users', userId);
  if (!user) throw new StoreError('NOT_FOUND', `Không tìm thấy tài khoản ${userId}.`);
  if (user.status !== ACTIVE) {
    throw new StoreError('FORBIDDEN', `Tài khoản ${userId} không hoạt động, không đăng nhập được.`);
  }
  setCurrentUserId(user.id);
  return user;
}

/** Đăng xuất: chỉ xóa khóa tài khoản hiện tại, giữ dữ liệu nghiệp vụ. */
export function logout() {
  clearCurrentUser();
}

/**
 * Lấy user hiện tại từ LocalStorage, đọc lại từ kho users để không dùng bản sao cũ.
 * Trả null khi chưa đăng nhập hoặc tài khoản đã bị xóa.
 */
export async function getCurrentUser() {
  const userId = getCurrentUserId();
  if (!userId) return null;
  return getById('users', userId);
}

/**
 * Demo bridge (đến khi màn hình đăng nhập của SV1 sẵn sàng): đảm bảo có phiên
 * mô phỏng cho vai trò đang xem. Chỉ chọn tài khoản active từ kho users;
 * không gán cứng role, mọi kiểm tra quyền vẫn chạy trên bản ghi mới nhất.
 */
export async function ensurePreviewSession(role) {
  const current = await getCurrentUser();
  if (current && current.status === ACTIVE && current.role === role) return current;
  const users = await getAll('users');
  const candidate = users.find((user) => user.role === role && user.status === ACTIVE);
  if (!candidate) {
    throw new StoreError('FORBIDDEN', `Không có tài khoản đang hoạt động cho vai trò ${role}.`);
  }
  return login(candidate.id);
}

/**
 * Kiểm tra vai trò trên mỗi lần gọi, sau khi đọc user mới nhất từ kho.
 * - Chưa đăng nhập → FORBIDDEN.
 * - Tài khoản inactive → FORBIDDEN (ảnh hưởng lần kiểm tra kế tiếp sau khi Admin vô hiệu hóa).
 * - Sai vai trò → FORBIDDEN.
 */
export async function requireRoles(roles) {
  const user = await getCurrentUser();
  if (!user) throw new StoreError('FORBIDDEN', 'Chưa đăng nhập. Hãy đăng nhập bằng tài khoản hợp lệ.');
  if (user.status !== ACTIVE) {
    throw new StoreError('FORBIDDEN', `Tài khoản ${user.id} đã bị vô hiệu hóa. Thao tác bị từ chối.`);
  }
  if (Array.isArray(roles) && roles.length && !roles.includes(user.role)) {
    throw new StoreError('FORBIDDEN', `Vai trò "${user.role}" không có quyền thực hiện thao tác này.`);
  }
  return user;
}
