import * as organization from '../data/organization.js';
import { element, actionButton, createField, createStatusBadge } from './renderers.js';
import { bindForm } from './page-ui.js';
import { watchData, showError } from './data-ui.js';
import { openModal, confirmAction, showToast, setViewState } from './ui.js';
import { formatDateTime } from './format.js';

// Shared HR/Admin content editor; both pages call the same organization services.
export function initOrganizationManagement() {
  const parent = document.querySelector('#main-content .page-body');
  const companyCard = element('section', 'card');
  companyCard.append(element('h2', 'card__title', 'Thông tin công ty'));
  const companyForm = element('form', 'form'); companyForm.dataset.region = 'company-form';
  const companyFields = [['companyName', 'Tên công ty'], ['tagline', 'Khẩu hiệu'], ['mission', 'Sứ mệnh'], ['vision', 'Tầm nhìn'], ['coreValues', 'Giá trị cốt lõi'], ['about', 'Giới thiệu']];
  for (const [name, label] of companyFields) companyForm.append(createField({ name, label, type: ['companyName', 'tagline'].includes(name) ? 'text' : 'textarea', required: name === 'companyName' }));
  const save = element('button', 'btn btn--primary', 'Lưu thông tin công ty'); save.type = 'submit';
  const reset = element('button', 'btn btn--secondary', 'Hủy thay đổi'); reset.type = 'button';
  const actions = element('div', 'form__actions'); actions.append(save, reset); companyForm.append(actions);
  const companyState = element('div'); companyState.setAttribute('aria-live', 'polite'); companyCard.append(companyForm, companyState); parent.append(companyCard);
  let dirty = false;
  function loadCompany(force = false) {
    const company = organization.getCompanyInfo();
    if (dirty && !force) { setViewState(companyState, { status: 'empty', message: 'Thông tin công ty đã thay đổi. Bấm Hủy thay đổi để lấy bản mới nhất.' }); return; }
    for (const [name] of companyFields) companyForm.elements[name].value = company[name] || '';
    dirty = false; setViewState(companyState, { status: 'ready' });
  }
  companyForm.addEventListener('input', () => { dirty = true; }); reset.addEventListener('click', () => loadCompany(true));
  bindForm(companyForm, () => {
    organization.updateCompanyInfo(Object.fromEntries(new FormData(companyForm))); dirty = false; loadCompany();
    showToast({ message: 'Đã lưu thông tin công ty.', type: 'success' });
  });
  watchData(['companyInfo'], loadCompany, companyState);

  const newsCard = element('section', 'card'); const heading = element('div', 'card__header');
  heading.append(element('h2', 'card__title', 'Tin tức và thông báo'), actionButton('Tạo tin nháp', 'create-news', null, 'primary')); newsCard.append(heading);
  const filter = element('form', 'toolbar'); filter.append(createField({ name: 'search', label: 'Tìm tin tức', type: 'search' }), createField({ name: 'status', label: 'Trạng thái', type: 'select', options: [{ value: '', label: 'Tất cả' }, { value: 'draft', label: 'Bản nháp' }, { value: 'published', label: 'Đã xuất bản' }, { value: 'archived', label: 'Đã lưu trữ' }] }));
  newsCard.append(filter);
  const wrap = element('div', 'table-wrap'); const table = element('table', 'table'); const head = element('thead'); const header = element('tr');
  ['Tiêu đề', 'Trạng thái', 'Cập nhật', 'Thao tác'].forEach(text => { const th = element('th', '', text); th.scope = 'col'; header.append(th); }); head.append(header);
  const rows = element('tbody'); rows.dataset.region = 'news-rows'; table.append(head, rows); wrap.append(table); newsCard.append(wrap);
  const newsState = element('div'); newsState.setAttribute('aria-live', 'polite'); newsCard.append(newsState); parent.append(newsCard);
  let news = [];
  function renderNews() {
    news = organization.listNews(); const search = filter.elements.search.value.trim().toLowerCase(); const status = filter.elements.status.value;
    const visible = news.filter(item => (!status || item.status === status) && (!search || `${item.title} ${item.summary}`.toLowerCase().includes(search)));
    rows.replaceChildren(...visible.map(item => {
      const row = element('tr'); row.dataset.id = item.id; const statusCell = element('td'); statusCell.append(createStatusBadge('news', item.status));
      const buttons = element('td', 'table__actions'); buttons.append(actionButton('Sửa', 'edit-news', item.id));
      if (item.status === 'draft') buttons.append(actionButton('Xuất bản', 'publish-news', item.id, 'primary'));
      buttons.append(actionButton(item.status === 'archived' ? 'Khôi phục bản nháp' : 'Lưu trữ', item.status === 'archived' ? 'restore-news' : 'archive-news', item.id));
      row.append(element('td', '', item.title), statusCell, element('td', '', formatDateTime(item.updatedAt)), buttons); return row;
    }));
    setViewState(newsState, { status: visible.length ? 'ready' : 'empty', message: 'Không có tin phù hợp.' });
  }
  function editNews(item = null) {
    const form = element('form', 'form'); form.dataset.region = 'news-form';
    for (const [name, label] of [['title', 'Tiêu đề'], ['category', 'Chủ đề'], ['summary', 'Tóm tắt'], ['content', 'Nội dung']]) form.append(createField({ name, label, type: ['summary', 'content'].includes(name) ? 'textarea' : 'text', required: ['title', 'content'].includes(name), value: item?.[name] || '' }));
    form.append(createField({ name: 'isFeatured', label: 'Tin nổi bật', type: 'select', value: item?.isFeatured ? 'true' : 'false', options: [{ value: 'false', label: 'Không' }, { value: 'true', label: 'Có' }] }));
    const submit = element('button', 'btn btn--primary', item ? 'Lưu thay đổi' : 'Tạo bản nháp'); submit.type = 'submit'; form.append(submit);
    const modal = openModal({ title: item ? 'Sửa tin tức' : 'Tạo tin nháp', content: form });
    bindForm(form, () => {
      const values = Object.fromEntries(new FormData(form)); values.isFeatured = values.isFeatured === 'true';
      if (item) organization.updateNews(item.id, values); else organization.createNews(values);
      modal.close(); renderNews(); showToast({ message: 'Đã lưu tin tức.', type: 'success' });
    });
  }
  filter.addEventListener('submit', event => event.preventDefault()); filter.addEventListener('input', renderNews);
  newsCard.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    try {
      if (button.dataset.action === 'create-news') editNews();
      const item = news.find(value => value.id === button.dataset.id); if (!item) return;
      if (button.dataset.action === 'edit-news') editNews(item);
      const execute = { 'publish-news': organization.publishNews, 'archive-news': organization.archiveNews, 'restore-news': organization.restoreNews }[button.dataset.action];
      if (execute && await confirmAction({ title: `${button.textContent}?`, message: item.title, tone: button.dataset.action === 'archive-news' ? 'danger' : 'primary' })) { execute(item.id); renderNews(); }
    } catch (error) { showError(error); }
  });
  watchData(['news'], renderNews, newsState);
}
