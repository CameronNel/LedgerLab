#!/usr/bin/env python3
"""Package known project source without dependencies, cache files or credentials.

Use Git's inventory in a checkout, or the package manifest in an extracted archive.
Never recursively scoop arbitrary files or local practice exports into a source ZIP.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parents[2]
output = root / 'public/offline/ledgerlab-source-code.zip'
output.parent.mkdir(parents=True, exist_ok=True)


def source_names():
    try:
        checkout = subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=root,
                                  capture_output=True, text=True, check=False)
    except FileNotFoundError:
        checkout = None
    if checkout and checkout.returncode == 0 and Path(checkout.stdout.strip()).resolve() == root:
        listed = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
                                cwd=root, capture_output=True, check=True)
        return listed.stdout.decode().split('\0')
    # A distributed source archive deliberately has no .git directory. Its manifest
    # provides an explicit inventory rather than copying unrelated personal files.
    manifest_path = root / 'SOURCE-MANIFEST.json'
    if not manifest_path.is_file():
        raise SystemExit('Source inventory unavailable. Use the complete source ZIP, or initialise a Git checkout.')
    manifest = json.loads(manifest_path.read_text())
    if not isinstance(manifest, dict) or manifest.get('format') != 'LedgerLab source package' or not isinstance(manifest.get('files'), list):
        raise SystemExit('Invalid source manifest. Re-extract the complete source package.')
    names = []
    for item in manifest['files']:
        if not isinstance(item, dict) or not isinstance(item.get('path'), str):
            raise SystemExit('Invalid source manifest entry.')
        names.append(item['path'])
    return names


files = []
for name in sorted(set(source_names())):
    relative = Path(name)
    if not name or name == 'SOURCE-MANIFEST.json' or relative.is_absolute() or '..' in relative.parts:
        continue
    path = root / name
    if path == output or path.is_symlink() or not path.is_file():
        continue
    if any(part in {'.git', 'node_modules', 'dist', '.next', '.wrangler', '.sites-runtime',
                    '__pycache__', 'output', 'outputs', 'coverage', 'work'} for part in relative.parts):
        continue
    if relative.name.startswith('.env') or name.endswith(('.pem', '.key', '.tsbuildinfo', '.pyc')):
        continue
    if not path.resolve().is_relative_to(root):
        continue
    files.append((name, path.read_bytes()))

manifest = {'format': 'LedgerLab source package', 'files': [
    {'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in files]}
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in [*files, ('SOURCE-MANIFEST.json', json.dumps(manifest, indent=2).encode())]:
        info = zipfile.ZipInfo('LedgerLab/' + name, date_time=(2025, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        archive.writestr(info, data, compresslevel=9)
print(f'Packaged {len(files)} project files: {output.name}')
