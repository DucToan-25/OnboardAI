import { createIcon } from '../common/renderers.js';
import { formatDate, getTodayDate, formatDateTime } from '../common/format.js';
import { isSafeUrl } from '../common/validation.js';

const CATEGORIES = { company: 'Doanh nghiệp', internal: 'Nội bộ', event: 'Sự kiện' };
const INFO = {
  about: ['Về Onvera', 'Cổng thông tin Onvera kết nối tin tức, thông báo và hoạt động dành cho hành trình hội nhập của bạn.'],
  contact: ['Liên hệ Phòng Nhân sự', 'Nếu chưa có tài khoản hoặc cần hỗ trợ truy cập, hãy liên hệ cán bộ Nhân sự phụ trách tiếp nhận bạn qua kênh liên lạc đã được cung cấp. Thông tin liên hệ chính thức sẽ được cập nhật tại đây.'],
  faq: ['Câu hỏi thường gặp', 'Làm sao để đăng nhập?\nChọn Đăng nhập để mở trang đăng nhập chung. Bản giao diện hiện tại cho phép chọn tài khoản demo.\n\nChưa có tài khoản?\nLiên hệ cán bộ Nhân sự phụ trách tiếp nhận.\n\nTại sao một số nội dung cần đăng nhập?\nĐó là nội dung dành cho nhân viên. Phần chi tiết và đăng ký sự kiện sẽ được kết nối trong đợt nghiệp vụ.'],
  privacy: ['Chính sách bảo mật', 'Chính sách bảo mật chính thức chưa được cung cấp. Nội dung sẽ được cập nhật sau khi đơn vị phụ trách phê duyệt.'],
  terms: ['Điều khoản sử dụng', 'Điều khoản sử dụng chính thức chưa được cung cấp. Nội dung sẽ được cập nhật sau khi đơn vị phụ trách phê duyệt.'],
};
const PAGE_SIZE = 3;

