import { createStatusBadge, createAvatar } from '../common/renderers.js';
import { formatDateTime, toDateTimeInput, fromDateTimeInput } from '../common/format.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { STATUS_META } from '../config/statuses.js';
import { APP_CONFIG } from '../config/app.js';

function composeNote({ situation, challenges, nextSteps }) {
  const parts = [];
  if (situation?.trim()) parts.push(`Tình hình hiện tại:\n${situation.trim()}`);
  if (challenges?.trim()) parts.push(`Khó khăn cần hỗ trợ:\n${challenges.trim()}`);
  if (nextSteps?.trim()) parts.push(`Việc tiếp theo:\n${nextSteps.trim()}`);
  return parts.join('\n\n');
}

function parseNote(note = '') {
  const result = { situation: '', challenges: '', nextSteps: '' };
  const headings = ['Tình hình hiện tại:', 'Khó khăn cần hỗ trợ:', 'Việc tiếp theo:'];
  const keys = ['situation', 'challenges', 'nextSteps'];
  if (!headings.some((heading) => note.startsWith(heading) || note.includes(`\n\n${heading}`))) {
    result.situation = note;
    return result;
  }
  for (let index = 0; index < headings.length; index += 1) {
    const start = note.indexOf(headings[index]);
    if (start < 0) continue;
    const contentStart = start + headings[index].length;
    const next = headings.slice(index + 1).map((heading) => note.indexOf(`\n\n${heading}`, contentStart)).filter((position) => position >= 0);
    result[keys[index]] = note.slice(contentStart, next.length ? Math.min(...next) : undefined).trim();
  }
  return result;
}

