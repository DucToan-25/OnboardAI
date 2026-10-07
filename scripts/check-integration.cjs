const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function files(directory, extension) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const name = `${directory}/${entry.name}`;
    return entry.isDirectory() ? files(name, extension) : entry.name.endsWith(extension) ? [name] : [];
  });
}

async function check() {
  assert(vm.SourceTextModule, 'Run with node --experimental-vm-modules scripts/check-integration.cjs');
  const jsFiles = files('js', '.js');
  for (const file of jsFiles) {
    const source = read(file);
    new vm.SourceTextModule(source, { identifier: file });
    assert(!/^(?:<<<<<<<|=======|>>>>>>>)/m.test(source), `Conflict: ${file}`);
    if (file.startsWith('js/pages/')) {
      assert(!/\b(?:fetch|localStorage|sessionStorage)\b/.test(source), `Page data access: ${file}`);
      const exports = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((match) => match[1]);
      assert.deepEqual(exports, ['initPage'], file);
    }
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      assert(fs.existsSync(path.resolve(root, path.dirname(file), match[1])), `Import missing: ${file} ${match[1]}`);
    }
  }
  const { ROUTES } = await import('../js/config/routes.js');
  const { APP_CONFIG } = await import('../js/config/app.js');
  const pages = ['index.html', ...files('pages', '.html')];
  assert.equal(pages.length, 19);
  assert.equal(Object.keys(ROUTES).length, 19);
  assert.equal(new Set(APP_CONFIG.availablePages).size, 19);
  for (const file of pages) {
    const html = read(file);
    const id = path.basename(file, '.html');
    const prefix = id === 'index' ? '' : '../';
    assert(html.includes(`data-page="${id}"`), `Marker: ${file}`);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, file);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate ID: ${file}`);
    assert(!/\son\w+=|\sstyle=|href="#"/.test(html), `Inline code/placeholder: ${file}`);
    const css = [...html.matchAll(/href="([^" ]+\.css)"/g)].map((match) => match[1]);
    assert.deepEqual(css.slice(0, 3), ['base', 'layout', 'components'].map((name) => `${prefix}css/${name}.css`));
    assert.equal(css.at(-1), `${prefix}css/responsive.css`);
    assert.equal((html.match(/<script\b/g) || []).length, 1);
    assert(html.includes(`<script type="module" src="${prefix}js/main.js"></script>`));
    for (const stylesheet of css) {
      assert(fs.statSync(path.resolve(root, path.dirname(file), stylesheet)).size > 0, `Empty CSS: ${stylesheet}`);
    }
    assert(APP_CONFIG.availablePages.includes(id), `Unavailable: ${id}`);
    assert.equal(typeof (await ROUTES[id].loadPage()).initPage, 'function');
  }
  const seed = JSON.parse(read('assets/data/seed.json'));
  const { STATUS_META } = await import('../js/config/statuses.js');
  const links = { userId: 'users', mentorId: 'users', assignedById: 'users', updatedById: 'users',
    departmentId: 'departments', newHireId: 'newHires', journeyId: 'journeys', journeyAssignmentId: 'journeyAssignments' };
  for (const entity of ['users', 'newHires', 'departments', 'journeys', 'journeyAssignments', 'tasks', 'checkins', 'documents', 'settings']) {
    assert(Array.isArray(seed[entity]), entity);
    assert.equal(new Set(seed[entity].map((record) => record.id)).size, seed[entity].length, entity);
    for (const record of seed[entity]) {
      if (STATUS_META[entity]) assert(STATUS_META[entity][record.status], `${entity} ${record.id} status`);
      for (const [field, target] of Object.entries(links)) {
        if (record[field]) assert(seed[target].some((item) => item.id === record[field]), `${record.id} ${field}`);
      }
      if (entity === 'tasks' && record.journeyAssignmentId) {
        assert.equal(seed.journeyAssignments.find((item) => item.id === record.journeyAssignmentId).newHireId, record.newHireId);
      }
    }
  }
  global.fetch = async () => ({ ok: true, json: async () => structuredClone(seed) });
  const { createRepository } = await import('../js/data/repository.js');
  const { canOpenPage, getEditableFields } = await import('../js/common/permissions.js');
  assert(canOpenPage(null, 'index'));
  const publicRepository = await createRepository({ currentUser: null, mode: 'preview' });
  assert.equal((await publicRepository.list('portalPosts')).total, seed.portalPosts.length);
  assert.equal((await publicRepository.list('documents')).total, 0);
  seed.portalPosts.push({ ...seed.portalPosts[0], id: 'private-test', visibility: 'internal' },
    { ...seed.portalPosts[0], id: 'draft-test', status: 'draft' });
  const { clearPreviewCache } = await import('../js/data/mock-repository.js');
  clearPreviewCache();
  const restrictedRepository = await createRepository({ currentUser: null, mode: 'preview' });
  assert.equal((await restrictedRepository.list('portalPosts')).total, seed.portalPosts.length - 2);
  for (const id of ['private-test', 'draft-test']) await assert.rejects(restrictedRepository.get('portalPosts', id), { code: 'FORBIDDEN' });
  const copy = await publicRepository.get('portalPosts', 'news-001'); copy.title = 'Changed';
  assert.notEqual((await publicRepository.get('portalPosts', 'news-001')).title, copy.title);
  seed.portalPosts.splice(-2); clearPreviewCache();
  for (const user of seed.users.filter((item) => item.status === 'active')) {
    const repository = await createRepository({ currentUser: user, mode: 'preview' });
    assert.equal((await repository.getMyProfile()).id, user.id);
    assert.deepEqual(getEditableFields(user, 'profile', user), ['fullName', 'phone', 'avatarUrl']);
    const { items: documents } = await repository.list('documents');
    if (['newhire', 'mentor'].includes(user.role)) {
      assert(documents.every((doc) => doc.status === 'published' && doc.audienceRoles.includes(user.role)
        && (!doc.departmentIds.length || doc.departmentIds.includes(user.departmentId))));
      await assert.rejects(repository.get('documents', 'doc-draft'), { code: 'FORBIDDEN' });
    }
    if (['hr', 'admin'].includes(user.role)) assert.equal((await repository.list('checkins')).total, 0);
    if (user.role === 'admin') {
      assert.deepEqual(getEditableFields(user, 'settings', { id: 'system' }), ['organizationName', 'supportEmail', 'supportPhone', 'onboardingDays', 'reminderDays']);
      assert.equal(canOpenPage(user, 'hr-dashboard'), false);
      const refs = await repository.getDepartmentReferences(seed.departments[0].id);
      assert.equal(refs.journeys, seed.journeys.filter((item) => item.departmentId === seed.departments[0].id).length);
    } else {
      assert.deepEqual(getEditableFields(user, 'settings', { id: 'system' }), []);
      assert.equal(canOpenPage(user, 'admin-system-settings'), false);
      await assert.rejects(repository.getDepartmentReferences(seed.departments[0].id), { code: 'FORBIDDEN' });
    }
    await assert.rejects(repository.updateMyProfile({ fullName: 'Draft' }), { code: 'PREVIEW_ONLY' });
  }
  const { calculateProgress, analyzeProgressRisk } = await import('../js/data/selectors.js');
  const { getTodayDate, fromDateTimeInput, toDateTimeInput } = await import('../js/common/format.js');
  assert.deepEqual(calculateProgress([{ status: 'canceled' }, { status: 'completed' }, { status: 'submitted' }]), { total: 2, completed: 1, percent: 50 });
  assert.equal(analyzeProgressRisk([{ status: 'canceled' }]).hasData, false);
  assert.equal(getTodayDate('2026-10-06T18:00:00Z'), '2026-10-07');
  assert.equal(toDateTimeInput('2026-10-06T03:00:00Z'), '2026-10-06T10:00');
  assert.equal(fromDateTimeInput('2026-10-06T10:00'), '2026-10-06T03:00:00.000Z');
  assert.equal(fromDateTimeInput('2026-02-30T10:00'), null);
  console.log(`PASS integration: ${jsFiles.length} JS, ${pages.length} pages, schema, permissions, profile, date/time, risk`);
}

check().catch((error) => { console.error(error); process.exitCode = 1; });
