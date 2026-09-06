#!/usr/bin/env python3
"""Deterministic package assembly only; never invokes upstream or native code."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile

root = Path(__file__).resolve().parent
source = root / 'source'
output = Path(sys.argv[1]).resolve()
helper = 'native/macos/bin/dsh-computer-use-helper'
files = []
for path in sorted(source.rglob('*')):
    if path.is_symlink():
        raise ValueError(f'Symlink is not permitted: {path}')
    if path.is_file():
        rel = path.relative_to(source).as_posix()
        data = path.read_bytes()
        mode = 0o755 if rel == helper else 0o644
        if rel == helper and path.stat().st_mode & 0o777 != 0o755:
            raise ValueError('Native helper executable mode changed')
        files.append({'path': rel, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'mode': oct(mode)})

upstream = json.loads((root / 'UPSTREAM.json').read_text())
source_digest = hashlib.sha256(json.dumps(files, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
provenance = {
    'schemaVersion': 1,
    'catalogId': 3061,
    'sourceRepository': upstream['sourceRepository'],
    'sourceRevision': upstream['sourceRevision'],
    'sourceArchive': upstream['sourceArchive'],
    'sourceDigest': source_digest,
    'files': files,
    'validationScope': 'Static completeness and isolated schema fixtures only; no DSH/native execution.',
}
(root / 'PROVENANCE.json').write_text(json.dumps(provenance, indent=2) + '\n')
buffer = io.BytesIO()
with tarfile.open(fileobj=buffer, mode='w', format=tarfile.USTAR_FORMAT) as tar:
    entries = [(f['path'], source / f['path'], int(f['mode'], 8)) for f in files]
    entries += [(f, root / f, 0o644) for f in ['UPSTREAM.json', 'DEPENDENCIES.json', 'PROVENANCE.json']]
    for name, path, mode in sorted(entries):
        data = path.read_bytes()
        info = tarfile.TarInfo('package/' + name)
        info.mode, info.mtime, info.uid, info.gid = mode, 0, 0, 0
        info.uname = info.gname = ''
        info.size = len(data)
        tar.addfile(info, io.BytesIO(data))
output.parent.mkdir(parents=True, exist_ok=True)
with output.open('wb') as f:
    with gzip.GzipFile(filename='', mode='wb', fileobj=f, mtime=0, compresslevel=9) as gz:
        gz.write(buffer.getvalue())
data = output.read_bytes()
pkg = json.loads((source / 'package.json').read_text())
print(json.dumps({'catalogId': 3061, 'packageName': pkg['name'], 'version': pkg['version'], 'artifactPath': str(output), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'sourceDigest': source_digest, 'files': len(files)}))
