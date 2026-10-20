import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
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
const authAlias = await import('../js/data/auth.js');
const people = await import('../js/data/people.js');
const tasks = await import('../js/data/tasks.js');
const resources = await import('../js/data/resources.js');
const organization = await import('../js/data/organization.js');
const ai = await import('../js/data/ai-history.js');
const risk = await import('../js/data/progress-risk.js');
const settings = await import('../js/data/settings.js');
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
await test('all JavaScript parses without merge markers', async () => {
  for (const file of (await fs.readdir('js', { recursive: true })).filter(name => name.endsWith('.js'))) {
    const source = await fs.readFile(`js/${file}`, 'utf8'); assert.doesNotMatch(source, /^(<<<<<<<|=======|>>>>>>>)/m);
    const result = spawnSync(process.execPath, ['--check', `js/${file}`], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr);
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
await test('one auth implementation; password is mandatory and omitted from public user', () => {
  assert.equal(auth.login, authAlias.login); assert.throws(() => authAlias.login(account('admin').id));
  const user = login('admin'); assert.ok(!('password' in user));
  assert.deepEqual(JSON.parse(memory.get('onboardai_currentUser')), { userId: user.id });
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
await test('legacy mismatched journey cannot be updated', () => {
  const user = store.getById('users', 'user-002'); auth.login(user.id, user.password);
  assert.throws(() => tasks.updateTaskStatus('task-004', 'completed'));
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
  auth.login(newUser.id, 'OnlyForTests-2026'); assert.throws(() => resources.getDocument(document.id));
  login('hr'); resources.updateDocument(document.id, { status: 'active' });
  auth.login(newUser.id, 'OnlyForTests-2026'); assert.equal(resources.getDocument(document.id).id, document.id);
  login('newHire'); assert.throws(() => resources.getDocument(document.id));
  assert.ok(resources.getReadableDocuments().some(doc => doc.id === 'doc-001'));
});
await test('document URLs reject executable schemes', () => {
  login('hr'); assert.throws(() => resources.updateDocument(document.id, { fileUrl: 'javascript:alert(1)' }));
  for (const url of ['http://[bad', 'assets/docs/%2e%2e/users.json', 'assets/docs/../users.json']) assert.throws(() => resources.updateDocument(document.id, { fileUrl: url }));
});
await test('checklist applies once, retries partial storage failure, and freezes partial draft', () => {
  login('mentor'); history = ai.createHistory({ featureType: 'checklistPersonalizer', newHireId: hire.id, input: 'Integration checklist', result: { items: ['First', 'Second'].map(title => ({ title, priority: 'medium', dueDate: null })) } });
  assert.throws(() => ai.decideHistory(history.id, 'accepted'));
  let writes = 0; failWrite = key => key === 'onboardai_tasks' && ++writes === 2;
  assert.throws(() => tasks.applyChecklist(history.id)); failWrite = null;
  assert.throws(() => ai.updateHistory(history.id, { result: history.result }));
  assert.throws(() => ai.decideHistory(history.id, 'rejected')); assert.throws(() => ai.deleteHistory(history.id));
  const applied = tasks.applyChecklist(history.id); assert.equal(applied.appliedTaskIds.length, 2);
  const count = store.getAll('tasks').length; tasks.applyChecklist(history.id); assert.equal(store.getAll('tasks').length, count);
  assert.equal(ai.getHistory(history.id).decision, 'accepted');
});
await test('AI history is owner-scoped', () => {
  login('hr'); assert.throws(() => ai.getHistory(history.id)); assert.ok(!ai.listMyHistory().some(item => item.id === history.id));
});
await test('Policy QA persists answer and safe source; unknown question has fallback', () => {
  login('newHire'); const answer = ai.askPolicy('nghỉ phép'); assert.ok(answer.result.answer); assert.ok(answer.reason);
  const fallback = ai.askPolicy('zzzzzz unrelated query'); assert.equal(fallback.result.sourceDocumentId, null);
  ai.updateHistory(fallback.id, { result: { ...fallback.result, answer: 'Edited answer' } }); ai.decideHistory(fallback.id, 'rejected');
  assert.throws(() => ai.updateHistory(fallback.id, { reason: 'No longer pending' })); ai.deleteHistory(fallback.id);
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
  const before = new Map(memory); let failedOnce = false;
  failWrite = key => key === 'onboardai_tasks' && !failedOnce && (failedOnce = true);
  await assert.rejects(store.resetDemoData()); failWrite = null;
  assert.deepEqual(memory, before);
});
await test('logout keeps data; reset only clears registered project keys', async () => {
  const before = memory.get('onboardai_tasks'); auth.logout(); assert.equal(memory.get('onboardai_tasks'), before);
  memory.set('unrelated_site', 'preserve'); await store.resetDemoData(); assert.equal(memory.get('unrelated_site'), 'preserve'); assert.equal(auth.getCurrentUser(), null);
  assert.equal(store.getById('tasks', task.id), null); assert.equal(store.COLLECTIONS.length + 2, 14);
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
console.log(`\n${passed} passed; ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
