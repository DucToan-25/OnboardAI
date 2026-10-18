import { showToast, openModal, setViewState } from '../common/ui.js';
import { validateFields } from '../common/page-ui.js';
import { formatDateTime } from '../common/format.js';
import * as progressRisk from '../data/progress-risk.js';
import * as aiHistory from '../data/ai-history.js';
import { getProgress } from '../data/tasks.js';
import { ensurePreviewSession } from '../data/auth.js';

const root = () => document.querySelector('#main-content');
const region = (name) => root().querySelector(`[data-region="${name}"]`);

const HIRE_STATUS_LABELS = {
  notStarted: { label: 'Chưa bắt đầu', tone: 'neutral' },
  inProgress: { label: 'Đang hội nhập', tone: 'info' },
  completed: { label: 'Hoàn thành', tone: 'success' },
  archived: { label: 'Đã lưu trữ', tone: 'warning' },
};

const state = { hires: [], evaluations: [], progressByHire: new Map(), analysis: null, error: null };

function showError(error) {
  console.error(error);
  showToast({ message: error?.message || 'Có lỗi khi tải dữ liệu tổng quan.', type: 'error' });
}

function badge(label, tone) {
  const span = document.createElement('span');
  span.className = `badge badge--${tone ?? 'neutral'}`;
  span.textContent = label;
  return span;
}

