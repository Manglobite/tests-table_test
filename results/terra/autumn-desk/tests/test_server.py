import http.client
import os
import socket
import subprocess
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sock = socket.socket(); sock.bind(('127.0.0.1', 0)); cls.port = sock.getsockname()[1]; sock.close()
        (ROOT / '.env').write_text(f'HOST=127.0.0.1\nPORT={cls.port}\n')
        cls.process = subprocess.Popen(['python3', 'scripts/server.py'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(.2)
    @classmethod
    def tearDownClass(cls):
        cls.process.terminate(); cls.process.wait(timeout=2); (ROOT / '.env').unlink(missing_ok=True)
    def request(self, path):
        con = http.client.HTTPConnection('127.0.0.1', self.port); con.request('GET', path); response = con.getresponse(); data = response.read(); con.close(); return response, data
    def test_public_files_and_mime(self):
        response, data = self.request('/'); self.assertEqual(response.status, 200); self.assertIn('Осенний'.encode(), data); self.assertIn('text/html', response.getheader('Content-Type'))
        response, data = self.request('/index.html'); self.assertEqual(response.status, 200); self.assertIn('Осенний'.encode(), data); self.assertIn('text/html', response.getheader('Content-Type'))
        response, _ = self.request('/main.js'); self.assertEqual(response.status, 200); self.assertIn('text/javascript', response.getheader('Content-Type'))
    def test_private_and_traversal_are_rejected(self):
        for path in ('/.env', '/../.env', '/%2e%2e/.env', '/scripts/server.py', '/vendor/'):
            response, _ = self.request(path); self.assertEqual(response.status, 404, path)
    def test_invalid_configuration_is_rejected(self):
        (ROOT / '.env').write_text('HOST=127.0.0.1\nPORT=invalid\n')
        bad = subprocess.run(['python3', 'scripts/server.py'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(bad.returncode, 2); self.assertIn('Configuration error', bad.stderr)
        (ROOT / '.env').write_text(f'HOST=127.0.0.1\nPORT={self.port}\n')

if __name__ == '__main__': unittest.main()
