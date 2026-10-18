/*
 * resources.js — phòng ban, tài liệu, check-in.
 * OWNER: SV2. Hợp đồng OnboardAI_QuyTac_LocalStorage.md mục 4.5–4.8.
 *
 * - Phòng ban: chỉ Admin tạo/sửa/vô hiệu hóa; không xóa khi còn tham chiếu.
 * - Tài liệu: HR/Admin ghi; mentor/newHire đọc theo trạng thái và đối tượng.
 * - Check-in: mentor giao dịch; chặn trùng (newHireId + mentorId + scheduledAt)
 *   với lịch chưa cancelled; khi cập nhật loại trừ chính ID đang sửa.
 */
import { requireRoles } from './auth.js';
import {
  StoreError, create, createId, getAll, getById, update,
} from './store.js';

const DEPT_STATUSES = Object.freeze(['active', 'inactive']);
const DOC_STATUSES = Object.freeze(['draft', 'active', 'archived']);
const CHECKIN_STATUSES = Object.freeze(['scheduled', 'completed', 'cancelled']);
const ADMIN_ROLES = Object.freeze(['admin']);
const DOC_WRITE_ROLES = Object.freeze(['hr', 'admin']);
const MENTOR_ROLES = Object.freeze(['mentor', 'hr', 'admin']);

function now() {
  return new Date().toISOString();
}

function cleanText(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function requireFields(input, fields, entity) {
  for (const field of fields) {
    const value = input?.[field];
    if (typeof value !== 'string' || !value.trim()) {
      throw new StoreError('VALIDATION_ERROR', `${entity}: trường "${field}" là bắt buộc.`);
    }
  }
}

function assertDeptStatus(status) {
  if (!DEPT_STATUSES.includes(status)) {
    throw new StoreError('VALIDATION_ERROR', `Trạng thái phòng ban không hợp lệ: ${status}.`);
  }
}

function assertDocStatus(status) {
  if (!DOC_STATUSES.includes(status)) {
    throw new StoreError('VALIDATION_ERROR', `Trạng thái tài liệu không hợp lệ: ${status}.`);
  }
}

function assertCheckinStatus(status) {
  if (!CHECKIN_STATUSES.includes(status)) {
    throw new StoreError('VALIDATION_ERROR', `Trạng thái check-in không hợp lệ: ${status}.`);
  }
}

// ===== Phòng ban (Admin) =====

export async function listDepartments(query = {}) {
  const user = await requireRoles([]);
  let items = await getAll('departments');

  if (user.role !== 'admin') {
    items = items.filter((d) => d.status === 'active');
  } else if (query.status) {
    assertDeptStatus(query.status);
    items = items.filter((d) => d.status === query.status);
  }

  if (query.search && typeof query.search === 'string') {
    const q = query.search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (d) => (d.name || '').toLowerCase().includes(q)
          || (d.description || '').toLowerCase().includes(q),
      );
    }
  }

  return items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
}

