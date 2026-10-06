import { createStatusBadge, createAvatar } from '../common/renderers.js';
import { formatDate, formatDateTime } from '../common/format.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { confirmAction } from '../common/ui.js';

function composeNote({ situation, challenges, nextSteps }) {
  const parts = [];
  if (situation?.trim()) parts.push(`Tình hình hiện tại:\n${situation.trim()}`);
  if (challenges?.trim()) parts.push(`Khó khăn cần hỗ trợ:\n${challenges.trim()}`);
  if (nextSteps?.trim()) parts.push(`Việc tiếp theo:\n${nextSteps.trim()}`);
  return parts.join('\n\n');
}

function parseNote(note = '') {
  const result = { situation: '', challenges: '', nextSteps: '' };
  if (!note) return result;
  const situationMatch = note.match(/Tình hình hiện tại:\s*([\s\S]*?)(?=\n\nKhó khăn|$)/i);
  const challengesMatch = note.match(/Khó khăn cần hỗ trợ:\s*([\s\S]*?)(?=\n\nViệc tiếp theo|$)/i);
  const nextMatch = note.match(/Việc tiếp theo:\s*([\s\S]*)$/i);
  if (situationMatch || challengesMatch || nextMatch) {
    result.situation = situationMatch?.[1]?.trim() || '';
    result.challenges = challengesMatch?.[1]?.trim() || '';
    result.nextSteps = nextMatch?.[1]?.trim() || '';
  } else {
    result.situation = note;
  }
  return result;
}

