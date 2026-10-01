#!/usr/bin/env python3
import mimetypes
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

PUBLIC = Path(__file__).resolve().parent.parent / "public"


def config():
    host, port = "0.0.0.0", "4173"
    env = Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                if key.strip() == "HOST": host = value.strip()
                if key.strip() == "PORT": port = value.strip()
    if not re.fullmatch(r"(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+)", host):
        raise ValueError("HOST must be a hostname or IPv4 address")
    try: port = int(port)
    except ValueError: raise ValueError("PORT must be an integer")
    if not 1 <= port <= 65535: raise ValueError("PORT must be between 1 and 65535")
    return host, port


class PublicOnlyHandler(SimpleHTTPRequestHandler):
    server_version = "AutumnDesk/1.0"
    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))
    def translate_path(self, path):
        raw = urlsplit(path).path
        try: decoded = unquote(raw, encoding="utf-8", errors="strict")
        except UnicodeDecodeError: return ""
        parts = [p for p in decoded.split("/") if p]
        if not parts:
            parts = ["index.html"]
        if any(p in (".", "..") or p.startswith(".") or "\\" in p for p in parts): return ""
        raw_candidate = PUBLIC.joinpath(*parts)
        current = PUBLIC
        for part in parts:
            current = current / part
            if current.is_symlink(): return ""
        candidate = raw_candidate.resolve()
        try: candidate.relative_to(PUBLIC.resolve())
        except ValueError: return ""
        if not candidate.is_file(): return ""
        return str(candidate)
    def do_GET(self):
        if not self.translate_path(self.path):
            self.send_error(404, "Not found")
            return
        super().do_GET()
    def do_HEAD(self): self.do_GET()
    def list_directory(self, path):
        self.send_error(404, "Not found")
        return None
    def guess_type(self, path):
        return {".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".html":"text/html; charset=utf-8"}.get(Path(path).suffix, mimetypes.guess_type(path)[0] or "application/octet-stream")


def main():
    try: host, port = config()
    except ValueError as error:
        print(f"Configuration error: {error}", file=sys.stderr); return 2
    try:
        server = ThreadingHTTPServer((host, port), PublicOnlyHandler)
    except OSError as error:
        print(f"Cannot start server on {host}:{port}: {error}", file=sys.stderr); return 1
    print(f"Serving {PUBLIC} at http://{host}:{port}")
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == "__main__": raise SystemExit(main())
