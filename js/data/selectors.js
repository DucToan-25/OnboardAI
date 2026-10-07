export function calculateProgress(tasks = []) {
  const counted = tasks.filter((task) => task.status !== 'canceled');
  const total = counted.length;
  const completed = counted.filter((task) => task.status === 'completed').length;
  return { total, completed, percent: total ? Math.round(completed / total * 100) : 0 };
}

export function analyzeProgressRisk(tasks = []) {
  const progress = calculateProgress(tasks);
  const remaining = progress.total - progress.completed;
  const hasData = progress.total > 0;
  const today = getTodayDate();
  const overdue = tasks.filter((task) => !['completed', 'canceled'].includes(task.status)
    && task.dueDate && task.dueDate < today).length;
  const atRisk = hasData && progress.percent < 40;
  const level = !hasData ? 'Chưa đủ dữ liệu'
    : atRisk ? 'Cao' : progress.percent < 70 ? 'Trung bình' : 'Thấp';
  const tone = !hasData ? 'neutral' : atRisk ? 'danger'
    : progress.percent < 70 ? 'warning' : 'success';
  return { progress, overdue, remaining, hasData, atRisk, level, tone };
}
import { getTodayDate } from '../common/format.js';
