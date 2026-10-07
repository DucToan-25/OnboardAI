import { createField, createStatusBadge, createTaskItem } from '../common/renderers.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { formatDate } from '../common/format.js';
import { STATUS_META } from '../config/statuses.js';

export async function initPage({ currentUser, repository, permissions, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const form = region('task-form');
  const aiForm = region('checklist-form');
  const filters = region('task-filters');
  const requestedId = new URLSearchParams(location.search).get('newHireId') || '';
  let mentees = [];
  let tasks = [];
  let documents = [];
  let fixture = null;
  let mode = 'create';
  let recordId = null;
  let baseline = {};
  let taskDraft = null;
  let checklistDraft = null;
  let generation = 0;
  let processing = false;
  let busy = false;
  let ready = false;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function button(label, action, variant = 'secondary') {
    const element = node('button', `btn btn--${variant} btn--sm`, label);
    element.type = 'button'; element.dataset.action = action;
    return element;
  }

  form.append(createField({ name: 'newHireId', label: 'Mentee', type: 'select', required: true }),
    createField({ name: 'title', label: 'Tên nhiệm vụ', required: true }),
    createField({ name: 'description', label: 'Mô tả', type: 'textarea' }),
    createField({ name: 'dueDate', label: 'Hạn hoàn thành', type: 'date', required: true }));
  const formActions = node('div', 'form__actions');
  const previewTask = button('Xem trước giao việc', 'preview-task', 'primary'); previewTask.type = 'submit'; previewTask.disabled = true;
  formActions.append(previewTask, button('Hủy', 'reset-task'), button('Tạo mới', 'new-task')); form.append(formActions);

  aiForm.append(createField({ name: 'newHireId', label: 'Mentee', type: 'select', required: true }),
    createField({ name: 'goal', label: 'Mục tiêu hội nhập', type: 'textarea', required: true }),
    createField({ name: 'dueDate', label: 'Hạn hoàn thành đề xuất', type: 'date', required: true }),
    createField({ name: 'scenario', label: 'Tình huống minh họa', type: 'select', options: [
      { value: 'success', label: 'Có kết quả mẫu' }, { value: 'insufficient', label: 'Không đủ dữ liệu' }, { value: 'error', label: 'Lỗi xử lý' },
    ] }));
  const generateButton = button('Gợi ý checklist', 'generate-checklist', 'primary'); generateButton.type = 'submit'; generateButton.disabled = true; aiForm.append(generateButton);
  filters.elements.status.replaceChildren(new Option('Tất cả trạng thái', ''), ...Object.entries(STATUS_META.tasks).map(([value, meta]) => new Option(meta.label, value)));

  function taskResource(task) {
    return { ...task, newHire: mentees.find((item) => item.id === task.newHireId) };
  }

  function readTaskValues() {
    const values = Object.fromEntries(new FormData(form));
    values.newHireId = form.elements.newHireId.value;
    return values;
  }

  function validateTask(values, targetForm, nextMode = 'create') {
    const result = validateForm(values, {
      newHireId: [{ type: 'required', message: 'Chọn mentee.' }],
      title: [{ type: 'required', message: 'Nhập tên nhiệm vụ.' }, { type: 'maxLength', maxLength: 200, message: 'Tên tối đa 200 ký tự.' }],
      description: [{ type: 'maxLength', maxLength: 5000, message: 'Mô tả tối đa 5.000 ký tự.' }],
      dueDate: [{ type: 'required', message: 'Chọn hạn hoàn thành.' }, { type: 'date', message: 'Ngày không hợp lệ.' }],
    });
    const mentee = mentees.find((item) => item.id === values.newHireId);
    if (!mentee || !permissions.can(currentUser, `tasks:${nextMode === 'edit' ? 'update' : 'create'}`, { newHire: mentee })) result.errors.newHireId = 'Mentee không tồn tại hoặc ngoài phạm vi của bạn.';
    applyFormErrors(targetForm, result.errors);
    return Object.keys(result.errors).length === 0;
  }

  function restoreBaseline() {
    for (const [name, value] of Object.entries(baseline)) form.elements[name].value = value;
    applyFormErrors(form, {}); taskDraft = null;
    region('task-preview').hidden = true; region('task-preview').replaceChildren();
  }

  function openForm({ mode: nextMode = 'create', recordId: nextId = null, initialValues = {} } = {}) {
    const record = nextId ? tasks.find((task) => task.id === nextId) : null;
    mode = nextMode; recordId = record?.id || null;
    baseline = { newHireId: record?.newHireId || initialValues.newHireId || filters.elements.newHireId.value || '', title: record?.title || '', description: record?.description || '', dueDate: record?.dueDate || '' };
    form.elements.newHireId.disabled = mode === 'edit';
    const editable = mode === 'edit' ? permissions.getEditableFields(currentUser, 'tasks', taskResource(record)) : ['title', 'description', 'dueDate'];
    for (const name of ['title', 'description', 'dueDate']) form.elements[name].readOnly = !editable.includes(name);
    region('task-form-title').textContent = mode === 'edit' ? 'Sửa nhiệm vụ' : 'Giao nhiệm vụ mới';
    previewTask.textContent = mode === 'edit' ? 'Xem trước thay đổi' : 'Xem trước giao việc'; restoreBaseline();
  }

  async function discardChanges() {
    const values = readTaskValues();
    const dirty = Object.entries(baseline).some(([name, value]) => values[name] !== value);
    return !dirty || await ui.confirmAction({ title: 'Hủy thay đổi nhiệm vụ?', message: 'Các trường đã sửa và bản xem trước sẽ bị bỏ.', confirmLabel: 'Bỏ thay đổi', tone: 'danger' });
  }

  function showTaskPreview(task) {
    const preview = region('task-preview'); preview.replaceChildren(); preview.hidden = false;
    preview.append(node('h3', '', 'Nhiệm vụ xem trước'), node('p', 'form-field__hint', 'Chưa ghi vào kho; checklist của nhân sự mới giữ dữ liệu hiện tại.'),
      createTaskItem(task, { onOpen: () => showTaskDetail(task) }), node('p', 'mentor-tasks__description', task.description));
  }

  function showTaskDetail(task) {
    const content = node('div');
    content.append(node('h3', '', task.title), node('p', 'mentor-tasks__description', task.description || 'Chưa có mô tả.'),
      node('p', 'form-field__hint', `Hạn hoàn thành: ${formatDate(task.dueDate)}`), createStatusBadge('tasks', task.status));
    ui.openModal({ title: 'Chi tiết nhiệm vụ', content });
  }

  function renderTasks() {
    if (!ready) return;
    const values = Object.fromEntries(new FormData(filters));
    const search = values.search.trim().toLocaleLowerCase('vi');
    const matches = tasks.filter((task) => (!values.newHireId || task.newHireId === values.newHireId)
      && (!values.status || task.status === values.status) && (!search || `${task.title} ${task.description}`.toLocaleLowerCase('vi').includes(search)));
    const rows = region('task-rows'); rows.replaceChildren();
    for (const task of matches) {
      const row = node('tr'); row.dataset.id = task.id;
      const title = node('td'); const detail = button(task.title, 'view-task', 'ghost'); detail.dataset.id = task.id; title.append(detail);
      const mentee = node('td', '', mentees.find((item) => item.id === task.newHireId)?.user.fullName || task.newHireId);
      const due = node('td', 'table__cell--nowrap', formatDate(task.dueDate));
      const status = node('td'); status.append(createStatusBadge('tasks', task.status));
      const actions = node('td', 'table__actions');
      if (permissions.can(currentUser, 'tasks:update', taskResource(task))) { const edit = button('Sửa', 'edit-task', 'ghost'); edit.dataset.id = task.id; actions.append(edit); }
      if (permissions.can(currentUser, 'tasks:cancel', taskResource(task))) { const cancel = button('Hủy nhiệm vụ', 'cancel-task', 'danger'); cancel.dataset.id = task.id; cancel.disabled = ['canceled', 'completed'].includes(task.status); actions.append(cancel); }
      row.append(title, mentee, due, status, actions); rows.append(row);
    }
    region('task-count').textContent = `${matches.length} / ${tasks.length} nhiệm vụ`;
    region('task-table-wrap').hidden = !matches.length;
    ui.setViewState(region('task-state'), { status: matches.length ? 'ready' : 'empty', message: tasks.length ? 'Không có nhiệm vụ phù hợp bộ lọc.' : 'Chưa có nhiệm vụ trong phạm vi của bạn.' });
  }

  function renderChecklist() {
    const output = region('checklist-result'); output.replaceChildren(); output.hidden = !checklistDraft;
    if (!checklistDraft) return;
    ui.setViewState(region('checklist-state'), { status: 'ready' });
    const list = node('div', 'ai-panel__result');
    for (const task of checklistDraft.tasks) list.append(createTaskItem(task, { onOpen: () => editChecklistTask(task.id) }));
    const explanation = node('div', 'ai-panel__explanation'); explanation.append(node('h3', '', 'Lý do và nguồn tham khảo'), node('p', '', checklistDraft.explanation));
    const sources = node('div', 'ai-panel__sources');
    for (const id of checklistDraft.documentIds) {
      const doc = documents.find((item) => item.id === id);
      if (!doc) continue;
      const link = node('a', '', doc.title); link.href = `document-detail.html?${new URLSearchParams({ id })}`; sources.append(link);
    }
    explanation.append(sources);
    const actions = node('div', 'ai-panel__actions');
    const accept = button(checklistDraft.accepted ? 'Đã chấp nhận' : 'Chấp nhận', 'accept-checklist', 'primary'); accept.disabled = checklistDraft.accepted;
    const save = button(checklistDraft.savedInPage ? 'Đã giữ bản xem trước' : 'Lưu', 'save-checklist'); save.disabled = checklistDraft.savedInPage;
    actions.append(accept, button('Sửa', 'edit-checklist'), button('Từ chối', 'reject-checklist'), button('Tạo lại', 'regenerate-checklist'), save);
    output.append(node('h3', '', 'Checklist mẫu'), list, explanation, actions,
      node('p', 'form-field__hint', checklistDraft.savedInPage ? 'Checklist được giữ trong trang này. Chưa giao nhiệm vụ hoặc ghi vào kho.' : checklistDraft.accepted ? 'Đã chấp nhận checklist xem trước; bạn có thể sửa hoặc giữ bản nháp bằng nút Lưu.' : 'Kiểm tra và chỉnh sửa gợi ý trước khi chấp nhận.'));
  }

  async function generateChecklist() {
    if (processing || !fixture || !ready) return;
    const values = Object.fromEntries(new FormData(aiForm));
    const result = validateForm(values, {
      newHireId: [{ type: 'required', message: 'Chọn mentee.' }],
      goal: [{ type: 'required', message: 'Nhập mục tiêu hội nhập.' }, { type: 'maxLength', maxLength: 1000, message: 'Mục tiêu tối đa 1.000 ký tự.' }],
      dueDate: [{ type: 'required', message: 'Chọn hạn đề xuất.' }, { type: 'date', message: 'Ngày không hợp lệ.' }],
    });
    const mentee = mentees.find((item) => item.id === values.newHireId);
    if (!mentee || !permissions.can(currentUser, 'tasks:create', { newHire: mentee })) result.errors.newHireId = 'Mentee không tồn tại hoặc ngoài phạm vi của bạn.';
    applyFormErrors(aiForm, result.errors);
    if (Object.keys(result.errors).length) return;
    processing = true;
    const currentGeneration = ++generation;
    generateButton.disabled = true; generateButton.classList.add('is-loading');
    checklistDraft = null; region('checklist-result').hidden = true;
    ui.setViewState(region('checklist-state'), { status: 'loading', message: 'Đang chuẩn bị checklist minh họa…' });
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (currentGeneration !== generation) return;
    try {
      if (values.scenario === 'error') throw new Error('Tình huống minh họa: chưa thể tạo checklist. Hãy thử lại.');
      if (values.scenario === 'insufficient' || !fixture.tasks?.length || !fixture.documentIds.every((id) => documents.some((doc) => doc.id === id))) {
        ui.setViewState(region('checklist-state'), { status: 'empty', message: 'Chưa đủ dữ liệu để gợi ý checklist cho mentee này.' });
        region('checklist-state').append(button('Thử lại với dữ liệu mẫu', 'retry-checklist')); return;
      }
      checklistDraft = { accepted: false, savedInPage: false, goal: values.goal.trim(), explanation: fixture.explanation, documentIds: [...fixture.documentIds],
        tasks: fixture.tasks.map((task) => ({ id: `preview-task-${crypto.randomUUID()}`, newHireId: values.newHireId, assignedById: currentUser.id, title: task.title, description: task.description, dueDate: values.dueDate, status: 'pending', relatedDocumentIds: [...fixture.documentIds], result: null, updatedAt: new Date().toISOString() })) };
      renderChecklist();
    } catch (error) {
      ui.setViewState(region('checklist-state'), { status: 'error', message: error.message }); region('checklist-state').append(button('Thử lại với dữ liệu mẫu', 'retry-checklist'));
    } finally { processing = false; generateButton.disabled = false; generateButton.classList.remove('is-loading'); }
  }

  function editChecklistTask(id) {
    const task = checklistDraft?.tasks.find((item) => item.id === id);
    if (!task) return;
    const editor = node('form', 'form'); editor.noValidate = true;
    editor.append(createField({ name: 'title', label: 'Tên nhiệm vụ', value: task.title, required: true }),
      createField({ name: 'description', label: 'Mô tả', type: 'textarea', value: task.description }),
      createField({ name: 'dueDate', label: 'Hạn hoàn thành', type: 'date', value: task.dueDate, required: true }));
    const actions = node('div', 'form__actions'); const cancel = button('Hủy', 'cancel-checklist-edit'); const save = button('Áp dụng vào draft', 'apply-checklist-edit', 'primary'); save.type = 'submit'; actions.append(cancel, save); editor.append(actions);
    let allowClose = false;
    const modal = ui.openModal({ title: 'Sửa nhiệm vụ trong checklist mẫu', content: editor, onClose: async () => {
      const dirty = ['title', 'description', 'dueDate'].some((name) => editor.elements[name].value !== task[name]);
      return allowClose || !dirty || await ui.confirmAction({ title: 'Hủy chỉnh sửa?', message: 'Các thay đổi nhiệm vụ đang sửa sẽ bị bỏ.', confirmLabel: 'Bỏ thay đổi', tone: 'danger' });
    } });
    cancel.addEventListener('click', () => modal.close());
    editor.addEventListener('submit', async (event) => {
      event.preventDefault(); const values = { ...Object.fromEntries(new FormData(editor)), newHireId: task.newHireId };
      if (!validateTask(values, editor)) return;
      checklistDraft.tasks = checklistDraft.tasks.map((item) => item.id === id ? { ...item, title: values.title.trim(), description: values.description.trim(), dueDate: values.dueDate } : item);
      checklistDraft.accepted = false; checklistDraft.savedInPage = false; renderChecklist(); allowClose = true; await modal.close();
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!ready) return;
    const values = readTaskValues();
    if (!validateTask(values, form, mode)) return;
    const original = tasks.find((task) => task.id === recordId);
    taskDraft = { ...(original ? structuredClone(original) : {}), id: recordId || `preview-task-${crypto.randomUUID()}`, newHireId: values.newHireId, assignedById: original?.assignedById || currentUser.id, title: values.title.trim(), description: values.description.trim(), dueDate: values.dueDate, status: original?.status || 'pending', updatedAt: new Date().toISOString() };
    showTaskPreview(taskDraft);
  });
  aiForm.addEventListener('submit', (event) => { event.preventDefault(); void generateChecklist(); });
  filters.addEventListener('submit', (event) => { event.preventDefault(); renderTasks(); });
  filters.addEventListener('input', renderTasks);

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || busy || processing) return;
    const action = target.dataset.action;
    if (!ready && action !== 'retry-tasks') return;
    busy = true;
    try {
      if (action === 'retry-tasks') await loadData();
      if (action === 'reset-task' && await discardChanges()) restoreBaseline();
      if (action === 'new-task' && await discardChanges()) openForm({ mode: 'create' });
      const task = tasks.find((item) => item.id === target.dataset.id);
      if (action === 'view-task' && task) showTaskDetail(task);
      if (action === 'edit-task' && task && permissions.can(currentUser, 'tasks:update', taskResource(task)) && await discardChanges()) openForm({ mode: 'edit', recordId: task.id });
      if (action === 'cancel-task' && task && !['completed', 'canceled'].includes(task.status) && permissions.can(currentUser, 'tasks:cancel', taskResource(task)) && await discardChanges()
        && await ui.confirmAction({ title: 'Hủy nhiệm vụ?', message: `Xem trước hủy “${task.title}”? Dữ liệu chính thức chưa thay đổi.`, confirmLabel: 'Xem trước hủy', tone: 'danger' })) {
        openForm({ mode: 'edit', recordId: task.id }); taskDraft = { ...structuredClone(task), status: 'canceled' }; showTaskPreview(taskDraft);
      }
      if (action === 'retry-checklist') { aiForm.elements.scenario.value = 'success'; await generateChecklist(); }
      if (action === 'regenerate-checklist') await generateChecklist();
      if (action === 'accept-checklist' && checklistDraft) { checklistDraft.accepted = true; renderChecklist(); }
      if (action === 'save-checklist' && checklistDraft) { checklistDraft.savedInPage = true; renderChecklist(); }
      if (action === 'reject-checklist' && checklistDraft) { checklistDraft = null; renderChecklist(); ui.setViewState(region('checklist-state'), { status: 'empty', message: 'Đã từ chối checklist mẫu. Bạn có thể tạo lại.' }); }
      if (action === 'edit-checklist' && checklistDraft) editChecklistTask(checklistDraft.tasks[0].id);
    } finally { busy = false; }
  });

  async function loadData() {
    ready = false;
    previewTask.disabled = true; generateButton.disabled = true; region('task-table-wrap').hidden = true;
    for (const action of ['reset-task', 'new-task']) form.querySelector(`[data-action="${action}"]`).disabled = true;
    region('task-preview').hidden = true;
    region('checklist-result').hidden = true;
    ui.setViewState(region('task-state'), { status: 'loading', message: 'Đang tải mentee và nhiệm vụ…' });
    try {
      const [{ items: newHires }, { items: users }, { items: records }, { items: sourceDocs }, settings] = await Promise.all([
        repository.list('newHires'), repository.list('users'), repository.list('tasks'), repository.list('documents'), repository.get('settings', 'system'),
      ]);
      mentees = newHires.filter((item) => item.mentorId === currentUser.id).map((item) => ({ ...item, user: users.find((user) => user.id === item.userId) || { fullName: item.id } }));
      tasks = records.filter((task) => mentees.some((item) => item.id === task.newHireId)); documents = sourceDocs; fixture = settings.checklistPreview;
      for (const targetForm of [form, aiForm]) targetForm.elements.newHireId.replaceChildren(new Option('— Chọn mentee —', ''), ...mentees.map((item) => new Option(item.user.fullName, item.id)));
      filters.elements.newHireId.replaceChildren(new Option('Tất cả mentee', ''), ...mentees.map((item) => new Option(item.user.fullName, item.id)));
      const selectedId = mentees.some((item) => item.id === requestedId) ? requestedId : '';
      if (requestedId && !selectedId) ui.setViewState(region('url-state'), { status: 'error', message: 'Mentee trong đường dẫn không tồn tại hoặc ngoài phạm vi của bạn. Hãy chọn mentee được giao.' });
      else ui.setViewState(region('url-state'), { status: 'ready' });
      ready = true;
      filters.elements.newHireId.value = selectedId; aiForm.elements.newHireId.value = selectedId; openForm({ mode: 'create', initialValues: { newHireId: selectedId } });
      renderTasks(); previewTask.disabled = !mentees.length; generateButton.disabled = !mentees.length || !fixture;
      for (const action of ['reset-task', 'new-task']) form.querySelector(`[data-action="${action}"]`).disabled = !mentees.length;
      ui.setViewState(region('checklist-state'), { status: fixture ? 'empty' : 'error', message: fixture ? 'Nhập mục tiêu và hạn đề xuất để xem checklist mẫu.' : 'Chưa có dữ liệu minh họa checklist AI.' });
    } catch (error) {
      ui.setViewState(region('task-state'), { status: 'error', message: error.message || 'Không tải được nhiệm vụ.' }); region('task-state').append(button('Thử lại', 'retry-tasks'));
    }
  }
  window.addEventListener('pagehide', () => { generation += 1; taskDraft = null; checklistDraft = null; tasks = []; }, { once: true });
  await loadData();
}
