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
import { createAiHistory, listAiHistory } from './ai-history.js';
import { requireRoles } from './auth.js';
import { StoreError, getAll, getById } from './store.js';
import { getProgress } from './tasks.js';

const HR_ROLES = ['hr', 'admin'];
const LEVEL_ORDER = { low: 0, medium: 1, high: 2 };

export const RISK_LEVEL_LABELS = Object.freeze({
  low: { label: 'Thấp', tone: 'success' },
  medium: { label: 'Trung bình', tone: 'warning' },
  high: { label: 'Cao', tone: 'danger' },
  unknown: { label: 'Chưa đủ dữ liệu', tone: 'neutral' },
});

function todayString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function bump(level, target) {
  return LEVEL_ORDER[target] > LEVEL_ORDER[level] ? target : level;
}

/** Danh sách nhân sự mới cho bảng dashboard và select rủi ro (join user + phòng ban). */
export async function listHires() {
  await requireRoles(HR_ROLES);
  const [hires, users, departments] = await Promise.all([
    getAll('newHires'), getAll('users'), getAll('departments'),
  ]);
  return hires.map((hire) => {
    const user = users.find((item) => item.id === hire.userId) ?? null;
    const mentor = users.find((item) => item.id === hire.mentorId) ?? null;
    const department = departments.find((item) => item.id === hire.departmentId) ?? null;
    return {
      hireId: hire.id,
      userId: hire.userId,
      fullName: user?.fullName ?? null,
      email: user?.email ?? null,
      departmentName: department?.name ?? hire.departmentId ?? null,
      mentorName: mentor?.fullName ?? null,
      hasMentor: Boolean(hire.mentorId),
      hasJourney: Boolean(hire.journeyId),
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
  const [hireRecord, tasks, checkins] = await Promise.all([
    getById('newHires', hireId), getAll('tasks'), getAll('checkins'),
  ]);
  if (!hireRecord) throw new StoreError('NOT_FOUND', `Không tìm thấy hồ sơ nhân sự ${hireId}.`);

  const ownTasks = tasks.filter((task) => task.newHireId === hireId && task.status !== 'archived');
  const today = todayString();
  const overdue = ownTasks.filter((task) => task.status !== 'completed'
    && typeof task.dueDate === 'string' && task.dueDate && task.dueDate < today).length;
  const blocked = ownTasks.filter((task) => task.status === 'blocked').length;
  const signals = {
    totalTasks: ownTasks.length,
    overdueTasks: overdue,
    blockedTasks: blocked,
    hasMentor: Boolean(hireRecord.mentorId),
    hasJourney: Boolean(hireRecord.journeyId),
    checkins: checkins.filter((item) => item.newHireId === hireId).length,
  };

  const missing = [];
  if (!hireRecord.mentorId) missing.push('chưa gán người hướng dẫn');
  if (!hireRecord.journeyId) missing.push('chưa gán hành trình');

  let progress = null;
  let progressError = null;
  try {
    progress = await getProgress(hireId);
  } catch (error) {
    progressError = error;
  }

  if (!progress) {
    const detail = progressError?.code === 'MODULE_NOT_READY'
      ? 'tasks.js (SV2) chưa triển khai nên chưa đọc được getProgress().'
      : `Không lấy được tiến độ: ${progressError?.message ?? 'lỗi không rõ'}.`;
    return {
      hireId,
      level: 'unknown',
      tone: RISK_LEVEL_LABELS.unknown.tone,
      summary: 'Chưa đủ dữ liệu để đánh giá rủi ro tiến độ.',
      reason: `${detail} Hệ thống không suy đoán rủi ro thấp khi thiếu số liệu.${missing.length ? ` Ngoài ra hồ sơ ${missing.join(', ')}.` : ''}`,
      recommendations: [
        'Hoàn thiện tasks.js (SV2) để đọc getProgress() và tiến độ nhiệm vụ.',
        'Kiểm tra hồ sơ nhân sự: liên kết userId, mentor và hành trình.',
        ...(missing.length ? [`Bổ sung thông tin còn thiếu: ${missing.join(', ')}.`] : []),
      ],
      progress: null,
      signals,
    };
  }

  if (progress.total === 0) {
    return {
      hireId,
      level: 'unknown',
      tone: RISK_LEVEL_LABELS.unknown.tone,
      summary: 'Chưa có nhiệm vụ để đánh giá tiến độ.',
      reason: 'Nhân sự chưa có nhiệm vụ nào (không tính archived). Thiếu dữ liệu không đồng nghĩa với rủi ro thấp.',
      recommendations: [
        'Giao nhiệm vụ đầu tiên cho nhân sự để có dữ liệu tiến độ.',
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
  return createAiHistory({
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
  return listAiHistory({ featureType: 'progressRisk' });
}

