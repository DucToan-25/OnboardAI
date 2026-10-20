/*
 * organization.js — hành trình (journeys), thông tin công ty (companyInfo), tin tức (news).
 * OWNER: SV3. Hợp đồng OnboardAI_QuyTac_LocalStorage.md mục 5.
 *
 * - Chỉ HR/Admin được sửa nội dung công ty, tin và hành trình; kiểm tra quyền trên mỗi lần ghi.
 * - getCompanyInfo() trả bản ghi company-001; getPublishedNews() chỉ trả tin published,
 *   sắp xếp theo ngày đã chuẩn hóa (parseSeedDate). SV1 dùng lại trên trang công khai.
 * - Vòng đời tin: draft → publish (đặt publishedAt) → archive (đặt archivedAt)
 *   → khôi phục về draft (xóa archivedAt). Chỉ công khai sau publish rõ ràng.
 * - Journey chỉ có active/inactive; không có hàm xóa, tham chiếu thì vô hiệu hóa.
 */
import { requireRoles } from './auth.js';
import { STATUS_META } from '../config/statuses.js';
import {
  StoreError, create, createId, getAll, getById, parseSeedDate, update,
} from './store.js';

const WRITE_ROLES = ['hr', 'admin'];
const COMPANY_ID = 'company-001';
const NEWS_STATUSES = ['draft', 'published', 'archived'];
const JOURNEY_STATUSES = ['active', 'inactive'];

export const NEWS_STATUS_LABELS = STATUS_META.news;
export const JOURNEY_STATUS_LABELS = STATUS_META.journeys;

function now() {
  return new Date().toISOString();
}

function requireFields(input, fields, entity) {
  for (const field of fields) {
    const value = input?.[field];
    if (typeof value !== 'string' || !value.trim()) {
      throw new StoreError('VALIDATION_ERROR', `${entity}: trường "${field}" là bắt buộc.`);
    }
  }
}

function cleanText(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') throw new StoreError('VALIDATION_ERROR', 'Nội dung phải là văn bản.');
  const trimmed = value.trim();
  return trimmed || fallback;
}
function assertDepartment(id, previousId) {
  if (id === null) return;
  const department = getById('departments', id);
  if (!department || (id !== previousId && department.status !== 'active')) throw new StoreError('VALIDATION_ERROR', 'Phòng ban không tồn tại hoặc chưa hoạt động.');
}
function assertFields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) throw new StoreError('VALIDATION_ERROR', 'Có trường không được phép thay đổi.');
}

function getNewsRecord(id) {
  const record = getById('news', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy tin tức ${id}.`);
  return record;
}

function getJourneyRecord(id) {
  const record = getById('journeys', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy hành trình ${id}.`);
  return record;
}

function assertNewsStatus(status) {
  if (!NEWS_STATUSES.includes(status)) {
    throw new StoreError('VALIDATION_ERROR', `Trạng thái tin không hợp lệ: ${status}.`);
  }
}

/** durationDays phải là số nguyên dương (mục 5.2). */
export function validateDurationDays(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') throw new StoreError('VALIDATION_ERROR', 'durationDays phải là số nguyên dương.');
  const duration = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new StoreError('VALIDATION_ERROR', 'durationDays phải là số nguyên dương.');
  }
  return duration;
}

// ===== Thông tin công ty =====

/** Bản ghi công ty dùng chung (company-001); báo lỗi rõ ràng khi thiếu. */
export function getCompanyInfo() {
  const company = getById('companyInfo', COMPANY_ID);
  if (!company) throw new StoreError('NOT_FOUND', 'Thiếu cấu hình công ty company-001.');
  return company;
}

/** Sửa thông tin công ty. Chỉ HR/Admin. companyInfo không có trạng thái archive. */
export function updateCompanyInfo(patch, id = COMPANY_ID) {
  const actor = requireRoles(WRITE_ROLES);
  const record = getById('companyInfo', id);
  if (!record) throw new StoreError('NOT_FOUND', `Không tìm thấy thông tin công ty ${id}.`);
  const allowed = ['companyName', 'tagline', 'mission', 'vision', 'coreValues', 'about', 'logoUrl'];
  assertFields(patch, allowed);
  const changes = {};
  for (const field of allowed) {
    if (patch && Object.hasOwn(patch, field)) changes[field] = cleanText(patch[field]);
  }
  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật thông tin công ty.');
  }
  if (Object.hasOwn(changes, 'companyName') && !changes.companyName) {
    throw new StoreError('VALIDATION_ERROR', 'companyInfo: trường "companyName" là bắt buộc.');
  }
  return update('companyInfo', id, { ...changes, updatedAt: now(), updatedBy: actor.id });
}

// ===== Tin tức =====

