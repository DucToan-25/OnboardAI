import { ROUTES } from '../config/routes.js';

function isActive(user) {
  return Boolean(user && user.status === 'active');
}

function ownsNewHire(user, resource) {
  const newHire = resource?.newHire || resource;
  return newHire?.userId === user.id;
}

function mentorsNewHire(user, resource) {
  const newHire = resource?.newHire || resource;
  return newHire?.mentorId === user.id;
}

export function canOpenPage(currentUser, pageId) {
  const route = ROUTES[pageId];
  if (!route) return false;
  return route.public || (isActive(currentUser) && route.allowedRoles.includes(currentUser.role));
}

export function can(currentUser, action, resource = {}) {
  if (action === 'portalPosts:read') return resource.status === 'published' && resource.visibility === 'public';
  if (!isActive(currentUser)) return false;
  const role = currentUser.role;
  const [entity, operation] = action.split(':');
  if (entity === 'profile') return resource.id === currentUser.id && ['read', 'update'].includes(operation);
  if (entity === 'documents') {
    if (['create', 'update', 'archive', 'publish'].includes(operation)) return ['hr', 'admin'].includes(role);
    if (operation !== 'read') return false;
    if (['hr', 'admin'].includes(role)) return true;
    return resource.status === 'published' && Array.isArray(resource.audienceRoles) && resource.audienceRoles.includes(role)
      && Array.isArray(resource.departmentIds) && (!resource.departmentIds.length || resource.departmentIds.includes(currentUser.departmentId));
  }
  if (entity === 'tasks') {
    if (operation === 'read') return (role === 'newhire' && ownsNewHire(currentUser, resource))
      || (role === 'mentor' && mentorsNewHire(currentUser, resource)) || role === 'hr';
    if (operation === 'submit') return role === 'newhire' && ownsNewHire(currentUser, resource)
      && ['pending', 'in_progress', 'changes_requested'].includes(resource.status);
    if (['create', 'update', 'cancel', 'review'].includes(operation)) return role === 'mentor' && mentorsNewHire(currentUser, resource);
  }
  if (entity === 'checkins') {
    if (operation === 'read') return (role === 'mentor' && mentorsNewHire(currentUser, resource))
      || (role === 'newhire' && ownsNewHire(currentUser, resource) && resource.sharedWithNewHire === true);
    return ['create', 'update', 'cancel'].includes(operation)
      && role === 'mentor' && mentorsNewHire(currentUser, resource);
  }
  if (entity === 'newHires' || entity === 'journeyAssignments') return operation === 'read'
    && ((role === 'newhire' && ownsNewHire(currentUser, resource)) || (role === 'mentor' && mentorsNewHire(currentUser, resource)) || role === 'hr');
  if (entity === 'journeys') return (role === 'hr' && ['read', 'create', 'update', 'archive'].includes(operation))
    || (operation === 'read' && resource.assignedToUserId === currentUser.id);
  if (entity === 'users') {
    if (operation === 'disable' && resource.id === currentUser.id) return false;
    if (role === 'admin') return ['read', 'create', 'update', 'disable', 'restore'].includes(operation);
    if (operation !== 'read') return false;
    return resource.id === currentUser.id || resource.mentorForUserId === currentUser.id
      || (role === 'mentor' && resource.assignedMentorId === currentUser.id)
      || (role === 'hr' && ['newhire', 'mentor'].includes(resource.role));
  }
  if (entity === 'departments') return operation === 'read'
    || (role === 'admin' && ['create', 'update', 'archive'].includes(operation));
  if (entity === 'settings') return operation === 'read'
    || (role === 'admin' && ['update', 'reset'].includes(operation));
  return false;
}

export function getEditableFields(currentUser, entity, resource = {}) {
  if (!isActive(currentUser)) return [];
  if (entity === 'profile' && resource.id === currentUser.id) return ['fullName', 'phone', 'avatarUrl'];
  if (entity === 'users' && can(currentUser, 'users:update', resource)) {
    return ['fullName', 'email', 'phone', 'role', 'departmentId', 'jobTitle', 'status'];
  }
  if (entity === 'departments' && can(currentUser, 'departments:update', resource)) return ['name', 'description', 'status'];
  if (entity === 'journeys' && can(currentUser, 'journeys:update', resource)) return ['name', 'departmentId', 'status', 'steps'];
  if (entity === 'documents' && can(currentUser, 'documents:update', resource)) {
    return ['title', 'category', 'content', 'status', 'audienceRoles', 'departmentIds'];
  }
  if (entity === 'settings' && can(currentUser, 'settings:update', resource)) return ['organizationName', 'supportEmail', 'supportPhone', 'onboardingDays', 'reminderDays'];
  if (entity === 'tasks' && can(currentUser, 'tasks:update', resource)) return ['title', 'description', 'dueDate', 'relatedDocumentIds'];
  if (entity === 'tasks' && can(currentUser, 'tasks:submit', resource)) return ['result'];
  if (entity === 'checkins' && can(currentUser, 'checkins:update', resource)) return ['scheduledAt', 'note', 'status'];
  return [];
}
