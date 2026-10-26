import { ROUTES } from './config/routes.js';
import { renderLayout, refreshLayoutUser } from './common/layout.js';
import { getCurrentUser, logout } from './common/auth.js';
import { canOpenPage } from './common/permissions.js';
import { initStore, subscribe, canResetDemoData, resetDemoData } from './data/store.js';
import * as ui from './common/ui.js';

const pageUrl = name => new URL(`../pages/${name}.html`, import.meta.url);
async function bootstrap() {
  const pageId = document.body.dataset.page;
  const route = ROUTES[pageId];
  if (!route) { location.replace(pageUrl('404')); return; }
  const main = document.querySelector('#main-content');
  main.hidden = true;
  let storeInitialized = false;
  try {
    await initStore();
    storeInitialized = true;
    const currentUser = getCurrentUser();
    if (!route.public && !currentUser) { location.replace(pageUrl('login')); return; }
    if (!canOpenPage(currentUser, pageId)) { location.replace(pageUrl('403')); return; }
    renderLayout({ currentUser, pageId });
    function checkSession() {
      try {
        const next = getCurrentUser();
        if (next?.id !== currentUser?.id || next?.role !== currentUser?.role) {
          main.hidden = true;
          document.querySelector('#modal-root')?.replaceChildren();
          location.reload(); return;
        }
        if (next) refreshLayoutUser(next);
      } catch { location.reload(); }
    }
    for (const name of ['currentUser', 'users', 'schemaVersion']) subscribe(name, checkSession);
    window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
    const page = await route.loadPage();
    await page.initPage({ currentUser, ui, pageId });
    main.hidden = false;
    document.body.dataset.ready = 'true';
  } catch (error) {
    document.body.dataset.ready = 'error';
    const panel = document.createElement('section'); panel.className = 'card';
    const heading = document.createElement('h1'); heading.textContent = 'Không thể mở dữ liệu';
    const message = document.createElement('p'); message.textContent = error.message;
    const actions = document.createElement('div'); actions.className = 'form__actions';
    const retry = document.createElement('button'); retry.className = 'btn btn--primary'; retry.textContent = 'Thử lại';
    retry.addEventListener('click', () => location.reload());
    const signOut = document.createElement('button'); signOut.className = 'btn btn--secondary'; signOut.textContent = 'Đăng xuất';
    signOut.addEventListener('click', () => { try { logout(); location.assign(pageUrl('login')); } catch (failure) { message.textContent = failure.message; } });
    actions.append(retry);
    // Only an initialization failure can expose emergency reset, and only when
    // the persisted session still proves that an active Admin is signed in.
    if (!storeInitialized && canResetDemoData()) {
      const reset = document.createElement('button'); reset.className = 'btn btn--secondary'; reset.textContent = 'Đặt lại dữ liệu demo';
      reset.addEventListener('click', async () => {
        if (!await ui.confirmAction({ title: 'Đặt lại dữ liệu demo?', message: 'Xóa thay đổi OnboardAI trên trình duyệt này và nạp lại JSON. Các dữ liệu website khác được giữ nguyên.', tone: 'danger' })) return;
        reset.disabled = true;
        try { await resetDemoData(); location.reload(); } catch (failure) { message.textContent = failure.message; reset.disabled = false; }
      });
      actions.append(reset);
    }
    actions.append(signOut); panel.append(heading, message, actions);
    main.replaceChildren(panel); main.hidden = false;
  }
}
await bootstrap();
