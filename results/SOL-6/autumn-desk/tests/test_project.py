import http.client
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import server


class ProjectTests(unittest.TestCase):
    def test_config(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(server, 'ROOT', pathlib.Path(directory)):
                self.assertEqual(server.config(), ('0.0.0.0', 8765))
                for content in ['HOST=example.com', 'PORT=0', 'PORT=65536', 'PORT=hello', 'PORT=8000\nOTHER=x']:
                    (pathlib.Path(directory) / '.env').write_text(content)
                    with self.assertRaises(ValueError):
                        server.config()
                (pathlib.Path(directory) / '.env').write_text('HOST=127.0.0.1\nPORT=8321')
                self.assertEqual(server.config(), ('127.0.0.1', 8321))

    def test_paths(self):
        for path in ['/', '/index.html', '/js/main.js', '/vendor/three.module.js']:
            self.assertTrue(server.resolve_path(path), path)
        for path in ['/../server.py', '/%2e%2e/server.py', '/%252e%252e/server.py', '/.env', '/.server.pid', '/tests/test_server.py', '/js/../../server.py', '//index.html', '/%5cserver.py', '/js/', '/%00', '/%FF']:
            self.assertIsNone(server.resolve_path(path), path)
        with tempfile.TemporaryDirectory() as directory:
            link = server.PUBLIC / 'test-link'
            try:
                link.symlink_to(pathlib.Path(directory))
                self.assertIsNone(server.resolve_path('/test-link'))
            finally:
                link.unlink(missing_ok=True)

    def test_http_and_lifecycle(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(server, 'PIDFILE', pathlib.Path(directory) / 'pid'):
                process = subprocess.Popen([sys.executable, str(server.ROOT / 'server.py'), 'serve', '127.0.0.1', str(port)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                try:
                    self.assertEqual(process.stdout.readline().strip(), 'READY')
                    for path, status, content_type in [('/', 200, 'text/html'), ('/js/main.js', 200, 'text/javascript'), ('/style.css', 200, 'text/css'), ('/vendor/three.module.js', 200, 'text/javascript'), ('/%2e%2e/server.py', 404, None)]:
                        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
                        connection.request('GET', path)
                        response = connection.getresponse()
                        self.assertEqual(response.status, status)
                        if content_type:
                            self.assertIn(content_type, response.getheader('Content-Type'))
                        response.read()
                        connection.close()
                    occupied = subprocess.run([sys.executable, str(server.ROOT / 'server.py'), 'serve', '127.0.0.1', str(port)], capture_output=True, text=True, timeout=4)
                    self.assertNotEqual(occupied.returncode, 0)
                    self.assertIn('Cannot bind', occupied.stdout)
                    server.PIDFILE.write_text(f'{os.getpid()} fake\n')
                    server.stop()
                    self.assertIsNone(process.poll())
                finally:
                    process.terminate()
                    process.wait(timeout=5)
                    process.stdout.close()

    def test_start_stop_restart(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(server, 'PIDFILE', pathlib.Path(directory) / 'pid'), patch.object(server, 'config', return_value=('127.0.0.1', port)):
                try:
                    server.start()
                    self.assertIsNotNone(server.saved_process())
                    with self.assertRaises(RuntimeError):
                        server.start()
                    server.stop()
                    self.assertIsNone(server.saved_process())
                    server.start()
                    self.assertIsNotNone(server.saved_process())
                finally:
                    server.stop()

    def test_offline_and_interaction_contract(self):
        main = (server.PUBLIC / 'js/main.js').read_text()
        focus = (server.PUBLIC / 'js/focus.js').read_text()
        scene = (server.PUBLIC / 'js/scene.js').read_text()
        source = main + focus + scene + (server.PUBLIC / 'index.html').read_text()
        self.assertIn("../vendor/three.module.js", source)
        for word in ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'http://', 'https://']:
            self.assertNotIn(word, source)
        for key in ['window', 'laptop', 'notebook', 'calendar']:
            self.assertIn(f'targets.{key}', scene)
            self.assertIn(f'{key}: {{ position:', focus)
        for term in ["key === this.current", "focus.select('home')", "e.key === 'Escape'", 'this.camera.position.lerp', 'raycaster.intersectObjects']:
            self.assertIn(term, source)


if __name__ == '__main__':
    unittest.main()
