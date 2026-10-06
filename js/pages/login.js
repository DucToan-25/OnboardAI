import { setPreviewUser } from '../common/auth.js';
import { createField } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { ROLE_LABELS, getPreviewHome } from '../config/roles.js';

export async function initPage({ repository, ui }) {
  const root = document.querySelector('#main-content');
  const form = root.querySelector('[data-region="login-form"]');
  const fields = root.querySelector('[data-region="login-fields"]');
  const state = root.querySelector('[data-region="login-state"]');
  let users = [];
  let signingIn = false;

  fields.className = 'login__fields';
  fields.append(createField({
    name: 'email', label: 'Email', type: 'email', value: '', required: true,
  }));
  const emailControl = form.elements.namedItem('email');
  emailControl.autocomplete = 'username';
  emailControl.placeholder = 'Nhập email tài khoản demo';

  const passwordField = createField({
    name: 'password', label: 'Mật khẩu', type: 'password', value: '', required: true,
  });
  const passwordControl = passwordField.querySelector('[name="password"]');
  passwordControl.autocomplete = 'current-password';
  const passwordRow = document.createElement('div');
  passwordRow.className = 'login__password-control';
  passwordControl.before(passwordRow);
  passwordRow.append(passwordControl);
  const showPassword = document.createElement('button');
  showPassword.className = 'btn btn--ghost btn--sm';
  showPassword.type = 'button';
  showPassword.dataset.action = 'toggle-password';
  showPassword.textContent = 'Hiện';
  showPassword.setAttribute('aria-label', 'Hiện mật khẩu');
  showPassword.setAttribute('aria-pressed', 'false');
  passwordRow.append(showPassword);
  fields.append(passwordField);

  async function loadUsers() {
    ui.setViewState(state, { status: 'loading', message: 'Đang tải tài khoản demo…' });
    form.querySelector('[data-action="login"]').disabled = true;
    try {
      const result = await repository.list('users', { status: 'active' });
      users = result.items;
      if (!users.length) {
        ui.setViewState(state, { status: 'empty', message: 'Chưa có tài khoản demo hoạt động.' });
        return;
      }
      ui.setViewState(state, { status: 'ready' });
      form.querySelector('[data-action="login"]').disabled = false;
    } catch (error) {
      ui.setViewState(state, { status: 'error', message: error.message || 'Không tải được tài khoản demo.' });
      const retry = document.createElement('button');
      retry.className = 'btn btn--secondary btn--sm';
      retry.type = 'button';
      retry.dataset.action = 'retry-login';
      retry.textContent = 'Thử lại';
      state.append(retry);
    }
  }

  async function selectUser(userId) {
    if (signingIn) return;
    signingIn = true;
    form.querySelector('[data-action="login"]').disabled = true;
    try {
      const selectedUser = await setPreviewUser(userId);
      window.location.assign(getPreviewHome(selectedUser.role));
    } catch (error) {
      ui.showToast({ message: error.message || 'Không chọn được tài khoản demo.', type: 'error' });
      signingIn = false;
      form.querySelector('[data-action="login"]').disabled = users.length === 0;
    }
  }

  function openDemoAccounts() {
    const content = document.createElement('div');
    const description = document.createElement('p');
    description.textContent = 'Chọn một người dùng để xem giao diện theo vai trò. Đây là dữ liệu minh họa.';
    content.append(description);
    const list = document.createElement('div');
    list.className = 'login__demo-list';
    for (const user of users) {
      const row = document.createElement('div');
      row.className = 'card card--compact login__demo-account';
      const details = document.createElement('div');
      details.className = 'login__account-details';
      const name = document.createElement('strong');
      name.textContent = user.fullName;
      const email = document.createElement('span');
      email.className = 'login__account-email';
      email.textContent = user.email;
      const role = document.createElement('span');
      role.className = 'login__account-role';
      role.textContent = ROLE_LABELS[user.role] || user.role;
      details.append(name, email, role);
      const choose = document.createElement('button');
      choose.className = 'btn btn--primary btn--sm';
      choose.type = 'button';
      choose.dataset.action = 'select-demo';
      choose.dataset.id = user.id;
      choose.textContent = 'Chọn';
      choose.setAttribute('aria-label', `Chọn tài khoản ${user.fullName}`);
      row.append(details, choose);
      list.append(row);
    }
    if (!users.length) {
      ui.setViewState(list, { status: 'empty', message: 'Chưa tải được tài khoản demo. Đóng hộp thoại và thử lại.' });
    }
    content.append(list);
    const modal = ui.openModal({ title: 'Chọn tài khoản demo', content });
    content.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action="select-demo"]');
      if (!button || signingIn) return;
      button.disabled = true;
      await modal.close();
      await selectUser(button.dataset.id);
    });
  }

  function openForgotPassword() {
    const content = document.createElement('div');
    const helpForm = document.createElement('form');
    helpForm.className = 'form';
    helpForm.noValidate = true;
    helpForm.append(createField({ name: 'email', label: 'Email tài khoản', type: 'email', value: emailControl.value, required: true }));
    const guidance = document.createElement('div');
    guidance.className = 'alert alert--info';
    const title = document.createElement('p');
    title.className = 'alert__title';
    title.textContent = 'Các bước lấy lại quyền truy cập';
    const steps = document.createElement('ol');
    steps.className = 'login__guidance';
    for (const text of [
      'Kiểm tra email và mật khẩu vừa nhập.',
      'Liên hệ HR để được xác minh tài khoản và hướng dẫn khôi phục.',
      'Làm theo hướng dẫn do HR cung cấp.',
    ]) {
      const item = document.createElement('li');
      item.textContent = text;
      steps.append(item);
    }
    const note = document.createElement('p');
    note.className = 'alert__message';
    note.textContent = 'Bản demo chỉ hiển thị hướng dẫn; email khôi phục chưa được gửi.';
    guidance.append(title, steps, note);
    const actions = document.createElement('div');
    actions.className = 'form__actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--secondary';
    cancel.textContent = 'Hủy';
    const contact = document.createElement('button');
    contact.type = 'submit';
    contact.className = 'btn btn--primary';
    contact.textContent = 'Mở liên hệ HR';
    actions.append(cancel, contact);
    helpForm.append(guidance, actions);
    content.append(helpForm);
    const modal = ui.openModal({ title: 'Hướng dẫn quên mật khẩu', content });
    cancel.addEventListener('click', () => modal.close());
    helpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = { email: helpForm.elements.namedItem('email').value.trim() };
      const result = validateForm(values, {
        email: [{ type: 'required', message: 'Vui lòng nhập email tài khoản.' }, { type: 'email', message: 'Email chưa đúng định dạng.' }],
      });
      applyFormErrors(helpForm, result.errors);
      if (!result.isValid) return;
      await modal.close();
      openContactHR(values.email);
    });
  }

  function openContactHR(initialEmail = emailControl.value) {
    const hrContacts = users.filter((user) => user.role === 'hr');
    const content = document.createElement('div');
    const contactInfo = document.createElement('div');
    contactInfo.className = 'login__contact';
    for (const hr of hrContacts) {
      const name = document.createElement('strong');
      name.textContent = hr.fullName;
      const email = document.createElement('span');
      email.textContent = hr.email;
      contactInfo.append(name, email);
    }
    content.append(contactInfo);
    if (!hrContacts.length) {
      ui.setViewState(content, { status: 'empty', message: 'Chưa có thông tin HR. Vui lòng liên hệ bộ phận nhân sự của công ty.' });
      ui.openModal({ title: 'Liên hệ HR', content });
      return;
    }
    const contactForm = document.createElement('form');
    contactForm.className = 'form';
    contactForm.noValidate = true;
    contactForm.append(
      createField({ name: 'email', label: 'Email của bạn', type: 'email', value: initialEmail, required: true }),
      createField({ name: 'topic', label: 'Chủ đề hỗ trợ', type: 'select', value: 'access', required: true, options: [
        { value: 'access', label: 'Tài khoản và quyền truy cập' },
        { value: 'onboarding', label: 'Hành trình hội nhập' },
        { value: 'other', label: 'Hỗ trợ khác' },
      ] }),
      createField({ name: 'message', label: 'Nội dung cần hỗ trợ', type: 'textarea', value: '', required: true }),
    );
    const note = document.createElement('p');
    note.className = 'form-field__hint';
    note.textContent = 'Chuẩn bị nội dung email, sau đó mở ứng dụng email của bạn để gửi cho HR.';
    const actions = document.createElement('div');
    actions.className = 'form__actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn--secondary';
    cancel.type = 'button';
    cancel.textContent = 'Hủy';
    const submit = document.createElement('button');
    submit.className = 'btn btn--primary';
    submit.type = 'submit';
    submit.textContent = 'Chuẩn bị email';
    actions.append(cancel, submit);
    const emailDraft = document.createElement('div');
    emailDraft.hidden = true;
    emailDraft.className = 'alert alert--info';
    emailDraft.setAttribute('role', 'status');
    contactForm.append(note, emailDraft, actions);
    content.append(contactForm);

    const readDraft = () => ({
      email: contactForm.elements.namedItem('email').value.trim(),
      topic: contactForm.elements.namedItem('topic').value,
      message: contactForm.elements.namedItem('message').value.trim(),
    });
    const initialDraft = JSON.stringify(readDraft());
    let closing = false;
    const modal = ui.openModal({
      title: 'Liên hệ HR', content,
      onClose: async () => {
        if (closing) return false;
        if (JSON.stringify(readDraft()) === initialDraft) return true;
        closing = true;
        const discard = await ui.confirmAction({
          title: 'Hủy nội dung chưa gửi?',
          message: 'Nội dung email chưa được gửi. Bạn có muốn bỏ bản nháp này?',
          confirmLabel: 'Bỏ bản nháp', tone: 'danger',
        });
        closing = false;
        return discard;
      },
    });
    cancel.addEventListener('click', () => modal.close());
    contactForm.addEventListener('input', () => { emailDraft.hidden = true; });
    contactForm.addEventListener('change', () => { emailDraft.hidden = true; });
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const draft = readDraft();
      const result = validateForm(draft, {
        email: [{ type: 'required', message: 'Vui lòng nhập email của bạn.' }, { type: 'email', message: 'Email chưa đúng định dạng.' }],
        topic: [{ type: 'required', message: 'Vui lòng chọn chủ đề hỗ trợ.' }],
        message: [{ type: 'required', message: 'Vui lòng mô tả nội dung cần hỗ trợ.' }, { type: 'maxLength', maxLength: 2000, message: 'Nội dung tối đa 2.000 ký tự.' }],
      });
      applyFormErrors(contactForm, result.errors);
      if (!result.isValid) return;
      const topicLabel = contactForm.elements.namedItem('topic').selectedOptions[0].textContent;
      const parameters = new URLSearchParams({
        subject: `[OnboardAI] ${topicLabel}`,
        body: `Email liên hệ: ${draft.email}\n\n${draft.message}`,
      });
      const message = document.createElement('p');
      message.className = 'alert__message';
      message.textContent = 'Email chưa được gửi. Mở ứng dụng email và kiểm tra nội dung trước khi gửi.';
      const link = document.createElement('a');
      link.className = 'btn btn--primary btn--sm';
      link.href = `mailto:${encodeURIComponent(hrContacts[0].email)}?${parameters.toString()}`;
      link.textContent = 'Mở ứng dụng email';
      emailDraft.replaceChildren(message, link);
      emailDraft.hidden = false;
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (signingIn || !users.length) return;
    const values = { email: emailControl.value.trim(), password: passwordControl.value };
    const result = validateForm(values, {
      email: [{ type: 'required', message: 'Vui lòng nhập email.' }, { type: 'email', message: 'Email chưa đúng định dạng.' }],
      password: [{ type: 'required', message: 'Vui lòng nhập mật khẩu để thử biểu mẫu demo.' }],
    });
    applyFormErrors(form, result.errors);
    if (!result.isValid) return;
    const user = users.find((item) => item.email.toLowerCase() === values.email.toLowerCase());
    if (!user) {
      applyFormErrors(form, { email: 'Email chưa có trong danh sách tài khoản demo. Hãy chọn một tài khoản mẫu.' });
      return;
    }
    await selectUser(user.id);
  });

  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle-password') {
      const visible = passwordControl.type === 'password';
      passwordControl.type = visible ? 'text' : 'password';
      showPassword.textContent = visible ? 'Ẩn' : 'Hiện';
      showPassword.setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      showPassword.setAttribute('aria-pressed', String(visible));
    } else if (action === 'choose-demo') {
      openDemoAccounts();
    } else if (action === 'forgot-password') {
      openForgotPassword();
    } else if (action === 'contact-hr') {
      openContactHR();
    } else if (action === 'retry-login') {
      loadUsers();
    }
  });

  await loadUsers();
}
