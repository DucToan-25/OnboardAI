
export const ROLES = Object.freeze({ NEWHIRE: 'newHire', MENTOR: 'mentor', HR: 'hr', ADMIN: 'admin' });
export const ROLE_LABELS = Object.freeze({ newHire: 'Nhân sự mới', mentor: 'Người hướng dẫn', hr: 'Nhân sự', admin: 'Quản trị viên' });
export const ROLE_HOME = Object.freeze({
  newHire: 'newhire-onboarding-dashboard.html', mentor: 'mentor-mentee-list.html',
  hr: 'hr-dashboard.html', admin: 'admin-user-management.html',
});
export const ROLE_LIBRARY = Object.freeze({
  newHire: 'newhire-document-library',
  mentor: 'hr-document-library',
  hr: 'hr-document-library',
  admin: 'hr-document-library',
});
const profile = { pageId: 'profile', label: 'Hồ sơ cá nhân', icon: 'user' };
const library = { pageId: 'hr-document-library', label: 'Thư viện tài liệu', icon: 'folder' };
export const ROLE_MENUS = Object.freeze({
  newHire: [
    { pageId: 'newhire-onboarding-dashboard', label: 'Tổng quan', icon: 'grid' },
    { pageId: 'newhire-checklist', label: 'Checklist nhiệm vụ', icon: 'checklist' },
    { pageId: 'newhire-document-library', label: 'Thư viện tài liệu', icon: 'folder' },
    { pageId: 'newhire-ai-help', label: 'Trợ giúp AI', icon: 'chat' }, profile,
  ],
  mentor: [
    { pageId: 'mentor-mentee-list', label: 'Danh sách mentee', icon: 'user' },
    { pageId: 'mentor-checkin-note', label: 'Ghi chú check-in', icon: 'chat' },
    { pageId: 'mentor-task-assignment', label: 'Giao nhiệm vụ', icon: 'checklist' }, library, profile,
  ],
  hr: [
    { pageId: 'hr-journey-management', label: 'Quản lý hành trình', icon: 'checklist' }, library,
    { pageId: 'hr-dashboard', label: 'Tổng quan nhân sự', icon: 'grid' }, profile,
  ],
  admin: [
    { pageId: 'admin-department-management', label: 'Quản lý phòng ban', icon: 'grid' },
    { pageId: 'admin-user-management', label: 'Quản lý tài khoản', icon: 'user' },
    { pageId: 'admin-system-settings', label: 'Quản lý hệ thống', icon: 'settings' }, library, profile,
  ],
});