/** Tin đã xuất bản cho trang công khai/nhân viên; sắp xếp theo publishedAt giảm dần, thiếu ngày xếp sau cùng. */
export function getPublishedNews() {
  const news = getAll('news');
  return news
    .filter((item) => item.status === 'published')
    .map((item) => ({ ...item, publishedAtMs: parseSeedDate(item.publishedAt) }))
    .sort((a, b) => (b.publishedAtMs ?? 0) - (a.publishedAtMs ?? 0))
    .map(({ publishedAtMs, ...item }) => item);
}

/** Toàn bộ tin để HR/Admin quản lý, mới nhất trước. */
export function listNews() {
  requireRoles(WRITE_ROLES);
  const news = getAll('news');
  return news
    .map((item) => ({ ...item, updatedAtMs: parseSeedDate(item.updatedAt) ?? 0 }))
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .map(({ updatedAtMs, ...item }) => item);
}

/** Tạo tin nháp. Chỉ HR/Admin; mặc định status = draft, chưa công khai. */
export function createNews(input) {
  const user = requireRoles(WRITE_ROLES);
  assertFields(input, ['title', 'summary', 'content', 'category', 'isFeatured', 'status']);
  requireFields(input, ['title', 'content'], 'news');
  if (Object.hasOwn(input, 'isFeatured') && typeof input.isFeatured !== 'boolean') throw new StoreError('VALIDATION_ERROR', 'isFeatured phải là giá trị boolean.');
  const status = input.status ?? 'draft';
  assertNewsStatus(status);
  if (status !== 'draft') {
    throw new StoreError('VALIDATION_ERROR', 'Tin mới phải ở trạng thái draft; dùng publishNews để xuất bản.');
  }
  const timestamp = now();
  return create('news', {
    id: createId('news'),
    title: input.title.trim(),
    summary: cleanText(input.summary),
    content: input.content.trim(),
    category: cleanText(input.category) ?? 'Thông báo',
    status: 'draft',
    isFeatured: input.isFeatured === true,
    publishedAt: null,
    authorId: user.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  });
}

/** Sửa trường nội dung của tin (title, summary, content, category, isFeatured). Không đổi trạng thái ở đây. */
export function updateNews(id, patch) {
  requireRoles(WRITE_ROLES);
  assertFields(patch, ['title', 'summary', 'content', 'category', 'isFeatured']);
  if (Object.hasOwn(patch, 'isFeatured') && typeof patch.isFeatured !== 'boolean') throw new StoreError('VALIDATION_ERROR', 'isFeatured phải là giá trị boolean.');
  const record = getNewsRecord(id);
  const changes = {};
  if (patch && Object.hasOwn(patch, 'title')) { requireFields(patch, ['title'], 'news'); changes.title = patch.title.trim(); }
  if (patch && Object.hasOwn(patch, 'summary')) changes.summary = cleanText(patch.summary);
  if (patch && Object.hasOwn(patch, 'content')) { requireFields(patch, ['content'], 'news'); changes.content = patch.content.trim(); }
  if (patch && Object.hasOwn(patch, 'category')) changes.category = cleanText(patch.category) ?? 'Thông báo';
  if (patch && Object.hasOwn(patch, 'isFeatured')) changes.isFeatured = patch.isFeatured === true;
  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật tin tức.');
  }
  return update('news', record.id, { ...changes, updatedAt: now() });
}

/** Xuất bản tin: draft → published, đặt publishedAt. Tin đã archived phải khôi phục trước. */
export function publishNews(id) {
  requireRoles(WRITE_ROLES);
  const record = getNewsRecord(id);
  if (record.status === 'published') return record;
  if (record.status === 'archived') {
    throw new StoreError('VALIDATION_ERROR', 'Tin đã lưu trữ. Hãy khôi phục về draft trước khi xuất bản.');
  }
  return update('news', record.id, {
    status: 'published', publishedAt: now(), archivedAt: null, updatedAt: now(),
  });
}

/** Lưu trữ tin: draft hoặc published → archived, đặt archivedAt, bỏ khỏi trang công khai. */
export function archiveNews(id) {
  requireRoles(WRITE_ROLES);
  const record = getNewsRecord(id);
  if (record.status === 'archived') return record;
  return update('news', record.id, {
    status: 'archived', archivedAt: now(), updatedAt: now(),
  });
}

/** Khôi phục tin đã lưu trữ về draft: xóa archivedAt, giữ publishedAt làm lịch sử. */
export function restoreNews(id) {
  requireRoles(WRITE_ROLES);
  const record = getNewsRecord(id);
  if (record.status === 'draft') return record;
  if (record.status !== 'archived') throw new StoreError('VALIDATION_ERROR', 'Chỉ khôi phục tin đã lưu trữ về bản nháp.');
  return update('news', record.id, {
    status: 'draft', archivedAt: null, updatedAt: now(),
  });
}


