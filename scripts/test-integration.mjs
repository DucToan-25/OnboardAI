import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from './serve.cjs';

// In-memory browser storage: never writes to a user's browser or the seed files.
const memory = new Map();
const networkFetch = globalThis.fetch;
let failWrite = null;
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => { if (failWrite?.(key)) throw new Error('Simulated quota'); memory.set(key, String(value)); },
  removeItem: key => memory.delete(key),
};
globalThis.fetch = async input => {
  try { const content = await fs.readFile(input, 'utf8'); return { ok: true, json: async () => JSON.parse(content.replace(/^\uFEFF/, '')) }; }
  catch { return { ok: false, status: 404 }; }
};
const store = await import('../js/data/store.js');
const auth = await import('../js/common/auth.js');
const people = await import('../js/data/people.js');
const tasks = await import('../js/data/tasks.js');
const resources = await import('../js/data/resources.js');
const organization = await import('../js/data/organization.js');
const ai = await import('../js/data/ai-history.js');
const risk = await import('../js/data/progress-risk.js');
const settings = await import('../js/data/settings.js');
const aiConfig = await import('../js/config/ai-config.js');
const geminiApi = await import('../js/services/gemini-api.js');
const aiService = await import('../js/services/ai-service.js');
const { ROUTES } = await import('../js/config/routes.js');
const { ROLE_MENUS } = await import('../js/config/roles.js');
const { parseStoredDate } = await import('../js/common/format.js');
let passed = 0; let failed = 0;
async function test(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
  finally { failWrite = null; }
}
await store.initStore();
const seedUsers = store.getAll('users');
const canonicalFetch = globalThis.fetch;
let reloadNumber = 0;
const reloadStore = () => import(`../js/data/store.js?reload=${++reloadNumber}`);
// Each scenario simulates a fresh page load without touching source JSON/browser data.
async function withSeedSync(run) {
  const backup = new Map(memory);
  const source = Object.fromEntries(await Promise.all(store.COLLECTIONS.map(async name => [name, await (await canonicalFetch(new URL(`../assets/data/${name}.json`, import.meta.url))).json()])));
  source.version = JSON.parse(memory.get('onboardai_seedVersions'));
  const requests = [];
  globalThis.fetch = async (input, options) => {
    assert.equal(options?.cache, 'no-store');
    const name = new URL(input).pathname.split('/').pop().replace(/\.json$/, '');
    requests.push(name);
    return { ok: true, json: async () => structuredClone(source[name]) };
  };
  try { await run(source, requests); }
  finally {
    globalThis.fetch = canonicalFetch; failWrite = null;
    memory.clear(); for (const [key, value] of backup) memory.set(key, value);
  }
}
const account = role => seedUsers.find(user => user.role === role && user.status === 'active');
const login = role => { const user = account(role); return auth.login(user.email, user.password); };
let department, journey, hire, newUser, task, history, document, news, checkin;

