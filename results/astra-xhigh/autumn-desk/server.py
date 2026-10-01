import argparse
import fcntl
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote_to_bytes, urlsplit

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
RUNTIME = ROOT / '.runtime'
CONTROL = RUNTIME / 'control.sock'
STATE = RUNTIME / 'state.json'


def configuration(path=None):
    values = {'HOST': '0.0.0.0', 'PORT': '8841'}
    path = path or ROOT / '.env'
    if path.exists():
        for raw in path.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            key, separator, value = line.partition('=')
            if not separator or key not in values:
                raise ValueError('В .env допустимы только HOST=… и PORT=…')
            values[key] = value.strip()
    host = values['HOST']
    if host == 'localhost':
        host = '127.0.0.1'
    try:
        ipaddress.IPv4Address(host)
    except ValueError as exc:
        raise ValueError('HOST должен быть IPv4-адресом или localhost') from exc
    if not re.fullmatch(r'[0-9]{1,5}', values['PORT']) or not 1024 <= int(values['PORT']) <= 65535:
        raise ValueError('PORT должен быть целым числом от 1024 до 65535')
    return host, int(values['PORT'])


def public_path(raw):
    if not raw.startswith('/') or raw.startswith('//') or re.search(r'%(?![0-9a-fA-F]{2})', raw):
        raise ValueError('Некорректный URL')
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc or parsed.fragment:
        raise ValueError('Некорректный URL')
    path = unquote_to_bytes(parsed.path).decode('utf-8', errors='strict')
    if '%' in path or '\\' in path or any(ord(char) < 32 or ord(char) == 127 for char in path):
        raise ValueError('Некорректный путь')
    if path == '/':
        path = '/index.html'
    parts = path[1:].split('/')
    if any(not part or part.startswith('.') for part in parts):
        raise ValueError('Доступ запрещён')
    target = PUBLIC
    for part in parts:
        target = target / part
        if target.is_symlink():
            raise ValueError('Симлинки запрещены')
    if not target.resolve().is_relative_to(PUBLIC.resolve()):
        raise ValueError('Доступ запрещён')
    if target.suffix not in {'.html', '.css', '.js', '.png', '.jpg', '.svg', '.ico', '.woff2'}:
        raise ValueError('Непубличный тип файла')
    return target


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.respond(False)

    def do_HEAD(self):
        self.respond(True)

    def respond(self, head):
        try:
            path = public_path(self.path)
            relative = path.relative_to(PUBLIC)
            directory = os.open(PUBLIC, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                for part in relative.parts[:-1]:
                    following = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
                    os.close(directory)
                    directory = following
                descriptor = os.open(relative.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
            finally:
                os.close(directory)
            with os.fdopen(descriptor, 'rb') as source:
                import stat
                if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
                    raise ValueError('Не файл')
                data = source.read()
        except (ValueError, UnicodeError):
            self.send_error(403, 'Forbidden')
            return
        except OSError:
            self.send_error(404, 'Not found')
            return
        self.send_response(200)
        mime = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html'}.get(path.suffix)
        self.send_header('Content-Type', (mime or mimetypes.guess_type(path.name)[0] or 'application/octet-stream') + ('; charset=utf-8' if path.suffix in {'.js', '.css', '.html'} else ''))
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        if not head:
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def log_message(self, *_args):
        pass


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(5)
        return connection, address


def control_request(command, state):
    with socket.socket(socket.AF_UNIX) as client:
        client.settimeout(2)
        client.connect(str(CONTROL))
        client.sendall(json.dumps({'token': state['token'], 'command': command}).encode())
        return json.loads(client.recv(4096))


def read_state():
    try:
        state = json.loads(STATE.read_text())
        if control_request('status', state).get('project') == str(ROOT):
            return state
    except (OSError, ValueError, KeyError):
        pass
    return None


def serve(host, port, ready):
    server = None
    try:
        server = Server((host, port), Handler)
        token = secrets.token_hex(32)
        CONTROL.unlink(missing_ok=True)
        with socket.socket(socket.AF_UNIX) as control:
            control.bind(str(CONTROL))
            os.chmod(CONTROL, 0o600)
            control.listen(4)
            control.settimeout(1)
            STATE.write_text(json.dumps({'token': token, 'host': host, 'port': port}))
            os.chmod(STATE, 0o600)
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            os.write(ready, b'OK')
            os.close(ready)
            ready = None
            while True:
                try:
                    connection, _ = control.accept()
                except socket.timeout:
                    continue
                with connection:
                    connection.settimeout(2)
                    try:
                        message = json.loads(connection.recv(4096))
                        if not secrets.compare_digest(str(message.get('token', '')), token):
                            connection.sendall(b'{}')
                            continue
                        command = message.get('command')
                        connection.sendall(json.dumps({'project': str(ROOT)}).encode())
                        if command == 'stop':
                            break
                    except (ValueError, OSError):
                        continue
            server.shutdown()
            worker.join(timeout=3)
    except Exception as exc:
        if ready is not None:
            os.write(ready, f'Ошибка запуска: {exc}'.encode())
    finally:
        if server:
            server.server_close()
            STATE.unlink(missing_ok=True)
            CONTROL.unlink(missing_ok=True)
        if ready is not None:
            os.close(ready)


def start():
    host, port = configuration()
    if read_state():
        print('Сервер проекта уже запущен')
        return
    incoming, outgoing = os.pipe()
    with (RUNTIME / 'server.log').open('ab') as log:
        child = subprocess.Popen([sys.executable, str(ROOT / 'server.py'), '_serve', '--host', host, '--port', str(port), '--ready', str(outgoing)], pass_fds=(outgoing,), stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True, cwd=ROOT)
    os.close(outgoing)
    try:
        import select
        if not select.select([incoming], [], [], 8)[0]:
            child.terminate()
            child.wait(timeout=5)
            raise ValueError('Сервер не подтвердил запуск')
        result = os.read(incoming, 4096).decode()
    finally:
        os.close(incoming)
    if result != 'OK':
        child.wait(timeout=5)
        raise ValueError(result or 'Сервер завершился до запуска')
    print(f'Сервер запущен: {host}:{port}')


def stop():
    state = read_state()
    if not state:
        print('Сервер проекта не запущен; чужие процессы не затронуты')
        return
    control_request('stop', state)
    for _ in range(60):
        if not STATE.exists():
            print('Сервер проекта остановлен')
            return
        time.sleep(0.05)
    raise ValueError('Сервер не подтвердил остановку; принудительное завершение не применяется')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['run', 'stop', 'restart', '_serve'])
    parser.add_argument('--host')
    parser.add_argument('--port', type=int)
    parser.add_argument('--ready', type=int)
    args = parser.parse_args()
    if args.command == '_serve':
        serve(args.host, args.port, args.ready)
        return
    RUNTIME.mkdir(mode=0o700, exist_ok=True)
    with (RUNTIME / 'manager.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            if args.command == 'restart':
                configuration()
                stop()
                start()
            elif args.command == 'run':
                start()
            else:
                stop()
        except (ValueError, OSError) as exc:
            print(str(exc), file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()
