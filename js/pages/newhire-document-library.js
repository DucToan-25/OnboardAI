import { getReadableDocuments } from '../data/resources.js';
import { createDocumentCard } from '../common/renderers.js';
import { watchData } from '../common/data-ui.js';

export async function initPage({ ui }) {
  const region = name => document.querySelector(`[data-region="${name}"]`);
  const form = region('document-filters');
  function render() {
    const documents = getReadableDocuments();
    const selected = form.elements.category.value;
    form.elements.category.replaceChildren(new Option('Tất cả danh mục', ''), ...[...new Set(documents.map(item => item.category))].map(category => new Option(category, category)))
    form.elements.category.value = selected;
    const query = form.elements.search.value.trim().toLocaleLowerCase('vi');
    const visible = documents.filter(item => (!form.elements.category.value || item.category === form.elements.category.value) && `${item.title} ${item.description}`.toLocaleLowerCase('vi').includes(query))
      .sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    region('documents').replaceChildren(...visible.map(createDocumentCard));
    region('document-count').textContent = `${visible.length} / ${documents.length} tài liệu`;
    ui.setViewState(region('library-state'), { status: visible.length ? 'ready' : 'empty', message: 'Chưa có tài liệu phù hợp.' });
  }
  const refresh = watchData(['documents', 'users'], render, region('library-state'));
  form.addEventListener('submit', event => { event.preventDefault(); refresh(); });
  form.addEventListener('input', refresh); form.addEventListener('change', refresh);
}
