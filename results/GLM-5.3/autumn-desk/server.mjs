// Автономный статический сервер проекта «Осенний рабочий стол».
// Отдаёт только файлы из публичного каталога public/; без зависимостей.
// Использование:
//   node server.mjs [--env <file>] [--host <host>] [--port <port>]
// Приоритет настроек: флаги CLI > .env > значения по умолчанию.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 8137;

// ------------------------------------------------------------- конфигурация

function parseArgs(argv) {
  const args = { env: null, host: null, port: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env') args.env = argv[++i];
    else if (a === '--host') args.host = argv[++i];
    else if (a === '--port') args.port = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Неизвестный аргумент: ${a}`);
  }
  return args;
}

export function loadEnvFile(file) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return out; // .env не обязателен
    throw new Error(`Не удалось прочитать ${file}: ${err.message}`);
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) throw new Error(`Некорректная строка в ${file}: "${rawLine}" (ожидается KEY=VALUE)`);
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Некорректное имя переменной в ${file}: "${key}"`);
    }
    out[key] = value;
  }
  return out;
}

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME_RE = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

export function validateHost(host) {
  if (host === '' || typeof host !== 'string') return 'HOST пуст';
  if (host === 'localhost' || host === IPV4_RE.test(host) || host === '::' || host === '::1') return null;
  if (host.includes(':')) return `HOST "${host}" не поддерживается (используйте IPv4, ::, ::1 или localhost)`;
  if (!HOSTNAME_RE.test(host)) return `HOST "${host}" не похож на IP-адрес или имя хоста`;
  return null;
}

export function validatePort(port) {
  if (!/^\d+$/.test(String(port))) return `PORT "${port}" должен быть целым числом`;
  const n = Number(port);
  if (!Number.isSafeInteger(n) || n < 1024 || n > 65535) {
    return `PORT "${port}" вне допустимого диапазона 1024..65535`;
  }
  return null;
}

export function resolveConfig({ envFile, host, port } = {}) {
  const fileEnv = loadEnvFile(envFile ?? path.join(PROJECT_ROOT, '.env'));
  const cfg = {
    host: host ?? fileEnv.HOST ?? DEFAULT_HOST,
    port: port ?? fileEnv.PORT ?? DEFAULT_PORT,
  };
  const problems = [];
  const hErr = validateHost(cfg.host);
  if (hErr) problems.push(hErr);
  const pErr = validatePort(cfg.port);
  if (pErr) problems.push(pErr);
  if (problems.length) {
    const e = new Error(`Некорректная конфигурация: ${problems.join('; ')}`);
    e.code = 'BAD_CONFIG';
    throw e;
  }
  cfg.port = Number(cfg.port);
  return cfg;
}

// ------------------------------------------------------------- статика

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webmanifest': 'application/manifest+json',
};

