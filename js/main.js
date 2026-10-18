import { ROUTES } from './config/routes.js';
import { renderLayout } from './common/layout.js';
import * as ui from './common/ui.js';

async function bootstrap() {
  const pageId = document.body.dataset.page;
  const route = ROUTES[pageId];
  if (!route) { location.replace(new URL('../pages/404.html', import.meta.url)); return; }
  try {
    // Vai trò chỉ chọn bố cục đang xem; bản HTML tĩnh chưa có phiên đăng nhập.
    const requestedRole = new URLSearchParams(location.search).get('role');
    const role = route.allowedRoles.includes(requestedRole) ? requestedRole : route.allowedRoles[0];
    const currentUser = role ? { role, fullName: document.body.dataset.displayName || '' } : null;
    renderLayout({ currentUser, pageId });
    const page = await route.loadPage();
    await page.initPage({ currentUser, ui, pageId });
    document.body.dataset.ready = 'true';
  } catch (error) {
    ui.showToast({ message: 'Không thể khởi tạo tương tác của trang.', type: 'error' });
    document.body.dataset.ready = 'error';
    console.error(error);
  }
}
await bootstrap();
