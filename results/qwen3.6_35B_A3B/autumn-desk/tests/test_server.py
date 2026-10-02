#!/usr/bin/env python3
"""Tests for Autumn Desk server."""

import http.client
import os
import signal
import subprocess
import sys
import time
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SERVER_SCRIPT = PROJECT_ROOT / "scripts" / "server.py"
ENV_FILE = PROJECT_ROOT / ".env"
PID_FILE = PROJECT_ROOT / ".server.pid"

HOST = "127.0.0.1"
PORT = 14173


def ensure_env():
    """Create .env for testing."""
    env_content = f"HOST={HOST}\nPORT={PORT}\n"
    ENV_FILE.write_text(env_content, encoding="utf-8")


def start_server():
    """Start the server as a subprocess."""
    ensure_env()
    proc = subprocess.Popen(
        [sys.executable, str(SERVER_SCRIPT)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=str(PROJECT_ROOT),
    )
    time.sleep(1.5)
    return proc


def stop_server(proc):
    """Stop the server subprocess."""
    if proc and proc.poll() is None:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
    if PID_FILE.exists():
        PID_FILE.unlink(missing_ok=True)


def make_request(path, method="GET"):
    """Make an HTTP request to the server."""
    conn = http.client.HTTPConnection(HOST, PORT, timeout=5)
    conn.request(method, path)
    response = conn.getresponse()
    body = response.read()
    conn.close()
    return response.status, response.getheaders(), body


class TestServerStartup(unittest.TestCase):
    """Test server start/stop/restart functionality."""

    @classmethod
    def setUpClass(cls):
        cls.server_proc = start_server()

    @classmethod
    def tearDownClass(cls):
        stop_server(cls.server_proc)

    def test_01_server_starts(self):
        """Server should start and respond to requests."""
        status, _, _ = make_request("/")
        self.assertEqual(status, 200)

    def test_02_server_pid_file(self):
        """PID file should exist when server is running."""
        self.assertTrue(PID_FILE.exists())


class TestPublicFiles(unittest.TestCase):
    """Test that public files are served correctly."""

    @classmethod
    def setUpClass(cls):
        cls.server_proc = start_server()

    @classmethod
    def tearDownClass(cls):
        stop_server(cls.server_proc)

    def test_01_index_html(self):
        """index.html should be served with correct MIME type."""
        status, headers, body = make_request("/index.html")
        self.assertEqual(status, 200)
        content_type = dict(headers).get("Content-Type", "")
        self.assertIn("text/html", content_type)

    def test_02_main_js(self):
        """main.js should be served with correct MIME type."""
        status, headers, _ = make_request("/main.js")
        self.assertEqual(status, 200)
        content_type = dict(headers).get("Content-Type", "")
        self.assertIn("javascript", content_type)

    def test_03_styles_css(self):
        """styles.css should be served with correct MIME type."""
        status, headers, _ = make_request("/styles.css")
        self.assertEqual(status, 200)
        content_type = dict(headers).get("Content-Type", "")
        self.assertIn("text/css", content_type)

    def test_04_three_module_js(self):
        """three.module.js should be served."""
        status, headers, _ = make_request("/vendor/three.module.js")
        self.assertEqual(status, 200)
        content_type = dict(headers).get("Content-Type", "")
        self.assertIn("javascript", content_type)

    def test_05_head_request(self):
        """HEAD request should work."""
        status, _, body = make_request("/index.html", method="HEAD")
        self.assertEqual(status, 200)
        self.assertEqual(len(body), 0)


class TestSecurity(unittest.TestCase):
    """Test security: traversal, hidden files, etc."""

    @classmethod
    def setUpClass(cls):
        cls.server_proc = start_server()

    @classmethod
    def tearDownClass(cls):
        stop_server(cls.server_proc)

    def test_01_traversal_path(self):
        """Parent directory traversal should be blocked."""
        status, _, _ = make_request("/../scripts/server.py")
        self.assertEqual(status, 404)

    def test_02_encoded_traversal(self):
        """URL-encoded traversal should be blocked."""
        status, _, _ = make_request("/..%2F..%2Fscripts%2Fserver.py")
        self.assertEqual(status, 404)

    def test_03_hidden_file(self):
        """Hidden files should be blocked."""
        status, _, _ = make_request("/.env")
        self.assertEqual(status, 404)

    def test_04_hidden_dir_file(self):
        """Files in hidden directories should be blocked."""
        status, _, _ = make_request("/.gitignore")
        self.assertEqual(status, 404)

    def test_05_nonexistent_file(self):
        """Nonexistent file should return 404."""
        status, _, _ = make_request("/nonexistent.html")
        self.assertEqual(status, 404)

    def test_06_env_file_not_in_public(self):
        """.env should not be accessible from public URL."""
        status, _, _ = make_request("/.env")
        self.assertEqual(status, 404)


class TestAutonomy(unittest.TestCase):
    """Test offline autonomy: no external URLs in served files."""

    @classmethod
    def setUpClass(cls):
        cls.server_proc = start_server()

    @classmethod
    def tearDownClass(cls):
        stop_server(cls.server_proc)

    def test_01_no_cdn_urls(self):
        """Served JS files should not reference external CDNs."""
        status, _, body = make_request("/main.js")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        cdn_patterns = [
            "cdn.jsdelivr.net",
            "unpkg.com",
            "cdnjs.cloudflare.com",
            "unpkg.com",
        ]
        for pattern in cdn_patterns:
            self.assertNotIn(pattern, text, f"Found CDN reference: {pattern}")

    def test_02_local_three_import(self):
        """Three.js should be imported from local vendor path."""
        status, _, body = make_request("/main.js")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn("./vendor/three.module.js", text)

    def test_03_no_external_images(self):
        """No external image URLs in HTML."""
        status, _, body = make_request("/index.html")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertNotIn("http", text)


class TestConfig(unittest.TestCase):
    """Test configuration handling."""

    def test_invalid_port(self):
        """Server should reject invalid PORT."""
        ENV_FILE.write_text("HOST=127.0.0.1\nPORT=abc\n", encoding="utf-8")
        proc = subprocess.Popen(
            [sys.executable, str(SERVER_SCRIPT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(PROJECT_ROOT),
        )
        proc.wait(timeout=3)
        stderr = proc.stderr.read().decode("utf-8")
        self.assertIn("integer", stderr)
        proc.stderr.close()

    def test_port_out_of_range(self):
        """Server should reject PORT out of range."""
        ENV_FILE.write_text("HOST=127.0.0.1\nPORT=99999\n", encoding="utf-8")
        proc = subprocess.Popen(
            [sys.executable, str(SERVER_SCRIPT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(PROJECT_ROOT),
        )
        proc.wait(timeout=3)
        stderr = proc.stderr.read().decode("utf-8")
        self.assertIn("65535", stderr)

    def test_invalid_host(self):
        """Server should reject invalid HOST."""
        ENV_FILE.write_text("HOST=<>invalid\nPORT=14174\n", encoding="utf-8")
        proc = subprocess.Popen(
            [sys.executable, str(SERVER_SCRIPT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(PROJECT_ROOT),
        )
        proc.wait(timeout=3)
        stderr = proc.stderr.read().decode("utf-8")
        self.assertIn("Invalid HOST", stderr)

    def test_default_port(self):
        """Default PORT should be 4173."""
        if ENV_FILE.exists():
            ENV_FILE.unlink()
        # Check default in server code
        server_code = SERVER_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"4173"', server_code)


class TestInteractiveObjects(unittest.TestCase):
    """Test that interactive objects are defined in main.js."""

    @classmethod
    def setUpClass(cls):
        cls.server_proc = start_server()

    @classmethod
    def tearDownClass(cls):
        stop_server(cls.server_proc)

    def test_01_window_interactive(self):
        """Window should be an interactive object."""
        status, _, body = make_request("/main.js")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn('"window"', text)
        self.assertIn('userData.interactive', text)

    def test_02_laptop_interactive(self):
        """Laptop should be an interactive object."""
        status, _, body = make_request("/main.js")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn('"laptop"', text)

    def test_03_notebook_interactive(self):
        """Notebook should be an interactive object."""
        status, _, body = make_request("/main.js")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn('"notebook"', text)

    def test_04_calendar_interactive(self):
        """Calendar should be an interactive object."""
        status, _, body = make_request("/main.js")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn('"calendar"', text)

    def test_05_camera_focus(self):
        """Camera focus/retarget system should exist."""
        status, _, body = make_request("/main.js")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn("focusPos", text)
        self.assertIn("focusTarget", text)
        self.assertIn("lerpVectors", text)

    def test_06_focus_return_home(self):
        """Return to home camera position should exist."""
        status, _, body = make_request("/main.js")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn("returnHome", text)
        self.assertIn("homePos", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
