import * as store from './store.js';
import { publicUser, requireRoles } from '../common/auth.js';
import { ROLES } from '../config/roles.js';
import { parseStoredDate } from '../common/format.js';
import { getEditableFields } from '../common/permissions.js';

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
    if (!mentor || mentor.role !== ROLES.MENTOR || (mentor.status !== 'active' && input.mentorId !== previous?.mentorId)) throw new Error('Mentor phải là tài khoản hướng dẫn đang hoạt động.');
  }
  if (!['notStarted', 'inProgress', 'completed', 'archived'].includes(input.status)) throw new Error('Trạng thái hồ sơ không hợp lệ.');
  if (input.startDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !parseStoredDate(input.startDate))) throw new Error('Ngày bắt đầu không hợp lệ.');
  return input;
}
export function getMyHire() {
  const user = requireRoles();
  if (user.role !== ROLES.NEWHIRE) return null;
  const hires = store.getAll('newHires').filter(item => item.userId === user.id);
  if (hires.length > 1) throw new Error('Tài khoản liên kết nhiều hồ sơ. Cần quản trị viên kiểm tra dữ liệu.');
  return hires[0] || null;
}
export function getMyProfile() {
  const user = requireRoles();
  const hire = getMyHire();
  return { user, hire, department: store.getById('departments', user.departmentId), journey: hire?.journeyId ? store.getById('journeys', hire.journeyId) : null, mentor: publicUser(hire?.mentorId ? store.getById('users', hire.mentorId) : null) };
}
export function updateMyProfile(patch) {
  const actor = requireRoles();
  allowed(patch, getEditableFields(actor, 'profile', { id: actor.id }));
  const previous = store.getById('users', actor.id);
  const user = validateUser({ ...previous, ...patch }, actor.id, previous);
  return publicUser(store.update('users', actor.id, { fullName: user.fullName, email: user.email }));
}
export function listUsers() { requireRoles([ROLES.ADMIN]); return store.getAll('users').map(publicUser); }
export function listHires() {
  const actor = requireRoles([ROLES.ADMIN, ROLES.HR, ROLES.MENTOR]);
  return store.getAll('newHires').filter(hire => actor.role !== ROLES.MENTOR || hire.mentorId === actor.id);
}
function prepareUserUpdate(id, patch, allowLinkedDepartment = false) {
  const actor = requireRoles([ROLES.ADMIN]);
  const previous = store.getById('users', id);
  if (!previous) throw new Error('Không tìm thấy tài khoản.');
  allowed(patch, getEditableFields(actor, 'users', previous));
  const user = validateUser({ ...previous, ...patch }, id, previous);
  const hires = store.getAll('newHires');
  if (user.role !== previous.role && hires.some(hire => hire.userId === id || hire.mentorId === id)) throw new Error('Cần xử lý liên kết hồ sơ/mentee trước khi đổi vai trò.');
  if (!allowLinkedDepartment && user.departmentId !== previous.departmentId && hires.some(hire => hire.userId === id)) throw new Error('Dùng updateHire để đổi phòng ban của nhân sự có hồ sơ.');
  if (actor.id === id && (user.role !== ROLES.ADMIN || user.status !== 'active') && !store.getAll('users').some(item => item.id !== id && item.role === ROLES.ADMIN && item.status === 'active')) throw new Error('Phải giữ ít nhất một quản trị viên đang hoạt động.');
  return { user, patch: Object.fromEntries(Object.keys(patch).map(key => [key, user[key]])) };
}
export function updateUser(id, patch) {
  const validated = prepareUserUpdate(id, patch);
  return publicUser(store.update('users', id, validated.patch));
}
// Validate both forms before either write; retry keeps the existing user/hire IDs.
export function updateUserAccount(id, patch, hirePatch = {}) {
  hirePatch ??= {};
  const { user, patch: userPatch } = prepareUserUpdate(id, patch, true);
  const previous = store.getAll('newHires').find(hire => hire.userId === id);
  if (!previous) {
    allowed(hirePatch, hireFields);
    const hire = user.role === ROLES.NEWHIRE ? validateHire({ departmentId: user.departmentId, jobTitle: user.jobTitle,
      mentorId: null, journeyId: null, startDate: null, status: 'notStarted', notes: null, ...hirePatch,
      userId: id, id: `hire-${id}` }, null, user) : null;
    return store.transaction(() => {
      const updatedUser = publicUser(store.update('users', id, userPatch));
      if (hire) store.create('newHires', hire);
      return { user: updatedUser, hire };
    });
  }
  allowed(hirePatch, hireFields);
  const hire = validateHire({ ...previous, departmentId: user.departmentId, jobTitle: user.jobTitle, ...hirePatch }, previous, user);
  if (hire.journeyId !== previous.journeyId && store.getAll('tasks').some(task => task.newHireId === previous.id && task.status !== 'archived')) throw new Error('Cần xử lý nhiệm vụ hiện tại trước khi đổi hành trình.');
  return store.transaction(() => {
    store.update('newHires', hire.id, Object.fromEntries(hireFields.map(key => [key, hire[key]])));
    return { user: publicUser(store.update('users', id, userPatch)), hire: store.getById('newHires', hire.id) };
  });
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
  validateHire(hire, oldHire, { ...user, id: operation.userId });
  return store.transaction(() => {
    if (!existing) store.create('users', { ...user, id: operation.userId, createdAt: new Date().toISOString() });
    if (!oldHire) store.create('newHires', validateHire(hire));
    return { user: publicUser(store.getById('users', operation.userId)), hire: store.getById('newHires', operation.hireId) };
  });
}
export function updateHire(id, patch) {
  const actor = requireRoles([ROLES.ADMIN, ROLES.HR]);
  const previous = store.getById('newHires', id);
  if (!previous) throw new Error('Không tìm thấy hồ sơ hội nhập.');
  allowed(patch, getEditableFields(actor, 'newHires', previous));
  const account = store.getById('users', previous.userId);
  const next = { ...previous, ...patch };
  const moving = next.departmentId !== previous.departmentId || next.departmentId !== account?.departmentId;
  if (moving && actor.role !== ROLES.ADMIN) throw new Error('Chỉ Admin được đổi phòng ban tài khoản.');
  const hire = validateHire(next, previous, moving ? { ...account, departmentId: next.departmentId } : null);
  if (hire.journeyId !== previous.journeyId && store.getAll('tasks').some(task => task.newHireId === id && task.status !== 'archived')) throw new Error('Cần xử lý nhiệm vụ hiện tại trước khi đổi hành trình.');
  return store.transaction(() => {
    if (moving) store.update('users', account.id, { departmentId: next.departmentId });
    return store.update('newHires', id, patch);
  });
}

