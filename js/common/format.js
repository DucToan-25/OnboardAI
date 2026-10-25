import { APP_CONFIG } from '../config/app.js';

const EMPTY_VALUE = '—';

// Seed dates without an offset are Vietnam wall-clock dates, never browser-local dates.
export function parseStoredDate(value) {
  if (value instanceof Date || typeof value === 'number') {
    const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = String(value || '');
  const local = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (local) {
    if (formatDate(local[1]) === EMPTY_VALUE || Number(local[2] || 0) > 23 || Number(local[3] || 0) > 59 || Number(local[4] || 0) > 59) return null;
    return new Date(`${local[1]}T${local[2] || '00'}:${local[3] || '00'}:${local[4] || '00'}+07:00`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(text) || formatDate(text.slice(0, 10)) === EMPTY_VALUE) return null;
  const date = new Date(text); return Number.isNaN(date.getTime()) ? null : date;
}

function dateTimeParts(value) {
  const date = parseStoredDate(value);
  if (!date) return null;
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
  const date = parseStoredDate(value);
  if (!date) return EMPTY_VALUE;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_CONFIG.timeZone || 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}
