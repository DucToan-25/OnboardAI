// All Web Storage access belongs here. Services enforce business permissions.
import { parseStoredDate } from '../common/format.js';
export class StoreError extends Error {
  constructor(code, message) { super(message); this.name = 'StoreError'; this.code = code; }
}
export function parseSeedDate(value) { return parseStoredDate(value)?.getTime() ?? null; }
export function createId(collection) {
  const prefix = { users: 'user', newHires: 'hire', tasks: 'task', departments: 'dept', documents: 'doc', checkins: 'checkin', journeys: 'journeys', companyInfo: 'company', news: 'news', aiHistory: 'ai-history' }[collection];
  if (!prefix) throw new StoreError('UNKNOWN_COLLECTION', 'Collection không có quy tắc ID.');
  return `${prefix}-${crypto.randomUUID()}`;
}
export const SCHEMA_VERSION = 1;
export const COLLECTIONS = Object.freeze(['users', 'newHires', 'tasks', 'departments', 'documents', 'checkins', 'journeys', 'companyInfo', 'news', 'aiMockData', 'aiHistory', 'settings']);
export const STORAGE_KEYS = Object.freeze(
  Object.fromEntries(
    [...COLLECTIONS, 'currentUser', 'schemaVersion', 'usersSeedVersion']
      .map(name => [name, `onboardai_${name}`])
  )
);
let initialization;
let transactionDraft = null;
const listeners = new Map();

