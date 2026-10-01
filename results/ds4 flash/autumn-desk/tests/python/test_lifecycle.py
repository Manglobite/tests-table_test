"""End-to-end tests for the server lifecycle (server/manage.sh).

Exercises the real start/stop/restart flow, HOST/PORT handling, invalid
configuration and the "port already in use" guard.  Everything runs against
an ephemeral loopback port so it never touches the machine's normal port.
"""

import http.client
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANAGE = ROOT / "server" / "manage.sh"

# Isolated runtime dir so a server the user has running is never disturbed.
_RUNTIME = tempfile.TemporaryDirectory(prefix="autumn-desk-test-")
PID_FILE = Path(_RUNTIME.name) / "server.pid"
LOG_FILE = Path(_RUNTIME.name) / "server.log"
LOCK_DIR = Path(_RUNTIME.name) / ".manage.lock"


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def run_manage(action, extra_env=None, timeout=30):
    env = os.environ.copy()
    env["HOST"] = "127.0.0.1"
    env["AUTUMN_PID_FILE"] = str(PID_FILE)
    env["AUTUMN_LOG_FILE"] = str(LOG_FILE)
    env["AUTUMN_LOCK_DIR"] = str(LOCK_DIR)
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        ["bash", str(MANAGE), action],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def wait_for_http(port, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
            conn.request("GET", "/")
            res = conn.getresponse()
            res.read()
            conn.close()
            if res.status == 200:
                return True
        except OSError:
            time.sleep(0.2)
    return False


@unittest.skipUnless(MANAGE.is_file(), "manage.sh missing")
class TestLifecycle(unittest.TestCase):
    def setUp(self):
        self.port = free_port()
        self.env = {"PORT": str(self.port), "HOST": "127.0.0.1"}
        # Make sure we start clean.
        run_manage("stop", self.env)
        try:
            PID_FILE.unlink()
        except FileNotFoundError:
            pass

    def tearDown(self):
        # Use the same port for the final stop, then clear any left-over file.
        run_manage("stop", {"HOST": "127.0.0.1"})
        if PID_FILE.exists():
            PID_FILE.unlink()

    def test_start_serve_stop(self):
        res = run_manage("run", self.env)
        self.assertEqual(res.returncode, 0, res.stderr + res.stdout)
        self.assertTrue(PID_FILE.is_file(), "pid file not written")
        self.assertTrue(wait_for_http(self.port), "server did not answer")

        res = run_manage("status", self.env)
        self.assertEqual(res.returncode, 0)
        self.assertIn("running", res.stdout)

        res = run_manage("stop", self.env)
        self.assertEqual(res.returncode, 0)
        self.assertFalse(PID_FILE.exists(), "pid file not removed")

    def test_start_is_idempotent(self):
        first = run_manage("run", self.env)
        self.assertEqual(first.returncode, 0)
        pid1 = PID_FILE.read_text().strip()
        second = run_manage("run", self.env)
        self.assertEqual(second.returncode, 0)
        self.assertIn("already running", second.stdout)
        pid2 = PID_FILE.read_text().strip()
        self.assertEqual(pid1, pid2, "second run replaced a live server")

    def test_restart_replaces_process(self):
        run_manage("run", self.env)
        pid1 = PID_FILE.read_text().strip()
        res = run_manage("restart", self.env)
        self.assertEqual(res.returncode, 0, res.stderr + res.stdout)
        pid2 = PID_FILE.read_text().strip()
        self.assertNotEqual(pid1, pid2, "restart did not start a new process")
        self.assertTrue(wait_for_http(self.port))

    def test_port_in_use_is_refused_without_killing_owner(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as holder:
            holder.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            holder.bind(("127.0.0.1", self.port))
            holder.listen(1)
            res = run_manage("run", self.env)
            self.assertNotEqual(res.returncode, 0)
            combined = res.stdout + res.stderr
            self.assertIn("in use", combined)
            self.assertFalse(PID_FILE.exists())

    def test_invalid_port_is_rejected(self):
        res = run_manage("run", {"PORT": "not-a-number", "HOST": "127.0.0.1"})
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("configuration", (res.stdout + res.stderr).lower())
        self.assertFalse(PID_FILE.exists())

    def test_stop_without_run_is_safe(self):
        res = run_manage("stop", self.env)
        self.assertEqual(res.returncode, 0)


if __name__ == "__main__":
    unittest.main()
