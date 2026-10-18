import { bindFilters } from '../common/page-ui.js';
export async function initPage() {
  const region = name => document.querySelector('[data-region="' + name + '"]');
  bindFilters({ form: region('document-filters'), items: region('documents').children, state: region('library-state'), summary: region('document-count'), noun: 'tài liệu' });
}
