# Autumn Desk — Makefile
# Targets: run, stop, restart, test

PROJECT_DIR := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
PID_FILE := $(PROJECT_DIR)/.server.pid
HOST ?= 0.0.0.0
PORT ?= 8765

.PHONY: run stop restart test clean

# ─── Run ───────────────────────────────────────────────────────────────────────

run: .env
	@echo "Запуск сервера на $(HOST):$(PORT)..."
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Сервер уже запущен (PID $$(cat $(PID_FILE))). Используйте 'make restart'."; \
		exit 1; \
	fi
	@NODE_ENV=production HOST=$(HOST) PORT=$(PORT) node $(PROJECT_DIR)/server.js &
	@echo $$! > $(PID_FILE)
	@echo "Сервер запущен (PID $$(cat $(PID_FILE)))."

# ─── Stop ──────────────────────────────────────────────────────────────────────

stop:
	@if [ ! -f $(PID_FILE) ]; then \
		echo "Файл PID не найден. Сервер, возможно, не запущен."; \
		exit 0; \
	fi
	@PID=$$(cat $(PID_FILE)); \
	if kill -0 $$PID 2>/dev/null; then \
		echo "Остановка сервера (PID $$PID)..."; \
		kill $$PID; \
		rm -f $(PID_FILE); \
		echo "Сервер остановлен."; \
	else \
		echo "Процесс $$PID не найден. Файл PID очищен."; \
		rm -f $(PID_FILE); \
	fi

# ─── Restart ───────────────────────────────────────────────────────────────────

restart: stop run

# ─── Test ──────────────────────────────────────────────────────────────────────

test:
	@echo "Запуск проверок..."
	@node $(PROJECT_DIR)/tests/run_tests.js

# ─── Clean ─────────────────────────────────────────────────────────────────────

clean: stop
	@rm -f $(PID_FILE)
	@echo "Очистка завершена."
