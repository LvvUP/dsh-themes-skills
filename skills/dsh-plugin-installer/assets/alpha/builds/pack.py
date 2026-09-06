#!/usr/bin/env python3
"""Create a deterministic tarball from an already built and reviewed package."""
import argparse
import gzip
import hashlib
import io
import json
import pathlib
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('--package', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
root = pathlib.Path(args.package).resolve()
manifest = json.loads((root / 'package.json').read_text())
if manifest.get('scripts'):
    raise ValueError('Reviewed distribution packages must not contain lifecycle scripts.')
files = sorted(root.rglob('*'))
if any(file.is_symlink() for file in files):
    raise ValueError('Distribution packages must not contain symlinks.')
stream = io.BytesIO()
with gzip.GzipFile(filename='', mode='wb', fileobj=stream, mtime=0) as compressed:
    with tarfile.open(fileobj=compressed, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for file in files:
            if not file.is_file():
                continue
            data = file.read_bytes()
            entry = tarfile.TarInfo('package/' + file.relative_to(root).as_posix())
            entry.size = len(data)
            entry.mode = 0o644
            entry.mtime = 0
            archive.addfile(entry, io.BytesIO(data))
data = stream.getvalue()
digest = hashlib.sha256(data).hexdigest()
output = pathlib.Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
(output / (digest + '.tgz')).write_bytes(data)
print(json.dumps({'path': 'assets/alpha/artifacts/' + digest + '.tgz', 'sha256': digest, 'bytes': len(data), 'packageVersion': manifest['version'], 'runtimeDependencies': {**manifest.get('dependencies', {}), **manifest.get('optionalDependencies', {})}}, indent=2))
