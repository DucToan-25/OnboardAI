/*
 * store.js — bộ lưu trữ LocalStorage dùng chung (hợp đồng OnboardAI_QuyTac_LocalStorage.md mục 2).
 * OWNER: SV1. File này là bản nền do SV3 dựng đúng chữ ký hợp đồng để organization.js,
 * HR/Admin và Progress Risk chạy được trên cùng origin; SV1 review và tiếp tục phát triển.
 *
 * - Chỉ module này gọi localStorage.getItem/setItem/removeItem và JSON.parse/stringify.
 * - Module nghiệp vụ kiểm tra quyền/quan hệ rồi mới gọi các hàm ở đây.
 * - JS màn hình không gọi trực tiếp các hàm create/update.
 */

const COLLECTIONS = Object.freeze({
  users: { key: 'onboardai_users', seed: 'users.json' },
  newHires: { key: 'onboardai_newHires', seed: 'newHires.json' },
  tasks: { key: 'onboardai_tasks', seed: 'tasks.json' },
  departments: { key: 'onboardai_departments', seed: 'departments.json' },
  documents: { key: 'onboardai_documents', seed: 'documents.json' },
  checkins: { key: 'onboardai_checkins', seed: 'checkins.json' },
  journeys: { key: 'onboardai_journeys', seed: 'journeys.json' },
  companyInfo: { key: 'onboardai_companyInfo', seed: 'companyInfo.json' },
  news: { key: 'onboardai_news', seed: 'news.json' },
  aiMockData: { key: 'onboardai_aiMockData', seed: 'aiMockData.json' },
  aiHistory: { key: 'onboardai_aiHistory', seed: null }, // khởi tạo = []
  // SV3 đề xuất cấu trúc settings (mục 2.2): một bản ghi system, không mật khẩu/API key.
  settings: {
    key: 'onboardai_settings',
    seed: null,
    initial: [{
      id: 'system',
      organizationName: 'Onvera',
      supportEmail: 'hr@example.com',
      supportPhone: null,
      onboardingDays: 30,
      reminderDays: 2,
    }],
  },
});

const CURRENT_USER_KEY = 'onboardai_currentUser';
const SCHEMA_KEY = 'onboardai_schemaVersion';
const SUPPORTED_SCHEMA_VERSION = 1;
const ID_PREFIXES = Object.freeze({
  users: 'user', newHires: 'hire', tasks: 'task', departments: 'dept', documents: 'doc',
  checkins: 'checkin', journeys: 'journeys', companyInfo: 'company', news: 'news', aiHistory: 'ai-history',
});

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

function storage() {
  try {
    if (typeof localStorage === 'undefined') throw new Error('no localStorage');
    return localStorage;
  } catch {
    throw new StoreError('STORAGE_ERROR', 'Trình duyệt không sẵn sàng cho LocalStorage. Hãy chạy trên máy chủ tĩnh qua http://localhost.');
  }
}

function collectionOf(collection) {
  const config = COLLECTIONS[collection];
  if (!config) throw new StoreError('UNKNOWN_COLLECTION', `Collection "${collection}" chưa được đăng ký trong store.`);
  return config;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** Đọc ngày theo quy tắc chung: YYYY-MM-DD và YYYY-MM-DD HH:mm hiểu theo giờ Việt Nam; chuỗi ISO có offset theo offset của nó. */
export function parseSeedDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    const [, year, month, day] = match.map(Number);
    return Date.UTC(year, month - 1, day) - VIETNAM_OFFSET_MS;
  }
  match = /^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2})$/.exec(text);
  if (match) {
    const [, year, month, day, hour, minute] = match.map(Number);
    return Date.UTC(year, month - 1, day, hour, minute) - VIETNAM_OFFSET_MS;
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function assertSeedArray(name, data) {
  if (!Array.isArray(data)) {
    throw new StoreError('INVALID_SEED', `Seed ${name}.json phải là mảng object.`);
  }
  const seen = new Set();
  for (const item of data) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) {
      throw new StoreError('INVALID_SEED', `Seed ${name}.json có bản ghi thiếu id.`);
    }
    if (seen.has(item.id)) {
      throw new StoreError('INVALID_SEED', `Seed ${name}.json có id trùng: ${item.id}.`);
    }
    seen.add(item.id);
  }
}

// ===== Khởi tạo =====
let initPromise = null;
let schemaReady = false;

function ensureSchemaVersion() {
  if (schemaReady) return;
  const store = storage();
  const raw = store.getItem(SCHEMA_KEY);
  if (raw === null) {
    store.setItem(SCHEMA_KEY, String(SUPPORTED_SCHEMA_VERSION));
  } else {
    const version = Number(raw);
    if (!Number.isFinite(version)) {
      throw new StoreError('UNSUPPORTED_SCHEMA', 'Phiên bản dữ liệu (onboardai_schemaVersion) không hợp lệ. Cần đặt lại dữ liệu demo.');
    }
    if (version > SUPPORTED_SCHEMA_VERSION) {
      throw new StoreError('UNSUPPORTED_SCHEMA', `Dữ liệu đang ở phiên bản ${version}, mã nguồn chỉ hỗ trợ ${SUPPORTED_SCHEMA_VERSION}. Hãy nâng cấp mã hoặc đặt lại dữ liệu demo.`);
    }
  }
  schemaReady = true;
}

