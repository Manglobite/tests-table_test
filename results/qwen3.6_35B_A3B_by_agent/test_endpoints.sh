#!/usr/bin/env bash
set -e

echo "=== Testing endpoints ==="
echo -n "index.html: "
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18765/index.html
echo ""

echo -n "app.js: "
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18765/app.js
echo ""

echo -n "three.module.js: "
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18765/package/build/three.module.js
echo ""

echo -n "nonexistent: "
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18765/nonexistent.html
echo ""

echo -n "traversal: "
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18765/../server.js
echo ""

echo -n "hidden .env: "
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18765/.env
echo ""

echo -n "HEAD: "
curl -s -o /dev/null -w "%{http_code}" -X HEAD http://127.0.0.1:18765/index.html
echo ""

echo -n "POST: "
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:18765/index.html
echo ""

echo "=== All tests done ==="
