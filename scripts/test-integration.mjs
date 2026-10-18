/*
 * test-integration.mjs — kiểm thử luồng chung trên cùng một bộ seed (hợp đồng mục 6).
 * Chạy: node scripts/test-integration.mjs   (npm test)
 *
 * Môi trường Node: mô phỏng localStorage và đọc tệp seed qua file:// để chạy
 * đúng logic store.js/organization.js mà không cần trình duyệt.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// ===== Môi trường mô phỏng =====
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
  setItem: (key, value) => { storageMap.set(key, String(value)); },
  removeItem: (key) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof URL ? input : new URL(String(input), pathToFileURL(process.cwd() + '/'));
  if (url.protocol === 'file:') {
    try {
      const text = await readFile(url, 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(text) };
    } catch {
      return { ok: false, status: 404, json: async () => { throw new Error('not json'); } };
    }
  }
  return realFetch(input, init);
};

const { initStore, getAll, getById, resetDemoData } = await import('../js/data/store.js');
const auth = await import('../js/data/auth.js');
const organization = await import('../js/data/organization.js');
const aiHistory = await import('../js/data/ai-history.js');
const progressRisk = await import('../js/data/progress-risk.js');
const tasks = await import('../js/data/tasks.js');
const resources = await import('../js/data/resources.js');
const people = await import('../js/data/people.js');

let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}

async function rejectsCode(promise, code) {
  try {
    await promise;
  } catch (error) {
    assert.equal(error.code, code, `mong đợi code ${code}, nhận ${error.code}: ${error.message}`);
    return error;
  }
  assert.fail(`mong đợi code ${code} nhưng hàm không ném lỗi`);
}

console.log('\n1. Khởi tạo và giữ dữ liệu giữa các lần mở (mục 2.3)');
await test('initStore nạp seed một lần, F5 không ghi đè', async () => {
  await initStore();
  const before = await getAll('news');
  assert.ok(before.length > 0, 'news seed phải có bản ghi');
  await initStore(); // mô phỏng F5 trong cùng phiên: initPromise dùng chung
  const after = await getAll('news');
  assert.deepEqual(after, before);
});
await test('đặt lại dữ liệu demo nạp lại seed đúng', async () => {
  await auth.login('user-004');
  const draft = await organization.createNews({ title: 'Tin sẽ bị reset', content: 'Nội dung test.' });
  assert.equal((await getById('news', draft.id)).title, 'Tin sẽ bị reset');
  await resetDemoData();
  const gone = await getById('news', draft.id);
  assert.equal(gone, null, 'bản ghi tạo trước reset phải biến mất');
  assert.ok((await getAll('news')).length > 0, 'seed phải được nạp lại');
});
await test('collection [] là dữ liệu hợp lệ, không nạp lại seed', async () => {
  storageMap.set('onboardai_checkins', '[]');
  const fresh = await getAll('checkins');
  assert.deepEqual(fresh, []);
  storageMap.delete('onboardai_checkins');
  await resetDemoData();
});

console.log('\n2. Thông tin công ty và tin đã xuất bản (mục 5.2)');
await test('getCompanyInfo trả company-001, không chọn công ty khác', async () => {
  const info = await organization.getCompanyInfo();
  assert.equal(info.id, 'company-001');
  assert.ok(info.mission, 'company-001 phải có mission');
});
await test('getPublishedNews chỉ chứa published, sắp xếp ngày giảm dần', async () => {
  const news = await organization.getPublishedNews();
  assert.ok(news.length > 0);
  for (const item of news) assert.equal(item.status, 'published');
  const times = news.map((item) => Date.parse(String(item.publishedAt).replace(' ', 'T')));
  for (let i = 1; i < times.length; i += 1) assert.ok(times[i - 1] >= times[i], 'phải sắp xếp giảm dần theo publishedAt');
});
await test('tin draft không xuất hiện trên trang công khai', async () => {
  await auth.login('user-004');
  const draft = await organization.createNews({ title: 'Nháp nội bộ', content: 'Chưa công khai.' });
  const published = await organization.getPublishedNews();
  assert.ok(!published.some((item) => item.id === draft.id), 'draft không được xuất hiện');
});

console.log('\n3. Vòng đời tin draft → published → archived → draft (mục 5.2)');
let lifecycleId = null;
await test('publish đặt publishedAt, tin xuất hiện công khai', async () => {
  const draft = await organization.createNews({ title: 'Tin kiểm thử vòng đời', content: 'Nội dung.', summary: 'Tóm tắt.' });
  lifecycleId = draft.id;
  assert.equal(draft.status, 'draft');
  assert.equal(draft.publishedAt, null);
  const published = await organization.publishNews(draft.id);
  assert.equal(published.status, 'published');
  assert.ok(published.publishedAt, 'publish phải đặt publishedAt');
  const visible = await organization.getPublishedNews();
  assert.ok(visible.some((item) => item.id === draft.id));
});
await test('archive đặt archivedAt, tin biến mất khỏi trang công khai', async () => {
  const archived = await organization.archiveNews(lifecycleId);
  assert.equal(archived.status, 'archived');
  assert.ok(archived.archivedAt, 'archive phải đặt archivedAt');
  const visible = await organization.getPublishedNews();
  assert.ok(!visible.some((item) => item.id === lifecycleId));
});
await test('khôi phục về draft xóa archivedAt, chưa công khai lại', async () => {
  const restored = await organization.restoreNews(lifecycleId);
  assert.equal(restored.status, 'draft');
  assert.equal(restored.archivedAt, null, 'restore phải xóa archivedAt');
  const visible = await organization.getPublishedNews();
  assert.ok(!visible.some((item) => item.id === lifecycleId), 'phải cần publish rõ ràng mới công khai');
});
await test('publish tin archived bị từ chối, phải restore trước', async () => {
  await organization.archiveNews(lifecycleId);
  const error = await rejectsCode(organization.publishNews(lifecycleId), 'VALIDATION_ERROR');
  assert.match(error.message, /khôi phục/i);
  await organization.restoreNews(lifecycleId);
});
await test('createNews không nhận status published trực tiếp', async () => {
  await rejectsCode(organization.createNews({ title: 'X', content: 'Y', status: 'published' }), 'VALIDATION_ERROR');
});

console.log('\n4. Hành trình: durationDays, tham chiếu, active/inactive (mục 5.2)');
let journeyId = null;
await test('createJourney kiểm tra durationDays nguyên dương', async () => {
  await rejectsCode(organization.createJourney({ title: 'Rỗng', durationDays: 0 }), 'VALIDATION_ERROR');
  await rejectsCode(organization.createJourney({ title: 'Âm', durationDays: -5 }), 'VALIDATION_ERROR');
  await rejectsCode(organization.createJourney({ title: 'Thập phân', durationDays: 1.5 }), 'VALIDATION_ERROR');
  await rejectsCode(organization.createJourney({ title: 'Thiếu' }), 'VALIDATION_ERROR');
  const journey = await organization.createJourney({ title: 'Hành trình test 21 ngày', durationDays: 21, targetRole: 'all' });
  journeyId = journey.id;
  assert.equal(journey.durationDays, 21);
  assert.equal(journey.status, 'active');
});
await test('updateJourney kiểm tra lại durationDays', async () => {
  await rejectsCode(organization.updateJourney(journeyId, { durationDays: 0 }), 'VALIDATION_ERROR');
  const updated = await organization.updateJourney(journeyId, { durationDays: 45, title: 'Hành trình test 45 ngày' });
  assert.equal(updated.durationDays, 45);
  assert.equal(updated.title, 'Hành trình test 45 ngày');
});
await test('journey có tham chiếu: đếm được, không có hàm xóa', async () => {
  const references = await organization.getJourneyReferences('journeys-001');
  assert.ok(references.newHires > 0, 'journeys-001 phải có nhân sự tham chiếu trong seed');
  assert.equal(typeof organization.deleteJourney, 'undefined', 'không được xuất hàm xóa journey');
});
await test('vô hiệu hóa journey có tham chiếu giữ nguyên bản ghi', async () => {
  const result = await organization.setJourneyStatus('journeys-001', 'inactive');
  assert.equal(result.status, 'inactive');
  const still = await getById('journeys', 'journeys-001');
  assert.ok(still, 'bản ghi phải còn nguyên, không xóa liên kết');
  const references = await organization.getJourneyReferences('journeys-001');
  assert.ok(references.newHires > 0, 'liên kết nhân sự không bị mất');
  await organization.setJourneyStatus('journeys-001', 'active');
});
await test('assertJourneyAssignable từ chối journey inactive', async () => {
  await organization.assertJourneyAssignable('journeys-001'); // active: không lỗi
  await organization.setJourneyStatus('journeys-001', 'inactive');
  await rejectsCode(organization.assertJourneyAssignable('journeys-001'), 'FORBIDDEN');
  await organization.setJourneyStatus('journeys-001', 'active');
});


console.log('\n5. Quyền: chỉ HR/Admin sửa; đổi role/vô hiệu hóa tác động lần kiểm tra sau (mục 5.1, 5.8)');
await test('chưa đăng nhập không ghi được', async () => {
  auth.logout();
  await rejectsCode(organization.createNews({ title: 'X', content: 'Y' }), 'FORBIDDEN');
  await rejectsCode(organization.createJourney({ title: 'X', durationDays: 10 }), 'FORBIDDEN');
  await rejectsCode(organization.updateCompanyInfo({ mission: 'X' }), 'FORBIDDEN');
});
await test('newHire không ghi được nội dung công ty/tin/hành trình', async () => {
  await auth.login('user-001');
  await rejectsCode(organization.createNews({ title: 'X', content: 'Y' }), 'FORBIDDEN');
  await rejectsCode(organization.updateCompanyInfo({ mission: 'X' }), 'FORBIDDEN');
  await rejectsCode(organization.setJourneyStatus('journeys-001', 'inactive'), 'FORBIDDEN');
});
await test('HR ghi được, Admin cũng ghi được', async () => {
  await auth.login('user-004');
  const news = await organization.createNews({ title: 'HR viết', content: 'Nội dung.' });
  assert.ok(news.id);
  await auth.login('user-005');
  const journey = await organization.createJourney({ title: 'Admin viết', durationDays: 7 });
  assert.ok(journey.id);
});
await test('vô hiệu hóa tài khoản: lần kiểm tra quyền kế tiếp bị từ chối', async () => {
  await auth.login('user-004'); // HR đang hoạt động
  await organization.createNews({ title: 'Trước khi disable', content: 'OK.' });
  const { update } = await import('../js/data/store.js');
  await update('users', 'user-004', { status: 'inactive' }); // mô phỏng Admin vô hiệu hóa
  const error = await rejectsCode(organization.createNews({ title: 'Sau khi disable', content: 'OK.' }), 'FORBIDDEN');
  assert.match(error.message, /vô hiệu hóa/i);
  await update('users', 'user-004', { status: 'active' }); // khôi phục
});
await test('đổi role: lần kiểm tra quyền kế tiếp phản ánh role mới', async () => {
  const { update } = await import('../js/data/store.js');
  await auth.login('user-004'); // hr
  await organization.createNews({ title: 'Còn là HR', content: 'OK.' });
  await update('users', 'user-004', { role: 'newHire' }); // mô phỏng Admin đổi vai trò
  await rejectsCode(organization.createNews({ title: 'Đã thành newHire', content: 'OK.' }), 'FORBIDDEN');
  await update('users', 'user-004', { role: 'hr' }); // khôi phục
});
await test('login chỉ nhận tài khoản active', async () => {
  const { update } = await import('../js/data/store.js');
  await update('users', 'user-002', { status: 'inactive' });
  await rejectsCode(auth.login('user-002'), 'FORBIDDEN');
  await update('users', 'user-002', { status: 'active' });
  await auth.login('user-002');
  assert.equal((await auth.getCurrentUser()).id, 'user-002');
});

console.log('\n6. Progress Risk: giải thích, thiếu dữ liệu là unknown, lưu qua aiHistory (mục 5.6–5.7)');
await test('không đăng nhập không phân tích được', async () => {
  auth.logout();
  await rejectsCode(progressRisk.analyzeRisk('hire-001'), 'FORBIDDEN');
});
await test('tasks.js chưa sẵn sàng → level unknown, không phải low', async () => {
  await auth.login('user-004');
  const analysis = await progressRisk.analyzeRisk('hire-001');
  assert.equal(analysis.level, 'unknown');
  assert.ok(analysis.reason.length > 0, 'phải có giải thích');
  assert.ok(analysis.recommendations.length > 0, 'phải có đề xuất');
});
await test('lưu đánh giá vào aiHistory, đọc lại được, không tự sửa tiến độ task', async () => {
  await auth.login('user-004');
  const tasksBefore = JSON.stringify(await getAll('tasks'));
  const analysis = await progressRisk.analyzeRisk('hire-001');
  const saved = await progressRisk.saveRiskEvaluation(analysis, 'Kiểm thử tích hợp');
  assert.equal(saved.featureType, 'progressRisk');
  assert.equal(saved.newHireId, 'hire-001');
  assert.equal(saved.decision, 'pending');
  assert.deepEqual(saved.result.recommendations, analysis.recommendations);
  const savedList = await progressRisk.listSavedEvaluations();
  assert.ok(savedList.some((item) => item.id === saved.id));
  const tasksAfter = JSON.stringify(await getAll('tasks'));
  assert.equal(tasksAfter, tasksBefore, 'Progress Risk không được ghi đè tasks');
});
await test('newHire không lưu được đánh giá AI; mentor không thấy lịch sử HR', async () => {
  await auth.login('user-001');
  await rejectsCode(aiHistory.createAiHistory({
    featureType: 'progressRisk', input: 'x', result: { level: 'low' }, newHireId: 'hire-001',
  }), 'FORBIDDEN');
  await auth.login('user-003'); // mentor
  const list = await aiHistory.listAiHistory({ featureType: 'progressRisk' });
  assert.ok(list.every((item) => item.userId === 'user-003'), 'mỗi người chỉ thấy lịch sử của mình');
});
await test('sửa kết quả AI chỉ khi còn pending (mục 2.8)', async () => {
  await auth.login('user-004');
  const record = await aiHistory.createAiHistory({
    featureType: 'progressRisk', input: 'x', result: { level: 'unknown', summary: 's', recommendations: [] }, newHireId: 'hire-001',
  });
  await aiHistory.updateAiHistory(record.id, { decision: 'accepted' });
  await rejectsCode(aiHistory.updateAiHistory(record.id, { result: { level: 'low' } }), 'VALIDATION_ERROR');
});

console.log('\n7. Module chờ SV1/SV2 ném MODULE_NOT_READY rõ ràng (mục 6.2)');
await test('tasks.getProgress ném MODULE_NOT_READY', async () => {
  const error = await rejectsCode(tasks.getProgress('hire-001'), 'MODULE_NOT_READY');
  assert.match(error.message, /SV2/);
});
await test('resources và people ném MODULE_NOT_READY', async () => {
  await rejectsCode(resources.listDepartments(), 'MODULE_NOT_READY');
  await rejectsCode(people.listUsers(), 'MODULE_NOT_READY');
});

console.log(`\nKết quả: ${passed} đạt, ${failures.length} lỗi.`);
if (failures.length) {
  process.exitCode = 1;
}

