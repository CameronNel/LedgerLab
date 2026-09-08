#!/usr/bin/env python3
"""Verify a generated LedgerLab source ZIP, including a rebuild outside Git."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile


def verify(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise AssertionError('Duplicate archive member names')
        for name in names:
            relative = Path(name)
            if relative.is_absolute() or '..' in relative.parts or relative.parts[0] != 'LedgerLab':
                raise AssertionError(f'Unsafe archive path: {name}')
            if any(part in {'.git', 'node_modules', 'dist', '.next', '.wrangler', '.sites-runtime',
                            '__pycache__', 'output', 'outputs', 'coverage', 'work'} for part in relative.parts):
                raise AssertionError(f'Non-source path: {name}')
            if relative.name.startswith('.env') or name.endswith(('.pem', '.key', '.tsbuildinfo', '.pyc')):
                raise AssertionError(f'Excluded file: {name}')
            if name.endswith('.sh') and (archive.getinfo(name).external_attr >> 16) & 0o777 != 0o755:
                raise AssertionError(f'Non-executable shell member: {name}')
        manifest_name = 'LedgerLab/SOURCE-MANIFEST.json'
        manifest = json.loads(archive.read(manifest_name))
        assert manifest['format'] == 'LedgerLab source package'
        entries = manifest['files']
        assert len(entries) == len(names) - 1
        assert {f'LedgerLab/{entry["path"]}' for entry in entries} == set(names) - {manifest_name}
        for entry in entries:
            data = archive.read('LedgerLab/' + entry['path'])
            assert len(data) == entry['bytes'], entry['path']
            assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
        return len(entries)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', nargs='?', default='public/offline/ledgerlab-source-code.zip')
    args = parser.parse_args()
    path = Path(args.archive).resolve()
    count = verify(path)
    with tempfile.TemporaryDirectory(prefix='ledgerlab-archive-check-') as temp:
        with zipfile.ZipFile(path) as archive:
            archive.extractall(temp)  # Member paths were checked before extraction.
        root = Path(temp) / 'LedgerLab'
        assert not (root / '.git').exists()
        # An unrelated local export must not enter a package rebuilt from the manifest.
        (root / 'unrelated-local-practice.json').write_text('{"fixture":true}')
        subprocess.run([sys.executable, 'scripts/accounting/package-source.py'], cwd=root, check=True)
        rebuilt = root / 'public/offline/ledgerlab-source-code.zip'
        assert verify(rebuilt) == count
        assert path.read_bytes() == rebuilt.read_bytes(), 'Manifest-only rebuild must be byte-for-byte reproducible'
    print(f'PASS: {count} source files, unique paths, complete SHA-256 manifest, source-only inventory, executable shell modes, and identical ZIP rebuild without Git.')


if __name__ == '__main__':
    main()
