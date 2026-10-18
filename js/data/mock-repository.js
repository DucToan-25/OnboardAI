import { can, getEditableFields } from '../common/permissions.js';
import { getTodayDate } from '../common/format.js';
import { isSafeUrl } from '../common/validation.js';
import { STATUS_META } from '../config/statuses.js';
import { loadOverrides, saveOverride } from './local-store.js';

let seedPromise;
// Ba loại dữ liệu SV3 được ghi bền vững trên trình duyệt qua local-store (xem docs/data-contract.md).
const PERSISTENT_ENTITIES = ['journeys', 'companyInfo', 'news'];
export function clearPreviewCache() { seedPromise = undefined; }
function failure(code, message, fieldErrors) {
  return Object.assign(new Error(message), { code, ...(fieldErrors ? { fieldErrors } : {}) });
}
async function readSeed() {
  if (!seedPromise) {
    seedPromise = fetch(new URL('../../assets/data/seed.json', import.meta.url))
      .then(async (response) => {
        if (!response.ok) throw failure('NETWORK_ERROR', 'Không tải được dữ liệu minh họa.');
        const seed = await response.json();
        if (seed.schemaVersion !== 1 || !Array.isArray(seed.users)) throw failure('VALIDATION_ERROR', 'Dữ liệu minh họa không đúng phiên bản schema.');
        return seed;
      }).catch((error) => { seedPromise = undefined; throw error; });
  }
  return seedPromise;
}
export async function getPreviewUser(id) {
  const seed = await readSeed();
  const user = seed.users.find((item) => item.id === id && item.status === 'active');
  if (!user) throw failure('FORBIDDEN', 'Tài khoản demo không tồn tại hoặc đã bị vô hiệu hóa.');
  return structuredClone(user);
}
export async function createMockRepository({ currentUser }) {
  const seed = await readSeed();
  const user = currentUser ? seed.users.find((item) => item.id === currentUser.id && item.status === 'active') : null;
  if (currentUser && !user) throw failure('FORBIDDEN', 'Tài khoản không còn hoạt động. Vui lòng chọn lại tài khoản demo.');
  const entities = ['users', 'newHires', 'departments', 'journeys', 'journeyAssignments', 'tasks', 'checkins', 'documents', 'settings', 'portalPosts', 'companyInfo', 'news'];
  function collection(entity) {
    if (!entities.includes(entity)) throw failure('VALIDATION_ERROR', 'Loại dữ liệu không được hỗ trợ.');
    const base = seed[entity] || [];
    if (!PERSISTENT_ENTITIES.includes(entity)) return base;
    // Gộp seed/kho ban đầu với bản ghi người dùng đã lưu trên trình duyệt; bản ghi chỉnh sửa thắng.
    const overrides = loadOverrides(entity);
    const merged = base.map((record) => overrides[record.id] || record);
    for (const [id, record] of Object.entries(overrides)) {
      if (!base.some((item) => item.id === id)) merged.push(record);
    }
    return merged;
  }
  function relationship(entity, record) {
    if (['tasks', 'checkins', 'journeyAssignments'].includes(entity)) return { ...record, newHire: seed.newHires.find((item) => item.id === record.newHireId) };
    if (entity === 'users') {
      const self = seed.newHires.find((item) => item.userId === user?.id);
      const mentee = seed.newHires.find((item) => item.userId === record.id);
      return { ...record, mentorForUserId: self?.mentorId === record.id ? user.id : undefined, assignedMentorId: mentee?.mentorId };
    }
    if (entity === 'journeys') {
      const own = seed.newHires.filter((item) => item.userId === user?.id || item.mentorId === user?.id).map((item) => item.id);
      const assigned = seed.journeyAssignments.some((item) => item.journeyId === record.id && own.includes(item.newHireId));
      return { ...record, assignedToUserId: assigned ? user.id : undefined };
    }
    return record;
  }
  function readable(entity, record) {
    if (entity === 'portalPosts') return can(user, 'portalPosts:read', record);
    if (entity === 'companyInfo' || entity === 'news') {
      // Đọc theo quyền chung; kho chỉ trả về khi người dùng đã đăng nhập phiên demo.
      return Boolean(user) && can(user, `${entity}:read`, record);
    }
    if (!user) return entity === 'users' && record.status === 'active';
    return can(user, `${entity}:read`, relationship(entity, record));
  }
  function output(entity, record) {
    const clone = structuredClone(record);
    if (entity === 'checkins' && user?.role === 'newhire') delete clone.note;
    return clone;
  }
  async function get(entity, id) {
    const record = collection(entity).find((item) => item.id === id);
    if (!record) throw failure('NOT_FOUND', 'Không tìm thấy bản ghi được yêu cầu.');
    if (!readable(entity, record)) throw failure('FORBIDDEN', 'Bạn không có quyền đọc nội dung này.');
    return output(entity, record);
  }
  async function list(entity, query = {}) {
    let records = collection(entity).filter((record) => readable(entity, record));
    for (const key of ['status', 'departmentId', 'newHireId']) {
      if (query[key]) records = records.filter((record) => record[key] === query[key]);
    }
    if (query.search) {
      const search = query.search.toLocaleLowerCase('vi').trim();
      records = records.filter((record) => [record.title, record.name, record.fullName, record.email, record.category].some((value) => String(value || '').toLocaleLowerCase('vi').includes(search)));
    }
    const total = records.length;
    if (query.pageSize !== undefined) {
      const page = Number(query.page ?? 1); const size = Number(query.pageSize);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) throw failure('VALIDATION_ERROR', 'Trang và kích thước trang phải là số nguyên dương.');
      records = records.slice((page - 1) * size, page * size);
    }
    return { items: records.map((record) => output(entity, record)), total };
  }
  async function getMyProfile() {
    if (!user) throw failure('FORBIDDEN', 'Vui lòng chọn tài khoản demo để xem hồ sơ.');
    const newHire = seed.newHires.find((item) => item.userId === user.id);
    return structuredClone({
      ...user,
      department: seed.departments.find((item) => item.id === user.departmentId) || null,
      newHireId: newHire?.id || null,
      startDate: newHire?.startDate || null,
      mentor: newHire ? seed.users.find((item) => item.id === newHire.mentorId) || null : null,
    });
  }
  async function getDepartmentReferences(departmentId) {
    const department = await get('departments', departmentId);
    if (!can(user, 'departments:update', department)) throw failure('FORBIDDEN', 'Bạn không có quyền xem tham chiếu phòng ban.');
    return {
      users: seed.users.filter((item) => item.departmentId === departmentId).length,
      journeys: collection('journeys').filter((item) => item.departmentId === departmentId).length,
      documents: seed.documents.filter((item) => item.departmentIds.includes(departmentId)).length,
    };
  }
  async function previewOnly() { throw failure('PREVIEW_ONLY', 'Bản giao diện chưa hỗ trợ ghi dữ liệu. Thay đổi chỉ được xem trước.'); }
  function requireUser() {
    if (!user) throw failure('FORBIDDEN', 'Vui lòng chọn tài khoản demo để thực hiện thao tác này.');
    return user;
  }
  function failValidation(fieldErrors) {
    throw failure('VALIDATION_ERROR', Object.values(fieldErrors)[0] || 'Dữ liệu không hợp lệ.', fieldErrors);
  }
  // Chuẩn hóa bản ghi theo schema của từng loại dữ liệu trước khi ghi.
  function normalizeRecord(entity, input, mode) {
    const now = getTodayDate();
    const activeUser = requireUser();
    if (entity === 'journeys') {
      const record = {
        id: input.id,
        name: String(input.name ?? '').trim(),
        description: String(input.description ?? '').trim(),
        targetRole: String(input.targetRole ?? '').trim(),
        departmentId: String(input.departmentId ?? '').trim(),
        durationDays: Number(input.durationDays),
        status: input.status || 'draft',
        steps: Array.isArray(input.steps) ? input.steps.map((step) => String(step).trim()).filter(Boolean) : [],
      };
      if (mode === 'create') Object.assign(record, { createdBy: activeUser.id, createdAt: now });
      else Object.assign(record, { createdBy: input.createdBy, createdAt: input.createdAt });
      record.updatedAt = now;
      return record;
    }
    if (entity === 'companyInfo') {
      return {
        id: 'company-main',
        companyName: String(input.companyName ?? '').trim(),
        tagline: String(input.tagline ?? '').trim(),
        mission: String(input.mission ?? '').trim(),
        vision: String(input.vision ?? '').trim(),
        coreValues: String(input.coreValues ?? '').trim(),
        about: String(input.about ?? '').trim(),
        logoUrl: String(input.logoUrl ?? '').trim(),
        updatedAt: now,
        updatedBy: activeUser.id,
      };
    }
    const status = input.status || 'draft';
    const record = {
      id: input.id,
      title: String(input.title ?? '').trim(),
      summary: String(input.summary ?? '').trim(),
      content: String(input.content ?? '').trim(),
      category: String(input.category ?? '').trim(),
      status,
      isFeatured: input.isFeatured === true,
      publishedAt: null,
      authorId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    if (mode === 'create') record.authorId = activeUser.id;
    else Object.assign(record, { authorId: input.authorId ?? null, createdAt: input.createdAt ?? now });
    // Quy tắc dự án: publishedAt chỉ được đặt khi bản tin ở trạng thái xuất bản.
    if (status === 'published') record.publishedAt = input.publishedAt || now;
    if (status === 'archived') {
      record.publishedAt = input.publishedAt || null;
      record.archivedAt = input.archivedAt || now;
    }
    return record;
  }
  function validateRecord(entity, record) {
    const errors = {};
    if (entity === 'journeys') {
      if (!record.name) errors.name = 'Nhập tên hành trình.';
      if (!seed.departments.some((item) => item.id === record.departmentId)) errors.departmentId = 'Chọn phòng ban có trong danh sách.';
      if (!Number.isInteger(record.durationDays) || record.durationDays < 1 || record.durationDays > 365) errors.durationDays = 'Số ngày phải là số nguyên từ 1 đến 365.';
      if (!STATUS_META.journeys[record.status]) errors.status = 'Chọn trạng thái hợp lệ.';
    } else if (entity === 'companyInfo') {
      if (!record.companyName) errors.companyName = 'Nhập tên công ty.';
      if (record.logoUrl && !isSafeUrl(record.logoUrl, { allowRelative: true })) errors.logoUrl = 'Logo phải là tệp trong assets/ hoặc liên kết https hợp lệ.';
    } else {
      if (!record.title) errors.title = 'Nhập tiêu đề bản tin.';
      if (!record.content) errors.content = 'Nhập nội dung bản tin.';
      if (!record.category) errors.category = 'Chọn danh mục bản tin.';
      if (!STATUS_META.news[record.status]) errors.status = 'Chọn trạng thái hợp lệ.';
    }
    if (Object.keys(errors).length) failValidation(errors);
  }
  async function create(entity, payload) {
    if (!PERSISTENT_ENTITIES.includes(entity)) return previewOnly();
    const activeUser = requireUser();
    if (entity === 'companyInfo') {
      if (!can(activeUser, 'companyInfo:update', {})) throw failure('FORBIDDEN', 'Bạn không có quyền cập nhật thông tin công ty.');
      if (collection(entity).some((item) => item.id === 'company-main')) {
        throw failure('VALIDATION_ERROR', 'Đã tồn tại bản ghi thông tin công ty company-main. Hãy chỉnh sửa bản ghi đó thay vì tạo mới.');
      }
    } else if (!can(activeUser, `${entity}:create`, payload)) {
      throw failure('FORBIDDEN', 'Bạn không có quyền tạo bản ghi này.');
    }
    const records = collection(entity);
    let id = entity === 'companyInfo' ? 'company-main' : String(payload.id || '').trim();
    if (!id) {
      const prefix = entity === 'journeys' ? 'journey' : 'news';
      do { id = `${prefix}-${Date.now().toString(36)}`; } while (records.some((item) => item.id === id));
    }
    if (records.some((item) => item.id === id)) throw failure('VALIDATION_ERROR', `ID “${id}” đã tồn tại. Hãy dùng ID khác.`);
    const record = normalizeRecord(entity, { ...payload, id }, 'create');
    validateRecord(entity, record);
    saveOverride(entity, record);
    return structuredClone(record);
  }
  async function update(entity, id, patch) {
    if (!PERSISTENT_ENTITIES.includes(entity)) return previewOnly();
    const activeUser = requireUser();
    const existing = collection(entity).find((item) => item.id === id);
    if (!existing) throw failure('NOT_FOUND', 'Không tìm thấy bản ghi cần cập nhật.');
    const action = entity === 'companyInfo' ? 'companyInfo:update' : `${entity}:update`;
    if (!can(activeUser, action, existing)) throw failure('FORBIDDEN', 'Bạn không có quyền cập nhật bản ghi này.');
    const editable = getEditableFields(activeUser, entity, existing);
    const merged = { ...existing };
    for (const [key, value] of Object.entries(patch)) {
      if (editable.includes(key)) merged[key] = value;
    }
    const record = normalizeRecord(entity, merged, 'update');
    validateRecord(entity, record);
    saveOverride(entity, record);
    return structuredClone(record);
  }
  async function archive(entity, id) {
    if (!PERSISTENT_ENTITIES.includes(entity) || entity === 'companyInfo') return previewOnly();
    const activeUser = requireUser();
    const existing = collection(entity).find((item) => item.id === id);
    if (!existing) throw failure('NOT_FOUND', 'Không tìm thấy bản ghi cần lưu trữ.');
    if (!can(activeUser, `${entity}:archive`, existing)) throw failure('FORBIDDEN', 'Bạn không có quyền lưu trữ bản ghi này.');
    const record = normalizeRecord(entity, { ...existing, status: 'archived' }, 'update');
    validateRecord(entity, record);
    saveOverride(entity, record);
    return structuredClone(record);
  }
  return Object.freeze({
    // journeys/companyInfo/news ghi được trên trình duyệt; các loại khác vẫn chỉ xem trước.
    capabilities: Object.freeze({ write: true }), list, get, getMyProfile, getDepartmentReferences,
    create, update, archive, updateMyProfile: previewOnly,
  });
}
