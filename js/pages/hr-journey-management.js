import { initTablePage } from '../common/page-ui.js';
export async function initPage() {
  initTablePage({
    "prefix": "journey",
    "template": "open-journey-form",
    "columns": {
      "name": 0,
      "departmentId": 1,
      "status": 4
    }
  });
}
