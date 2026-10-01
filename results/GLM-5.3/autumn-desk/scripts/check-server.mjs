// Проверки сервера: старт/стоп/рестарт, HOST/PORT, отказ при ошибках,
// публичная раздача и защита (traversal, скрытые файлы, симлинки, листинг).
// Запуск: node scripts/check-server.mjs

import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, mapUrlToFile, resolveConfig, listen } from '../server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

let passed = 0;
let failed = 0;
const ok = (name) => {
  passed++;
  console.log(`  ok  ${name}`);
};
const bad = (name, err) => {
  failed++;
  console.error(`FAIL  ${name}: ${err?.message ?? err}`);
};

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.once('error', reject);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function withServer(publicDir, fn) {
  const server = createServer({ publicDir });
  const port = await freePort();
  await listen(server, { host: '127.0.0.1', port });
  try {
    await fn(`http://127.0.0.1:${port}`, port);
  } finally {
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
    server.close();
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: ROOT, ...opts }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, stdout: String(stdout), stderr: String(stderr), err });
    });
  });
}

async function main() {
  // ---------- mapUrlToFile: чистая логика
  const cases = [
    ['/', 'dir'],
    ['/index.html', 'ok'],
    ['/js/main.js', 'ok'],
    ['/../server.mjs', 'inside'],   // URL-парсер нормализует — путь остаётся внутри корня
    ['/..%2Fserver.mjs', 'reject'], // закодированный обход должен быть отвергнут
    ['/%2e%2e/server.mjs', 'inside'], // URL-спека нормализует закодированные точки
    ['/js/%2E%2E/%2E%2E/.env', 'reject'],
    ['/.env', 'reject'],
    ['/js/.hidden.js', 'reject'],
    ['/a%00b', 'reject'],
    ['/..\\server.mjs', 'inside'],  // '\' в специальных схемах = '/', нормализуется
  ];
  for (const [url, expect] of cases) {
    const r = mapUrlToFile(PUBLIC, url);
    if (expect === 'reject') assert.ok(r.reject, `ожидался отказ: ${url}`);
    else if (expect === 'inside') {
      assert.ok(r.file && r.file.startsWith(PUBLIC), `путь вышел за корень: ${url}`);
    } else if (expect === 'dir') assert.ok(r.isRoot, `ожидался корень: ${url}`);
    else assert.ok(r.file, `ожидался файл: ${url}`);
  }
  ok(`mapUrlToFile: ${cases.length} случаев (traversal/скрытые/нелегальные)`);

  // ---------- реальная раздача основного public/
  await withServer(PUBLIC, async (base) => {
    const index = await fetch(base + '/');
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    assert.match(await index.text(), /Осенний рабочий стол/);
    ok('GET / -> 200, text/html, index отдаётся');

    const js = await fetch(base + '/js/main.js');
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /text\/javascript/);
    ok('GET /js/main.js -> 200, text/javascript');

    const three = await fetch(base + '/vendor/three.module.js');
    assert.equal(three.status, 200);
    assert.match(three.headers.get('content-type'), /text\/javascript/);
    assert.ok((await three.text()).length > 1_000_000);
    ok('GET /vendor/three.module.js -> 200 (локальный Three.js раздаётся)');

    const css = await fetch(base + '/css/main.css');
    assert.match(css.headers.get('content-type'), /text\/css/);
    ok('GET /css/main.css -> 200, text/css');

    const head = await fetch(base + '/', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    ok('HEAD / -> 200 без тела');

    const post = await fetch(base + '/', { method: 'POST', body: 'x' });
    assert.equal(post.status, 405);
    ok('POST / -> 405');

    const missing = await fetch(base + '/no-such-file.js');
    assert.equal(missing.status, 404);
    ok('отсутствующий файл -> 404');

    const dir = await fetch(base + '/js/');
    assert.notEqual(dir.status, 200);
    ok('каталог /js/ не отдаётся и не листится');

    // traversal и скрытые — только через HTTP
    const attacks = [
      '/../server.mjs',
      '/%2e%2e/server.mjs',
      '/..%2fserver.mjs',
      '/js/..%2F..%2F.env',
      '/.env',
      '/.git/config',
      '/js/.hidden',
      '//etc/passwd',
    ];
    for (const atk of attacks) {
      const res = await fetch(base + atk, { redirect: 'manual' });
      assert.ok(res.status === 403 || res.status === 404, `${atk} -> ${res.status}`);
      const body = await res.text();
      assert.doesNotMatch(body, /listen|createServer|HOST/);
    }
    ok(`${attacks.length} traversal/скрытых атак отклонены`);

    // сырые запросы в обход нормализации fetch
    const rawRequest = (raw) => new Promise((resolve, reject) => {
      const u = new URL(base);
      const sock = net.connect(Number(u.port), u.hostname, () => {
        sock.write(raw);
      });
      let data = '';
      sock.on('data', (c) => { data += c; });
      sock.on('end', () => resolve(data));
      sock.on('error', reject);
      setTimeout(() => { sock.destroy(); resolve(data); }, 2000);
    });
    const rawAttacks = [
      'GET /../server.mjs HTTP/1.1\r\nHost: t\r\nConnection: close\r\n\r\n',
      'GET /../../.env HTTP/1.1\r\nHost: t\r\nConnection: close\r\n\r\n',
      'GET /js/../../server.mjs HTTP/1.1\r\nHost: t\r\nConnection: close\r\n\r\n',
      'GET /%2e%2e/.env HTTP/1.1\r\nHost: t\r\nConnection: close\r\n\r\n',
      'GET /.%2e/.env HTTP/1.1\r\nHost: t\r\nConnection: close\r\n\r\n',
    ];
    for (const raw of rawAttacks) {
      const resp = await rawRequest(raw);
      const status = Number((resp.match(/^HTTP\/[\d.]+\s+(\d+)/) || [])[1]);
      assert.ok([403, 404].includes(status), `сырой запрос должен быть отклонён: ${raw.split('\r\n')[0]} -> ${status}`);
      assert.doesNotMatch(resp, /createServer|HOST/);
    }
    ok(`сырые traversal-запросы (${rawAttacks.length}) отклонены`);

    // корень сервера не отдаёт .env проекта
    const envProbe = await fetch(base + '/.env');
    assert.ok(envProbe.status >= 400);
    ok('.env недоступен');
  });

  // ---------- симлинк за пределы публичного корня
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-pub-'));
  fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><title>tmp</title>');
  fs.mkdirSync(path.join(tmp, 'sub'));
  fs.writeFileSync(path.join(tmp, 'sub', 'file.txt'), 'inside');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-out-'));
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'SECRET');
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(tmp, 'sub', 'leak.txt'));
  fs.symlinkSync(outside, path.join(tmp, 'sub', 'leakdir'));
  await withServer(tmp, async (base) => {
    const leakFile = await fetch(base + '/sub/leak.txt');
    assert.ok([403, 404].includes(leakFile.status), `leak.txt -> ${leakFile.status}`);
    const leakDir = await fetch(base + '/sub/leakdir/secret.txt');
    assert.ok([403, 404].includes(leakDir.status), `leakdir -> ${leakDir.status}`);
    const inside = await fetch(base + '/sub/file.txt');
    assert.equal(inside.status, 200);
    ok('симлинки за корень отклонены, файлы внутри отдаются');
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });

  // ---------- конфигурация: валидация значений
  assert.ok(resolveConfig({ host: '0.0.0.0', port: '8137' }));
  assert.ok(resolveConfig({ host: '127.0.0.1', port: '9000' }));
  assert.throws(() => resolveConfig({ host: 'bad host!', port: '9000' }));
  assert.throws(() => resolveConfig({ host: '0.0.0.0', port: '70000' }));
  assert.throws(() => resolveConfig({ host: '0.0.0.0', port: 'abc' }));
  assert.throws(() => resolveConfig({ host: '', port: '9000' }));
  ok('некорректные HOST/PORT отвергаются');

  // CLI: некорректный .env -> код 2 и понятное сообщение
  const badEnv = path.join(os.tmpdir(), 'ad-bad.env');
  fs.writeFileSync(badEnv, 'HOST=0.0.0.0\nPORT=not-a-number\n');
  const bad = await run('node', ['server.mjs', '--env', badEnv]);
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /PORT/);
  ok('CLI с битым .env: выход 2, ясная ошибка');

  // CLI: занятый порт -> код 3 и сообщение
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r));
  const busyPort = blocker.address().port;
  const busy = await run('node', ['server.mjs', '--host', '127.0.0.1', '--port', String(busyPort)]);
  assert.equal(busy.code, 3);
  assert.match(busy.stderr, /занят/);
  blocker.close();
  ok('занятый порт: отказ с кодом 3 и сообщением');

  // CLI: уважение HOST/PORT из .env
  const goodPort = await freePort();
  const goodEnv = path.join(os.tmpdir(), 'ad-good.env');
  fs.writeFileSync(goodEnv, `HOST=127.0.0.1\nPORT=${goodPort}\n`);
  const child = spawn('node', ['server.mjs', '--env', goodEnv], { cwd: ROOT, stdio: 'pipe' });
  let started = false;
  const probe = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${goodPort}/`, { signal: AbortSignal.timeout(700) });
      return res.ok;
    } catch {
      return false;
    }
  };
  for (let i = 0; i < 40 && !started; i++) {
    started = await probe();
    if (!started) await wait(150);
  }
  assert.ok(started, 'сервер из .env не поднялся');
  ok(`.env HOST/PORT применяются (порт ${goodPort})`);
  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));

  // ---------- make-цикл через launch.mjs: start -> status -> restart -> stop
  // (использует реальный run/server.pid проекта; после проверки сервер остановлен)
  await run('node', ['scripts/launch.mjs', 'stop']); // идемпотентная уборка
  const testPort = await freePort();
  const envFile = path.join(ROOT, '.env.check-tmp');
  fs.writeFileSync(envFile, `HOST=127.0.0.1\nPORT=${testPort}\n`);
  try {
    const start = await run('node', ['scripts/launch.mjs', 'start', '--env', envFile]);
    assert.equal(start.code, 0, start.stderr);
    ok('launch start -> 0');

    const status1 = await run('node', ['scripts/launch.mjs', 'status']);
    assert.equal(status1.code, 0);
    ok('launch status: запущен');

    const again = await run('node', ['scripts/launch.mjs', 'start', '--env', envFile]);
    assert.equal(again.code, 0);
    assert.match(again.stdout, /уже запущен/);
    ok('повторный start не плодит процессы');

    const restart = await run('node', ['scripts/launch.mjs', 'restart', '--env', envFile]);
    assert.equal(restart.code, 0, restart.stderr);
    const status2 = await run('node', ['scripts/launch.mjs', 'status']);
    assert.equal(status2.code, 0);
    ok('restart: перезапуск с новым pid');

    // stop не трогает посторонние процессы
    const stranger = spawn('node', ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
    const strangerPid = stranger.pid;
    await wait(300);
    const stop = await run('node', ['scripts/launch.mjs', 'stop']);
    assert.equal(stop.code, 0, stop.stderr);
    await wait(200);
    let strangerAlive = true;
    try {
      process.kill(strangerPid, 0);
    } catch {
      strangerAlive = false;
    }
    assert.ok(strangerAlive, 'посторонний процесс был убит!');
    ok('stop останавливает только сервер проекта');
    stranger.kill('SIGKILL');

    const status3 = await run('node', ['scripts/launch.mjs', 'status']);
    assert.equal(status3.code, 1);
    ok('после stop: status сообщает об остановке');
  } finally {
    fs.rmSync(envFile, { force: true });
    await run('node', ['scripts/launch.mjs', 'stop']);
  }

  console.log(`\ncheck-server: пройдено ${passed}, провалено ${failed}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error('check-server: аварийное завершение:', err);
  process.exit(1);
});
