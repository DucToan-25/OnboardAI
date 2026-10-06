import { createMockRepository } from './mock-repository.js';

export async function createRepository({ currentUser, mode = 'preview' }) {
  if (!['preview', 'mock'].includes(mode)) throw Object.assign(new Error('Adapter API chưa được tích hợp.'), { code: 'NETWORK_ERROR' });
  return createMockRepository({ currentUser });
}
