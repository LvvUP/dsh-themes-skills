#!/usr/bin/env python3
"""Rebuild the small Alpha API adaptations from verified original package files."""
import gzip
import hashlib
import io
import json
import pathlib
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f'Expected one source occurrence: {old}')
    return text.replace(old, new)

def build(catalog_id):
    folder = ROOT / str(catalog_id)
    provenance = json.loads((folder / 'PROVENANCE.json').read_text())
    files = {}
    for name, digest in provenance['files'].items():
        data = (folder / 'original' / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError(f'Original source changed: {name}')
        files[name] = data
    package = json.loads(files['package.json'])
    package['version'] += '-dsh.alpha.1'
    package.pop('scripts', None)
    package.pop('devDependencies', None)
    client = package.get('dsh', {}).get('client', {})
    if 'inject' in client:
        client['inject'] = [name for name in client['inject'] if name != '@deepseek-ai/dsh-client-runtime']
    package['files'] = sorted(set(package.get('files', [])) | {'PROVENANCE.json', 'NOTICE', 'LICENSE.deepseek'})
    for name in package.get('peerDependencies', {}):
        if name.startswith('@deepseek-ai/dsh-'):
            package['peerDependencies'][name] = '0.1.3-alpha.1'
    files['package.json'] = (json.dumps(package, indent=2) + '\n').encode()
    if catalog_id == 3012:
        client = files['lib/client.js'].decode()
        client = replace_once(client, 'let _client_runtime = require("@deepseek-ai/dsh-client-runtime/client");', '''// Alpha session/surface predicate; MIT, Copyright (c) 2026 DeepSeek.
        const _client_runtime = { isAppendSurfaceEvent(event) {
          return ['user/message', 'assistant/message', 'tool/result'].includes(event.type)
            && event.surfaceOp === 'append';
        } };''')
        files['lib/client.js'] = client.encode()
    elif catalog_id == 3041:
        host = files['lib/index.js'].decode()
        host = replace_once(host, "import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'", '// Settings are registered through the Alpha provider instance below.')
        host = replace_once(host, "const NS = settingsNamespace('context-vista')", "const NS = 'context-vista'")
        if host.count('.optional()') != 3:
            raise ValueError('Unexpected optional pricing-field schema count')
        host = host.replace('.optional()', '.required(false)')
        host = replace_once(host, '  installSettingsSection(ctx, NS, Config, entry, {', "  ctx.inject(['settings'], (settingsCtx) => {\n  settingsCtx.settings.installSection(ctx, NS, Config, entry, {")
        host = replace_once(host, '  // ---- push the resolved pricing to the web client ----', '  })\n\n  // ---- push the resolved pricing to the web client ----')
        files['lib/index.js'] = host.encode()
    elif catalog_id == 3065:
        host = files['lib/settings.js'].decode()
        host = replace_once(host, "import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';", '// Register through the Alpha settings provider instance below.')
        host = replace_once(host, "settingsNamespace('turn-rewind')", "'turn-rewind'")
        host = replace_once(host, '    installSettingsSection(ctx, TURN_REWIND_SETTINGS_NAMESPACE, TurnRewindSettingsSchema, source(), {', "    ctx.inject(['settings'], (settingsCtx) => {\n    settingsCtx.settings.installSection(ctx, TURN_REWIND_SETTINGS_NAMESPACE, TurnRewindSettingsSchema, source(), {")
        suffix = '    });\n}\n'
        if not host.endswith(suffix):
            raise ValueError('Unexpected Turn Rewind settings function suffix')
        host = host[:-len(suffix)] + '    });\n    });\n}\n'
        files['lib/settings.js'] = host.encode()
    else:
        raise ValueError(f'Unknown adaptation: {catalog_id}')
    files['PROVENANCE.json'] = (folder / 'PROVENANCE.json').read_bytes()
    files['LICENSE.deepseek'] = (folder / 'LICENSE.deepseek').read_bytes()
    files['NOTICE'] = (f'Alpha API adaptation by DSH Themes contributors. Original package and license retained.\nSource: https://github.com/{provenance["sourceRepository"]}/tree/{provenance["sourceRevision"]}\n' + '\n'.join(provenance['changes']) + '\n').encode()
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
    output = ROOT.parent / 'artifacts' / f'{digest}.tgz'
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(data)
    return {'catalogId': catalog_id, 'path': f'assets/alpha/artifacts/{digest}.tgz', 'sha256': digest, 'bytes': len(data), 'packageVersion': package['version'], 'sourcePath': f'assets/alpha/adapters/{catalog_id}/PROVENANCE.json', 'runtimeDependencies': {**package.get('dependencies', {}), **package.get('optionalDependencies', {})}}

if __name__ == '__main__':
    print(json.dumps([build(3012), build(3041), build(3065)], indent=2))
