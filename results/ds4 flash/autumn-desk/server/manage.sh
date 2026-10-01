#!/usr/bin/env bash
# Service manager for the Autumn Desk static server.
#
# Safety rules:
#   * Only ever starts/stops the server process recorded in var/server.pid.
#   * Never uses pkill/killall/fuser and never kills by name or by port.
#   * Before killing a PID it verifies the process command line still points
#     at *our* server/serve.py, so a recycled PID can never take down an
#     unrelated process.
#   * Concurrent run/stop invocations are serialised with a lock directory.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SERVER_PY="$SCRIPT_DIR/serve.py"
# Runtime paths can be overridden (used by tests to stay isolated from any
# server the user may already have running).
PID_FILE="${AUTUMN_PID_FILE:-$PROJECT_ROOT/var/server.pid}"
LOG_FILE="${AUTUMN_LOG_FILE:-$PROJECT_ROOT/var/server.log}"
LOCK_DIR="${AUTUMN_LOCK_DIR:-$PROJECT_ROOT/var/.manage.lock}"
PYTHON="${PYTHON:-python3}"

mkdir -p "$PROJECT_ROOT/var"

die() { printf '[autumn-desk] error: %s\n' "$*" >&2; exit 1; }
info() { printf '[autumn-desk] %s\n' "$*"; }

release_lock() {
    rm -rf "$LOCK_DIR"
}

acquire_lock() {
    # Re-entrant for this shell: `restart` performs stop+run in one process.
    if [ -f "$LOCK_DIR/pid" ] && [ "$(cat "$LOCK_DIR/pid" 2>/dev/null)" = "$$" ]; then
        return 0
    fi
    local waited=0
    while ! mkdir "$LOCK_DIR" 2>/dev/null; do
        # Recover a stale lock (crashed process) after a grace period.
        if [ -f "$LOCK_DIR/pid" ]; then
            local holder
            holder="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
            if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
                rm -rf "$LOCK_DIR"
                continue
            fi
        fi
        sleep 0.2
        waited=$((waited + 1))
        [ "$waited" -gt 50 ] && die "another manage command is already running"
    done
    echo $$ > "$LOCK_DIR/pid"
    trap release_lock EXIT
}

read_pid() {
    [ -f "$PID_FILE" ] || return 1
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null | tr -d '[:space:]')"
    [ -n "$pid" ] && [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    printf '%s' "$pid"
}

is_our_process() {
    local pid="$1" cmd
    [ -d "/proc/$pid" ] || return 1
    cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
    case "$cmd" in
        *"$SERVER_PY"*) return 0 ;;
        *) return 1 ;;
    esac
}

port_free() {
    # Returns 0 when we can bind the port ourselves (i.e. it is free).
    "$PYTHON" - "$1" "$2" <<'PY' 2>/dev/null
import socket, sys
host, port = sys.argv[1], int(sys.argv[2])
family = socket.AF_INET6 if ":" in host else socket.AF_INET
s = socket.socket(family, socket.SOCK_STREAM)
try:
    s.bind((host, port))
except OSError:
    sys.exit(1)
finally:
    s.close()
sys.exit(0)
PY
}

do_run() {
    acquire_lock
    local existing
    if existing="$(read_pid)" && is_our_process "$existing"; then
        info "already running (pid $existing)"
        return 0
    fi
    [ -n "${existing:-}" ] && rm -f "$PID_FILE"

    # Validate configuration before spawning anything.
    local check
    if ! check="$("$PYTHON" "$SERVER_PY" --check-config 2>&1)"; then
        die "configuration is invalid:\n$check"
    fi

    local host port
    host="$(sed -n 's/^OK host=\([^ ]*\) port=.*/\1/p' <<<"$check")"
    port="$(sed -n 's/^OK host=[^ ]* port=\([^ ]*\) public_dir=.*/\1/p' <<<"$check")"
    [ -n "$host" ] && [ -n "$port" ] || die "could not parse validated config"
    # A wildcard bind address cannot be probed directly; test the loopback.
    local probe_host="$host"
    case "$host" in "0.0.0.0") probe_host="127.0.0.1" ;; "::") probe_host="::1" ;; esac

    if ! port_free "$probe_host" "$port"; then
        die "port $port on $host is already in use by another process; refusing to interfere"
    fi

    : > "$LOG_FILE"
    nohup "$PYTHON" "$SERVER_PY" >>"$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"

    # Confirm the process stayed up.
    sleep 1
    if ! is_our_process "$pid"; then
        rm -f "$PID_FILE"
        die "server failed to start; see $LOG_FILE"
    fi
    info "started (pid $pid) on http://$host:$port/  log: $LOG_FILE"
}

do_stop() {
    acquire_lock
    local pid
    if ! pid="$(read_pid)"; then
        info "not running (no pid file)"
        return 0
    fi
    if ! is_our_process "$pid"; then
        info "pid $pid is not our server (stale pid file); removing it"
        rm -f "$PID_FILE"
        return 0
    fi
    kill -TERM "$pid" 2>/dev/null || true
    local waited=0
    while kill -0 "$pid" 2>/dev/null; do
        sleep 0.2
        waited=$((waited + 1))
        if [ "$waited" -gt 25 ]; then
            # Final escalation is still scoped to the verified PID only.
            kill -KILL "$pid" 2>/dev/null || true
            break
        fi
    done
    rm -f "$PID_FILE"
    info "stopped (pid $pid)"
}

do_status() {
    local pid
    if pid="$(read_pid)" && is_our_process "$pid"; then
        info "running (pid $pid)"
        return 0
    fi
    info "not running"
    return 1
}

case "${1:-}" in
    run)     do_run ;;
    stop)    do_stop ;;
    restart) do_stop; do_run ;;
    status)  do_status ;;
    *) die "usage: $0 {run|stop|restart|status}" ;;
esac