await test('all page modules and 19 route/menu targets exist', async () => {
  assert.equal(Object.keys(ROUTES).length, 19);
  for (const [id, route] of Object.entries(ROUTES)) {
    await fs.access(id === 'index' ? 'index.html' : `pages/${id}.html`);
    assert.equal(typeof (await route.loadPage()).initPage, 'function');
  }
  for (const [role, menu] of Object.entries(ROLE_MENUS)) for (const item of menu) assert.ok(ROUTES[item.pageId].allowedRoles.includes(role));
});
await test('all routed JavaScript modules parse without merge markers', async () => {
  for (const file of (await fs.readdir('js', { recursive: true })).filter(name => name.endsWith('.js'))) {
    const source = await fs.readFile(`js/${file}`, 'utf8'); assert.doesNotMatch(source, /^(<<<<<<<|=======|>>>>>>>)/m);
  }
});
await test('initialization shares one promise and preserves []', async () => {
  assert.equal(store.initStore(), store.initStore());
  const original = memory.get('onboardai_checkins'); memory.set('onboardai_checkins', '[]');
  await store.initStore(); assert.deepEqual(store.getAll('checkins'), []); memory.set('onboardai_checkins', original);
});
await test('all registered collections load from canonical JSON', async () => {
  for (const name of store.COLLECTIONS) {
    const items = JSON.parse(await fs.readFile(`assets/data/${name}.json`, 'utf8'));
    assert.deepEqual(store.getAll(name), items);
  }
});
await test('canonical foreign keys and check-in appointments are consistent', () => {
  const indexes = Object.fromEntries(store.COLLECTIONS.map((name) => [name, new Set(store.getAll(name).map((item) => item.id))]));
  const references = {
    users: { departmentId: 'departments' },
    newHires: { userId: 'users', departmentId: 'departments', mentorId: 'users', journeyId: 'journeys' },
    tasks: { newHireId: 'newHires', journeyId: 'journeys', assignedTo: 'users', createdBy: 'users' },
    departments: { managerId: 'users' },
    documents: { departmentId: 'departments', createdBy: 'users' },
    checkins: { newHireId: 'newHires', mentorId: 'users' },
    journeys: { departmentId: 'departments', createdBy: 'users' },
  };
  for (const [collection, fields] of Object.entries(references)) {
    for (const item of store.getAll(collection)) {
      for (const [field, target] of Object.entries(fields)) {
        if (item[field] != null) assert.ok(indexes[target].has(item[field]), `${collection}/${item.id}/${field}`);
      }
    }
  }
  const appointments = new Set();
  for (const item of store.getAll('checkins').filter((checkin) => checkin.status !== 'cancelled')) {
    const key = `${item.newHireId}|${item.mentorId}|${parseStoredDate(item.scheduledAt).toISOString()}`;
    assert.ok(!appointments.has(key), `duplicate ${item.id}`);
    appointments.add(key);
  }
});
await test('version bump replaces all 12 collections including added, edited and deleted IDs', () => withSeedSync(async source => {
  const removed = new Map();
  for (const name of store.COLLECTIONS) {
    source.version[name]++;
    const local = JSON.parse(memory.get(`onboardai_${name}`));
    local.push({ id: `browser-only-${name}` });
    memory.set(`onboardai_${name}`, JSON.stringify(local));
    if (source[name].length > 1) removed.set(name, source[name].pop().id);
    if (name === 'settings') {
      source.settings[0] = { ...source.settings[0], organizationName: 'Seed sync settings' };
    } else if (name === 'aiHistory') {
      source.aiHistory.push({
        id: 'sync-aiHistory',
        draftId: 'sync-draft',
        featureType: 'policyQA',
        userId: source.users[0].id,
        newHireId: source.newHires[0].id,
        input: 'Seed sync',
        result: { answer: 'Seed answer', sourceDocumentId: null },
        reason: 'Seed test',
        decision: 'pending',
        appliedTaskIds: [],
        archivedAt: null,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      });
    } else if (name === 'documents') {
      const doc = source.documents[0] || {};
      source.documents.push({
        ...doc,
        id: 'sync-documents',
        knowledge: (doc.knowledge || []).map((k, i) => ({
          ...k,
          id: `sync-knowledge-${i}`,
          sourceDocumentId: 'sync-documents',
        })),
      });
    } else {
      source[name].push({ ...(source[name][0] || {}), id: `sync-${name}`, ...(name === 'users' ? { email: 'seed-sync@example.test' } : {}) });
    }
  }
  const local = JSON.parse(memory.get('onboardai_users'));
  local[0].fullName = 'Browser edit';
  memory.set('onboardai_users', JSON.stringify(local));
  memory.set('onboardai_currentUser', JSON.stringify({ userId: local[0].id }));
  const fresh = await reloadStore(); await fresh.initStore();
  for (const name of store.COLLECTIONS) {
    assert.deepEqual(fresh.getAll(name), source[name]);
    assert.equal(fresh.getById(name, `browser-only-${name}`), null);
    if (removed.has(name)) assert.equal(fresh.getById(name, removed.get(name)), null);
  }
  assert.equal(fresh.getById('users', local[0].id).fullName, source.users[0].fullName);
  assert.equal(fresh.getCurrentUserId(), local[0].id);
  assert.deepEqual(JSON.parse(memory.get('onboardai_seedVersions')), source.version);
}));
await test('unchanged versions fetch only manifest and preserve empty collections', () => withSeedSync(async (source, requests) => {
  memory.set('onboardai_checkins', '[]');
  const local = JSON.parse(memory.get('onboardai_users'));
  local[0].fullName = 'Browser edit';
  memory.set('onboardai_users', JSON.stringify(local));
  const fresh = await reloadStore(); await fresh.initStore();
  assert.deepEqual(requests, ['version']);
  assert.deepEqual(fresh.getAll('checkins'), []);
  assert.equal(fresh.getById('users', local[0].id).fullName, 'Browser edit');
}));
await test('legacy users-only version migrates all collections, even if users version already matches', () => withSeedSync(async source => {
  memory.delete('onboardai_seedVersions');
  memory.set('onboardai_usersSeedVersion', JSON.stringify(source.version.users));
  source.users.push({ ...source.users[0], id: 'sync-user', email: 'legacy-sync@example.test' });
  source.tasks.push({ ...source.tasks[0], id: 'sync-task' });
  const fresh = await reloadStore(); await fresh.initStore();
  assert.ok(fresh.getById('users', 'sync-user')); assert.ok(fresh.getById('tasks', 'sync-task'));
}));
await test('missing collection reloads even when its version matches', () => withSeedSync(async source => {
  memory.delete('onboardai_news');
  const fresh = await reloadStore(); await fresh.initStore();
  assert.deepEqual(fresh.getAll('news'), source.news);
}));
await test('invalid source preserves every key/version and initialization can retry', () => withSeedSync(async source => {
  source.version.users++; source.version.tasks++;
  source.users.push({ ...source.users[0] });
  source.tasks.push({ ...source.tasks[0], id: 'sync-task' });
  const before = new Map(memory);
  const fresh = await reloadStore();
  await assert.rejects(fresh.initStore(), { code: 'DUPLICATE_ID' }); assert.deepEqual(memory, before);
  source.users.pop();
  await fresh.initStore(); assert.ok(fresh.getById('tasks', 'sync-task'));
}));
await test('network/HTTP/JSON failures preserve versions and allow retry', () => withSeedSync(async source => {
  source.version.tasks++;
  source.tasks.push({ ...source.tasks[0], id: 'sync-task' });
  const before = new Map(memory);
  const fixtureFetch = globalThis.fetch;
  for (const failure of ['network', 'http', 'json']) {
    globalThis.fetch = async (input, options) => {
      if (!String(input).endsWith('/tasks.json')) return fixtureFetch(input, options);
      if (failure === 'network') throw new Error('Offline');
      if (failure === 'http') return { ok: false, status: 503 };
      return { ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } };
    };
    const fresh = await reloadStore();
    await assert.rejects(fresh.initStore(), { code: failure === 'json' ? 'INVALID_DATA' : 'SEED_LOAD_FAILED' });
    assert.deepEqual(memory, before);
    globalThis.fetch = fixtureFetch;
    await fresh.initStore(); assert.ok(fresh.getById('tasks', 'sync-task'));
    memory.clear(); for (const [key, value] of before) memory.set(key, value);
  }
}));
await test('first-load failure rolls back new keys and schema; successful retry initializes all', () => withSeedSync(async source => {
  memory.clear(); memory.set('unrelated_site', 'preserve');
  const before = new Map(memory);
  failWrite = key => key === 'onboardai_seedVersions';
  const fresh = await reloadStore();
  await assert.rejects(fresh.initStore()); assert.deepEqual(memory, before);
  failWrite = null; await fresh.initStore();
  for (const name of store.COLLECTIONS) assert.deepEqual(fresh.getAll(name), source[name]);
  assert.equal(memory.get('unrelated_site'), 'preserve');
}));
await test('duplicate email in source is visible and does not consume versions', () => withSeedSync(async source => {
  source.version.users++; source.version.tasks++;
  source.users.push({ ...source.users[0], id: 'sync-user', email: ` ${source.users[0].email.toUpperCase()} ` });
  source.tasks.push({ ...source.tasks[0], id: 'sync-task' });
  const before = new Map(memory);
  const fresh = await reloadStore();
  await assert.rejects(fresh.initStore(), { code: 'SEED_EMAIL_CONFLICT' }); assert.deepEqual(memory, before);
}));
await test('failed version write rolls back all additions; retry and another reload do not duplicate IDs', () => withSeedSync(async source => {
  source.version.tasks++; source.version.news++;
  source.tasks.push({ ...source.tasks[0], id: 'sync-task' });
  source.news.push({ ...source.news[0], id: 'sync-news' });
  const before = new Map(memory);
  failWrite = key => key === 'onboardai_seedVersions';
  const fresh = await reloadStore();
  await assert.rejects(fresh.initStore()); assert.deepEqual(memory, before);
  failWrite = null; await fresh.initStore();
  const next = await reloadStore(); await next.initStore();
  assert.equal(next.getAll('tasks').filter(item => item.id === 'sync-task').length, 1);
  assert.equal(next.getAll('news').filter(item => item.id === 'sync-news').length, 1);
}));
await test('invalid manifest and version downgrade preserve saved data', () => withSeedSync(async source => {
  const before = new Map(memory);
  source.version.tasks = 0;
  const fresh = await reloadStore();
  await assert.rejects(fresh.initStore(), { code: 'INVALID_DATA' }); assert.deepEqual(memory, before);
  source.version.tasks = 1; source.version.users--;
  await assert.rejects(fresh.initStore(), { code: 'SEED_VERSION_DOWNGRADE' }); assert.deepEqual(memory, before);
}));
await test('version manifest supports legacy shape and rejects misspelled collection names', () => {
  assert.equal(store.validateSeedVersions({ users: 5 }).tasks, 1);
  assert.throws(() => store.validateSeedVersions({ task: 2 }), { code: 'INVALID_DATA' });
  for (const value of [null, [], { users: '5' }, { users: 1.5 }]) assert.throws(() => store.validateSeedVersions(value), { code: 'INVALID_DATA' });
});
await test('reset validates manifest and records versions for the next page', () => withSeedSync(async source => {
  login('admin');
  const before = new Map(memory);
  source.version.news = -1;
  const fresh = await reloadStore();
  await assert.rejects(fresh.resetDemoData(), { code: 'INVALID_DATA' }); assert.deepEqual(memory, before);
  source.version.news = 2;
  await fresh.resetDemoData();
  assert.deepEqual(JSON.parse(memory.get('onboardai_seedVersions')), source.version);
  assert.equal(memory.has('onboardai_usersSeedVersion'), false);
  await fresh.initStore(); assert.deepEqual(fresh.getAll('news'), source.news);
}));
await test('one auth implementation; password is mandatory and omitted from public user', () => {
  assert.throws(() => auth.login(account('admin').id));
  const user = login('admin'); assert.ok(!('password' in user));
  assert.deepEqual(JSON.parse(memory.get('onboardai_currentUser')), { userId: user.id });
});
await test('only an active Admin session can reset demo data', async () => {
  auth.logout();
  assert.equal(store.canResetDemoData(), false);
  for (const role of ['newHire', 'mentor', 'hr']) {
    login(role);
    const before = new Map(memory);
    assert.equal(store.canResetDemoData(), false);
    await assert.rejects(store.resetDemoData(), { code: 'FORBIDDEN' });
    await assert.rejects(settings.resetDemoData(), { code: 'FORBIDDEN' });
    assert.deepEqual(memory, before);
  }
  login('admin');
  assert.equal(store.canResetDemoData(), true);
});
await test('inactive account cannot log in', () => {
  const user = seedUsers.find(user => user.status !== 'active');
  assert.throws(() => auth.login(user.email, user.password));
});
await test('login distinguishes activation state after checking credentials', () => {
  const invited = seedUsers.find(user => user.status === 'invited');
  const previousSession = store.getCurrentUserId();
  assert.throws(() => auth.login(invited.email, invited.password), { code: 'ACCOUNT_INVITED' });
  store.update('users', invited.id, { status: 'inactive' });
  try { assert.throws(() => auth.login(invited.id, invited.password), { code: 'ACCOUNT_INACTIVE' }); }
  finally { store.update('users', invited.id, { status: invited.status }); }
  assert.throws(() => auth.login(invited.email, `${invited.password}-wrong`), { code: 'INVALID_CREDENTIALS' });
  assert.throws(() => auth.login('missing-account', 'wrong'), { code: 'INVALID_CREDENTIALS' });
  assert.equal(store.getCurrentUserId(), previousSession);
});
await test('Admin activation allows an invited account to log in without changing its password', () => {
  login('admin'); const invited = seedUsers.find(user => user.id === 'user-081' && user.status === 'invited') || seedUsers.find(user => user.status === 'invited');
  people.updateUser(invited.id, { status: 'active' });
  assert.equal(auth.login(invited.email.toUpperCase(), invited.password).id, invited.id);
  assert.equal(auth.getCurrentUser().id, invited.id);
  login('admin'); people.updateUser(invited.id, { status: 'invited' });
});
await test('profile field whitelist and unique email', () => {
  login('newHire'); assert.throws(() => people.updateMyProfile({ role: 'admin' }));
  assert.throws(() => people.updateMyProfile({ email: account('hr').email }));
  people.updateMyProfile({ fullName: 'Integration profile' }); assert.equal(auth.getCurrentUser().fullName, 'Integration profile');
});
await test('Admin creates department; invalid manager and role writes denied', () => {
  login('admin'); department = resources.createDepartment({ name: 'Integration Department' });
  assert.throws(() => resources.updateDepartment(department.id, { managerId: 'missing' }));
  login('mentor'); assert.throws(() => resources.createDepartment({ name: 'Forbidden' }));
});
await test('HR creates journey; checks duration and department', () => {
  login('hr'); assert.throws(() => organization.createJourney({ title: 'Invalid', durationDays: 0 }));
  assert.throws(() => organization.createJourney({ title: 'Invalid', durationDays: 30, departmentId: 'missing' }));
  journey = organization.createJourney({ title: 'Integration Journey', durationDays: 30, departmentId: department.id });
});
await test('user+hire creation retries with stable IDs after partial write', () => {
  login('admin'); const op = people.prepareNewHireCreation();
  const input = { fullName: 'Integration Hire', email: 'integration@example.test', role: 'newHire', password: 'OnlyForTests-2026', status: 'active', departmentId: department.id };
  const profile = { journeyId: journey.id, mentorId: account('mentor').id, startDate: '2026-10-19' };
  failWrite = key => key === 'onboardai_newHires'; assert.throws(() => people.createNewHireAccount(input, profile, op)); failWrite = null;
  const result = people.createNewHireAccount(input, profile, op); hire = result.hire; newUser = result.user;
  people.createNewHireAccount(input, profile, op);
  assert.equal(store.getAll('users').filter(user => user.email === input.email).length, 1);
  assert.equal(store.getAll('newHires').filter(item => item.userId === newUser.id).length, 1);
});
await test('account editor validates both records before writing', () => {
  login('admin'); const previous = store.getById('newHires', hire.id);
  assert.throws(() => people.updateUserAccount(newUser.id, { email: account('hr').email }, { notes: 'Must not persist' }));
  assert.deepEqual(store.getById('newHires', hire.id), previous);
  const result = people.updateUserAccount(newUser.id, { fullName: 'Updated Integration Hire' }, { notes: 'Saved together' });
  assert.equal(result.user.fullName, 'Updated Integration Hire'); assert.equal(result.hire.notes, 'Saved together');
});
await test('Admin can edit an account without an onboarding profile', () => {
  login('admin'); const user = people.createUser({ fullName: 'Integration HR', email: 'hr-edit@example.test', role: 'hr', password: 'OnlyForTests-2026', status: 'active' });
  assert.equal(people.updateUserAccount(user.id, { jobTitle: 'HR specialist' }, null).user.jobTitle, 'HR specialist');
  assert.ok(!store.getAll('newHires').some(item => item.userId === user.id));
});
await test('unrelated hire edit preserves an existing inactive mentor', () => {
  login('admin'); const mentor = people.createUser({ fullName: 'Integration Mentor', email: 'mentor-edit@example.test', role: 'mentor', password: 'OnlyForTests-2026', status: 'active' });
  people.updateHire(hire.id, { mentorId: mentor.id }); people.updateUser(mentor.id, { status: 'inactive' });
  people.updateHire(hire.id, { notes: 'Keep relationship' }); assert.equal(store.getById('newHires', hire.id).mentorId, mentor.id);
  people.updateHire(hire.id, { mentorId: account('mentor').id });
  assert.throws(() => people.updateHire(hire.id, { mentorId: mentor.id }));
});
await test('Mentor creates task from assigned hire relationships', () => {
  login('mentor'); task = tasks.createTask({ newHireId: hire.id, title: 'Integration Task', dueDate: '2026-11-01' });
  assert.equal(task.assignedTo, hire.userId); assert.equal(task.journeyId, hire.journeyId);
  assert.throws(() => tasks.createTask({ newHireId: hire.id, title: 'Bad date', dueDate: '2026-02-30' }));
});
await test('task edit can clear an optional due date', () => {
  assert.equal(tasks.updateTask(task.id, { dueDate: '' }).dueDate, null);
  assert.throws(() => tasks.updateTask(task.id, []));
  tasks.updateTask(task.id, { dueDate: '2026-11-01' });
});
await test('NewHire cannot edit another hire/task or metadata', () => {
  login('newHire'); assert.throws(() => tasks.getTasksForHire(hire.id)); assert.throws(() => tasks.updateTaskStatus(task.id, 'completed'));
  auth.login(newUser.id, 'OnlyForTests-2026'); assert.throws(() => tasks.updateTask(task.id, { title: 'Forbidden' })); assert.throws(() => tasks.updateTaskStatus(task.id, 'archived'));
});
await test('status, completedAt and progress agree across all roles', () => {
  auth.login(newUser.id, 'OnlyForTests-2026'); tasks.updateTaskStatus(task.id, 'completed'); assert.ok(store.getById('tasks', task.id).completedAt);
  for (const role of ['mentor', 'hr', 'admin']) { login(role); assert.equal(tasks.getProgress(hire.id).percent, 100); }
  auth.login(newUser.id, 'OnlyForTests-2026'); tasks.updateTaskStatus(task.id, 'blocked'); assert.equal(store.getById('tasks', task.id).completedAt, null);
});
await test('canonical task-004 journey matches its hire and can be updated', () => {
  const user = store.getById('users', 'user-002'); auth.login(user.id, user.password);
  assert.equal(store.getById('tasks', 'task-004').journeyId, store.getById('newHires', 'hire-002').journeyId);
  assert.doesNotThrow(() => tasks.updateTaskStatus('task-004', 'completed'));
});
await test('archive changes progress denominator and preserves record', () => {
  login('mentor'); tasks.archiveTask(task.id); assert.equal(tasks.getProgress(hire.id).total, 0);
  tasks.updateTask(task.id, { status: 'todo' }); assert.equal(tasks.getProgress(hire.id).total, 1);
});
await test('check-in normalizes time and prevents equivalent duplicate schedules', () => {
  login('mentor'); checkin = resources.createCheckin({ newHireId: hire.id, scheduledAt: '2026-11-01 10:00', note: 'Private mentor note' });
  assert.equal(checkin.scheduledAt, '2026-11-01T03:00:00.000Z');
  assert.throws(() => resources.createCheckin({ newHireId: hire.id, scheduledAt: '2026-11-01T03:00:00Z' }), error => error.existingId === checkin.id);
  resources.updateCheckin(checkin.id, { note: 'Updated' });
});
await test('HR gets check-in metadata without private notes; NewHire is denied', () => {
  login('hr'); assert.equal(resources.listCheckins({ newHireId: hire.id })[0].note, null);
  assert.deepEqual(resources.listCheckins({ newHireId: hire.id, search: 'Updated' }), []);
  assert.throws(() => resources.updateCheckin(checkin.id, { status: 'completed' }));
  assert.throws(() => resources.updateCheckin(checkin.id, { note: 'Forbidden' }));
  auth.login(newUser.id, 'OnlyForTests-2026'); assert.throws(() => resources.listCheckins());
});
await test('mentor reassignment revokes former mentor access', () => {
  login('admin'); const second = seedUsers.find(user => user.role === 'mentor' && user.status === 'active' && user.id !== account('mentor').id);
  people.updateHire(hire.id, { mentorId: second.id }); login('mentor'); assert.throws(() => tasks.getTasksForHire(hire.id)); assert.throws(() => resources.updateCheckin(checkin.id, { status: 'cancelled' }));
  login('admin'); people.updateHire(hire.id, { mentorId: account('mentor').id });
});
await test('document draft/publish/audience permissions are shared', () => {
  login('hr'); document = resources.createDocument({ title: 'Integration Document', targetRole: 'newhire', departmentId: department.id });
  const shared = resources.createDocument({ title: 'Integration Shared Document', targetRole: 'all', departmentId: null });
  resources.updateDocument(shared.id, { status: 'active' });
  auth.login(newUser.id, 'OnlyForTests-2026'); assert.throws(() => resources.getDocument(document.id));
  login('hr'); resources.updateDocument(document.id, { status: 'active' });
  auth.login(newUser.id, 'OnlyForTests-2026'); assert.equal(resources.getDocument(document.id).id, document.id);
  login('newHire'); assert.throws(() => resources.getDocument(document.id));
  assert.ok(resources.getReadableDocuments().some(doc => doc.id === shared.id));
});
await test('document URLs reject executable schemes', () => {
  login('hr'); assert.throws(() => resources.updateDocument(document.id, { fileUrl: 'javascript:alert(1)' }));
  for (const url of ['http://[bad', 'assets/docs/%2e%2e/users.json', 'assets/docs/../users.json']) assert.throws(() => resources.updateDocument(document.id, { fileUrl: url }));
});
await test('checklist applies once, retries partial storage failure, and freezes partial draft', () => {
  login('mentor'); history = ai.createHistory({ featureType: 'checklistPersonalizer', newHireId: hire.id, input: 'Integration checklist', result: { items: ['First', 'Second'].map(title => ({ title, priority: 'medium', dueDate: null })) } });
  assert.throws(() => ai.decideHistory(history.id, 'accepted'));
  const before = new Map(memory);
  failWrite = key => key === 'onboardai_aiHistory';
  assert.throws(() => tasks.applyChecklist(history.id)); failWrite = null;
  assert.deepEqual(memory, before);
  // A partial application left by an older release must still be recoverable.
  store.create('tasks', { ...task, id: `task-${history.id}-0`, title: 'First', status: 'todo' });
  assert.throws(() => ai.updateHistory(history.id, { result: history.result }));
  assert.throws(() => ai.decideHistory(history.id, 'rejected')); assert.throws(() => ai.deleteHistory(history.id));
  const applied = tasks.applyChecklist(history.id); assert.equal(applied.appliedTaskIds.length, 2);
  const count = store.getAll('tasks').length; tasks.applyChecklist(history.id); assert.equal(store.getAll('tasks').length, count);
  assert.equal(ai.getHistory(history.id).decision, 'accepted');
});
await test('AI history is owner-scoped', () => {
  login('hr'); assert.throws(() => ai.getHistory(history.id)); assert.ok(!ai.listMyHistory().some(item => item.id === history.id));
});
await test('Policy QA generate/edit/regenerate stay in memory and save is idempotent', () => {
  login('newHire');
  const before = store.getAll('aiHistory').length;
  const answer = ai.askPolicy('nghỉ phép');
  assert.ok(answer.result.answer); assert.ok(answer.reason); assert.equal(store.getAll('aiHistory').length, before);
  const edited = { ...answer, result: { ...answer.result, answer: 'Edited in memory' } };
  assert.equal(store.getAll('aiHistory').length, before);
  const saved = ai.saveHistoryDraft(edited);
  assert.equal(ai.saveHistoryDraft(edited).id, saved.id);
  assert.equal(store.getAll('aiHistory').length, before + 1);
  assert.equal(saved.result.answer, 'Edited in memory');
  const regenerated = ai.askPolicy('admin có được xem chính sách không?');
  assert.ok(regenerated.result.answer); assert.equal(store.getAll('aiHistory').length, before + 1);
  const rejected = ai.saveHistoryDraft(regenerated, 'rejected');
  assert.equal(rejected.decision, 'rejected');
  ai.archiveHistory(saved.id); assert.ok(!ai.listMyHistory('policyQA').some(item => item.id === saved.id));
  ai.deleteHistory(saved.id);
});
await test('Checklist generate/save/reject/accept lifecycle does not duplicate history or tasks', () => {
  login('mentor');
  const historyBefore = store.getAll('aiHistory').length;
  const taskBefore = store.getAll('tasks').length;
  const draft = tasks.generateChecklistDraft(hire.id, 'frontend kỹ thuật');
  assert.equal(store.getAll('aiHistory').length, historyBefore);
  assert.equal(store.getAll('tasks').length, taskBefore);
  const saved = tasks.saveChecklistDraft(draft);
  assert.equal(tasks.saveChecklistDraft(draft).id, saved.id);
  assert.equal(store.getAll('aiHistory').length, historyBefore + 1);
  assert.equal(store.getAll('tasks').length, taskBefore);
  const rejectedDraft = tasks.generateChecklistDraft(hire.id, 'frontend kỹ thuật');
  assert.equal(tasks.rejectChecklistDraft(rejectedDraft).decision, 'rejected');
  assert.equal(store.getAll('tasks').length, taskBefore);
  const acceptedDraft = tasks.generateChecklistDraft(hire.id, 'frontend kỹ thuật');
  const applied = tasks.acceptChecklistDraft(acceptedDraft);
  const taskCount = store.getAll('tasks').length;
  tasks.applyChecklist(applied.historyId);
  assert.equal(store.getAll('tasks').length, taskCount);
});
await test('Progress Risk uses shared progress, with unknown for missing links', async () => {
  login('hr'); const analysis = await risk.analyzeRisk(hire.id); assert.deepEqual(analysis.progress, tasks.getProgress(hire.id));
  const saved = await risk.saveRiskEvaluation(analysis); ai.decideHistory(saved.id, 'accepted');
  people.updateHire(hire.id, { mentorId: null }); assert.equal((await risk.analyzeRisk(hire.id)).level, 'unknown');
  people.updateHire(hire.id, { mentorId: account('mentor').id });
});
await test('risk checks nonempty relationship IDs against current data', async () => {
  login('hr'); const previous = store.getById('newHires', hire.id);
  store.update('newHires', hire.id, { mentorId: 'missing-mentor', journeyId: 'missing-journey' });
  try {
    const analysis = await risk.analyzeRisk(hire.id);
    assert.equal(analysis.level, 'unknown'); assert.ok(analysis.signals.totalTasks > 0);
    assert.doesNotMatch(analysis.reason, /chưa có nhiệm vụ/);
  } finally { store.update('newHires', hire.id, previous); }
});
await test('news lifecycle controls public visibility and timestamps', () => {
  login('hr'); news = organization.createNews({ title: 'Integration News', content: 'Content' });
  assert.ok(!organization.getPublishedNews().some(item => item.id === news.id));
  assert.ok(organization.publishNews(news.id).publishedAt); assert.ok(organization.getPublishedNews().some(item => item.id === news.id));
  assert.throws(() => organization.restoreNews(news.id));
  assert.ok(organization.archiveNews(news.id).archivedAt); assert.throws(() => organization.publishNews(news.id));
  assert.equal(organization.restoreNews(news.id).archivedAt, null); assert.ok(!organization.getPublishedNews().some(item => item.id === news.id));
});
await test('public company uses company-001; updates require HR/Admin', () => {
  login('hr'); organization.updateCompanyInfo({ mission: 'Integration mission' });
  auth.logout(); assert.equal(organization.getCompanyInfo().mission, 'Integration mission'); assert.throws(() => organization.updateCompanyInfo({ mission: 'Forbidden' }));
});
await test('inactive journeys and departments reject new assignments', () => {
  login('hr'); organization.setJourneyStatus(journey.id, 'inactive'); login('mentor'); assert.throws(() => tasks.createTask({ newHireId: hire.id, title: 'Forbidden' }));
  login('admin'); resources.archiveDepartment(department.id); assert.throws(() => people.createUser({ fullName: 'Invalid', email: 'invalid@example.test', role: 'hr', password: 'test-only', departmentId: department.id }));
  assert.ok(resources.getDepartmentReferences(department.id).users > 0);
});
await test('settings validates range/email and provides journey defaults', () => {
  login('admin'); assert.throws(() => settings.updateSystemSettings({ reminderDays: 31 })); assert.throws(() => settings.updateSystemSettings({ supportEmail: 'bad' }));
  settings.updateSystemSettings({ onboardingDays: 45 }); login('hr'); assert.equal(settings.getOnboardingDefaults().onboardingDays, 45); assert.throws(() => settings.getSystemSettings());
});
await test('settings rejects coerced or empty numeric values', () => {
  login('admin');
  for (const patch of [[], { onboardingDays: true }, { reminderDays: '' }, { organizationName: {} }]) assert.throws(() => settings.updateSystemSettings(patch));
});
await test('revoked account cannot perform next business operation', () => {
  login('admin'); people.updateUser(newUser.id, { status: 'inactive' }); store.setCurrentUserId(newUser.id);
  assert.equal(auth.getCurrentUser(), null); assert.throws(() => tasks.getProgress(hire.id));
});
await test('storage failure is visible and preserves existing values', () => {
  login('admin'); const previous = store.getById('users', account('admin').id).fullName;
  failWrite = key => key === 'onboardai_users'; assert.throws(() => people.updateMyProfile({ fullName: 'Must not persist' })); failWrite = null;
  assert.equal(store.getById('users', account('admin').id).fullName, previous);
});
await test('malformed JSON and unsupported schema stop reads/writes', () => {
  const tasks = memory.get('onboardai_tasks'); memory.set('onboardai_tasks', '{'); assert.throws(() => store.getAll('tasks')); memory.set('onboardai_tasks', tasks);
  memory.set('onboardai_schemaVersion', '2'); assert.throws(() => store.getAll('users')); memory.set('onboardai_schemaVersion', '1');
});
await test('date parsing validates Vietnam wall time and invalid calendar dates', () => {
  assert.equal(parseStoredDate('2026-10-19 10:00').toISOString(), '2026-10-19T03:00:00.000Z'); assert.equal(parseStoredDate('2026-02-30'), null);
});
await test('reset validates source before removing existing data', async () => {
  login('admin');
  const before = new Map(memory);
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const response = await savedFetch(input);
    if (String(input).endsWith('/users.json')) return { ok: true, json: async () => { const users = await response.json(); return [...users, users[0]]; } };
    return response;
  };
  try { await assert.rejects(store.resetDemoData(), { code: 'DUPLICATE_ID' }); assert.deepEqual(memory, before); }
  finally { globalThis.fetch = savedFetch; }
});
await test('reset restores prior data if a write fails after preflight', async () => {
  login('admin');
  const before = new Map(memory); let failedOnce = false;
  failWrite = key => key === 'onboardai_tasks' && !failedOnce && (failedOnce = true);
  await assert.rejects(store.resetDemoData()); failWrite = null;
  assert.deepEqual(memory, before);
});
await test('logout keeps data; reset only clears registered project keys', async () => {
  const before = memory.get('onboardai_tasks'); auth.logout(); assert.equal(memory.get('onboardai_tasks'), before);
  const loggedOutState = new Map(memory);
  await assert.rejects(store.resetDemoData(), { code: 'FORBIDDEN' }); assert.deepEqual(memory, loggedOutState);
  login('admin'); memory.set('unrelated_site', 'preserve'); await settings.resetDemoData(); assert.equal(memory.get('unrelated_site'), 'preserve'); assert.equal(auth.getCurrentUser(), null);
  assert.equal(store.getById('tasks', task.id), null); assert.equal(Object.keys(store.STORAGE_KEYS).length, 16);
});
await test('HTTP server serves modules and blocks private paths and unsupported methods', async () => {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await networkFetch(`${base}/`); assert.equal(page.status, 200); assert.match(await page.text(), /data-page="index"/);
    const module = await networkFetch(`${base}/js/main.js`, { method: 'HEAD' }); assert.equal(module.status, 200); assert.equal(await module.text(), '');
    assert.equal((await networkFetch(`${base}/.git/config`)).status, 403);
    assert.equal((await networkFetch(`${base}/%ZZ`)).status, 400);
    assert.equal((await networkFetch(`${base}/`, { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
await test('aiConfig manages API key and modes purely in memory without leaking to storage', () => {
  aiConfig.clearApiKey();
  assert.equal(aiConfig.getApiKey(), '');
  assert.equal(aiConfig.hasApiKey(), false);
  assert.equal(aiConfig.getAiMode(), 'mock');
  assert.equal(aiConfig.getMaskedApiKey(), '');

  let notified = false;
  const unsub = aiConfig.subscribeAiConfig(() => { notified = true; });

  aiConfig.setApiKey('AIzaSyTestApiKey1234567890');
  assert.equal(aiConfig.hasApiKey(), true);
  assert.equal(aiConfig.getApiKey(), 'AIzaSyTestApiKey1234567890');
  assert.equal(aiConfig.getAiMode(), 'gemini');
  assert.equal(aiConfig.getMaskedApiKey(), 'AIza...7890');
  assert.equal(notified, true);
  assert.throws(() => aiConfig.setApiKey('key có khoảng trắng'));

  // Assert NO API key was leaked into memory (localStorage simulation)
  for (const [key, val] of memory.entries()) {
    assert.doesNotMatch(String(key), /AIzaSy/);
    assert.doesNotMatch(String(val), /AIzaSy/);
  }

  aiConfig.setAiMode('mock');
  assert.equal(aiConfig.getAiMode(), 'mock');
  assert.throws(() => aiConfig.setAiMode('invalid-mode'));

  const alternateModel = aiConfig.SUPPORTED_MODELS.find(item => item.id !== aiConfig.DEFAULT_MODEL).id;
  aiConfig.setModel(alternateModel);
  assert.equal(aiConfig.getModel(), alternateModel);
  assert.throws(() => aiConfig.setModel('gemini-not-supported'));
  aiConfig.setModel(aiConfig.DEFAULT_MODEL);
  assert.throws(() => aiConfig.setTimeoutMs(0));

  aiConfig.clearApiKey();
  assert.equal(aiConfig.hasApiKey(), false);
  assert.equal(aiConfig.getAiMode(), 'mock');
  unsub();
});

await test('geminiApi extracts JSON from various markdown and text wrappings safely', () => {
  assert.deepEqual(geminiApi.extractJsonFromText('{"answer": "OK"}'), { answer: 'OK' });
  assert.deepEqual(geminiApi.extractJsonFromText('```json\n{"answer": "CodeBlock"}\n```'), { answer: 'CodeBlock' });
  assert.deepEqual(geminiApi.extractJsonFromText('```\n{"answer": "NoLang"}\n```'), { answer: 'NoLang' });
  assert.deepEqual(geminiApi.extractJsonFromText('Dưới đây là JSON phản hồi:\n{"answer": "Prose", "items": [1, 2]}\nHy vọng đúng yêu cầu.'), { answer: 'Prose', items: [1, 2] });
  assert.deepEqual(geminiApi.extractJsonFromText('[{"title": "Task 1"}]'), [{ title: 'Task 1' }]);
  assert.throws(() => geminiApi.extractJsonFromText(''));
  assert.throws(() => geminiApi.extractJsonFromText('Đây không phải JSON'));
});

await test('geminiApi handles error status codes and network timeouts with friendly messages', async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const [status, pattern] of [
      [400, /không hợp lệ/],
      [401, /API key không hợp lệ/],
      [403, /API key không hợp lệ/],
      [404, /không tồn tại/],
      [429, /vượt quá hạn mức/],
      [500, /đang gặp sự cố/],
    ]) {
      globalThis.fetch = async () => ({ ok: false, status });
      await assert.rejects(
        geminiApi.callGeminiApi({ prompt: 'test', apiKey: 'fake-key', featureKey: `status-${status}` }),
        { message: pattern },
      );
    }

    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('bad json'); } });
    await assert.rejects(
      geminiApi.callGeminiApi({ prompt: 'test', apiKey: 'fake-key', featureKey: 'bad-json' }),
      { message: /không phải JSON hợp lệ/ },
    );

    globalThis.fetch = async (_input, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    await assert.rejects(
      geminiApi.callGeminiApi({ prompt: 'test', apiKey: 'fake-key', timeoutMs: 1, featureKey: 'timeout' }),
      { message: /Quá thời gian chờ/ },
    );

    globalThis.fetch = async (input, options) => {
      assert.doesNotMatch(String(input), /key=/);
      assert.equal(options.headers['x-goog-api-key'], 'valid-fake-key');
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"status": "ok"}' }] } }],
        }),
      };
    };
    const successTest = await geminiApi.testApiKeyConnection('valid-fake-key');
    assert.equal(successTest.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await test('aiService Policy QA respects permissions, validates readable documents, and handles Gemini / Mock', async () => {
  // User-002 (Trần Gia Huy) is in dept-engineering and can read doc-002 (engineering-workflow)
  const engUser = store.getAll('users').find(u => u.role === 'newHire' && u.departmentId === 'dept-engineering');
  assert.ok(engUser, 'Must find an engineering newHire');
  auth.login(engUser.email, engUser.password);
  aiConfig.clearApiKey();

  // 1. Mock mode
  const mockDraft = await aiService.askPolicyWithAi('nghỉ phép');
  assert.equal(mockDraft.aiSource, 'mock');
  assert.ok(mockDraft.result.answer);

  // 2. Gemini mode without key throws helpful error
  aiConfig.setAiMode('gemini');
  await assert.rejects(aiService.askPolicyWithAi('nghỉ phép'), { message: /chưa nhập API Key/ });

  // 3. Gemini mode with key and mock response
  aiConfig.setApiKey('AIzaSyValidDemoKey123');
  const originalFetch = globalThis.fetch;

  // Verify this user has access to doc-002
  const readableDocs = resources.getReadableDocuments();
  assert.ok(readableDocs.some(d => d.id === 'doc-002'), 'Engineering newHire can read doc-002');

  // Case A: Gemini returns valid answer referencing readable doc-002
  globalThis.fetch = async (input) => {
    if (String(input).includes('generateContent')) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  answer: 'Quy trình phát triển phần mềm tuân theo chuẩn Gitflow và code review bắt buộc.',
                  sourceDocumentId: 'doc-002',
                  uncertain: false,
                  reason: 'Dựa trên tài liệu quy trình doc-002.',
                }),
              }],
            },
          }],
        }),
      };
    }
    return originalFetch(input);
  };

  const geminiDraft = await aiService.askPolicyWithAi('Quy trình review code thế nào?');
  assert.equal(geminiDraft.aiSource, 'gemini');
  assert.equal(geminiDraft.result.sourceDocumentId, 'doc-002');
  assert.equal(geminiDraft.result.uncertain, false);
  assert.ok(geminiDraft.result.answer.includes('Gitflow'));
  assert.ok(geminiDraft.draftId);

  // Case B: Gemini hallucinates a document ID not in readable docs (e.g. doc-999)
  globalThis.fetch = async (input) => {
    if (String(input).includes('generateContent')) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  answer: 'Quy định bảo mật máy chủ nội bộ.',
                  sourceDocumentId: 'doc-999-forbidden',
                  uncertain: false,
                  reason: 'Nguồn không được cấp phép.',
                }),
              }],
            },
          }],
        }),
      };
    }
    return originalFetch(input);
  };

  const sanitizedDraft = await aiService.askPolicyWithAi('Bảo mật máy chủ');
  assert.equal(sanitizedDraft.result.sourceDocumentId, null); // SANITIZED!
  assert.equal(sanitizedDraft.result.uncertain, true); // Marked uncertain!

  // Case C: User in dept-product cannot read doc-010 (dept-marketing), so doc-010 must be sanitized to null
  const productUser = store.getAll('users').find(u => u.role === 'newHire' && u.departmentId === 'dept-product');
  auth.login(productUser.email, productUser.password);
  globalThis.fetch = async (input) => {
    if (String(input).includes('generateContent')) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  answer: 'Chính sách marketing nội bộ.',
                  sourceDocumentId: 'doc-010',
                  uncertain: false,
                  reason: 'Trích xuất sổ tay marketing.',
                }),
              }],
            },
          }],
        }),
      };
    }
    return originalFetch(input);
  };

  const outOfDeptDraft = await aiService.askPolicyWithAi('Tài liệu marketing');
  assert.equal(outOfDeptDraft.result.sourceDocumentId, null); // Department restriction enforced!

  // Switch back to engUser to save their draft
  auth.login(engUser.email, engUser.password);

  // Verify Generate does NOT write to store
  const historyCount = store.getAll('aiHistory').length;
  // Save is idempotent
  const saved = ai.saveHistoryDraft(geminiDraft);
  assert.equal(store.getAll('aiHistory').length, historyCount + 1);
  assert.equal(ai.saveHistoryDraft(geminiDraft).id, saved.id);
  assert.equal(saved.aiSource, 'gemini');
  assert.equal(saved.model, aiConfig.DEFAULT_MODEL);

  aiConfig.clearApiKey();
  globalThis.fetch = originalFetch;
});

