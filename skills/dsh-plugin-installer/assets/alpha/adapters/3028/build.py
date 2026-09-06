#!/usr/bin/env python3
"""Build the reviewed Attention Badge adaptation without dependencies or scripts."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parent


def verified_files(folder, expected):
    actual = {p.relative_to(folder).as_posix() for p in folder.rglob('*') if p.is_file()}
    if actual != set(expected):
        raise ValueError(f'Unexpected source inventory: {folder}')
    result = {}
    for name, identity in expected.items():
        path = folder / name
        if path.is_symlink() or path.resolve().parent != (folder / name).absolute().parent:
            raise ValueError(f'Unsafe source path: {name}')
        data = path.read_bytes()
        if len(data) != identity['bytes'] or hashlib.sha256(data).hexdigest() != identity['sha256']:
            raise ValueError(f'Source identity changed: {name}')
        result[name] = data
    return result


def build():
    provenance_bytes = (ROOT / 'PROVENANCE.json').read_bytes()
    provenance = json.loads(provenance_bytes)
    verified_files(ROOT / 'original', provenance['originalFiles'])
    files = verified_files(ROOT / 'source', provenance['adaptedFiles'])
    package = json.loads(files['package.json'])
    if package.get('scripts') or package.get('dependencies') or package.get('optionalDependencies'):
        raise ValueError('This adaptation must remain a dependency-free package')
    files['PROVENANCE.json'] = provenance_bytes
    buffer = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=buffer, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.USTAR_FORMAT) as archive:
            for name, data in sorted(files.items()):
                entry = tarfile.TarInfo('package/' + name)
                entry.size = len(data)
                entry.mode = 0o644
                entry.mtime = 0
                archive.addfile(entry, io.BytesIO(data))
    data = buffer.getvalue()
    digest = hashlib.sha256(data).hexdigest()
    output = ROOT.parent.parent / 'artifacts' / f'{digest}.tgz'
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(data)
    return {
        'catalogId': 3028,
        'path': f'assets/alpha/artifacts/{digest}.tgz',
        'sha256': digest,
        'bytes': len(data),
        'packageName': package['name'],
        'packageVersion': package['version'],
        'sourcePath': 'assets/alpha/adapters/3028/PROVENANCE.json',
        'sourceDigest': hashlib.sha256(provenance_bytes).hexdigest(),
        'runtimeDependencies': {},
        'runtimeStatus': 'pending',
    }


if __name__ == '__main__':
    print(json.dumps(build(), indent=2))
