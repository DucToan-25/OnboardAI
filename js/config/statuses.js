// Shared labels and tones; persisted records keep the status codes only.
export const STATUS_META = Object.freeze({
  tasks: {
    pending: { label: 'Chưa bắt đầu', tone: 'neutral' },
    in_progress: { label: 'Đang thực hiện', tone: 'info' },
    submitted: { label: 'Chờ duyệt', tone: 'info' },
    changes_requested: { label: 'Cần chỉnh sửa', tone: 'warning' },
    completed: { label: 'Hoàn thành', tone: 'success' },
    canceled: { label: 'Đã hủy', tone: 'neutral' }
  },
  documents: {
    draft: { label: 'Bản nháp', tone: 'neutral' },
    published: { label: 'Đã phát hành', tone: 'success' },
    archived: { label: 'Đã lưu trữ', tone: 'neutral' }
  },
  users: {
    active: { label: 'Hoạt động', tone: 'success' },
    disabled: { label: 'Vô hiệu hóa', tone: 'neutral' }
  },
  departments: {
    active: { label: 'Hoạt động', tone: 'success' },
    archived: { label: 'Đã lưu trữ', tone: 'neutral' }
  },
  journeys: {
    draft: { label: 'Bản nháp', tone: 'neutral' },
    active: { label: 'Đang áp dụng', tone: 'success' },
    archived: { label: 'Đã lưu trữ', tone: 'neutral' }
  },
  journeyAssignments: {
    active: { label: 'Đang hội nhập', tone: 'info' },
    completed: { label: 'Hoàn thành', tone: 'success' },
    archived: { label: 'Đã lưu trữ', tone: 'neutral' }
  },
  newHires: {
    active: { label: 'Đang hội nhập', tone: 'info' },
    completed: { label: 'Hoàn thành', tone: 'success' },
    archived: { label: 'Đã lưu trữ', tone: 'neutral' }
  },
  checkins: {
    scheduled: { label: 'Đã lên lịch', tone: 'info' },
    completed: { label: 'Hoàn thành', tone: 'success' },
    canceled: { label: 'Đã hủy', tone: 'neutral' }
  }
});
