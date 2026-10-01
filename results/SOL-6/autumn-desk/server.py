import http.server
import ipaddress
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
PUBLIC = ROOT / 'public'
PIDFILE = ROOT / '.server.pid'
_child = None
MIMES = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml'}


def config():
    values = {'HOST': '0.0.0.0', 'PORT': '8765'}
    env = ROOT / '.env'
    if env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                raise ValueError('Invalid .env entry')
            key, value = line.split('=', 1)
            if key.strip() not in values:
                raise ValueError('Unknown .env setting: ' + key)
            values[key.strip()] = value.strip()
    try:
        host = str(ipaddress.IPv4Address(values['HOST']))
        port = int(values['PORT'])
        if not 1 <= port <= 65535 or str(port) != values['PORT']:
            raise ValueError()
    except ValueError:
        raise ValueError('HOST must be an IPv4 address and PORT must be an integer from 1 to 65535') from None
    return host, port


def resolve_path(url):
    raw = urllib.parse.urlsplit(url).path
    try:
        path = urllib.parse.unquote(raw, errors='strict')
    except UnicodeError:
        return None
    if not path.startswith('/') or '\\' in path or '%' in path or '\x00' in path or '//' in path:
        return None
    parts = path.split('/')[1:]
    if any(part in ('.', '..') or part.startswith('.') for part in parts if part):
        return None
    if path == '/':
        parts = ['index.html']
    elif parts[-1] == '':
        return None
    candidate = PUBLIC.joinpath(*parts)
    if any(p.is_symlink() for p in [candidate, *candidate.parents] if p != PUBLIC.parent and PUBLIC in p.parents):
        return None
    if not candidate.resolve().is_relative_to(PUBLIC.resolve()) or not candidate.is_file():
        return None
    return candidate


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.deliver(False)

    def do_HEAD(self):
        self.deliver(True)

    def deliver(self, head):
        path = resolve_path(self.path)
        if path is None:
            self.send_error(404, 'Not found')
            return
        try:
            data = path.read_bytes()
        except OSError:
            self.send_error(404, 'Not found')
            return
        self.send_response(200)
        self.send_header('Content-Type', MIMES.get(path.suffix, mimetypes.guess_type(path.name)[0] or 'application/octet-stream') + ('; charset=utf-8' if path.suffix in ('.js', '.css', '.html', '.svg') else ''))
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def log_message(self, format, *args):
        pass


def identity(pid):
    try:
        proc = pathlib.Path('/proc') / str(pid)
        cmd = (proc / 'cmdline').read_bytes().split(b'\x00')
        if str(ROOT / 'server.py').encode() not in cmd or b'serve' not in cmd:
            return None
        return (proc / 'stat').read_text().split(') ', 1)[1].split()[19]
    except (OSError, IndexError):
        return None


def saved_process():
    try:
        pid, stamp = PIDFILE.read_text().split()
        pid = int(pid)
        if identity(pid) == stamp:
            return pid
    except (OSError, ValueError):
        pass
    return None


def stop():
    pid = saved_process()
    if pid is None:
        PIDFILE.unlink(missing_ok=True)
        print('No project server running')
        return
    os.kill(pid, signal.SIGTERM)
    for _ in range(60):
        if identity(pid) is None:
            break
        time.sleep(0.05)
    PIDFILE.unlink(missing_ok=True)
    if _child is not None and _child.pid == pid:
        try:
            _child.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
    print('Stopped project server')


def start():
    global _child
    if saved_process():
        raise RuntimeError('Project server already running')
    host, port = config()
    child = subprocess.Popen([sys.executable, str(ROOT / 'server.py'), 'serve', host, str(port)], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True, cwd=ROOT)
    line = child.stdout.readline().strip()
    if line != 'READY':
        child.wait(timeout=5)
        raise RuntimeError(line or 'Server failed to start (check port availability)')
    stamp = identity(child.pid)
    if stamp is None:
        child.terminate()
        raise RuntimeError('Server failed to start')
    PIDFILE.write_text(f'{child.pid} {stamp}\n')
    child.stdout.close()
    _child = child
    print(f'Running at http://{host}:{port} (PID {child.pid})')


def serve(host, port):
    try:
        server = http.server.ThreadingHTTPServer((host, port), Handler)
    except OSError as exc:
        print(f'Cannot bind {host}:{port}: {exc}', flush=True)
        return 1
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    print('READY', flush=True)
    server.serve_forever()
    return 0


if __name__ == '__main__':
    try:
        action = sys.argv[1] if len(sys.argv) > 1 else ''
        if action == 'start':
            start()
        elif action == 'stop':
            stop()
        elif action == 'serve' and len(sys.argv) == 4:
            sys.exit(serve(sys.argv[2], int(sys.argv[3])))
        else:
            raise ValueError('Usage: server.py start|stop')
    except (ValueError, RuntimeError) as exc:
        print(f'Error: {exc}', file=sys.stderr)
        sys.exit(1)
