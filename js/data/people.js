<<<<<<< HEAD
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
=======
import * as store from './store.js';
import { publicUser, requireRoles } from '../common/auth.js';
import { ROLES } from '../config/roles.js';
import { parseStoredDate } from '../common/format.js';

const userFields = ['fullName', 'email', 'password', 'role', 'departmentId', 'jobTitle', 'status'];
const hireFields = ['departmentId', 'jobTitle', 'mentorId', 'journeyId', 'startDate', 'status', 'notes'];
function allowed(patch, fields) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !fields.includes(key))) throw new Error('Có trường không được phép thay đổi.');
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} không được để trống.`);
  return value.trim();
}
function validateUser(input, id = null, previous = null) {
  const user = { ...input, fullName: text(input.fullName, 'Họ tên'), email: text(input.email, 'Email').toLowerCase() };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) throw new Error('Email không hợp lệ.');
  if (store.getAll('users').some(item => item.id !== id && item.email.toLowerCase() === user.email)) throw new Error('Email đã được sử dụng.');
  if (!Object.values(ROLES).includes(user.role) || !['active', 'invited', 'inactive'].includes(user.status)) throw new Error('Vai trò hoặc trạng thái tài khoản không hợp lệ.');
  if (typeof user.password !== 'string' || !user.password.trim()) throw new Error('Cần mật khẩu cho tài khoản mô phỏng.');
  validateReference('departments', user.departmentId, previous?.departmentId);
  return user;
}
function validateReference(collection, id, previousId) {
  if (id === null) return;
  if (typeof id !== 'string' || !id || ['null', 'undefined'].includes(id)) throw new Error('Liên kết phải là ID hợp lệ hoặc null.');
  const record = store.getById(collection, id);
  if (!record || (id !== previousId && record.status !== 'active')) throw new Error(`Liên kết ${collection} không tồn tại hoặc chưa hoạt động.`);
}
function validateHire(input, previous = null, account = null) {
  const user = account || store.getById('users', input.userId);
  if (!user || user.role !== ROLES.NEWHIRE) throw new Error('Hồ sơ phải liên kết với tài khoản nhân sự mới.');
  if (store.getAll('newHires').some(hire => hire.id !== previous?.id && hire.userId === user.id)) throw new Error('Tài khoản đã có hồ sơ hội nhập.');
  if (input.departmentId !== user.departmentId) throw new Error('Phòng ban hồ sơ phải khớp tài khoản.');
  validateReference('departments', input.departmentId, previous?.departmentId);
  validateReference('journeys', input.journeyId, previous?.journeyId);
  if (input.mentorId !== null) {
    const mentor = store.getById('users', input.mentorId);
    if (!mentor || mentor.role !== ROLES.MENTOR || mentor.status !== 'active') throw new Error('Mentor phải là tài khoản hướng dẫn đang hoạt động.');
  }
  if (!['notStarted', 'inProgress', 'completed', 'archived'].includes(input.status)) throw new Error('Trạng thái hồ sơ không hợp lệ.');
  if (input.startDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !parseStoredDate(input.startDate))) throw new Error('Ngày bắt đầu không hợp lệ.');
  return input;
}
export function getMyHire() {
  const user = requireRoles();
  const hires = store.getAll('newHires').filter(item => item.userId === user.id);
  if (hires.length > 1) throw new Error('Tài khoản liên kết nhiều hồ sơ. Cần quản trị viên kiểm tra dữ liệu.');
  return hires[0] || null;
}
export function getMyProfile() {
  const user = requireRoles();
  const hire = getMyHire();
  return { user, hire, department: store.getById('departments', user.departmentId), mentor: publicUser(hire?.mentorId ? store.getById('users', hire.mentorId) : null) };
}
export function updateMyProfile(patch) {
  const actor = requireRoles(); allowed(patch, ['fullName', 'email']);
  const previous = store.getById('users', actor.id);
  const user = validateUser({ ...previous, ...patch }, actor.id, previous);
  return publicUser(store.update('users', actor.id, { fullName: user.fullName, email: user.email }));
}
export function listUsers() { requireRoles([ROLES.ADMIN]); return store.getAll('users').map(publicUser); }
export function listHires() {
  const actor = requireRoles([ROLES.ADMIN, ROLES.HR, ROLES.MENTOR]);
  return store.getAll('newHires').filter(hire => actor.role !== ROLES.MENTOR || hire.mentorId === actor.id);
}
export function updateUser(id, patch) {
  const actor = requireRoles([ROLES.ADMIN]); allowed(patch, userFields);
  const previous = store.getById('users', id);
  if (!previous) throw new Error('Không tìm thấy tài khoản.');
  const user = validateUser({ ...previous, ...patch }, id, previous);
  const hires = store.getAll('newHires');
  if (user.role !== previous.role && hires.some(hire => hire.userId === id || hire.mentorId === id)) throw new Error('Cần xử lý liên kết hồ sơ/mentee trước khi đổi vai trò.');
  if (user.departmentId !== previous.departmentId && hires.some(hire => hire.userId === id)) throw new Error('Dùng updateHire để đổi phòng ban của nhân sự có hồ sơ.');
  if (actor.id === id && (user.role !== ROLES.ADMIN || user.status !== 'active') && !store.getAll('users').some(item => item.id !== id && item.role === ROLES.ADMIN && item.status === 'active')) throw new Error('Phải giữ ít nhất một quản trị viên đang hoạt động.');
  return publicUser(store.update('users', id, Object.fromEntries(Object.keys(patch).map(key => [key, user[key]]))));
}
export function createUser(input) {
  requireRoles([ROLES.ADMIN]); allowed(input, userFields);
  const user = validateUser({ departmentId: null, jobTitle: null, status: 'invited', ...input });
  return publicUser(store.create('users', { ...user, id: `user-${crypto.randomUUID()}`, createdAt: new Date().toISOString() }));
}
// A caller keeps this operation's IDs during retry; no extra storage key is needed.
export function prepareNewHireCreation() {
  requireRoles([ROLES.ADMIN]);
  return { userId: `user-${crypto.randomUUID()}`, hireId: `hire-${crypto.randomUUID()}` };
}
export function createNewHireAccount(input, hireInput, operation) {
  requireRoles([ROLES.ADMIN]); allowed(input, userFields); allowed(hireInput, hireFields);
  if (!operation?.userId?.startsWith('user-') || !operation?.hireId?.startsWith('hire-')) throw new Error('Cần giữ mã thao tác tạo tài khoản để có thể thử lại.');
  const existing = store.getById('users', operation.userId);
  const user = validateUser({ departmentId: null, jobTitle: null, status: 'invited', ...input, role: ROLES.NEWHIRE }, existing?.id, existing);
  if (existing && (existing.email !== user.email || existing.role !== ROLES.NEWHIRE)) throw new Error('Mã thao tác đã thuộc tài khoản khác.');
  const hire = { departmentId: user.departmentId, jobTitle: user.jobTitle, mentorId: null, journeyId: null, startDate: null, status: 'notStarted', notes: null, ...hireInput, id: operation.hireId, userId: operation.userId };
  // Check references before the first write. validateHire also checks the persisted user below.
  if (hire.departmentId !== user.departmentId || !['notStarted', 'inProgress', 'completed', 'archived'].includes(hire.status)) throw new Error('Phòng ban hoặc trạng thái hồ sơ không hợp lệ.');
  validateReference('journeys', hire.journeyId);
  if (hire.mentorId !== null) {
    const mentor = store.getById('users', hire.mentorId);
    if (!mentor || mentor.role !== ROLES.MENTOR || mentor.status !== 'active') throw new Error('Mentor không hợp lệ.');
  }
  if (hire.startDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(hire.startDate) || !parseStoredDate(hire.startDate))) throw new Error('Ngày bắt đầu không hợp lệ.');
  const oldHire = store.getById('newHires', operation.hireId);
  if (oldHire && oldHire.userId !== operation.userId) throw new Error('Mã hồ sơ đã được sử dụng.');
  try {
    if (!existing) store.create('users', { ...user, id: operation.userId, createdAt: new Date().toISOString() });
    if (!oldHire) store.create('newHires', validateHire(hire));
    return { user: publicUser(store.getById('users', operation.userId)), hire: store.getById('newHires', operation.hireId) };
  } catch (error) { throw new Error(`${error.message} Nếu tài khoản đã lưu, hãy thử lại với cùng mã thao tác để hoàn tất hồ sơ.`); }
}
export function updateHire(id, patch) {
  const actor = requireRoles([ROLES.ADMIN, ROLES.HR]); allowed(patch, hireFields);
  const previous = store.getById('newHires', id);
  if (!previous) throw new Error('Không tìm thấy hồ sơ hội nhập.');
  const account = store.getById('users', previous.userId);
  const next = { ...previous, ...patch };
  const moving = next.departmentId !== previous.departmentId || next.departmentId !== account?.departmentId;
  if (moving && actor.role !== ROLES.ADMIN) throw new Error('Chỉ Admin được đổi phòng ban tài khoản.');
  const hire = validateHire(next, previous, moving ? { ...account, departmentId: next.departmentId } : null);
  if (hire.journeyId !== previous.journeyId && store.getAll('tasks').some(task => task.newHireId === id && task.status !== 'archived')) throw new Error('Cần xử lý nhiệm vụ hiện tại trước khi đổi hành trình.');
  try {
    if (moving) store.update('users', account.id, { departmentId: next.departmentId });
    return store.update('newHires', id, patch);
  } catch (error) { throw new Error(`${error.message} Hãy thử lại cùng hồ sơ và phòng ban để hoàn tất đồng bộ.`); }
}
>>>>>>> 906d77f (Update localstorage sv1)
