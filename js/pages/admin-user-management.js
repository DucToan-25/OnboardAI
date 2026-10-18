import { initTablePage } from '../common/page-ui.js';
export async function initPage() {
  initTablePage({
    "prefix": "user",
    "template": "open-user-form",
    "columns": {
    "fullName": 0,
    "email": [0, ".admin-users__meta"],
      "role": 1,
      "departmentId": 2,
      "status": 3
    }
  });
}