function storage(operation, name, value) {
  try { return globalThis.localStorage[operation](STORAGE_KEYS[name], value); }
  catch { throw new Error('Không thể truy cập bộ nhớ trình duyệt. Kiểm tra quyền lưu trữ hoặc dung lượng rồi thử lại. Dữ liệu cũ không bị tự đặt lại.'); }
}
function read(name) {
  const raw = transactionDraft?.get(name) ?? storage('getItem', name);
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
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id.trim()) throw new StoreError('INVALID_DATA', `${name} có bản ghi thiếu ID hợp lệ.`);
    if (ids.has(item.id)) throw new StoreError('DUPLICATE_ID', `${name} có ID trùng: ${item.id}. Hãy sửa JSON nguồn trước khi khởi tạo hoặc đặt lại dữ liệu.`);
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
  if (transactionDraft) { transactionDraft.set(name, serialized); return; }
  storage('setItem', name, serialized);
  emit(name);
}
// Synchronous service operations stage changes before committing each key once.
// LocalStorage has no crash-safe multi-key transaction; the demo supports one writer.
export function transaction(operation) {
  if (transactionDraft) throw new Error('Không được lồng thao tác lưu.');
  const draft = new Map();
  transactionDraft = draft;
  let result;
  try {
    result = operation();
    if (result?.then) throw new Error('Thao tác lưu phải đồng bộ.');
  } finally { transactionDraft = null; }
  const backup = new Map([...draft.keys()].map(name => [name, storage('getItem', name)]));
  const written = [];
  try {
    for (const [name, raw] of draft) {
      storage('setItem', name, raw);
      written.push(name);
    }
  } catch (error) {
    const unrestored = [];
    for (const name of written.reverse()) {
      try {
        const raw = backup.get(name);
        if (raw === null) storage('removeItem', name);
        else storage('setItem', name, raw);
      } catch { unrestored.push(name); }
    }
    if (unrestored.length) throw new StoreError('ROLLBACK_FAILED', `Lưu thất bại và chưa khôi phục được: ${unrestored.join(', ')}. Giữ nguyên dữ liệu, kiểm tra bộ nhớ rồi thử lại cùng thao tác.`);
    throw error;
  }
  for (const name of draft.keys()) emit(name);
  return result;
}
async function loadSeed(name) {
  const url = new URL(`../../assets/data/${name}.json`, import.meta.url);
  let response;
  try { response = await fetch(url, { cache: 'no-store' }); }
  catch { throw new StoreError('SEED_LOAD_FAILED', `Không tải được ${name}.json. Kiểm tra kết nối rồi thử lại.`); }
  if (!response.ok) throw new StoreError('SEED_LOAD_FAILED', `Không tải được ${name}.json (HTTP ${response.status}).`);
  let items;
  try { items = await response.json(); }
  catch { throw new StoreError('INVALID_DATA', `${name}.json không phải JSON hợp lệ.`); }
  return [name, validateItems(name, items)];
}
async function loadUsersVersion() {
  const url = new URL('../../assets/data/version.json', import.meta.url);

  let response;

  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new StoreError('VERSION_LOAD_FAILED', 'Không tải được version.json.');
  }

  if (!response.ok) {
    throw new StoreError('VERSION_LOAD_FAILED', `Lỗi tải version.json: HTTP ${response.status}.`);
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new StoreError('INVALID_DATA', 'version.json không hợp lệ.');
  }

  if (!Number.isSafeInteger(data?.users) || data.users < 1) {
    throw new StoreError('INVALID_DATA', 'Phiên bản users phải là số nguyên dương.');
  }

  return data.users;
}
export function initStore() {
  if (initialization) return initialization;

  initialization = (async () => {
    const version = read('schemaVersion');

    if (version !== null && version !== SCHEMA_VERSION) {
      throw new Error('Phiên bản dữ liệu chưa được hỗ trợ.');
    }

    const missing = [];

    for (const name of COLLECTIONS) {
      if (storage('getItem', name) !== null) {
        validateItems(name, read(name));
      } else {
        missing.push(name);
      }
    }

    const remoteVersion = await loadUsersVersion();
    const localVersion = read('usersSeedVersion');

    const namesToLoad = [
      ...new Set([
        ...missing,
        ...(remoteVersion !== localVersion ? ['users'] : [])
      ])
    ];

    const seeds = await Promise.all(namesToLoad.map(loadSeed));

    const latestVersion = read('schemaVersion');

    if (latestVersion !== null && latestVersion !== SCHEMA_VERSION) {
      throw new Error('Phiên bản dữ liệu đã thay đổi. Vui lòng tải lại trang.');
    }

    for (const [name, items] of seeds) {
      if (name !== 'users') {
        if (storage('getItem', name) === null) {
          write(name, items);
        }
        continue;
      }

      if (storage('getItem', 'users') === null) {
        write('users', items);
        continue;
      }

      const localUsers = validateItems('users', read('users'));

      const ids = new Set(localUsers.map(user => user.id));

      const emails = new Set(
        localUsers.map(user =>
          String(user.email || '').trim().toLowerCase()
        )
      );

      const newUsers = [];

      for (const user of items) {
        const email = String(user.email || '').trim().toLowerCase();

        if (ids.has(user.id) || (email && emails.has(email))) {
          continue;
        }

        ids.add(user.id);

        if (email) {
          emails.add(email);
        }

        newUsers.push(user);
      }

      if (newUsers.length > 0) {
        write('users', [...localUsers, ...newUsers]);

        console.log(`Đã thêm ${newUsers.length} tài khoản mới.`);
      }
    }

    if (latestVersion === null) {
      write('schemaVersion', SCHEMA_VERSION);
    }

    if (read('usersSeedVersion') !== remoteVersion) {
      write('usersSeedVersion', remoteVersion);
    }
  })().catch(error => {
    initialization = undefined;
    throw error;
  });

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
  // Validate the complete canonical source before removing any saved work.
  const seeds = await Promise.all(COLLECTIONS.map(loadSeed));
  const backup = new Map(Object.keys(STORAGE_KEYS).map(name => [name, storage('getItem', name)]));
  initialization = undefined;
  try {
    for (const name of Object.keys(STORAGE_KEYS)) storage('removeItem', name);
    for (const [name, items] of seeds) storage('setItem', name, JSON.stringify(items));
    storage('setItem', 'schemaVersion', JSON.stringify(SCHEMA_VERSION));
  } catch (error) {
    // Best effort rollback if the browser rejects writes during reset.
    for (const [name, raw] of backup) {
      try { if (raw === null) storage('removeItem', name); else storage('setItem', name, raw); }
      catch { /* Keep the original storage error visible to the caller. */ }
    }
    throw error;
  }
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
