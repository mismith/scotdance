"""Build the ChatGPT plugin upload (python3 submission/package.py): checked, and nothing but the package."""
from pathlib import Path
import json
import struct
import zipfile

root = Path(__file__).resolve().parent
source = root / 'package'
manifest = json.loads((source / 'plugin.json').read_text())
mcp = json.loads((source / 'mcp.json').read_text())
settings = manifest['extensions']['com.openai']
interface = settings['interface']
review = settings['review']
assert len(interface['displayName']) <= 30
assert len(interface['shortDescription']) <= 30
assert len(interface['longDescription']) <= 4000
assert len(interface['defaultPrompt']) <= 3 and all(len(p) <= 128 for p in interface['defaultPrompt'])
assert len(review['test_cases']['positive']) == 5
assert len(review['test_cases']['negative']) == 3
assert not manifest.get('apps') and not settings.get('apps')
assert mcp['mcpServers']['scotdance']['url'] == 'https://next.scotdance.app/mcp'
files = sorted(p for p in source.rglob('*') if p.is_file())
assert [p.relative_to(source).as_posix() for p in files] == ['assets/icon.png', 'mcp.json', 'plugin.json']
assert not any(p.is_symlink() for p in source.rglob('*'))
icon = (source / interface['logo']).read_bytes()
assert icon[:8] == b'\x89PNG\r\n\x1a\n'
assert struct.unpack('>II', icon[16:24]) == (512, 512)
assert len(icon) < 5 * 1024 * 1024
archive = root / f"scotdance-organisers-{manifest['version']}.zip"
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as out:
    for path in files:
        out.write(path, path.relative_to(source))
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
    assert json.loads(check.read('plugin.json')) == manifest
print(f'Prepared {archive}')
if not review['demo_recording_url']:
    print('Still needed before submitting to ChatGPT: demo_recording_url (docs/mcp-store-submission.md)')