function initSectionNavigation() {
  const nav = document.querySelector('[data-region="section-nav"]');
  const entries = [...nav.querySelectorAll('a[href^="#"]')].map((link) => ({
    link, section: document.getElementById(link.hash.slice(1)),
  })).filter((entry) => entry.section);
  let active = entries.find((entry) => entry.link.hash === location.hash) || entries[0];
  let queued = false;

  function activate(entry) {
    active = entry;
    for (const item of entries) {
      item.link.classList.toggle('is-active', item === entry);
      if (item === entry) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    }
  }
  function update() {
    queued = false;
    const positions = entries.map((entry) => ({ entry, top: entry.section.getBoundingClientRect().top,
      offset: parseFloat(getComputedStyle(entry.section).scrollMarginTop) || 0 }));
    const passed = positions.filter((item) => item.top <= item.offset + 1);
    const latestTop = Math.max(...passed.map((item) => item.top));
    // Desktop notices and events share a row: preserve the selected one while both are visible.
    const candidates = passed.filter((item) => Math.abs(item.top - latestTop) < 2);
    activate(candidates.find((item) => item.entry === active)?.entry || candidates[0]?.entry || entries[0]);
  }
  function scheduleUpdate() {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }
  nav.addEventListener('click', (event) => {
    const entry = entries.find((item) => item.link === event.target.closest('a'));
    if (entry) { activate(entry); scheduleUpdate(); }
  });
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('hashchange', () => {
    const entry = entries.find((item) => item.link.hash === location.hash);
    if (entry) activate(entry);
    scheduleUpdate();
  });
  const resize = new ResizeObserver(scheduleUpdate);
  resize.observe(document.querySelector('#main-content'));
  resize.observe(document.querySelector('#app-header'));
  activate(active);
  scheduleUpdate();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function loginLink() {
  const link = element('a', 'index__gate', 'Đăng nhập để xem chi tiết và hoạt động nội bộ →');
  link.href = 'pages/login.html';
  return link;
}

export async function initPage({ repository, ui }) {
  initSectionNavigation();
  const region = (name) => document.querySelector(`[data-region="${name}"]`);
  const { items: posts } = await repository.list('portalPosts');
  const news = posts.filter((post) => post.kind === 'news');
  const notices = posts.filter((post) => post.kind === 'notice').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const events = posts.filter((post) => post.kind === 'event' && post.eventDate >= getTodayDate()).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const state = { search: '', category: 'all', sort: 'newest', page: 1 };
  const search = document.querySelector('#news-search');
  const sort = document.querySelector('#news-sort');

  function openPost(post) {
    const content = element('div', 'index__detail');
    content.append(element('p', 'index__muted', post.summary));
    if (post.requiresLogin) {
      content.append(element('p', '', 'Phần chi tiết nội bộ sẽ được kết nối trong đợt nghiệp vụ.'), loginLink());
    } else {
      content.append(element('p', '', post.content || 'Nội dung chi tiết đang được cập nhật.'));
    }
    ui.openModal({ title: post.title, content });
  }

  function postButton(post, className) {
    const button = element('button', `index__text-action ${className}`, post.title);
    button.type = 'button'; button.dataset.action = 'open-post'; button.dataset.id = post.id;
    button.addEventListener('click', () => openPost(post));
    return button;
  }

  function renderNotices(root, records) {
    root.replaceChildren();
    if (!records.length) { ui.setViewState(root, { status: 'empty', message: 'Chưa có thông báo mới.' }); return; }
    for (const post of records) {
      const row = element('article', 'index__notice');
      const meta = element('div', 'index__notice-meta');
      const date = element('time', 'index__muted index__caption', formatDate(post.publishedAt)); date.dateTime = post.publishedAt;
      meta.append(element('span', `badge badge--${post.important ? 'warning' : 'info'}`, post.label), date);
      const title = element('h3'); title.append(postButton(post, 'index__notice-title'));
      row.append(meta, title, post.requiresLogin ? loginLink() : element('p', 'index__muted index__caption', post.publisher));
      root.append(row);
    }
  }

  function renderEvents(root, records) {
    root.replaceChildren();
    if (!records.length) { ui.setViewState(root, { status: 'empty', message: 'Chưa có sự kiện sắp tới.' }); return; }
    for (const post of records) {
      const row = element('article', 'index__event');
      const date = element('time', 'index__event-date'); date.dateTime = post.eventDate;
      const [, month, day] = post.eventDate.split('-');
      date.append(element('strong', '', day), element('span', '', `THÁNG ${Number(month)}`));
      const body = element('div');
      const title = element('h3'); title.append(postButton(post, 'index__event-title'));
      body.append(title, element('p', 'index__muted index__caption', `${formatDateTime(post.startsAt)} · ${post.location}`));
      row.append(date, body); root.append(row);
    }
    root.append(loginLink());
  }

  function renderNews() {
    const query = state.search.trim().toLocaleLowerCase('vi');
    const records = news.filter((post) => (state.category === 'all' || post.category === state.category)
      && `${post.title} ${post.summary}`.toLocaleLowerCase('vi').includes(query))
      .sort((a, b) => state.sort === 'newest' ? b.publishedAt.localeCompare(a.publishedAt) : a.publishedAt.localeCompare(b.publishedAt));
    const pages = Math.ceil(records.length / PAGE_SIZE);
    state.page = Math.max(1, Math.min(state.page, pages));
    const visible = records.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const root = region('news'); root.replaceChildren();
    // Keep the empty state in its own node so the card retains only component classes.
    if (!visible.length) {
      const empty = element('div');
      ui.setViewState(empty, { status: 'empty', message: news.length ? 'Không tìm thấy tin tức phù hợp. Hãy thử từ khóa hoặc danh mục khác.' : 'Chưa có tin tức được đăng.' });
      root.append(empty);
    }
    for (const post of visible) {
      const row = element('article', 'index__article'); row.dataset.id = post.id;
      const thumbnail = element('div', 'index__thumbnail'); thumbnail.setAttribute('aria-hidden', 'true'); thumbnail.append(createIcon('folder'));
      if (post.imageUrl && isSafeUrl(post.imageUrl, { allowRelative: true })) {
        const image = element('img', 'index__thumbnail'); image.src = post.imageUrl; image.alt = ''; image.loading = 'lazy';
        image.addEventListener('error', () => image.replaceWith(thumbnail), { once: true }); row.append(image);
      } else row.append(thumbnail);
      const body = element('div', 'index__article-body');
      const title = element('h3'); title.append(postButton(post, 'index__article-title'));
      body.append(element('span', 'index__eyebrow', CATEGORIES[post.category] || post.category), title,
        element('p', 'index__muted', post.summary), element('span', 'index__caption index__muted', `${formatDate(post.publishedAt)}${post.readMinutes ? ` · ${post.readMinutes} phút đọc` : ''}${post.requiresLogin ? ' · Chi tiết dành cho nhân viên' : ''}`));
      const open = element('button', 'btn btn--ghost btn--icon'); open.type = 'button'; open.setAttribute('aria-label', `Đọc ${post.title}`);
      open.dataset.action = 'open-post'; open.dataset.id = post.id; open.append(createIcon('arrow-right')); open.addEventListener('click', () => openPost(post));
      row.append(body, open); root.append(row);
    }
    region('news-summary').textContent = `Hiển thị ${visible.length} trong ${records.length} bài viết`;
    const pagination = region('pagination'); pagination.replaceChildren();
    for (let page = 1; page <= pages; page += 1) {
      const button = element('button', `btn btn--${page === state.page ? 'primary' : 'secondary'} btn--sm pagination__button`, String(page));
      button.type = 'button'; button.setAttribute('aria-label', `Trang ${page}`);
      if (page === state.page) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => { state.page = page; renderNews(); document.querySelector('#news').scrollIntoView(); region('pagination').querySelector('[aria-current]')?.focus({ preventScroll: true }); });
      pagination.append(button);
    }
    for (const button of document.querySelectorAll('[data-action="filter"]')) {
      const active = button.dataset.category === state.category;
      button.classList.toggle('is-active', active); button.classList.toggle('btn--primary', active); button.classList.toggle('btn--secondary', !active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  region('notice-count').textContent = `${notices.length} bài`;
  region('event-count').textContent = `${events.length} sự kiện`;
  renderNotices(region('notices'), notices.slice(0, 3));
  renderEvents(region('events'), events.slice(0, 2));
  renderEvents(region('upcoming'), events.slice(0, 2));
  renderNews();
  search.addEventListener('input', () => { state.search = search.value; state.page = 1; renderNews(); });
  sort.addEventListener('change', () => { state.sort = sort.value; state.page = 1; renderNews(); });
  region('header-search').addEventListener('submit', (event) => {
    event.preventDefault(); search.value = event.currentTarget.elements.search.value; state.search = search.value; state.category = 'all'; state.page = 1;
    renderNews(); search.scrollIntoView({ block: 'center' }); search.focus({ preventScroll: true });
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action],button[data-info]');
    if (!button) return;
    if (button.dataset.info && INFO[button.dataset.info]) {
      const [title, text] = INFO[button.dataset.info]; ui.openModal({ title, content: element('p', 'index__detail', text) });
    }
    if (button.dataset.action === 'filter') { state.category = button.dataset.category; state.page = 1; renderNews(); }
    if (button.dataset.action === 'all-news') {
      search.value = ''; state.search = ''; state.category = 'all'; state.page = 1; renderNews(); search.focus();
    }
    if (['all-notices', 'calendar'].includes(button.dataset.action)) {
      const content = element('div');
      const calendar = button.dataset.action === 'calendar';
      if (calendar) renderEvents(content, events); else renderNotices(content, notices);
      ui.openModal({ title: calendar ? 'Lịch sự kiện' : 'Tất cả thông báo', content });
    }
  });
}
