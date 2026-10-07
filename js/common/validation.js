function validDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function isSafeUrl(value, { allowRelative = false } = {}) {
  const source = String(value || '').trim();
  if (!source || /[\u0000-\u0020\\]/.test(source)) return false;
  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  // Local assets only: no scheme, protocol-relative URL or markup.
  return allowRelative && !source.startsWith('//') && !/[<>"']/.test(source) && !/^[^/]*:/.test(source)
    && /^(?:\.\.?\/|\/)?assets\/[A-Za-z0-9_./% -]+$/.test(source);
}

export function validateForm(values, rules) {
  const errors = {};
  for (const [name, fieldRules] of Object.entries(rules)) {
    const value = String(values[name] ?? '').trim();
    for (const rule of fieldRules) {
      let valid = true;
      if (rule.type === 'required') valid = Boolean(value);
      else if (!value) continue;
      else if (rule.type === 'email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      else if (rule.type === 'date') valid = validDate(value);
      else if (rule.type === 'datetime') valid = Boolean(fromDateTimeInput(value));
      else if (rule.type === 'phone') valid = /^\+?[\d ()-]{8,20}$/.test(value) && value.replace(/\D/g, '').length >= 8;
      else if (rule.type === 'url') valid = isSafeUrl(value, { allowRelative: Boolean(rule.allowRelative) });
      else if (rule.type === 'maxLength') valid = value.length <= Number(rule.maxLength ?? rule.value ?? rule.max);
      if (!valid) {
        errors[name] = rule.message || 'Vui lòng kiểm tra lại trường này.';
        break;
      }
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function applyFormErrors(form, errors = {}) {
  for (const field of form.querySelectorAll('.form-field')) {
    const control = field.querySelector('[name]');
    const message = field.querySelector('.form-field__error');
    if (!control || !message) continue;
    if (!message.id) message.id = `${control.id || `error-${control.name}`}-error`;
    const describedBy = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    describedBy.add(message.id);
    control.setAttribute('aria-describedby', [...describedBy].join(' '));
    const error = errors[control.name];
    field.classList.toggle('is-invalid', Boolean(error));
    if (error) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
    message.textContent = error || '';
    message.hidden = !error;
  }
  const firstInvalid = form.querySelector('[aria-invalid="true"]');
  if (firstInvalid) firstInvalid.focus();
}
import { fromDateTimeInput } from './format.js';