await test('aiService Checklist Personalizer validates schema, task priorities, and applies tasks stably', async () => {
  login('mentor');
  aiConfig.setApiKey('AIzaSyValidDemoKey123');
  const originalFetch = globalThis.fetch;

  // Find a mentee assigned to this active mentor
  const mentorUser = account('mentor');
  const menteeHire = store.getAll('newHires').find(h => h.mentorId === mentorUser.id);
  assert.ok(menteeHire, 'Must find a seeded mentee for mentor');

  globalThis.fetch = async (input) => {
    if (String(input).includes('generateContent')) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  items: [
                    { title: 'Thiết lập môi trường IDE và Git', description: 'Cài VS Code và clone repo', category: 'Kỹ thuật', priority: 'high', dueDate: null },
                    { title: 'Đọc tài liệu quy trình pull request', description: 'Xem tài liệu doc-002', category: 'Tài liệu', priority: 'medium', dueDate: null },
                    { title: 'Check-in 1:1 đầu tiên với mentor', description: 'Thảo luận mục tiêu tuần 1', category: 'Check-in', priority: 'high', dueDate: null },
                  ],
                  reason: 'Lộ trình tuần đầu cho lập trình viên.',
                }),
              }],
            },
          }],
        }),
      };
    }
    return originalFetch(input);
  };

  const draft = await aiService.generateChecklistWithAi(menteeHire.id, 'Hội nhập kỹ thuật frontend', '2026-11-01');
  assert.equal(draft.aiSource, 'gemini');
  assert.equal(draft.result.items.length, 3);
  assert.equal(draft.result.items[0].dueDate, '2026-11-01');
  assert.equal(draft.result.items[0].priority, 'high');

  // Accept checklist creates real tasks stably
  const taskCountBefore = store.getAll('tasks').length;
  const applied = tasks.acceptChecklistDraft(draft);
  assert.equal(applied.appliedTaskIds.length, 3);
  assert.equal(store.getAll('tasks').length, taskCountBefore + 3);
  const savedHistory = ai.getHistory(applied.historyId);
  assert.equal(savedHistory.aiSource, 'gemini');
  assert.equal(savedHistory.model, aiConfig.DEFAULT_MODEL);

  await assert.rejects(
    aiService.generateChecklistWithAi(menteeHire.id, 'Hội nhập kỹ thuật frontend', '2026-11-01'),
    { message: /nhiệm vụ trùng/ },
  );

  aiConfig.clearApiKey();
  globalThis.fetch = originalFetch;
});

