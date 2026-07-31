/* Serveur statique minimal, sans dépendance, pour servir l'app pendant les
   tests E2E. Monte le dépôt sous BASE_PATH (par défaut /Gantt-Planner-V2/)
   pour reproduire la structure de sous-répertoire de GitHub Pages — c'est
   cette différence entre origin et pathname qui avait causé le bug du lien
   d'invitation cassé (voir js/collaboration.js). */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE_PATH = (process.env.E2E_BASE_PATH || '/Gantt-Planner-V2/').replace(/\/?$/, '/');
const PORT = Number(process.env.E2E_PORT || 4173);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);

    if (!reqPath.startsWith(BASE_PATH)) {
        res.writeHead(404);
        res.end('Not found (outside base path)');
        return;
    }
    reqPath = reqPath.slice(BASE_PATH.length) || 'index.html';
    if (reqPath.endsWith('/')) reqPath += 'index.html';

    const filePath = path.join(ROOT, reqPath);
    if (!filePath.startsWith(ROOT) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
    console.log(`[e2e static server] http://localhost:${PORT}${BASE_PATH}`);
});
