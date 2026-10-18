<<<<<<< HEAD
/*
 * tasks.js — nhiệm vụ onboarding và tiến độ.
 * OWNER: SV2. Hợp đồng OnboardAI_QuyTac_LocalStorage.md mục 4.
 *
 * - Chỉ module này định nghĩa tạo/sửa/lưu trữ task và tính tiến độ.
 * - Mỗi hàm tự kiểm tra tài khoản hiện tại (role + quan hệ mentor/mentee).
 * - NewHire chỉ đổi trạng thái task của mình; mentor chỉ giao/sửa cho mentee;
 *   HR/Admin thao tác theo quyền quản trị.
 * - Tiến độ chung: completed / tổng task không archived; 0 khi không có task.
 */
import { requireRoles } from './auth.js';
import {
  StoreError, create, createId, getAll, getById, update,
} from './store.js';

const TASK_STATUSES = Object.freeze(['todo', 'inProgress', 'completed', 'blocked', 'archived']);
const NEW_HIRE_STATUSES = Object.freeze(['todo', 'inProgress', 'blocked', 'completed']);
const PRIORITIES = Object.freeze(['low', 'medium', 'high']);
const WRITE_ROLES = Object.freeze(['mentor', 'hr', 'admin']);
const ADMIN_ROLES = Object.freeze(['hr', 'admin']);

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

function assertStatus(status, allowed = TASK_STATUSES) {
  if (!allowed.includes(status)) {
    throw new StoreError('VALIDATION_ERROR', `Trạng thái task không hợp lệ: ${status}.`);
  }
}

function assertPriority(priority) {
  if (priority != null && !PRIORITIES.includes(priority)) {
    throw new StoreError('VALIDATION_ERROR', `Priority không hợp lệ: ${priority}.`);
  }
}

async function getHireRecord(hireId) {
  if (typeof hireId !== 'string' || !hireId) {
    throw new StoreError('VALIDATION_ERROR', 'newHireId phải là chuỗi khác rỗng.');
  }
  const hire = await getById('newHires', hireId);
  if (!hire) throw new StoreError('NOT_FOUND', `Không tìm thấy hồ sơ nhân sự ${hireId}.`);
  return hire;
}

function assertMentorOf(hire, user) {
  if (hire.mentorId !== user.id) {
    throw new StoreError('FORBIDDEN', `Mentor chỉ quản lý mentee của mình (hire ${hire.id}).`);
  }
}

function assertOwnTask(task, hire, user) {
  if (task.assignedTo !== user.id && hire.userId !== user.id) {
    throw new StoreError('FORBIDDEN', 'Nhân sự mới chỉ thao tác task được giao cho mình.');
  }
}

async function getTaskRecord(taskId) {
  if (typeof taskId !== 'string' || !taskId) {
    throw new StoreError('VALIDATION_ERROR', 'taskId phải là chuỗi khác rỗng.');
  }
  const task = await getById('tasks', taskId);
  if (!task) throw new StoreError('NOT_FOUND', `Không tìm thấy task ${taskId}.`);
  return task;
}

/** Task của một nhân sự mới (lọc theo quyền). */
export async function getTasksForHire(hireId) {
  const user = await requireRoles([]);
  const hire = await getHireRecord(hireId);

  if (user.role === 'newHire') {
    if (hire.userId !== user.id) {
      throw new StoreError('FORBIDDEN', 'Nhân sự mới chỉ xem checklist của chính mình.');
    }
  } else if (user.role === 'mentor') {
    assertMentorOf(hire, user);
  } else if (!ADMIN_ROLES.includes(user.role)) {
    throw new StoreError('FORBIDDEN', `Vai trò "${user.role}" không được xem task.`);
  }

  const tasks = await getAll('tasks');
  return tasks.filter((t) => t.newHireId === hireId);
}

/** Tạo task; mentor chỉ cho mentee; assignedTo + journeyId lấy từ hồ sơ. */
export async function createTask(input = {}) {
  const user = await requireRoles(WRITE_ROLES);
  requireFields(input, ['newHireId', 'title'], 'task');

  const hire = await getHireRecord(input.newHireId);
  if (user.role === 'mentor') assertMentorOf(hire, user);

  if (!hire.journeyId) {
    throw new StoreError(
      'VALIDATION_ERROR',
      `Hồ sơ ${hire.id} chưa được gán hành trình (journeyId). Hoàn thiện hồ sơ trước khi giao việc.`,
    );
  }

  const priority = input.priority ?? 'medium';
  assertPriority(priority);
  const status = input.status ?? 'todo';
  assertStatus(status);

  const timestamp = now();
  return create('tasks', {
    id: createId('tasks'),
    newHireId: hire.id,
    journeyId: hire.journeyId,
    title: input.title.trim(),
    description: cleanText(input.description),
    category: cleanText(input.category) ?? 'Chung',
    assignedTo: hire.userId,
    dueDate: cleanText(input.dueDate),
    status,
    priority,
    createdBy: user.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: status === 'completed' ? timestamp : null,
  });
}

