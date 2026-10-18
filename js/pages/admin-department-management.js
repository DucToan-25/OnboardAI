import { initTablePage } from '../common/page-ui.js';
export async function initPage() {
  initTablePage({
    "prefix": "department",
    "template": "open-department-form",
    "columns": {
      "name": 0,
      "description": 1,
      "status": 3
    }
  });
}
