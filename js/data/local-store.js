// Adapter LocalStorage duy nhất cho dữ liệu nghiệp vụ của SV3.
// Quy ước AGENTS.md 8.3: một adapter quản lý namespace `onboardai:*`,
// tách bạch với phiên mô phỏng `onboardai:preview-user-id` (sessionStorage).
// Chỉ tầng dữ liệu được import file này; js/pages/* không được truy cập LocalStorage.
const KEY_BY_ENTITY = Object.freeze({
  journeys: 'onboardai:journeys',
  companyInfo: 'onboardai:company-info',
  news: 'onboardai:news',
});
const SCHEMA_VERSION = 1;
// Bộ nhớ thay thế khi LocalStorage không có (chạy Node trong script kiểm tra).
const memory = new Map();

function storageKey(entity) {
  const key = KEY_BY_ENTITY[entity];
  if (!key) throw Object.assign(new Error(`Loại dữ liệu không hỗ trợ lưu trên trình duyệt: ${entity}`), { code: 'VALIDATION_ERROR' });
  return key;
}

function readRaw(key) {
  try {
    if (typeof localStorage === 'undefined') return memory.get(key) || null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    if (typeof localStorage === 'undefined') { memory.set(key, value); return; }
    localStorage.setItem(key, value);
  } catch {
    throw Object.assign(new Error('Trình duyệt không cho phép lưu dữ liệu (chế độ riêng tư hoặc đầy bộ nhớ). Vui lòng thử trình duyệt khác.'), { code: 'STORAGE_ERROR' });
  }
}

// Trả về các bản ghi đã chỉnh sửa trên trình duyệt: { [id]: record }.
export function loadOverrides(entity) {
  const raw = readRaw(storageKey(entity));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== SCHEMA_VERSION || typeof parsed.records !== 'object' || parsed.records === null) return {};
    return parsed.records;
  } catch {
    return {};
  }
}

// Ghi đè một bản ghi theo ID; không xóa bản ghi khác trong cùng loại dữ liệu.
export function saveOverride(entity, record) {
  const key = storageKey(entity);
  const records = loadOverrides(entity);
  records[record.id] = record;
  writeRaw(key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records }));
}