// ===== Hành trình (journeys) =====

/** Danh sách hành trình cho HR/Admin; filter theo status/title. */
export function listJourneys({ status, title } = {}) {
  requireRoles(WRITE_ROLES);
  let journeys = getAll('journeys');
  if (status) {
    if (!JOURNEY_STATUSES.includes(status)) {
      throw new StoreError('VALIDATION_ERROR', `Trạng thái hành trình không hợp lệ: ${status}.`);
    }
    journeys = journeys.filter((item) => item.status === status);
  }
  if (title) {
    const needle = title.trim().toLocaleLowerCase('vi');
    journeys = journeys.filter((item) => (item.title ?? '').toLocaleLowerCase('vi').includes(needle));
  }
  return journeys;
}

export function getJourney(id) {
  requireRoles(WRITE_ROLES);
  return getJourneyRecord(id);
}

/** Số nhân sự/task đang tham chiếu một hành trình. Dùng trước khi vô hiệu hóa. */
export function getJourneyReferences(journeyId) {
  requireRoles(WRITE_ROLES);
  const [hires, tasks] = [getAll('newHires'), getAll('tasks')];
  return {
    newHires: hires.filter((item) => item.journeyId === journeyId).length,
    tasks: tasks.filter((item) => item.journeyId === journeyId).length,
  };
}

/**
 * Cho phép gán nhân sự/task vào hành trình không? Gọi từ module gán việc
 * (people/tasks) trước khi ghi. inactive → FORBIDDEN.
 */
export function assertJourneyAssignable(journeyId) {
  const journey = getJourneyRecord(journeyId);
  if (journey.status !== 'active') {
    throw new StoreError('FORBIDDEN', `Hành trình "${journey.title}" đang ngừng áp dụng, không nhận gán mới.`);
  }
  return journey;
}

/** Tạo mẫu hành trình. Chỉ HR/Admin; durationDays là số nguyên dương. */
export function createJourney(input) {
  const user = requireRoles(WRITE_ROLES);
  assertFields(input, ['title', 'description', 'targetRole', 'departmentId', 'durationDays', 'status']);
  assertDepartment(input.departmentId ?? null);
  requireFields(input, ['title'], 'journeys');
  const durationDays = validateDurationDays(input?.durationDays);
  const status = input.status ?? 'active';
  if (!JOURNEY_STATUSES.includes(status)) {
    throw new StoreError('VALIDATION_ERROR', `Trạng thái hành trình không hợp lệ: ${status}.`);
  }
  const timestamp = now();
  return create('journeys', {
    id: createId('journeys'),
    title: input.title.trim(),
    description: cleanText(input.description),
    targetRole: cleanText(input.targetRole) ?? 'all',
    departmentId: cleanText(input.departmentId),
    durationDays,
    status,
    createdBy: user.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/** Sửa trường của hành trình; durationDays (nếu có) phải là số nguyên dương. Không đổi trạng thái ở đây. */
export function updateJourney(id, patch) {
  requireRoles(WRITE_ROLES);
  const record = getJourneyRecord(id);
  assertFields(patch, ['title', 'description', 'targetRole', 'departmentId', 'durationDays']);
  if (Object.hasOwn(patch, 'departmentId')) assertDepartment(patch.departmentId, record.departmentId);
  const changes = {};
  if (patch && Object.hasOwn(patch, 'title')) { requireFields(patch, ['title'], 'journeys'); changes.title = patch.title.trim(); }
  if (patch && Object.hasOwn(patch, 'description')) changes.description = cleanText(patch.description);
  if (patch && Object.hasOwn(patch, 'targetRole')) changes.targetRole = cleanText(patch.targetRole) ?? 'all';
  if (patch && Object.hasOwn(patch, 'departmentId')) changes.departmentId = cleanText(patch.departmentId);
  if (patch && Object.hasOwn(patch, 'durationDays')) changes.durationDays = validateDurationDays(patch.durationDays);
  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật hành trình.');
  }
  return update('journeys', record.id, { ...changes, updatedAt: now() });
}

/**
 * Bật/tắt hành trình (active ↔ inactive). Chỉ HR/Admin.
 * Journey có nhân sự/task tham chiếu thì dùng cách này thay vì xóa để không mất liên kết.
 */
export function setJourneyStatus(id, status) {
  requireRoles(WRITE_ROLES);
  const record = getJourneyRecord(id);
  if (!JOURNEY_STATUSES.includes(status)) {
    throw new StoreError('VALIDATION_ERROR', `Trạng thái hành trình không hợp lệ: ${status}.`);
  }
  if (record.status === status) return record;
  return update('journeys', record.id, { status, updatedAt: now() });
}
