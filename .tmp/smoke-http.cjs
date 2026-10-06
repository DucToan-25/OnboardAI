const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, urlPath === '/' ? 'pages/login.html' : urlPath);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const pages = fs.readdirSync('pages').filter((f) => f.endsWith('.html'));
  const assets = new Set();
  let bad = 0;
  for (const page of pages) {
    const html = fs.readFileSync(path.join('pages', page), 'utf8');
    for (const match of html.matchAll(/(?:href|src)="\.\.\/([^"]+)"/g)) assets.add(match[1]);
    assets.add('assets/data/seed.json');
    assets.add('assets/icons/sprite.svg');
    assets.add('assets/images/logo.svg');
    assets.add('assets/images/logo-mark.svg');
    const response = await fetch(`${base}/pages/${page}`);
    if (!response.ok) { console.log(`PAGE ${page}: HTTP ${response.status}`); bad++; }
  }
  // also every page module JS
  for (const file of fs.readdirSync('js/pages')) assets.add(`js/pages/${file}`);
  for (const asset of assets) {
    const response = await fetch(`${base}/${asset}`);
    if (!response.ok) { console.log(`ASSET ${asset}: HTTP ${response.status}`); bad++; }
  }
  // seed sanity: required entities readable via HTTP
  const seed = await (await fetch(`${base}/assets/data/seed.json`)).json();
  if (seed.schemaVersion !== 1) { console.log('SEED schemaVersion wrong'); bad++; }
  console.log(bad === 0 ? `HTTP SMOKE OK (${pages.length} pages, ${assets.size} assets)` : `HTTP ISSUES: ${bad}`);
  server.close();
  process.exit(bad === 0 ? 0 : 1);
});
