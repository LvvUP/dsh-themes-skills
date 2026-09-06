#!/usr/bin/env python3
"""Apply small, enumerated API migrations to immutable upstream archives."""
import gzip
import hashlib
import io
import json
import pathlib
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent
SKILL = ROOT.parents[2]

def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError(f'Unexpected source occurrence: {before}')
    return text.replace(before, after)

def build(recipe):
    catalog_id = recipe['catalogId']
    base = SKILL / recipe['baseArtifact']['path']
    data = base.read_bytes()
    if hashlib.sha256(data).hexdigest() != recipe['baseArtifact']['sha256']:
        raise ValueError('Original archive digest mismatch')
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive.getmembers():
            parts = pathlib.PurePosixPath(member.name).parts
            if member.isdir():
                continue
            if not member.isfile() or len(parts) < 2 or '..' in parts or member.name.startswith('/'):
                raise ValueError('Unsafe archive member')
            files['/'.join(parts[1:])] = archive.extractfile(member).read()
    manifest = json.loads(files['package.json'])
    if manifest['name'] != recipe['packageName']:
        raise ValueError('Package identity mismatch')
    manifest['version'] += '-dsh.alpha.1'
    manifest.pop('scripts', None)
    manifest.pop('devDependencies', None)
    client = manifest.get('dsh', {}).get('client', {})
    if 'inject' in client:
        client['inject'] = [name for name in client['inject'] if name != '@deepseek-ai/dsh-client-runtime']
    for name in manifest.get('peerDependencies', {}):
        if name.startswith('@deepseek-ai/dsh-'):
            manifest['peerDependencies'][name] = '0.1.3-alpha.1'
    if catalog_id == 3021:
        expected = {'tsdown': '^0.22.14', 'typescript': '^7.0.0', 'zod': '^4.4.3', '@deepseek-ai/dsh-subprocess': '0.1.2-rc.1'}
        if manifest.pop('dependencies', {}) != expected:
            raise ValueError('Re-review changed MCP Panel dependencies')
        for name, data in files.items():
            if name.startswith('lib/') and name.endswith(('.js', '.mjs')):
                for module in ['tsdown', 'typescript', 'zod']:
                    for quote in ['"', "'"]:
                        if f'from {quote}{module}{quote}' in data.decode() or f'require({quote}{module}{quote})' in data.decode():
                            raise ValueError('Required unbundled dependency')
        manifest.setdefault('peerDependencies', {})['@deepseek-ai/dsh-subprocess'] = '0.1.3-alpha.1'
    if catalog_id == 3076:
        text = files['lib/harness-compat.js'].decode()
        text = replace_once(text, "Symbol.for('dsh.subagent.queuePrompt')", "Symbol.for('dsh.subagent.deliverPrompt')")
        if text.count('return queue.call(runtime, parent, childId, content, source, signal);') != 2:
            raise ValueError('Re-review host delivery calls')
        text = text.replace('return queue.call(runtime, parent, childId, content, source, signal);', "return queue.call(runtime, parent, childId, content, source, signal, 'queue');", 1)
        text = replace_once(text, 'const guardedQueue = async (parent, childId, content, source, signal) => {', 'const guardedQueue = async (parent, childId, content, source, signal, delivery) => {')
        text = replace_once(text, 'return queue.call(runtime, parent, childId, content, source, signal);', 'return queue.call(runtime, parent, childId, content, source, signal, delivery);')
        files['lib/harness-compat.js'] = text.encode()
    if catalog_id == 3018:
        if manifest.pop('dependencies', {}) != {'@deepseek-ai/dsh-atomic-write': '0.1.0-rc.6'}:
            raise ValueError('Re-review Builtin Toggles dependencies')
        manifest.setdefault('peerDependencies', {})['@deepseek-ai/dsh-atomic-write'] = '0.1.3-alpha.1'
    if catalog_id in [3004, 3073, 3098, 3117]:
        changes = 0
        for name, data in list(files.items()):
            if name.startswith('lib/') and name.endswith(('.js', '.mjs')) and '/types/' not in name:
                text = data.decode()
                for quote in ['"', "'"]:
                    before = f'from {quote}schemastery{quote}'
                    changes += text.count(before)
                    text = text.replace(before, f'from {quote}@deepseek-ai/schemastery{quote}')
                files[name] = text.encode()
        if changes < 1:
            raise ValueError('Missing expected schemastery imports')
    if catalog_id == 3071:
        text = files['lib/client.js'].decode()
        text = replace_once(text,
            'let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");',
            'const _deepseek_ai_dsh_client_runtime_client = { conversationContextKey(kind, id) { return `${kind.length}:${kind}${id}`; } };')
        files['lib/client.js'] = text.encode()
    if catalog_id == 3098:
        text = files['lib/client.js'].decode()
        text = replace_once(text, 'require("@deepseek-ai/dsh-client-runtime/client")', 'require("@deepseek-ai/dsh-client-store")')
        files['lib/client.js'] = text.encode()
        text = files['lib/settings.js'].decode()
        text = replace_once(text, "import { settingsNamespace } from '@deepseek-ai/dsh-settings';", '// The Alpha settings namespace is the same persisted string.')
        files['lib/settings.js'] = replace_once(text, "settingsNamespace('interpreters')", "'interpreters'").encode()
    if catalog_id == 3073:
        text = files['lib/index.js'].decode()
        text = replace_once(text, 'import { settingsNamespace } from "@deepseek-ai/dsh-settings";', '// The Alpha settings namespace is the same persisted string.')
        files['lib/index.js'] = replace_once(text, 'settingsNamespace("ya-subagent")', '"ya-subagent"').encode()
    if catalog_id == 3073:
        text = files['lib/client.js'].decode()
        text = replace_once(text, 'ctx.effect(() => ctx.slots.register({\n\t\t\t\tname: "tool.call.toolview",', 'ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({\n\t\t\t\tname: "tool.call.toolview",')
        files['lib/client.js'] = replace_once(text, '}, SubagentCard), "ya-subagent: subagent toolview");', '}, SubagentCard));').encode()
    if catalog_id == 3095:
        text = files['lib/client.js'].decode()
        files['lib/client.js'] = replace_once(text, 'id: "@dsh-external/dsh-sentinel"', 'id: "dsh-sentinel"').encode()
    if catalog_id in [3083, 3119]:
        text = files['lib/index.js'].decode()
        before = 'export const inject = ["systemPrompt"];' if catalog_id == 3083 else "export const inject = ['systemPrompt'];"
        files['lib/index.js'] = replace_once(text, before, 'export const inject = ["systemPrompt", "shellEnv"];').encode()
    if catalog_id == 3094:
        text = files['lib/index.js'].decode()
        files['lib/index.js'] = replace_once(text,
            'import { BlockAssembler, createUserMessage, deepFreeze } from "@deepseek-ai/dsh-llm";',
            'import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";\nimport { deepFreeze } from "@deepseek-ai/dsh-util-values";').encode()
    if catalog_id == 3115:
        text = files['lib/index.mjs'].decode()
        text = replace_once(text, 'import { settingsNamespace } from "@deepseek-ai/dsh-settings";', '// The Alpha namespace remains the original string.')
        files['lib/index.mjs'] = replace_once(text, 'settingsNamespace("dsh-loop")', '"dsh-loop"').encode()
    files['ALPHA-ADAPTATION.json'] = (json.dumps(recipe, indent=2) + '\n').encode()
    files['NOTICE.alpha'] = ('Alpha adaptation by DSH Themes contributors. Original archive, license, source coordinates, and enumerated changes are retained in ALPHA-ADAPTATION.json.\n' + '\n'.join(recipe['changes']) + '\n').encode()
    if catalog_id == 3071:
        files['LICENSE.deepseek'] = (ROOT / '3012/LICENSE.deepseek').read_bytes()
        files['NOTICE.alpha'] += b'conversationContextKey is from the MIT-licensed DeepSeek Alpha source d347e703908d0406b7a7ef80e3a0e594d86b2215, packages/client/ui-conversation/src/client/contract/conversation.ts.\n'
    manifest['files'] = sorted(set(manifest.get('files', [])) | {'ALPHA-ADAPTATION.json', 'NOTICE.alpha', 'LICENSE.deepseek'})
    files['package.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, filename='', mtime=0, mode='wb') as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.USTAR_FORMAT) as archive:
            for name, data in sorted(files.items()):
                entry = tarfile.TarInfo('package/' + name)
                entry.size = len(data)
                entry.mode = 0o644
                archive.addfile(entry, io.BytesIO(data))
    data = buffer.getvalue()
    digest = hashlib.sha256(data).hexdigest()
    artifact_path = f'assets/alpha/artifacts/{digest}.tgz'
    (SKILL / artifact_path).write_bytes(data)
    return {'catalogId': catalog_id, 'path': artifact_path, 'sha256': digest, 'bytes': len(data), 'packageVersion': manifest['version'], 'runtimeDependencies': {**manifest.get('dependencies', {}), **manifest.get('optionalDependencies', {})}, 'sourcePath': 'assets/alpha/adapters/alpha-api-patches.json'}

if __name__ == '__main__':
    print(json.dumps([build(recipe) for recipe in json.loads((ROOT / 'alpha-api-patches.json').read_text())], indent=2))
