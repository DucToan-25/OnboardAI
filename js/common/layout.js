import { ROLE_LABELS, ROLE_MENUS } from '../config/roles.js';
import { ROUTES } from '../config/routes.js';
import { createAvatar, createIcon } from './renderers.js';
import { logout } from './auth.js';
import { formatDate, getTodayDate } from './format.js';

const initializedLayouts = new WeakSet();

export function renderLayout({ currentUser, pageId }) {
  const header = document.querySelector('#app-header');
  const sidebar = document.querySelector('#app-sidebar');
  if (!header || !sidebar || !currentUser) return;
  if (initializedLayouts.has(header)) return;
  initializedLayouts.add(header);
  header.replaceChildren();
  sidebar.replaceChildren();
  const brand = document.createElement('button');
  brand.className = 'btn btn--ghost app-header__brand';
  brand.type = 'button'; brand.dataset.action = 'toggle-sidebar';
  brand.setAttribute('aria-controls', 'app-sidebar');
  const logo = document.createElement('img');
  logo.src = '../assets/images/logo.svg';
  logo.alt = 'OnboardAI';
  logo.width = 160; logo.height = 32;
  brand.append(logo);
  const nav = document.createElement('nav');
  nav.className = 'app-nav'; nav.setAttribute('aria-label', 'Điều hướng chính');
  const heading = document.createElement('p');
  heading.className = 'app-nav__heading'; heading.textContent = ROLE_LABELS[currentUser.role];
  const list = document.createElement('ul'); list.className = 'app-nav__list';
  for (const item of ROLE_MENUS[currentUser.role] || []) {
    const li = document.createElement('li'); li.className = 'app-nav__item';
    const ready = ROUTES[item.pageId]?.available;
    const link = document.createElement(ready ? 'a' : 'span');
    link.className = 'app-nav__link';
    if (ready) link.href = `${item.pageId}.html`;
    else {
      link.classList.add('is-disabled'); link.setAttribute('aria-disabled', 'true');
      link.title = 'Trang chưa sẵn sàng trong bản hiện tại.';
    }
    const active = item.pageId === pageId || (pageId === 'document-detail' && item.pageId.endsWith('document-library'));
    if (active) { link.classList.add('is-active'); link.setAttribute('aria-current', 'page'); }
    const label = document.createElement('span'); label.className = 'app-nav__label'; label.textContent = item.label;
    link.append(createIcon(item.icon, 'app-nav__icon'), label); li.append(link); list.append(li);
  }
  nav.append(heading, list);
  const footer = document.createElement('div'); footer.className = 'app-sidebar__footer';
  const account = document.createElement('a'); account.className = 'app-header__user'; account.href = 'profile.html';
  const name = document.createElement('div');
  const fullName = document.createElement('strong'); fullName.textContent = currentUser.fullName;
  const role = document.createElement('p'); role.textContent = ROLE_LABELS[currentUser.role];
  name.append(fullName, role); account.append(createAvatar(currentUser, { size: 'sm' }), name);
  const signOut = document.createElement('button'); signOut.className = 'btn btn--ghost btn--sm';
  signOut.type = 'button'; signOut.dataset.action = 'logout'; signOut.append(createIcon('logout'), document.createTextNode('Đăng xuất'));
  footer.append(account, signOut); sidebar.append(nav, footer);
  const actions = document.createElement('div'); actions.className = 'app-header__actions';
  const date = document.createElement('time');
  const day = getTodayDate();
  date.dateTime = day; date.textContent = `Hôm nay, ${formatDate(day)}`;
  const avatarLink = document.createElement('a'); avatarLink.className = 'app-header__user'; avatarLink.href = 'profile.html';
  avatarLink.setAttribute('aria-label', `Hồ sơ ${currentUser.fullName}`); avatarLink.append(createAvatar(currentUser, { size: 'sm' }));
  actions.append(date, avatarLink); header.append(brand, actions);
  const main = document.querySelector('#main-content');
  const shell = header.parentElement;
  const media = matchMedia('(max-width: 1023px)');
  let opened = false;
  function toggle(open = !opened) {
    const restoreFocus = sidebar.contains(document.activeElement);
    opened = open;
    const drawer = opened && media.matches;
    sidebar.classList.toggle('is-open', opened);
    shell.classList.toggle('is-collapsed', !opened);
    document.body.classList.toggle('is-nav-open', drawer);
    brand.setAttribute('aria-expanded', String(opened));
    brand.setAttribute('aria-label', `${opened ? 'Thu gọn' : 'Mở'} thanh điều hướng OnboardAI`);
    brand.title = opened ? 'Thu gọn thanh điều hướng' : 'Mở thanh điều hướng';
    sidebar.inert = !opened;
    main.inert = drawer;
    actions.inert = drawer;
    if (drawer) brand.focus();
    if (!opened && restoreFocus) brand.focus();
  }
  header.addEventListener('click', (event) => { if (event.target.closest('[data-action="toggle-sidebar"]')) toggle(); });
  sidebar.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'logout') { await logout(); location.replace('login.html'); }
  });
  document.addEventListener('click', (event) => {
    if (opened && media.matches && !document.body.classList.contains('is-modal-open')
      && !sidebar.contains(event.target) && !brand.contains(event.target)) toggle(false);
  });
  document.addEventListener('keydown', (event) => {
    if (!opened || !media.matches || document.body.classList.contains('is-modal-open')) return;
    if (event.key === 'Escape') { toggle(false); event.preventDefault(); }
    if (event.key === 'Tab') {
      const items = [brand, ...sidebar.querySelectorAll('a[href],button:not(:disabled)')].filter((el) => el.getClientRects().length);
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
      if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
    }
  });
  media.addEventListener('change', () => toggle(!media.matches));
  toggle(!media.matches);
}
