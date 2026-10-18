const INFO = {
  about: ['Về Onvera', 'Cổng thông tin Onvera kết nối tin tức, thông báo và hoạt động dành cho hành trình hội nhập của bạn.'],
  contact: ['Liên hệ Phòng Nhân sự', 'Nếu chưa có tài khoản hoặc cần hỗ trợ truy cập, hãy liên hệ cán bộ Nhân sự phụ trách tiếp nhận bạn qua kênh liên lạc đã được cung cấp. Thông tin liên hệ chính thức sẽ được cập nhật tại đây.'],
  faq: ['Câu hỏi thường gặp', 'Làm sao để đăng nhập?\nChọn Đăng nhập để mở trang đăng nhập chung. Chức năng đăng nhập sẽ được kết nối sau.\n\nChưa có tài khoản?\nLiên hệ cán bộ Nhân sự phụ trách tiếp nhận.\n\nTại sao một số nội dung cần đăng nhập?\nĐó là nội dung dành cho nhân viên. Phần chi tiết và đăng ký sự kiện sẽ được kết nối trong đợt nghiệp vụ.'],
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
  const news = region('news');
  const articles = [...news.querySelectorAll('.index__article')];
  const search = document.querySelector('#news-search');
  const sort = document.querySelector('#news-sort');
  const empty = document.createElement('div'); news.append(empty);
  let category = 'all';
  function render() {
    const query = search.value.trim().toLocaleLowerCase('vi');
    let count = 0;
    const ordered = sort.value === 'oldest' ? [...articles].reverse() : articles;
    for (const article of ordered) {
      article.hidden = !(category === 'all' || article.dataset.category === category) || !article.textContent.toLocaleLowerCase('vi').includes(query);
      if (!article.hidden) count++;
      news.append(article);
    }
    ui.setViewState(empty, { status: count ? 'ready' : 'empty', message: 'Không tìm thấy tin tức phù hợp.' });
    region('news-summary').textContent = 'Hiển thị ' + count + ' trong ' + articles.length + ' bài viết';
    region('pagination').hidden = !count;
    for (const button of document.querySelectorAll('[data-action="filter"]')) {
      const active = button.dataset.category === category;
      button.classList.toggle('is-active', active); button.classList.toggle('btn--primary', active); button.classList.toggle('btn--secondary', !active); button.setAttribute('aria-pressed', String(active));
    }
  }
  search.addEventListener('input', render); sort.addEventListener('change', render);
  region('header-search').addEventListener('submit', event => {
    event.preventDefault(); search.value = event.currentTarget.elements.search.value;
    category = 'all'; render(); search.scrollIntoView({ block: 'center' }); search.focus();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.info && INFO[button.dataset.info]) {
      const [title, text] = INFO[button.dataset.info]; ui.openModal({ title, content: element('p', 'index__detail', text) });
    }
    const action = button.dataset.action;
    if (action === 'filter') { category = button.dataset.category; render(); }
    if (action === 'all-news') { category = 'all'; search.value = ''; render(); search.focus(); }
    if (action === 'open-post') {
      const article = button.closest('article');
      const content = document.createElement('div'); content.className = 'index__detail';
      const description = article.querySelector('p');
      if (description) content.append(description.cloneNode(true));
      content.append(element('p', '', 'Nội dung chi tiết sẽ được cập nhật sau.'));
      ui.openModal({ title: article.querySelector('h3').textContent.trim(), content });
    }
    if (['all-notices','calendar'].includes(action)) {
      const content = region(action === 'calendar' ? 'events' : 'notices').cloneNode(true);
      content.removeAttribute('data-region');
      ui.openModal({ title: action === 'calendar' ? 'Lịch sự kiện' : 'Tất cả thông báo', content });
    }
    if (button.closest('[data-region="pagination"]')) document.querySelector('#news').scrollIntoView();
  });
}
