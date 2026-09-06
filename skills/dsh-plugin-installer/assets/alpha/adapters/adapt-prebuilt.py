#!/usr/bin/env python3
"""Adapt complete, hash-pinned compiled archives without upstream lifecycle execution."""
import pathlib,json,hashlib,tarfile,io,gzip,re,sys
here=pathlib.Path(__file__).resolve().parent
catalog_id=int(sys.argv[1]);archive_path=pathlib.Path(sys.argv[2]);output=pathlib.Path(sys.argv[3]);output.mkdir(parents=True,exist_ok=True)
recipe=next(r for r in json.loads((here/'prebuilt-next.json').read_text()) if r['catalogId']==catalog_id)
data=archive_path.read_bytes()
if len(data)!=recipe['bytes'] or hashlib.sha256(data).hexdigest()!=recipe['sha256']:raise ValueError('Fixed source archive mismatch')
files={}
with tarfile.open(fileobj=io.BytesIO(data)) as archive:
 for member in archive:
  if member.isdir():continue
  parts=pathlib.PurePosixPath(member.name).parts
  if not member.isfile() or len(parts)<2 or '..' in parts or member.name.startswith('/'):raise ValueError('Unsafe archive member')
  name='/'.join(parts[1:])
  # Retain complete source, package entry files and documentation; omit upstream QA screenshots and generated source maps.
  if name.startswith(('.git/','node_modules/','tests/','test/')) or name.endswith('.map'):continue
  files[name]=archive.extractfile(member).read()
manifest=json.loads(files['package.json'])
if manifest['name']!=recipe['packageName']:raise ValueError('Package identity mismatch')
if catalog_id==3050:
 if manifest['dependencies']!={'luxon':'^3.7.2','zod':'^4.1.5'}:raise ValueError('Re-review Automation dependencies')
 for name,data in files.items():
  if name.startswith('lib/') and name.endswith(('.js','.mjs')):
   text=data.decode()
   if re.search(r'''(?:from\s*|require\s*\(|import\s*\()\s*["'](?:luxon|zod)(?:/[^"']*)?["']''',text):raise ValueError('Unbundled dependency')
 manifest.pop('dependencies')
 changed=0
 for name,data in list(files.items()):
  if name.startswith(('lib/','src/')) and name.endswith(('.js','.ts')):
   text=data.decode(); count=len(re.findall(r'\b(?:handle\.agent|agent)\.session\.events\b',text));changed+=count if name=='lib/index.js' else 0
   files[name]=re.sub(r'\b((?:handle\.agent|agent)\.session)\.events\b',r'\1.snapshotEvents()',text).encode()
 if changed!=2:raise ValueError('Re-review live session reads')
if catalog_id==3091:
 for name in ['lib/advisor/index.js','src/advisor/index.js']:
  if name in files:
   text=files[name].decode();before='observer.handleEvent(session.id, session.events, event)'
   if text.count(before)!=1:raise ValueError('Re-review Memory Evolve session observer')
   files[name]=text.replace(before,'observer.handleEvent(session.id, session.snapshotEvents(), event)').encode()
 probes={'notifications/unread':'notifyEnabled','coi/config':'coiEnabled','broadcast/messages':'broadcastEnabled','ui-settings/state':'uiSettingsEnabled','prompts/sources':'promptsEnabled','bookmarks/state':'bookmarkEnabled','canvas/state':'canvasEnabled'}
 helper="""
  // Read authoritative feature flags before probing routes that do not exist while disabled.
  const memoryInitialConfig = fetch('/memory-evolve/api/config').then(response => {
    if (!response.ok) throw new Error('Memory Evolve configuration HTTP ' + response.status);
    return response.json();
  }).then(body => body.config);
  function fetchEnabledMemoryModule(flag, url) {
    return memoryInitialConfig.then(config => {
      if (config?.[flag] !== true) throw new Error('Memory Evolve module is disabled: ' + flag);
      return fetch(url);
    });
  }
"""
 for name,entry,quote in [('lib/client.js','function apply(ctx) {','"'),('src/client/index.ts','export function apply(ctx: Context): void {',"'")]:
  text=files[name].decode()
  if text.count(entry)!=1:raise ValueError('Re-review Memory Evolve browser lifecycle')
  local=helper if name.startswith('lib/') else helper.replace('fetchEnabledMemoryModule(flag, url)','fetchEnabledMemoryModule(flag: string, url: string)')
  text=text.replace(entry,entry+local)
  for suffix,flag in probes.items():
   before='void fetch('+quote+'/memory-evolve/api/'+suffix+quote+')'
   if text.count(before)!=1:raise ValueError('Re-review optional Memory Evolve probe '+suffix)
   text=text.replace(before,'void fetchEnabledMemoryModule('+quote+flag+quote+', '+quote+'/memory-evolve/api/'+suffix+quote+')')
  files[name]=text.encode()
for key in ['scripts','devDependencies','packageManager']:manifest.pop(key,None)
manifest['version']+='-dsh.alpha.1'
client=manifest.get('dsh',{}).get('client',{})
if 'inject' in client:client['inject']=[x for x in client['inject'] if x!='@deepseek-ai/dsh-client-runtime']
for name in manifest.get('peerDependencies',{}):
 if name.startswith('@deepseek-ai/dsh-'):manifest['peerDependencies'][name]='0.1.3-alpha.1'
files['package.json']=(json.dumps(manifest,indent=2)+'\n').encode()
files['ALPHA-ADAPTATION.json']=(json.dumps(recipe,indent=2)+'\n').encode()
files['NOTICE.alpha']=('Adaptation by DSH Themes contributors. Original author, source and license retained.\n'+'\n'.join(recipe['changes'])+'\n').encode()
buffer=io.BytesIO()
with gzip.GzipFile(fileobj=buffer,mode='wb',filename='',mtime=0) as gz:
 with tarfile.open(fileobj=gz,mode='w',format=tarfile.USTAR_FORMAT) as tar:
  for name,data in sorted(files.items()):
   member=tarfile.TarInfo('package/'+name);member.size=len(data);member.mode=0o644;tar.addfile(member,io.BytesIO(data))
data=buffer.getvalue();digest=hashlib.sha256(data).hexdigest();(output/(digest+'.tgz')).write_bytes(data)
print(json.dumps({'catalogId':catalog_id,'path':'assets/alpha/artifacts/'+digest+'.tgz','sha256':digest,'bytes':len(data),'packageVersion':manifest['version'],'runtimeDependencies':{**manifest.get('dependencies',{}),**manifest.get('optionalDependencies',{})},'sourcePath':'assets/alpha/adapters/prebuilt-next.json'},indent=2))
