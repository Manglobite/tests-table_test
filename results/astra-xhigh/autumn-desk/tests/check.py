import ast
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
for path in root.rglob('*.py'):
    ast.parse(path.read_text(), filename=str(path))
for path in (root / 'public' / 'js').glob('*.js'):
    text = path.read_text()
    assert not re.search(r'https?://|\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon', text), path
    for target in re.findall(r"from ['\"]([^'\"]+)['\"]", text):
        assert target.startswith('.') and (path.parent / target).resolve().is_relative_to(root / 'public')
        assert (path.parent / target).is_file(), target
source = root.parent / 'tree_js/package/build/three.module.js'
if source.is_file():
    assert source.read_bytes() == (root / 'public/tree_js/package/build/three.module.js').read_bytes()
else:
    print('  -- tree_js недоступен для сверки (vendored-копия присутствует)')
print('Python syntax, local module graph, offline/privacy checks, Three.js identity: OK')
