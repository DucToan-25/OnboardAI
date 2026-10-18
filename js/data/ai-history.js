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
}
