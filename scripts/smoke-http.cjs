const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createServer } = require('./serve.cjs');

const root = path.resolve(__dirname, '..');
const server = createServer();
server.listen(0, '127.0.0.1', async () => {
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const pages = ['index.html', ...fs.readdirSync(path.join(root, 'pages')).filter((file) => file.endsWith('.html')).map((file) => `pages/${file}`)];
    const assets = new Set(['assets/data/seed.json', 'assets/icons/sprite.svg']);
    for (const page of pages) {
      const response = await fetch(`${base}/${page}`);
      assert.equal(response.status, 200, page);
      const html = await response.text();
      for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (match[1].startsWith('#') || /^[a-z]+:/i.test(match[1])) continue;
        assets.add(new URL(match[1], `${base}/${page}`).pathname.slice(1));
      }
    }
    assert.equal(await (await fetch(`${base}/`)).text(), fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
    function addModules(dir) {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (entry.isDirectory()) addModules(`${dir}/${entry.name}`);
        else if (entry.name.endsWith('.js')) assets.add(`${dir}/${entry.name}`);
      }
    }
    addModules('js');
    for (const asset of assets) assert.equal((await fetch(`${base}/${asset}`)).status, 200, asset);
    console.log(`PASS HTTP: ${pages.length} pages, ${assets.size} assets`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally { server.close(); }
});
