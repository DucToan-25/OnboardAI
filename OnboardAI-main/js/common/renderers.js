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