function initials(fullName) {
  return (fullName ?? '?').trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function latestEvaluation(hireId) {
  return state.evaluations
    .filter((item) => item.newHireId === hireId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null;
}


function renderStats() {
  const grid = region('dashboard-stats');
  if (!grid) return;
  const values = [
    state.hires.length,
    state.hires.filter((hire) => hire.status === 'inProgress').length,
    state.hires.filter((hire) => hire.status === 'completed').length,
    state.evaluations.filter((item) => item.result?.level === 'high').length,
  ];
  [...grid.querySelectorAll('.stat-card__value')].forEach((node, index) => {
    node.textContent = String(values[index] ?? 0);
  });
}

function renderRow(hire) {
  const tr = document.createElement('tr');
  tr.dataset.id = hire.hireId;

  const nameCell = document.createElement('td');
  const wrap = document.createElement('div');
  wrap.className = 'hr-dashboard__name';
  const avatar = document.createElement('span');
  avatar.className = 'avatar avatar--sm';
  avatar.setAttribute('aria-label', hire.fullName ?? '');
  const avatarText = document.createElement('span');
  avatarText.className = 'avatar__initials';
  avatarText.textContent = initials(hire.fullName);
  avatar.append(avatarText);
  const nameBox = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = hire.fullName ?? '(chưa liên kết tài khoản)';
  nameBox.append(strong);
  if (hire.email) {
    const meta = document.createElement('p');
    meta.className = 'hr-dashboard__meta';
    meta.textContent = hire.email;
    nameBox.append(meta);
  }
  wrap.append(avatar, nameBox);
  nameCell.append(wrap);

  const deptCell = document.createElement('td');
  deptCell.textContent = hire.departmentName ?? '—';
  const mentorCell = document.createElement('td');
  mentorCell.textContent = hire.mentorName ?? 'Chưa gán';

  const progressCell = document.createElement('td');
  const progress = state.progressByHire.get(hire.hireId);
  if (progress && progress.total > 0) {
    const box = document.createElement('div');
    box.className = 'progress';
    const bar = document.createElement('progress');
    bar.className = 'progress__bar';
    bar.max = 100;
    bar.value = progress.percent;
    const value = document.createElement('span');
    value.className = 'progress__value';
    value.textContent = `${progress.percent}%`;
    box.append(bar, value);
    progressCell.append(box);
  } else {
    const hint = document.createElement('span');
    hint.className = 'form-field__hint';
    hint.textContent = progress ? 'Chưa có nhiệm vụ' : 'Chưa đọc được (tasks.js chờ SV2)';
    progressCell.append(hint);
  }

  const riskCell = document.createElement('td');
  const evaluation = latestEvaluation(hire.hireId);
  if (evaluation) {
    const meta = progressRisk.RISK_LEVEL_LABELS[evaluation.result?.level] ?? progressRisk.RISK_LEVEL_LABELS.unknown;
    riskCell.append(badge(meta.label, meta.tone));
  } else {
    riskCell.append(badge('Chưa đánh giá', 'neutral'));
  }

  const statusCell = document.createElement('td');
  const statusMeta = HIRE_STATUS_LABELS[hire.status] ?? { label: hire.status, tone: 'neutral' };
  statusCell.append(badge(statusMeta.label, statusMeta.tone));

  const actions = document.createElement('td');
  actions.className = 'table__actions';
  const detail = document.createElement('button');
  detail.type = 'button';
  detail.className = 'btn btn--ghost btn--sm';
  detail.dataset.action = 'open-newhire';
  detail.dataset.id = hire.hireId;
  detail.textContent = 'Chi tiết';
  actions.append(detail);

  tr.append(nameCell, deptCell, mentorCell, progressCell, riskCell, statusCell, actions);
  return tr;
}


function matchesFilter(hire, form) {
  if (!form) return true;
  const search = form.elements.search?.value.trim().toLocaleLowerCase('vi') ?? '';
  const department = form.elements.departmentId?.value ?? '';
  const text = `${hire.fullName ?? ''} ${hire.email ?? ''}`.toLocaleLowerCase('vi');
  return (!search || text.includes(search)) && (!department || hire.departmentName === department);
}

function render() {
  if (state.error) return;
  const tbody = region('dashboard-rows');
  if (!tbody) return;
  const form = region('dashboard-filters');
  const visible = state.hires.filter((hire) => matchesFilter(hire, form));
  tbody.replaceChildren(...visible.map(renderRow));
  const empty = visible.length === 0;
  setViewState(region('dashboard-state'), {
    status: empty ? 'empty' : 'ready',
    message: empty ? 'Không có nhân sự mới phù hợp bộ lọc.' : '',
  });
  const summary = region('dashboard-summary');
  if (summary) summary.textContent = `${visible.length} / ${state.hires.length} nhân sự mới`;
  renderStats();
}

async function load() {
  setViewState(region('dashboard-state'), { status: 'loading', message: 'Đang tải dữ liệu nhân sự…' });
  try {
    state.hires = await progressRisk.listHires();
    state.evaluations = await progressRisk.listSavedEvaluations();
    state.progressByHire = new Map();
    await Promise.all(state.hires.map(async (hire) => {
      try { state.progressByHire.set(hire.hireId, await getProgress(hire.hireId)); } catch { state.progressByHire.set(hire.hireId, null); }
    }));
    state.error = null;
    const select = region('risk-form')?.elements.namedItem('newHireId');
    if (select) {
      select.replaceChildren(new Option('— Chọn nhân sự —', ''));
      for (const hire of state.hires) {
        select.append(new Option(`${hire.fullName ?? hire.hireId} (${hire.hireId})`, hire.hireId));
      }
    }
    render();
  } catch (error) {
    state.error = error;
    setViewState(region('dashboard-state'), {
      status: 'error',
      message: error?.message || 'Không tải được dữ liệu tổng quan.',
    });
  }
}

function renderAnalysis(analysis, { saved = false } = {}) {
  const panel = region('risk-result');
  if (!panel) return;
  panel.hidden = false;
  const meta = progressRisk.RISK_LEVEL_LABELS[analysis.level] ?? progressRisk.RISK_LEVEL_LABELS.unknown;
  const badgeNode = region('risk-badge');
  badgeNode.className = `badge badge--${meta.tone}`;
  badgeNode.textContent = meta.label;
  region('risk-text').textContent = analysis.summary;
  region('risk-explanation').textContent = analysis.reason;
  region('risk-draft-status').textContent = saved
    ? 'Đã lưu vào lịch sử đánh giá AI (aiHistory).'
    : 'Kết quả đang ở chế độ nháp, nhấn Lưu để ghi vào lịch sử.';
  const sources = region('risk-sources');
  sources.replaceChildren();
  const lines = [
    `newHires: ${analysis.hireId}`,
    analysis.progress ? `tasks.getProgress(): ${analysis.progress.completed}/${analysis.progress.total} (${analysis.progress.percent}%)` : 'tasks.getProgress(): chưa đọc được (module chờ SV2)',
    `Nhiệm vụ quá hạn: ${analysis.signals.overdueTasks}; bị chặn: ${analysis.signals.blockedTasks}`,
    `Check-in: ${analysis.signals.checkins}; mentor: ${analysis.signals.hasMentor ? 'có' : 'chưa gán'}; hành trình: ${analysis.signals.hasJourney ? 'có' : 'chưa gán'}`,
    'Nguyên tắc: thiếu dữ liệu không coi là rủi ro thấp (mục 5.7).',
  ];
  for (const line of lines) {
    const p = document.createElement('p');
    p.className = 'form-field__hint';
    p.textContent = line;
    sources.append(p);
  }
  region('risk-actions').hidden = false;
}


async function analyzeSelected() {
  const form = region('risk-form');
  const hireId = form?.elements.namedItem('newHireId')?.value ?? '';
  if (!hireId) {
    setViewState(region('risk-state'), { status: 'empty', message: 'Hãy chọn một nhân sự trước khi phân tích.' });
    return;
  }
  setViewState(region('risk-state'), { status: 'loading', message: 'Đang phân tích rủi ro tiến độ…' });
  region('risk-result').hidden = true;
  try {
    state.analysis = await progressRisk.analyzeRisk(hireId);
    setViewState(region('risk-state'), { status: 'ready', message: '' });
    renderAnalysis(state.analysis);
  } catch (error) {
    state.analysis = null;
    setViewState(region('risk-state'), { status: 'error', message: error?.message || 'Không phân tích được rủi ro.' });
  }
}

async function saveAnalysis(decision) {
  if (!state.analysis) return;
  try {
    const saved = await aiHistory.createAiHistory({
      featureType: 'progressRisk',
      newHireId: state.analysis.hireId,
      input: `Đánh giá rủi ro tiến độ ${state.analysis.hireId}`,
      result: {
        level: state.analysis.level,
        summary: state.analysis.summary,
        recommendations: state.analysis.recommendations,
      },
      reason: state.analysis.reason,
      decision,
    });
    if (decision === 'accepted') await aiHistory.updateAiHistory(saved.id, { decision: 'accepted' });
    showToast({
      message: decision === 'rejected' ? 'Đã từ chối và lưu kết quả vào lịch sử.' : 'Đã lưu kết quả đánh giá vào lịch sử.',
      type: 'success',
    });
    state.evaluations = await progressRisk.listSavedEvaluations();
    renderAnalysis(state.analysis, { saved: true });
    render();
  } catch (error) {
    showError(error);
  }
}

function viewHireDetail(hireId) {
  const hire = state.hires.find((item) => item.hireId === hireId);
  if (!hire) return;
  const dl = document.createElement('dl');
  dl.className = 'form__grid';
  const rows = [
    ['Hồ sơ', hire.hireId],
    ['Họ và tên', hire.fullName ?? '(chưa liên kết tài khoản)'],
    ['Email', hire.email ?? '—'],
    ['Phòng ban', hire.departmentName ?? '—'],
    ['Người hướng dẫn', hire.mentorName ?? 'Chưa gán'],
    ['Ngày bắt đầu', hire.startDate ?? '—'],
    ['Trạng thái', HIRE_STATUS_LABELS[hire.status]?.label ?? hire.status],
  ];
  const evaluations = state.evaluations.filter((item) => item.newHireId === hireId);
  for (const [term, value] of rows) {
    const dt = document.createElement('dt'); dt.textContent = term;
    const dd = document.createElement('dd'); dd.textContent = value;
    dl.append(dt, dd);
  }
  const dtHistory = document.createElement('dt'); dtHistory.textContent = 'Lịch sử đánh giá rủi ro';
  const ddHistory = document.createElement('dd');
  if (evaluations.length === 0) ddHistory.textContent = 'Chưa có đánh giá nào được lưu.';
  for (const item of evaluations) {
    const p = document.createElement('p');
    p.className = 'form-field__hint';
    const meta = progressRisk.RISK_LEVEL_LABELS[item.result?.level] ?? progressRisk.RISK_LEVEL_LABELS.unknown;
    p.textContent = `${formatDateTime(item.createdAt)} — ${meta.label} — ${item.result?.summary ?? ''}`;
    ddHistory.append(p);
  }
  dl.append(dtHistory, ddHistory);
  openModal({ title: `Chi tiết nhân sự ${hire.fullName ?? hire.hireId}`, content: dl });
}

export async function initPage({ currentUser }) {
  try {
    await ensurePreviewSession(currentUser?.role ?? 'hr');
  } catch (error) {
    showError(error);
    return;
  }
  const filters = region('dashboard-filters');
  filters?.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  filters?.addEventListener('input', render);
  filters?.addEventListener('change', render);
  region('risk-form')?.addEventListener('submit', (event) => { event.preventDefault(); if (validateFields(event.currentTarget)) analyzeSelected(); });
  root().addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit') return;
    const { action, id } = button.dataset;
    if (action === 'open-newhire') viewHireDetail(id);
    else if (action === 'accept-risk') saveAnalysis('accepted');
    else if (action === 'save-risk') saveAnalysis('pending');
    else if (action === 'reject-risk') saveAnalysis('rejected');
    else if (action === 'rerun-risk') analyzeSelected();
    else if (action === 'edit-risk') showToast({ message: 'Kết quả AI được tạo lại bằng nút Tạo lại; sửa chi tiết khi lưu vào hồ sơ sẽ mở ở đợt dữ liệu sau.', type: 'info' });
  });
  await load();
}

