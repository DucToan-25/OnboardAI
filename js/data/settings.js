import { requireRoles } from './auth.js';
import { StoreError, getById, update } from './store.js';
const EDITABLE = ['organizationName', 'supportEmail', 'supportPhone', 'onboardingDays', 'reminderDays'];
export function getSystemSettings() {
  requireRoles(['admin']);
  const record = getById('settings', 'system');
  if (!record) throw new StoreError('NOT_FOUND', 'Thiếu cấu hình hệ thống.');
  return record;
}
export function getOnboardingDefaults() {
  requireRoles(['hr', 'admin']);
  const record = getById('settings', 'system');
  if (!record) throw new StoreError('NOT_FOUND', 'Thiếu cấu hình hệ thống.');
  return { onboardingDays: record.onboardingDays, reminderDays: record.reminderDays };
}
export function updateSystemSettings(patch) {
  const previous = getSystemSettings();
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length || Object.keys(patch).some(key => !EDITABLE.includes(key))) throw new StoreError('VALIDATION_ERROR', 'Có trường cấu hình không hợp lệ.');
  const next = { ...previous, ...patch };
  for (const name of ['organizationName', 'supportEmail', 'supportPhone']) {
    if (next[name] != null && typeof next[name] !== 'string') throw new StoreError('VALIDATION_ERROR', 'Thông tin tổ chức phải là văn bản.');
    next[name] = (next[name] || '').trim();
  }
  if (!next.organizationName || next.organizationName.length > 120) throw new StoreError('VALIDATION_ERROR', 'Tên tổ chức cần từ 1 đến 120 ký tự.');
  if (next.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.supportEmail)) throw new StoreError('VALIDATION_ERROR', 'Email hỗ trợ không hợp lệ.');
  if (next.supportPhone && !/^[+\d\s().-]{6,24}$/.test(next.supportPhone)) throw new StoreError('VALIDATION_ERROR', 'Số điện thoại hỗ trợ không hợp lệ.');
  for (const [field, min, max] of [['onboardingDays', 1, 365], ['reminderDays', 0, 30]]) {
    if (!['number', 'string'].includes(typeof next[field]) || String(next[field]).trim() === '') throw new StoreError('VALIDATION_ERROR', `${field}: cần số nguyên từ ${min} đến ${max}.`);
    next[field] = Number(next[field]);
    if (!Number.isInteger(next[field]) || next[field] < min || next[field] > max) throw new StoreError('VALIDATION_ERROR', `${field}: cần số nguyên từ ${min} đến ${max}.`);
  }
  next.supportPhone ||= null;
  return update('settings', 'system', Object.fromEntries(EDITABLE.map(key => [key, next[key]])));
}
