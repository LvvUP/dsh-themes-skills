#!/usr/bin/env python3
"""Rebuild the ten DSH Themes community adaptation archives without dependencies.
Run with --check for an exact digest check, or --write for pending candidates.
Requires Python 3.9+. Does not install plugins or promote runtime authority.
"""
import argparse,gzip,hashlib,io,json,pathlib,tarfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write',action='store_true')
parser.add_argument('--check',action='store_true')
parser.add_argument('--ids',default='2301,2302,2303,2304,2305,2308,2309,2310,2311,2312')
args=parser.parse_args()
if args.write==args.check:parser.error('Choose --check or --write')
ids={int(x) for x in args.ids.split(',')}
if not ids.issubset({2301,2302,2303,2304,2305,2308,2309,2310,2311,2312}):parser.error('Unexpected catalog IDs')
catalogpath=ROOT/'references/community-recipes.json';catalog=json.loads(catalogpath.read_text())
for item in catalog['items']:
 if item['catalogId'] not in ids:continue
 source=(ROOT/item['adaptation']['sourcePath']).resolve()
 if ROOT not in source.parents:raise ValueError('Source outside Skill')
 pkg=json.loads((source/'package.json').read_text())
 if pkg['name']!=item['packageName'] or pkg['version']!=item['packageVersion']:raise ValueError('Package identity differs')
 buffer=io.BytesIO()
 with tarfile.open(fileobj=buffer,mode='w') as archive:
  for file in sorted(source.rglob('*')):
   if file.is_symlink():raise ValueError('Symlink in package source')
   if not file.is_file():continue
   payload=file.read_bytes();info=tarfile.TarInfo('package/'+file.relative_to(source).as_posix());info.size=len(payload);info.mode=0o644;info.mtime=0
   archive.addfile(info,io.BytesIO(payload))
 payload=gzip.compress(buffer.getvalue(),mtime=0);digest=hashlib.sha256(payload).hexdigest();artifact=ROOT/'assets/alpha/artifacts'/f'{digest}.tgz'
 if args.check:
  if digest!=item['artifact']['sha256'] or not artifact.exists() or artifact.read_bytes()!=payload:raise ValueError(f"#{item['catalogId']} archive differs")
 else:
  if digest!=item['artifact']['sha256'] and item['validation']['status']=='runtime-verified':raise ValueError('Demote and retain the previous receipt before changing a verified archive')
  artifact.write_bytes(payload);item['artifact']={'path':artifact.relative_to(ROOT).as_posix(),'sha256':digest}
 print(item['catalogId'],digest,len(payload))
if args.write:catalogpath.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
