const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve.cjs');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const debugBase = process.argv[2] || 'http://127.0.0.1:9223';
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/data/seed.json'), 'utf8'));

async function connect() {
  const target = await (await fetch(`${debugBase}/json/new?about:blank`, { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map((item) => item.description || item.value).join(' '));
    }
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
      errors.push(`HTTP ${message.params.response.status}: ${message.params.response.url}`);
    }
  });
  function command(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Evaluation failed');
    return result.result.value;
  }
  async function until(expression) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    throw new Error(`Timed out: ${expression}`);
  }
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Network.enable');
  return { command, evaluate, until, errors, close: () => socket.close() };
}

async function run(base) {
  const browser = await connect();
  const { command, evaluate, until, errors } = browser;
  async function navigate(page) {
    const url = `${base}/${page === 'index.html' ? page : `pages/${page}`}`;
    await evaluate('if (document.body) document.body.dataset.ready = ""');
    await command('Page.navigate', { url });
    await until(`location.href === ${JSON.stringify(url)} && Boolean(document.body?.dataset.ready)`);
    assert.equal(await evaluate('document.body.dataset.ready'), 'true', page);
  }
  async function selectUser(userId) {
    await navigate('login.html');
    await evaluate(userId
      ? `(async () => (await import('../js/common/auth.js')).setPreviewUser(${JSON.stringify(userId)}))()`
      : `(async () => (await import('../js/common/auth.js')).logout())()`);
  }
  async function click(selector) {
    assert(await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), selector);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await delay(50);
  }
  const { ROUTES } = await import('../js/config/routes.js');
  await navigate('index.html');
  await click('[data-action="filter"][data-category="internal"]');
  assert.equal(await evaluate('document.querySelectorAll(".index__article").length'), 1);
  await evaluate('document.querySelector("#news-search").value = "không có kết quả abc"; document.querySelector("#news-search").dispatchEvent(new Event("input"))');
  assert(await evaluate('document.querySelector("[data-region=news]").textContent.includes("Không tìm thấy")'));
  await click('[data-action="all-news"]');
  assert.equal(await evaluate('document.querySelectorAll(".index__article").length'), 3);
  await evaluate('document.querySelector("[data-info=faq]").focus()');
  await click('[data-info="faq"]');
  assert(await evaluate('document.querySelector(".modal").textContent.includes("Câu hỏi thường gặp")'));
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await until('!document.querySelector(".modal")');
  assert.equal(await evaluate('document.activeElement.dataset.info'), 'faq');
  await click('[data-action="calendar"]');
  assert(await evaluate('document.querySelector(".modal__title").textContent.includes("Lịch sự kiện")'));
  await click('[data-action="close-modal"]');
  await click('a[href="pages/login.html"]');
  await until('document.body?.dataset.page === "login" && document.body.dataset.ready === "true"');
  let rendered = 0;
  for (const width of [1440, 768, 390]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const [id, route] of Object.entries(ROUTES)) {
      const user = route.public ? null : seed.users.find((item) => item.role === route.allowedRoles[0]);
      await selectUser(user?.id);
      await navigate(`${id}.html${id === 'document-detail' ? '?id=doc-001' : ''}`);
      const metrics = await evaluate(`({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        duplicateIds: [...document.querySelectorAll('[id]')].map(n => n.id).filter((id,i,all) => all.indexOf(id) !== i)})`);
      assert(metrics.scroll <= metrics.width + 1, `${id} overflows at ${width}: ${JSON.stringify(metrics)}`);
      assert.equal(metrics.duplicateIds.length, 0, `${id} duplicate IDs`);
      if (!route.public) {
        assert.equal(await evaluate('document.querySelectorAll("[data-action=toggle-sidebar]").length'), 1);
        assert.equal(await evaluate('document.querySelectorAll(".app-header__menu,.app-sidebar__close").length'), 0);
        const originalWidth = await evaluate('document.querySelector("#main-content").getBoundingClientRect().width');
        await click('[data-action="toggle-sidebar"]');
        if (width > 1023) {
          assert(await evaluate(`document.querySelector('#main-content').getBoundingClientRect().width > ${originalWidth}`), `${id} collapse expands content`);
          assert(await evaluate('document.querySelector("#app-sidebar").inert'));
        } else {
          assert(await evaluate('document.querySelector("#main-content").inert'));
          assert.equal(await evaluate('document.querySelector("[data-action=toggle-sidebar]").getAttribute("aria-expanded")'), 'true');
          await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 });
          assert(await evaluate('document.querySelector("#app-sidebar").contains(document.activeElement)'), 'Focus wraps into drawer');
        }
        await click('[data-action="toggle-sidebar"]');
        assert.equal(await evaluate('document.querySelector("#main-content").inert'), false);
      }
      rendered += 1;
    }
    console.log(`PASS rendered ${Object.keys(ROUTES).length} pages at ${width}px`);
  }
  for (const user of seed.users.filter((item) => item.status === 'active')) {
    await selectUser(user.id);
    await navigate('profile.html');
    assert.equal(await evaluate('document.querySelector("[name=fullName]").value'), user.fullName);
  }
  await selectUser('usr-admin-001');
  await navigate('admin-system-settings.html');
  assert.equal(await evaluate('document.querySelectorAll("[data-region=role-scope] tr").length'), 4);
  assert.equal(await evaluate('document.querySelector("[data-region=users-count]").textContent'), String(seed.users.length));
  assert.equal(await evaluate('document.querySelector("[name=question]")'), null);
  const original = await evaluate('document.querySelector("[name=organizationName]").value');
  await evaluate('document.querySelector("[name=supportEmail]").value = "invalid"; document.querySelector("[name=onboardingDays]").value = "0"; document.querySelector("[data-region=settings-form]").requestSubmit()');
  assert.equal(await evaluate('document.querySelectorAll("[aria-invalid=true]").length'), 2);
  await click('[data-action="cancel-settings"]');
  await evaluate('document.querySelector("[name=organizationName]").value = "Draft change"; document.querySelector("[data-region=settings-form]").requestSubmit()');
  assert.equal(await evaluate('document.querySelector("[data-region=settings-preview]").hidden'), false);
  await click('[data-action="cancel-settings"]');
  assert.equal(await evaluate('document.querySelector("[name=organizationName]").value'), original);
  assert.equal(await evaluate('document.querySelector("[data-region=settings-preview]").hidden'), true);
  await evaluate('document.querySelector("[name=organizationName]").value = "Reset draft"');
  await click('[data-action="reset-settings"]');
  await click('[data-action="confirm-action"]');
  assert.equal(await evaluate('document.querySelector("[name=organizationName]").value'), original);
  await selectUser('usr-mentor-001');
  await navigate('mentor-checkin-note.html?newHireId=nh-001');
  await click('[data-action="edit-checkin"]');
  assert.equal(await evaluate('document.querySelector("[name=scheduledAt]").value'), '2026-10-06T10:00');
  await navigate('mentor-checkin-note.html?newHireId=missing-id');
  assert(await evaluate('document.querySelector("#main-content").textContent.includes("không")'), 'Missing mentee feedback');
  await navigate('mentor-task-assignment.html?newHireId=nh-001');
  assert(await evaluate('Boolean(document.querySelector("[name=title]"))'), 'Assignment form');
  await evaluate(`(() => {
    const form = document.querySelector('[data-region=task-form]');
    form.elements.title.value = 'Preview task';
    form.elements.dueDate.value = '2026-10-10';
    form.requestSubmit();
  })()`);
  await until('!document.querySelector("[data-region=task-preview]").hidden');
  assert(await evaluate('document.querySelector("[data-region=task-preview]").textContent.includes("Preview task")'));
  await click('[data-action="reset-task"]');
  await click('[data-action="confirm-action"]');
  await until('!document.querySelector(".modal")');
  assert.equal(await evaluate('document.querySelector("[data-region=task-form]").elements.title.value'), '');
  for (const scenario of ['success', 'insufficient', 'error']) {
    await evaluate(`(() => {
      const form = document.querySelector('[data-region=checklist-form]');
      form.elements.newHireId.value = 'nh-001';
      form.elements.goal.value = 'Tìm hiểu chính sách và công cụ của nhóm';
      form.elements.dueDate.value = '2026-10-10';
      form.elements.scenario.value = ${JSON.stringify(scenario)};
      form.requestSubmit();
    })()`);
    await until('document.querySelector("[data-region=checklist-state]").getAttribute("aria-busy") !== "true"');
    if (scenario === 'success') {
      await click('[data-action="accept-checklist"]');
      assert(await evaluate('document.querySelector("[data-region=checklist-result]").textContent.includes("chấp nhận")'));
      await click('[data-action="save-checklist"]');
      await click('[data-action="reject-checklist"]');
      assert.equal(await evaluate('document.querySelector("[data-region=checklist-result]").hidden'), true);
    } else {
      assert(await evaluate(`document.querySelector('[data-region=checklist-state]').classList.contains('view-state--${scenario === 'error' ? 'error' : 'empty'}')`));
    }
  }
  const unchangedTasks = await evaluate(`(async () => {
    const { createRepository } = await import('../js/data/repository.js');
    const { getCurrentUser } = await import('../js/common/auth.js');
    return (await (await createRepository({ currentUser: await getCurrentUser() })).list('tasks')).total;
  })()`);
  assert.equal(unchangedTasks, seed.tasks.length, 'Task preview must not change repository');
  await selectUser('usr-hr-001');
  await navigate('hr-dashboard.html');
  for (const scenario of ['success', 'insufficient', 'error']) {
    await evaluate(`(() => {
      const form = document.querySelector('[data-region=risk-form]');
      form.elements.newHireId.value = 'nh-001';
      form.elements.scenario.value = ${JSON.stringify(scenario)};
      form.requestSubmit();
    })()`);
    await until('document.querySelector("[data-region=risk-state]").getAttribute("aria-busy") !== "true"');
    if (scenario === 'success') {
      await click('[data-action="accept-risk"]');
      assert.equal(await evaluate('document.querySelector("[data-action=accept-risk]").disabled'), true);
      await click('[data-action="reject-risk"]');
    } else assert(await evaluate(`document.querySelector('[data-region=risk-state]').classList.contains('view-state--${scenario === 'error' ? 'error' : 'empty'}')`));
  }
  await selectUser('usr-admin-001');
  await navigate('admin-user-management.html');
  await click('[data-action="disable-user"]');
  await click('[data-action="confirm-action"]');
  await until('Boolean(document.querySelector(".modal [name=status]"))');
  assert.equal(await evaluate('document.querySelector(".modal [name=status]").value'), 'disabled');
  await click('.modal__close');
  if (await evaluate('document.querySelectorAll(".modal").length > 1')) await click('[data-action="confirm-action"]');
  await until('!document.querySelector(".modal")');
  await click('[data-action="open-user-form"]');
  assert(await evaluate('Boolean(document.querySelector(".modal [name=fullName]"))'), 'User modal');
  await evaluate(`(() => {const form=document.querySelector('.modal form');
    form.elements.fullName.value='Test user'; form.elements.email.value='test@example.test';
    form.elements.phone.value='abc'; form.requestSubmit();})()`);
  assert.equal(await evaluate('document.querySelector(".modal [name=phone]").getAttribute("aria-invalid")'), 'true');
  const modal = await evaluate('(() => { const r=document.querySelector(".modal__dialog").getBoundingClientRect(); return {left:r.left,right:r.right,bottom:r.bottom}; })()');
  assert(modal.left >= 0 && modal.right <= 390 && modal.bottom <= 900, 'Modal exceeds viewport');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await delay(50);
  if (await evaluate('document.querySelectorAll(".modal").length > 1')) await click('[data-action="confirm-action"]');
  await until('!document.querySelector(".modal")');
  await click('[data-action="toggle-sidebar"]');
  assert.equal(await evaluate('document.querySelector("[aria-controls=app-sidebar]").getAttribute("aria-expanded")'), 'true');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  assert.equal(await evaluate('document.querySelector("[aria-controls=app-sidebar]").getAttribute("aria-expanded")'), 'false');
  for (const role of ['newhire', 'mentor', 'hr', 'admin']) {
    await selectUser(seed.users.find((item) => item.role === role).id);
    const library = role === 'newhire' ? 'newhire-document-library.html' : 'hr-document-library.html';
    await navigate(library);
    assert.equal(await evaluate('Boolean(document.querySelector("[data-action=open-document-form]"))'), ['hr', 'admin'].includes(role));
    await navigate('document-detail.html?id=doc-001');
    assert(await evaluate(`document.querySelector('[data-region=document-back] a').href.endsWith(${JSON.stringify(library)})`));
  }
  await selectUser('usr-newhire-001');
  await navigate('document-detail.html?id=doc-draft');
  assert(await evaluate('document.querySelector("[data-region=detail-state]").textContent.includes("không có quyền")'));
  await navigate('document-detail.html?id=missing-id');
  assert(await evaluate('document.querySelector("[data-region=detail-state]").textContent.includes("Không tìm thấy")'));
  assert.deepEqual(errors, [], 'Browser console/network errors');
  browser.close();
  console.log(`PASS browser: ${rendered} page/viewports, logo/sidebar collapse and focus, 5 profiles, settings validation/preview/cancel/reset, check-in time/ID, task draft/cancel, AI checklist/risk scenarios, repository unchanged, modal/Escape, drawer`);
}

const server = createServer();
server.listen(0, '127.0.0.1', async () => {
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); setTimeout(() => process.exit(process.exitCode || 0), 100); }
});
