// Static "make check" helper.
//
// 1. Parses every first-party ES module for syntax errors (via `node --check`
//    on a temporary .mjs copy, so ESM is parsed as ESM).
// 2. Enforces the offline/privacy contract by scanning first-party sources
//    for external URLs and browser storage / network APIs.
//
// Vendor code (public/vendor/three) is parsed but exempt from the URL scan.

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const PUBLIC = join(ROOT, "public");
const TMP = join(ROOT, "var", ".syntax");

const JS_EXT = new Set([".js", ".mjs"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function collectSources() {
  const files = walk(PUBLIC);
  const firstParty = [];
  const vendor = [];
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (!JS_EXT.has(ext)) continue;
    if (f.includes(`${join("public", "vendor")}`)) vendor.push(f);
    else firstParty.push(f);
  }
  return { firstParty, vendor };
}

function parseFile(file) {
  const rel = relative(ROOT, file);
  const target = join(TMP, `${rel.replace(/[\\/]/g, "__")}.mjs`);
  writeFileSync(target, readFileSync(file));
  const res = spawnSync(process.execPath, ["--check", target], {
    encoding: "utf8",
  });
  if (res.status !== 0) {
    return `${rel}:\n${res.stderr.trim()}`;
  }
  return null;
}

const FORBIDDEN_PATTERNS = [
  { re: /https?:\/\//i, msg: "external URL" },
  { re: /\/\/[a-z0-9.-]+\.(com|net|org|io|dev|ru)/i, msg: "protocol-relative URL" },
  { re: /\bfetch\s*\(/, msg: "fetch()" },
  { re: /XMLHttpRequest/, msg: "XMLHttpRequest" },
  { re: /new\s+WebSocket/, msg: "WebSocket" },
  { re: /navigator\.sendBeacon/, msg: "sendBeacon" },
  { re: /localStorage/, msg: "localStorage" },
  { re: /sessionStorage/, msg: "sessionStorage" },
  { re: /document\.cookie/, msg: "document.cookie" },
  { re: /indexedDB/, msg: "indexedDB" },
  { re: /\bimport\s*\(/, msg: "dynamic import()" },
];

function scanFirstParty(files) {
  const problems = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    const src = readFileSync(file, "utf8");
    for (const { re, msg } of FORBIDDEN_PATTERNS) {
      const m = src.match(re);
      if (m) {
        const line = src.slice(0, m.index).split("\n").length;
        problems.push(`${rel}:${line}: forbidden ${msg} (${m[0].trim()})`);
      }
    }
  }
  return problems;
}

function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });

  const { firstParty, vendor } = collectSources();
  const errors = [];

  for (const file of [...firstParty, ...vendor]) {
    const err = parseFile(file);
    if (err) errors.push(err);
  }
  errors.push(...scanFirstParty(firstParty));

  rmSync(TMP, { recursive: true, force: true });

  if (errors.length) {
    console.error("check-syntax: FAILED");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log(
    `check-syntax: OK (${firstParty.length} first-party, ${vendor.length} vendor modules)`,
  );
}

main();