/** Sửa metadata task (không đổi assignedTo/journeyId/newHireId). */
export async function updateTask(taskId, patch = {}) {
  const user = await requireRoles([]);
  const task = await getTaskRecord(taskId);
  const hire = await getHireRecord(task.newHireId);

  if (user.role === 'newHire') {
    throw new StoreError('FORBIDDEN', 'Nhân sự mới chỉ được đổi trạng thái task, dùng updateTaskStatus.');
  }
  if (user.role === 'mentor') {
    assertMentorOf(hire, user);
  } else if (!ADMIN_ROLES.includes(user.role)) {
    throw new StoreError('FORBIDDEN', `Vai trò "${user.role}" không được sửa task.`);
  }

  const forbidden = ['id', 'newHireId', 'assignedTo', 'journeyId', 'createdBy', 'createdAt'];
  for (const key of forbidden) {
    if (Object.hasOwn(patch, key) && patch[key] !== task[key]) {
      throw new StoreError('VALIDATION_ERROR', `Không được thay đổi trường "${key}" của task.`);
    }
  }

  const changes = {};
  if (Object.hasOwn(patch, 'title')) {
    requireFields(patch, ['title'], 'task');
    changes.title = patch.title.trim();
  }
  if (Object.hasOwn(patch, 'description')) changes.description = cleanText(patch.description);
  if (Object.hasOwn(patch, 'category')) changes.category = cleanText(patch.category) ?? 'Chung';
  if (Object.hasOwn(patch, 'dueDate')) changes.dueDate = cleanText(patch.dueDate);
  if (Object.hasOwn(patch, 'priority')) {
    assertPriority(patch.priority);
    changes.priority = patch.priority;
  }
  if (Object.hasOwn(patch, 'status')) {
    assertStatus(patch.status);
    changes.status = patch.status;
    if (patch.status === 'completed' && task.status !== 'completed') {
      changes.completedAt = now();
    } else if (patch.status !== 'completed') {
      changes.completedAt = null;
    }
  }

  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật task.');
  }
  return update('tasks', task.id, { ...changes, updatedAt: now() });
}

/** Đổi trạng thái; newHire không được archived; xử lý completedAt. */
export async function updateTaskStatus(taskId, status) {
  const user = await requireRoles([]);
  assertStatus(status);

  const task = await getTaskRecord(taskId);
  const hire = await getHireRecord(task.newHireId);

  if (user.role === 'newHire') {
    assertOwnTask(task, hire, user);
    if (!NEW_HIRE_STATUSES.includes(status)) {
      throw new StoreError('FORBIDDEN', 'Nhân sự mới không được lưu trữ (archived) task.');
    }
  } else if (user.role === 'mentor') {
    assertMentorOf(hire, user);
  } else if (!ADMIN_ROLES.includes(user.role)) {
    throw new StoreError('FORBIDDEN', `Vai trò "${user.role}" không được đổi trạng thái task.`);
  }

  const changes = { status, updatedAt: now() };
  if (status === 'completed' && task.status !== 'completed') {
    changes.completedAt = now();
  } else if (status !== 'completed') {
    changes.completedAt = null;
  }
  return update('tasks', task.id, changes);
}

/** Lưu trữ task (status = archived). */
export async function archiveTask(taskId) {
  return updateTaskStatus(taskId, 'archived');
}

