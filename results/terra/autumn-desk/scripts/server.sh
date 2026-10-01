#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.server.pid"
LOG_FILE="$ROOT/.server.log"

running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid command cwd
  pid="$(<"$PID_FILE")"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  command="$(readlink -f "/proc/$pid/exe" 2>/dev/null || true) $(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  [[ "$cwd" == "$ROOT" && "$command" == *"python3"* && "$command" == *"scripts/server.py"* ]]
}
stop() {
  if running; then
    kill "$(<"$PID_FILE")"
    for _ in {1..20}; do kill -0 "$(<"$PID_FILE")" 2>/dev/null || break; sleep 0.1; done
    rm -f "$PID_FILE"
    printf 'Server stopped.\n'
  else
    rm -f "$PID_FILE"
    printf 'Server is not running.\n'
  fi
}
case "${1:-}" in
  run)
    if running; then printf 'Server is already running (PID %s).\n' "$(<"$PID_FILE")"; exit 0; fi
    rm -f "$PID_FILE"
    (cd "$ROOT"; nohup python3 scripts/server.py >>"$LOG_FILE" 2>&1 & printf '%s' "$!" >"$PID_FILE")
    sleep 0.15
    if running; then
      source "$ROOT/.env" 2>/dev/null || { HOST=0.0.0.0; PORT=4173; }
      printf 'Server started (PID %s): http://%s:%s/\n' "$(<"$PID_FILE")" "${HOST:-0.0.0.0}" "${PORT:-4173}"
    else
      printf 'Server failed to start; see .server.log\n' >&2; rm -f "$PID_FILE"; exit 1
    fi
    ;;
  stop) stop ;;
  restart) stop; "$0" run ;;
  *) printf 'Usage: %s {run|stop|restart}\n' "$0" >&2; exit 2 ;;
esac
