import { createAvatar, createField } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { formatDate } from '../common/format.js';
import { ROLE_LABELS } from '../config/roles.js';

export async function initPage({ currentUser, repository, permissions, ui }) {
  const root = document.querySelector('#main-content');
  const state = root.querySelector('[data-region="profile-state"]');
  const layout = root.querySelector('[data-region="profile-layout"]');
  const summary = root.querySelector('[data-region="profile-summary"]');
  const form = root.querySelector('[data-region="profile-form"]');
  const fields = root.querySelector('[data-region="profile-fields"]');
  const preview = root.querySelector('[data-region="profile-preview"]');
  const save = form.querySelector('[data-action="save-profile"]');
  let profile;
  let draft;
  let editableFields = [];
  let saving = false;
  let restoring = false;

  function personalValues(record) {
    return { fullName: record.fullName || '', phone: record.phone || '', avatarUrl: record.avatarUrl || '' };
  }

  function readDraft() {
    return Object.fromEntries(['fullName', 'phone', 'avatarUrl'].map((name) => [
      name, form.elements.namedItem(name).value.trim(),
    ]));
  }

  function isDirty() {
    return JSON.stringify(draft) !== JSON.stringify(personalValues(profile));
  }

  function renderSummary(record) {
    const identity = document.createElement('div');
    identity.className = 'profile__identity';
    const avatar = createAvatar(record, { size: 'lg' });
    const name = document.createElement('p');
    name.className = 'profile__name';
    name.textContent = record.fullName;
    const job = document.createElement('p');
    job.className = 'profile__job';
    job.textContent = record.jobTitle || 'Chưa cập nhật chức danh';
    const role = document.createElement('span');
    role.className = 'badge badge--info';
    role.textContent = ROLE_LABELS[record.role] || record.role;
    identity.append(avatar, name, job, role);
    const metadata = document.createElement('dl');
    metadata.className = 'profile__metadata';
    const rows = [
      ['Mã nhân viên', record.id],
      ['Phòng ban', record.department?.name || 'Chưa cập nhật'],
    ];
    if (record.newHireId) {
      rows.push(['Ngày bắt đầu', formatDate(record.startDate)], ['Mentor', record.mentor?.fullName || 'Chưa được phân công']);
    } else {
      rows.push(['Vai trò', ROLE_LABELS[record.role] || record.role]);
    }
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'profile__metadata-row';
      const term = document.createElement('dt');
      term.className = 'profile__metadata-label';
      term.textContent = label;
      const description = document.createElement('dd');
      description.className = 'profile__metadata-value';
      description.textContent = value;
      row.append(term, description);
      metadata.append(row);
    }
    summary.replaceChildren(identity, metadata);
  }

  function renderForm() {
    const fullName = createField({
      name: 'fullName', label: 'Họ và tên', type: 'text', value: draft.fullName,
      required: true, readOnly: !editableFields.includes('fullName'),
    });
    fullName.classList.add('form-field--full');
    const email = createField({
      name: 'email', label: 'Email', type: 'email', value: profile.email || '', readOnly: true,
      hint: 'Liên hệ HR để thay đổi email tài khoản.',
    });
    const phone = createField({
      name: 'phone', label: 'Số điện thoại', type: 'tel', value: draft.phone,
      readOnly: !editableFields.includes('phone'),
    });
    const jobTitle = createField({
      name: 'jobTitle', label: 'Chức danh', type: 'text', value: profile.jobTitle || '', readOnly: true,
    });
    jobTitle.classList.add('form-field--full');
    const avatarUrl = createField({
      name: 'avatarUrl', label: 'Ảnh đại diện (URL)', type: 'text', value: draft.avatarUrl,
      readOnly: !editableFields.includes('avatarUrl'),
      hint: 'Không bắt buộc. Dùng đường dẫn ảnh hoặc URL bắt đầu bằng https://.',
    });
    avatarUrl.classList.add('form-field--full');
    fields.replaceChildren(fullName, email, phone, jobTitle, avatarUrl);
    form.elements.namedItem('fullName').autocomplete = 'name';
    form.elements.namedItem('phone').autocomplete = 'tel';
    form.elements.namedItem('email').autocomplete = 'email';
    save.disabled = editableFields.length === 0;
  }

  async function loadData() {
    layout.hidden = true;
    ui.setViewState(state, { status: 'loading', message: 'Đang tải hồ sơ của bạn…' });
    try {
      profile = await repository.getMyProfile();
      editableFields = permissions.getEditableFields(currentUser, 'profile', profile);
      draft = personalValues(profile);
      renderSummary(profile);
      renderForm();
      preview.hidden = true;
      layout.hidden = false;
      ui.setViewState(state, { status: 'ready' });
    } catch (error) {
      ui.setViewState(state, { status: 'error', message: error.message || 'Không tải được hồ sơ. Vui lòng thử lại.' });
      const retry = document.createElement('button');
      retry.className = 'btn btn--secondary';
      retry.type = 'button';
      retry.dataset.action = 'retry-profile';
      retry.textContent = 'Thử lại';
      state.append(retry);
    }
  }

  form.addEventListener('input', () => {
    draft = readDraft();
    renderSummary(profile);
    preview.hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving || !profile) return;
    draft = readDraft();
    const result = validateForm(draft, {
      fullName: [
        { type: 'required', message: 'Vui lòng nhập họ và tên.' },
        { type: 'maxLength', maxLength: 100, message: 'Họ và tên tối đa 100 ký tự.' },
      ],
      phone: [{ type: 'phone', message: 'Số điện thoại chưa đúng định dạng.' }],
      avatarUrl: [{ type: 'url', allowRelative: true, message: 'Dùng URL http/https hoặc đường dẫn ảnh hợp lệ.' }],
    });
    applyFormErrors(form, result.errors);
    if (!result.isValid) return;
    const original = personalValues(profile);
    const patch = Object.fromEntries(editableFields
      .filter((name) => Object.hasOwn(draft, name) && draft[name] !== original[name])
      .map((name) => [name, draft[name]]));
    if (!Object.keys(patch).length) {
      ui.showToast({ message: 'Chưa có thay đổi để lưu.', type: 'info' });
      return;
    }
    saving = true;
    save.disabled = true;
    try {
      if (!repository.capabilities?.write) {
        renderSummary({ ...profile, ...patch });
        preview.hidden = false;
        ui.showToast({ message: 'Đã kiểm tra bản xem trước. Hồ sơ chưa được lưu.', type: 'info' });
        return;
      }
      profile = await repository.updateMyProfile(patch);
      draft = personalValues(profile);
      renderSummary(profile);
      renderForm();
      preview.hidden = true;
      ui.showToast({ message: 'Đã lưu thay đổi hồ sơ.', type: 'success' });
    } catch (error) {
      if (error.fieldErrors) applyFormErrors(form, error.fieldErrors);
      ui.showToast({ message: error.message || 'Không lưu được hồ sơ. Bản nháp của bạn vẫn được giữ.', type: 'error' });
    } finally {
      saving = false;
      save.disabled = editableFields.length === 0;
    }
  });

  root.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'retry-profile') {
      await loadData();
      return;
    }
    if (action !== 'reset-profile' || !profile || saving || restoring) return;
    draft = readDraft();
    restoring = true;
    try {
      if (isDirty()) {
        const discard = await ui.confirmAction({
          title: 'Hủy thay đổi chưa lưu?',
          message: 'Bạn đang chỉnh sửa hồ sơ của mình. Các thay đổi chưa lưu sẽ bị bỏ và dữ liệu ban đầu được khôi phục.',
          confirmLabel: 'Bỏ thay đổi', tone: 'danger',
        });
        if (!discard) return;
      }
      draft = personalValues(profile);
      renderForm();
      renderSummary(profile);
      preview.hidden = true;
      form.elements.namedItem('fullName').focus();
    } finally {
      restoring = false;
    }
  });

  await loadData();
}
