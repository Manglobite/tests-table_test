// Управление жизненным циклом сервера проекта: start | stop | restart | status.
// PID-файл и журнал лежат в run/. Останавливается только процесс, запущенный
// этим скриптом (проверка pid + командной строки), посторонние процессы не затрагиваются.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from '../server.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_DIR = path.join(PROJECT_ROOT, 'run');
const PID_FILE = path.join(RUN_DIR, 'server.pid');
const LOG_FILE = path.join(RUN_DIR, 'server.log');
const SERVER_ENTRY = path.join(PROJECT_ROOT, 'server.mjs');

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const passthrough = args.slice(1);

function ensureRunDir() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
}

function readPid() {
  try {
    const t = fs.readFileSync(PID_FILE, 'utf8').trim();
    return /^\d+$/.test(t) ? Number(t) : null;
  } catch {
    return null;
  }
}

function procAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // жив, но не наш
  }
}

// Только наш сервер: pid существует и cmdline ссылается на server.mjs этого проекта.
function isOurServer(pid) {
  if (!procAlive(pid)) return false;
  try {
    let cmdline = '';
    if (process.platform === 'linux') {
      cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    } else {
      cmdline = execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
    }
    return cmdline.includes(SERVER_ENTRY) || cmdline.includes('server.mjs');
  } catch {
    return false;
  }
}

function removePidFile() {
  try {
    fs.unlinkSync(PID_FILE);
  } catch { /* уже нет */ }
}

function stopServer({ quiet = false } = {}) {
  const pid = readPid();
  if (!pid) {
    if (!quiet) console.log('Сервер не запущен (pid-файл отсутствует).');
    return false;
  }
  if (!isOurServer(pid)) {
    // Процесс умер или pid перехвачен чужим процессом — не трогаем его.
    if (!procAlive(pid)) console.log('Сервер уже остановлен (процесс отсутствует).');
    else console.log(`PID ${pid} не принадлежит нашему серверу — не трогаем, pid-файл убран.`);
    removePidFile();
    return false;
  }
  process.kill(pid, 'SIGTERM');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && procAlive(pid)) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  if (procAlive(pid)) {
    console.log(`Процесс ${pid} не завершился, отправляю SIGKILL.`);
    try {
      process.kill(pid, 'SIGKILL');
    } catch { /* уже ушёл */ }
  }
  removePidFile();
  console.log(`Сервер остановлен (pid ${pid}).`);
  return true;
}

function portBusy(host, port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(true));
    probe.listen(port, host === 'localhost' ? '127.0.0.1' : host, () => {
      probe.close(() => resolve(false));
    });
  });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (res.ok) return true;
    } catch { /* ещё не готов */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function startServer() {
  ensureRunDir();
  const oldPid = readPid();
  if (oldPid && isOurServer(oldPid)) {
    console.log(`Сервер уже запущен (pid ${oldPid}).`);
    return 0;
  }
  if (oldPid) removePidFile();

  let cfg;
  try {
    cfg = resolveConfig(parseEnvArgs(passthrough));
  } catch (err) {
    console.error(`Ошибка конфигурации: ${err.message}`);
    console.error(`Проверьте .env (HOST=0.0.0.0 PORT=8137) или --host/--port.`);
    return 2;
  }
  if (await portBusy(cfg.host, cfg.port)) {
    console.error(`Ошибка: порт ${cfg.port} уже занят. Выберите свободный PORT в .env.`);
    return 3;
  }

  const logFd = fs.openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [SERVER_ENTRY, ...configFlags(cfg)], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', logFd, logFd],
    detached: true,
  });
  fs.writeFileSync(PID_FILE, String(child.pid));
  child.unref();
  fs.closeSync(logFd);

  const shown = cfg.host.includes(':') ? `[${cfg.host}]` : cfg.host;
  const probeHost = (cfg.host === '0.0.0.0' || cfg.host === 'localhost') ? '127.0.0.1' : cfg.host;
  const ok = await waitForHttp(`http://${probeHost.includes(':') ? `[${probeHost}]` : probeHost}:${cfg.port}/`, 8000);
  if (!ok) {
    if (procAlive(child.pid)) {
      // сервер жив, но по HTTP не отвечает (напр., привязан к внешнему адресу)
      console.log(`Сервер запущен (pid ${child.pid}): http://${shown}:${cfg.port}/  (журнал: run/server.log)`);
      return 0;
    }
    console.error('Не удалось запустить сервер. Последние строки журнала (run/server.log):');
    try {
      const tail = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-6).join('\n');
      console.error(tail || '(журнал пуст)');
    } catch { /* пусто */ }
    try {
      if (procAlive(child.pid)) process.kill(child.pid, 'SIGTERM');
    } catch { /* уже ушёл */ }
    removePidFile();
    return 1;
  }
  console.log(`Сервер запущен (pid ${child.pid}): http://${shown}:${cfg.port}/  (журнал: run/server.log)`);
  return 0;
}

function parseEnvArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '--env') out.envFile = list[++i];
    else if (list[i] === '--host') out.host = list[++i];
    else if (list[i] === '--port') out.port = list[++i];
    else {
      console.error(`Неизвестный аргумент: ${list[i]}`);
      process.exit(2);
    }
  }
  return out;
}

function configFlags(cfg) {
  const flags = ['--host', String(cfg.host), '--port', String(cfg.port)];
  return flags;
}

async function status() {
  const pid = readPid();
  if (pid && isOurServer(pid)) {
    console.log(`Сервер запущен (pid ${pid}).`);
    return 0;
  }
  console.log('Сервер не запущен.');
  return 1;
}

async function main() {
  switch (command) {
    case 'start':
      process.exit(await startServer());
    case 'stop':
      stopServer();
      process.exit(0);
    case 'restart':
      stopServer({ quiet: true });
      process.exit(await startServer());
    case 'status':
      process.exit(await status());
    default:
      console.log('Использование: node scripts/launch.mjs start|stop|restart|status [--env <файл>] [--host <h>] [--port <p>]');
      process.exit(command === 'help' ? 0 : 2);
  }
}

main().catch((err) => {
  console.error(`Сбой управления сервером: ${err.message}`);
  process.exit(1);
});