export async function createDepartment(input = {}) {
  await requireRoles(ADMIN_ROLES);
  requireFields(input, ['name'], 'department');
  const status = input.status ?? 'active';
  assertDeptStatus(status);
  const timestamp = now();
  return create('departments', {
    id: createId('departments'),
    name: input.name.trim(),
    description: cleanText(input.description),
    managerId: cleanText(input.managerId),
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function updateDepartment(id, patch = {}) {
  await requireRoles(ADMIN_ROLES);
  const record = await getById('departments', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy phòng ban ${id}.`);

  const changes = {};
  if (Object.hasOwn(patch, 'name')) {
    requireFields(patch, ['name'], 'department');
    changes.name = patch.name.trim();
  }
  if (Object.hasOwn(patch, 'description')) changes.description = cleanText(patch.description);
  if (Object.hasOwn(patch, 'managerId')) changes.managerId = cleanText(patch.managerId);
  if (Object.hasOwn(patch, 'status')) {
    assertDeptStatus(patch.status);
    changes.status = patch.status;
  }
  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật phòng ban.');
  }
  return update('departments', id, { ...changes, updatedAt: now() });
}

/** Vô hiệu hóa phòng ban (giữ liên kết, không xóa vật lý). */
export async function archiveDepartment(id) {
  await requireRoles(ADMIN_ROLES);
  const record = await getById('departments', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy phòng ban ${id}.`);
  if (record.status === 'inactive') return record;
  return update('departments', id, { status: 'inactive', updatedAt: now() });
}

/** Số bản ghi đang tham chiếu phòng ban (users/newHires/journeys/documents). */
export async function getDepartmentReferences(departmentId) {
  if (typeof departmentId !== 'string' || !departmentId) {
    throw new StoreError('VALIDATION_ERROR', 'departmentId phải là chuỗi khác rỗng.');
  }
  const [users, newHires, journeys, documents] = await Promise.all([
    getAll('users'),
    getAll('newHires'),
    getAll('journeys'),
    getAll('documents'),
  ]);
  return {
    users: users.filter((u) => u.departmentId === departmentId).length,
    newHires: newHires.filter((h) => h.departmentId === departmentId).length,
    journeys: journeys.filter((j) => j.departmentId === departmentId).length,
    documents: documents.filter((d) => d.departmentId === departmentId).length,
  };
}

// ===== Tài liệu =====

export async function listDocuments(query = {}) {
  const user = await requireRoles([]);
  let items = await getAll('documents');

  if (DOC_WRITE_ROLES.includes(user.role)) {
    if (query.status) {
      assertDocStatus(query.status);
      items = items.filter((d) => d.status === query.status);
    }
  } else {
    items = items.filter((d) => d.status === 'active');
    items = items.filter((d) => {
      const target = d.targetRole || 'all';
      return target === 'all' || target === user.role;
    });
  }

  if (query.category && typeof query.category === 'string') {
    const cat = query.category.trim().toLowerCase();
    if (cat) items = items.filter((d) => (d.category || '').toLowerCase() === cat);
  }
  if (query.departmentId) {
    items = items.filter((d) => d.departmentId === query.departmentId);
  }
  if (query.search && typeof query.search === 'string') {
    const q = query.search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (d) => (d.title || '').toLowerCase().includes(q)
          || (d.description || '').toLowerCase().includes(q),
      );
    }
  }
  return items.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi'));
}

export async function getDocument(id) {
  const user = await requireRoles([]);
  const doc = await getById('documents', id);
  if (!doc) throw new StoreError('NOT_FOUND', `Không tìm thấy tài liệu ${id}.`);

  if (!DOC_WRITE_ROLES.includes(user.role)) {
    if (doc.status !== 'active') {
      throw new StoreError('FORBIDDEN', 'Tài liệu chưa được công bố hoặc đã lưu trữ.');
    }
    const target = doc.targetRole || 'all';
    if (target !== 'all' && target !== user.role) {
      throw new StoreError('FORBIDDEN', 'Bạn không thuộc đối tượng được xem tài liệu này.');
    }
  }
  return doc;
}

export async function createDocument(input = {}) {
  const user = await requireRoles(DOC_WRITE_ROLES);
  requireFields(input, ['title'], 'document');
  const status = input.status ?? 'draft';
  assertDocStatus(status);
  const timestamp = now();
  return create('documents', {
    id: createId('documents'),
    title: input.title.trim(),
    category: cleanText(input.category) ?? 'Chung',
    description: cleanText(input.description),
    fileUrl: cleanText(input.fileUrl),
    departmentId: cleanText(input.departmentId),
    targetRole: cleanText(input.targetRole) ?? 'all',
    status,
    createdBy: user.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function updateDocument(id, patch = {}) {
  await requireRoles(DOC_WRITE_ROLES);
  const record = await getById('documents', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy tài liệu ${id}.`);

  const changes = {};
  if (Object.hasOwn(patch, 'title')) {
    requireFields(patch, ['title'], 'document');
    changes.title = patch.title.trim();
  }
  if (Object.hasOwn(patch, 'category')) changes.category = cleanText(patch.category) ?? 'Chung';
  if (Object.hasOwn(patch, 'description')) changes.description = cleanText(patch.description);
  if (Object.hasOwn(patch, 'fileUrl')) changes.fileUrl = cleanText(patch.fileUrl);
  if (Object.hasOwn(patch, 'departmentId')) changes.departmentId = cleanText(patch.departmentId);
  if (Object.hasOwn(patch, 'targetRole')) changes.targetRole = cleanText(patch.targetRole) ?? 'all';
  if (Object.hasOwn(patch, 'status')) {
    assertDocStatus(patch.status);
    changes.status = patch.status;
  }
  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật tài liệu.');
  }
  return update('documents', id, { ...changes, updatedAt: now() });
}

export async function archiveDocument(id) {
  await requireRoles(DOC_WRITE_ROLES);
  const record = await getById('documents', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy tài liệu ${id}.`);
  if (record.status === 'archived') return record;
  return update('documents', id, { status: 'archived', updatedAt: now() });
}

// ===== Check-in =====

export async function listCheckins(query = {}) {
  const user = await requireRoles([]);
  let items = await getAll('checkins');

  if (user.role === 'mentor') {
    items = items.filter((c) => c.mentorId === user.id);
  } else if (user.role === 'newHire') {
    const hires = await getAll('newHires');
    const myHire = hires.find((h) => h.userId === user.id);
    if (!myHire) return [];
    items = items.filter((c) => c.newHireId === myHire.id);
  } else if (!DOC_WRITE_ROLES.includes(user.role)) {
    throw new StoreError('FORBIDDEN', `Vai trò "${user.role}" không được xem check-in.`);
  }

  if (query.newHireId) items = items.filter((c) => c.newHireId === query.newHireId);
  if (query.mentorId) items = items.filter((c) => c.mentorId === query.mentorId);
  if (query.status) {
    assertCheckinStatus(query.status);
    items = items.filter((c) => c.status === query.status);
  }

  return items.slice().sort((a, b) => {
    const ta = a.scheduledAt || a.createdAt || '';
    const tb = b.scheduledAt || b.createdAt || '';
    return tb.localeCompare(ta);
  });
}

export async function createCheckin(input = {}) {
  const user = await requireRoles(MENTOR_ROLES);
  requireFields(input, ['newHireId', 'scheduledAt'], 'checkin');

  const hire = await getById('newHires', input.newHireId);
  if (!hire) throw new StoreError('NOT_FOUND', `Không tìm thấy hồ sơ nhân sự ${input.newHireId}.`);

  let mentorId = user.id;
  if (user.role === 'mentor') {
    if (hire.mentorId !== user.id) {
      throw new StoreError('FORBIDDEN', 'Mentor chỉ tạo check-in cho mentee của mình.');
    }
  } else {
    mentorId = cleanText(input.mentorId) || hire.mentorId || user.id;
  }

  const scheduledAt = input.scheduledAt.trim();
  const status = input.status ?? 'scheduled';
  assertCheckinStatus(status);

  const existing = await getAll('checkins');
  const duplicate = existing.find(
    (c) => c.newHireId === hire.id
      && c.mentorId === mentorId
      && c.scheduledAt === scheduledAt
      && c.status !== 'cancelled',
  );
  if (duplicate) {
    throw new StoreError(
      'DUPLICATE_ID',
      `Đã có lịch check-in ${duplicate.id} cùng thời điểm ${scheduledAt} (trạng thái ${duplicate.status}). Hiển thị lịch cũ thay vì tạo trùng.`,
    );
  }

  const timestamp = now();
  return create('checkins', {
    id: createId('checkins'),
    newHireId: hire.id,
    mentorId,
    scheduledAt,
    status,
    note: cleanText(input.note),
    nextAction: cleanText(input.nextAction),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function updateCheckin(id, patch = {}) {
  const user = await requireRoles(MENTOR_ROLES);
  const record = await getById('checkins', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy check-in ${id}.`);

  if (user.role === 'mentor' && record.mentorId !== user.id) {
    throw new StoreError('FORBIDDEN', 'Mentor chỉ sửa check-in của chính mình.');
  }

  const changes = {};
  if (Object.hasOwn(patch, 'scheduledAt')) {
    requireFields(patch, ['scheduledAt'], 'checkin');
    changes.scheduledAt = patch.scheduledAt.trim();
  }
  if (Object.hasOwn(patch, 'note')) changes.note = cleanText(patch.note);
  if (Object.hasOwn(patch, 'nextAction')) changes.nextAction = cleanText(patch.nextAction);
  if (Object.hasOwn(patch, 'status')) {
    assertCheckinStatus(patch.status);
    changes.status = patch.status;
  }
  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật check-in.');
  }

  const nextScheduled = changes.scheduledAt ?? record.scheduledAt;
  const nextStatus = changes.status ?? record.status;
  if (nextStatus !== 'cancelled') {
    const existing = await getAll('checkins');
    const duplicate = existing.find(
      (c) => c.id !== id
        && c.newHireId === record.newHireId
        && c.mentorId === record.mentorId
        && c.scheduledAt === nextScheduled
        && c.status !== 'cancelled',
    );
    if (duplicate) {
      throw new StoreError(
        'DUPLICATE_ID',
        `Đã có lịch check-in ${duplicate.id} cùng thời điểm ${nextScheduled}.`,
      );
    }
  }

  return update('checkins', id, { ...changes, updatedAt: now() });
}
