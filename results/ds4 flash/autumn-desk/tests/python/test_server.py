"""Automated tests for the Autumn Desk static server.

Covers:
  * configuration validation (HOST/PORT/public dir)
  * MIME type allow-listing and method handling
  * containment: traversal, encoded traversal, backslashes, dotfiles,
    symlink escapes and paths outside the public root
  * that the server never leaks the project root or dotfiles
"""

import http.client
import os
import socket
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "server"))

import serve  # noqa: E402


class TestConfig(unittest.TestCase):
    def test_valid_hosts(self):
        for host in ["0.0.0.0", "127.0.0.1", "::1", "192.168.1.10", "localhost"]:
            self.assertEqual(serve.validate_host(host, allow_domain=True), host)

    def test_reject_bad_hosts(self):
        for host in ["", "  ", "*", "1.2.3", "300.1.1.1", "has space", "a..b"]:
            with self.assertRaises(serve.ConfigError):
                serve.validate_host(host, allow_domain=True)

    def test_domains_disabled_by_default(self):
        with self.assertRaises(serve.ConfigError):
            serve.validate_host("example.com")

    def test_valid_ports(self):
        self.assertEqual(serve.validate_port("8173"), 8173)
        self.assertEqual(serve.validate_port(8080), 8080)

    def test_reject_bad_ports(self):
        for port in ["0", "70000", "-1", "abc", "", "80.5"]:
            with self.assertRaises(serve.ConfigError):
                serve.validate_port(port)

    def test_env_file_parsing(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            env.write_text(
                "# comment\nHOST=127.0.0.1\nPORT=9000\nQUOTED=\"a b\"\n",
                encoding="utf-8",
            )
            values = serve.load_env_file(env)
            self.assertEqual(values["HOST"], "127.0.0.1")
            self.assertEqual(values["PORT"], "9000")
            self.assertEqual(values["QUOTED"], "a b")

    def test_env_file_malformed(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            env.write_text("JUST_A_KEY\n", encoding="utf-8")
            with self.assertRaises(serve.ConfigError):
                serve.load_env_file(env)

    def _resolve(self, env_body, argv=None):
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            env.write_text(env_body, encoding="utf-8")
            public = Path(tmp) / "public"
            public.mkdir()
            parser = serve.build_parser()
            args = parser.parse_args(
                ["--env-file", str(env)] + (argv or [])
            )
            return serve.resolve_config(args)

    def test_env_file_is_applied(self):
        host, port, public = self._resolve(
            "HOST=127.0.0.1\nPORT=9201\nPUBLIC_DIR=public\n"
        )
        self.assertEqual(host, "127.0.0.1")
        self.assertEqual(port, 9201)
        self.assertTrue(str(public).endswith("public"))

    def test_cli_overrides_env_file(self):
        host, port, _ = self._resolve(
            "HOST=127.0.0.1\nPORT=9201\n",
            argv=["--host", "0.0.0.0", "--port", "9302"],
        )
        self.assertEqual(host, "0.0.0.0")
        self.assertEqual(port, 9302)


class ServerHarness:
    """Starts the real server on an ephemeral port and tears it down."""

    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.public = root / "public"
        self.public.mkdir()

        (self.public / "index.html").write_text("<h1>ok</h1>", encoding="utf-8")
        (self.public / "app.css").write_text("body{}", encoding="utf-8")
        (self.public / "three.module.js").write_text("export{}", encoding="utf-8")
        (self.public / "notes.md").write_text("# no", encoding="utf-8")
        (self.public / ".env").write_text("SECRET=1", encoding="utf-8")
        (self.public / ".hidden").write_text("x", encoding="utf-8")

        # A secret outside the public root must never be reachable.
        self.outside = root / "secret.txt"
        self.outside.write_text("TOPSECRET", encoding="utf-8")
        try:
            os.symlink(self.outside, self.public / "escape.txt")
        except OSError:
            self.symlink_ok = False
        else:
            self.symlink_ok = True

    def start(self):
        self.httpd = serve.AutumnHTTPServer(
            ("127.0.0.1", 0), serve.Handler, public_dir=self.public, quiet=True
        )
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return self.port

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def request(self, path, method="GET"):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            conn.request(method, path)
            res = conn.getresponse()
            return res.status, dict(res.getheaders()), res.read()
        finally:
            conn.close()


class TestHTTPServing(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.h = ServerHarness()
        cls.h.start()

    @classmethod
    def tearDownClass(cls):
        cls.h.stop()

    def test_index_and_content_type(self):
        status, headers, body = self.h.request("/")
        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/html"))
        self.assertIn(b"ok", body)

    def test_css_and_js_mime(self):
        status, headers, _ = self.h.request("/app.css")
        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/css"))

        status, headers, _ = self.h.request("/three.module.js")
        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/javascript"))

    def test_security_headers_present(self):
        _, headers, _ = self.h.request("/")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("Content-Security-Policy", headers)

    def test_unknown_extension_rejected(self):
        status, _, _ = self.h.request("/notes.md")
        self.assertEqual(status, 404)

    def test_traversal_rejected(self):
        for path in [
            "/../secret.txt",
            "/..%2fsecret.txt",
            "/%2e%2e/secret.txt",
            "/%2e%2e%2fsecret.txt",
            "/....//secret.txt",
            "/public/../secret.txt",
        ]:
            status, _, body = self.h.request(path)
            self.assertEqual(status, 404, f"{path} -> {status}")
            self.assertNotIn(b"TOPSECRET", body)

    def test_backslash_and_nul_rejected(self):
        for path in ["/..\\secret.txt", "/%00", "/app.css%00.png", "/%5c%5c"]:
            status, _, _ = self.h.request(path)
            self.assertEqual(status, 404, f"{path} -> {status}")

    def test_dotfiles_rejected(self):
        for path in ["/.env", "/.hidden", "/.git/config"]:
            status, _, body = self.h.request(path)
            self.assertEqual(status, 404)
            self.assertNotIn(b"SECRET", body)

    def test_symlink_escape_rejected(self):
        if not self.h.symlink_ok:
            self.skipTest("symlinks unavailable")
        status, _, body = self.h.request("/escape.txt")
        self.assertEqual(status, 404)
        self.assertNotIn(b"TOPSECRET", body)

    def test_directory_listing_absent(self):
        status, _, _ = self.h.request("/")
        self.assertEqual(status, 200)
        # No listing markup even though there is no index directory request.
        status2, _, body2 = self.h.request("/styles/")
        self.assertEqual(status2, 404)
        self.assertNotIn(b"Directory", body2)

    def test_write_methods_rejected(self):
        for method in ["POST", "PUT", "DELETE", "PATCH"]:
            status, _, _ = self.h.request("/index.html", method=method)
            self.assertEqual(status, 405, f"{method} -> {status}")

    def test_head_has_no_body(self):
        status, headers, body = self.h.request("/index.html", method="HEAD")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"")
        self.assertGreater(int(headers["Content-Length"]), 0)


class TestBindConflict(unittest.TestCase):
    def test_busy_port_raises(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            sock.listen(1)
            port = sock.getsockname()[1]
            with self.assertRaises(OSError):
                serve.AutumnHTTPServer(
                    ("127.0.0.1", port),
                    serve.Handler,
                    public_dir=Path(serve.DEFAULT_PUBLIC_DIR),
                    quiet=True,
                )


if __name__ == "__main__":
    unittest.main()
