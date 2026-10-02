/**
 * Autumn Desk — Static File Server
 * Serves only public files with security: path traversal, hidden files, MIME types.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, normalize } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ────────────────────────────────────────────────────────────

const PUBLIC_DIR = resolve(join(__dirname, 'public'));
const ENV_PATH = resolve(join(__dirname, '.env'));

function loadEnv() {
  const defaults = { HOST: process.env.HOST || '0.0.0.0', PORT: process.env.PORT || '8765' };
  if (!existsSync(ENV_PATH)) return defaults;

  const content = readFileSync(ENV_PATH, 'utf-8');
  const config = { ...defaults };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key === 'HOST' || key === 'PORT') {
      // Environment variables take precedence over .env values
      if (!process.env[key]) {
        config[key] = val;
      }
    }
  }
  return config;
}

const config = loadEnv();
const HOST = config.HOST;
const PORT = parseInt(config.PORT, 10);

// ─── Validation ───────────────────────────────────────────────────────────────

function validateConfig() {
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    console.error(`Ошибка: некорректный PORT="${config.PORT}". Должен быть число от 1 до 65535.`);
    process.exit(1);
  }
  if (!HOST || typeof HOST !== 'string') {
    console.error(`Ошибка: некорректный HOST="${config.HOST}".`);
    process.exit(1);
  }
  if (!existsSync(PUBLIC_DIR)) {
    console.error(`Ошибка: публичная директория не найдена: ${PUBLIC_DIR}`);
    process.exit(1);
  }
}

validateConfig();

// ─── MIME Types ───────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
};

function getMIME(path) {
  const ext = path.slice(path.lastIndexOf('.'));
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ─── Path Resolution ─────────────────────────────────────────────────────────

function resolvePath(requestPath) {
  // Decode URI components
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    decoded = requestPath;
  }

  // Normalize and remove trailing slashes (except root)
  let normalized = normalize(decoded).replace(/\/+$/, '') || '/';
  if (normalized === '/') normalized = '/index.html';

  // Join with public dir
  const fullPath = resolve(join(PUBLIC_DIR, normalized));
  const publicNorm = normalize(PUBLIC_DIR);

  // Ensure resolved path is within public directory
  if (!fullPath.startsWith(publicNorm + '/') && fullPath !== publicNorm) {
    return null; // Path traversal detected
  }

  return fullPath;
}

// ─── Hidden Files Filter ─────────────────────────────────────────────────────

function isHidden(path) {
  const parts = path.split('/');
  return parts.some((part) => part.startsWith('.') && part !== '.');
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  // Only handle GET requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  const requestPath = parsedUrl.pathname;

  // Check for hidden files/directories in path
  if (isHidden(requestPath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const fullPath = resolvePath(requestPath);
  if (!fullPath) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  try {
    const stats = statSync(fullPath);
    if (!stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  // Check for hidden files in resolved path
  if (isHidden(fullPath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Serve file
  try {
    const content = readFileSync(fullPath);
    const mimeType = getMIME(fullPath);

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function shutdown() {
  console.log('Остановка сервера...');
  server.close(() => {
    console.log('Сервер остановлен.');
    process.exit(0);
  });
  // Force close after 5 seconds
  setTimeout(() => {
    console.error('Принудительная остановка сервера.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен: http://${HOST}:${PORT}`);
  console.log(`Публичная директория: ${PUBLIC_DIR}`);
});
