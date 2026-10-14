// JSON là nội dung công ty. localStorage chỉ lưu lựa chọn của người xem.
const STORAGE_KEY = 'onvera-midterm-preferences';

export function defaultSettings() {
  return { search: '', category: 'all', sort: 'newest', page: 1, readIds: [], savedIds: [], interestedIds: [] };
}

export async function loadData() {
  const response = await fetch(new URL('../assets/data/seed.json', import.meta.url));
  if (!response.ok) throw new Error('Không tải được dữ liệu. Hãy chạy trang bằng Live Server rồi thử lại.');
  const data = await response.json();
  if (!Array.isArray(data.portalPosts) || !data.organization) throw new Error('Kiểm tra lại cấu trúc file seed.json.');
  data.portalPosts = data.portalPosts.filter((post) => post.status === 'published' && post.visibility === 'public');
  return data;
}

export function loadSettings(posts) {
  const settings = defaultSettings();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return settings;
    if (typeof saved.search === 'string') settings.search = saved.search.slice(0, 200);
    if (['all', 'company', 'internal', 'event'].includes(saved.category)) settings.category = saved.category;
    if (['newest', 'oldest'].includes(saved.sort)) settings.sort = saved.sort;
    if (Number.isInteger(saved.page) && saved.page > 0) settings.page = saved.page;
    for (const field of ['readIds', 'savedIds', 'interestedIds']) {
      if (Array.isArray(saved[field])) {
        // Bỏ ID không còn trong dữ liệu; danh sách quan tâm chỉ nhận sự kiện.
        settings[field] = saved[field].filter((id, index, ids) => ids.indexOf(id) === index
          && posts.some((post) => post.id === id && (field !== 'interestedIds' || post.kind === 'event')));
      }
    }
  } catch {
    // JSON lưu bị hỏng hoặc trình duyệt chặn localStorage: dùng mặc định.
  }
  return settings;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false; // UI vẫn dùng được, nhưng lựa chọn không được lưu sau khi tải lại.
  }
}
