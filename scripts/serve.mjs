import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = process.argv.includes('--dist') ? path.join(projectRoot, 'dist') : projectRoot;
const port = Number(process.env.PORT || 5088);
const publicFiles = new Set(['index.html', 'styles.css', 'app.js', 'audio.js', 'sculpture.js', 'assets/favicon.svg', 'assets/social.svg', 'assets/ember.svg', 'assets/tidal.svg', 'assets/orbit.svg', 'assets/bodoni-moda-latin.woff2', 'assets/OFL-Bodoni-Moda.txt']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Cache-Control', 'no-cache');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html'; }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (!publicFiles.has(requested)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const file = path.join(root, requested);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log('STILLFORM is open at http://127.0.0.1:' + port + (root.endsWith('dist') ? ' (production build)' : '')));
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
process.on('SIGINT', () => server.close());
