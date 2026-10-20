import { ROUTES } from '../config/routes.js';
export function canOpenPage(user, pageId) {
  const route = ROUTES[pageId];
  return Boolean(route && (route.public || (user?.status === 'active' && route.allowedRoles.includes(user.role))));
}
export function can(user, action, resource = {}) {
  const [entity, operation] = action.split(':');
  if (operation === 'read' && entity === 'companyInfo') return resource.id === 'company-001';
  if (operation === 'read' && entity === 'news' && resource.status === 'published') return true;
  if (user?.status !== 'active') return false;
  const manager = ['hr', 'admin'].includes(user.role);
  const hire = resource.newHire || resource;
  const own = hire.userId === user.id;
  const mentee = hire.mentorId === user.id;
  switch (entity) {
    case 'profile': return resource.id === user.id && ['read', 'update'].includes(operation);
    case 'documents': {
      if (operation !== 'read') return manager && ['create', 'update', 'publish', 'archive'].includes(operation);
      if (manager) return true;
      if (resource.status !== 'active') return false;
      const audience = resource.targetRole === 'newhire' ? 'newHire' : resource.targetRole;
      return (audience === 'all' || audience === user.role || (audience === 'engineer' && user.departmentId === 'dept-engineering'))
        && (resource.departmentId == null || resource.departmentId === user.departmentId);
    }
    case 'tasks': return (manager || (user.role === 'mentor' && mentee)) && ['read', 'create', 'update', 'archive', 'status'].includes(operation)
      || (user.role === 'newHire' && own && ['read', 'status', 'result'].includes(operation));
    case 'checkins': return (user.role === 'mentor' && mentee && ['read', 'create', 'update', 'cancel'].includes(operation)) || (manager && operation === 'read');
    case 'newHires': return manager && ['read', 'create', 'update'].includes(operation) || operation === 'read' && (own || user.role === 'mentor' && mentee);
    case 'users': return user.role === 'admin' && ['read', 'create', 'update', 'disable', 'restore'].includes(operation) || operation === 'read' && resource.id === user.id;
    case 'departments': return operation === 'read' || user.role === 'admin' && ['create', 'update', 'archive'].includes(operation);
    case 'journeys': return manager && ['read', 'create', 'update', 'archive'].includes(operation);
    case 'companyInfo': return manager && operation === 'update';
    case 'news': return manager && ['read', 'create', 'update', 'publish', 'archive', 'restore'].includes(operation);
    case 'settings': return user.role === 'admin' && ['read', 'update', 'reset'].includes(operation);
    default: return false;
  }
}
export function getEditableFields(user, entity, resource = {}) {
  if (!can(user, `${entity}:update`, resource)) return [];
  return ({
    profile: ['fullName', 'email'], users: ['fullName', 'email', 'password', 'role', 'departmentId', 'jobTitle', 'status'],
    newHires: ['departmentId', 'jobTitle', 'mentorId', 'journeyId', 'startDate', 'status', 'notes'],
    departments: ['name', 'description', 'managerId', 'status'],
    documents: ['title', 'category', 'description', 'fileUrl', 'departmentId', 'targetRole', 'status'],
    tasks: ['title', 'description', 'category', 'priority', 'dueDate', 'status'], checkins: ['scheduledAt', 'status', 'note', 'nextAction'],
    journeys: ['title', 'description', 'departmentId', 'targetRole', 'durationDays'],
    companyInfo: ['companyName', 'tagline', 'mission', 'vision', 'coreValues', 'about', 'logoUrl'],
    news: ['title', 'summary', 'content', 'category', 'isFeatured'], settings: ['organizationName', 'supportEmail', 'supportPhone', 'onboardingDays', 'reminderDays'],
  })[entity] || [];
}
