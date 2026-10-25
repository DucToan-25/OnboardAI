import { showToast, openModal, setViewState, confirmAction } from '../common/ui.js';
import { bindForm, validateFields } from '../common/page-ui.js';
import { formatDateTime } from '../common/format.js';
import * as progressRisk from '../data/progress-risk.js';
import * as aiHistory from '../data/ai-history.js';
import { getProgress } from '../data/tasks.js';
import { watchData } from '../common/data-ui.js';
import { element, createField, fillSelect, actionButton } from '../common/renderers.js';
import { initOrganizationManagement } from '../common/organization-ui.js';
import { STATUS_META } from '../config/statuses.js';
import { analyzeProgressRiskWithAi } from '../services/ai-service.js';
import { getAiMode, AI_MODES } from '../config/ai-config.js';
import {
  createAiStatusBar,
  createAiSourceBadge,
  createAiErrorNotice,
} from '../common/ai-ui.js';

const root = () => document.querySelector('#main-content');
const region = (name) => root().querySelector(`[data-region="${name}"]`);

const HIRE_STATUS_LABELS = STATUS_META.newHires;

const state = { hires: [], evaluations: [], progressByHire: new Map(), analysis: null, historyId: null, saving: false, analyzing: false, error: null };

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
    .filter((item) => item.newHireId === hireId && item.decision === 'accepted')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null;
}


