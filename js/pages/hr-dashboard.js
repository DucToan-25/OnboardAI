import { createAvatar, createField, createStatusBadge } from '../common/renderers.js';
import { formatDate } from '../common/format.js';
import { analyzeProgressRisk } from '../data/selectors.js';
import { validateForm, applyFormErrors } from '../common/validation.js';
import { openModal } from '../common/ui.js';

export async function initPage({ currentUser, permissions, repository, ui }) {
  const root = document.querySelector('#main-content');
  const region = (name) => root.querySelector(`[data-region="${name}"]`);
  const filters = region('dashboard-filters');
  const riskForm = region('risk-form');
  let ready = false;
  let newHires = [];
  let users = [];
  let departments = [];
  let tasks = [];
  let rows = [];
  let riskDraft = null;
  let riskPreview = null;
  let runVersion = 0;

  const personOf = (newHire) => users.find((u) => u.id === newHire.userId) || null;
  const mentorOf = (newHire) => users.find((u) => u.id === newHire.mentorId) || null;
  const departmentOf = (person) => departments.find((d) => d.id === person?.departmentId) || null;
  const tasksOf = (newHireId) => tasks.filter((t) => t.newHireId === newHireId);

  function analyze(newHire) {
    const related = tasksOf(newHire.id);
    const analysis = analyzeProgressRisk(related);
    const { progress, overdue, remaining } = analysis;
    const documentIds = [...new Set(related.flatMap((t) => Array.isArray(t.relatedDocumentIds) ? t.relatedDocumentIds : []))];
    const explanation = `Tiến độ ${progress.percent}% (${progress.completed}/${progress.total} nhiệm vụ hoàn thành), còn ${remaining} việc và ${overdue} việc quá hạn.`;
    return { ...analysis, documentIds, explanation };
  }

  function buildStats() {
    const active = newHires.filter((nh) => nh.status === 'active').length;
    const completed = newHires.filter((nh) => nh.status === 'completed').length;
    const atRisk = newHires.filter((nh) => nh.status === 'active' && analyze(nh).atRisk).length;
    const cards = [
      { label: 'Tổng nhân sự mới', value: newHires.length },
      { label: 'Đang hội nhập', value: active },
      { label: 'Hoàn thành hội nhập', value: completed },
      { label: 'Rủi ro cao', value: atRisk },
    ];
    region('dashboard-stats').replaceChildren(...cards.map((card) => {
      const el = document.createElement('article');
      el.className = 'card stat-card';
      const label = document.createElement('p'); label.className = 'stat-card__label'; label.textContent = card.label;
      const value = document.createElement('p'); value.className = 'stat-card__value'; value.textContent = String(card.value);
      el.append(label, value);
      return el;
    }));
  }

  function openDetail(newHire) {
    if (!ready) return;
    if (!permissions.can(currentUser, 'newHires:read', newHire)) return;
    const person = personOf(newHire);
    const mentor = mentorOf(newHire);
    const dept = departmentOf(person);
    const analysis = analyze(newHire);
    const content = document.createElement('div');
    content.className = 'hr-dashboard__risk-details';
    const header = document.createElement('div');
    header.className = 'hr-dashboard__detail-header';
    header.append(createAvatar(person || { fullName: '?' }, { size: 'lg' }));
    const info = document.createElement('div');
    const name = document.createElement('h3'); name.textContent = person?.fullName || '—';
    const meta = document.createElement('p'); meta.className = 'form-field__hint';
    meta.textContent = `${person?.email || ''} · ${dept?.name || '—'} · Mentor: ${mentor?.fullName || '—'}`;
    info.append(name, meta); header.append(info);
    const start = document.createElement('p'); start.className = 'form-field__hint';
    start.textContent = `Ngày bắt đầu: ${formatDate(newHire.startDate)}`;
    const progress = document.createElement('div');
    progress.className = 'progress';
    const plabel = document.createElement('div'); plabel.className = 'progress__label';
    const ptext = document.createElement('span'); ptext.textContent = 'Tiến độ nhiệm vụ';
    const pval = document.createElement('span'); pval.className = 'progress__value'; pval.textContent = `${analysis.progress.percent}%`;
    plabel.append(ptext, pval);
    const bar = document.createElement('progress'); bar.className = 'progress__bar'; bar.max = 100; bar.value = analysis.progress.percent;
    progress.append(plabel, bar);
    const summary = document.createElement('p'); summary.className = 'form-field__hint';
    summary.textContent = `${analysis.progress.total} nhiệm vụ trong hành trình · ${analysis.overdue} việc quá hạn`;
    content.append(header, start, progress, summary);
    openModal({ title: 'Chi tiết nhân sự mới', content });
  }

  function render() {
    if (!ready) return;
    const search = filters.elements.search.value.trim().toLocaleLowerCase('vi');
    const departmentId = filters.elements.departmentId.value;
    const matches = rows.filter((row) => {
      if (departmentId && row.department?.id !== departmentId) return false;
      if (!search) return true;
      return `${row.person?.fullName || ''} ${row.person?.email || ''}`.toLocaleLowerCase('vi').includes(search);
    });
    const tbody = region('dashboard-rows');
    tbody.replaceChildren();
    for (const row of matches) {
      const tr = document.createElement('tr');
      tr.dataset.id = row.newHire.id;
      const nameTd = document.createElement('td');
      const nameWrap = document.createElement('div');
      nameWrap.className = 'hr-dashboard__name';
      nameWrap.append(createAvatar(row.person || { fullName: '?' }, { size: 'sm' }));
      const nameText = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent = row.person?.fullName || '—';
      const email = document.createElement('p'); email.className = 'hr-dashboard__meta'; email.textContent = row.person?.email || '';
      nameText.append(strong, email); nameWrap.append(nameText); nameTd.append(nameWrap);
      const dept = document.createElement('td'); dept.textContent = row.department?.name || '—';
      const mentor = document.createElement('td'); mentor.textContent = row.mentor?.fullName || '—';
      const prog = document.createElement('td');
      const progress = document.createElement('div'); progress.className = 'progress';
      const bar = document.createElement('progress'); bar.className = 'progress__bar'; bar.max = 100; bar.value = row.analysis.progress.percent;
      const pct = document.createElement('span'); pct.className = 'progress__value'; pct.textContent = `${row.analysis.progress.percent}%`;
      progress.append(bar, pct); prog.append(progress);
      const risk = document.createElement('td');
      const riskBadge = document.createElement('span'); riskBadge.className = `badge badge--${row.analysis.tone}`;
      riskBadge.textContent = row.analysis.hasData ? `Rủi ro ${row.analysis.level}` : row.analysis.level;
      risk.append(riskBadge);
      const st = document.createElement('td'); st.append(createStatusBadge('newHires', row.newHire.status));
      const acts = document.createElement('td'); acts.className = 'table__actions';
      const detailBtn = document.createElement('button');
      detailBtn.type = 'button'; detailBtn.className = 'btn btn--ghost btn--sm';
      detailBtn.dataset.action = 'open-newhire'; detailBtn.dataset.id = row.newHire.id; detailBtn.textContent = 'Chi tiết';
      detailBtn.addEventListener('click', () => openDetail(row.newHire));
      acts.append(detailBtn);
      tr.append(nameTd, dept, mentor, prog, risk, st, acts);
      tbody.append(tr);
    }
    region('dashboard-table').hidden = matches.length === 0;
    region('dashboard-summary').textContent = `${matches.length} / ${rows.length} nhân sự mới`;
    ui.setViewState(region('dashboard-state'), {
      status: matches.length ? 'ready' : 'empty',
      message: rows.length ? 'Không có nhân sự phù hợp bộ lọc.' : 'Chưa có nhân sự mới nào.',
    });
  }

  function renderRisk() {
    if (!riskDraft) return;
    region('risk-badge').className = `badge badge--${riskDraft.tone}`;
    region('risk-badge').textContent = `Rủi ro ${riskDraft.level}`;
    region('risk-text').textContent = `${riskDraft.personName}: ${riskDraft.explanation}`;
    region('risk-explanation').textContent = riskDraft.detail;
    region('risk-draft-status').textContent = riskDraft.savedForPreview
      ? 'Đã giữ bản nháp trong trang để xem trước. Chưa ghi vào kho.'
      : riskDraft.accepted ? 'Đã chấp nhận đề xuất trong bản nháp. Chưa ghi vào kho.' : 'Đề xuất đang chờ duyệt trong bản nháp.';
    const accept = region('risk-actions').querySelector('[data-action="accept-risk"]');
    accept.disabled = riskDraft.accepted;
    accept.classList.toggle('is-disabled', riskDraft.accepted);
    accept.textContent = riskDraft.accepted ? 'Đã chấp nhận' : 'Chấp nhận';
    const sources = region('risk-sources');
    sources.replaceChildren();
    if (riskDraft.documentIds.length) {
      for (const id of riskDraft.documentIds) {
        const link = document.createElement('a');
        link.href = `document-detail.html?${new URLSearchParams({ id })}`;
        link.textContent = `Tài liệu ${id}`;
        sources.append(link);
      }
    } else {
      const none = document.createElement('p');
      none.className = 'form-field__hint';
      none.textContent = 'Chưa có tài liệu liên quan.';
      sources.append(none);
    }
    region('risk-result').hidden = false;
    region('risk-actions').hidden = false;
  }

  async function runAnalysis(newHire) {
    if (!ready) return;
    const version = ++runVersion;
    const scenario = riskForm.elements.scenario.value;
    const related = tasksOf(newHire.id);
    riskDraft = null;
    ui.setViewState(region('risk-state'), { status: 'loading', message: 'Đang phân tích tiến độ…' });
    region('risk-result').hidden = true;
    region('risk-actions').hidden = true;
    const submit = riskForm.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.classList.add('is-loading');
    riskForm.setAttribute('aria-busy', 'true');
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (version !== runVersion) return;
      if (scenario === 'error') throw new Error(riskPreview.errorMessage);
      const analysis = analyze(newHire);
      if (scenario === 'insufficient' || !related.length || !analysis.hasData) {
        ui.setViewState(region('risk-state'), {
          status: 'empty',
          message: scenario === 'insufficient' ? 'Tình huống xem trước: chưa đủ dữ liệu để phân tích.' : 'Chưa đủ dữ liệu: nhân sự này chưa có nhiệm vụ nào để phân tích.',
        });
        return;
      }
      const person = personOf(newHire);
      riskDraft = {
        newHireId: newHire.id,
        personName: person?.fullName || '—',
        accepted: false,
        savedForPreview: false,
        level: analysis.level,
        tone: analysis.tone,
        documentIds: analysis.documentIds,
        explanation: `Mức rủi ro ${analysis.level}: ${analysis.explanation}`,
        detail: analysis.overdue
          ? `${analysis.overdue} nhiệm vụ đã quá hạn là lý do chính. `
            + 'Đề xuất trao đổi với người hướng dẫn để điều chỉnh thời hạn (bản nháp).'
          : 'Không có nhiệm vụ quá hạn. Tiếp tục theo dõi tiến độ định kỳ (bản nháp).',
      };
      ui.setViewState(region('risk-state'), { status: 'ready' });
      renderRisk();
    } catch (error) {
      if (version !== runVersion) return;
      riskDraft = null;
      ui.setViewState(region('risk-state'), { status: 'error', message: error.message || 'Không thể phân tích lúc này.' });
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', () => runAnalysis(newHire), { once: true });
      region('risk-state').append(retry);
    } finally {
      if (version === runVersion) {
        submit.disabled = false;
        submit.classList.remove('is-loading');
        riskForm.removeAttribute('aria-busy');
      }
    }
  }

  function openRiskEditor() {
    if (!riskDraft) return;
    const editedDraft = riskDraft;
    const content = document.createElement('div');
    const form = document.createElement('form');
    form.className = 'form';
    form.noValidate = true;
    const fields = document.createElement('div');
    fields.className = 'form__grid';
    fields.append(createField({ name: 'detail', label: 'Nội dung đề xuất', type: 'textarea', required: true, value: riskDraft.detail }));
    form.append(fields);
    const notice = document.createElement('div');
    notice.className = 'alert alert--info';
    notice.hidden = true;
    const noticeText = document.createElement('p');
    noticeText.className = 'alert__message';
    noticeText.textContent = 'Bản xem trước — đề xuất chỉ lưu trong phiên hiển thị này.';
    notice.append(noticeText);
    const actions = document.createElement('div');
    actions.className = 'modal__footer';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn btn--secondary'; cancel.textContent = 'Hủy';
    const save = document.createElement('button');
    save.type = 'submit'; save.className = 'btn btn--primary'; save.textContent = 'Cập nhật bản nháp';
    actions.append(cancel, save);
    form.append(notice, actions);
    content.append(form);
    const modal = openModal({ title: 'Sửa đề xuất rủi ro', content });
    cancel.addEventListener('click', () => modal.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (riskDraft !== editedDraft) { modal.close(); return; }
      const values = Object.fromEntries(new FormData(form).entries());
      const { isValid, errors } = validateForm(values, {
        detail: [{ type: 'required', message: 'Nhập nội dung đề xuất.' }],
      });
      applyFormErrors(form, errors);
      if (!isValid) return;
      riskDraft = { ...riskDraft, detail: values.detail.trim(), accepted: false, savedForPreview: false };
      renderRisk();
      notice.hidden = false;
      ui.showToast({ message: 'Đã cập nhật bản nháp trong trang (chưa ghi kho).', type: 'info' });
      modal.close();
    });
  }

  riskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!ready) return;
    const values = Object.fromEntries(new FormData(riskForm).entries());
    const { isValid, errors } = validateForm(values, {
      newHireId: [{ type: 'required', message: 'Chọn nhân sự cần phân tích.' }],
    });
    const newHire = newHires.find((nh) => nh.id === values.newHireId);
    if (!newHire || !permissions.can(currentUser, 'newHires:read', newHire)) errors.newHireId = 'Nhân sự không tồn tại hoặc ngoài phạm vi được phép.';
    if (!riskPreview?.scenarios?.some((item) => item.value === values.scenario)) errors.scenario = 'Chọn tình huống xem trước trong danh sách.';
    applyFormErrors(riskForm, errors);
    if (!isValid || Object.keys(errors).length) return;
    if (newHire) runAnalysis(newHire);
  });

  region('risk-actions').addEventListener('click', (event) => {
    if (!ready) return;
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !riskDraft) return;
    const action = trigger.dataset.action;
    if (action === 'accept-risk') {
      riskDraft = { ...riskDraft, accepted: true, savedForPreview: false };
      renderRisk();
      ui.showToast({ message: 'Đã chấp nhận đề xuất trong bản nháp của trang.', type: 'info' });
    }
    if (action === 'edit-risk') openRiskEditor();
    if (action === 'reject-risk') {
      runVersion += 1;
      riskDraft = null;
      region('risk-result').hidden = true;
      region('risk-actions').hidden = true;
      ui.setViewState(region('risk-state'), { status: 'empty', message: 'Đã từ chối gợi ý. Chọn nhân sự và chạy lại nếu cần.' });
    }
    if (action === 'rerun-risk') {
      const newHire = newHires.find((nh) => nh.id === riskDraft.newHireId);
      if (newHire) runAnalysis(newHire);
    }
    if (action === 'save-risk') {
      riskDraft = { ...riskDraft, savedForPreview: true };
      renderRisk();
      ui.showToast({ message: 'Đã giữ bản nháp trong trang để xem trước. Chưa ghi vào kho.', type: 'info' });
    }
  });

  riskForm.addEventListener('change', () => {
    if (!ready) return;
    runVersion += 1;
    riskDraft = null;
    region('risk-result').hidden = true;
    region('risk-actions').hidden = true;
    const submit = riskForm.querySelector('[type="submit"]');
    submit.disabled = false;
    submit.classList.remove('is-loading');
    riskForm.removeAttribute('aria-busy');
    applyFormErrors(riskForm, {});
    ui.setViewState(region('risk-state'), { status: 'empty', message: 'Bấm Phân tích rủi ro để tạo bản nháp cho lựa chọn hiện tại.' });
  });

  filters.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  filters.elements.search.addEventListener('input', render);
  filters.elements.departmentId.addEventListener('change', render);

  async function loadData() {
    ready = false;
    runVersion += 1;
    riskDraft = null;
    region('dashboard-table').hidden = true;
    region('dashboard-stats').hidden = true;
    region('dashboard-summary').textContent = '';
    region('risk-result').hidden = true;
    region('risk-actions').hidden = true;
    const submit = riskForm.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.classList.remove('is-loading');
    riskForm.removeAttribute('aria-busy');
    ui.setViewState(region('dashboard-state'), { status: 'loading', message: 'Đang tải dữ liệu nhân sự…' });
    ui.setViewState(region('risk-state'), { status: 'empty', message: 'Chọn một nhân sự và bấm Phân tích rủi ro.' });
    try {
      const [{ items: newHireList }, { items: userList }, { items: departmentList }, { items: taskList }, settings] = await Promise.all([
        repository.list('newHires'),
        repository.list('users'),
        repository.list('departments'),
        repository.list('tasks'),
        repository.get('settings', 'system'),
      ]);
      newHires = newHireList;
      users = userList;
      departments = departmentList;
      tasks = taskList;
      riskPreview = settings.riskPreview;
      if (!riskPreview || !Array.isArray(riskPreview.scenarios)) throw new Error('Chưa có cấu hình tình huống phân tích rủi ro.');
      riskForm.elements.scenario.replaceChildren(...riskPreview.scenarios.map((item) => new Option(item.label, item.value)));
      rows = newHires.map((newHire) => {
        const person = personOf(newHire);
        return { newHire, person, mentor: mentorOf(newHire), department: departmentOf(person), analysis: analyze(newHire) };
      });
      buildStats();
      filters.elements.departmentId.replaceChildren(
        new Option('Tất cả phòng ban', ''),
        ...departments.map((d) => new Option(d.name, d.id)),
      );
      riskForm.elements.newHireId.replaceChildren(
        new Option('— Chọn nhân sự —', ''),
        ...rows.map((row) => new Option(`${row.person?.fullName || row.newHire.id} (${formatDate(row.newHire.startDate)})`, row.newHire.id)),
      );
      ready = true;
      region('dashboard-stats').hidden = false;
      riskForm.querySelector('[type="submit"]').disabled = false;
      render();
    } catch (error) {
      ui.setViewState(region('dashboard-state'), { status: 'error', message: error.message || 'Không tải được dữ liệu dashboard.' });
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn btn--secondary'; retry.textContent = 'Thử lại';
      retry.addEventListener('click', loadData, { once: true });
      region('dashboard-state').append(retry);
    }
  }

  await loadData();
}
