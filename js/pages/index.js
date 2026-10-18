import { getCompanyInfo, getPublishedNews } from '../data/organization.js';
import { watchData } from '../common/data-ui.js';
import { formatDateTime } from '../common/format.js';
const INFO = {
  about: ['Về Onvera', 'Cổng thông tin Onvera kết nối tin tức, thông báo và hoạt động dành cho hành trình hội nhập của bạn.'],
  contact: ['Liên hệ Phòng Nhân sự', 'Nếu chưa có tài khoản hoặc cần hỗ trợ truy cập, hãy liên hệ cán bộ Nhân sự phụ trách tiếp nhận bạn qua kênh liên lạc đã được cung cấp. Thông tin liên hệ chính thức sẽ được cập nhật tại đây.'],
  faq: ['Câu hỏi thường gặp', 'Làm sao để đăng nhập?\nChọn Đăng nhập để mở trang đăng nhập chung. Dùng email và mật khẩu của tài khoản được cấp.\n\nChưa có tài khoản?\nLiên hệ cán bộ Nhân sự phụ trách tiếp nhận.\n\nTại sao một số nội dung cần đăng nhập?\nĐó là nội dung dành cho nhân viên. Phần chi tiết và đăng ký sự kiện sẽ được kết nối trong đợt nghiệp vụ.'],
  privacy: ['Chính sách bảo mật', 'Chính sách bảo mật chính thức chưa được cung cấp. Nội dung sẽ được cập nhật sau khi đơn vị phụ trách phê duyệt.'],
  terms: ['Điều khoản sử dụng', 'Điều khoản sử dụng chính thức chưa được cung cấp. Nội dung sẽ được cập nhật sau khi đơn vị phụ trách phê duyệt.'],
};

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


