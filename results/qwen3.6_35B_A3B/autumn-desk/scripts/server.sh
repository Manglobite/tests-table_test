#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/server.py"

usage() {
    echo "Usage: $0 {run|stop|restart}"
    exit 1
}

case "${1:-}" in
    run)
        echo "Starting Autumn Desk server..."
        exec python3 "$SERVER_SCRIPT"
        ;;
    stop)
        python3 "$SERVER_SCRIPT" stop
        ;;
    restart)
        python3 "$SERVER_SCRIPT" stop
        python3 "$SERVER_SCRIPT"
        ;;
    *)
        usage
        ;;
esac
