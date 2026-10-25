import { getAll, getById, getCurrentUserId, setCurrentUserId, clearCurrentUser, StoreError } from '../data/store.js';
import { ROLES } from '../config/roles.js';

export function publicUser(user) {
  if (!user) return null;
  const { password, ...profile } = user;
  return profile;
}
export function login(userIdOrEmail, password) {
  const identifier = String(userIdOrEmail || '').trim().toLowerCase();
  const user = getAll('users').find(item => item.id.toLowerCase() === identifier || item.email?.toLowerCase() === identifier);
  if (!user || typeof password !== 'string' || !password || user.password !== password) {
    throw new StoreError('INVALID_CREDENTIALS', 'Email, mã tài khoản hoặc mật khẩu không đúng.');
  }
  if (user.status === 'invited') {
    throw new StoreError('ACCOUNT_INVITED', 'Tài khoản đang chờ kích hoạt. Vui lòng liên hệ quản trị viên để kích hoạt tài khoản trước khi đăng nhập.');
  }
  if (user.status === 'inactive') {
    throw new StoreError('ACCOUNT_INACTIVE', 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
  }
  if (user.status !== 'active' || !Object.values(ROLES).includes(user.role)) {
    throw new StoreError('ACCOUNT_UNAVAILABLE', 'Tài khoản chưa có trạng thái hoặc vai trò hợp lệ. Vui lòng liên hệ quản trị viên để kiểm tra.');
  }
  setCurrentUserId(user.id);
  return publicUser(user);
}
export function logout() { clearCurrentUser(); }
export function getCurrentUser() {
  const id = getCurrentUserId();
  const user = id ? getById('users', id) : null;
  return user?.status === 'active' && Object.values(ROLES).includes(user.role) ? publicUser(user) : null;
}
export function requireRoles(roles = Object.values(ROLES)) {
  const user = getCurrentUser();
  if (!user) throw new StoreError('FORBIDDEN', 'Vui lòng đăng nhập bằng tài khoản đang hoạt động.');
  if (!roles.includes(user.role)) throw new StoreError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
  return user;
}
