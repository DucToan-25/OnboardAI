/*
 * progress-risk.js — đánh giá rủi ro tiến độ cho HR (hợp đồng mục 5.6–5.7).
 * OWNER: SV3.
 *
 * - Số liệu lấy từ newHires/tasks/checkins hiện tại; PHẦN TRĂM tiến độ chỉ lấy
 *   từ getProgress() của SV2 (tasks.js), không tạo công thức phần trăm khác.
 * - Khi thiếu dữ liệu (tasks.js chưa sẵn sàng, chưa có task, thiếu liên kết),
 *   trả level = 'unknown' kèm giải thích; KHÔNG BAO GIỜ coi thiếu dữ liệu là rủi ro thấp.
 * - Kết quả/đề xuất được lưu vào aiHistory qua ai-history.js (SV1) khi người dùng chọn Lưu.
 */
import { createHistory, listMyHistory } from './ai-history.js';
import { requireRoles } from './auth.js';
import { StoreError, getAll, getById } from './store.js';
import { getProgress, getTasksForHire } from './tasks.js';
import { listCheckins } from './resources.js';
import { getTodayDate } from '../common/format.js';

const HR_ROLES = ['hr', 'admin'];
const LEVEL_ORDER = { low: 0, medium: 1, high: 2 };

export const RISK_LEVEL_LABELS = Object.freeze({
  low: { label: 'Thấp', tone: 'success' },
  medium: { label: 'Trung bình', tone: 'warning' },
  high: { label: 'Cao', tone: 'danger' },
  unknown: { label: 'Chưa đủ dữ liệu', tone: 'neutral' },
});

function todayString() { return getTodayDate(); }

function bump(level, target) {
  return LEVEL_ORDER[target] > LEVEL_ORDER[level] ? target : level;
}

function linkIndex() {
  return {
    users: new Map(getAll('users').map(user => [user.id, user])),
    journeys: new Map(getAll('journeys').map(journey => [journey.id, journey])),
  };
}

function getLinks(hire, index) {
  const user = index.users.get(hire.userId);
  const mentor = index.users.get(hire.mentorId);
  const journey = index.journeys.get(hire.journeyId);
  return {
    user,
    mentor,
    hasUser: user?.role === 'newHire',
    hasMentor: mentor?.role === 'mentor' && mentor.status === 'active',
    // Inactive journeys keep their existing assignments and history.
    hasJourney: Boolean(journey),
  };
}

/** Danh sách nhân sự mới cho bảng dashboard và select rủi ro (join user + phòng ban). */
export async function listHires() {
  await requireRoles(HR_ROLES);
  const [hires, departments] = await Promise.all([
    getAll('newHires'), getAll('departments'),
  ]);
  const index = linkIndex();
  return hires.map((hire) => {
    const { user, mentor, hasUser, hasMentor, hasJourney } = getLinks(hire, index);
    const department = departments.find((item) => item.id === hire.departmentId) ?? null;
    return {
      hireId: hire.id,
      userId: hire.userId,
      fullName: user?.fullName ?? null,
      email: user?.email ?? null,
      departmentId: hire.departmentId,
      departmentName: department?.name ?? hire.departmentId ?? null,
      mentorName: mentor?.fullName ?? null,
      hasUser,
      hasMentor,
      hasJourney,
      status: hire.status,
      startDate: hire.startDate ?? null,
    };
  });
}

/**
 * Phân tích rủi ro một nhân sự. Trả về:
 * { hireId, level, tone, summary, reason, recommendations, progress, signals }.
 * level ∈ low | medium | high | unknown.
 */
