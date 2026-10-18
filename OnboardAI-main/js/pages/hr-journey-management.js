import { showToast, openModal, confirmAction, setViewState } from '../common/ui.js';
import { validateFields } from '../common/page-ui.js';
import { formatDate } from '../common/format.js';
import * as organization from '../data/organization.js';
import { ensurePreviewSession } from '../data/auth.js';

const root = () => document.querySelector('#main-content');
const region = (name) => root().querySelector(`[data-region="${name}"]`);

const state = { items: [], error: null };

function showError(error) {
  console.error(error);
  showToast({ message: error?.message || 'Có lỗi khi thao tác với hành trình.', type: 'error' });
}

function statusBadge(status) {
  const meta = organization.JOURNEY_STATUS_LABELS[status] ?? { label: status, tone: 'neutral' };
  const span = document.createElement('span');
  span.className = `badge badge--${meta.tone}`;
  span.textContent = meta.label;
  return span;
}

function renderRow(journey) {
  const tr = document.createElement('tr');
  tr.dataset.id = journey.id;
  const nameCell = document.createElement('td');
  const strong = document.createElement('strong');
  strong.textContent = journey.title;
  nameCell.append(strong);
  if (journey.description) {
    const p = document.createElement('p');
    p.className = 'form-field__hint';
    p.textContent = journey.description;
    nameCell.append(p);
  }
  const deptCell = document.createElement('td');
  deptCell.textContent = journey.departmentId ?? '—';
  const daysCell = document.createElement('td');
  daysCell.className = 'table__cell--numeric';
  daysCell.textContent = String(journey.durationDays ?? '—');
  const statusCell = document.createElement('td');
  statusCell.append(statusBadge(journey.status));
  const actions = document.createElement('td');
  actions.className = 'table__actions';

  const view = document.createElement('button');
  view.type = 'button';
  view.className = 'btn btn--ghost btn--sm';
  view.dataset.action = 'view-journey';
  view.dataset.id = journey.id;
  view.textContent = 'Chi tiết';

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn btn--secondary btn--sm';
  edit.dataset.action = 'edit-journey';
  edit.dataset.id = journey.id;
  edit.textContent = 'Sửa';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = journey.status === 'active' ? 'btn btn--danger btn--sm' : 'btn btn--secondary btn--sm';
  toggle.dataset.action = journey.status === 'active' ? 'deactivate-journey' : 'activate-journey';
  toggle.dataset.id = journey.id;
  toggle.textContent = journey.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt';

  actions.append(view, edit, toggle);
  tr.append(nameCell, deptCell, daysCell, statusCell, actions);
  return tr;
}

async function load() {
  setViewState(region('journey-state'), { status: 'loading', message: 'Đang tải danh sách hành trình…' });
  try {
    const search = region('journey-filters')?.elements?.search?.value?.trim() ?? '';
    const status = region('journey-filters')?.elements?.status?.value ?? '';
    state.items = await organization.listJourneys({ title: search || undefined, status: status || undefined });
    state.error = null;
    render();
  } catch (error) {
    state.error = error;
    setViewState(region('journey-state'), {
      status: 'error',
      message: error?.message || 'Không tải được danh sách hành trình.',
    });
  }
}

function render() {
  if (state.error) return;
  const tbody = region('journey-rows');
  if (!tbody) return;
  tbody.replaceChildren(...state.items.map(renderRow));
  const empty = state.items.length === 0;
  setViewState(region('journey-state'), {
    status: empty ? 'empty' : 'ready',
    message: empty ? 'Chưa có hành trình nào khớp bộ lọc.' : '',
  });
  const summary = region('journey-summary');
  if (summary) summary.textContent = `${state.items.length} mẫu hành trình`;
}

