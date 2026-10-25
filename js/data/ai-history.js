import * as store from './store.js';
import { requireRoles } from '../common/auth.js';
import { getMyHire } from './people.js';
import { getDocument, findReadablePolicyKnowledge } from './resources.js';
import { parseStoredDate } from '../common/format.js';

const FEATURES = Object.freeze({
  policyQA: ['newHire'],
  checklistPersonalizer: ['mentor'],
  progressRisk: ['hr', 'admin'],
});
const AI_SOURCES = new Set(['mock', 'gemini', 'rule-based']);

export const SENSITIVE_DATA_NOTICE = 'Không nhập mật khẩu, token hoặc dữ liệu nhạy cảm.';

function featureUser(feature) {
  if (!Object.hasOwn(FEATURES, feature)) throw new Error('Tính năng AI không hợp lệ.');
  return requireRoles(FEATURES[feature]);
}

function owned(id) {
  const user = requireRoles();
  const item = store.getById('aiHistory', id);
  if (!item || item.userId !== user.id) throw new Error('Không có quyền truy cập lịch sử này.');
  return item;
}

function validateInput(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 2000) {
    throw new Error('Đầu vào phải có từ 1 đến 2000 ký tự.');
  }
  return input.trim();
}

function validateAiMetadata(aiSource = 'mock', model = null) {
  if (!AI_SOURCES.has(aiSource)) throw new Error('Nguồn kết quả AI không hợp lệ.');
  if (model != null && (typeof model !== 'string' || !model.trim() || model.length > 120)) {
    throw new Error('Tên model AI không hợp lệ.');
  }
  return { aiSource, model: model?.trim() || null };
}

function validateResult(feature, result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Kết quả AI không hợp lệ.');
  }
  if (feature === 'policyQA') {
    if (typeof result.answer !== 'string' || !result.answer.trim()) {
      throw new Error('Câu trả lời không được để trống.');
    }
    if (result.sourceDocumentId !== null) getDocument(result.sourceDocumentId);
    return {
      answer: result.answer.trim(),
      sourceDocumentId: result.sourceDocumentId,
      uncertain: Boolean(result.uncertain),
    };
  }
  if (feature === 'checklistPersonalizer') {
    if (!Array.isArray(result.items) || !result.items.length) {
      throw new Error('Checklist phải có nhiệm vụ.');
    }
    return {
      items: result.items.map((item) => {
        const invalidDate = item.dueDate != null
          && (!/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) || !parseStoredDate(item.dueDate));
        if (typeof item.title !== 'string' || !item.title.trim()
          || !['low', 'medium', 'high'].includes(item.priority)
          || (item.description != null && typeof item.description !== 'string')
          || (item.category != null && typeof item.category !== 'string')
          || (item.reason != null && typeof item.reason !== 'string')
          || invalidDate) {
          throw new Error('Nhiệm vụ gợi ý không hợp lệ.');
        }
        return {
          title: item.title.trim(),
          description: typeof item.description === 'string' ? item.description.trim() : '',
          category: typeof item.category === 'string' ? item.category.trim() : '',
          priority: item.priority,
          dueDate: item.dueDate || null,
          reason: typeof item.reason === 'string' ? item.reason.trim() : '',
        };
      }),
    };
  }
  if (!['low', 'medium', 'high', 'unknown'].includes(result.level)
    || typeof result.summary !== 'string'
    || !Array.isArray(result.recommendations)
    || result.recommendations.some((item) => typeof item !== 'string')) {
    throw new Error('Kết quả đánh giá không hợp lệ.');
  }
  const normalized = {
    level: result.level,
    summary: result.summary,
    recommendations: [...result.recommendations],
  };
  if (result.progress != null) {
    const progress = result.progress;
    if (!progress || !Number.isSafeInteger(progress.total) || !Number.isSafeInteger(progress.completed)
      || !Number.isSafeInteger(progress.percent) || progress.total < 0 || progress.completed < 0
      || progress.completed > progress.total || progress.percent < 0 || progress.percent > 100) {
      throw new Error('Số liệu tiến độ lưu cùng đánh giá không hợp lệ.');
    }
    normalized.progress = { total: progress.total, completed: progress.completed, percent: progress.percent };
  }
  if (result.signals != null) {
    const signals = result.signals;
    const countFields = ['totalTasks', 'completedTasks', 'inProgressTasks', 'notStartedTasks', 'overdueTasks', 'blockedTasks', 'completedCheckins', 'scheduledCheckins'];
    if (!signals || countFields.some(field => !Number.isSafeInteger(signals[field]) || signals[field] < 0)
      || (signals.onboardingDaysElapsed != null && (!Number.isSafeInteger(signals.onboardingDaysElapsed) || signals.onboardingDaysElapsed < 0))
      || !Array.isArray(signals.riskTasks)
      || signals.riskTasks.some(task => !task || typeof task.id !== 'string' || typeof task.title !== 'string'
        || !['todo', 'inProgress', 'blocked', 'completed'].includes(task.status)
        || (task.dueDate != null && (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) || !parseStoredDate(task.dueDate))))) {
      throw new Error('Tín hiệu rủi ro lưu cùng đánh giá không hợp lệ.');
    }
    normalized.signals = {
      ...Object.fromEntries(countFields.map(field => [field, signals[field]])),
      onboardingDaysElapsed: signals.onboardingDaysElapsed ?? null,
      riskTasks: signals.riskTasks.map(task => ({ id: task.id, title: task.title, status: task.status, dueDate: task.dueDate ?? null })),
      hasUser: Boolean(signals.hasUser),
      hasMentor: Boolean(signals.hasMentor),
      hasJourney: Boolean(signals.hasJourney),
    };
  }
  return normalized;
}

