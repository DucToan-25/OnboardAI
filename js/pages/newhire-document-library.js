import { createDocumentCard } from '../common/renderers.js';

export async function initPage({ repository, ui }) {
  const root = document.querySelector('#main-content');
  const filters = root.querySelector('[data-region="document-filters"]');
  const list = root.querySelector('[data-region="documents"]');
  const state = root.querySelector('[data-region="library-state"]');
  const count = root.querySelector('[data-region="document-count"]');
  let documents = [];
  function render() {
    const search = filters.elements.search.value.trim().toLocaleLowerCase('vi');
    const category = filters.elements.category.value;
    const matches = documents.filter((record) => (!category || record.category === category) && record.title.toLocaleLowerCase('vi').includes(search));
    list.replaceChildren(...matches.map((record) => createDocumentCard(record)));
    ui.setViewState(state, { status: matches.length ? 'ready' : 'empty', message: documents.length ? 'Không có tài liệu phù hợp. Hãy thử tên hoặc chủ đề khác.' : 'Chưa có tài liệu được phát hành trong phạm vi của bạn.' });
    count.textContent = `${matches.length} tài liệu`;
  }
  async function loadData() {
    ui.setViewState(state, { status: 'loading', message: 'Đang tải thư viện tài liệu…' });
    try {
      documents = (await repository.list('documents', { status: 'published' })).items;
      filters.elements.category.replaceChildren(new Option('Tất cả chủ đề', ''), ...[...new Set(documents.map((record) => record.category))].map((category) => new Option(category, category)));
      render();
    } catch (error) {
      ui.setViewState(state, { status: 'error', message: error.message || 'Không thể tải thư viện.' });
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true }); state.append(retry);
    }
  }
  filters.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  filters.elements.search.addEventListener('input', render);
  filters.elements.category.addEventListener('change', render);
  await loadData();
}
