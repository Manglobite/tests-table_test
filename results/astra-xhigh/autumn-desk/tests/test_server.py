import http.client
import importlib.util
import json
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('desk_server', ROOT / 'server.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='server-test-', dir=ROOT / 'tests')
        self.root = Path(self.temp.name)
        shutil.copy2(ROOT / 'server.py', self.root / 'server.py')
        shutil.copytree(ROOT / 'public', self.root / 'public')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        self.env = self.root / '.env'
        self.env.write_text(f'HOST=127.0.0.1\nPORT={self.port}\n')

    def tearDown(self):
        self.command('stop')
        self.temp.cleanup()

    def command(self, name):
        return subprocess.run([sys.executable, '-B', str(self.root / 'server.py'), name], cwd=self.root, capture_output=True, text=True, timeout=15)

    def get(self, path, method='GET'):
        client = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3)
        try:
            client.request(method, path)
            response = client.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            client.close()

    def test_lifecycle_and_configuration(self):
        self.assertEqual(self.command('run').returncode, 0)
        state = json.loads((self.root / '.runtime/state.json').read_text())
        self.assertEqual((state['host'], state['port']), ('127.0.0.1', self.port))
        self.assertEqual(self.get('/')[0], 200)
        self.assertIn('уже', self.command('run').stdout)
        self.assertEqual(self.command('restart').returncode, 0)
        self.assertEqual(self.get('/')[0], 200)
        self.assertEqual(self.command('stop').returncode, 0)
        self.assertFalse((self.root / '.runtime/state.json').exists())
        self.assertEqual(self.command('run').returncode, 0)
        self.assertEqual(self.get('/')[0], 200)

    def test_invalid_config_and_occupied_port(self):
        for config in ['HOST=bad\n', 'PORT=0\n', 'PORT=65536\n', 'PORT=12x\n', 'PORT=-1\n', 'TOKEN=secret\n', 'HOST=127.0.0.1;id\n']:
            self.env.write_text(config)
            self.assertNotEqual(self.command('run').returncode, 0)
        self.env.write_text(f'HOST=127.0.0.1\nPORT={self.port}\n')
        with socket.socket() as foreign:
            foreign.bind(('127.0.0.1', self.port))
            foreign.listen()
            self.assertNotEqual(self.command('run').returncode, 0)
            self.assertEqual(self.command('stop').returncode, 0)
            with socket.create_connection(('127.0.0.1', self.port), timeout=1):
                pass

    def test_public_boundary_and_mime(self):
        (self.root / 'public/escape.js').symlink_to(self.root / 'server.py')
        (self.root / 'public/linked').symlink_to(self.root, target_is_directory=True)
        (self.root / 'public/.hidden.js').write_text('private')
        self.assertEqual(self.command('run').returncode, 0)
        for path, mime in [('/', 'text/html'), ('/style.css', 'text/css'), ('/js/main.js', 'text/javascript'), ('/tree_js/package/build/three.module.js', 'text/javascript')]:
            status, headers, data = self.get(path)
            self.assertEqual(status, 200)
            self.assertTrue(headers['Content-Type'].startswith(mime))
            self.assertIn("connect-src 'none'", headers['Content-Security-Policy'])
            self.assertTrue(data)
        for path in ['/../.env', '/%2e%2e/server.py', '/%252e%252e/server.py', '/js/%2e%2e/%2e%2e/.env', '/.env', '/.hidden.js', '/server.py', '/Makefile', '/tests/test_server.py', '/escape.js', '/linked/server.py', '/js/', '/%00.js', '/%ff.js', '/bad%ZZ.js', '/js%5cmain.js', '//etc/passwd', '/js//main.js']:
            self.assertIn(self.get(path)[0], [403, 404], path)
        self.assertEqual(self.get('/', 'HEAD')[2], b'')
        self.assertEqual(self.get('/', 'POST')[0], 501)

    def test_stop_ignores_forged_pid(self):
        runtime = self.root / '.runtime'
        runtime.mkdir()
        with subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(20)']) as foreign:
            try:
                (runtime / 'state.json').write_text(json.dumps({'pid': foreign.pid, 'token': 'wrong'}))
                self.assertEqual(self.command('stop').returncode, 0)
                self.assertIsNone(foreign.poll())
            finally:
                foreign.terminate()
                foreign.wait()

    def test_default_and_all_interfaces(self):
        self.env.unlink()
        self.assertEqual(module.configuration(self.env), ('0.0.0.0', 8841))
        self.env.write_text(f'HOST=0.0.0.0\nPORT={self.port}\n')
        self.assertEqual(self.command('run').returncode, 0)
        self.assertEqual(self.get('/')[0], 200)


if __name__ == '__main__':
    unittest.main()