function journeyForm(journey) {
  const template = document.querySelector('template[data-template="open-journey-form"]');
  if (!template) { showError(new Error('Thiếu mẫu biểu mẫu hành trình.')); return; }
  const content = document.createElement('div');
  content.append(template.content.cloneNode(true));
  const form = content.querySelector('form');
  if (journey) {
    form.elements.namedItem('name').value = journey.title ?? '';
    form.elements.namedItem('departmentId').value = journey.departmentId ?? '';
    form.elements.namedItem('durationDays').value = journey.durationDays ?? '';
    form.elements.namedItem('status').value = journey.status ?? 'active';
    form.elements.namedItem('description').value = journey.description ?? '';
  }
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = journey ? 'Lưu thay đổi' : 'Tạo hành trình';
  const modal = openModal({ title: journey ? 'Chỉnh sửa hành trình' : (template.dataset.title || 'Tạo mẫu hành trình'), content });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateFields(form)) return;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      if (journey) await organization.updateJourney(journey.id, values);
      else await organization.createJourney(values);
      showToast({ message: journey ? 'Đã lưu thay đổi hành trình.' : 'Đã tạo mẫu hành trình.', type: 'success' });
      await modal.close();
      await load();
    } catch (error) {
      showError(error);
    }
  });
  content.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button?.type === 'button' && /^(Hủy|Đóng)$/.test(button.textContent.trim())) modal.close();
  });
}


async function viewJourney(id) {
  try {
    const journey = await organization.getJourney(id);
    const references = await organization.getJourneyReferences(id);
    const dl = document.createElement('dl');
    dl.className = 'form__grid';
    const rows = [
      ['Tên hành trình', journey.title],
      ['Mô tả', journey.description ?? '—'],
      ['Vai trò mục tiêu', journey.targetRole ?? 'all'],
      ['Phòng ban', journey.departmentId ?? '—'],
      ['Thời lượng (ngày)', String(journey.durationDays ?? '—')],
      ['Trạng thái', organization.JOURNEY_STATUS_LABELS[journey.status]?.label ?? journey.status],
      ['Nhân sự đang gán', String(references.newHires)],
      ['Nhiệm vụ tham chiếu', String(references.tasks)],
      ['Ngày tạo', formatDate(journey.createdAt)],
    ];
    for (const [term, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = value;
      dl.append(dt, dd);
    }
    openModal({ title: 'Chi tiết hành trình', content: dl });
  } catch (error) {
    showError(error);
  }
}

async function toggleJourney(id, target) {
  try {
    const journey = await organization.getJourney(id);
    if (target === 'inactive') {
      const references = await organization.getJourneyReferences(id);
      const linked = references.newHires + references.tasks;
      const ok = await confirmAction({
        title: 'Vô hiệu hóa hành trình?',
        message: linked > 0
          ? `"${journey.title}" đang có ${references.newHires} nhân sự và ${references.tasks} nhiệm vụ tham chiếu. Vô hiệu hóa giữ nguyên dữ liệu, chỉ chặn gán mới.`
          : `"${journey.title}" sẽ ngừng nhận gán mới. Dữ liệu hiện có được giữ nguyên.`,
        confirmLabel: 'Vô hiệu hóa',
        tone: 'danger',
      });
      if (!ok) return;
    }
    await organization.setJourneyStatus(id, target);
    showToast({ message: target === 'active' ? 'Đã kích hoạt hành trình.' : 'Đã vô hiệu hóa hành trình.', type: 'success' });
    await load();
  } catch (error) {
    showError(error);
  }
}

export async function initPage({ currentUser }) {
  try {
    await ensurePreviewSession(currentUser?.role ?? 'hr');
  } catch (error) {
    showError(error);
    return;
  }
  const filters = region('journey-filters');
  filters?.addEventListener('submit', (event) => { event.preventDefault(); load(); });
  filters?.addEventListener('change', () => load());
  root().addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit') return;
    const { action, id } = button.dataset;
    if (action === 'open-journey-form') journeyForm(null);
    else if (action === 'edit-journey') {
      try { journeyForm(await organization.getJourney(id)); } catch (error) { showError(error); }
    } else if (action === 'view-journey') await viewJourney(id);
    else if (action === 'deactivate-journey') await toggleJourney(id, 'inactive');
    else if (action === 'activate-journey') await toggleJourney(id, 'active');
  });
  await load();
}

