export function calculateProgress(tasks = []) {
  const counted = tasks.filter((task) => task.status !== 'canceled');
  const total = counted.length;
  const completed = counted.filter((task) => task.status === 'completed').length;
  return { total, completed, percent: total ? Math.round(completed / total * 100) : 0 };
}