function validateScope(featureType, newHireId, user) {
  if (newHireId === null) return;
  const hire = store.getById('newHires', newHireId);
  if (!hire
    || (user.role === 'newHire' && hire.userId !== user.id)
    || (user.role === 'mentor' && hire.mentorId !== user.id)) {
    throw new Error('Hồ sơ liên quan nằm ngoài quyền truy cập.');
  }
  if (featureType === 'policyQA' && user.role !== 'newHire') {
    throw new Error('Hồ sơ hỏi đáp không hợp lệ.');
  }
}

function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new Error('Bản nháp AI không hợp lệ.');
  }
  const user = featureUser(draft.featureType);
  const newHireId = draft.newHireId ?? null;
  validateScope(draft.featureType, newHireId, user);
  if (typeof draft.draftId !== 'string' || !draft.draftId.trim()) {
    throw new Error('Bản nháp AI thiếu mã chống lưu trùng.');
  }
  return {
    draftId: draft.draftId.trim(),
    featureType: draft.featureType,
    newHireId,
    input: validateInput(draft.input),
    result: validateResult(draft.featureType, draft.result),
    reason: String(draft.reason || ''),
    ...validateAiMetadata(draft.aiSource, draft.model),
  };
}

export function createDraft({
  featureType,
  newHireId = null,
  input,
  result,
  reason = '',
  aiSource = 'mock',
  model = null,
}) {
  const user = featureUser(featureType);
  validateScope(featureType, newHireId, user);
  return {
    draftId: crypto.randomUUID(),
    featureType,
    newHireId,
    input: validateInput(input),
    result: validateResult(featureType, result),
    reason: String(reason),
    ...validateAiMetadata(aiSource, model),
  };
}

