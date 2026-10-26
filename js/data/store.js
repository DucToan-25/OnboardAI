// All Web Storage access belongs here. Services enforce business permissions.
import { parseStoredDate } from '../common/format.js';
import { assertSeedCollection } from './schema.js';
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
    [...COLLECTIONS, 'currentUser', 'schemaVersion', 'seedVersions', 'usersSeedVersion']
      .map(name => [name, `onboardai_${name}`])
  )
);
let initialization;
let transactionDraft = null;
let lastSeedBackup = null;
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
function hasActiveAdminSession() {
  try {
    const session = read('currentUser');
    const users = read('users');
    if (!session || typeof session.userId !== 'string' || !Array.isArray(users)) return false;
    const matches = users.filter(user => user?.id === session.userId);
    return matches.length === 1 && matches[0].status === 'active' && matches[0].role === 'admin';
  } catch {
    return false;
  }
}
function requireResetAdmin() {
  if (!hasActiveAdminSession()) {
    throw new StoreError('FORBIDDEN', 'Chỉ tài khoản Admin đang hoạt động được đặt lại dữ liệu demo.');
  }
}
export function canResetDemoData() { return hasActiveAdminSession(); }
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
  validateItems(name, items);
  assertSeedCollection(name, items);
  if (name === 'users') {
    const emails = new Map();
    for (const user of items) {
      const email = String(user.email || '').trim().toLowerCase();
      if (email && emails.has(email)) {
        throw new StoreError('SEED_EMAIL_CONFLICT', `users/${user.id} trùng email với users/${emails.get(email)} trong users.json. Hãy sửa JSON nguồn; chưa cập nhật phiên bản dữ liệu.`);
      }
      if (email) emails.set(email, user.id);
    }
  }
  return [name, items];
}
// Omitted collections in the original { users: N } manifest start at version 1.
export function validateSeedVersions(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new StoreError('INVALID_DATA', 'version.json phải là object chứa phiên bản từng collection.');
  }
  for (const [name, version] of Object.entries(data)) {
    if (!COLLECTIONS.includes(name)) throw new StoreError('INVALID_DATA', `version.json có collection chưa đăng ký: ${name}.`);
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new StoreError('INVALID_DATA', `Phiên bản ${name} phải là số nguyên dương.`);
    }
  }
  return Object.fromEntries(COLLECTIONS.map(name => [name, data[name] ?? 1]));
}
async function loadSeedVersions() {
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

  return validateSeedVersions(data);
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

    const remoteVersions = await loadSeedVersions();
    // An old users-only marker cannot prove that linked collections were loaded.
    // Reconcile all collections once when upgrading from that implementation.
    const localVersions = read('seedVersions') ?? {};
    const namesToLoad = COLLECTIONS.filter(name => missing.includes(name) || localVersions[name] !== remoteVersions[name]);
    const collectionsToBackup = namesToLoad.filter(name => storage('getItem', name) !== null
      && localVersions[name] !== remoteVersions[name]);
    const seedBackup = collectionsToBackup.length ? {
      createdAt: new Date().toISOString(),
      fromVersions: Object.fromEntries(collectionsToBackup.map(name => [name, localVersions[name] ?? null])),
      toVersions: Object.fromEntries(collectionsToBackup.map(name => [name, remoteVersions[name]])),
      collections: Object.fromEntries(collectionsToBackup.map(name => [name, read(name)])),
    } : null;
    const seeds = await Promise.all(namesToLoad.map(loadSeed));

    const latestVersion = read('schemaVersion');

    if (latestVersion !== null && latestVersion !== SCHEMA_VERSION) {
      throw new Error('Phiên bản dữ liệu đã thay đổi. Vui lòng tải lại trang.');
    }

    // A version change publishes the complete JSON snapshot for that collection.
    // Unchanged collections and the session are preserved. Commit versions last.
    transaction(() => {
      const appliedVersions = read('seedVersions') ?? {};
      for (const name of COLLECTIONS) {
        if (appliedVersions[name] > remoteVersions[name]) {
          throw new StoreError('SEED_VERSION_DOWNGRADE', `Phiên bản ${name}.json cũ hơn dữ liệu đã nạp. Hãy dùng version mới hơn hoặc đặt lại dữ liệu demo có xác nhận.`);
        }
      }
      if (seedBackup) lastSeedBackup = seedBackup;
      for (const [name, items] of seeds) {
        const localItems = read(name);
        if (localItems !== null && appliedVersions[name] === remoteVersions[name]) continue;
        write(name, items);
      }
      if (latestVersion === null) write('schemaVersion', SCHEMA_VERSION);
      if (COLLECTIONS.some(name => appliedVersions[name] !== remoteVersions[name])) write('seedVersions', remoteVersions);
    });
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
export function getSeedBackupInfo() {
  assertVersion();
  const backup = lastSeedBackup;
  if (backup === null) return null;
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)
    || !parseStoredDate(backup.createdAt) || !backup.collections || typeof backup.collections !== 'object') {
    throw new StoreError('INVALID_DATA', 'Bản sao dữ liệu trước cập nhật không hợp lệ.');
  }
  return {
    createdAt: backup.createdAt,
    collections: Object.keys(backup.collections).filter(name => COLLECTIONS.includes(name)),
    fromVersions: backup.fromVersions || {},
    toVersions: backup.toVersions || {},
  };
}
export function restoreSeedBackup() {
  assertVersion();
  const backup = lastSeedBackup;
  const info = getSeedBackupInfo();
  if (!info?.collections.length) throw new StoreError('NOT_FOUND', 'Không có bản sao dữ liệu trước cập nhật để khôi phục.');
  for (const name of info.collections) {
    validateItems(name, backup.collections[name]);
    assertSeedCollection(name, backup.collections[name]);
  }
  transaction(() => {
    for (const name of info.collections) write(name, backup.collections[name]);
  });
  return info;
}
export async function resetDemoData() {
  // Reset is destructive and may be offered while initialization is failing, so it
  // validates the saved session directly instead of depending on initialized services.
  requireResetAdmin();
  // Validate the complete canonical source before removing any saved work.
  const [versions, seeds] = await Promise.all([loadSeedVersions(), Promise.all(COLLECTIONS.map(loadSeed))]);
  const backup = new Map(Object.keys(STORAGE_KEYS).map(name => [name, storage('getItem', name)]));
  initialization = undefined;
  try {
    for (const name of Object.keys(STORAGE_KEYS)) storage('removeItem', name);
    for (const [name, items] of seeds) storage('setItem', name, JSON.stringify(items));
    storage('setItem', 'schemaVersion', JSON.stringify(SCHEMA_VERSION));
    storage('setItem', 'seedVersions', JSON.stringify(versions));
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
