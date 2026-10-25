import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLLECTIONS, validateSeedVersions } from '../js/data/store.js';
import { ROUTES } from '../js/config/routes.js';
import { ROLE_MENUS } from '../js/config/roles.js';
import { parseStoredDate } from '../js/common/format.js';
import { validateRecord } from '../js/data/schema.js';

// Read-only audit. Report collection/record IDs, never account fields or passwords.
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDirectory = path.join(root, 'assets', 'data');
const records = new Map();
const indexes = new Map();
let errors = 0;
let warnings = 0;
const report = (level, message) => {
  if (level === 'ERROR') errors++;
  if (level === 'WARN') warnings++;
  console.log(`${level} ${message}`);
};
const relative = file => path.relative(root, file).split(path.sep).join('/');
const exists = async file => {
  try { await fs.access(file); return true; } catch { return false; }
};

// Business data must stay in one canonical directory; tooling config is excluded.
async function inspectDataFiles(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') await inspectDataFiles(file);
    } else if (entry.isFile() && entry.name.endsWith('.json') && file !== path.join(root, 'package.json')) {
      const expected = path.dirname(file) === dataDirectory && (COLLECTIONS.includes(path.basename(file, '.json')) || path.basename(file) === 'version.json');
      if (!expected) report('ERROR', `${relative(file)}: JSON data is outside the registered canonical collections.`);
    }
  }
}
await inspectDataFiles(root);

try {
  validateSeedVersions(JSON.parse((await fs.readFile(path.join(dataDirectory, 'version.json'), 'utf8')).replace(/^\uFEFF/, '')));
  report('OK', 'assets/data/version.json: valid seed version manifest.');
} catch (error) {
  report('ERROR', `assets/data/version.json: ${error instanceof SyntaxError ? 'invalid JSON.' : error.message}`);
}

for (const collection of COLLECTIONS) {
  const file = path.join(dataDirectory, `${collection}.json`);
  try {
    const rows = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
    if (!Array.isArray(rows)) throw new Error('Collection must be an array.');
    const ids = new Map();
    for (let index = 0; index < rows.length; index++) {
      const item = rows[index];
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id.trim()) {
        report('ERROR', `${relative(file)}: item ${index + 1} has no valid ID.`);
        continue;
      }
      if (ids.has(item.id)) report('ERROR', `${relative(file)}: duplicate ID ${item.id} (items ${ids.get(item.id) + 1}, ${index + 1}).`);
      else ids.set(item.id, index);
      for (const issue of validateRecord(collection, item)) {
        report('ERROR', `${collection}/${item.id}: ${issue.field} ${issue.message}.`);
      }
    }
    records.set(collection, rows.filter(item => item && typeof item === 'object' && !Array.isArray(item)));
    indexes.set(collection, new Map([...ids].map(([id, index]) => [id, rows[index]])));
    report('OK', `${relative(file)}: ${rows.length} records.`);
  } catch (error) {
    report('ERROR', `${relative(file)}: ${error.code === 'ENOENT' ? 'missing canonical JSON.' : error instanceof SyntaxError ? 'invalid JSON (record values are not printed).' : error.message}`);
  }
}

for (const file of await fs.readdir(dataDirectory)) {
  if (file.endsWith('.json') && file !== 'version.json' && !COLLECTIONS.includes(file.slice(0, -5))) report('WARN', `assets/data/${file}: collection is not registered in store.js.`);
}

const references = {
  users: { departmentId: 'departments' },
  newHires: { userId: 'users', departmentId: 'departments', mentorId: 'users', journeyId: 'journeys' },
  tasks: { newHireId: 'newHires', journeyId: 'journeys', assignedTo: 'users', createdBy: 'users' },
  departments: { managerId: 'users' },
  documents: { departmentId: 'departments', createdBy: 'users' },
  checkins: { newHireId: 'newHires', mentorId: 'users' },
  journeys: { departmentId: 'departments', createdBy: 'users' },
  companyInfo: { updatedBy: 'users' },
  news: { authorId: 'users' },
  aiMockData: { sourceDocumentId: 'documents' },
  aiHistory: { userId: 'users', newHireId: 'newHires', sourceDocumentId: 'documents' },
};
for (const [collection, fields] of Object.entries(references)) {
  for (const item of records.get(collection) || []) {
    if (!item || typeof item !== 'object') continue;
    for (const [field, target] of Object.entries(fields)) {
      const id = item[field];
      if (id != null && id !== '' && indexes.has(target) && !indexes.get(target).has(id)) {
        report('ERROR', `${collection}/${item.id}: ${field} references missing ${target}/${id}.`);
      }
    }
  }
}

for (const hire of records.get('newHires') || []) {
  const user = indexes.get('users')?.get(hire.userId);
  const mentor = indexes.get('users')?.get(hire.mentorId);
  if (user && user.role !== 'newHire') report('ERROR', `newHires/${hire.id}: user account role is not newHire.`);
  if (user && user.departmentId !== hire.departmentId) report('ERROR', `newHires/${hire.id}: departmentId differs from linked user.`);
  if (mentor && mentor.role !== 'mentor') report('ERROR', `newHires/${hire.id}: mentor account role is not mentor.`);
}
for (const task of records.get('tasks') || []) {
  const hire = indexes.get('newHires')?.get(task.newHireId);
  if (hire && (task.assignedTo !== hire.userId || task.journeyId !== hire.journeyId)) {
    report('ERROR', `tasks/${task.id}: assignedTo or journeyId differs from linked newHires/${hire.id}.`);
  }
}