export function listMyHistory(featureType, { includeArchived = false } = {}) {
  const actor = requireRoles();
  return store.getAll('aiHistory')
    .filter((item) => item.userId === actor.id
      && (!featureType || item.featureType === featureType)
      && (includeArchived || !item.archivedAt))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getHistory(id) {
  return owned(id);
}

export function createHistory({
  featureType,
  newHireId = null,
  input,
  result,
  reason = '',
  draftId = null,
  decision = 'pending',
  aiSource = 'mock',
  model = null,
}) {
  const user = featureUser(featureType);
  validateScope(featureType, newHireId, user);
  if (!['pending', 'accepted', 'rejected'].includes(decision)) {
    throw new Error('Quyết định không hợp lệ.');
  }
  const safeDraftId = draftId == null ? null : String(draftId).trim();
  if (safeDraftId) {
    const existing = store.getAll('aiHistory')
      .find((item) => item.userId === user.id && item.draftId === safeDraftId);
    if (existing) return existing;
  }
  const now = new Date().toISOString();
  const metadata = validateAiMetadata(aiSource, model);
  return store.create('aiHistory', {
    id: `ai-history-${crypto.randomUUID()}`,
    draftId: safeDraftId,
    featureType,
    userId: user.id,
    newHireId,
    input: validateInput(input),
    result: validateResult(featureType, result),
    reason: String(reason),
    ...metadata,
    decision,
    appliedTaskIds: [],
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export function saveHistoryDraft(draft, decision = 'pending') {
  const normalized = normalizeDraft(draft);
  const actor = featureUser(normalized.featureType);
  const existing = store.getAll('aiHistory')
    .find((item) => item.userId === actor.id && item.draftId === normalized.draftId);
  if (existing) {
    if (decision === 'pending' || existing.decision === decision) return existing;
    if (existing.decision !== 'pending') throw new Error('Kết quả đã được quyết định.');
    return decideHistory(existing.id, decision);
  }
  return createHistory({ ...normalized, decision });
}

export function updateHistory(id, patch) {
  const item = owned(id);
  featureUser(item.featureType);
  if (item.decision !== 'pending') throw new Error('Chỉ được sửa kết quả đang chờ quyết định.');
  if (item.featureType === 'checklistPersonalizer'
    && store.getAll('tasks').some((task) => task.id.startsWith(`task-${id}-`))) {
    throw new Error('Checklist đã lưu một phần nhiệm vụ. Hãy chấp nhận lại để hoàn tất trước khi sửa.');
  }
  if (!patch || Object.keys(patch).some((key) => !['result', 'reason'].includes(key))) {
    throw new Error('Trường lịch sử không được phép thay đổi.');
  }
  if (Object.hasOwn(patch, 'reason') && typeof patch.reason !== 'string') {
    throw new Error('Giải thích phải là văn bản.');
  }
  return store.update('aiHistory', id, {
    ...patch,
    ...(Object.hasOwn(patch, 'result') ? { result: validateResult(item.featureType, patch.result) } : {}),
    updatedAt: new Date().toISOString(),
  });
}

export function decideHistory(id, decision) {
  const item = owned(id);
  featureUser(item.featureType);
  if (item.decision === decision) return item;
  if (item.decision !== 'pending') throw new Error('Kết quả đã được quyết định.');
  if (item.featureType === 'checklistPersonalizer'
    && store.getAll('tasks').some((task) => task.id.startsWith(`task-${id}-`))) {
    throw new Error('Checklist đã lưu một phần nhiệm vụ. Hãy chấp nhận lại để hoàn tất.');
  }
  if (!['accepted', 'rejected'].includes(decision)) throw new Error('Quyết định không hợp lệ.');
  if (item.featureType === 'checklistPersonalizer' && decision === 'accepted') {
    throw new Error('Checklist phải được chấp nhận qua tasks.applyChecklist.');
  }
  return store.update('aiHistory', id, {
    decision,
    updatedAt: new Date().toISOString(),
  });
}

export function completeChecklistHistory(id, taskIds) {
  const item = owned(id);
  const actor = featureUser('checklistPersonalizer');
  if (item.featureType !== 'checklistPersonalizer' || item.decision === 'rejected') {
    throw new Error('Checklist không thể áp dụng.');
  }
  const hire = store.getById('newHires', item.newHireId);
  if (!hire || hire.mentorId !== actor.id) throw new Error('Nhân sự không thuộc mentor hiện tại.');
  if (!Array.isArray(taskIds)
    || taskIds.length !== item.result.items.length
    || new Set(taskIds).size !== taskIds.length
    || taskIds.some((taskId, index) => {
      const task = store.getById('tasks', taskId);
      return taskId !== `task-${id}-${index}`
        || !task
        || task.newHireId !== hire.id
        || task.assignedTo !== hire.userId;
    })) {
    throw new Error('Chưa lưu đủ nhiệm vụ của checklist.');
  }
  return store.update('aiHistory', id, {
    decision: 'accepted',
    appliedTaskIds: taskIds,
    updatedAt: new Date().toISOString(),
  });
}

export function archiveHistory(id) {
  const item = owned(id);
  featureUser(item.featureType);
  if (item.archivedAt) return item;
  return store.update('aiHistory', id, {
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function deleteHistory(id) {
  const item = owned(id);
  if (item.appliedTaskIds.length
    || store.getAll('tasks').some((task) => task.id.startsWith(`task-${id}-`))) {
    throw new Error('Lịch sử đã tạo nhiệm vụ cần được giữ để đối chiếu.');
  }
  store.removeHistory(id);
}

export function askPolicy(question) {
  requireRoles(['newHire']);
  const safeQuestion = validateInput(question);
  const matched = findReadablePolicyKnowledge(safeQuestion, { limit: 1 })[0] || null;
  const fallback = store.getAll('aiMockData').find((item) => item.featureType === 'fallback' && item.status === 'active');
  const uncertain = !matched || matched.entry.status === 'needsConfirmation';
  return createDraft({
    featureType: 'policyQA',
    newHireId: getMyHire()?.id || null,
    input: safeQuestion,
    result: {
      answer: matched?.entry.content || fallback?.resultContent || 'Chưa đủ dữ liệu nội bộ để trả lời. Vui lòng liên hệ HR.',
      sourceDocumentId: matched?.document.id || null,
      uncertain,
    },
    reason: matched
      ? `${matched.entry.status === 'needsConfirmation' ? 'Nguồn demo còn nội dung cần HR xác nhận. ' : ''}Khớp mục kiến thức ${matched.entry.id} trong ${matched.document.id}. Đây là tra cứu dữ liệu có cấu trúc, chưa gọi AI thật.`
      : `${fallback?.reason || 'Không tìm thấy dữ liệu phù hợp.'} Không sử dụng tài liệu ngoài quyền; cần HR xác nhận.`,
  });
}
