import { getPreviewUser, clearPreviewCache } from '../data/mock-repository.js';

const SESSION_KEY = 'onboardai:preview-user-id';
export async function getCurrentUser() {
  const userId = sessionStorage.getItem(SESSION_KEY);
  if (!userId) return null;
  try { return await getPreviewUser(userId); }
  catch (error) {
    if (error.code === 'FORBIDDEN') { sessionStorage.removeItem(SESSION_KEY); return null; }
    throw error;
  }
}
export async function setPreviewUser(userId) {
  const user = await getPreviewUser(userId);
  sessionStorage.setItem(SESSION_KEY, user.id);
  clearPreviewCache();
  return user;
}
export async function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  clearPreviewCache();
}
