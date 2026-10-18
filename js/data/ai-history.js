<<<<<<< HEAD
/*
 * ai-history.js — lịch sử và quyết định của người dùng với AI (hợp đồng mục 2.8).
 * OWNER: SV1. File này là bản nền tối thiểu đúng trường hợp đồng để Progress Risk
 * (SV3) lưu được kết quả đánh giá; SV1 review và mở rộng (xem/sửa/xóa theo chủ sở hữu).
 */
import { requireRoles } from './auth.js';
import { StoreError, create, createId, getAll, getById, update } from './store.js';

const FEATURE_TYPES = ['policyQA', 'checklistPersonalizer', 'progressRisk'];
const DECISIONS = ['pending', 'accepted', 'rejected'];

function now() {
  return new Date().toISOString();
}

function assertFeatureType(featureType) {
  if (!FEATURE_TYPES.includes(featureType)) {
    throw new StoreError('VALIDATION_ERROR', `featureType không hợp lệ: ${featureType}.`);
  }
}

function assertDecision(decision) {
  if (!DECISIONS.includes(decision)) {
    throw new StoreError('VALIDATION_ERROR', `decision không hợp lệ: ${decision}.`);
  }
}

/** Lịch sử AI theo filter; userId mặc định là người đang đăng nhập (mỗi người chỉ thấy của mình). */
export async function listAiHistory({ userId, featureType } = {}) {
  const user = await requireRoles([]);
  if (featureType) assertFeatureType(featureType);
  const owner = userId ?? user.id;
  const items = await getAll('aiHistory');
  return items.filter((item) => item.userId === owner && (!featureType || item.featureType === featureType));
}

