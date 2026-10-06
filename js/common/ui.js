import { createIcon } from './renderers.js';

const modals = [];
let modalCounter = 0;
let background = [];
const focusable = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';

function synchronizeModals() {
  for (const item of modals) {
    const top = item === modals.at(-1);
    item.element.inert = !top;
    item.element.setAttribute('aria-hidden', String(!top));
  }
  document.body.classList.toggle('is-modal-open', modals.length > 0);
  if (!modals.length) {
    for (const [element, inert] of background) element.inert = inert;
    background = [];
  }
}

export function openModal({ title, content, onClose }) {
  const root = document.querySelector('#modal-root');
  if (!root) throw new Error('Thiếu điểm gắn modal-root.');
  const restoreFocus = document.activeElement;
  if (!modals.length) {
    background = [...document.body.children].filter((el) => !['modal-root', 'toast-root'].includes(el.id) && el.tagName !== 'SCRIPT').map((el) => [el, el.inert]);
    for (const [element] of background) element.inert = true;
  }
  const element = document.createElement('div'); element.className = 'modal is-open';
  const backdrop = document.createElement('div'); backdrop.className = 'modal__backdrop'; backdrop.setAttribute('aria-hidden', 'true');
  const dialog = document.createElement('section'); dialog.className = 'modal__dialog';
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.tabIndex = -1;
  const header = document.createElement('header'); header.className = 'modal__header';
  const heading = document.createElement('h2'); heading.className = 'modal__title'; heading.id = `modal-title-${++modalCounter}`; heading.textContent = title;
  dialog.setAttribute('aria-labelledby', heading.id);
  const dismiss = document.createElement('button'); dismiss.className = 'btn btn--ghost btn--icon modal__close'; dismiss.type = 'button';
  dismiss.dataset.action = 'close-modal'; dismiss.setAttribute('aria-label', 'Đóng hộp thoại'); dismiss.append(createIcon('close'));
  header.append(heading, dismiss);
  const body = document.createElement('div'); body.className = 'modal__body'; body.append(content);
  dialog.append(header, body); element.append(backdrop, dialog);
  let closing = false;
  const modal = {
    element,
    async close() {
      if (closing || !element.isConnected) return false;
      closing = true;
      try {
        if (onClose && await onClose() === false) return false;
        const index = modals.indexOf(modal);
        if (index >= 0) modals.splice(index, 1);
        element.remove(); synchronizeModals();
        if (restoreFocus?.isConnected && !restoreFocus.closest('[inert]')) restoreFocus.focus();
        else modals.at(-1)?.element.querySelector('.modal__dialog')?.focus();
        return true;
      } finally { closing = false; }
    },
  };
  dismiss.addEventListener('click', () => modal.close());
  backdrop.addEventListener('click', () => modal.close());
  element.addEventListener('keydown', (event) => {
    if (modals.at(-1) !== modal) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void modal.close(); }
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll(focusable)].filter((el) => el.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  modals.push(modal); root.append(element); synchronizeModals();
  const initial = body.querySelector(focusable) || dismiss;
  initial.focus();
  return modal;
}

export async function closeModal() { return modals.at(-1)?.close(); }

export function confirmAction({ title, message, confirmLabel = 'Xác nhận', tone = 'primary' }) {
  return new Promise((resolve) => {
    let answered = false;
    const content = document.createElement('div');
    const notice = document.createElement('div'); notice.className = `alert alert--${tone === 'danger' ? 'danger' : 'info'}`;
    const copy = document.createElement('p'); copy.className = 'alert__message'; copy.textContent = message; notice.append(copy);
    const actions = document.createElement('div'); actions.className = 'modal__footer';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn--secondary'; cancel.textContent = 'Hủy';
    const confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = `btn btn--${tone === 'danger' ? 'danger' : 'primary'}`;
    confirm.textContent = confirmLabel; confirm.dataset.action = 'confirm-action';
    actions.append(cancel, confirm); content.append(notice, actions);
    const modal = openModal({ title, content, onClose: () => { if (!answered) { answered = true; resolve(false); } } });
    modal.element.classList.add('modal--sm');
    async function answer(value) {
      if (answered) return;
      answered = true; await modal.close(); resolve(value);
    }
    cancel.addEventListener('click', () => answer(false)); confirm.addEventListener('click', () => answer(true));
    cancel.focus();
  });
}

export function showToast({ message, type = 'info' }) {
  const root = document.querySelector('#toast-root');
  if (!root) return;
  root.classList.add('toast-stack');
  const toast = document.createElement('div'); toast.className = `toast toast--${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'}`;
  const text = document.createElement('p'); text.className = 'toast__message'; text.textContent = message;
  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn--ghost btn--icon toast__close';
  close.setAttribute('aria-label', 'Đóng thông báo'); close.append(createIcon('close'));
  const timer = setTimeout(() => toast.remove(), type === 'error' ? 9000 : 6500);
  close.addEventListener('click', () => { clearTimeout(timer); toast.remove(); });
  toast.append(text, close); root.append(toast);
}

export function setViewState(root, { status, message = '' }) {
  root.replaceChildren(); root.hidden = status === 'ready';
  root.classList.remove('view-state--loading', 'view-state--empty', 'view-state--error');
  root.classList.add('view-state'); root.setAttribute('role', status === 'error' ? 'alert' : 'status');
  root.setAttribute('aria-busy', String(status === 'loading'));
  if (status === 'ready') return;
  root.classList.add(`view-state--${status}`);
  if (status === 'loading') { const spinner = document.createElement('span'); spinner.className = 'spinner'; spinner.setAttribute('aria-hidden', 'true'); root.append(spinner); }
  const copy = document.createElement('p'); copy.className = 'view-state__message'; copy.textContent = message; root.append(copy);
}

const initializedTabs = new WeakSet();
export function initTabs(root) {
  if (initializedTabs.has(root)) return;
  initializedTabs.add(root);
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  function activate(tab) {
    for (const item of tabs) {
      const active = item === tab; item.classList.toggle('is-active', active); item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls')); if (panel) panel.hidden = !active;
    }
  }
  root.addEventListener('click', (event) => { const tab = event.target.closest('[role="tab"]'); if (tabs.includes(tab)) activate(tab); });
  root.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activate(tabs[next]); tabs[next].focus();
  });
  if (tabs.length) activate(tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0]);
}