function sendText(res, code, msg) {
  const body = Buffer.from(msg + '\n', 'utf8');
  res.writeHead(code, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

// Безопасное сопоставление URL с файлом внутри публичного корня.
// Возвращает {file} либо {reject: code, msg}.
export function mapUrlToFile(publicDir, rawUrl) {
  let pathname;
  try {
    pathname = new URL(rawUrl, 'http://internal.invalid').pathname;
  } catch {
    return { reject: [400, 'Некорректный URL'] };
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { reject: [400, 'Некорректное кодирование URL'] };
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return { reject: [400, 'Некорректный путь'] };
  }
  // Разбор на сегменты после нормализации косых черт.
  const segments = decoded.split('/').filter((s) => s !== '');
  for (const seg of segments) {
    if (seg === '.' || seg === '..') return { reject: [403, 'Обход пути запрещён'] };
    if (seg.startsWith('.')) return { reject: [404, 'Файл не найден'] }; // скрытые файлы не отдаём
  }
  const rel = segments.join('/');
  const abs = path.resolve(publicDir, rel);
  const rootWithSep = publicDir.endsWith(path.sep) ? publicDir : publicDir + path.sep;
  if (abs !== publicDir && !abs.startsWith(rootWithSep)) {
    return { reject: [403, 'Обход пути запрещён'] };
  }
  return { file: abs, isRoot: segments.length === 0 };
}

function statSafe(file) {
  try {
    return fs.lstatSync(file);
  } catch {
    return null;
  }
}

export function createServer({ publicDir = PUBLIC_DIR } = {}) {
  const realPublicRoot = fs.realpathSync(publicDir);

  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        sendText(res, 405, 'Метод не поддерживается');
        return;
      }
      const mapped = mapUrlToFile(realPublicRoot, req.url);
      if (mapped.reject) {
        sendText(res, mapped.reject[0], mapped.reject[1]);
        return;
      }
      let file = mapped.file;
      let st = statSafe(file);
      // Каталог: только корень отдаёт index.html; листинга нет.
      if (st && st.isDirectory()) {
        if (!mapped.isRoot) {
          sendText(res, 404, 'Файл не найден');
          return;
        }
        file = path.join(file, 'index.html');
        st = statSafe(file);
      }
      if (!st || !st.isFile()) {
        sendText(res, 404, 'Файл не найден');
        return;
      }
      // Симлинки: цель обязана оставаться внутри публичного корня.
      let realFile;
      try {
        realFile = fs.realpathSync(file);
      } catch {
        sendText(res, 404, 'Файл не найден');
        return;
      }
      const rootWithSep = realPublicRoot.endsWith(path.sep) ? realPublicRoot : realPublicRoot + path.sep;
      if (!realFile.startsWith(rootWithSep)) {
        sendText(res, 403, 'Доступ запрещён');
        return;
      }
      const ext = path.extname(realFile).toLowerCase();
      const mime = MIME[ext] ?? 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': st.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const data = await readFile(realFile);
      res.end(data);
    } catch (err) {
      if (!res.headersSent) sendText(res, 500, 'Внутренняя ошибка сервера');
      else res.destroy();
      console.error('[server] ошибка обработки запроса:', err.message);
    }
  });
}

// ------------------------------------------------------------- CLI

function printHelp() {
  console.log(`Осенний рабочий стол — статический сервер

Использование:
  node server.mjs [--env <файл>] [--host <адрес>] [--port <порт>]

Настройки читаются из .env (переменные HOST, PORT); флаги имеют приоритет.
По умолчанию: HOST=${DEFAULT_HOST}, PORT=${DEFAULT_PORT}.
Публичный каталог: public/ (только он и раздаётся).`);
}

export function listen(server, { host, port, publicDir = PUBLIC_DIR }) {
  return new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Ошибка: ${err.message}`);
    process.exit(2);
  }
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  let cfg;
  try {
    cfg = resolveConfig({ envFile: args.env, host: args.host, port: args.port });
  } catch (err) {
    console.error(`Ошибка конфигурации: ${err.message}`);
    console.error(`Проверьте .env или значения --host/--port (пример: HOST=0.0.0.0 PORT=${DEFAULT_PORT}).`);
    process.exit(2);
  }
  const server = createServer();
  listen(server, cfg).then(
    () => {
      const shown = cfg.host.includes(':') ? `[${cfg.host}]` : cfg.host;
      console.log(`Осенний рабочий стол: http://${shown}:${cfg.port}/ (публичный каталог: ${path.relative(PROJECT_ROOT, PUBLIC_DIR) || PUBLIC_DIR})`);
    },
    (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Ошибка: порт ${cfg.port} уже занят другим процессом.`);
        console.error('Укажите свободный порт в .env (PORT=...) или через --port.');
      } else if (err.code === 'EACCES') {
        console.error(`Ошибка: нет прав слушать ${cfg.host}:${cfg.port}.`);
      } else {
        console.error(`Ошибка запуска сервера: ${err.message}`);
      }
      process.exit(3);
    }
  );
}
