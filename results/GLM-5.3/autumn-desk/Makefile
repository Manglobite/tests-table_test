# Осенний рабочий стол — локальный запуск и проверки.
# Все цели безопасны: stop убивает только процесс, запущенный этим проектом.

.PHONY: help run stop restart status check check-static check-server check-interactions

help:
	@echo "Цели:"
	@echo "  make run       — запустить сервер (HOST/PORT из .env, см. .env.example)"
	@echo "  make stop      — остановить сервер этого проекта"
	@echo "  make restart   — перезапустить сервер"
	@echo "  make status    — проверить, запущен ли сервер"
	@echo "  make check     — все автоматические проверки (статика, сервер, интеракции)"

run:
	@node scripts/launch.mjs start

stop:
	@node scripts/launch.mjs stop

restart:
	@node scripts/launch.mjs restart

status:
	@node scripts/launch.mjs status

check-static:
	@node scripts/check-static.mjs

check-server:
	@node scripts/check-server.mjs

check-interactions:
	@node scripts/check-interactions.mjs

check: check-static check-server check-interactions
	@echo "Все проверки пройдены."
