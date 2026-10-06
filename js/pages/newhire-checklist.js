import { formatDate } from '../common/format.js';
import { createField, createStatusBadge } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { STATUS_META } from '../config/statuses.js';
import { calculateProgress } from '../data/selectors.js';

export async function initPage({ currentUser, repository, permissions, ui }) {
  const root = document.querySelector('#main-content');
  const search = root.querySelector('[data-region="search"]');
  const statusFilter = root.querySelector('[data-region="status-filter"]');
  const stateRoot = root.querySelector('[data-region="task-state"]');
  const tableRoot = root.querySelector('[data-region="task-table"]');
  const progressRoot = root.querySelector('[data-region="task-progress"]');
  const summaryRoot = root.querySelector('[data-region="task-summary"]');
  const journeyBody = root.querySelector('[data-region="journey-tasks"]');
  const personalBody = root.querySelector('[data-region="personal-tasks"]');
  const personalTasks = new Map();
  const resultDrafts = new Map();
  let tasks = [];
  let profile = null;
  let ready = false;

  for (const [value, meta] of Object.entries(STATUS_META.tasks)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = meta.label;
    statusFilter.append(option);
  }

  function renderProgress() {
    const { total, completed, percent } = calculateProgress(tasks);
    const template = document.createElement('template');
    template.innerHTML = '<div class="progress"><div class="progress__label"><span data-region="label"></span><span class="progress__value" data-region="percent"></span></div><progress class="progress__bar" max="100" aria-label="Tiến độ hội nhập"></progress></div>';
    const content = template.content;
    content.querySelector('[data-region="label"]').textContent = `Tiến độ hội nhập: ${completed}/${total} nhiệm vụ`;
    content.querySelector('[data-region="percent"]').textContent = `${percent}%`;
    content.querySelector('progress').value = percent;
    progressRoot.replaceChildren(content);
  }

  function renderTasks() {
    if (!ready) return;
    const query = search.value.trim().toLocaleLowerCase('vi');
    const matches = (task) => {
      const status = resultDrafts.has(task.id) ? 'submitted' : task.status;
      return (!statusFilter.value || status === statusFilter.value)
        && task.title.toLocaleLowerCase('vi').includes(query);
    };
    const journeyTasks = tasks.filter(matches);
    const previewTasks = [...personalTasks.values()].filter(matches);
    journeyBody.replaceChildren();
    personalBody.replaceChildren();
    for (const task of journeyTasks) journeyBody.append(createRow(task, false));
    if (previewTasks.length) {
      const group = document.createElement('tr');
      const heading = document.createElement('th');
      heading.className = 'nh-checklist__group';
      heading.colSpan = 4;
      heading.scope = 'rowgroup';
      heading.textContent = 'Việc cá nhân — bản xem trước';
      group.append(heading);
      personalBody.append(group);
      for (const task of previewTasks) personalBody.append(createRow(task, true));
    }
    const count = journeyTasks.length + previewTasks.length;
    tableRoot.hidden = count === 0;
    ui.setViewState(stateRoot, { status: count ? 'ready' : 'empty', message: tasks.length || personalTasks.size ? 'Không có nhiệm vụ phù hợp với bộ lọc.' : 'Bạn chưa có nhiệm vụ trong hành trình này.' });
    summaryRoot.textContent = `${count} nhiệm vụ hiển thị · ${tasks.length} nhiệm vụ hội nhập${personalTasks.size ? ` · ${personalTasks.size} việc cá nhân xem trước` : ''}`;
  }

  function createRow(task, preview) {
    const row = document.createElement('tr');
    row.dataset.id = task.id;
    const title = document.createElement('td');
    title.textContent = task.title;
    if (preview || resultDrafts.has(task.id)) {
      const label = document.createElement('span');
      label.className = 'nh-checklist__task-label';
      label.textContent = preview ? 'Việc cá nhân · Chưa lưu vào kho' : 'Kết quả nộp xem trước · Chưa lưu vào kho';
      title.append(label);
    }
    const dueDate = document.createElement('td');
    dueDate.className = 'table__cell--nowrap';
    dueDate.textContent = formatDate(task.dueDate);
    const status = document.createElement('td');
    status.append(createStatusBadge('tasks', resultDrafts.has(task.id) ? 'submitted' : task.status));
    const actions = document.createElement('td');
    actions.className = 'table__actions';
    const button = document.createElement('button');
    button.className = 'btn btn--ghost btn--sm';
    button.type = 'button';
    button.dataset.action = 'open-task';
    button.dataset.id = task.id;
    button.textContent = 'Xem';
    button.setAttribute('aria-label', `Xem nhiệm vụ ${task.title}`);
    actions.append(button);
    row.append(title, dueDate, status, actions);
    return row;
  }

  async function loadData() {
    ready = false;
    tableRoot.hidden = true;
    ui.setViewState(stateRoot, { status: 'loading', message: 'Đang tải checklist…' });
    try {
      profile = await repository.getMyProfile();
      tasks = profile.newHireId ? (await repository.list('tasks', { newHireId: profile.newHireId })).items : [];
      ready = true;
      root.querySelector('[data-action="add-personal-task"]').disabled = !profile.newHireId;
      renderProgress();
      renderTasks();
    } catch (error) {
      ui.setViewState(stateRoot, { status: 'error', message: error.message || 'Không thể tải checklist.' });
      const retry = document.createElement('button');
      retry.className = 'btn btn--secondary';
      retry.type = 'button';
      retry.dataset.action = 'retry-tasks';
      retry.textContent = 'Thử lại';
      stateRoot.append(retry);
    }
  }

  async function openTask(taskId) {
    const task = tasks.find((item) => item.id === taskId) || personalTasks.get(taskId);
    if (!task) {
      ui.showToast({ message: 'Không tìm thấy nhiệm vụ trong checklist của bạn.', type: 'error' });
      return;
    }
    const preview = personalTasks.has(taskId);
    const submittedPreview = resultDrafts.get(taskId);
    const initial = { url: submittedPreview?.url || task.result?.url || '', note: submittedPreview?.note || task.result?.note || '' };
    const template = document.createElement('template');
    template.innerHTML = '<form class="form nh-checklist__detail" novalidate><div data-region="task-badge"></div><h3 class="nh-checklist__detail-heading" data-region="task-title"></h3><div class="alert alert--info"><p class="alert__title" data-region="task-due"></p><p class="alert__message">Kết quả được gửi để mentor xem xét; trạng thái hoàn thành do luồng duyệt quyết định.</p></div><p class="nh-checklist__detail-description" data-region="description"></p><section class="nh-checklist__documents" data-region="documents"><h3 class="nh-checklist__detail-heading">Tài liệu liên quan</h3></section><h3 class="nh-checklist__detail-heading">Kết quả của bạn</h3><div data-region="result-fields"></div><p class="form-field__hint" data-region="result-hint"></p><div class="form__actions"><button class="btn btn--secondary" type="button" data-action="cancel-task-result">Hủy</button><button class="btn btn--primary" type="submit" data-action="submit-task-result">Gửi kết quả</button></div></form>';
    const form = template.content.firstElementChild;
    form.querySelector('[data-region="task-badge"]').append(createStatusBadge('tasks', submittedPreview ? 'submitted' : task.status));
    form.querySelector('[data-region="task-title"]').textContent = task.title;
    form.querySelector('[data-region="task-due"]').textContent = `Hạn hoàn thành: ${formatDate(task.dueDate)}`;
    form.querySelector('[data-region="description"]').textContent = task.description || 'Chưa có hướng dẫn bổ sung cho nhiệm vụ này.';
    form.querySelector('[data-region="result-hint"]').textContent = 'Giai đoạn giao diện: gửi kết quả chỉ tạo bản xem trước trong trang, chưa cập nhật nhiệm vụ chính thức.';
    const canSubmit = preview || permissions.can(currentUser, 'tasks:submit', {
      ...task, newHire: { id: profile.newHireId, userId: currentUser.id, mentorId: profile.mentor?.id },
    });
    const locked = task.status === 'completed' || task.status === 'canceled' || !canSubmit;
    const fields = form.querySelector('[data-region="result-fields"]');
    fields.append(createField({ name: 'url', label: 'Liên kết kết quả', type: 'url', value: initial.url, readOnly: locked, hint: 'Dùng liên kết bắt đầu bằng https:// hoặc http://.' }));
    const file = createField({ name: 'resultFile', label: 'Tệp đính kèm', type: 'file', hint: 'Chỉ xem trước tên tệp; chưa tải tệp lên hệ thống.' });
    file.querySelector('input').disabled = locked;
    fields.append(file);
    fields.append(createField({ name: 'note', label: 'Ghi chú gửi mentor', type: 'textarea', value: initial.note, readOnly: locked }));
    if (submittedPreview?.fileName || task.result?.fileName) {
      const attached = document.createElement('p');
      attached.className = 'form-field__hint';
      attached.textContent = `Tệp trong kết quả: ${submittedPreview?.fileName || task.result.fileName}`;
      fields.append(attached);
    }
    form.querySelector('[data-action="submit-task-result"]').hidden = locked;
    let allowClose = false;
    const isDirty = () => form.elements.url.value !== initial.url || form.elements.note.value !== initial.note || form.elements.resultFile.files.length > 0;
    const modal = ui.openModal({
      title: 'Chi tiết nhiệm vụ và gửi kết quả',
      content: form,
      onClose: async () => allowClose || !isDirty() || await ui.confirmAction({ title: 'Hủy thay đổi chưa lưu?', message: `Kết quả đang nhập cho “${task.title}” sẽ bị bỏ.`, confirmLabel: 'Bỏ thay đổi', tone: 'danger' })
    });
    form.querySelector('[data-action="cancel-task-result"]').addEventListener('click', () => modal.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (locked) return;
      const values = { url: form.elements.url.value.trim(), note: form.elements.note.value.trim() };
      const validation = validateForm(values, { url: [{ type: 'url', message: 'Vui lòng nhập liên kết http:// hoặc https:// hợp lệ.' }] });
      if (!values.url && !values.note && !form.elements.resultFile.files.length && !(submittedPreview?.fileName || task.result?.fileName)) {
        validation.isValid = false;
        validation.errors.note = 'Vui lòng thêm liên kết, tệp hoặc ghi chú cho kết quả.';
      }
      applyFormErrors(form, validation.errors);
      if (!validation.isValid) return;
      resultDrafts.set(task.id, { ...values, fileName: form.elements.resultFile.files[0]?.name || submittedPreview?.fileName || task.result?.fileName || '' });
      allowClose = true;
      await modal.close();
      renderTasks();
      ui.showToast({ message: 'Đã tạo bản xem trước kết quả chờ duyệt. Nhiệm vụ trong kho chưa thay đổi.', type: 'info' });
    });
    const documentsRoot = form.querySelector('[data-region="documents"]');
    const documents = await Promise.allSettled((task.relatedDocumentIds || []).map((id) => repository.get('documents', id)));
    let count = 0;
    for (const result of documents) {
      if (result.status !== 'fulfilled') continue;
      const documentRecord = result.value;
      const link = document.createElement('a');
      const params = new URLSearchParams({ id: documentRecord.id });
      link.href = `document-detail.html?${params}`;
      link.textContent = documentRecord.title;
      documentsRoot.append(link);
      count += 1;
    }
    if (!count) documentsRoot.hidden = true;
  }

  function openPersonalTaskForm() {
    if (!profile?.newHireId) return;
    const template = document.createElement('template');
    template.innerHTML = '<form class="form nh-checklist__detail" novalidate><p class="form-field__hint">Việc cá nhân chỉ dùng để xem trước trong trang này.</p><div data-region="personal-fields"></div><label class="checkbox"><input class="checkbox__control" type="checkbox" name="reminder"><span class="checkbox__label">Nhắc tôi trước hạn 1 ngày</span></label><div class="alert alert--info"><p class="alert__title">Việc cá nhân</p><p class="alert__message">Công việc này không thay đổi tiến độ của hành trình chính thức.</p></div><div class="form__actions"><button class="btn btn--secondary" type="button" data-action="cancel-personal-task">Hủy</button><button class="btn btn--primary" type="submit">Thêm việc</button></div></form>';
    const form = template.content.firstElementChild;
    const fields = form.querySelector('[data-region="personal-fields"]');
    fields.append(createField({ name: 'title', label: 'Tên việc cần làm', required: true }));
    fields.append(createField({ name: 'dueDate', label: 'Hạn hoàn thành', type: 'date', required: true }));
    fields.append(createField({ name: 'description', label: 'Ghi chú', type: 'textarea' }));
    let allowClose = false;
    const modal = ui.openModal({ title: 'Thêm việc cá nhân', content: form, onClose: async () => {
      const dirty = form.elements.title.value || form.elements.dueDate.value || form.elements.description.value || form.elements.reminder.checked;
      return allowClose || !dirty || await ui.confirmAction({ title: 'Hủy thay đổi chưa lưu?', message: 'Việc cá nhân đang nhập sẽ bị bỏ.', confirmLabel: 'Bỏ thay đổi', tone: 'danger' });
    } });
    form.querySelector('[data-action="cancel-personal-task"]').addEventListener('click', () => modal.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = { title: form.elements.title.value.trim(), dueDate: form.elements.dueDate.value, description: form.elements.description.value.trim() };
      const validation = validateForm(values, {
        title: [{ type: 'required', message: 'Vui lòng nhập tên việc cần làm.' }],
        dueDate: [{ type: 'required', message: 'Vui lòng chọn hạn hoàn thành.' }, { type: 'date', message: 'Ngày hoàn thành không hợp lệ.' }]
      });
      applyFormErrors(form, validation.errors);
      if (!validation.isValid) return;
      const id = `preview-task-${Date.now()}`;
      personalTasks.set(id, { id, ...values, newHireId: profile.newHireId, assignedById: currentUser.id, status: 'pending', relatedDocumentIds: [], result: null });
      const reminder = form.elements.reminder.checked;
      allowClose = true;
      await modal.close();
      search.value = '';
      statusFilter.value = '';
      renderTasks();
      ui.showToast({ message: `Việc cá nhân đã được thêm vào bản xem trước.${reminder ? ' Nhắc hạn chưa được gửi trong bản giao diện.' : ''} Chưa lưu vào kho.`, type: 'info' });
    });
  }

  search.addEventListener('input', renderTasks);
  statusFilter.addEventListener('change', renderTasks);
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'open-task') void openTask(action.dataset.id);
    if (action.dataset.action === 'add-personal-task') openPersonalTaskForm();
    if (action.dataset.action === 'retry-tasks') void loadData();
  });
  window.addEventListener('pagehide', () => {
    personalTasks.clear();
    resultDrafts.clear();
  }, { once: true });
  await loadData();
  const requestedTask = new URLSearchParams(location.search).get('id');
  if (requestedTask && ready) await openTask(requestedTask);
}
