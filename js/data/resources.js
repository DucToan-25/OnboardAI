import { getAll, getById, create, update, createId, StoreError } from './store.js';
import { requireRoles } from '../common/auth.js';
import { parseStoredDate } from '../common/format.js';
import { can } from '../common/permissions.js';

function fail(message, code = 'VALIDATION_ERROR') { throw new StoreError(code, message); }
function record(collection, id) {
  const item = getById(collection, id);
  if (!item) fail('Không tìm thấy bản ghi.', 'NOT_FOUND');
  return item;
}
function fields(patch, allowed) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !allowed.includes(key))) fail('Có trường không được phép thay đổi.');
}
function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} không được để trống.`);
  return value.trim();
}
function department(id, previous) {
  if (id === null) return;
  const item = record('departments', id);
  if (id !== previous && item.status !== 'active') fail('Phòng ban đã ngừng hoạt động.');
}
function text(value) {
  if (value != null && typeof value !== 'string') fail('Nội dung phải là văn bản.');
  return value?.trim() || null;
}
function filter(items, query, searchable) {
  const search = String(query.search || '').trim().toLocaleLowerCase('vi');
  return items.filter(item => (!query.status || item.status === query.status)
    && (!query.departmentId || item.departmentId === query.departmentId)
    && (!query.category || item.category === query.category)
    && (!search || searchable.map(key => item[key] || '').join(' ').toLocaleLowerCase('vi').includes(search)));
}
export function listDepartments(query = {}) {
  requireRoles();
  // Inactive references remain visible with their status; forms exclude new assignments.
  return filter(getAll('departments'), query, ['name', 'description']);
}
function validateDepartment(input) {
  const name = required(input.name, 'Tên phòng ban');
  if (!['active', 'inactive'].includes(input.status)) fail('Trạng thái phòng ban không hợp lệ.');
  if (input.managerId !== null) {
    const manager = record('users', input.managerId);
    if (manager.status !== 'active') fail('Người quản lý phải đang hoạt động.');
  }
  return { name, description: text(input.description), managerId: input.managerId, status: input.status };
}
export function createDepartment(input) {
  requireRoles(['admin']); fields(input, ['name', 'description', 'managerId', 'status']);
  const values = validateDepartment({ description: null, managerId: null, status: 'active', ...input });
  const now = new Date().toISOString();
  return create('departments', { ...values, id: createId('departments'), createdAt: now, updatedAt: now });
}
export function updateDepartment(id, patch) {
  requireRoles(['admin']); fields(patch, ['name', 'description', 'managerId', 'status']);
  const previous = record('departments', id);
  return update('departments', id, { ...validateDepartment({ ...previous, ...patch }), updatedAt: new Date().toISOString() });
}
export function archiveDepartment(id) { return updateDepartment(id, { status: 'inactive' }); }
export function getDepartmentReferences(id) {
  requireRoles(['admin']); record('departments', id);
  return Object.fromEntries(['users', 'newHires', 'journeys', 'documents'].map(name => [name, getAll(name).filter(item => item.departmentId === id).length]));
}
export function getReadableDocuments() {
  const actor = requireRoles();
  return getAll('documents').filter(item => can(actor, 'documents:read', item));
}
function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const POLICY_STOP_WORDS = new Set(['cua', 'cong', 'ty', 'duoc', 'nhu', 'the', 'nao', 'la', 'va', 'cho', 'toi', 'mot', 'cac', 've']);
function policyScore(entry, question) {
  const query = normalizeSearch(question);
  if (!query) return 0;
  const queryTokens = new Set(query.split(' ').filter(token => token.length > 2 && !POLICY_STOP_WORDS.has(token)));
  const terms = [entry.topic, entry.title, ...(entry.keywords || []), ...(entry.faqs || []).map(faq => faq.question)]
    .map(normalizeSearch)
    .filter(Boolean);
  let score = 0;
  for (const term of terms) {
    if (query.includes(term)) score += 12 + term.split(' ').length;
    const overlap = new Set(term.split(' ').filter(token => queryTokens.has(token) && !POLICY_STOP_WORDS.has(token)));
    score += overlap.size;
  }
  return score;
}
export function findReadablePolicyKnowledge(question, { limit = 4 } = {}) {
  const actor = requireRoles();
  if (typeof question !== 'string' || !question.trim()) return [];
  const matches = [];
  for (const document of getReadableDocuments()) {
    for (const entry of document.knowledge || []) {
      const scopedDocument = { ...document, departmentId: entry.departmentId, targetRole: entry.targetRole };
      if (!can(actor, 'documents:read', scopedDocument)) continue;
      const score = policyScore(entry, question);
      if (score >= 10) {
  matches.push({ document, entry, score });
}
    }
  }
  return matches
    .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt) || a.entry.id.localeCompare(b.entry.id))
    .slice(0, Math.max(1, Math.min(10, Number(limit) || 4)));
}
export function listDocuments(query = {}) { return filter(getReadableDocuments(), query, ['title', 'description', 'category']); }
export function getDocument(id) {
  const actor = requireRoles(); const item = getById('documents', id);
  if (!item || !can(actor, 'documents:read', item)) fail('Tài liệu không tồn tại hoặc bạn không có quyền đọc.', 'FORBIDDEN');
  return item;
}
function validateDocument(input, previous = {}) {
  const title = required(input.title, 'Tiêu đề');
  if (!['draft', 'active', 'archived'].includes(input.status)) fail('Trạng thái tài liệu không hợp lệ.');
  if (!['all', 'newhire', 'newHire', 'mentor', 'hr', 'admin'].includes(input.targetRole)) fail('Đối tượng tài liệu không hợp lệ.');
  department(input.departmentId, previous.departmentId);
  const fileUrl = text(input.fileUrl);
  if (fileUrl) {
    if (/^https?:\/\//i.test(fileUrl)) {
      try { new URL(fileUrl); } catch { fail('URL tài liệu không hợp lệ.'); }
    } else {
      let path;
      try { path = decodeURIComponent(fileUrl); } catch { fail('Đường dẫn tệp không hợp lệ.'); }
      if (!/^assets\/docs\/[^?#]+$/i.test(path) || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) fail('Đường dẫn tệp cần là HTTP(S) hoặc assets/docs/ hợp lệ.');
    }
  }
  return { title, category: text(input.category) || 'Chung', description: text(input.description), fileUrl, departmentId: input.departmentId, targetRole: input.targetRole, status: input.status, knowledge: Array.isArray(input.knowledge) ? input.knowledge : [] };
}
const DOC_FIELDS = ['title', 'category', 'description', 'fileUrl', 'departmentId', 'targetRole', 'status'];
export function createDocument(input) {
  const actor = requireRoles(['hr', 'admin']); fields(input, DOC_FIELDS);
  const values = validateDocument({ category: 'Chung', description: null, fileUrl: null, departmentId: null, targetRole: 'all', status: 'draft', ...input });
  if (values.status !== 'draft') fail('Tài liệu mới phải là bản nháp; phát hành bằng thao tác riêng.');
  const now = new Date().toISOString();
  return create('documents', { ...values, id: createId('documents'), createdBy: actor.id, createdAt: now, updatedAt: now });
}
export function updateDocument(id, patch) {
  requireRoles(['hr', 'admin']); fields(patch, DOC_FIELDS);
  const previous = record('documents', id);
  return update('documents', id, { ...validateDocument({ ...previous, ...patch }, previous), updatedAt: new Date().toISOString() });
}
export function archiveDocument(id) { return updateDocument(id, { status: 'archived' }); }
function checkinScope(hireId, mentorId) {
  const actor = requireRoles(['mentor', 'hr', 'admin']);
  const hire = record('newHires', hireId);
  if (actor.role === 'mentor' && (hire.mentorId !== actor.id || mentorId !== actor.id)) fail('Chỉ quản lý check-in của mentee đang được phân công.', 'FORBIDDEN');
  return { actor, hire };
}
export function listCheckins(query = {}) {
  const actor = requireRoles(['mentor', 'hr', 'admin']);
  const hires = getAll('newHires');
  let items = getAll('checkins').filter(item => actor.role !== 'mentor' || (item.mentorId === actor.id && hires.some(hire => hire.id === item.newHireId && hire.mentorId === actor.id)));
  if (query.newHireId) items = items.filter(item => item.newHireId === query.newHireId);
  if (query.mentorId) items = items.filter(item => item.mentorId === query.mentorId);
  // HR/Admin only receive schedule metadata; private mentor notes stay private.
  items = items.map(item => actor.role === 'mentor' ? item : { ...item, note: null, nextAction: null });
  items = items.map(item => ({ ...item, conflictingIds: item.status === 'cancelled' ? [] : items.filter(other =>
    other.id !== item.id && other.status !== 'cancelled' && other.newHireId === item.newHireId
    && other.mentorId === item.mentorId && parseStoredDate(other.scheduledAt)?.getTime() === parseStoredDate(item.scheduledAt)?.getTime()).map(other => other.id) }));
  return filter(items, query, ['note', 'nextAction'])
    .sort((a, b) => (parseStoredDate(b.scheduledAt)?.getTime() || 0) - (parseStoredDate(a.scheduledAt)?.getTime() || 0));
}
function validateCheckin(input, id = null) {
  const { hire } = checkinScope(input.newHireId, input.mentorId);
  if (hire.status === 'archived') fail('Hồ sơ đã lưu trữ.');
  const mentor = record('users', input.mentorId);
  if (mentor.role !== 'mentor' || mentor.status !== 'active' || hire.mentorId !== mentor.id) fail('Mentor phải đang hoạt động và được phân công cho nhân sự.');
  if (!['scheduled', 'completed', 'cancelled'].includes(input.status)) fail('Trạng thái lịch hẹn không hợp lệ.');
  const date = typeof input.scheduledAt === 'string' ? parseStoredDate(input.scheduledAt) : null;
  if (!date) fail('Ngày giờ check-in không hợp lệ.');
  const previous = id ? getById('checkins', id) : null;
  // Preserve legacy duplicates and allow note corrections without silently merging them.
  const sameAppointment = previous && previous.status !== 'cancelled' && parseStoredDate(previous.scheduledAt)?.getTime() === date.getTime();
  if (input.status !== 'cancelled' && !sameAppointment) {
    const duplicate = getAll('checkins').find(item => item.id !== id && item.newHireId === input.newHireId && item.mentorId === input.mentorId && item.status !== 'cancelled' && parseStoredDate(item.scheduledAt)?.getTime() === date.getTime());
    if (duplicate) {
      const error = new StoreError('DUPLICATE_ID', `Đã có lịch ${duplicate.id} cùng thời điểm. Hãy mở lịch hiện có.`);
      error.existingId = duplicate.id; throw error;
    }
  }
  return { ...input, scheduledAt: date.toISOString(), note: text(input.note), nextAction: text(input.nextAction) };
}
export function createCheckin(input) {
  const actor = requireRoles(['mentor']);
  fields(input, ['newHireId', 'mentorId', 'scheduledAt', 'status', 'note', 'nextAction']);
  if (actor.role !== 'mentor' && (input.note || input.nextAction)) fail('Ghi chú riêng do mentor quản lý.', 'FORBIDDEN');
  const hire = record('newHires', input.newHireId);
  const values = validateCheckin({ status: 'scheduled', note: null, nextAction: null, ...input, mentorId: actor.role === 'mentor' ? actor.id : (input.mentorId || hire.mentorId) });
  const now = new Date().toISOString();
  return create('checkins', { ...values, id: createId('checkins'), createdAt: now, updatedAt: now });
}
export function updateCheckin(id, patch) {
  requireRoles(['mentor']);
  fields(patch, ['scheduledAt', 'status', 'note', 'nextAction']);
  const previous = record('checkins', id);
  const { actor } = checkinScope(previous.newHireId, previous.mentorId);
  if (actor.role !== 'mentor' && ('note' in patch || 'nextAction' in patch)) fail('Ghi chú riêng do mentor quản lý.', 'FORBIDDEN');
  const values = validateCheckin({ ...previous, ...patch }, id);
  if (parseStoredDate(previous.createdAt)?.getTime() > Date.now()) fail('Ngày tạo lịch nằm trong tương lai. Cần kiểm tra dữ liệu.');
  return update('checkins', id, { ...values, updatedAt: new Date().toISOString() });
}
