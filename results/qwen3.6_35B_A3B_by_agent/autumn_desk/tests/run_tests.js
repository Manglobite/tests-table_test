/**
 * Autumn Desk — Automated Tests
 * Tests server behavior, security, file serving, and scene structure.
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_DIR = resolve(join(__dirname, '..'));
const TEST_PORT = 18765;
const TEST_HOST = '127.0.0.1';

let passed = 0;
let failed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      await result;
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ─── Entry Point ────────────────────────────────────────────────────────────────

(async () => {
  // ─── Test Suite 1: Project Structure ──────────────────────────────────────────

  console.log('\n=== Проверка структуры проекта ===');

  test('Файл .env существует', () => {
    assert(existsSync(join(PROJECT_DIR, '.env')), '.env не найден');
  });

  test('Файл .env.example существует', () => {
    assert(existsSync(join(PROJECT_DIR, '.env.example')), '.env.example не найден');
  });

  test('Файл Makefile существует', () => {
    assert(existsSync(join(PROJECT_DIR, 'Makefile')), 'Makefile не найден');
  });

  test('Файл server.js существует', () => {
    assert(existsSync(join(PROJECT_DIR, 'server.js')), 'server.js не найден');
  });

  test('Публичная директория public существует', () => {
    assert(existsSync(join(PROJECT_DIR, 'public')), 'public не найден');
  });

  test('index.html существует', () => {
    assert(existsSync(join(PROJECT_DIR, 'public', 'index.html')), 'index.html не найден');
  });

  test('app.js существует', () => {
    assert(existsSync(join(PROJECT_DIR, 'public', 'app.js')), 'app.js не найден');
  });

  test('Three.js локальная библиотека существует', () => {
    assert(existsSync(join(PROJECT_DIR, 'public', 'package', 'build', 'three.module.js')),
      'three.module.js не найден в public');
  });

  // ─── Test Suite 2: Configuration ──────────────────────────────────────────────

  console.log('\n=== Проверка конфигурации ===');

  test('HOST в .env равен 0.0.0.0', () => {
    const env = readFileSync(join(PROJECT_DIR, '.env'), 'utf-8');
    assert(env.includes('HOST=0.0.0.0'), 'HOST должен быть 0.0.0.0');
  });

  test('PORT в .env равен 8765', () => {
    const env = readFileSync(join(PROJECT_DIR, '.env'), 'utf-8');
    assert(env.includes('PORT=8765'), 'PORT должен быть 8765');
  });

  // ─── Test Suite 3: Server Start/Stop ─────────────────────────────────────────

  console.log('\n=== Проверка сервера (старт/стоп) ===');

  test('Сервер запускается', async () => {
    // Kill any existing process on test port
    try {
      execSync(`lsof -ti:${TEST_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'pipe' });
    } catch {}

    // Start server using spawn to keep it alive
    const serverProcess = spawn('node', [join(PROJECT_DIR, 'server.js')], {
      env: { ...process.env, PORT: TEST_PORT.toString(), NODE_ENV: 'test' },
      stdio: 'ignore',
      detached: true,
    });

    testPid = serverProcess.pid;

    // Wait for server to start
    let connected = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (await checkPortOpen(TEST_HOST, TEST_PORT)) {
        connected = true;
        break;
      }
    }
    assert(connected, `Сервер не запустился на ${TEST_HOST}:${TEST_PORT}`);
    // Give server a moment to fully initialize
    await new Promise((r) => setTimeout(r, 500));
  });

  test('Сервер отдаёт index.html', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/index.html');
    assert(resp && resp.status === 200, `Статус ${resp?.status}, ожидался 200`);
    assert(resp && resp.headers.get('content-type')?.includes('text/html'), 'Неверный MIME-тип');
    assert(resp && resp.body.length > 100, 'index.html слишком маленький');
  });

  test('Сервер отдаёт app.js', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/app.js');
    assert(resp && resp.status === 200, `Статус ${resp?.status}, ожидался 200`);
    assert(resp && resp.headers.get('content-type')?.includes('javascript'), 'Неверный MIME-тип');
  });

  test('Сервер отдаёт three.module.js', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/package/build/three.module.js');
    assert(resp && resp.status === 200, `Статус ${resp?.status}, ожидался 200`);
    assert(resp && resp.body.length > 100000, 'three.module.js слишком маленький');
  });

  test('404 для несуществующего файла', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/nonexistent.html');
    assert(resp && resp.status === 404, `Статус ${resp?.status}, ожидался 404`);
  });

  test('Traversal путь ../reject', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/../server.js');
    assert(resp && (resp.status === 403 || resp.status === 404),
      `Traversal не заблокирован: статус ${resp?.status}`);
  });

  test('Закодированный traversal ../reject', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/..%2F..%2Fserver.js');
    assert(resp && (resp.status === 403 || resp.status === 404),
      `Закодированный traversal не заблокирован: статус ${resp?.status}`);
  });

  test('Скрытый файл .env reject', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/.env');
    assert(resp && (resp.status === 403 || resp.status === 404),
      `Скрытый файл .env не заблокирован: статус ${resp?.status}`);
  });

  test('Скрытый файл .gitignore reject', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/.gitignore');
    assert(resp && (resp.status === 403 || resp.status === 404),
      `Скрытый файл .gitignore не заблокирован: статус ${resp?.status}`);
  });

  test('HEAD запрос', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/index.html', 'HEAD');
    assert(resp && resp.status === 200, `HEAD статус ${resp?.status}, ожидался 200`);
  });

  test('POST запрос -> 405', async () => {
    const resp = await fetchResource(TEST_HOST, TEST_PORT, '/index.html', 'POST');
    assert(resp && resp.status === 405, `POST статус ${resp?.status}, ожидался 405`);
  });

  test('Сервер останавливается', async () => {
    if (testPid) {
      try {
        execSync(`kill ${testPid} 2>/dev/null || true`, { stdio: 'pipe' });
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    assert(!(await checkPortOpen(TEST_HOST, TEST_PORT)), 'Порт всё ещё открыт после остановки');
  });

  // ─── Test Suite 4: Scene Structure ────────────────────────────────────────────

  console.log('\n=== Проверка структуры сцены (app.js) ===');

  test('app.js импортирует Three.js локально', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes("from './package/build/three.module.js'"),
      'Three.js импортируется не локально');
    assert(!app.includes('cdn.jsdelivr.net'), 'Есть ссылка на CDN');
    assert(!app.includes('unpkg.com'), 'Есть ссылка на unpkg');
  });

  test('Сцена содержит desk', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('createDesk') || app.includes('desk'), 'Функция createDesk не найдена');
  });

  test('Сцена содержит window', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('createWindow') || app.includes('window'), 'Функция createWindow не найдена');
  });

  test('Сцена содержит curtains', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('createCurtains') || app.includes('curtain'), 'Функция createCurtains не найдена');
  });

  test('Сцена содержит laptop', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('createLaptop') || app.includes('laptop'), 'Функция createLaptop не найдена');
  });

  test('Сцена содержит notebook', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('createNotebook') || app.includes('notebook'), 'Функция createNotebook не найдена');
  });

  test('Сцена содержит calendar', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('createCalendar') || app.includes('calendar'), 'Функция createCalendar не найдена');
  });

  test('Сцена содержит leaves', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('createLeaves') || app.includes('leaves'), 'Функция createLeaves не найдена');
  });

  test('Есть интерактивные объекты (4 шт)', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    const names = ['window', 'laptop', 'notebook', 'calendar'];
    names.forEach((name) => {
      assert(app.includes(`'${name}'`) || app.includes(`"${name}"`),
        `Интерактивный объект '${name}' не найден`);
    });
  });

  test('Есть camera focus логика', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('focusOnObject') || app.includes('focus'), 'Логика фокуса не найдена');
    assert(app.includes('returnToHome') || app.includes('home'), 'Логика возврата home не найдена');
  });

  test('Есть raycaster/picking', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('Raycaster') || app.includes('raycaster'), 'Raycaster не найден');
    assert(app.includes('intersectObjects') || app.includes('intersect'), 'Picking не найден');
  });

  test('Есть анимация листьев', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('updateLeaves') || app.includes('leaf'), 'Анимация листьев не найдена');
  });

  test('Есть анимация штор', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('updateCurtains') || app.includes('curtain'), 'Анимация штор не найдена');
  });

  test('Есть анимация птиц', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('updateBirds') || app.includes('bird'), 'Анимация птиц не найдена');
  });

  test('Есть обработчик Resize', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('resize') || app.includes('Resize'), 'Обработчик resize не найден');
  });

  test('Есть обработка клавиши Escape', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(app.includes('Escape') || app.includes('KeyE'), 'Обработчик Escape не найден');
  });

  // ─── Test Suite 5: No External Dependencies ───────────────────────────────────

  console.log('\n=== Проверка автономности ===');

  test('Нет внешних CDN в HTML', () => {
    const html = readFileSync(join(PROJECT_DIR, 'public', 'index.html'), 'utf-8');
    assert(!html.includes('cdn.'), 'Есть ссылка на CDN в HTML');
    assert(!html.includes('unpkg.com'), 'Есть ссылка на unpkg в HTML');
    assert(!html.includes('fonts.googleapis.com'), 'Есть ссылка на Google Fonts в HTML');
  });

  test('Нет внешних URL в app.js', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(!app.includes('fetch('), 'Есть вызов fetch в app.js');
    assert(!app.includes('XMLHttpRequest'), 'Есть XMLHttpRequest в app.js');
    assert(!app.includes('http://') || app.includes('http://localhost'), 'Есть внешний URL');
    assert(!app.includes('https://'), 'Есть https URL');
  });

  test('Нет localStorage в app.js', () => {
    const app = readFileSync(join(PROJECT_DIR, 'public', 'app.js'), 'utf-8');
    assert(!app.includes('localStorage'), 'Есть localStorage');
    assert(!app.includes('sessionStorage'), 'Есть sessionStorage');
    assert(!app.includes('IndexedDB'), 'Есть IndexedDB');
    assert(!app.includes('cookie'), 'Есть cookie');
  });

  // ─── Test Suite 6: Makefile ──────────────────────────────────────────────────

  console.log('\n=== Проверка Makefile ===');

  test('Makefile содержит target run', () => {
    const mk = readFileSync(join(PROJECT_DIR, 'Makefile'), 'utf-8');
    assert(mk.includes('run:'), 'Target run не найден');
  });

  test('Makefile содержит target stop', () => {
    const mk = readFileSync(join(PROJECT_DIR, 'Makefile'), 'utf-8');
    assert(mk.includes('stop:'), 'Target stop не найден');
  });

  test('Makefile содержит target restart', () => {
    const mk = readFileSync(join(PROJECT_DIR, 'Makefile'), 'utf-8');
    assert(mk.includes('restart:'), 'Target restart не найден');
  });

  test('Makefile использует PID-файл', () => {
    const mk = readFileSync(join(PROJECT_DIR, 'Makefile'), 'utf-8');
    assert(mk.includes('PID_FILE') || mk.includes('pid'), 'PID-файл не используется');
  });

  // ─── Summary ──────────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(50));
  console.log(`Результаты: ${passed}/${total} пройдено, ${failed} провалено`);
  if (failed === 0) {
    console.log('Все проверки пройдены!');
  } else {
    console.log(`Провалено ${failed} проверок.`);
  }
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
})();


import { createConnection } from 'node:net';
import { request } from 'node:http';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let testPid = null;

function checkPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection(port, host, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(500);
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}

function fetchResource(host, port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const data = [];
    const req = request({
      hostname: host,
      port,
      path,
      method,
      timeout: 3000,
    }, (res) => {
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(data),
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}
