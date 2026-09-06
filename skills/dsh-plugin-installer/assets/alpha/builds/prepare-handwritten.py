#!/usr/bin/env python3
"""Prepare pinned native JavaScript plugins for the provided Alpha host."""
import argparse
import hashlib
import json
import pathlib

parser = argparse.ArgumentParser()
parser.add_argument('--catalog-id', type=int, choices=[3048, 3111], required=True)
parser.add_argument('--out', type=pathlib.Path, required=True)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent / str(args.catalog_id) / 'source'
source = json.loads((root / 'SOURCE.json').read_text())
for name, digest in source['files'].items():
    data = (root / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f'Source drift: {name}')
    output = args.out / name
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)
manifest = json.loads((root / 'package.json').read_text())
dependencies = manifest.pop('dependencies', {})
if dependencies != {'@deepseek-ai/schemastery': '^3.18.1'}:
    raise ValueError('Re-review changed runtime dependencies')
manifest.setdefault('peerDependencies', {})['@deepseek-ai/schemastery'] = '^3.18.1'
for name in manifest['peerDependencies']:
    if name.startswith('@deepseek-ai/dsh-'):
        manifest['peerDependencies'][name] = '0.1.3-alpha.1'
manifest['version'] += '-dsh.alpha.1'
manifest.pop('scripts', None)
manifest.pop('devDependencies', None)
manifest['files'] = sorted(set(manifest.get('files', [])) | {'SOURCE.json', 'NOTICE.alpha'})
(args.out / 'package.json').write_text(json.dumps(manifest, indent=2) + '\n')
(args.out / 'SOURCE.json').write_bytes((root / 'SOURCE.json').read_bytes())
(args.out / 'NOTICE.alpha').write_text('Packaging adaptation by DSH Themes contributors. Original JavaScript, declared license, and source bytes are preserved. The existing @deepseek-ai/schemastery dependency is provided by the fixed Alpha host; host peer versions identify that runtime. SOURCE.json records the upstream files and their digests. Optional image conversion/browser tools still require their documented local dependencies.\n')
print('Native JavaScript package prepared; runtime verification remains required.')
