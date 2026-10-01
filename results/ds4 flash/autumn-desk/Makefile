# Autumn Desk - interactive 3D autumn workspace (Three.js).
#
# Common targets:
#   make run        start the local static server (uses .env)
#   make stop       stop the server started by this project
#   make restart    stop, then start
#   make status     show whether the project server is running
#   make check      validate config, vendored library and JS syntax (no server)
#   make test       run all automated tests (server security + camera focus)
#   make clean      remove pid/log/lock artifacts

SHELL := /usr/bin/env bash
PYTHON ?= python3
NODE ?= node

PROJECT_ROOT := $(CURDIR)
MANAGE := server/manage.sh
PID_FILE := var/server.pid
LOG_FILE := var/server.log

.PHONY: help run stop restart status check check-config check-js lint test \
        test-server test-node clean

help:
	@echo "Autumn Desk targets:"
	@echo "  make run      - start the static server (HOST/PORT from .env)"
	@echo "  make stop     - stop the project server"
	@echo "  make restart  - restart the project server"
	@echo "  make status   - report server status"
	@echo "  make check    - config + library + JS syntax checks (no server)"
	@echo "  make test     - run all automated tests"
	@echo "  make clean    - remove pid/log/lock artifacts"

run:
	@bash $(MANAGE) run

stop:
	@bash $(MANAGE) stop

restart:
	@bash $(MANAGE) restart

status:
	@bash $(MANAGE) status

check: check-config check-js
	@echo "[autumn-desk] checks passed"

check-config:
	@test -f public/vendor/three/three.module.js \
		|| { echo "missing public/vendor/three/three.module.js" >&2; exit 1; }
	@$(PYTHON) server/serve.py --check-config

check-js:
	@$(NODE) tests/node/check-syntax.mjs

lint: check-js

test: check test-server test-node

test-server:
	@$(PYTHON) -m unittest discover -s tests/python -p 'test_*.py' -v

test-node:
	@$(NODE) --test tests/node/*.test.mjs

clean:
	@rm -f $(PID_FILE) $(LOG_FILE)
	@rm -rf var/.manage.lock
	@echo "[autumn-desk] cleaned"