export async function getAiHistory(id) {
  const user = await requireRoles([]);
  const record = await getById('aiHistory', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy lịch sử AI ${id}.`);
  if (record.userId !== user.id) {
    throw new StoreError('FORBIDDEN', 'Chỉ chủ sở hữu bản ghi mới xem được lịch sử AI của mình.');
  }
  return record;
}

/**
 * Lưu một kết quả AI. Quyền:
 * - policyQA: mọi vai trò đã đăng nhập, userId = người đăng nhập.
 * - progressRisk/checklistPersonalizer: HR/Admin; newHireId là nhân sự liên quan.
 */
export async function createAiHistory({ featureType, input, result, reason, decision = 'pending', newHireId = null, userId } = {}) {
  const user = await requireRoles([]);
  assertFeatureType(featureType);
  assertDecision(decision);
  if (featureType === 'progressRisk' || featureType === 'checklistPersonalizer') {
    await requireRoles(['hr', 'admin']);
  }
  const owner = userId ?? user.id;
  if (owner !== user.id) {
    throw new StoreError('FORBIDDEN', 'Không lưu lịch sử AI thay cho người khác.');
  }
  const timestamp = now();
  return create('aiHistory', {
    id: createId('aiHistory'),
    featureType,
    userId: owner,
    newHireId,
    input: typeof input === 'string' ? input : '',
    result: result && typeof result === 'object' ? result : {},
    reason: typeof reason === 'string' ? reason : '',
    decision,
    appliedTaskIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Sửa bản ghi AI: đổi decision hoặc patch result/reason khi còn cho phép.
 * Sau khi decision khác pending, result/reason bị khóa (mục 2.8); chỉ đổi decision được.
 */
export async function updateAiHistory(id, patch = {}) {
  const record = await getAiHistory(id);
  const changes = {};
  if (Object.hasOwn(patch, 'decision')) { assertDecision(patch.decision); changes.decision = patch.decision; }
  if (Object.hasOwn(patch, 'result') || Object.hasOwn(patch, 'reason') || Object.hasOwn(patch, 'input')) {
    if (record.decision !== 'pending') {
      throw new StoreError('VALIDATION_ERROR', 'Bản ghi AI đã áp dụng/duyệt, không sửa được result/input; chỉ đổi decision.');
    }
    if (Object.hasOwn(patch, 'result')) changes.result = patch.result && typeof patch.result === 'object' ? patch.result : {};
    if (Object.hasOwn(patch, 'reason')) changes.reason = typeof patch.reason === 'string' ? patch.reason : '';
    if (Object.hasOwn(patch, 'input')) changes.input = typeof patch.input === 'string' ? patch.input : '';
  }
  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật lịch sử AI.');
  }
  return update('aiHistory', id, { ...changes, updatedAt: now() });
=======
import * as store from './store.js';
import { requireRoles } from '../common/auth.js';
import { getMyHire } from './people.js';
import { getDocument, getReadableDocuments } from './resources.js';
import { parseStoredDate } from '../common/format.js';

const features = { policyQA: ['newHire'], checklistPersonalizer: ['mentor'], progressRisk: ['hr', 'admin'] };
function featureUser(feature) {
  if (!Object.hasOwn(features, feature)) throw new Error('Tính năng AI không hợp lệ.');
  return requireRoles(features[feature]);
}
function owned(id) {
  const user = requireRoles(); const item = store.getById('aiHistory', id);
  if (!item || item.userId !== user.id) throw new Error('Không có quyền truy cập lịch sử này.');
  return item;
}
function validateResult(feature, result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Kết quả AI không hợp lệ.');
  if (feature === 'policyQA') {
    if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('Câu trả lời không được để trống.');
    if (result.sourceDocumentId !== null) getDocument(result.sourceDocumentId);
    return { answer: result.answer.trim(), sourceDocumentId: result.sourceDocumentId };
  }
  if (feature === 'checklistPersonalizer') {
    if (!Array.isArray(result.items) || !result.items.length) throw new Error('Checklist phải có nhiệm vụ.');
    return { items: result.items.map(item => {
      if (typeof item.title !== 'string' || !item.title.trim() || !['low', 'medium', 'high'].includes(item.priority)
        || (item.description != null && typeof item.description !== 'string') || (item.category != null && typeof item.category !== 'string')
        || (item.dueDate != null && (!/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) || !parseStoredDate(item.dueDate)))) throw new Error('Nhiệm vụ gợi ý không hợp lệ.');
      return { title: item.title.trim(), description: item.description || '', category: item.category || '', priority: item.priority, dueDate: item.dueDate || null };
    }) };
  }
  if (!['low', 'medium', 'high', 'unknown'].includes(result.level) || typeof result.summary !== 'string' || !Array.isArray(result.recommendations) || result.recommendations.some(item => typeof item !== 'string')) throw new Error('Kết quả đánh giá không hợp lệ.');
  return { level: result.level, summary: result.summary, recommendations: [...result.recommendations] };
}
export function listMyHistory(featureType) {
  const actor = requireRoles();
  return store.getAll('aiHistory').filter(item => item.userId === actor.id && (!featureType || item.featureType === featureType))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getHistory(id) { return owned(id); }
export function createHistory({ featureType, newHireId = null, input, result, reason = '' }) {
  const user = featureUser(featureType);
  if (typeof input !== 'string' || !input.trim() || input.length > 2000) throw new Error('Đầu vào phải có từ 1 đến 2000 ký tự.');
  if (store.getAll('users').some(account => account.password && input.includes(account.password))) throw new Error('Không nhập mật khẩu vào nội dung AI.');
  if (newHireId !== null) {
    const hire = store.getById('newHires', newHireId);
    if (!hire || (user.role === 'newHire' && hire.userId !== user.id) || (user.role === 'mentor' && hire.mentorId !== user.id)) throw new Error('Hồ sơ liên quan nằm ngoài quyền truy cập.');
  }
  const now = new Date().toISOString();
  return store.create('aiHistory', { id: `ai-history-${crypto.randomUUID()}`, featureType, userId: user.id, newHireId, input: input.trim(), result: validateResult(featureType, result), reason: String(reason), decision: 'pending', appliedTaskIds: [], createdAt: now, updatedAt: now });
}
export function updateHistory(id, patch) {
  const item = owned(id); featureUser(item.featureType);
  if (item.decision !== 'pending') throw new Error('Chỉ được sửa kết quả đang chờ quyết định.');
  if (!patch || Object.keys(patch).some(key => !['result', 'reason'].includes(key))) throw new Error('Trường lịch sử không được phép thay đổi.');
  if (Object.hasOwn(patch, 'reason') && typeof patch.reason !== 'string') throw new Error('Giải thích phải là văn bản.');
  return store.update('aiHistory', id, { ...patch, ...(Object.hasOwn(patch, 'result') ? { result: validateResult(item.featureType, patch.result) } : {}), updatedAt: new Date().toISOString() });
}
export function decideHistory(id, decision) {
  const item = owned(id); featureUser(item.featureType);
  if (item.decision !== 'pending') throw new Error('Kết quả đã được quyết định.');
  if (!['accepted', 'rejected'].includes(decision)) throw new Error('Quyết định không hợp lệ.');
  if (item.featureType === 'checklistPersonalizer' && decision === 'accepted') throw new Error('Checklist phải được chấp nhận qua tasks.applyChecklist.');
  return store.update('aiHistory', id, { decision, updatedAt: new Date().toISOString() });
}
// Called by SV2 after idempotent task creation, including retries after partial writes.
export function completeChecklistHistory(id, taskIds) {
  const item = owned(id); const actor = featureUser('checklistPersonalizer');
  if (item.featureType !== 'checklistPersonalizer' || item.decision === 'rejected') throw new Error('Checklist không thể áp dụng.');
  const hire = store.getById('newHires', item.newHireId);
  if (!hire || hire.mentorId !== actor.id) throw new Error('Nhân sự không thuộc mentor hiện tại.');
  if (!Array.isArray(taskIds) || taskIds.length !== item.result.items.length || new Set(taskIds).size !== taskIds.length || taskIds.some((taskId, index) => {
    const task = store.getById('tasks', taskId);
    return taskId !== `task-${id}-${index}` || !task || task.newHireId !== hire.id || task.assignedTo !== hire.userId;
  })) throw new Error('Chưa lưu đủ nhiệm vụ của checklist.');
  return store.update('aiHistory', id, { decision: 'accepted', appliedTaskIds: taskIds, updatedAt: new Date().toISOString() });
}
export function deleteHistory(id) {
  const item = owned(id);
  if (item.appliedTaskIds.length || store.getAll('tasks').some(task => task.id.startsWith(`task-${id}-`))) throw new Error('Lịch sử đã tạo nhiệm vụ cần được giữ để đối chiếu.');
  store.removeHistory(id);
}
function normalize(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase(); }
export function askPolicy(question) {
  requireRoles(['newHire']);
  if (typeof question !== 'string' || !question.trim() || question.length > 2000) throw new Error('Nhập câu hỏi từ 1 đến 2000 ký tự.');
  const documents = getReadableDocuments(); const ids = new Set(documents.map(item => item.id));
  const mocks = store.getAll('aiMockData').filter(item => item.status === 'active');
  const query = normalize(question);
  const matches = mocks.filter(item => item.featureType === 'policyQA' && (!item.sourceDocumentId || ids.has(item.sourceDocumentId)))
    .map(item => ({ item, score: String(item.inputKeywords || '').split(';').map(normalize).filter(word => word.trim() && query.includes(word.trim())).length }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || b.item.confidence - a.item.confidence);
  const matched = matches[0]?.item;
  const answer = matched || mocks.find(item => item.featureType === 'fallback');
  const uncertain = !matched || !matched.sourceDocumentId || Number(matched.confidence) < 0.7;
  return createHistory({ featureType: 'policyQA', newHireId: getMyHire()?.id || null, input: question,
    result: { answer: answer?.resultContent || 'Chưa đủ dữ liệu để trả lời. Vui lòng liên hệ HR.', sourceDocumentId: matched?.sourceDocumentId || null },
    reason: `${uncertain ? 'Chưa đủ thông tin chắc chắn; cần HR xác nhận. ' : ''}${answer?.reason || 'Không tìm thấy dữ liệu phù hợp.'} Đây là tra cứu dữ liệu mẫu, chưa gọi AI thật.` });
>>>>>>> 906d77f (Update localstorage sv1)
}
