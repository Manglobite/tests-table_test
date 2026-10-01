import http.client
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.old_public = server.PUBLIC
        server.PUBLIC = pathlib.Path(cls.tmp.name).resolve()
        (server.PUBLIC / "index.html").write_text("ok")
        (server.PUBLIC / "app.js").write_text("export default 1")
        cls.http = http.server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.http.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        server.PUBLIC = cls.old_public
        cls.tmp.cleanup()

    def get(self, path):
        conn = http.client.HTTPConnection("127.0.0.1", self.port)
        conn.request("GET", path)
        response = conn.getresponse()
        result = response.status, response.getheader("Content-Type"), response.read()
        conn.close()
        return result

    def test_public_files_and_mime(self):
        self.assertEqual(self.get("/")[0], 200)
        self.assertEqual(self.get("/app.js")[1], "text/javascript")

    def test_rejects_traversal_hidden_and_bad_encoding(self):
        for path in ("/%2e%2e/task.md", "/../task.md", "/.secret", "/%252e%252e/task.md", "/missing"):
            self.assertEqual(self.get(path)[0], 404, path)

    def test_environment_validation(self):
        with patch.object(server, "ROOT", pathlib.Path("/nonexistent/project")), patch.dict(os.environ, {"PORT": "70000"}):
            with self.assertRaises(ValueError):
                server.config()

    def test_runtime_is_offline_and_does_not_store_input(self):
        source = (ROOT / "public/src/main.js").read_text()
        html = (ROOT / "public/index.html").read_text()
        self.assertIn("/three.module.js", source)
        self.assertNotRegex(source + html, r"https?://")
        self.assertNotRegex(source, r"localStorage|sessionStorage|document\.cookie|fetch\(")


if __name__ == "__main__":
    unittest.main()
