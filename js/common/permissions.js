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
  if (entity === 'checkins') return operation === 'read'
    ? (role === 'mentor' && mentorsNewHire(currentUser, resource)) || (role === 'newhire' && ownsNewHire(currentUser, resource) && resource.sharedWithNewHire === true)
    : role === 'mentor' && mentorsNewHire(currentUser, resource);
  if (entity === 'newHires' || entity === 'journeyAssignments') return operation === 'read'
    && ((role === 'newhire' && ownsNewHire(currentUser, resource)) || (role === 'mentor' && mentorsNewHire(currentUser, resource)) || role === 'hr');
  if (entity === 'journeys') return role === 'hr' || (operation === 'read' && resource.assignedToUserId === currentUser.id);
  if (entity === 'users') {
    if (role === 'admin') return true;
    if (operation !== 'read') return false;
    return resource.id === currentUser.id || resource.mentorForUserId === currentUser.id
      || (role === 'mentor' && resource.assignedMentorId === currentUser.id)
      || (role === 'hr' && ['newhire', 'mentor'].includes(resource.role));
  }
  if (entity === 'departments') return operation === 'read' || role === 'admin';
  if (entity === 'settings') return operation === 'read' || role === 'admin';
  return false;
}

export function getEditableFields(currentUser, entity, resource = {}) {
  if (!isActive(currentUser)) return [];
  if ((entity === 'users' || entity === 'profile') && resource.id === currentUser.id) return ['fullName', 'phone', 'avatarUrl'];
  if (entity === 'tasks' && can(currentUser, 'tasks:submit', resource)) return ['result'];
  return [];
}
