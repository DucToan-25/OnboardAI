import { getAll, getById, create, update, createId, StoreError, transaction } from './store.js';
import { requireRoles } from '../common/auth.js';
import { parseStoredDate } from '../common/format.js';
import { getHistory, createHistory, completeChecklistHistory } from './ai-history.js';

const STATUSES = ['todo', 'inProgress', 'blocked', 'completed'];
function fail(message, code = 'VALIDATION_ERROR') { throw new StoreError(code, message); }
function authorizedHire(id, writable = false) {
  const actor = requireRoles(writable ? ['mentor', 'hr', 'admin'] : undefined);
  const hire = getById('newHires', id);
  if (!hire || (actor.role === 'newHire' && hire.userId !== actor.id) || (actor.role === 'mentor' && hire.mentorId !== actor.id)) fail('Không có quyền truy cập hồ sơ này.', 'FORBIDDEN');
  return { actor, hire };
}
function assertAssignable(hire) {
  if (hire.status === 'archived') fail('Hồ sơ đã lưu trữ.');
  const user = getById('users', hire.userId);
  const journey = getById('journeys', hire.journeyId);
  if (!user || user.role !== 'newHire' || user.status !== 'active') fail('Nhân sự cần có tài khoản đang hoạt động.');
  if (!journey || journey.status !== 'active') fail('Cần gán hành trình đang hoạt động trước khi giao việc.');
}
function validateTask(input) {
  const dueDate = input.dueDate === '' || input.dueDate == null ? null : input.dueDate;
  if (typeof input.title !== 'string' || !input.title.trim()) fail('Tiêu đề nhiệm vụ không được để trống.');
  if (!['low', 'medium', 'high'].includes(input.priority)) fail('Mức ưu tiên không hợp lệ.');
  if (![...STATUSES, 'archived'].includes(input.status)) fail('Trạng thái nhiệm vụ không hợp lệ.');
  if (dueDate !== null && (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !parseStoredDate(dueDate))) fail('Hạn hoàn thành không hợp lệ.');
  for (const key of ['description', 'category']) if (input[key] != null && typeof input[key] !== 'string') fail('Nội dung nhiệm vụ phải là văn bản.');
  return { ...input, title: input.title.trim(), description: input.description?.trim() || null, category: input.category?.trim() || 'Chung', dueDate };
}
function taskContext(id, writable = false) {
  const task = getById('tasks', id);
  if (!task) fail('Không tìm thấy nhiệm vụ.', 'NOT_FOUND');
  const context = authorizedHire(task.newHireId, writable);
  return { ...context, task };
}
function assertTaskLinks(task, hire) {
  if (task.assignedTo !== hire.userId || task.journeyId !== hire.journeyId) fail('Liên kết nhiệm vụ chưa khớp hồ sơ. Cần người quản lý kiểm tra.');
  if (parseStoredDate(task.createdAt)?.getTime() > Date.now()) fail('Ngày tạo nhiệm vụ nằm trong tương lai. Cần kiểm tra dữ liệu.');
}
export function getTasksForHire(hireId) {
  const { hire } = authorizedHire(hireId);
  return getAll('tasks').filter(task => task.newHireId === hireId && task.assignedTo === hire.userId)
    .map(task => ({ ...task, linkIssue: task.journeyId !== hire.journeyId ? `${task.id}: hành trình nhiệm vụ ${task.journeyId} khác hồ sơ ${hire.journeyId}. Cần HR xác nhận trước khi cập nhật.` : null }));
}
export function getProgress(hireId) {
  const tasks = getTasksForHire(hireId).filter(task => task.status !== 'archived');
  const completed = tasks.filter(task => task.status === 'completed').length;
  return { total: tasks.length, completed, percent: tasks.length ? Math.round(completed * 100 / tasks.length) : 0 };
}
export function createTask(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['newHireId', 'title', 'description', 'category', 'priority', 'dueDate', 'status'].includes(key))) fail('Có trường nhiệm vụ không được phép ghi.');
  const { hire, actor } = authorizedHire(input?.newHireId, true);
  assertAssignable(hire);
  const timestamp = new Date().toISOString();
  const task = validateTask({ title: input.title, description: input.description ?? null, category: input.category ?? 'Chung', priority: input.priority ?? 'medium', dueDate: input.dueDate ?? null, status: input.status ?? 'todo' });
  return create('tasks', { ...task, id: createId('tasks'), newHireId: hire.id, assignedTo: hire.userId, journeyId: hire.journeyId, createdBy: actor.id, createdAt: timestamp, updatedAt: timestamp, completedAt: task.status === 'completed' ? timestamp : null });
}
export function updateTask(id, patch) {
  const { task, hire } = taskContext(id, true);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['title', 'description', 'category', 'priority', 'dueDate', 'status'].includes(key))) fail('Có trường nhiệm vụ không được phép thay đổi.');
  assertTaskLinks(task, hire);
  if (hire.status === 'archived') fail('Hồ sơ đã lưu trữ.');
  const next = validateTask({ ...task, ...patch });
  const now = new Date().toISOString();
  return update('tasks', id, { ...Object.fromEntries(Object.keys(patch).map(key => [key, next[key]])), updatedAt: now, completedAt: next.status === 'completed' ? (task.status === 'completed' ? task.completedAt : now) : null });
}
export function updateTaskStatus(id, status) {
  const { task, hire, actor } = taskContext(id);
  if (actor.role !== 'newHire') return updateTask(id, { status });
  if (!STATUSES.includes(status)) fail('Nhân sự mới không được lưu trữ nhiệm vụ.', 'FORBIDDEN');
  if (hire.status === 'archived' || task.status === 'archived') fail('Hồ sơ hoặc nhiệm vụ đã lưu trữ.');
  assertTaskLinks(task, hire);
  const now = new Date().toISOString();
  return update('tasks', id, { status, updatedAt: now, completedAt: status === 'completed' ? (task.status === 'completed' ? task.completedAt : now) : null });
}
export function archiveTask(id) {
  const { task } = taskContext(id, true);
  // Archive also allows a manager to retire inconsistent legacy tasks without rewriting links.
  return update('tasks', task.id, { status: 'archived', completedAt: null, updatedAt: new Date().toISOString() });
}
export function saveTaskResult(id, input) {
  const actor = requireRoles(['newHire']);
  const { task, hire } = taskContext(id);
  if (hire.userId !== actor.id || task.status === 'archived' || hire.status === 'archived') fail('Không được ghi kết quả cho nhiệm vụ này.', 'FORBIDDEN');
  assertTaskLinks(task, hire);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['note', 'url'].includes(key))) fail('Chỉ được ghi chú và liên kết kết quả.');
  if (typeof input.note !== 'string' || !input.note.trim() || input.note.length > 4000) fail('Ghi chú cần từ 1 đến 4000 ký tự.');
  if (input.url != null && typeof input.url !== 'string') fail('Liên kết kết quả không hợp lệ.');
  const url = input.url?.trim() || null;
  if (url) {
    try { if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error(); }
    catch { fail('Liên kết kết quả phải là HTTP(S).'); }
  }
  const now = new Date().toISOString();
  return update('tasks', id, { result: { note: input.note.trim(), url, createdAt: task.result?.createdAt || now, updatedAt: now }, updatedAt: now });
}
export function suggestChecklist(hireId, input) {
  const { hire } = authorizedHire(hireId, true);
  requireRoles(['mentor']);
  assertAssignable(hire);
  if (typeof input !== 'string' || !input.trim()) fail('Nhập nhu cầu hội nhập để tạo gợi ý.');
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const query = normalize(`${input} ${hire.jobTitle || ''}`);
  const candidates = getAll('aiMockData').filter(item => item.featureType === 'checklistPersonalizer' && item.status === 'active')
    .map(item => ({ item, score: String(item.inputKeywords || '').split(';').map(normalize).filter(word => word.trim() && query.includes(word.trim())).length }))
    .filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || b.item.confidence - a.item.confidence);
  const match = candidates[0]?.item;
  if (!match) fail('Chưa có dữ liệu mẫu phù hợp. Hãy bổ sung mô tả vị trí hoặc giao nhiệm vụ thủ công.');
  const titles = String(match.resultContent || '').split(/[;\n]+/).map(value => value.replace(/^\s*[-\d.)]+\s*/, '').trim()).filter(Boolean);
  if (!titles.length) fail('Dữ liệu gợi ý chưa có nhiệm vụ hợp lệ.');
  return createHistory({ featureType: 'checklistPersonalizer', newHireId: hireId, input,
    result: { items: titles.map(title => ({ title, description: '', category: 'Hội nhập', priority: 'medium', dueDate: null })) },
    reason: `${match.reason || 'Khớp từ khóa vị trí.'} Đây là gợi ý từ dữ liệu mẫu, cần mentor rà soát trước khi giao việc.` });
}
export function applyChecklist(historyId) {
  return transaction(() => applyChecklistDraft(historyId));
}
function applyChecklistDraft(historyId) {
  requireRoles(['mentor']);
  const history = getHistory(historyId);
  if (history.featureType !== 'checklistPersonalizer' || history.decision === 'rejected') fail('Checklist không thể áp dụng.');
  const { hire, actor } = authorizedHire(history.newHireId, true);
  if (history.decision === 'accepted') return { historyId, appliedTaskIds: history.appliedTaskIds, createdTaskIds: [] };
  assertAssignable(hire);
  const drafts = history.result.items.map(item => validateTask({ ...item, status: 'todo' }));
  const appliedTaskIds = []; const createdTaskIds = [];
  for (const [index, draft] of drafts.entries()) {
    const id = `task-${historyId}-${index}`;
    const existing = getById('tasks', id);
    if (existing && (existing.newHireId !== hire.id || existing.assignedTo !== hire.userId || existing.journeyId !== hire.journeyId)) fail('Mã nhiệm vụ đã thuộc liên kết khác.');
    if (!existing) {
      const now = new Date().toISOString();
      create('tasks', { ...draft, id, newHireId: hire.id, assignedTo: hire.userId, journeyId: hire.journeyId, createdBy: actor.id, createdAt: now, updatedAt: now, completedAt: null });
      createdTaskIds.push(id);
    }
    appliedTaskIds.push(id);
  }
  completeChecklistHistory(historyId, appliedTaskIds);
  return { historyId, appliedTaskIds, createdTaskIds };
}
