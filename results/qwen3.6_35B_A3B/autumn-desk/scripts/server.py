#!/usr/bin/env python3
"""Static file server for Autumn Desk project."""

import http.server
import json
import mimetypes
import os
import re
import signal
import socketserver
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
PID_FILE = PROJECT_ROOT / ".server.pid"
ENV_FILE = PROJECT_ROOT / ".env"


def load_env():
    """Load HOST and PORT from .env file."""
    host, port = "0.0.0.0", "4173"
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key == "HOST":
                host = value
            elif key == "PORT":
                port = value
    return host, port


def validate_config(host, port):
    """Validate HOST and PORT values."""
    if not re.fullmatch(
        r"(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+|\[.*\])",
        host,
    ):
        raise ValueError(f"Invalid HOST value: {host!r}")
    try:
        port_int = int(port)
    except (ValueError, TypeError):
        raise ValueError(f"PORT must be an integer, got: {port!r}")
    if not 1 <= port_int <= 65535:
        raise ValueError(f"PORT must be between 1 and 65535, got: {port_int}")
    return port_int


def write_pid():
    """Write current process PID to file."""
    PID_FILE.write_text(str(os.getpid()), encoding="utf-8")


def read_pid():
    """Read PID from file."""
    if not PID_FILE.exists():
        return None
    try:
        return int(PID_FILE.read_text(encoding="utf-8").strip())
    except (ValueError, OSError):
        return None


def remove_pid():
    """Remove PID file."""
    try:
        PID_FILE.unlink()
    except OSError:
        pass


def stop_server():
    """Stop the server process if running."""
    pid = read_pid()
    if pid is None:
        print("No PID file found. Server is not running.")
        return False
    try:
        os.kill(pid, signal.SIGTERM)
        import time
        for _ in range(50):
            time.sleep(0.1)
            try:
                os.kill(pid, 0)
            except OSError:
                print(f"Server (PID {pid}) stopped.")
                remove_pid()
                return True
        os.kill(pid, signal.SIGKILL)
        print(f"Server (PID {pid}) force stopped.")
        remove_pid()
        return True
    except ProcessLookupError:
        print(f"Server (PID {pid}) not found. Cleaning up.")
        remove_pid()
        return False
    except OSError as e:
        print(f"Error stopping server (PID {pid}): {e}")
        return False


class AutumnDeskHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler restricted to public directory."""

    server_version = "AutumnDesk/1.0"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def log_message(self, format, *args):
        sys.stderr.write("%s - - [%s] %s\n" %
                         (self.client_address[0],
                          self.log_date_time_string(),
                          format % args))

    def translate_path(self, path):
        """Translate URL path to filesystem path, restricted to PUBLIC_DIR."""
        parsed = urlparse(path)
        path_str = parsed.path

        # Decode URL-encoded path
        try:
            decoded = unquote(path_str, encoding="utf-8", errors="strict")
        except UnicodeDecodeError:
            return ""

        # Split into parts and filter
        parts = [p for p in decoded.split("/") if p and p != "."]

        # Default to index.html for root path
        if not parts:
            parts = ["index.html"]

        # Check for hidden files/dirs
        for part in parts:
            if part.startswith("."):
                return ""

        # Build and resolve path
        raw_candidate = PUBLIC_DIR.joinpath(*parts)

        # Check symlinks
        current = PUBLIC_DIR
        for part in parts:
            current = current / part
            if current.is_symlink():
                return ""

        # Resolve and validate within PUBLIC_DIR
        try:
            resolved = raw_candidate.resolve()
            PUBLIC_RESOLVED = PUBLIC_DIR.resolve()
            resolved.relative_to(PUBLIC_RESOLVED)
        except ValueError:
            return ""

        if not resolved.is_file():
            return ""

        return str(resolved)

    def send_not_found(self):
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Not found")

    def do_GET(self):
        path = self.translate_path(self.path)
        if not path:
            self.send_not_found()
            return
        self._serve_file(path)

    def do_HEAD(self):
        path = self.translate_path(self.path)
        if not path:
            self.send_not_found()
            return
        self._serve_file_head(path)

    def _serve_file(self, filepath):
        """Serve a file directly."""
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            ctype = self.guess_type(filepath)
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except (OSError, IOError):
            self.send_not_found()

    def _serve_file_head(self, filepath):
        """Serve file headers only (HEAD request)."""
        try:
            size = os.path.getsize(filepath)
            ctype = self.guess_type(filepath)
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.end_headers()
        except (OSError, IOError):
            self.send_not_found()

    def list_directory(self, path):
        """Disable directory listing."""
        self.send_not_found()
        return None

    def guess_type(self, path):
        """Custom MIME type guessing with safe defaults."""
        ext = Path(path).suffix.lower()
        custom_types = {
            ".js": "text/javascript; charset=utf-8",
            ".mjs": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".html": "text/html; charset=utf-8",
            ".htm": "text/html; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".woff": "font/woff",
            ".woff2": "font/woff2",
            ".ttf": "font/ttf",
            ".pdf": "application/pdf",
            ".txt": "text/plain; charset=utf-8",
        }
        if ext in custom_types:
            return custom_types[ext]
        guessed = mimetypes.guess_type(path)[0]
        return guessed or "application/octet-stream"


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Threaded HTTP server for handling concurrent requests."""
    daemon_threads = True
    allow_reuse_address = True


def run_server():
    """Start the HTTP server."""
    try:
        host, port_str = load_env()
        port = validate_config(host, port_str)
    except ValueError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        return 2

    if PID_FILE.exists():
        existing_pid = read_pid()
        if existing_pid is not None:
            try:
                os.kill(existing_pid, 0)
                print(f"Server already running on {host}:{port} (PID {existing_pid}). Stop it first.")
                return 3
            except OSError:
                remove_pid()

    write_pid()

    try:
        server = ThreadedHTTPServer((host, port), AutumnDeskHandler)
    except OSError as e:
        print(f"Cannot start server on {host}:{port}: {e}", file=sys.stderr)
        remove_pid()
        return 1

    print(f"Serving {PUBLIC_DIR} at http://{host}:{port}")
    sys.stdout.flush()

    def shutdown_handler(signum, frame):
        server.shutdown()
        remove_pid()

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        remove_pid()
        print("Server stopped.")

    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "stop":
        stop_server()
    elif len(sys.argv) > 1 and sys.argv[1] == "restart":
        stop_server()
        import time
        time.sleep(0.5)
        raise SystemExit(run_server())
    else:
        raise SystemExit(run_server())
