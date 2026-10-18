import { initTablePage } from '../common/page-ui.js';
export async function initPage() {
  initTablePage({
    "prefix": "mentee",
    "stateRegion": "list-state"
  });
}
