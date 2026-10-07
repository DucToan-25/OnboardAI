import { APP_CONFIG } from '../config/app.js';

const EMPTY_VALUE = '—';

function dateTimeParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CONFIG.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
}

export function getTodayDate(value = new Date()) {
  const parts = dateTimeParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

export function toDateTimeInput(value) {
  if (!value) return '';
  const parts = dateTimeParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` : '';
}

export function fromDateTimeInput(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match || formatDate(match[0].slice(0, 10)) === EMPTY_VALUE) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (hour > 23 || minute > 59) return null;
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let instant = desired;
  // Resolve a wall-clock input in the configured zone, regardless of the browser zone.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateTimeParts(instant);
    const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second));
    const difference = desired - local;
    if (!difference) break;
    instant += difference;
  }
  const result = new Date(instant).toISOString();
  return toDateTimeInput(result) === value ? result : null;
}

export function formatDate(value) {
  if (!value) return EMPTY_VALUE;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return EMPTY_VALUE;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return EMPTY_VALUE;
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatDateTime(value) {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_CONFIG.timeZone || 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}
