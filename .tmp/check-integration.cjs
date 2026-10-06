const fs = require('fs');
const path = require('path');

let bad = 0;
function fail(msg) { console.log(msg); bad++; }

// 1. Syntax check every JS file
const jsFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) jsFiles.push(full);
  }
})('js');
for (const file of jsFiles) {
  try {
    new Function('return 0'); // noop
    require('child_process').execSync(`node --check "${file}"`, { stdio: 'pipe' });
  } catch (error) {
    fail(`SYNTAX ERROR in ${file}: ${error.stderr}`);
  }
}

// 2. Region check: regions queried by page modules exist in matching HTML
const pages = fs.readdirSync('pages').filter((f) => f.endsWith('.html'));
for (const file of pages) {
  const html = fs.readFileSync(path.join('pages', file), 'utf8');
  const base = file.replace('.html', '');
  const jsPath = path.join('js', 'pages', ['403', '404'].includes(base) ? 'error.js' : `${base}.js`);
  if (!fs.existsSync(jsPath)) { fail(`NO JS module for ${file}`); continue; }
  const src = fs.readFileSync(jsPath, 'utf8');
  const regions = [...src.matchAll(/region\('([\w-]*)'\)/g)].map((m) => m[1]);
  for (const region of new Set(regions)) {
    if (!html.includes(`data-region="${region}"`)) fail(`MISSING region "${region}" in ${file}`);
  }
  // data-action names used by delegation in JS should exist in HTML or be created in JS
  // CSS links must exist
  for (const match of html.matchAll(/href="\.\.\/(css\/[^"]+\.css)"/g)) {
    if (!fs.existsSync(match[1])) fail(`MISSING CSS ${match[1]} for ${file}`);
  }
  for (const match of html.matchAll(/src="\.\.\/(js\/[^"]+\.js)"/g)) {
    if (!fs.existsSync(match[1])) fail(`MISSING SCRIPT ${match[1]} for ${file}`);
  }
  // data-page must match filename
  const dataPage = html.match(/data-page="([^"]+)"/);
  if (!dataPage || dataPage[1] !== base) fail(`data-page mismatch in ${file}: ${dataPage && dataPage[1]}`);
}

// 3. ROUTES must contain all 18 data-page keys
const routesSrc = fs.readFileSync('js/config/routes.js', 'utf8');
for (const file of pages) {
  const base = file.replace('.html', '');
  if (!routesSrc.includes(`'${base}'`) && !routesSrc.includes(`"${base}"`)) fail(`ROUTE missing for ${base}`);
}

// 4. availablePages must list all 18
const appSrc = fs.readFileSync('js/config/app.js', 'utf8');
const listMatch = appSrc.match(/availablePages:\s*\[([\s\S]*?)\]/);
const available = listMatch ? (listMatch[1].match(/'([\w-]+)'/g) || []).map((s) => s.slice(1, -1)) : [];
for (const file of pages) {
  const base = file.replace('.html', '');
  if (!available.includes(base)) fail(`availablePages missing ${base}`);
}

// 5. seed.json parses and has required top-level entities
const seed = JSON.parse(fs.readFileSync('assets/data/seed.json', 'utf8'));
for (const key of ['users', 'departments', 'newHires', 'journeys', 'journeyAssignments', 'tasks', 'checkins', 'documents', 'settings']) {
  if (!Array.isArray(seed[key])) fail(`seed missing array: ${key}`);
}

// 6. Page modules only export initPage (single export check)
for (const file of fs.readdirSync('js/pages')) {
  const src = fs.readFileSync(path.join('js/pages', file), 'utf8');
  const exports = [...src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]);
  if (exports.length !== 1 || exports[0] !== 'initPage') fail(`BAD exports in js/pages/${file}: ${exports.join(',')}`);
}

// 7. Import graph: every relative import must resolve to an existing file
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  for (const match of src.matchAll(/from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const spec = match[1] || match[2];
    if (!spec) continue;
    if (spec.includes('${')) continue; // dynamic template import (routes lazy loader)
    const resolved = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(resolved)) fail(`BROKEN IMPORT ${spec} in ${file}`);
  }
}

console.log(bad === 0 ? 'ALL CHECKS OK' : `ISSUES: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