await test('aiService Progress Risk strictly enforces JS-calculated risk level and progress stats', async () => {
  login('hr');
  aiConfig.setApiKey('AIzaSyValidDemoKey123');
  const originalFetch = globalThis.fetch;

  const testHire = store.getAll('newHires')[0];
  const baselineRisk = await risk.analyzeRisk(testHire.id);

  // Gemini returns an adversarial or different summary
  globalThis.fetch = async (input) => {
    if (String(input).includes('generateContent')) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  level: 'low', // Even if Gemini says low, JS must reject/override this!
                  summary: 'Tiến độ đang chậm cần can thiệp hỗ trợ.',
                  reason: 'Có các nhiệm vụ chưa hoàn thành đúng hạn.',
                  recommendations: ['Tổ chức họp 1:1 gấp với mentor', 'Rà soát các task quá hạn'],
                }),
              }],
            },
          }],
        }),
      };
    }
    return originalFetch(input);
  };

  const aiAnalysis = await aiService.analyzeProgressRiskWithAi(testHire.id);
  // LEVEL MUST BE STRICTLY THE JS-CALCULATED LEVEL!
  assert.equal(aiAnalysis.level, baselineRisk.level);
  assert.equal(aiAnalysis.tone, baselineRisk.tone);
  assert.deepEqual(aiAnalysis.progress, baselineRisk.progress);
  assert.deepEqual(aiAnalysis.signals, baselineRisk.signals);
  assert.equal(aiAnalysis.aiSource, 'gemini');
  assert.equal(aiAnalysis.recommendations.length, 2);
  const savedAnalysis = await risk.saveRiskEvaluation(aiAnalysis);
  assert.equal(savedAnalysis.aiSource, 'gemini');
  assert.equal(savedAnalysis.model, aiConfig.DEFAULT_MODEL);

  aiConfig.clearApiKey();
  globalThis.fetch = originalFetch;
});

await test('aiService fallback to Mock mode works when Gemini fails without breaking state', async () => {
  login('newHire');
  aiConfig.setApiKey('AIzaSyValidDemoKey123');
  const originalFetch = globalThis.fetch;

  // Simulate network failure
  globalThis.fetch = async (input) => {
    if (String(input).includes('generateContent')) {
      throw new TypeError('fetch failed (network error)');
    }
    return originalFetch(input);
  };

  // Calling with normal mode throws network error
  await assert.rejects(aiService.askPolicyWithAi('nghỉ phép'), { message: /Không thể kết nối đến máy chủ Google Gemini/ });

  // Calling with forceMock: true falls back cleanly
  const fallbackResult = await aiService.askPolicyWithAi('nghỉ phép', { forceMock: true });
  assert.equal(fallbackResult.aiSource, 'mock');
  assert.ok(fallbackResult.result.answer);

  aiConfig.clearApiKey();
  globalThis.fetch = originalFetch;
});

console.log(`\n${passed} passed; ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
