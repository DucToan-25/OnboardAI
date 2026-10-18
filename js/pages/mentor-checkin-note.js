/**
 * UI-08 — Ghi chú check-in.
 * Nối LocalStorage qua resources.js (SV2).
 */
import { bindForm } from '../common/page-ui.js';
import { showToast, setViewState, confirmAction } from '../common/ui.js';
import { formatDateTime, toDateTimeInput, fromDateTimeInput } from '../common/format.js';
import { ensurePreviewSession } from '../data/auth.js';
import { initStore, getAll } from '../data/store.js';
import { listCheckins, createCheckin, updateCheckin } from '../data/resources.js';

const CHECKIN_STATUS = Object.freeze({
  scheduled: { label: 'Đã lên lịch', tone: 'info' },
  completed: { label: 'Đã hoàn thành', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
});

const root = () => document.querySelector('#main-content');
const region = (name) => root()?.querySelector(`[data-region="${name}"]`)
  || document.querySelector(`[data-region="${name}"]`);

const state = {
  user: null,
  mentees: [],
  checkins: [],
  editingId: null,
};

function badge(label, tone) {
  const span = document.createElement('span');
  span.className = `badge badge--${tone ?? 'neutral'}`;
  span.textContent = label;
  return span;
}

function showError(error) {
  console.error(error);
  showToast({ message: error?.message || 'Có lỗi khi thao tác check-in.', type: 'error' });
}

/** Seed dùng "YYYY-MM-DD HH:mm"; datetime-local cần ISO-ish. */
function toInputValue(scheduledAt) {
  if (!scheduledAt) return '';
  const asIso = fromDateTimeInput(String(scheduledAt).replace(' ', 'T'));
  if (asIso) return toDateTimeInput(asIso);
  const m = String(scheduledAt).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}` : '';
}

function fromInputValue(value) {
  if (!value) return null;
  // Lưu dạng gần seed: "YYYY-MM-DD HH:mm"
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : value;
}

async function loadMentees() {
  const [hires, users] = await Promise.all([getAll('newHires'), getAll('users')]);
  state.mentees = hires
    .filter((h) => h.mentorId === state.user.id)
    .map((hire) => ({
      hire,
      user: users.find((u) => u.id === hire.userId) || null,
    }));
}

async function loadCheckins(hireId) {
  const query = hireId ? { newHireId: hireId } : {};
  state.checkins = await listCheckins(query);
}

function menteeName(hireId) {
  const item = state.mentees.find((m) => m.hire.id === hireId);
  return item?.user?.fullName || hireId;
}

function fillMenteeSelects() {
  const form = region('checkin-form');
  const filter = region('checkin-filters');
  const selects = [
    form?.elements?.namedItem('newHireId'),
    filter?.elements?.namedItem('newHireId'),
  ].filter(Boolean);

  for (const select of selects) {
    const current = select.value;
    const isFilter = select.closest('[data-region="checkin-filters"]');
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = isFilter ? 'Tất cả mentee' : '— Chọn mentee —';
    select.append(placeholder);
    for (const { hire, user } of state.mentees) {
      const opt = document.createElement('option');
      opt.value = hire.id;
      opt.textContent = user?.fullName || hire.id;
      select.append(opt);
    }
    if (current && [...select.options].some((o) => o.value === current)) {
      select.value = current;
    }
  }

  const requestedId = new URLSearchParams(location.search).get('newHireId');
  if (requestedId && form?.elements?.newHireId) {
    if ([...form.elements.newHireId.options].some((o) => o.value === requestedId)) {
      form.elements.newHireId.value = requestedId;
    }
  }
}

function renderItem(checkin) {
  const article = document.createElement('article');
  article.className = 'mentor-checkin__item';
  article.dataset.id = checkin.id;
  article.dataset.newHireId = checkin.newHireId;
  article.dataset.status = checkin.status;

  const head = document.createElement('div');
  head.className = 'mentor-checkin__item-head';

  const info = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = menteeName(checkin.newHireId);
  const hint = document.createElement('p');
  hint.className = 'form-field__hint';
  // Hiển thị đẹp; seed không phải ISO thuần
  const display = toInputValue(checkin.scheduledAt);
  hint.textContent = display
    ? formatDateTime(fromDateTimeInput(display) || checkin.scheduledAt) !== '—'
      ? formatDateTime(fromDateTimeInput(display) || `${String(checkin.scheduledAt).replace(' ', 'T')}:00+07:00`)
      : checkin.scheduledAt
    : checkin.scheduledAt || '—';
  // Fallback đơn giản nếu format lỗi
  if (hint.textContent === '—' || !hint.textContent) {
    hint.textContent = checkin.scheduledAt || '—';
  }
  info.append(strong, hint);

  const meta = CHECKIN_STATUS[checkin.status] || { label: checkin.status, tone: 'neutral' };
  head.append(info, badge(meta.label, meta.tone));

  const note = document.createElement('p');
  note.className = 'mentor-checkin__note';
  note.textContent = checkin.note || checkin.nextAction || 'Chưa có ghi chú.';

  const actions = document.createElement('div');
  actions.className = 'mentor-checkin__actions';
  if (checkin.status !== 'cancelled') {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--ghost btn--sm';
    editBtn.dataset.action = 'edit-checkin';
    editBtn.dataset.id = checkin.id;
    editBtn.textContent = 'Sửa';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--danger btn--sm';
    cancelBtn.dataset.action = 'cancel-checkin';
    cancelBtn.dataset.id = checkin.id;
    cancelBtn.textContent = 'Hủy lịch';

    actions.append(editBtn, cancelBtn);
  }

  article.append(head, note, actions);
  return article;
}

function renderList() {
  const list = region('checkin-list');
  if (!list) return;

  const filterHire = region('checkin-filters')?.elements?.namedItem('newHireId')?.value || '';
  const items = filterHire
    ? state.checkins.filter((c) => c.newHireId === filterHire)
    : state.checkins;

  list.replaceChildren(...items.map(renderItem));

  const stateEl = region('checkin-state');
  if (stateEl) {
    setViewState(stateEl, {
      status: items.length ? 'ready' : 'empty',
      message: 'Chưa có lịch check-in phù hợp.',
    });
  }
}

function resetForm() {
  const form = region('checkin-form');
  if (!form) return;
  form.reset();
  state.editingId = null;
  const title = region('form-title');
  if (title) title.textContent = 'Nội dung trao đổi';
  const requestedId = new URLSearchParams(location.search).get('newHireId');
  if (requestedId && form.elements.newHireId) {
    if ([...form.elements.newHireId.options].some((o) => o.value === requestedId)) {
      form.elements.newHireId.value = requestedId;
    }
  }
}

function fillForm(checkin) {
  const form = region('checkin-form');
  if (!form || !checkin) return;
  state.editingId = checkin.id;
  const title = region('form-title');
  if (title) title.textContent = 'Sửa ghi chú check-in';
  if (form.elements.newHireId) form.elements.newHireId.value = checkin.newHireId || '';
  if (form.elements.scheduledAt) form.elements.scheduledAt.value = toInputValue(checkin.scheduledAt);
  // HTML dùng situation / nextSteps; store dùng note / nextAction
  if (form.elements.situation) form.elements.situation.value = checkin.note || '';
  if (form.elements.nextSteps) form.elements.nextSteps.value = checkin.nextAction || '';
  if (form.elements.status) form.elements.status.value = checkin.status || 'scheduled';
  form.scrollIntoView({ block: 'center' });
}

async function handleSave(form) {
  const payload = {
    newHireId: form.elements.newHireId?.value?.trim(),
    scheduledAt: fromInputValue(form.elements.scheduledAt?.value),
    note: form.elements.situation?.value?.trim() || null,
    nextAction: form.elements.nextSteps?.value?.trim() || null,
    status: form.elements.status?.value || 'scheduled',
  };

  try {
    if (state.editingId) {
      await updateCheckin(state.editingId, {
        scheduledAt: payload.scheduledAt,
        note: payload.note,
        nextAction: payload.nextAction,
        status: payload.status,
      });
      showToast({ message: 'Đã cập nhật check-in.', type: 'success' });
    } else {
      await createCheckin(payload);
      showToast({ message: 'Đã tạo lịch check-in.', type: 'success' });
    }
    await loadCheckins();
    renderList();
    resetForm();
  } catch (error) {
    showError(error);
  }
}

async function handleCancel(id) {
  const ok = await confirmAction({
    title: 'Hủy lịch check-in',
    message: 'Lịch sẽ chuyển sang trạng thái đã hủy. Tiếp tục?',
    confirmLabel: 'Hủy lịch',
    tone: 'danger',
  });
  if (!ok) return;
  try {
    await updateCheckin(id, { status: 'cancelled' });
    showToast({ message: 'Đã hủy lịch check-in.', type: 'success' });
    await loadCheckins();
    renderList();
  } catch (error) {
    showError(error);
  }
}

export async function initPage() {
  try {
    await initStore();
    state.user = await ensurePreviewSession('mentor');
    await loadMentees();
    fillMenteeSelects();

    const requestedId = new URLSearchParams(location.search).get('newHireId');
    if (requestedId && !state.mentees.some((m) => m.hire.id === requestedId)) {
      const urlState = region('url-state');
      if (urlState) {
        urlState.hidden = false;
        setViewState(urlState, {
          status: 'error',
          message: 'Mentee không tồn tại hoặc không thuộc phạm vi của bạn.',
        });
      }
    }

    await loadCheckins();
    renderList();

    const form = region('checkin-form');
    bindForm(form, handleSave);

    const filters = region('checkin-filters');
    if (filters) {
      filters.addEventListener('submit', (e) => e.preventDefault());
      filters.addEventListener('change', renderList);
    }

    root()?.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || button.type === 'submit') return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === 'reset-checkin' || action === 'open-checkin-form') {
        resetForm();
      } else if (action === 'edit-checkin' && id) {
        const record = state.checkins.find((c) => c.id === id);
        if (record) fillForm(record);
      } else if (action === 'cancel-checkin' && id) {
        await handleCancel(id);
      }
    });
  } catch (error) {
    showError(error);
    const stateEl = region('checkin-state');
    if (stateEl) {
      setViewState(stateEl, { status: 'error', message: error?.message || 'Không tải được dữ liệu.' });
    }
  }
}