async function readSeed(name, file) {
  const url = new URL(`../../assets/data/${file}`, import.meta.url);
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new StoreError('NETWORK_ERROR', `Không tải được tệp seed ${file}. Kiểm tra máy chủ tĩnh và thử lại.`);
  }
  if (!response.ok) {
    throw new StoreError('NETWORK_ERROR', `Không tải được tệp seed ${file} (HTTP ${response.status}).`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new StoreError('INVALID_SEED', `Tệp seed ${file} không phải JSON hợp lệ.`);
  }
  assertSeedArray(name, data);
  return data;
}

/** Khởi tạo collection còn thiếu; mảng [] đã lưu là dữ liệu hợp lệ, không nạp lại seed. */
export function initStore() {
  if (!initPromise) {
    initPromise = (async () => {
      ensureSchemaVersion();
      for (const [name, config] of Object.entries(COLLECTIONS)) {
        const store = storage();
        if (store.getItem(config.key) !== null) continue;
        const data = config.seed ? await readSeed(name, config.seed) : (config.initial ?? []);
        store.setItem(config.key, JSON.stringify(data));
      }
    })().catch((error) => {
      initPromise = null; // cho phép thử lại sau khi lỗi hiển thị cho người dùng
      throw error;
    });
  }
  return initPromise;
}

// ===== Đọc =====
export async function getAll(collection) {
  await initStore();
  const { key } = collectionOf(collection);
  const raw = storage().getItem(key);
  if (raw === null) {
    throw new StoreError('STORAGE_ERROR', `Chưa có dữ liệu cho ${collection}. Khởi tạo cửa hàng trước khi đọc.`);
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('not array');
    return clone(data);
  } catch {
    throw new StoreError('STORAGE_ERROR', `Dữ liệu ${collection} đang hỏng, không đọc được. Không thay dữ liệu cũ bằng [].`);
  }
}

export async function getById(collection, id) {
  const items = await getAll(collection);
  return items.find((item) => item.id === id) ?? null;
}

// ===== Ghi =====
export function createId(collection) {
  const prefix = ID_PREFIXES[collection];
  if (!prefix) throw new StoreError('UNKNOWN_COLLECTION', `Collection "${collection}" không có prefix ID.`);
  return `${prefix}-${crypto.randomUUID()}`;
}

function notify(collection, action, record) {
  for (const callback of listeners.get(collection) ?? []) {
    try { callback({ collection, action, record: clone(record) }); } catch (error) { console.error(error); }
  }
}

export async function create(collection, item) {
  await initStore();
  const { key } = collectionOf(collection);
  if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) {
    throw new StoreError('VALIDATION_ERROR', `Bản ghi ${collection} phải là object có id chuỗi khác rỗng.`);
  }
  const items = await getAll(collection);
  if (items.some((existing) => existing.id === item.id)) {
    throw new StoreError('DUPLICATE_ID', `${collection} đã có bản ghi với id ${item.id}.`);
  }
  const stored = clone(item);
  items.push(stored);
  storage().setItem(key, JSON.stringify(items));
  notify(collection, 'create', stored);
  return clone(stored);
}

export async function update(collection, id, patch) {
  await initStore();
  const { key } = collectionOf(collection);
  if (!patch || typeof patch !== 'object') {
    throw new StoreError('VALIDATION_ERROR', `Patch cập nhật ${collection} phải là object.`);
  }
  const items = await getAll(collection);
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new StoreError('NOT_FOUND', `Không tìm thấy ${collection} với id ${id}.`);
  }
  const merged = { ...items[index], ...clone(patch), id: items[index].id };
  items[index] = merged;
  storage().setItem(key, JSON.stringify(items));
  notify(collection, 'update', merged);
  return clone(merged);
}

// ===== Tài khoản hiện tại =====
export function getCurrentUserId() {
  const raw = storage().getItem(CURRENT_USER_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.userId === 'string' ? parsed.userId : null;
  } catch {
    return null;
  }
}

export function setCurrentUserId(id) {
  if (typeof id !== 'string' || !id) {
    throw new StoreError('VALIDATION_ERROR', 'setCurrentUserId cần một userId chuỗi khác rỗng.');
  }
  storage().setItem(CURRENT_USER_KEY, JSON.stringify({ userId: id }));
}

export function clearCurrentUser() {
  storage().removeItem(CURRENT_USER_KEY);
}

// ===== Đăng ký thay đổi =====
const listeners = new Map();

/** Đăng ký theo dõi thay đổi một collection. Trả về hàm hủy đăng ký. */
export function subscribe(collection, callback) {
  collectionOf(collection);
  if (!listeners.has(collection)) listeners.set(collection, new Set());
  listeners.get(collection).add(callback);
  return () => listeners.get(collection)?.delete(callback);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null) return;
    for (const [collection, config] of Object.entries(COLLECTIONS)) {
      if (event.key === config.key) notify(collection, 'external', null);
    }
  });
}

// ===== Đặt lại dữ liệu demo =====
/** Xóa đúng danh sách khóa của dự án rồi khởi tạo lại. Người dùng phải xác nhận ở giao diện trước khi gọi. */
export function resetDemoData() {
  const store = storage();
  for (const config of Object.values(COLLECTIONS)) store.removeItem(config.key);
  store.removeItem(CURRENT_USER_KEY);
  store.removeItem(SCHEMA_KEY);
  initPromise = null;
  schemaReady = false;
  return initStore();
}