const appointments = new Map();
for (const item of records.get('checkins') || []) {
  if (item.status === 'cancelled') continue;
  const instant = parseStoredDate(item.scheduledAt);
  if (!instant) { report('WARN', `checkins/${item.id}: invalid scheduledAt.`); continue; }
  const key = JSON.stringify([item.newHireId, item.mentorId, instant.toISOString()]);
  if (!appointments.has(key)) appointments.set(key, []);
  appointments.get(key).push(item.id);
}
const duplicateAppointments = [...appointments.values()].filter(ids => ids.length > 1);
if (duplicateAppointments.length) report('ERROR', `checkins: ${duplicateAppointments.length} duplicate appointment groups; first group ${duplicateAppointments[0].join(', ')}.`);

const missingAttachments = [];
const referencedAttachments = new Set();
for (const item of records.get('documents') || []) {
  if (item.fileUrl && !/^https?:\/\//i.test(item.fileUrl)) {
    const attachment = path.resolve(root, item.fileUrl);
    referencedAttachments.add(attachment);
    if (!await exists(attachment)) missingAttachments.push(item.id);
  }
}
if (missingAttachments.length) report('WARN', `documents: ${missingAttachments.length} local attachments are absent; detail must display the missing-file state.`);
const docsDirectory = path.join(root, 'assets', 'docs');
for (const file of await fs.readdir(docsDirectory)) {
  const absolute = path.join(docsDirectory, file);
  if (!referencedAttachments.has(absolute)) report('WARN', `assets/docs/${file}: file is not referenced by documents.json.`);
}

for (const item of records.get('companyInfo') || []) {
  if (item.logoUrl && !/^https?:\/\//i.test(item.logoUrl) && !await exists(path.resolve(root, item.logoUrl))) {
    report('ERROR', `companyInfo/${item.id}: logoUrl points to a missing asset.`);
  }
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return groups.flat();
}
const modules = (await walk(path.join(root, 'js'))).filter(file => file.endsWith('.js'));
const graph = new Map();
for (const file of modules) {
  const source = await fs.readFile(file, 'utf8');
  const dependencies = [];
  for (const match of source.matchAll(/(?:from\s*|import\s*\(?)['"]([^'"\n]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), match[1]);
    if (!await exists(target)) report('ERROR', `${relative(file)}: missing import ${match[1]}.`);
    dependencies.push(target);
  }
  if (relative(file) !== 'js/data/store.js' && /\b(?:localStorage|sessionStorage)\s*[.\[]/.test(source)) report('ERROR', `${relative(file)}: direct browser storage reference outside store.js.`);
  if (/\?role=|URLSearchParams\(\s*\{\s*role\b/.test(source)) report('ERROR', `${relative(file)}: role query must not be used for navigation or authorization.`);
  graph.set(file, dependencies);
}

const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dependency of graph.get(file) || []) visit(dependency);
}
visit(path.join(root, 'js', 'main.js'));
for (const [pageId, route] of Object.entries(ROUTES)) {
  const file = path.join(root, pageId === 'index' ? 'index.html' : `pages/${pageId}.html`);
  const module = path.join(root, 'js', 'pages', `${['403', '404'].includes(pageId) ? 'error' : pageId}.js`);
  if (!await exists(file)) { report('ERROR', `${pageId}: missing route HTML.`); continue; }
  if (!await exists(module)) report('ERROR', `${pageId}: missing page module.`);
  if (!route.available) report('WARN', `${pageId}: route is not enabled in APP_CONFIG.`);
  visit(module);
  const html = await fs.readFile(file, 'utf8');
  if (!html.includes(`data-page="${pageId}"`)) report('ERROR', `${relative(file)}: data-page does not match the route.`);
  const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)];
  if (scripts.length !== 1 || path.resolve(path.dirname(file), scripts[0]?.[1] || '') !== path.join(root, 'js', 'main.js')) report('ERROR', `${relative(file)}: expected exactly one main.js entry script.`);
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(value)) continue;
    const target = value.split(/[?#]/)[0];
    if (target && !await exists(path.resolve(path.dirname(file), decodeURIComponent(target)))) report('ERROR', `${relative(file)}: missing local link or asset ${target}.`);
  }
}
for (const file of modules) if (!reachable.has(file)) report('WARN', `${relative(file)}: not reachable from main.js or a registered page module.`);
for (const [role, menu] of Object.entries(ROLE_MENUS)) {
  for (const item of menu) if (!ROUTES[item.pageId]?.allowedRoles.includes(role)) report('ERROR', `${role}: menu ${item.pageId} has no matching allowed route.`);
}
report('OK', `${Object.keys(ROUTES).length} routes and ${modules.length} JavaScript modules inspected.`);
console.log(`Audit complete: ${errors} errors, ${warnings} warnings. No files or browser data were changed.`);
process.exitCode = errors ? 1 : 0;
