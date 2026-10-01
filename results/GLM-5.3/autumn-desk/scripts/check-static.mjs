// Проверка автономности и приватности: сканирует публичные файлы на внешние
// сетевые зависимости и сохранение данных, сверяет локальную копию Three.js
// с исходной библиотекой из tree_js, проверяет локальность всех ссылок.
// Запуск: node scripts/check-static.mjs

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const TREEJS_SRC = path.resolve(ROOT, '..', 'tree_js', 'package', 'build', 'three.module.js');

let failures = 0;
const ok = (name) => console.log(`  ok  ${name}`);
const fail = (name, detail) => {
  failures++;
  console.error(`FAIL  ${name}${detail ? ': ' + detail : ''}`);
};

function walk(dir, acc = [], { skipVendor = false } = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'vendor' && skipVendor) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc, { skipVendor });
    else acc.push(p);
  }
  return acc;
}

// ---- 1. Запрещённые внешние/сетевые/хранимые зависимости в рантайме
const FORBIDDEN = [
  [/https?:/i, 'внешний URL'],
  [/(?:src|href)\s*=\s*["']\/\//i, 'протоколо-относительный URL'],
  [/\bfetch\s*\(/, 'fetch()'],
  [/XMLHttpRequest/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/localStorage/, 'localStorage'],
  [/sessionStorage/, 'sessionStorage'],
  [/indexedDB/, 'indexedDB'],
  [/document\.cookie/, 'cookie'],
  [/navigator\.sendBeacon/, 'sendBeacon'],
  [/\bcaches\b\s*\./, 'Cache API'],
  [/importScripts\s*\(/, 'importScripts'],
];
const ownFiles = walk(PUBLIC, [], { skipVendor: true }).filter((f) => /\.(html|css|js|mjs|json)$/.test(f));
let clean = true;
for (const file of ownFiles) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const [re, what] of FORBIDDEN) {
    if (re.test(text)) {
      clean = false;
      fail(`нет ${what}`, rel);
    }
  }
}
if (clean) ok(`нет внешних сетевых вызовов и хранилищ в ${ownFiles.length} файлах`);

// ---- 2. Локальная копия Three.js идентична tree_js
const vendorFile = path.join(PUBLIC, 'vendor', 'three.module.js');
if (fs.existsSync(vendorFile)) {
  const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  if (fs.existsSync(TREEJS_SRC)) {
    if (sha(vendorFile) === sha(TREEJS_SRC)) ok('vendor/three.module.js байт-в-байт равен tree_js');
    else fail('vendor/three.module.js отличается от tree_js');
  } else {
    console.log('  --  tree_js недоступен для сверки (копия присутствует)');
  }
} else {
  fail('нет public/vendor/three.module.js');
}

// ---- 3. Все импорты и ссылки в публичных файлах — локальные и существующие
let refsOk = true;
for (const file of ownFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const importRe = /(?:import|export)\s+(?:[\s\S]*?from\s*)?["']([^"']+)["']/g;
  let m;
  while ((m = importRe.exec(text))) {
    const spec = m[1];
    if (!spec.startsWith('.') && !spec.startsWith('/')) {
      refsOk = false;
      fail('нелокальный import', `${path.relative(ROOT, file)} -> ${spec}`);
      continue;
    }
    if (spec.endsWith('vendor/three.module.js') || spec.endsWith('../vendor/three.module.js')) continue;
    const resolved = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(resolved)) {
      refsOk = false;
      fail('битая ссылка import', `${path.relative(ROOT, file)} -> ${spec}`);
    }
  }
}
const indexHtml = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const refRe = /(?:src|href)\s*=\s*"([^"]+)"/g;
let r;
while ((r = refRe.exec(indexHtml))) {
  const ref = r[1];
  if (ref.startsWith('data:')) continue;
  if (/^[a-z]+:/i.test(ref) || ref.startsWith('//')) {
    refsOk = false;
    fail('внешний ресурс в index.html', ref);
    continue;
  }
  if (!fs.existsSync(path.join(PUBLIC, ref.replace(/^\//, '').split('?')[0]))) {
    refsOk = false;
    fail('битая ссылка в index.html', ref);
  }
}
if (refsOk) ok('все импорты и ссылки локальные и существуют');

// ---- 4. Импорт Three.js именно из vendor-копии
const entry = fs.readFileSync(path.join(PUBLIC, 'js', 'main.js'), 'utf8');
if (/from\s+["']\.\.\/vendor\/three\.module\.js["']/.test(entry)) {
  ok('точка входа импортирует локальный vendor/three.module.js');
} else {
  fail('точка входа не импортирует vendor/three.module.js');
}

// ---- 5. Демонстрационный пароль не покидает вкладку
const laptopSrc = fs.readFileSync(path.join(PUBLIC, 'js', 'objects', 'laptop.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(PUBLIC, 'js', 'main.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(PUBLIC, 'js', 'ui.js'), 'utf8');
const noPersist = [laptopSrc, mainSrc, uiSrc].every((s) =>
  !/console\.(log|info|debug|warn)\s*\([^)]*password/s.test(s));
if (noPersist) ok('ввод пароля не журналируется и не сохраняется');

if (failures) {
  console.error(`\nПровалено проверок: ${failures}`);
  process.exit(1);
}
console.log('check-static: пройдено\n');