export async function initPage({ ui }) {
  initSectionNavigation();
  const region = name => document.querySelector('[data-region="' + name + '"]');
  const search = document.querySelector('#news-search'); const sort = document.querySelector('#news-sort');
  const articleTemplate = region('news').querySelector('article').cloneNode(true);
  const noticeTemplate = region('notices').querySelector('article').cloneNode(true);
  const eventTemplate = region('events').querySelector('article').cloneNode(true);
  const filters = document.querySelector('.index__filters') || document.querySelector('[data-action="filter"]').parentElement;
  let category = ''; let page = 1; const pageSize = 6;
  function article(post, template) {
    const node = template.cloneNode(true); node.dataset.id = post.id;
    node.dataset.category = post.category;
    for (const button of node.querySelectorAll('[data-action="open-post"]')) {
      button.dataset.id = post.id;
      if (button.closest('h3')) button.textContent = post.title;
      else button.setAttribute('aria-label', 'Đọc ' + post.title);
    }
    const description = node.querySelector('p'); if (description) description.textContent = post.summary || '';
    const caption = node.querySelector('.index__caption'); if (caption) caption.textContent = formatDateTime(post.publishedAt);
    const eyebrow = node.querySelector('.index__eyebrow'); if (eyebrow) eyebrow.textContent = post.category;
    // Seed has publication time, not event scheduling data.
    node.querySelectorAll('time, .index__event-date, .index__event-meta').forEach(item => item.remove());
    return node;
  }
  function render() {
    const posts = getPublishedNews();
    const companySection = document.querySelector('.index__welcome > div');
    try {
      const company = getCompanyInfo();
      companySection.querySelector('h2').textContent = 'Chào mừng đến với ' + company.companyName;
      companySection.querySelector('p').textContent = company.mission || 'Chưa cập nhật sứ mệnh.';
    } catch (error) {
      companySection.querySelector('h2').textContent = 'Thông tin công ty';
      companySection.querySelector('p').textContent = error.message;
    }
    const categories = [...new Set(posts.map(item => item.category))];
    if (category && !categories.includes(category)) category = '';
    filters.replaceChildren(...['', ...categories].map(value => {
      const button = element('button', 'btn btn--sm ' + (value === category ? 'btn--primary is-active' : 'btn--secondary'), value || 'Tất cả');
      button.type = 'button'; button.dataset.action = 'filter'; button.dataset.category = value;
      button.setAttribute('aria-pressed', String(value === category)); return button;
    }));
    const notices = posts.filter(item => item.category === 'Thông báo');
    const events = posts.filter(item => item.category === 'Sự kiện');
    for (const [name, items, template] of [['notices', notices, noticeTemplate], ['events', events, eventTemplate], ['upcoming', events, eventTemplate]]) {
      region(name).replaceChildren(...items.slice(0, 3).map(item => article(item, template)));
      if (!items.length) region(name).append(element('p', 'index__muted', 'Chưa có nội dung đã xuất bản.'));
    }
    region('notice-count').textContent = notices.length + ' bài';
    region('event-count').textContent = events.length + ' sự kiện';
    const query = search.value.trim().toLocaleLowerCase('vi');
    const visible = posts.filter(item => (!category || category === item.category) && (item.title + ' ' + item.summary).toLocaleLowerCase('vi').includes(query));
    if (sort.value === 'oldest') visible.reverse();
    const pages = Math.max(1, Math.ceil(visible.length / pageSize)); page = Math.min(page, pages);
    region('news').replaceChildren(...visible.slice((page - 1) * pageSize, page * pageSize).map(item => article(item, articleTemplate)));
    if (!visible.length) region('news').append(element('p', 'index__muted', 'Không tìm thấy tin tức phù hợp.'));
    region('news-summary').textContent = visible.length + ' bài viết · Trang ' + page + '/' + pages;
    region('pagination').replaceChildren(...Array.from({ length: pages }, (_, index) => {
      const button = element('button', 'btn btn--sm pagination__button btn--' + (index + 1 === page ? 'primary' : 'secondary'), index + 1);
      button.type = 'button'; button.dataset.action = 'news-page'; button.dataset.page = index + 1;
      if (index + 1 === page) button.setAttribute('aria-current', 'page'); return button;
    }));
    region('pagination').hidden = !visible.length;
  }
  const refresh = watchData(['news', 'companyInfo'], render);
  search.addEventListener('input', () => { page = 1; refresh(); });
  sort.addEventListener('change', () => { page = 1; refresh(); });
  region('header-search').addEventListener('submit', event => {
    event.preventDefault(); search.value = event.currentTarget.elements.search.value;
    category = ''; page = 1; refresh(); search.scrollIntoView({ block: 'center' }); search.focus();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.info && INFO[button.dataset.info]) {
      const [title, text] = INFO[button.dataset.info]; ui.openModal({ title, content: element('p', 'index__detail', text) });
    }
    const action = button.dataset.action;
    if (action === 'filter') { category = button.dataset.category; page = 1; refresh(); }
    if (action === 'all-news') { category = ''; search.value = ''; page = 1; refresh(); search.focus(); }
    if (action === 'news-page') { page = Number(button.dataset.page); refresh(); document.querySelector('#news').scrollIntoView(); }
    if (action === 'open-post') {
      const post = getPublishedNews().find(item => item.id === button.dataset.id);
      if (!post) { ui.showToast({ message: 'Bài viết không còn được xuất bản.', type: 'error' }); return; }
      ui.openModal({ title: post.title, content: element('p', 'index__detail', post.content || post.summary) });
    }
    if (['all-notices', 'calendar'].includes(action)) {
      const content = element('div');
      const posts = getPublishedNews().filter(item => item.category === (action === 'calendar' ? 'Sự kiện' : 'Thông báo'));
      content.append(...posts.map(item => article(item, action === 'calendar' ? eventTemplate : noticeTemplate)));
      if (!posts.length) content.append(element('p', '', 'Chưa có nội dung đã xuất bản.'));
      if (action === 'calendar') content.prepend(element('p', 'index__muted', 'Dữ liệu hiện chỉ có bài viết sự kiện, chưa có lịch đăng ký.'));
      ui.openModal({ title: action === 'calendar' ? 'Sự kiện đã xuất bản' : 'Tất cả thông báo', content });
    }
  });
}
