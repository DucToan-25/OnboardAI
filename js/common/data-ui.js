import { subscribe } from '../data/store.js';
import { setViewState, showToast } from './ui.js';

export function watchData(collections, render, state) {
  function refresh() {
    try { render(); }
    catch (error) {
      if (state) setViewState(state, { status: 'error', message: error.message });
      else showToast({ message: error.message, type: 'error' });
    }
  }
  let queued = false;
  const cleanups = collections.map(name => subscribe(name, () => {
    if (queued) return;
    queued = true; queueMicrotask(() => { queued = false; refresh(); });
  }));
  window.addEventListener('pagehide', () => cleanups.forEach(cleanup => cleanup()), { once: true });
  refresh(); return refresh;
}
export function showError(error) { showToast({ message: error.message, type: 'error' }); }