export async function initPage({ currentUser, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const form = region('checkin-form');
  const filters = region('checkin-filters');
  let mentees = [];
  let checkins = [];
  let mode = 'create';
  let editingId = null;
  let initialValues = {};

  const params = new URLSearchParams(location.search);
  const preselect = params.get('newHireId') || '';

  function fillMenteeSelects(selectedId = '') {
    const options = [
      new Option('— Chọn mentee —', ''),
      ...mentees.map((m) => new Option(m.user.fullName, m.id)),
    ];
    const formSelect = form.elements.newHireId;
    formSelect.replaceChildren(...options.map((o) => o.cloneNode(true)));
    if (selectedId) formSelect.value = selectedId;

    filters.elements.newHireId.replaceChildren(
      new Option('Tất cả mentee', ''),
      ...mentees.map((m) => new Option(m.user.fullName, m.id)),
    );
  }

  function setFormValues(values = {}) {
    form.elements.newHireId.value = values.newHireId || '';
    form.elements.scheduledAt.value = values.scheduledAt || '';
    form.elements.situation.value = values.situation || '';
    form.elements.challenges.value = values.challenges || '';
    form.elements.nextSteps.value = values.nextSteps || '';
    form.elements.status.value = values.status || 'scheduled';
    applyFormErrors(form, {});
    region('preview-notice').hidden = true;
  }

  function readValues() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function openForm({ mode: nextMode = 'create', record = null } = {}) {
    mode = nextMode;
    editingId = record?.id || null;
    const parsed = parseNote(record?.note);
    const dateOnly = record?.scheduledAt ? String(record.scheduledAt).slice(0, 10) : '';
    initialValues = record
      ? {
          newHireId: record.newHireId,
          scheduledAt: dateOnly,
          situation: parsed.situation,
          challenges: parsed.challenges,
          nextSteps: parsed.nextSteps,
          status: record.status || 'scheduled',
        }
      : {
          newHireId: preselect || filters.elements.newHireId.value || '',
          scheduledAt: '',
          situation: '',
          challenges: '',
          nextSteps: '',
          status: 'scheduled',
        };
    region('form-title').textContent = mode === 'edit' ? 'Sửa ghi chú check-in' : 'Nội dung trao đổi';
    setFormValues(initialValues);
  }

  function renderList() {
    const filterId = filters.elements.newHireId.value;
    const items = checkins.filter((c) => !filterId || c.newHireId === filterId);
    const list = region('checkin-list');
    list.replaceChildren();
    for (const item of items) {
      const mentee = mentees.find((m) => m.id === item.newHireId);
      const card = document.createElement('article');
      card.className = 'mentor-checkin__item';
      card.dataset.id = item.id;

      const head = document.createElement('div');
      head.className = 'mentor-checkin__item-head';
      if (mentee) head.append(createAvatar(mentee.user, { size: 'sm' }));
      const title = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = mentee?.user.fullName || item.newHireId;
      const when = document.createElement('p');
      when.className = 'form-field__hint';
      when.textContent = item.scheduledAt.includes('T')
        ? formatDateTime(item.scheduledAt)
        : formatDate(item.scheduledAt.slice(0, 10));
      title.append(name, when);
      head.append(title, createStatusBadge('checkins', item.status));

      const note = document.createElement('p');
      note.className = 'mentor-checkin__note';
      note.textContent = item.note || 'Chưa có ghi chú.';

      const actions = document.createElement('div');
      actions.className = 'mentor-checkin__actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn--ghost btn--sm';
      edit.dataset.action = 'edit-checkin';
      edit.dataset.id = item.id;
      edit.textContent = 'Sửa';
      edit.addEventListener('click', () => openForm({ mode: 'edit', record: item }));

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn btn--danger btn--sm';
      cancel.dataset.action = 'cancel-checkin';
      cancel.dataset.id = item.id;
      cancel.textContent = 'Hủy lịch';
      cancel.disabled = item.status === 'canceled';
      cancel.addEventListener('click', async () => {
        const ok = await confirmAction({
          title: 'Hủy lịch check-in?',
          message: `Bạn sắp hủy buổi check-in với ${mentee?.user.fullName || 'mentee'}. Thao tác này chỉ là xem trước ở giai đoạn giao diện.`,
          confirmLabel: 'Hủy lịch',
          tone: 'danger',
        });
        if (ok) ui.showToast({ message: 'Bản giao diện chưa hỗ trợ hủy lịch thật. Đây là xem trước.', type: 'info' });
      });

      actions.append(edit, cancel);
      card.append(head, note, actions);
      list.append(card);
    }

    list.hidden = items.length === 0;
    ui.setViewState(region('checkin-state'), {
      status: items.length ? 'ready' : 'empty',
      message: checkins.length
        ? 'Không có check-in phù hợp bộ lọc.'
        : 'Chưa có lịch check-in. Điền form bên trái để tạo (xem trước).',
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readValues();
    const { isValid, errors } = validateForm(values, {
      newHireId: [{ type: 'required', message: 'Chọn nhân sự (mentee).' }],
      scheduledAt: [
        { type: 'required', message: 'Chọn ngày check-in.' },
        { type: 'date', message: 'Ngày không hợp lệ.' },
      ],
    });
    applyFormErrors(form, errors);
    if (!isValid) return;
    // Compose note for preview (schema stores single note field)
    const composed = composeNote(values);
    region('preview-notice').hidden = false;
    ui.showToast({
      message: mode === 'edit'
        ? 'Đã xem trước chỉnh sửa (chưa lưu vào kho).'
        : 'Đã xem trước ghi chú mới (chưa lưu vào kho).',
      type: 'info',
    });
    void composed;
  });

  form.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action="reset-checkin"]');
    if (!btn) return;
    const current = readValues();
    const dirty = current.situation !== (initialValues.situation || '')
      || current.challenges !== (initialValues.challenges || '')
      || current.nextSteps !== (initialValues.nextSteps || '')
      || current.newHireId !== (initialValues.newHireId || '');
    if (dirty) {
      const ok = await confirmAction({
        title: 'Hủy thay đổi chưa lưu?',
        message: 'Các thay đổi trên form sẽ bị bỏ. Dữ liệu gốc không bị ảnh hưởng.',
        confirmLabel: 'Bỏ thay đổi',
        tone: 'danger',
      });
      if (!ok) return;
    }
    openForm({ mode: 'create' });
  });

  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="open-checkin-form"]');
    if (btn) openForm({ mode: 'create' });
  });

  filters.addEventListener('change', renderList);

  async function loadData() {
    ui.setViewState(region('checkin-state'), { status: 'loading', message: 'Đang tải check-in…' });
    try {
      const [{ items: newHires }, { items: users }, { items: checkinItems }] = await Promise.all([
        repository.list('newHires'),
        repository.list('users'),
        repository.list('checkins'),
      ]);
      mentees = newHires
        .filter((nh) => nh.mentorId === currentUser.id)
        .map((nh) => ({
          ...nh,
          user: users.find((u) => u.id === nh.userId) || { fullName: nh.id, email: '' },
        }));
      checkins = checkinItems.filter(
        (c) => c.mentorId === currentUser.id || mentees.some((m) => m.id === c.newHireId),
      );
      fillMenteeSelects(preselect);
      if (preselect && mentees.some((m) => m.id === preselect)) {
        filters.elements.newHireId.value = preselect;
      }
      openForm({ mode: 'create' });
      renderList();
    } catch (error) {
      ui.setViewState(region('checkin-state'), {
        status: 'error',
        message: error.message || 'Không tải được dữ liệu.',
      });
    }
  }

  await loadData();
}
