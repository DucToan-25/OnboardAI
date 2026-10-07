import { APP_CONFIG } from './config/app.js';
import { ROUTES } from './config/routes.js';
import { getCurrentUser } from './common/auth.js';
import { renderLayout } from './common/layout.js';
import * as permissions from './common/permissions.js';
import * as ui from './common/ui.js';
import { createRepository } from './data/repository.js';

async function bootstrap() {
  const pageId = document.body.dataset.page;
  const route = ROUTES[pageId];
  if (!route) { location.replace(new URL('../pages/404.html', import.meta.url)); return; }
  const root = document.querySelector('#main-content');
  try {
    const currentUser = await getCurrentUser();
    if (!route.public && !currentUser) { location.replace(new URL('../pages/login.html', import.meta.url)); return; }
    if (!permissions.canOpenPage(currentUser, pageId)) { location.replace(new URL('../pages/403.html', import.meta.url)); return; }
    const repository = await createRepository({ currentUser: pageId === 'login' ? null : currentUser, mode: APP_CONFIG.mode });
    renderLayout({ currentUser, pageId });
    const page = await route.loadPage();
    if (typeof page.initPage !== 'function') throw new Error('Trang này chưa được bàn giao trong bản giao diện hiện tại.');
    await page.initPage({ currentUser, repository, permissions, ui, pageId });
    document.body.dataset.ready = 'true';
  } catch (error) {
    const state = document.createElement('div');
    ui.setViewState(state, { status: 'error', message: error.message || 'Không thể khởi tạo trang.' });
    const retry = document.createElement('button');
    retry.className = 'btn btn--secondary';
    retry.textContent = 'Thử lại';
    retry.addEventListener('click', () => location.reload());
    state.append(retry);
    root.replaceChildren(state);
    document.body.dataset.ready = 'error';
    console.error(error);
  }
}

// Tránh khôi phục bản nháp của tài khoản trước từ back-forward cache.
window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
await bootstrap();
