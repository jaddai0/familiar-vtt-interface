#!/usr/bin/env python3
"""Build a deterministic, allowlisted Foundry module archive."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
FILES = ('scripts/main.mjs', 'scripts/preferences.mjs', 'styles/tokens.css',
         'styles/familiar-vtt-interface.css', 'LICENSE', 'INSTALL.md')

def build(output, manifest_url=None, download_url=None):
    if bool(manifest_url) != bool(download_url):
        raise ValueError('Supply both --manifest-url and --download-url, or neither for manual installation.')
    for url in (manifest_url, download_url):
        if url:
            parsed = urlparse(url)
            if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
                raise ValueError('Public release URLs must be HTTPS and contain no credentials.')
    manifest = json.loads((ROOT / 'module.json').read_text())
    if manifest_url:
        manifest.update(manifest=manifest_url, download=download_url)
    else:
        manifest.pop('manifest', None)
        manifest.pop('download', None)
    payload = {'module.json': (json.dumps(manifest, indent=2) + '\n').encode()}
    for name in FILES:
        source = ROOT / name
        if source.is_symlink():
            raise ValueError(f'Refusing symlink: {name}')
        payload[name] = source.read_bytes()
    for name in manifest['esmodules'] + manifest['styles'] + [manifest['license']]:
        if name not in payload:
            raise ValueError(f'Missing required package file: {name}')
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f"{manifest['id']}-{manifest['version']}.zip"
    with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as package:
        for name, data in sorted(payload.items()):
            info = ZipInfo(f"{manifest['id']}/{name}", date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            package.writestr(info, data)
    (output / 'module.json').write_bytes(payload['module.json'])
    hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (archive, output / 'module.json')}
    (output / 'SHA256SUMS.txt').write_text(''.join(f'{digest}  {name}\n' for name, digest in hashes.items()))
    with ZipFile(archive) as package:
        assert package.testzip() is None
        assert len(package.namelist()) == len(payload)
    return archive

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--manifest-url')
    parser.add_argument('--download-url')
    args = parser.parse_args()
    print(build(args.output.resolve(), args.manifest_url, args.download_url))
