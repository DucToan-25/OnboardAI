import { initTablePage } from '../common/page-ui.js';
export async function initPage({ currentUser }) {
  if (currentUser.role === 'mentor') {
    document.querySelector('[data-region="library-actions"]').replaceChildren();
    for (const row of document.querySelectorAll('[data-region="document-rows"] tr')) {
      if (row.querySelector('.badge')?.textContent.trim() !== 'Đã phát hành') row.remove();
      else row.querySelectorAll('button').forEach(button => button.remove());
    }
  }
  document.querySelector('[data-region="document-count"]').textContent = document.querySelectorAll('[data-region="document-rows"] tr').length + ' tài liệu';
  initTablePage({
    "prefix": "document",
    "template": "open-document-form",
    "stateRegion": "library-state",
    "summaryRegion": "document-count",
    "columns": {
      "title": 0,
      "category": 1,
      "status": 2
    }
  });
}