function renderStats() {
  const grid = region('dashboard-stats');
  if (!grid) return;
  const values = [
    state.hires.length,
    state.hires.filter((hire) => hire.status === 'inProgress').length,
    state.hires.filter((hire) => hire.status === 'completed').length,
    state.hires.filter(hire => latestEvaluation(hire.hireId)?.result?.level === 'high').length,
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
    hint.textContent = progress ? 'Chưa có nhiệm vụ' : 'Chưa đọc được tiến độ';
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
  return (!search || text.includes(search)) && (!department || hire.departmentId === department);
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
    const departments = [...new Map(state.hires.map(hire => [hire.departmentId, hire.departmentName])).entries()].map(([value, label]) => ({ value, label }));
    fillSelect(region('dashboard-filters')?.elements.departmentId, departments, 'Tất cả phòng ban');
    const select = region('risk-form')?.elements.namedItem('newHireId');
    if (select) {
      const selected = select.value;
      select.replaceChildren(new Option('— Chọn nhân sự —', ''));
      for (const hire of state.hires) {
        select.append(new Option(`${hire.fullName ?? hire.hireId} (${hire.hireId})`, hire.hireId));
      }
      select.value = selected;
    }
    render();
    renderHistory();
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

  const head = panel.querySelector('.hr-dashboard__risk-head');
  if (head) {
    let aiBadgeNode = head.querySelector('[data-ai-source-badge]');
    if (!aiBadgeNode) {
      aiBadgeNode = document.createElement('span');
      aiBadgeNode.dataset.aiSourceBadge = 'true';
      head.append(aiBadgeNode);
    }
    const source = analysis.aiSource || (analysis.reason?.includes('Google Gemini') ? 'gemini' : analysis.level === 'unknown' ? 'rule-based' : 'mock');
    aiBadgeNode.replaceChildren(createAiSourceBadge(source, analysis.model));
  }

  region('risk-text').textContent = analysis.summary;
  region('risk-explanation').textContent = analysis.reason;
  region('risk-recommendations').replaceChildren(...(analysis.recommendations || []).map(text => element('li', '', text)));
  const decision = state.historyId ? aiHistory.getHistory(state.historyId).decision : 'pending';
  region('risk-draft-status').textContent = saved
    ? `Đã lưu vào lịch sử đánh giá. ${decision === 'accepted' ? 'HR đã chấp nhận kết quả.' : decision === 'rejected' ? 'HR đã từ chối kết quả.' : 'Đang chờ quyết định của HR.'}`
    : 'Kết quả đang ở chế độ nháp, nhấn Lưu để ghi vào lịch sử.';
  const sources = region('risk-sources');
  sources.replaceChildren();
  const lines = [
    `newHires: ${analysis.hireId}`,
    analysis.progress ? `Tiến độ: ${analysis.progress.completed}/${analysis.progress.total} (${analysis.progress.percent}%)` : 'Tiến độ chi tiết chưa có trong bản lưu.',
    ...(analysis.signals ? [
      `Nhiệm vụ quá hạn: ${analysis.signals.overdueTasks}; bị chặn: ${analysis.signals.blockedTasks}`,
      `Chưa bắt đầu: ${analysis.signals.notStartedTasks}; đang làm: ${analysis.signals.inProgressTasks}; hoàn thành: ${analysis.signals.completedTasks}`,
      `Check-in hoàn thành: ${analysis.signals.completedCheckins}; đang chờ: ${analysis.signals.scheduledCheckins}; số ngày onboarding: ${analysis.signals.onboardingDaysElapsed ?? 'chưa xác định'}`,
      `Nhiệm vụ gây rủi ro: ${analysis.signals.riskTasks?.map(task => task.title).join(', ') || 'không có'}`,
      `Mentor hợp lệ: ${analysis.signals.hasMentor ? 'có' : 'chưa có'}; hành trình hợp lệ: ${analysis.signals.hasJourney ? 'có' : 'chưa có'}`,
    ] : ['Bản lưu chỉ giữ kết quả và giải thích; tạo lại để đọc số liệu hiện tại.']),
    'Thiếu dữ liệu không được coi là rủi ro thấp. Đây là đánh giá mô phỏng, cần HR rà soát.',
  ];
  for (const line of lines) {
    const p = document.createElement('p');
    p.className = 'form-field__hint';
    p.textContent = line;
    sources.append(p);
  }
  region('risk-actions').hidden = false;
  for (const action of ['accept-risk', 'reject-risk', 'edit-risk', 'save-risk']) {
    region('risk-actions').querySelector(`[data-action="${action}"]`).disabled = decision !== 'pending';
  }
}


async function analyzeSelected({ forceMock = false } = {}) {
  if (state.analyzing || state.saving) return;
  const form = region('risk-form');
  const hireId = form?.elements.namedItem('newHireId')?.value ?? '';
  if (!hireId) {
    setViewState(region('risk-state'), { status: 'empty', message: 'Hãy chọn một nhân sự trước khi phân tích.' });
    return;
  }
  const activeMode = forceMock ? AI_MODES.MOCK : getAiMode();
  setViewState(region('risk-state'), {
    status: 'loading',
    message: activeMode === AI_MODES.GEMINI
      ? 'Đang phân tích rủi ro tiến độ bằng Google Gemini API…'
      : 'Đang phân tích rủi ro tiến độ từ dữ liệu mẫu…',
  });
  region('risk-result').hidden = true;
  state.analyzing = true;
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
  try {
    state.analysis = await analyzeProgressRiskWithAi(hireId, { forceMock });
    state.historyId = null;
    setViewState(region('risk-state'), { status: 'ready', message: '' });
    renderAnalysis(state.analysis);
  } catch (error) {
    if (error?.code === 'SUPERSEDED') return;
    state.analysis = null;
    const riskState = region('risk-state');
    riskState.replaceChildren(
      createAiErrorNotice({
        error,
        onRetry: () => analyzeSelected(),
        onFallbackMock: () => analyzeSelected({ forceMock: true }),
        ui: { openModal, showToast },
      }),
    );
    riskState.classList.remove('view-state--empty', 'view-state--loading');
    riskState.classList.add('view-state--error');
    riskState.hidden = false;
  } finally { state.analyzing = false; submit.disabled = false; }
}

async function saveAnalysis(decision) {
  if (!state.analysis || state.saving) return;
  state.saving = true;
  try {
    if (!state.historyId) {
      const saved = await progressRisk.saveRiskEvaluation(state.analysis, '', decision);
      state.historyId = saved.id;
    } else if (decision !== 'pending') aiHistory.decideHistory(state.historyId, decision);
    state.evaluations = await progressRisk.listSavedEvaluations();
    renderAnalysis(state.analysis, { saved: true }); render(); renderHistory();
    showToast({ message: 'Đã lưu quyết định đánh giá.', type: 'success' });
  } catch (error) { showError(error); }
  finally { state.saving = false; }
}
function renderHistory() {
  const list = region('risk-history'); if (!list) return;
  list.replaceChildren(...state.evaluations.map((item) => {
    const group = element('span', 'form__actions');
    group.append(
      actionButton(`${formatDateTime(item.createdAt)} · ${item.newHireId} · ${item.decision}`, 'open-risk', item.id, 'ghost'),
      actionButton('Lưu trữ', 'archive-risk', item.id, 'ghost'),
      actionButton('Xóa', 'delete-risk', item.id, 'ghost'),
    );
    return group;
  }));
}
function editAnalysis() {
  if (!state.analysis) return;
  if (state.historyId && aiHistory.getHistory(state.historyId).decision !== 'pending') { showToast({ message: 'Kết quả đã được quyết định. Hãy tạo đánh giá mới.', type: 'info' }); return; }
  const form = element('form', 'form');
  form.append(createField({ name: 'summary', label: 'Nhận định', type: 'textarea', value: state.analysis.summary, required: true }), createField({ name: 'recommendations', label: 'Đề xuất (mỗi dòng một việc)', type: 'textarea', value: state.analysis.recommendations.join('\n') }), createField({ name: 'reason', label: 'Giải thích', type: 'textarea', value: state.analysis.reason }));
  const button = element('button', 'btn btn--primary', 'Lưu chỉnh sửa'); button.type = 'submit'; form.append(button);
  const modal = openModal({ title: 'Sửa đánh giá rủi ro', content: form });
  bindForm(form, () => {
    const next = { ...state.analysis, summary: form.elements.summary.value, recommendations: form.elements.recommendations.value.split('\n').map(line => line.trim()).filter(Boolean), reason: form.elements.reason.value };
    if (state.historyId) aiHistory.updateHistory(state.historyId, { result: { level: next.level, summary: next.summary, recommendations: next.recommendations }, reason: next.reason });
    state.analysis = next; renderAnalysis(next, { saved: Boolean(state.historyId) }); modal.close();
  });
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

export async function initPage() {
  initOrganizationManagement();

  // Gắn thanh trạng thái AI ngay trước form phân tích rủi ro
  const statusBar = createAiStatusBar({
    ui: { openModal, showToast },
    onModeChange: () => {
      renderHistory();
    },
  });
  region('risk-form')?.before(statusBar);

  const filters = region('dashboard-filters');
  filters?.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  filters?.addEventListener('input', render);
  filters?.addEventListener('change', render);
  region('risk-form')?.addEventListener('submit', (event) => { event.preventDefault(); if (validateFields(event.currentTarget)) analyzeSelected(); });
  root().addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.type === 'submit' || state.saving) return;
    const { action, id } = button.dataset;
    try {
      if (action === 'open-newhire') viewHireDetail(id);
      else if (action === 'accept-risk') saveAnalysis('accepted');
      else if (action === 'save-risk') saveAnalysis('pending');
      else if (action === 'reject-risk') saveAnalysis('rejected');
      else if (action === 'rerun-risk') analyzeSelected();
      else if (action === 'edit-risk') editAnalysis();
      else if (action === 'open-risk') {
        const item = aiHistory.getHistory(id);
        state.historyId = id;
        state.analysis = { ...item.result, hireId: item.newHireId, reason: item.reason };
        region('risk-form').elements.newHireId.value = item.newHireId;
        renderAnalysis(state.analysis, { saved: true });
      } else if (action === 'archive-risk' && await confirmAction({
        title: 'Lưu trữ đánh giá?',
        message: 'Bản ghi sẽ được ẩn khỏi dashboard nhưng vẫn giữ trong dữ liệu đối chiếu.',
      })) {
        aiHistory.archiveHistory(id);
        if (state.historyId === id) {
          state.historyId = null;
          state.analysis = null;
          region('risk-result').hidden = true;
        }
        await load();
      } else if (action === 'delete-risk' && await confirmAction({
        title: 'Xóa đánh giá?',
        message: 'Bản ghi đánh giá sẽ bị xóa vĩnh viễn.',
        tone: 'danger',
      })) {
        aiHistory.deleteHistory(id);
        if (state.historyId === id) {
          state.historyId = null;
          state.analysis = null;
          region('risk-result').hidden = true;
        }
        await load();
      }
    } catch (error) { showError(error); }
  });
  watchData(['users', 'newHires', 'tasks', 'checkins', 'aiHistory', 'departments'], load, region('dashboard-state'));
}
