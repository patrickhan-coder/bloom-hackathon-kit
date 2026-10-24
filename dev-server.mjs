// Local runner: serves public/ and the api/ handlers with a Vercel-like req/res.
// Without Redis env vars it uses the file-backed memory store (.data/dev-store.json).
// Also works as the offline fallback on the operator laptop if venue internet fails.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4400);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.md': 'text/markdown; charset=utf-8', '.zip': 'application/zip', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webp': 'image/webp', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };

// load .env.local if present
try {
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, '');
    const file = path.join(root, 'api', `${name}.js`);
    if (!fs.existsSync(file) || name.startsWith('_')) { res.writeHead(404); return res.end('not found'); }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = raw; }
    res.status = code => { res.statusCode = code; return res; };
    res.send = b => { res.end(typeof b === 'string' ? b : JSON.stringify(b)); return res; };
    res.json = b => { res.setHeader('Content-Type', 'application/json'); return res.send(JSON.stringify(b)); };
    try {
      const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
      await mod.default(req, res);
    } catch (e) { console.error(e); if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: String(e.message || e) })); } }
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(root, 'public', p);
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Hackathon kit dev server → http://localhost:${PORT}` + (process.env.ADMIN_KEY ? '' : '  (dev keys: /console?key=dev-admin · /judge?k=dev-vc1)')));
