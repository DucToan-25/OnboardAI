import { STATUS_META } from '../config/statuses.js';
import { formatDate, getTodayDate } from './format.js';
import { isSafeUrl } from './validation.js';

let fieldCounter = 0;

export function createIcon(name, className = 'btn__icon') {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', className); icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  // Presentation belongs on the instance: external <use> does not inherit the sprite root.
  icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.7'); icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', new URL(`../../assets/icons/sprite.svg#${name}`, import.meta.url).href);
  icon.append(use);
  return icon;
}

export function createAvatar(user, { size } = {}) {
  const avatar = document.createElement('span');
  avatar.className = `avatar${['sm', 'lg'].includes(size) ? ` avatar--${size}` : ''}`;
  const initials = document.createElement('span');
  initials.className = 'avatar__initials';
  initials.textContent = (user.fullName || '').trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase() || '?';
  avatar.setAttribute('aria-label', user.fullName || 'Ảnh đại diện');
  avatar.append(initials);
  if (isSafeUrl(user.avatarUrl, { allowRelative: true })) {
    const image = document.createElement('img');
    image.className = 'avatar__image'; image.alt = ''; image.referrerPolicy = 'no-referrer';
    image.addEventListener('load', () => { initials.hidden = true; image.hidden = false; });
    image.addEventListener('error', () => { image.remove(); initials.hidden = false; }, { once: true });
    image.hidden = true; image.src = user.avatarUrl; avatar.append(image);
  }
  return avatar;
}

export function createField({ name, label, type = 'text', value = '', required = false, readOnly = false, options = [], hint = '' }) {
  const id = `field-${name}-${++fieldCounter}`;
  const field = document.createElement('div'); field.className = 'form-field';
  const caption = document.createElement('label'); caption.className = 'form-field__label'; caption.htmlFor = id;
  caption.textContent = label;
  if (required) {
    const star = document.createElement('span'); star.className = 'form-field__required';
    star.textContent = ' *'; star.setAttribute('aria-hidden', 'true'); caption.append(star);
  }
  const control = document.createElement(type === 'select' ? 'select' : type === 'textarea' ? 'textarea' : 'input');
  if (control.tagName === 'INPUT') control.type = type;
  if (type === 'select') {
    for (const option of options) {
      const item = document.createElement('option'); item.value = option.value; item.textContent = option.label; control.append(item);
    }
  }
  control.className = 'form-field__control'; control.id = id; control.name = name;
  if (type !== 'file') control.value = value ?? '';
  control.required = required;
  if (type === 'select') control.disabled = readOnly;
  else control.readOnly = readOnly;
  const error = document.createElement('p'); error.className = 'form-field__error';
  error.id = `${id}-error`; error.dataset.errorFor = name; error.hidden = true;
  control.setAttribute('aria-describedby', `${id}-error${hint ? ` ${id}-hint` : ''}`);
  field.append(caption, control, error);
  if (hint) {
    const help = document.createElement('p'); help.className = 'form-field__hint'; help.id = `${id}-hint`; help.textContent = hint; field.append(help);
  }
  return field;
}

export function createStatusBadge(entity, status) {
  const meta = STATUS_META[entity]?.[status] || { label: 'Chưa xác định', tone: 'neutral' };
  const badge = document.createElement('span'); badge.className = `badge badge--${meta.tone}`; badge.textContent = meta.label;
  return badge;
}

export function createDocumentCard(record, { onOpen, compact = false } = {}) {
  const card = document.createElement('article'); card.className = `card document-card${compact ? ' card--compact' : ''}`;
  card.dataset.id = record.id;
  const icon = document.createElement('span'); icon.className = 'document-card__icon'; icon.append(createIcon('file'));
  const title = document.createElement('h3'); title.className = 'document-card__title'; title.textContent = record.title;
  const category = document.createElement('span'); category.className = 'badge badge--info'; category.textContent = record.category;
  const description = document.createElement('p'); description.className = 'document-card__meta';
  description.textContent = record.description || String(record.content || '').split('\n')[0];
  const actions = document.createElement('div'); actions.className = 'document-card__actions';
  const date = document.createElement('span'); date.className = 'document-card__meta'; date.textContent = formatDate(record.updatedAt ? getTodayDate(record.updatedAt) : '');
  const open = document.createElement(onOpen ? 'button' : 'a'); open.className = 'btn btn--secondary btn--sm';
  open.textContent = 'Đọc tài liệu'; open.dataset.action = 'open-document'; open.dataset.id = record.id;
  open.setAttribute('aria-label', `Đọc ${record.title}`);
  if (onOpen) { open.type = 'button'; open.addEventListener('click', () => onOpen(record)); }
  else open.href = `document-detail.html?${new URLSearchParams({ id: record.id })}`;
  actions.append(date, open); card.append(icon, category, title, description, actions);
  return card;
}

export function createTaskItem(task, { onOpen, showDueDate = true, showStatus = true } = {}) {
  const item = document.createElement('div'); item.className = 'task-item'; item.dataset.id = task.id;
  const icon = createIcon(task.status === 'completed' ? 'check' : 'clock', 'task-item__check');
  const body = document.createElement('div'); body.className = 'task-item__body';
  const title = document.createElement(onOpen ? 'button' : 'a');
  title.className = onOpen ? 'btn btn--ghost btn--sm task-item__title' : 'task-item__title'; title.textContent = task.title;
  title.dataset.action = 'open-task'; title.dataset.id = task.id;
  if (onOpen) { title.type = 'button'; title.addEventListener('click', () => onOpen(task)); }
  else title.href = `newhire-checklist.html?${new URLSearchParams({ id: task.id })}`;
  const meta = document.createElement('p'); meta.className = 'task-item__meta'; meta.textContent = `Hạn: ${formatDate(task.dueDate)}`;
  body.append(title);
  if (showDueDate) body.append(meta);
  const actions = document.createElement('div'); actions.className = 'task-item__actions'; actions.append(createStatusBadge('tasks', task.status));
  item.append(icon, body);
  if (showStatus) item.append(actions);
  return item;
}
