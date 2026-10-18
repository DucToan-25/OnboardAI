/*
 * settings.js — cấu hình hệ thống (khóa onboardai_settings, bản ghi "system").
 * OWNER: SV3. SV3 đề xuất cấu trúc theo hợp đồng mục 2.2: một bản ghi system,
 * chỉ các trường được phép sửa; không mật khẩu/API key/token.
 */
import { requireRoles } from './auth.js';
import { StoreError, getById, update } from './store.js';

const SYSTEM_ID = 'system';
const EDITABLE = ['organizationName', 'supportEmail', 'supportPhone', 'onboardingDays', 'reminderDays'];

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

/** Đọc bản ghi cấu hình hệ thống. */
export async function getSystemSettings() {
  const record = await getById('settings', SYSTEM_ID);
  if (!record) throw new StoreError('NOT_FOUND', 'Chưa có bản ghi cấu hình hệ thống (settings/system).');
  return record;
}

/** Cập nhật cấu hình hệ thống. Chỉ Admin; chỉ các trường trong danh sách được phép. */
export async function updateSystemSettings(patch) {
  await requireRoles(['admin']);
  const record = await getById('settings', SYSTEM_ID);
  if (!record) throw new StoreError('NOT_FOUND', 'Chưa có bản ghi cấu hình hệ thống (settings/system).');
  const changes = {};
  for (const field of EDITABLE) {
    if (patch && Object.hasOwn(patch, field)) changes[field] = clean(patch[field]);
  }
  if (!Object.keys(changes).length) {
    throw new StoreError('VALIDATION_ERROR', 'Không có trường hợp lệ nào để cập nhật cấu hình.');
  }
  if (Object.hasOwn(changes, 'organizationName') && !changes.organizationName) {
    throw new StoreError('VALIDATION_ERROR', 'settings: trường "organizationName" là bắt buộc.');
  }
  for (const [field, min] of [['onboardingDays', 1], ['reminderDays', 0]]) {
    if (Object.hasOwn(changes, field)) {
      const value = Number(changes[field]);
      if (!Number.isInteger(value) || value < min) {
        throw new StoreError('VALIDATION_ERROR', `settings: "${field}" phải là số nguyên từ ${min}.`);
      }
      changes[field] = value;
    }
  }
  return update('settings', SYSTEM_ID, changes);
}