export async function analyzeRisk(hireId) {
  await requireRoles(HR_ROLES);
  const hireRecord = getById('newHires', hireId);
  if (!hireRecord) throw new StoreError('NOT_FOUND', `Không tìm thấy hồ sơ nhân sự ${hireId}.`);
  const { hasUser, hasMentor, hasJourney } = getLinks(hireRecord, linkIndex());

  const ownTasks = getTasksForHire(hireId).filter(task => task.status !== 'archived');
  const today = todayString();
  const overdue = ownTasks.filter((task) => task.status !== 'completed'
    && typeof task.dueDate === 'string' && task.dueDate && task.dueDate < today).length;
  const blocked = ownTasks.filter((task) => task.status === 'blocked').length;
  const signals = {
    totalTasks: ownTasks.length,
    overdueTasks: overdue,
    blockedTasks: blocked,
    hasUser,
    hasMentor,
    hasJourney,
    checkins: listCheckins({ newHireId: hireId }).filter(item => item.status !== 'cancelled').length,
  };

  const missing = [];
  if (!hasUser) missing.push('thiếu tài khoản nhân sự mới hợp lệ');
  if (!hasMentor) missing.push('chưa có người hướng dẫn đang hoạt động');
  if (!hasJourney) missing.push('thiếu hành trình hợp lệ');

  let progress = null;
  let progressError = null;
  try {
    progress = await getProgress(hireId);
  } catch (error) {
    progressError = error;
  }

  if (!progress) {
    const detail = `Không lấy được tiến độ: ${progressError?.message ?? 'lỗi không rõ'}.`;
    return {
      hireId,
      level: 'unknown',
      tone: RISK_LEVEL_LABELS.unknown.tone,
      summary: 'Chưa đủ dữ liệu để đánh giá rủi ro tiến độ.',
      reason: `${detail} Hệ thống không suy đoán rủi ro thấp khi thiếu số liệu.${missing.length ? ` Ngoài ra hồ sơ ${missing.join(', ')}.` : ''}`,
      recommendations: [
        'Kiểm tra dữ liệu nhiệm vụ và liên kết hồ sơ nhân sự.',
        ...(missing.length ? [`Bổ sung thông tin còn thiếu: ${missing.join(', ')}.`] : []),
      ],
      progress: null,
      signals,
    };
  }

  if (progress.total === 0 || missing.length) {
    return {
      hireId,
      level: 'unknown',
      tone: RISK_LEVEL_LABELS.unknown.tone,
      summary: 'Chưa đủ dữ liệu để đánh giá tiến độ.',
      reason: [progress.total === 0 ? 'Nhân sự chưa có nhiệm vụ nào (không tính archived).' : '', missing.length ? `Hồ sơ ${missing.join(', ')}.` : '', 'Thiếu dữ liệu không đồng nghĩa với rủi ro thấp.'].filter(Boolean).join(' '),
      recommendations: [
        ...(progress.total === 0 ? ['Giao nhiệm vụ đầu tiên cho nhân sự để có dữ liệu tiến độ.'] : []),
        ...(missing.length ? [`Bổ sung thông tin còn thiếu: ${missing.join(', ')}.`] : []),
      ],
      progress,
      signals,
    };
  }

  let level = progress.percent < 40 ? 'high' : progress.percent < 70 ? 'medium' : 'low';
  if (overdue > 0) level = bump(level, overdue >= 3 ? 'high' : 'medium');
  if (blocked > 0) level = bump(level, 'medium');

  const reasonParts = [`Tiến độ ${progress.completed}/${progress.total} nhiệm vụ (${progress.percent}%).`];
  if (overdue > 0) reasonParts.push(`${overdue} nhiệm vụ quá hạn.`);
  if (blocked > 0) reasonParts.push(`${blocked} nhiệm vụ bị chặn.`);
  if (missing.length) reasonParts.push(`Hồ sơ ${missing.join(', ')}.`);
  if (level === 'low') reasonParts.push('Không có tín hiệu rủi ro đáng kể.');

  const recommendations = [];
  if (overdue > 0) recommendations.push('Liên hệ mentor rà soát các nhiệm vụ quá hạn.');
  if (blocked > 0) recommendations.push('Xử lý các nhiệm vụ bị chặn hoặc điều phối nguồn lực hỗ trợ.');
  if (progress.percent < 40) recommendations.push('Lập kế hoạch hoàn thành gấp các nhiệm vụ còn lại trong tuần này.');
  if (missing.length) recommendations.push(`Bổ sung thông tin hồ sơ: ${missing.join(', ')}.`);
  if (!recommendations.length) recommendations.push('Duy trì nhịp độ hiện tại và kiểm tra định kỳ.');

  return {
    hireId,
    level,
    tone: RISK_LEVEL_LABELS[level].tone,
    summary: `Rủi ro ${RISK_LEVEL_LABELS[level].label.toLocaleLowerCase('vi')}: ${progress.percent}% tiến độ, ${overdue} nhiệm vụ quá hạn.`,
    reason: reasonParts.join(' '),
    recommendations,
    progress,
    signals,
  };
}

/** Lưu kết quả đánh giá vào aiHistory (featureType = progressRisk) cho HR xem lại. */
export async function saveRiskEvaluation(analysis, note = '') {
  await requireRoles(HR_ROLES);
  if (!analysis || typeof analysis !== 'object' || !analysis.hireId) {
    throw new StoreError('VALIDATION_ERROR', 'saveRiskEvaluation cần kết quả analyzeRisk().');
  }
  return createHistory({
    featureType: 'progressRisk',
    newHireId: analysis.hireId,
    input: `Đánh giá rủi ro tiến độ ${analysis.hireId}`,
    result: {
      level: analysis.level,
      summary: analysis.summary,
      recommendations: analysis.recommendations,
    },
    reason: `${analysis.reason}${note ? ` Ghi chú HR: ${note}` : ''}`,
  });
}

/** Các đánh giá đã lưu của người đang đăng nhập (HR/Admin). */
export async function listSavedEvaluations() {
  await requireRoles(HR_ROLES);
  return listMyHistory('progressRisk');
}