// Joined display data stays in the service; no password is returned to pages.
export function getHireIssues(hire) {
  const account = store.getById('users', hire.userId);
  return [
    !account || account.role !== 'newHire' ? `${hire.id}: tài khoản ${hire.userId} không phải nhân sự mới; cần nhóm xác nhận liên kết.` : '',
    account && account.departmentId !== hire.departmentId ? `${hire.id}: phòng ban ${hire.departmentId} khác tài khoản ${account.departmentId}; cần Admin kiểm tra.` : '',
  ].filter(Boolean);
}
export function getHireSummaries() {
  return listHires().map(hire => ({ ...hire,
    issues: getHireIssues(hire),
    user: publicUser(store.getById('users', hire.userId)),
    mentor: publicUser(store.getById('users', hire.mentorId)),
    department: store.getById('departments', hire.departmentId),
    journey: store.getById('journeys', hire.journeyId),
  }));
}
export function getAssignmentOptions() {
  requireRoles(['hr', 'admin']);
  return {
    users: store.getAll('users').filter(user => ['newHire', 'mentor'].includes(user.role)).map(publicUser),
    departments: store.getAll('departments'), journeys: store.getAll('journeys'),
  };
}
export function createNewHireProfile(input) {
  requireRoles(['hr', 'admin']); allowed(input, ['userId', ...hireFields]);
  const user = store.getById('users', input.userId);
  const hire = validateHire({ departmentId: user?.departmentId ?? null, jobTitle: user?.jobTitle ?? null,
    mentorId: null, journeyId: null, startDate: null, status: 'notStarted', notes: null, ...input, id: store.createId('newHires') });
  return store.create('newHires', hire);
}
