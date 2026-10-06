import { can } from '../common/permissions.js';

let seedPromise;
export function clearPreviewCache() { seedPromise = undefined; }
function failure(code, message) { return Object.assign(new Error(message), { code }); }
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
  const entities = ['users', 'newHires', 'departments', 'journeys', 'journeyAssignments', 'tasks', 'checkins', 'documents', 'settings'];
  function collection(entity) {
    if (!entities.includes(entity)) throw failure('VALIDATION_ERROR', 'Loại dữ liệu không được hỗ trợ.');
    return seed[entity] || [];
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
  async function previewOnly() { throw failure('PREVIEW_ONLY', 'Bản giao diện chưa hỗ trợ ghi dữ liệu. Thay đổi chỉ được xem trước.'); }
  return Object.freeze({
    capabilities: Object.freeze({ write: false }), list, get, getMyProfile,
    create: previewOnly, update: previewOnly, archive: previewOnly, updateMyProfile: previewOnly,
  });
}
