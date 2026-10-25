export const TASK_STATUSES = Object.freeze({
  todo: { label: 'Chưa bắt đầu', tone: 'neutral' },
  inProgress: { label: 'Đang thực hiện', tone: 'info' },
  blocked: { label: 'Đang vướng mắc', tone: 'warning' },
  completed: { label: 'Hoàn thành', tone: 'success' },
  archived: { label: 'Đã lưu trữ', tone: 'neutral' },
});

const active = { active: { label: 'Hoạt động', tone: 'success' }, inactive: { label: 'Ngừng hoạt động', tone: 'neutral' } };
export const STATUS_META = Object.freeze({
 tasks: TASK_STATUSES,
 users: { ...active, invited: { label: 'Chờ kích hoạt', tone: 'info' } },
 departments: active, journeys: active,
 newHires: { notStarted: { label: 'Chưa bắt đầu', tone: 'neutral' }, inProgress: { label: 'Đang hội nhập', tone: 'info' }, completed: { label: 'Hoàn thành', tone: 'success' }, archived: { label: 'Đã lưu trữ', tone: 'neutral' } },
 documents: { draft: { label: 'Bản nháp', tone: 'neutral' }, active: { label: 'Đã phát hành', tone: 'success' }, archived: { label: 'Đã lưu trữ', tone: 'neutral' } },
 news: { draft: { label: 'Bản nháp', tone: 'neutral' }, published: { label: 'Đã xuất bản', tone: 'success' }, archived: { label: 'Đã lưu trữ', tone: 'neutral' } },
 checkins: { scheduled: { label: 'Đã lên lịch', tone: 'info' }, completed: { label: 'Hoàn thành', tone: 'success' }, cancelled: { label: 'Đã hủy', tone: 'neutral' } },
});
