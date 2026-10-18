import { getAll, getById, getCurrentUserId, setCurrentUserId, clearCurrentUser } from '../data/store.js';
import { ROLES } from '../config/roles.js';

export function publicUser(user) {
  if (!user) return null;
  const { password, ...profile } = user;
  return profile;
}
export function login(userIdOrEmail, password) {
  const identifier = String(userIdOrEmail || '').trim().toLowerCase();
  const user = getAll('users').find(item => item.id.toLowerCase() === identifier || item.email?.toLowerCase() === identifier);
  if (!user || user.status !== 'active' || !Object.values(ROLES).includes(user.role)
    || typeof password !== 'string' || !password || user.password !== password) throw new Error('Email hoặc mật khẩu không đúng, hoặc tài khoản chưa hoạt động.');
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
  if (!user) throw new Error('Vui lòng đăng nhập bằng tài khoản đang hoạt động.');
  if (!roles.includes(user.role)) throw new Error('Bạn không có quyền thực hiện thao tác này.');
  return user;
}
