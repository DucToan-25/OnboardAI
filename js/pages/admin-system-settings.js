import { createField } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { ROLE_LABELS, ROLE_MENUS } from '../config/roles.js';

const FIELDS = [
  { name: 'organizationName', label: 'Tên tổ chức', required: true, group: 'organization' },
  { name: 'supportEmail', label: 'Email hỗ trợ nhân sự', type: 'email', required: true, group: 'organization' },
  { name: 'supportPhone', label: 'Số điện thoại hỗ trợ', type: 'tel', group: 'organization' },
  { name: 'onboardingDays', label: 'Thời gian hội nhập mặc định (ngày)', type: 'number', required: true, group: 'onboarding', min: 1, max: 365 },
  { name: 'reminderDays', label: 'Nhắc trước hạn nhiệm vụ (ngày)', type: 'number', required: true, group: 'onboarding', min: 0, max: 30 },
];

export async function initPage({ currentUser, permissions, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const form = region('settings-form');
  let record;
  let baseline;
  let draft = null;
  const canEdit = () => record && permissions.can(currentUser, 'settings:update', record)
    && FIELDS.every((field) => permissions.getEditableFields(currentUser, 'settings', record).includes(field.name));

  function fillForm(values) {
    for (const field of FIELDS) form.elements[field.name].value = values[field.name] ?? '';
    applyFormErrors(form, {});
  }
  function discardDraft() {
    if (!baseline) return;
    fillForm(baseline); draft = null;
    region('settings-preview').hidden = true;
  }
  function renderPreview() {
    const list = region('settings-summary'); list.replaceChildren();
    for (const field of FIELDS) {
      const label = document.createElement('dt'); label.textContent = field.label;
      const value = document.createElement('dd'); value.textContent = String(draft[field.name] === '' ? 'Chưa cung cấp' : draft[field.name]);
      list.append(label, value);
    }
    region('settings-preview').hidden = false;
  }

  form.addEventListener('input', () => { draft = null; region('settings-preview').hidden = true; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    const values = Object.fromEntries(FIELDS.map((field) => [field.name, form.elements[field.name].value.trim()]));
    const { errors } = validateForm(values, {
      organizationName: [{ type: 'required' }, { type: 'maxLength', maxLength: 120, message: 'Tên tổ chức tối đa 120 ký tự.' }],
      supportEmail: [{ type: 'required' }, { type: 'email', message: 'Nhập địa chỉ email hợp lệ.' }],
      supportPhone: [{ type: 'phone', message: 'Nhập số điện thoại hợp lệ.' }],
    });
    for (const field of FIELDS.filter((item) => item.type === 'number')) {
      const value = Number(values[field.name]);
      if (!values[field.name] || !Number.isInteger(value) || value < field.min || value > field.max) {
        errors[field.name] = `Nhập số nguyên từ ${field.min} đến ${field.max}.`;
      } else values[field.name] = value;
    }
    applyFormErrors(form, errors);
    if (Object.keys(errors).length) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }
    draft = { id: record.id, ...values };
    renderPreview();
    ui.showToast({ message: 'Đã tạo bản xem trước. Cấu hình chưa được áp dụng.', type: 'info' });
  });
  root.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'cancel-settings') discardDraft();
    if (action === 'reset-settings' && canEdit() && permissions.can(currentUser, 'settings:reset', record)) {
      if (await ui.confirmAction({ title: 'Khôi phục cấu hình đã tải?',
        message: 'Bỏ thay đổi trên biểu mẫu và trở lại cấu hình ban đầu. Không thay đổi dữ liệu hệ thống.',
        confirmLabel: 'Khôi phục', tone: 'primary' })) discardDraft();
    }
  });

  async function loadData() {
    region('settings-content').hidden = true;
    ui.setViewState(region('settings-state'), { status: 'loading', message: 'Đang tải thông tin hệ thống…' });
    try {
      const [settings, users, departments, documents] = await Promise.all([
        repository.get('settings', 'system'), repository.list('users'),
        repository.list('departments'), repository.list('documents', { status: 'published' }),
      ]);
      record = settings;
      baseline = Object.fromEntries(FIELDS.map((field) => [field.name, record[field.name] ?? '']));
      region('users-count').textContent = users.total;
      region('departments-count').textContent = departments.total;
      region('documents-count').textContent = documents.total;
      for (const group of ['organization', 'onboarding']) region(`${group}-fields`).replaceChildren();
      for (const field of FIELDS) {
        const node = createField({ ...field, value: baseline[field.name], readOnly: !canEdit() });
        const control = node.querySelector('[name]');
        if (field.type === 'number') { control.min = field.min; control.max = field.max; control.step = 1; }
        region(`${field.group}-fields`).append(node);
      }
      region('settings-actions').hidden = !canEdit();
      const access = region('role-scope'); access.replaceChildren();
      for (const [role, label] of Object.entries(ROLE_LABELS)) {
        const row = document.createElement('tr');
        const name = document.createElement('th'); name.scope = 'row'; name.textContent = label;
        const scope = document.createElement('td'); scope.textContent = ROLE_MENUS[role].map((item) => item.label).join(', ');
        row.append(name, scope); access.append(row);
      }
      discardDraft();
      region('settings-content').hidden = false;
      ui.setViewState(region('settings-state'), { status: 'ready' });
    } catch (error) {
      ui.setViewState(region('settings-state'), { status: 'error', message: error.message || 'Không tải được thông tin hệ thống.' });
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true }); region('settings-state').append(retry);
    }
  }
  await loadData();
}
