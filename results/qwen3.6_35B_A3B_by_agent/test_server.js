#!/usr/bin/env node
import { execSync } from 'child_process';
import { join, resolve } from 'path';
import { createConnection } from 'net';

const PROJECT_DIR = resolve(join('.', 'autumn_desk'));
const TEST_PORT = 18765;
const TEST_HOST = '127.0.0.1';

console.log('Killing existing...');
try { execSync(`lsof -ti:${TEST_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'pipe' }); } catch {}

console.log('Starting server...');
const child = execSync(`NODE_ENV=test HOST=${TEST_HOST} PORT=${TEST_PORT} nohup node ${join(PROJECT_DIR, 'server.js')} > /dev/null 2>&1 & echo $!`, { stdio: 'pipe', encoding: 'utf-8' }).trim();
console.log('PID:', child);

for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 200));
  const open = await new Promise(res => {
    const s = createConnection(TEST_PORT, TEST_HOST, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.setTimeout(300);
    s.on('timeout', () => { s.destroy(); res(false); });
  });
  if (open) { console.log('Server is open!'); break; }
  console.log('Waiting...', i);
}
console.log('Done');