export async function initPage({ currentUser, repository, permissions, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const form = region('checkin-form');
  const filters = region('checkin-filters');
  const requestedId = new URLSearchParams(location.search).get('newHireId') || '';
  let selectedId = '';
  let mentees = [];
  let checkins = [];
  let mode = 'create';
  let recordId = null;
  let original = null;
  let baseline = {};
  let draft = null;
  let busy = false;
  let ready = false;
  form.elements.status.replaceChildren(...Object.entries(STATUS_META.checkins).map(([value, meta]) => new Option(meta.label, value)));
  region('timezone-hint').textContent = `Múi giờ: ${APP_CONFIG.timeZone}.`;

  function readValues() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function restoreBaseline() {
    for (const [name, value] of Object.entries(baseline)) form.elements[name].value = value;
    applyFormErrors(form, {});
    draft = null;
    region('preview-notice').hidden = true;
    region('checkin-preview').replaceChildren();
    region('checkin-preview').hidden = true;
  }

  function openForm({ mode: nextMode = 'create', recordId: nextId = null, initialValues = {} } = {}) {
    mode = nextMode;
    recordId = nextId;
    original = recordId ? checkins.find((item) => item.id === recordId) : null;
    baseline = {
      newHireId: original?.newHireId || initialValues.newHireId || filters.elements.newHireId.value || selectedId,
      scheduledAt: original ? toDateTimeInput(original.scheduledAt) : '',
      ...parseNote(original?.note),
      status: original?.status || 'scheduled',
    };
    form.elements.newHireId.disabled = mode === 'edit';
    const editable = mode === 'edit'
      ? permissions.getEditableFields(currentUser, 'checkins', { ...original, newHire: mentees.find((item) => item.id === original.newHireId) })
      : ['scheduledAt', 'note', 'status'];
    form.elements.scheduledAt.readOnly = !editable.includes('scheduledAt');
    for (const name of ['situation', 'challenges', 'nextSteps']) form.elements[name].readOnly = !editable.includes('note');
    form.elements.status.disabled = !editable.includes('status');
    region('form-title').textContent = mode === 'edit' ? 'Sửa ghi chú check-in' : 'Nội dung trao đổi';
    restoreBaseline();
  }

  async function discardChanges() {
    const values = readValues();
    const dirty = Object.entries(baseline).some(([name, value]) => (values[name] ?? form.elements[name].value) !== value);
    return !dirty || await ui.confirmAction({ title: 'Hủy thay đổi chưa lưu?', message: 'Các thay đổi trên form và bản xem trước sẽ bị bỏ.', confirmLabel: 'Bỏ thay đổi', tone: 'danger' });
  }

  function renderPreview(record) {
    const preview = region('checkin-preview');
    preview.replaceChildren();
    preview.hidden = false;
    const heading = document.createElement('h3'); heading.textContent = 'Ghi chú xem trước';
    const when = document.createElement('p'); when.className = 'form-field__hint'; when.textContent = formatDateTime(record.scheduledAt);
    const note = document.createElement('p'); note.className = 'mentor-checkin__note'; note.textContent = record.note || 'Chưa có ghi chú.';
    preview.append(heading, when, createStatusBadge('checkins', record.status), note);
    region('preview-notice').hidden = false;
  }

  function renderList() {
    if (!ready) return;
    const filterId = filters.elements.newHireId.value;
    const items = checkins.filter((item) => !filterId || item.newHireId === filterId);
    const list = region('checkin-list');
    list.replaceChildren();
    for (const item of items) {
      const mentee = mentees.find((person) => person.id === item.newHireId);
      const resource = { ...item, newHire: mentee };
      const card = document.createElement('article'); card.className = 'mentor-checkin__item'; card.dataset.id = item.id;
      const head = document.createElement('div'); head.className = 'mentor-checkin__item-head';
      head.append(createAvatar(mentee.user, { size: 'sm' }));
      const title = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = mentee.user.fullName;
      const when = document.createElement('p'); when.className = 'form-field__hint'; when.textContent = formatDateTime(item.scheduledAt);
      title.append(name, when); head.append(title, createStatusBadge('checkins', item.status));
      const note = document.createElement('p'); note.className = 'mentor-checkin__note'; note.textContent = item.note || 'Chưa có ghi chú.';
      const actions = document.createElement('div'); actions.className = 'mentor-checkin__actions';
      if (permissions.can(currentUser, 'checkins:update', resource)) {
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn--ghost btn--sm';
        edit.dataset.action = 'edit-checkin'; edit.dataset.id = item.id; edit.textContent = 'Sửa'; actions.append(edit);
      }
      if (permissions.can(currentUser, 'checkins:cancel', resource)) {
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn--danger btn--sm';
        cancel.dataset.action = 'cancel-checkin'; cancel.dataset.id = item.id; cancel.textContent = 'Hủy lịch';
        cancel.disabled = item.status !== 'scheduled'; actions.append(cancel);
      }
      card.append(head, note, actions); list.append(card);
    }
    list.hidden = items.length === 0;
    ui.setViewState(region('checkin-state'), { status: items.length ? 'ready' : 'empty', message: checkins.length ? 'Không có check-in phù hợp bộ lọc.' : 'Chưa có lịch check-in. Điền form để xem trước ghi chú mới.' });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !ready) return;
    const values = readValues();
    values.newHireId = form.elements.newHireId.value;
    values.status = form.elements.status.value;
    const result = validateForm(values, {
      newHireId: [{ type: 'required', message: 'Chọn mentee.' }],
      scheduledAt: [{ type: 'required', message: 'Chọn ngày và giờ check-in.' }, { type: 'datetime', message: 'Ngày và giờ không hợp lệ.' }],
      situation: [{ type: 'maxLength', maxLength: 5000, message: 'Tình hình tối đa 5.000 ký tự.' }],
      challenges: [{ type: 'maxLength', maxLength: 5000, message: 'Khó khăn tối đa 5.000 ký tự.' }],
      nextSteps: [{ type: 'maxLength', maxLength: 5000, message: 'Kế hoạch tối đa 5.000 ký tự.' }],
    });
    const mentee = mentees.find((item) => item.id === values.newHireId);
    if (!mentee || !permissions.can(currentUser, `checkins:${mode === 'edit' ? 'update' : 'create'}`, { newHire: mentee })) result.errors.newHireId = 'Mentee không tồn tại hoặc ngoài phạm vi của bạn.';
    if (!STATUS_META.checkins[values.status]) result.errors.status = 'Trạng thái không hợp lệ.';
    const scheduledAt = original && values.scheduledAt === baseline.scheduledAt ? original.scheduledAt : fromDateTimeInput(values.scheduledAt);
    if (!scheduledAt) result.errors.scheduledAt = 'Ngày và giờ không hợp lệ.';
    applyFormErrors(form, result.errors);
    if (Object.keys(result.errors).length) return;
    busy = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      if (values.status === 'canceled' && baseline.status !== 'canceled' && !await ui.confirmAction({ title: 'Hủy lịch check-in?', message: 'Xem trước chuyển buổi check-in sang trạng thái đã hủy? Lịch gốc chưa thay đổi.', confirmLabel: 'Xem trước hủy lịch', tone: 'danger' })) return;
      const noteUnchanged = original && ['situation', 'challenges', 'nextSteps'].every((name) => values[name] === baseline[name]);
      draft = { ...(original ? structuredClone(original) : {}), id: recordId || `preview-checkin-${crypto.randomUUID()}`, newHireId: values.newHireId, mentorId: currentUser.id, scheduledAt, note: noteUnchanged ? original.note : composeNote(values), status: values.status, sharedWithNewHire: original?.sharedWithNewHire ?? false };
      renderPreview(draft);
    } finally { busy = false; submit.disabled = !mentees.length; }
  });

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || busy) return;
    const action = button.dataset.action;
    if (!['reset-checkin', 'open-checkin-form', 'edit-checkin', 'cancel-checkin', 'retry-checkins'].includes(action)) return;
    if (!ready && action !== 'retry-checkins') return;
    busy = true;
    try {
      if (action === 'retry-checkins') { await loadData(); return; }
      if (action === 'reset-checkin') { if (await discardChanges()) restoreBaseline(); return; }
      if (action === 'open-checkin-form') { if (await discardChanges()) openForm({ mode: 'create' }); return; }
      const record = checkins.find((item) => item.id === button.dataset.id);
      const mentee = mentees.find((item) => item.id === record?.newHireId);
      if (!record || !permissions.can(currentUser, `checkins:${action === 'edit-checkin' ? 'update' : 'cancel'}`, { ...record, newHire: mentee })) return;
      if (action === 'edit-checkin' && await discardChanges()) openForm({ mode: 'edit', recordId: record.id });
      if (action === 'cancel-checkin' && record.status === 'scheduled' && await discardChanges()
        && await ui.confirmAction({ title: 'Hủy lịch check-in?', message: `Xem trước hủy buổi check-in với ${mentee.user.fullName}? Lịch gốc chưa thay đổi.`, confirmLabel: 'Xem trước hủy lịch', tone: 'danger' })) {
        openForm({ mode: 'edit', recordId: record.id });
        form.elements.status.value = 'canceled';
        draft = { ...structuredClone(record), status: 'canceled' };
        renderPreview(draft);
      }
    } finally { busy = false; }
  });
  filters.addEventListener('submit', (event) => event.preventDefault());
  filters.addEventListener('change', renderList);

  async function loadData() {
    ready = false;
    form.querySelector('[type="submit"]').disabled = true;
    form.querySelector('[data-action="reset-checkin"]').disabled = true;
    root.querySelector('[data-action="open-checkin-form"]').disabled = true;
    region('checkin-list').hidden = true;
    region('checkin-preview').hidden = true;
    region('preview-notice').hidden = true;
    ui.setViewState(region('checkin-state'), { status: 'loading', message: 'Đang tải check-in…' });
    try {
      const [{ items: newHires }, { items: users }, { items: records }] = await Promise.all([repository.list('newHires'), repository.list('users'), repository.list('checkins')]);
      mentees = newHires.filter((item) => item.mentorId === currentUser.id).map((item) => ({ ...item, user: users.find((user) => user.id === item.userId) || { fullName: item.id } }));
      checkins = records.filter((item) => item.mentorId === currentUser.id && mentees.some((person) => person.id === item.newHireId));
      form.elements.newHireId.replaceChildren(new Option('— Chọn mentee —', ''), ...mentees.map((item) => new Option(item.user.fullName, item.id)));
      filters.elements.newHireId.replaceChildren(new Option('Tất cả mentee', ''), ...mentees.map((item) => new Option(item.user.fullName, item.id)));
      selectedId = mentees.some((item) => item.id === requestedId) ? requestedId : '';
      if (requestedId && !selectedId) ui.setViewState(region('url-state'), { status: 'error', message: 'Mentee trong đường dẫn không tồn tại hoặc ngoài phạm vi của bạn. Hãy chọn mentee được giao.' });
      else ui.setViewState(region('url-state'), { status: 'ready' });
      filters.elements.newHireId.value = selectedId;
      ready = true;
      openForm({ mode: 'create', initialValues: { newHireId: selectedId } });
      renderList();
      form.querySelector('[type="submit"]').disabled = mentees.length === 0;
      form.querySelector('[data-action="reset-checkin"]').disabled = mentees.length === 0;
      root.querySelector('[data-action="open-checkin-form"]').disabled = mentees.length === 0;
    } catch (error) {
      ui.setViewState(region('checkin-state'), { status: 'error', message: error.message || 'Không tải được dữ liệu.' });
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.dataset.action = 'retry-checkins'; retry.textContent = 'Thử lại'; region('checkin-state').append(retry);
    }
  }
  window.addEventListener('pagehide', () => { draft = null; original = null; baseline = {}; checkins = []; }, { once: true });
  await loadData();
}
