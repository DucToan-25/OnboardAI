const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function createServer() {
  return http.createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      const realFile = await fs.realpath(file);
      const realRelative = path.relative(root, realFile);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        response.writeHead(403); response.end('Forbidden'); return;
      }
      const contents = await fs.readFile(realFile);
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream', 'Content-Length': contents.length, 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : contents);
    } catch (error) {
      const status = error instanceof URIError ? 400 : 404;
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(status === 400 ? 'Bad request' : 'Not found');
    }
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.argv[2] || 8000);
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`OnboardAI: http://127.0.0.1:${port}/`);
  });
}
