<<<<<<< HEAD
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

=======
// All Web Storage access belongs here. Services enforce business permissions.
export const SCHEMA_VERSION = 1;
export const COLLECTIONS = Object.freeze(['users', 'newHires', 'tasks', 'departments', 'documents', 'checkins', 'journeys', 'companyInfo', 'news', 'aiMockData', 'aiHistory']);
export const STORAGE_KEYS = Object.freeze(Object.fromEntries([...COLLECTIONS, 'currentUser', 'schemaVersion'].map(name => [name, `onboardai_${name}`])));
let initialization;
const listeners = new Map();

function storage(operation, name, value) {
  try { return globalThis.localStorage[operation](STORAGE_KEYS[name], value); }
  catch { throw new Error('Không thể truy cập bộ nhớ trình duyệt. Kiểm tra quyền lưu trữ hoặc dung lượng rồi thử lại. Dữ liệu cũ không bị tự đặt lại.'); }
}
function read(name) {
  const raw = storage('getItem', name);
  if (raw === null) return null;
  try { return JSON.parse(raw); }
  catch { throw new Error(`Dữ liệu ${name} bị lỗi JSON. Hãy khôi phục bản sao hoặc đặt lại dữ liệu demo có xác nhận.`); }
}
function assertVersion() {
  if (read('schemaVersion') !== SCHEMA_VERSION) throw new Error('Phiên bản dữ liệu chưa được hỗ trợ. Cần nâng cấp hoặc đặt lại dữ liệu demo.');
}
function assertCollection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error('Collection chưa được đăng ký.');
}
function validateItems(name, items) {
  if (!Array.isArray(items)) throw new Error(`${name} phải là một mảng.`);
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new Error(`${name} có ID thiếu hoặc trùng.`);
    ids.add(item.id);
  }
  return items;
}
function emit(name) {
  for (const callback of [...(listeners.get(name) || []), ...(listeners.get('*') || [])]) {
    // A rendering failure must never turn a successful storage write into a failed write.
    try { callback(name); } catch (error) { console.error('Không thể cập nhật giao diện sau thay đổi dữ liệu.', error); }
  }
}
function write(name, value) {
  let serialized;
  try { serialized = JSON.stringify(value); } catch { throw new Error(`Không thể mã hóa dữ liệu ${name}.`); }
  storage('setItem', name, serialized);
  emit(name);
}
export function initStore() {
  if (initialization) return initialization;
  initialization = (async () => {
    const version = read('schemaVersion');
    if (version !== null && version !== SCHEMA_VERSION) throw new Error('Phiên bản dữ liệu chưa được hỗ trợ. Cần nâng cấp hoặc đặt lại dữ liệu demo.');
    // Validate/fetch everything before writing, so a fetch failure cannot partially seed.
    const missing = [];
    for (const name of COLLECTIONS) {
      if (storage('getItem', name) !== null) validateItems(name, read(name));
      else missing.push(name);
    }
    const seeds = await Promise.all(missing.map(async name => {
      if (name === 'aiHistory') return [name, []];
      const url = new URL(`../../assets/data/${name}.json`, import.meta.url);
      let response;
      try { response = await fetch(url); } catch { throw new Error(`Không tải được ${name}.json. Kiểm tra kết nối rồi thử lại.`); }
      if (!response.ok) throw new Error(`Không tải được ${name}.json (HTTP ${response.status}).`);
      let items;
      try { items = await response.json(); } catch { throw new Error(`${name}.json không phải JSON hợp lệ.`); }
      return [name, validateItems(name, items)];
    }));
    // Another tab may have finished initialization during fetch.
    const latestVersion = read('schemaVersion');
    if (latestVersion !== null && latestVersion !== SCHEMA_VERSION) throw new Error('Phiên bản dữ liệu đã thay đổi. Vui lòng tải lại trang.');
    for (const [name, items] of seeds) if (storage('getItem', name) === null) write(name, items);
    if (latestVersion === null) write('schemaVersion', SCHEMA_VERSION);
  })().catch(error => { initialization = undefined; throw error; });
  return initialization;
}
export function getAll(name) {
  assertCollection(name); assertVersion();
  return validateItems(name, read(name));
}
export function getById(name, id) { return getAll(name).find(item => item.id === id) || null; }
export function create(name, item) {
  const items = getAll(name);
  validateItems(name, [...items, item]);
  write(name, [...items, item]);
  return getById(name, item.id);
}
export function update(name, id, patch) {
  const items = getAll(name);
  const index = items.findIndex(item => item.id === id);
  if (index < 0) throw new Error('Không tìm thấy bản ghi cần cập nhật.');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Thay đổi phải là object.');
  items[index] = { ...items[index], ...patch, id };
  validateItems(name, items); write(name, items);
  return getById(name, id);
}
// Only AI history supports physical deletion; its service checks owner and task references.
export function removeHistory(id) {
  const items = getAll('aiHistory');
  if (!items.some(item => item.id === id)) throw new Error('Không tìm thấy lịch sử.');
  write('aiHistory', items.filter(item => item.id !== id));
}
export function getCurrentUserId() {
  assertVersion();
  const session = read('currentUser');
  if (session === null) return null;
  if (!session || typeof session.userId !== 'string') throw new Error('Phiên đăng nhập không hợp lệ. Hãy đăng xuất rồi đăng nhập lại.');
  return session.userId;
}
export function setCurrentUserId(id) {
  assertVersion();
  if (typeof id !== 'string' || !getById('users', id)) throw new Error('Tài khoản không tồn tại.');
  write('currentUser', { userId: id });
}
export function clearCurrentUser() { storage('removeItem', 'currentUser'); emit('currentUser'); }
export async function resetDemoData() {
  initialization = undefined;
  for (const name of Object.keys(STORAGE_KEYS)) storage('removeItem', name);
  await initStore();
  for (const name of Object.keys(STORAGE_KEYS)) emit(name);
}
export function subscribe(name, callback) {
  if (name !== '*' && !Object.hasOwn(STORAGE_KEYS, name)) throw new Error('Khóa theo dõi chưa được đăng ký.');
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(callback);
  return () => listeners.get(name)?.delete(callback);
}
globalThis.addEventListener?.('storage', event => {
  if (event.key === null) { for (const name of Object.keys(STORAGE_KEYS)) emit(name); return; }
  const name = Object.keys(STORAGE_KEYS).find(key => STORAGE_KEYS[key] === event.key);
  if (name) emit(name);
});
>>>>>>> 906d77f (Update localstorage sv1)