/** Tiến độ: completed / tổng không archived; 0 khi không có task. */
export async function getProgress(hireId) {
  const tasks = await getTasksForHire(hireId);
  const active = tasks.filter((t) => t.status !== 'archived');
  const completed = active.filter((t) => t.status === 'completed').length;
  const total = active.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

/**
 * Áp dụng Checklist Personalizer → tạo task (idempotent).
 * ID ổn định: task-<historyId>-<index>; gọi lại không nhân đôi.
 */
export async function applyChecklist(historyId) {
  const user = await requireRoles(['hr', 'admin', 'mentor']);
  const history = await getById('aiHistory', historyId);
  if (!history) throw new StoreError('NOT_FOUND', `Không tìm thấy lịch sử AI ${historyId}.`);
  if (history.featureType !== 'checklistPersonalizer') {
    throw new StoreError('VALIDATION_ERROR', 'applyChecklist chỉ áp dụng cho featureType checklistPersonalizer.');
  }
  if (!history.newHireId) {
    throw new StoreError('VALIDATION_ERROR', 'Bản ghi AI thiếu newHireId, không tạo được task.');
  }

  const hire = await getHireRecord(history.newHireId);
  if (user.role === 'mentor') assertMentorOf(hire, user);

  if (!hire.journeyId) {
    throw new StoreError(
      'VALIDATION_ERROR',
      `Hồ sơ ${hire.id} chưa gán hành trình. Hoàn thiện hồ sơ trước khi áp dụng checklist.`,
    );
  }

  const items = Array.isArray(history.result?.items) ? history.result.items : [];
  if (!items.length) {
    throw new StoreError('VALIDATION_ERROR', 'Kết quả checklist không có item nào để tạo task.');
  }

  const existingTasks = await getAll('tasks');
  const existingIds = new Set(existingTasks.map((t) => t.id));
  const applied = Array.isArray(history.appliedTaskIds) ? [...history.appliedTaskIds] : [];
  const newlyCreated = [];
  const timestamp = now();

  for (let i = 0; i < items.length; i += 1) {
    const stableId = `task-${historyId}-${i}`;
    if (existingIds.has(stableId) || applied.includes(stableId)) {
      if (!applied.includes(stableId)) applied.push(stableId);
      continue;
    }
    const item = items[i] || {};
    const title = cleanText(item.title) || `Công việc ${i + 1}`;
    const priority = PRIORITIES.includes(item.priority) ? item.priority : 'medium';

    await create('tasks', {
      id: stableId,
      newHireId: hire.id,
      journeyId: hire.journeyId,
      title,
      description: cleanText(item.description),
      category: cleanText(item.category) ?? 'AI Checklist',
      assignedTo: hire.userId,
      dueDate: cleanText(item.dueDate),
      status: 'todo',
      priority,
      createdBy: user.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    });
    existingIds.add(stableId);
    applied.push(stableId);
    newlyCreated.push(stableId);
  }

  await update('aiHistory', historyId, {
    decision: 'accepted',
    appliedTaskIds: applied,
    updatedAt: now(),
  });

  return {
    historyId,
    createdTaskIds: newlyCreated,
    appliedTaskIds: applied,
    totalItems: items.length,
  };
=======
// SV2 service: the small read/status surface needed by SV1. Other CRUD stays with SV2.
import { getAll, getById, update } from './store.js';
import { requireRoles } from '../common/auth.js';
import { parseStoredDate } from '../common/format.js';

function authorizedHire(id) {
  const actor = requireRoles();
  const hire = getById('newHires', id);
  if (!hire || (actor.role === 'newHire' && hire.userId !== actor.id) || (actor.role === 'mentor' && hire.mentorId !== actor.id)) throw new Error('Không có quyền truy cập hồ sơ này.');
  return { actor, hire };
}
export function getTasksForHire(hireId) {
  const { hire } = authorizedHire(hireId);
  return getAll('tasks').filter(task => task.newHireId === hireId && task.assignedTo === hire.userId);
}
export function getProgress(hireId) {
  const tasks = getTasksForHire(hireId).filter(task => task.status !== 'archived');
  const completed = tasks.filter(task => task.status === 'completed').length;
  return { total: tasks.length, completed, percent: tasks.length ? Math.round(completed * 100 / tasks.length) : 0 };
}
export function updateTaskStatus(taskId, status) {
  const task = getById('tasks', taskId);
  if (!task) throw new Error('Không tìm thấy nhiệm vụ.');
  const { hire } = authorizedHire(task.newHireId);
  if (hire.status === 'archived' || task.status === 'archived') throw new Error('Hồ sơ hoặc nhiệm vụ đã lưu trữ.');
  if (task.assignedTo !== hire.userId || task.journeyId !== hire.journeyId) throw new Error('Liên kết nhiệm vụ chưa khớp hồ sơ. Cần người quản lý kiểm tra.');
  if (!['todo', 'inProgress', 'blocked', 'completed'].includes(status)) throw new Error('Trạng thái nhiệm vụ không hợp lệ.');
  const now = new Date();
  if (parseStoredDate(task.createdAt)?.getTime() > now.getTime()) throw new Error('Ngày tạo nhiệm vụ nằm trong tương lai. Cần kiểm tra dữ liệu.');
  return update('tasks', taskId, { status, updatedAt: now.toISOString(), completedAt: status === 'completed' ? now.toISOString() : null });
>>>>>>> 906d77f (Update localstorage sv1)
}
