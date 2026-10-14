import { loadData, loadSettings, saveSettings, defaultSettings } from './data.js';
import { node, openModal, showMessage } from './ui.js';

// 1. Biến dữ liệu và trạng thái: chỉ phục vụ một trang tin công ty.
const PAGE_SIZE = 3;
const CATEGORIES = { company: 'Doanh nghiệp', internal: 'Nội bộ', event: 'Sự kiện' };
// Để trống khi nộp trang độc lập. Có thể điền URL cổng nhân viên của nhóm.
const EMPLOYEE_PORTAL_URL = '';
const region = (name) => document.querySelector(`[data-region="${name}"]`);
const searchInput = document.querySelector('#news-search');
const sortInput = document.querySelector('#news-sort');
const dialog = document.querySelector('#modal-root');
let posts = [];
let company = {};
let settings = defaultSettings();
let calendarFilter = 'upcoming';

function button(text, action, id = '') {
  const item = node('button', 'btn btn--secondary btn--sm', text);
  item.type = 'button';
  item.dataset.action = action;
  item.dataset.id = id;
  return item;
}

function formatDate(value, withTime = false) {
  const options = { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' };
  if (withTime) { options.hour = '2-digit'; options.minute = '2-digit'; }
  return new Date(value).toLocaleString('vi-VN', options);
}

function upcoming(post) {
  return new Date(post.startsAt).getTime() >= Date.now();
}

function searchText(text) {
  // Đưa chữ về dạng thường, bỏ dấu để "hoi nhap" tìm được "Hội nhập".
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function persist() {
  const saved = saveSettings(settings);
  region('storage-status').textContent = saved
    ? 'Lựa chọn đã được lưu trên trình duyệt này.'
    : 'Không lưu được trên trình duyệt. Lựa chọn chỉ được giữ trong lần mở này.';
  return saved;
}

// 2. Render: lấy dữ liệu trong mảng rồi điền vào template HTML bằng textContent.
function renderList(root, records) {
  root.replaceChildren();
  if (!records.length) root.append(node('p', 'index__muted', 'Chưa có nội dung trong danh sách này.'));
  for (const post of records) {
    const row = document.querySelector('#post-template').content.cloneNode(true);
    const title = row.querySelector('button');
    title.textContent = post.title;
    title.dataset.id = post.id;
    let meta = `${formatDate(post.publishedAt)} · ${post.publisher}`;
    if (post.kind === 'event') {
      meta = `${formatDate(post.startsAt, true)} · ${post.location} · ${upcoming(post) ? 'Sắp diễn ra' : 'Đã diễn ra'}`;
    } else if (post.kind === 'notice') {
      meta += settings.readIds.includes(post.id) ? ' · Đã đọc' : ' · Chưa đọc';
    }
    row.querySelector('p').textContent = meta;
    root.append(row);
  }
}

function renderNews() {
  const query = searchText(settings.search.trim());
  const news = posts.filter((post) => post.kind === 'news'
    && (settings.category === 'all' || post.category === settings.category)
    && searchText(post.title + ' ' + post.summary).includes(query));
  news.sort((a, b) => settings.sort === 'newest'
    ? b.publishedAt.localeCompare(a.publishedAt) : a.publishedAt.localeCompare(b.publishedAt));
  const totalPages = Math.ceil(news.length / PAGE_SIZE);
  settings.page = Math.max(1, Math.min(settings.page, totalPages || 1));
  const start = (settings.page - 1) * PAGE_SIZE;
  const visible = news.slice(start, start + PAGE_SIZE);
  region('news').replaceChildren();
  if (!visible.length) region('news').append(node('p', 'index__muted', 'Không có tin phù hợp. Hãy thử từ khóa khác hoặc bỏ bộ lọc.'));
  for (const post of visible) {
    const card = document.querySelector('#news-template').content.cloneNode(true);
    card.querySelector('.index__eyebrow').textContent = CATEGORIES[post.category];
    card.querySelector('.index__article-title').textContent = post.title;
    card.querySelector('.index__summary').textContent = post.summary;
    card.querySelector('.index__meta').textContent = `${formatDate(post.publishedAt)} · ${post.readMinutes} phút đọc`;
    card.querySelector('.index__read-state').textContent = settings.readIds.includes(post.id) ? 'Đã đọc' : '';
    for (const item of card.querySelectorAll('button')) item.dataset.id = post.id;
    const save = card.querySelector('[data-action="save-post"]');
    const saved = settings.savedIds.includes(post.id);
    save.textContent = saved ? 'Đã lưu' : 'Lưu bài';
    save.setAttribute('aria-pressed', String(saved));
    region('news').append(card);
  }
  region('news-summary').textContent = news.length
    ? `Bài ${start + 1}–${start + visible.length} / ${news.length} · Trang ${settings.page}/${totalPages}` : '0 bài viết';
  region('pagination').replaceChildren();
  for (let page = 1; page <= totalPages; page++) {
    const item = button(String(page), 'news-page', String(page));
    if (page === settings.page) {
      item.classList.replace('btn--secondary', 'btn--primary');
      item.setAttribute('aria-current', 'page');
    }
    item.setAttribute('aria-label', `Trang ${page}`);
    region('pagination').append(item);
  }
  for (const item of document.querySelectorAll('[data-action="filter"]')) {
    const active = item.dataset.category === settings.category;
    item.classList.toggle('btn--primary', active);
    item.classList.toggle('btn--secondary', !active);
    item.setAttribute('aria-pressed', String(active));
  }
}

function renderOverview() {
  const notices = posts.filter((post) => post.kind === 'notice')
    .sort((a, b) => Number(b.important) - Number(a.important) || b.publishedAt.localeCompare(a.publishedAt));
  const events = posts.filter((post) => post.kind === 'event' && upcoming(post))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  renderList(region('notices'), notices.slice(0, 3));
  renderList(region('events'), events.slice(0, 2));
  renderList(region('upcoming'), events.slice(0, 2));
  region('notice-count').textContent = notices.filter((post) => !settings.readIds.includes(post.id)).length;
  region('event-count').textContent = events.length;
  region('saved-count').textContent = settings.savedIds.length + settings.interestedIds.length;
}

function renderPage() {
  renderNews();
  renderOverview();
}

function updateFilters() {
  settings.search = searchInput.value;
  settings.sort = sortInput.value;
  region('header-search').elements.search.value = settings.search;
  renderNews();
  persist();
}

// 3. Modal: một hộp thoại dùng lại; không có stack modal hay hệ đăng nhập riêng.
function showPost(id) {
  const post = posts.find((item) => item.id === id);
  if (!post) { showMessage('Bài viết không tồn tại hoặc không còn công khai.'); return; }
  if (!settings.readIds.includes(id)) settings.readIds.push(id);
  persist();
  renderPage();
  const content = node('div', 'index__detail', '');
  content.append(node('p', 'index__muted', `${post.publisher} · ${formatDate(post.publishedAt)}`),
    node('p', '', post.summary));
  if (post.kind === 'event') content.append(node('p', 'alert alert--info',
    `${formatDate(post.startsAt, true)} (giờ Việt Nam) · ${post.location} · ${upcoming(post) ? 'Sắp diễn ra' : 'Đã diễn ra'}`));
  if (post.requiresLogin) {
    content.append(node('p', '', 'Đây là phần giới thiệu công khai. Nội dung dành cho nhân viên cần được xem trong cổng nội bộ.'),
      button('Thông tin truy cập nội bộ', 'employee-access'));
  } else {
    content.append(node('p', '', post.content || 'Nội dung đang được cập nhật.'));
  }
  const controls = node('div', 'index__article-actions', '');
  const save = button(settings.savedIds.includes(id) ? 'Bỏ lưu bài' : 'Lưu bài', 'save-post', id);
  save.setAttribute('aria-pressed', String(settings.savedIds.includes(id)));
  controls.append(save);
  if (post.kind === 'event') {
    const interested = settings.interestedIds.includes(id);
    const interest = button(interested ? 'Bỏ quan tâm' : 'Quan tâm sự kiện', 'interest-event', id);
    interest.setAttribute('aria-pressed', String(interested));
    interest.disabled = !upcoming(post) && !interested;
    controls.append(interest);
    content.append(node('p', 'index__muted', 'Quan tâm chỉ lưu trên trình duyệt, không đăng ký tham dự hoặc gửi nhắc lịch.'));
  }
  content.append(controls);
  openModal(post.title, content, 'post');
}

function showSaved() {
  const content = node('div', 'index__detail', '');
  for (const [field, title] of [['savedIds', 'Bài đã lưu'], ['interestedIds', 'Sự kiện quan tâm']]) {
    content.append(node('h3', '', title));
    const list = node('div', '', '');
    const records = posts.filter((post) => settings[field].includes(post.id));
    if (!records.length) list.append(node('p', 'index__muted', 'Chưa có mục nào.'));
    for (const post of records) {
      const row = node('div', 'index__saved-row', '');
      row.append(button(post.title, 'open-post', post.id),
        button('Bỏ lưu', field === 'savedIds' ? 'save-post' : 'interest-event', post.id));
      list.append(row);
    }
    content.append(list);
  }
  content.append(button('Xóa dữ liệu của tôi', 'reset-preferences'));
  openModal('Đã lưu & quan tâm', content, 'saved');
}

function showCalendar() {
  const content = node('div', 'index__detail', '');
  const filters = node('div', 'toolbar__actions', '');
  for (const [value, label] of [['upcoming', 'Sắp diễn ra'], ['past', 'Đã diễn ra'], ['all', 'Tất cả']]) {
    const item = button(label, 'calendar-filter', value);
    item.setAttribute('aria-pressed', String(value === calendarFilter));
    filters.append(item);
  }
  const events = posts.filter((post) => post.kind === 'event'
    && (calendarFilter === 'all' || (calendarFilter === 'upcoming' ? upcoming(post) : !upcoming(post))))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const list = node('div', '', '');
  renderList(list, events);
  content.append(node('p', 'index__muted', 'Lịch minh họa · giờ Việt Nam. Chọn sự kiện để đọc chi tiết.'), filters, list);
  openModal('Lịch hoạt động Onvera', content, 'calendar');
}

function showEmployeeAccess() {
  const content = node('div', 'index__detail', 'OnboardAI có cổng nội bộ dành cho Nhân sự mới, Mentor, HR và Admin. Bài giữa kỳ này chỉ thực hiện trang thông tin công khai, chưa triển khai đăng nhập.');
  if (EMPLOYEE_PORTAL_URL) {
    const link = node('a', 'btn btn--primary', 'Mở cổng nhân viên');
    link.href = EMPLOYEE_PORTAL_URL;
    content.append(link);
  } else {
    content.append(node('p', '', 'Nếu cần tài khoản, hãy liên hệ cán bộ Nhân sự phụ trách tiếp nhận.'));
  }
  openModal('Thông tin cổng nhân viên', content);
}

// 4. Sự kiện: đọc data-action của nút, cập nhật mảng/trạng thái rồi render lại.
function toggleItem(field, id, clickedButton) {
  const post = posts.find((item) => item.id === id);
  if (!post) return;
  const enabled = !settings[field].includes(id);
  if (field === 'interestedIds' && enabled && !upcoming(post)) {
    showMessage('Sự kiện đã diễn ra. Bạn vẫn có thể đọc lại nội dung.');
    return;
  }
  if (enabled) settings[field].push(id);
  else settings[field] = settings[field].filter((item) => item !== id);
  const saved = persist();
  renderPage();
  if (dialog.open && dialog.dataset.view === 'saved') showSaved();
  else if (dialog.open && dialog.dataset.view === 'post') {
    clickedButton.textContent = field === 'savedIds'
      ? (enabled ? 'Bỏ lưu bài' : 'Lưu bài') : (enabled ? 'Bỏ quan tâm' : 'Quan tâm sự kiện');
    clickedButton.setAttribute('aria-pressed', String(enabled));
    clickedButton.disabled = field === 'interestedIds' && !enabled && !upcoming(post);
  } else {
    // Danh sách vừa render nên nút cũ đã bị thay; trả focus về nút tương ứng.
    const replacement = document.querySelector(`[data-action="save-post"][data-id="${id}"]`);
    if (replacement) replacement.focus({ preventScroll: true });
  }
  showMessage(saved ? 'Đã cập nhật lựa chọn trên trình duyệt này.' : 'Chỉ giữ lựa chọn trong lần mở này vì không ghi được localStorage.');
}

function handleClick(event) {
  const item = event.target.closest('button[data-action], button[data-info]');
  if (!item) return;
  const id = item.dataset.id;
  if (item.dataset.info) {
    const info = company.info[item.dataset.info];
    if (info) openModal(info.title, node('p', 'index__detail', info.content));
    return;
  }
  switch (item.dataset.action) {
    case 'open-post': showPost(id); break;
    case 'save-post': toggleItem('savedIds', id, item); break;
    case 'interest-event': toggleItem('interestedIds', id, item); break;
    case 'saved-items': showSaved(); break;
    case 'calendar': calendarFilter = 'upcoming'; showCalendar(); break;
    case 'calendar-filter': calendarFilter = id; showCalendar(); break;
    case 'employee-access': showEmployeeAccess(); break;
    case 'all-notices': {
      const content = node('div', '', '');
      renderList(content, posts.filter((post) => post.kind === 'notice').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
      openModal('Tất cả thông báo', content);
      break;
    }
    case 'filter': settings.category = item.dataset.category; settings.page = 1; updateFilters(); break;
    case 'news-page':
      settings.page = Number(id); updateFilters();
      document.querySelector('#news').scrollIntoView();
      region('pagination').querySelector('[aria-current]').focus({ preventScroll: true });
      break;
    case 'all-news':
      searchInput.value = ''; sortInput.value = 'newest';
      settings.category = 'all'; settings.page = 1; updateFilters(); searchInput.focus();
      break;
    case 'reset-preferences':
      if (window.confirm('Xóa lịch sử đọc, bài đã lưu, sự kiện quan tâm và bộ lọc trên trình duyệt này?')) {
        settings = defaultSettings(); searchInput.value = ''; sortInput.value = 'newest';
        region('header-search').elements.search.value = '';
        persist(); renderPage(); showSaved();
      }
      break;
  }
}

// 5. Khởi tạo: tải JSON → đọc localStorage → render → gắn các sự kiện một lần.
async function init() {
  try {
    const data = await loadData();
    posts = data.portalPosts;
    company = data.organization;
    settings = loadSettings(posts);
    searchInput.value = settings.search;
    sortInput.value = settings.sort;
    region('header-search').elements.search.value = settings.search;
    region('company-description').textContent = company.description;
    for (const step of company.onboardingSteps) region('onboarding-steps').append(node('li', '', step));
    renderPage();
    persist();
    document.addEventListener('click', handleClick);
    searchInput.addEventListener('input', () => { settings.page = 1; updateFilters(); });
    sortInput.addEventListener('change', () => { settings.page = 1; updateFilters(); });
    region('header-search').addEventListener('submit', (event) => {
      event.preventDefault();
      searchInput.value = event.currentTarget.elements.search.value;
      settings.category = 'all'; settings.page = 1; updateFilters();
      searchInput.scrollIntoView({ block: 'center' }); searchInput.focus();
    });
    // Menu dùng liên kết #section; cập nhật trạng thái theo mục vừa chọn.
    const navLinks = document.querySelectorAll('[data-region="section-nav"] a');
    for (const link of navLinks) link.addEventListener('click', () => {
      for (const other of navLinks) {
        other.classList.remove('is-active'); other.removeAttribute('aria-current');
      }
      link.classList.add('is-active'); link.setAttribute('aria-current', 'location');
    });
    const requested = new URLSearchParams(location.search).get('post');
    if (requested) showPost(requested);
    document.body.dataset.ready = 'true';
  } catch (error) {
    document.querySelector('#load-error').hidden = false;
    document.querySelector('#load-error-message').textContent = error.message;
    for (const name of ['news', 'notices', 'events', 'upcoming']) region(name).textContent = 'Chưa tải được dữ liệu.';
    document.querySelector('#retry-load').addEventListener('click', () => location.reload());
    document.body.dataset.ready = 'error';
  }
}

init();
