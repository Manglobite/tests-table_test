import http.server
import mimetypes
import os
import pathlib
import signal
import socket
import subprocess
import sys
import time
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent
PUBLIC = (ROOT / "public").resolve()
PIDFILE = ROOT / ".server.pid"
LOGFILE = ROOT / ".server.log"
PORT_DEFAULT = 8765


def config():
    values = {"HOST": "0.0.0.0", "PORT": str(PORT_DEFAULT)}
    envfile = ROOT / ".env"
    if envfile.exists():
        for line in envfile.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                if key.strip() in values:
                    values[key.strip()] = value.strip()
    values.update({key: os.environ[key] for key in values if key in os.environ})
    host, port = values["HOST"], values["PORT"]
    try:
        socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        number = int(port)
        if not 1 <= number <= 65535:
            raise ValueError
    except (OSError, ValueError):
        raise ValueError("Некорректные HOST/PORT в .env или окружении")
    return host, number


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.serve_file()

    def do_HEAD(self):
        self.serve_file(head=True)

    def serve_file(self, head=False):
        try:
            raw = urllib.parse.urlsplit(self.path).path
            decoded = urllib.parse.unquote(raw, errors="strict")
            if "%" in decoded or "\\" in decoded or "\x00" in decoded:
                raise ValueError
            parts = pathlib.PurePosixPath(decoded).parts
            if any(part in ("..", ".") or part.startswith(".") for part in parts[1:]) or decoded.startswith("//"):
                raise ValueError
            relative = decoded.lstrip("/") or "index.html"
            target = (PUBLIC / relative).resolve(strict=True)
            if not target.is_relative_to(PUBLIC) or not target.is_file():
                raise ValueError
            data = target.read_bytes()
            content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if not head:
                self.wfile.write(data)
        except (ValueError, OSError, UnicodeError):
            self.send_error(404)

    def log_message(self, *_args):
        return


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def stop():
    try:
        pid = int(PIDFILE.read_text().strip())
    except (OSError, ValueError):
        PIDFILE.unlink(missing_ok=True)
        print("Сервер проекта не запущен")
        return
    if not alive(pid):
        PIDFILE.unlink(missing_ok=True)
        print("Сервер проекта не запущен")
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    for _ in range(50):
        if not alive(pid):
            break
        time.sleep(.1)
    if alive(pid):
        raise RuntimeError("Не удалось остановить процесс сервера")
    PIDFILE.unlink(missing_ok=True)
    print("Сервер остановлен")


def serve():
    host, port = config()
    class Server(http.server.ThreadingHTTPServer):
        allow_reuse_address = True
        daemon_threads = True
    with Server((host, port), Handler) as server:
        print(f"Serving http://{host}:{port}", flush=True)
        server.serve_forever()


def start():
    if PIDFILE.exists():
        try:
            pid = int(PIDFILE.read_text().strip())
        except ValueError:
            PIDFILE.unlink(missing_ok=True)
        else:
            if alive(pid):
                print("Сервер проекта уже запущен")
                return
            PIDFILE.unlink(missing_ok=True)
    host, port = config()
    try:
        with socket.socket() as probe:
            probe.bind((host, port))
    except OSError as error:
        raise RuntimeError(f"Не удалось занять {host}:{port}: {error}")
    with LOGFILE.open("ab") as log:
        proc = subprocess.Popen([sys.executable, str(ROOT / "server.py"), "serve"], cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True, close_fds=True)
    for _ in range(50):
        if not alive(proc.pid):
            raise RuntimeError("Сервер завершился при запуске; проверьте .server.log")
        try:
            with socket.create_connection((host, port), timeout=.1):
                PIDFILE.write_text(str(proc.pid))
                print(f"Сервер запущен: http://{host}:{port} (PID {proc.pid})")
                return
        except OSError:
            time.sleep(.1)
    os.kill(proc.pid, signal.SIGTERM)
    raise RuntimeError("Тайм-аут запуска сервера")


if __name__ == "__main__":
    try:
        action = sys.argv[1] if len(sys.argv) > 1 else "start"
        if action == "serve":
            serve()
        elif action == "stop":
            stop()
        elif action == "restart":
            stop()
            start()
        elif action == "start":
            start()
        else:
            raise ValueError("Используйте start, stop, restart или serve")
    except (ValueError, RuntimeError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
