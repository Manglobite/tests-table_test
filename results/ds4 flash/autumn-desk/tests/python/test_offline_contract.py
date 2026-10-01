"""Guards for the offline / privacy contract of the shipped app.

These run without a browser and enforce that:
  * the vendored Three.js module is present and is the expected local build;
  * the HTML references only same-origin, relative assets;
  * no first-party JS performs network requests or uses browser storage.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
VENDOR = PUBLIC / "vendor" / "three" / "three.module.js"

STORAGE_PATTERNS = [
    r"localStorage",
    r"sessionStorage",
    r"document\.cookie",
    r"indexedDB",
    r"navigator\.sendBeacon",
    r"new\s+WebSocket",
    r"XMLHttpRequest",
    r"\bfetch\s*\(",
]

NETWORK_URL = re.compile(r"https?://", re.IGNORECASE)


def first_party_js():
    files = []
    for path in (PUBLIC / "js").rglob("*.js"):
        files.append(path)
    return files


class TestVendoredThree(unittest.TestCase):
    def test_library_present(self):
        self.assertTrue(VENDOR.is_file(), "vendored three.module.js missing")

    def test_matches_source_library(self):
        source = ROOT.parent / "tree_js" / "package" / "build" / "three.module.js"
        if not source.is_file():
            self.skipTest("source library not present")
        self.assertEqual(
            VENDOR.read_bytes(),
            source.read_bytes(),
            "vendored copy drifted from tree_js/package/build/three.module.js",
        )

    def test_is_real_three_build(self):
        head = VENDOR.read_text(encoding="utf-8", errors="ignore")[:4000]
        self.assertIn("REVISION", head)


class TestHTMLOffline(unittest.TestCase):
    def test_no_external_urls(self):
        html = (PUBLIC / "index.html").read_text(encoding="utf-8")
        for match in NETWORK_URL.finditer(html):
            self.fail(f"external URL in index.html: {html[match.start():match.start()+60]}")

    def test_assets_are_relative(self):
        html = (PUBLIC / "index.html").read_text(encoding="utf-8")
        for attr in re.findall(r'(?:src|href)="([^"]+)"', html):
            if attr.startswith("data:"):
                continue
            self.assertTrue(
                attr.startswith("./") or attr.startswith("/"),
                f"non-relative asset reference: {attr}",
            )


class TestJSPrivacy(unittest.TestCase):
    def test_no_storage_or_network_apis(self):
        for path in first_party_js():
            source = path.read_text(encoding="utf-8")
            for pattern in STORAGE_PATTERNS:
                self.assertIsNone(
                    re.search(pattern, source),
                    f"{path.relative_to(ROOT)} uses forbidden API /{pattern}/",
                )

    def test_no_external_urls_in_js(self):
        for path in first_party_js():
            source = path.read_text(encoding="utf-8")
            match = NETWORK_URL.search(source)
            if match:
                self.fail(
                    f"{path.relative_to(ROOT)} contains external URL: "
                    f"{source[match.start():match.start()+60]}"
                )

    def test_three_import_is_local(self):
        shim = (PUBLIC / "js" / "core" / "three-import.js").read_text(encoding="utf-8")
        self.assertIn("../../vendor/three/three.module.js", shim)
        self.assertNotIn("http", shim.lower())


if __name__ == "__main__":
    unittest.main()
