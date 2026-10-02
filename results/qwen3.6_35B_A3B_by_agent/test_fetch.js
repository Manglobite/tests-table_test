#!/usr/bin/env node
import { execSync } from 'child_process';
import { join, resolve } from 'path';
import { createConnection } from 'net';
import { request } from 'node:http';

const PROJECT_DIR = resolve(join('.', 'autumn_desk'));
const TEST_PORT = 18765;
const TEST_HOST = '127.0.0.1';

// Kill existing
try { execSync(`lsof -ti:${TEST_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'pipe' }); } catch {}

// Start server in background
const pidFile = join(PROJECT_DIR, '.test.pid');
execSync(`PORT=${TEST_PORT} nohup node ${join(PROJECT_DIR, 'server.js')} > /dev/null 2>&1 & echo $! > ${pidFile}`);
const pid = execSync(`cat ${pidFile}`, { encoding: 'utf-8' }).trim();
console.log('Started server with PID:', pid);

// Wait for server
let connected = false;
for (let i = 0; i < 50; i++) {
  await new Promise(r => setTimeout(r, 100));
  const open = await new Promise(res => {
    const s = createConnection(TEST_PORT, TEST_HOST, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.setTimeout(300);
    s.on('timeout', () => { s.destroy(); res(false); });
  });
  if (open) { connected = true; console.log('Server open at iteration', i); break; }
}

if (!connected) {
  console.log('Server did not start');
  process.exit(1);
}

// Test fetch
const data = [];
const req = request({
  hostname: TEST_HOST,
  port: TEST_PORT,
  path: '/index.html',
  timeout: 3000,
}, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => {
    console.log('Body length:', Buffer.concat(data).length);
  });
});
req.on('error', e => console.log('Error:', e.message));
req.on('timeout', () => { console.log('Timeout'); req.destroy(); });
req.end();

// Wait for response
await new Promise(r => setTimeout(r, 2000));

// Cleanup
try { execSync(`kill ${pid} 2>/dev/null || true`); } catch {}
console.log('Done');
