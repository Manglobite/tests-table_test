#!/usr/bin/env python3
"""Secure, minimal static file server for the "Autumn Desk" WebGL scene.

Design goals (mirrors the task acceptance criteria):

* Serves ONLY files that live inside the configured public directory.
* No directory listing, no writes, no dotfiles, no traversal.
* Defends against percent-encoded traversal, backslashes, NUL bytes,
  Windows drive tricks and symlinks escaping the public root.
* Deterministic, conservative MIME types; never guesses unknown formats.
* Sensible security headers; the scene must run fully offline.

The module is import-safe: importing it does not start a server and does
not read the filesystem.  The CLI entry point parses ``.env``/environment
values, validates them and then serves.

Security model
--------------
A request path is *resolved* to an absolute real path and is accepted only
when ``os.path.commonpath((public_real, target_real)) == public_real``.
This single check defeats traversal, encoded traversal and symlink escapes
at once, because ``os.path.realpath`` collapses ``..`` and resolves links.
On top of that we reject NUL bytes, backslashes, control characters and
any path segment starting with a dot (unless a caller explicitly allows
dotfiles, which this server never does).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import html
import http.server
import ipaddress
import os
import socket
import sys
import urllib.parse
from email.utils import formatdate
from pathlib import Path

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PUBLIC_DIR = PROJECT_ROOT / "public"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8173

# Conservative allow-list of MIME types.  Unknown extensions are rejected
# instead of being served as application/octet-stream, so nobody can smuggle
# an executable/HTML payload through a harmless looking extension.
MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".wasm": "application/wasm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
}

SERVER_NAME = "autumn-desk"
SERVER_VERSION = "1.0"


# --------------------------------------------------------------------------
# Configuration helpers
# --------------------------------------------------------------------------

class ConfigError(Exception):
    """Raised for invalid server configuration values."""


def validate_host(value, *, allow_domain: bool = False) -> str:
    """Validate a HOST value.

    Accepts a concrete IPv4/IPv6 address or (optionally) a resolvable
    hostname.  ``0.0.0.0`` and ``::`` are allowed as explicit bind-all
    addresses.  The empty string, wildcards and whitespace are rejected.
    """
    if not isinstance(value, str):
        raise ConfigError("HOST must be a string")
    host = value.strip()
    if not host:
        raise ConfigError("HOST must not be empty")
    if any(ch.isspace() for ch in host):
        raise ConfigError(f"HOST {value!r} must not contain whitespace")
    if host in ("*",):
        raise ConfigError("HOST '*' is ambiguous; use 0.0.0.0 or :: instead")

    # Try as an IP address first (handles IPv6 including bracketed form).
    candidate = host
    if candidate.startswith("[") and candidate.endswith("]"):
        candidate = candidate[1:-1]
    try:
        ipaddress.ip_address(candidate)
        return host
    except ValueError:
        pass

    if allow_domain and _is_valid_hostname(host):
        return host

    raise ConfigError(
        f"HOST {value!r} is not a valid IP address"
        + ("" if allow_domain else " (domains are not enabled)")
    )


def _is_valid_hostname(host: str) -> bool:
    if len(host) > 253:
        return False
    labels = host.rstrip(".").split(".")
    if len(labels) < 2:
        # A single label such as "localhost" is still acceptable.
        labels = labels or [host]
    for label in labels:
        if not label or len(label) > 63:
            return False
        if label[0] == "-" or label[-1] == "-":
            return False
        if not all(ch.isalnum() or ch == "-" for ch in label):
            return False
    # The final label (a TLD) must contain a letter, otherwise an all-numeric
    # dotted string is a malformed IP address, not a hostname.
    if len(labels) > 1 and not any(ch.isalpha() for ch in labels[-1]):
        return False
    return True


def validate_port(value) -> int:
    """Validate a PORT value and return it as int."""
    if isinstance(value, bool):
        raise ConfigError("PORT must be an integer")
    if isinstance(value, int):
        port = value
    else:
        text = str(value).strip()
        if not text:
            raise ConfigError("PORT must not be empty")
        if not text.isdigit():
            raise ConfigError(f"PORT {value!r} must be an integer")
        port = int(text)
    if not (1 <= port <= 65535):
        raise ConfigError(f"PORT {port} is out of range 1..65535")
    if port < 1024 and os.geteuid() != 0:
        raise ConfigError(
            f"PORT {port} is privileged; use a port >= 1024 or run as root"
        )
    return port


def load_env_file(path: Path) -> dict:
    """Parse a simple KEY=VALUE .env file (no interpolation, no exports)."""
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].strip()
        if "=" not in line:
            raise ConfigError(f"Malformed line in {path.name}: {raw!r}")
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        values[key] = val
    return values


def resolve_config(args) -> tuple[str, int, Path]:
    """Merge CLI > environment > .env defaults and validate everything."""
    env_file = Path(args.env_file) if args.env_file else PROJECT_ROOT / ".env"
    file_values = load_env_file(env_file)

    def pick(name: str, fallback):
        env_name = name.upper()
        if getattr(args, name, None) is not None:
            return getattr(args, name)
        if os.environ.get(env_name):
            return os.environ[env_name]
        if env_name in file_values:
            return file_values[env_name]
        return file_values.get(name, fallback)

    host_raw = pick("host", DEFAULT_HOST)
    port_raw = pick("port", str(DEFAULT_PORT))
    public_raw = pick("public_dir", str(DEFAULT_PUBLIC_DIR))

    host = validate_host(host_raw, allow_domain=True)
    port = validate_port(port_raw)

    public_dir = Path(public_raw)
    if not public_dir.is_absolute():
        public_dir = (PROJECT_ROOT / public_dir).resolve()
    else:
        public_dir = public_dir.resolve()
    if not public_dir.is_dir():
        raise ConfigError(f"Public directory does not exist: {public_dir}")
    # Guard against configuring a public dir that contains the sources.
    if public_dir == PROJECT_ROOT:
        raise ConfigError("Public directory must be a subdirectory, not the project root")

    return host, port, public_dir


# --------------------------------------------------------------------------
# Request handler
# --------------------------------------------------------------------------

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = f"{SERVER_NAME}/{SERVER_VERSION}"
    sys_version = ""  # do not leak the Python version
    protocol_version = "HTTP/1.1"

    # -- helpers -----------------------------------------------------------

    @property
    def public_dir(self) -> Path:
        return self.server.public_dir  # type: ignore[attr-defined]

    def log_message(self, fmt, *args):  # noqa: D401 - signature from stdlib
        if getattr(self.server, "quiet", False):  # type: ignore[attr-defined]
            return
        sys.stderr.write(
            "%s - - [%s] %s\n"
            % (
                self.address_string(),
                self.log_date_time_string(),
                fmt % args,
            )
        )

    def _send_common_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )

    def _send_error_page(self, code: int, message: str):
        body = (
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
            f"<title>{code}</title></head><body><h1>{code}</h1>"
            f"<p>{html.escape(message)}</p></body></html>"
        ).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_common_headers()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    # -- path resolution ---------------------------------------------------

    def _decode_path(self) -> str | None:
        raw = self.path
        # Strip query string and fragment; fragments never reach a server but
        # a raw socket client could still send one.
        raw = raw.split("#", 1)[0]
        raw = raw.split("?", 1)[0]
        if "%00" in raw.lower() or "\x00" in raw:
            return None
        if "\\" in raw:
            return None
        try:
            decoded = urllib.parse.unquote(raw, errors="strict")
        except (UnicodeDecodeError, ValueError):
            return None
        if "\x00" in decoded or "\\" in decoded:
            return None
        # Reject control characters outright.
        if any(ord(ch) < 0x20 or ord(ch) == 0x7F for ch in decoded):
            return None
        if not decoded.startswith("/"):
            return None
        return decoded

    def _resolve(self) -> Path | None:
        """Return a safe absolute path inside the public dir, or None."""
        decoded = self._decode_path()
        if decoded is None:
            return None

        if decoded.endswith("/"):
            decoded += "index.html"

        # Collapse to a relative POSIX style path, rejecting dot segments
        # (including the encoded ones, already decoded above).
        parts = decoded.split("/")
        safe_parts = []
        for part in parts:
            if part in ("", "."):
                continue
            if part == "..":
                return None
            if part.startswith("."):
                return None  # hidden file / directory
            safe_parts.append(part)

        candidate = self.public_dir.joinpath(*safe_parts)

        try:
            real_root = getattr(self.server, "public_real", None) or os.path.realpath(
                self.public_dir
            )
            real_target = os.path.realpath(candidate)
        except OSError:
            return None

        # The one authoritative containment check (defeats symlink escapes).
        if os.path.commonpath([real_root, real_target]) != real_root:
            return None
        if not os.path.isfile(real_target):
            return None
        return Path(real_target)

    # -- HTTP verbs --------------------------------------------------------

    def do_GET(self):  # noqa: N802
        self._serve(head_only=False)

    def do_HEAD(self):  # noqa: N802
        self._serve(head_only=True)

    def do_POST(self):  # noqa: N802
        self._method_not_allowed()

    def do_PUT(self):  # noqa: N802
        self._method_not_allowed()

    def do_DELETE(self):  # noqa: N802
        self._method_not_allowed()

    def do_PATCH(self):  # noqa: N802
        self._method_not_allowed()

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self.send_header("Allow", "GET, HEAD")
        self.send_header("Content-Length", "0")
        self._send_common_headers()
        self.end_headers()

    def _method_not_allowed(self):
        self._send_error_page(405, "Method not allowed")

    def _serve(self, *, head_only: bool):
        is_head = self.command == "HEAD"
        target = self._resolve()
        if target is None:
            self._send_error_page(404, "Not found")
            return

        suffix = target.suffix.lower()
        content_type = MIME_TYPES.get(suffix)
        if content_type is None:
            self._send_error_page(404, "File type is not served")
            return

        try:
            stat = target.stat()
        except OSError:
            self._send_error_page(404, "Not found")
            return

        size = stat.st_size
        last_modified = formatdate(stat.st_mtime, usegmt=True)

        # Conditional GET support (small and safe).
        if_none_match = self.headers.get("If-None-Match")
        etag = '"%x-%x"' % (int(stat.st_mtime), size)
        if if_none_match and if_none_match.strip() == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self._send_common_headers()
            self.end_headers()
            return

        try:
            handle = open(target, "rb")
        except OSError:
            self._send_error_page(404, "Not found")
            return

        try:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(size))
            self.send_header("Last-Modified", last_modified)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", "no-cache")
            self._send_common_headers()
            self.end_headers()
            if not head_only:
                self._copy_body(handle, size)
        finally:
            handle.close()

    def _copy_body(self, handle, size: int):
        remaining = size
        chunk = 64 * 1024
        try:
            while remaining > 0:
                data = handle.read(min(chunk, remaining))
                if not data:
                    break
                self.wfile.write(data)
                remaining -= len(data)
        except (BrokenPipeError, ConnectionResetError):
            # Client went away; nothing sensible left to do.
            pass


class AutumnHTTPServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, public_dir: Path, quiet: bool):
        # Normalise once so the hot request path can reuse the real root.
        self.public_dir = public_dir.resolve()
        self.public_real = os.path.realpath(self.public_dir)
        self.quiet = quiet
        super().__init__(address, handler)


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Autumn Desk static server")
    parser.add_argument("--host", default=None, help="bind address (overrides .env)")
    parser.add_argument("--port", default=None, help="bind port (overrides .env)")
    parser.add_argument("--public-dir", default=None, help="public root directory")
    parser.add_argument("--env-file", default=None, help="path to .env file")
    parser.add_argument("--quiet", action="store_true", help="suppress request logs")
    parser.add_argument(
        "--check-config",
        action="store_true",
        help="validate configuration and exit without serving",
    )
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        host, port, public_dir = resolve_config(args)
    except ConfigError as exc:
        sys.stderr.write(f"[autumn-desk] configuration error: {exc}\n")
        return 2

    if args.check_config:
        print(f"OK host={host} port={port} public_dir={public_dir}")
        return 0

    if not (public_dir / "index.html").is_file():
        sys.stderr.write(
            f"[autumn-desk] public directory has no index.html: {public_dir}\n"
        )
        return 2

    family = socket.AF_INET6 if ":" in host else socket.AF_INET
    server_cls = AutumnHTTPServer
    try:
        server_cls.address_family = family
        httpd = server_cls((host, port), Handler, public_dir=public_dir, quiet=args.quiet)
    except OSError as exc:
        sys.stderr.write(
            f"[autumn-desk] cannot bind {host}:{port}: {exc}\n"
            "  Is the port already in use?\n"
        )
        return 1

    started = _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(
        f"[autumn-desk] {started} serving {public_dir} "
        f"on http://{host}:{port}/ (Ctrl+C to stop)",
        flush=True,
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[autumn-desk] stopping", flush=True)
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
