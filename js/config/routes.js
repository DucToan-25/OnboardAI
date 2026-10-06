import { APP_CONFIG } from './app.js';

const all = ['newhire', 'mentor', 'hr', 'admin'];
function route(pageId, allowedRoles, isPublic = false) {
  return {
    public: isPublic, allowedRoles, layout: isPublic ? 'simple' : 'app',
    available: APP_CONFIG.availablePages.includes(pageId),
    loadPage: () => import(`../pages/${['403', '404'].includes(pageId) ? 'error' : pageId}.js`),
  };
}
export const ROUTES = Object.freeze({
  login: route('login', [], true), profile: route('profile', all),
  'newhire-onboarding-dashboard': route('newhire-onboarding-dashboard', ['newhire']),
  'newhire-checklist': route('newhire-checklist', ['newhire']),
  'newhire-ai-help': route('newhire-ai-help', ['newhire']),
  'newhire-document-library': route('newhire-document-library', ['newhire']),
  'mentor-mentee-list': route('mentor-mentee-list', ['mentor']),
  'mentor-checkin-note': route('mentor-checkin-note', ['mentor']),
  'mentor-task-assignment': route('mentor-task-assignment', ['mentor']),
  'hr-document-library': route('hr-document-library', ['hr', 'admin', 'mentor']),
  'document-detail': route('document-detail', all),
  'hr-journey-management': route('hr-journey-management', ['hr']),
  'hr-dashboard': route('hr-dashboard', ['hr']),
  'admin-department-management': route('admin-department-management', ['admin']),
  'admin-user-management': route('admin-user-management', ['admin']),
  'admin-system-settings': route('admin-system-settings', ['admin']),
  '403': route('403', [], true), '404': route('404', [], true),
});
