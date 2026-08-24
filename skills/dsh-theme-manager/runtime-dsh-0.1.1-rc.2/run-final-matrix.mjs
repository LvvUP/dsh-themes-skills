#!/usr/bin/env node

import { spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import {
  EXPECTED_BASELINE,
  EXPECTED_GITHUB_WORKFLOW_REF,
  EXPECTED_LIFECYCLE_COMMAND_SEQUENCE,
  EXPECTED_LIFECYCLE_PROBE,
  EXPECTED_LIFECYCLE_WEB_SEQUENCE,
  EXPECTED_MATRIX,
  EXPECTED_NEGATIVE_EVIDENCE_CASES,
  EXPECTED_SOURCE_COMMIT,
  EXPECTED_THEME_PREFERENCES,
  buildNegativeCandidateFixture,
  loadFinalContracts,
  runtimeDir,
  sha256,
  validateFinalContractOffline,
  validateOfficialTarballs,
  validatePinnedOfficialSources,
} from '../scripts/rc2-final-contract.mjs';

const localRuntimeDir = dirname(fileURLToPath(import.meta.url));
if (resolve(localRuntimeDir) !== resolve(runtimeDir)) {
  throw new Error('final runner is outside the pinned RC.2 runtime');
}

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_COMMAND_OUTPUT_BYTES = 4 * 1024 * 1024;
const SHA = /^[a-f0-9]{40}$/;
const DIGITS = /^\d+$/;
const SAFE_RUNNER_IMAGE_ID = /^[\x20-\x7e]{1,128}$/;
const localBin = resolve(localRuntimeDir, 'node_modules/.bin');
const pnpmBin = resolve(localRuntimeDir, 'node_modules/pnpm/bin/pnpm.cjs');
const candidatePath = resolve(
  localRuntimeDir,
  '../references/dsh-0.1.1-rc.2.candidate.json'
);
const candidateValidator = resolve(
  localRuntimeDir,
  '../scripts/validate-baseline-candidate.mjs'
);

function fail(message) {
  throw new Error(`RC.2 final matrix refused: ${message}`);
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null || values.has(key)) {
      fail(
        'usage: run-final-matrix.mjs --receipt <absolute-json> --expected-platform <platform> --expected-node <version>'
      );
    }
    values.set(key, value);
  }
  if (
    values.size !== 3 ||
    !values.has('--receipt') ||
    !values.has('--expected-platform') ||
    !values.has('--expected-node')
  ) {
    fail(
      'usage: run-final-matrix.mjs --receipt <absolute-json> --expected-platform <platform> --expected-node <version>'
    );
  }
  const receiptPath = values.get('--receipt');
  if (!isAbsolute(receiptPath)) fail('receipt path must be absolute');
  return {
    receiptPath: resolve(receiptPath),
    expectedPlatform: values.get('--expected-platform'),
    expectedNode: values.get('--expected-node'),
  };
}

function githubEnvironment() {
  const environment = {
    githubActions: process.env.GITHUB_ACTIONS,
    repository: process.env.GITHUB_REPOSITORY,
    serverUrl: process.env.GITHUB_SERVER_URL,
    workflow: process.env.GITHUB_WORKFLOW,
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    job: process.env.GITHUB_JOB,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
    runnerOs: process.env.RUNNER_OS,
    runnerArch: process.env.RUNNER_ARCH,
    imageOs: process.env.ImageOS,
    imageVersion: process.env.ImageVersion,
  };
  if (
    environment.githubActions !== 'true' ||
    environment.repository !== 'LvvUP/dsh-themes-skills' ||
    environment.serverUrl !== 'https://github.com' ||
    environment.workflow !== 'RC.2 final baseline certification' ||
    environment.workflowRef !== EXPECTED_GITHUB_WORKFLOW_REF ||
    !DIGITS.test(environment.runId ?? '') ||
    !DIGITS.test(environment.runAttempt ?? '') ||
    environment.job !== 'certify' ||
    !SHA.test(environment.sha ?? '') ||
    environment.ref !== 'refs/heads/main' ||
    typeof environment.runnerOs !== 'string' ||
    environment.runnerOs.length === 0 ||
    typeof environment.runnerArch !== 'string' ||
    environment.runnerArch.length === 0 ||
    !SAFE_RUNNER_IMAGE_ID.test(environment.imageOs ?? '') ||
    !SAFE_RUNNER_IMAGE_ID.test(environment.imageVersion ?? '')
  ) {
    fail('final receipts may be issued only by the pinned GitHub Actions workflow');
  }
  return {
    provider: 'github-actions',
    repository: environment.repository,
    serverUrl: environment.serverUrl,
    workflow: environment.workflow,
    workflowRef: environment.workflowRef,
    runId: environment.runId,
    runAttempt: environment.runAttempt,
    runUrl: `${environment.serverUrl}/${environment.repository}/actions/runs/${environment.runId}/attempts/${environment.runAttempt}`,
    job: environment.job,
    ref: environment.ref,
    headSha: environment.sha,
    runnerOs: environment.runnerOs,
    runnerArch: environment.runnerArch,
    imageOs: environment.imageOs,
    imageVersion: environment.imageVersion,
  };
}

async function writeReceipt(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise((done) => child.once('exit', done)),
    new Promise((done) => setTimeout(done, timeoutMs)),
  ]);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await waitForExit(child, 5_000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await waitForExit(child, 5_000);
  }
}

async function fetchBounded(url, expectedStatus = 200) {
  let response;
  try {
    response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    fail(
      `request failed for ${url}: ${error instanceof Error ? error.name : 'unknown error'}`
    );
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RESPONSE_BYTES
  ) {
    fail(`response exceeds byte limit: ${url}`);
  }
  const chunks = [];
  let total = 0;
  if (!response.body) fail(`response has no body: ${url}`);
  try {
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > MAX_RESPONSE_BYTES) {
        fail(`response exceeds byte limit: ${url}`);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    fail(
      `response body failed for ${url}: ${error instanceof Error ? error.name : 'unknown error'}`
    );
  }
  const bytes = Buffer.concat(chunks);
  if (response.status !== expectedStatus) {
    fail(`expected ${expectedStatus} from ${url}, received ${response.status}`);
  }
  return { response, bytes };
}

async function mapLimited(items, limit, mapper) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        output[index] = await mapper(items[index], index);
      }
    })
  );
  return output;
}

function canonicalDigest(rows) {
  return sha256(
    rows
      .map(
        (row) => `${row.id}\t${row.url}\t${row.bytes}\t${row.sha256}\n`
      )
      .join('')
  );
}

function dshEnvironment(profileDir) {
  return {
    ...process.env,
    DSH_HOME: profileDir,
    DSH_TELEMETRY_DISABLED: '1',
    NO_COLOR: '1',
    PATH: `${localBin}${delimiter}${process.env.PATH ?? ''}`,
  };
}

async function runCaptured(executable, args, { cwd, env, timeoutMs = 120_000 }) {
  const child = spawn(executable, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = [];
  const stderr = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let exceeded = false;
  let timedOut = false;
  const collect = (target, chunk, stream) => {
    const bytes = Buffer.from(chunk);
    if (stream === 'stdout') stdoutBytes += bytes.length;
    else stderrBytes += bytes.length;
    if (stdoutBytes + stderrBytes > MAX_COMMAND_OUTPUT_BYTES) {
      exceeded = true;
      child.kill('SIGTERM');
      return;
    }
    target.push(bytes);
  };
  child.stdout.on('data', (chunk) => collect(stdout, chunk, 'stdout'));
  child.stderr.on('data', (chunk) => collect(stderr, chunk, 'stderr'));
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, timeoutMs);
  const exit = await new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => accept({ code, signal }));
  }).finally(() => clearTimeout(timeout));
  if (timedOut) fail(`command timed out: ${args[0] ?? executable}`);
  if (exceeded) fail(`command output exceeded byte limit: ${args[0] ?? executable}`);
  return {
    ...exit,
    stdout: Buffer.concat(stdout),
    stderr: Buffer.concat(stderr),
  };
}

function commandEvidence(id, argv, result) {
  return {
    id,
    argv,
    exitCode: result.code,
    signal: result.signal,
    stdoutBytes: result.stdout.length,
    stdoutSha256: sha256(result.stdout),
    stderrBytes: result.stderr.length,
    stderrSha256: sha256(result.stderr),
  };
}

async function runSuccessfulDshCommand(
  dshBin,
  profileDir,
  id,
  args,
  receiptArgs = args
) {
  const result = await runCaptured(process.execPath, [dshBin, ...args], {
    cwd: profileDir,
    env: dshEnvironment(profileDir),
  });
  if (result.code !== 0 || result.signal !== null) {
    fail(`lifecycle command failed: ${id}`);
  }
  return {
    result,
    evidence: commandEvidence(id, receiptArgs, result),
  };
}

function parsePluginList(bytes) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('plugin list did not return JSON');
  }
  if (!Array.isArray(value) || value.length !== 1) {
    fail('plugin list root differs from one isolated web profile');
  }
  const dependencies = value[0]?.dependencies ?? {};
  if (
    typeof dependencies !== 'object' ||
    dependencies === null ||
    Array.isArray(dependencies)
  ) {
    fail('plugin list dependencies are malformed');
  }
  return dependencies;
}

async function inspectProbeState(profileDir, label, listResult, expectedActive) {
  const profileRoot = resolve(profileDir, 'profiles/web');
  const profileManifestBytes = await readFile(
    resolve(profileRoot, 'package.json')
  );
  let lockfileBytes = null;
  try {
    lockfileBytes = await readFile(resolve(profileRoot, 'pnpm-lock.yaml'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const profileManifest = JSON.parse(profileManifestBytes.toString('utf8'));
  const listed = parsePluginList(listResult.stdout);
  const directThemeEntries = Object.entries(listed).filter(([name]) =>
    name.startsWith('@dsh-themes/')
  );
  const listedProbe = listed[EXPECTED_LIFECYCLE_PROBE.name];
  const dependencySpec = profileManifest.dependencies?.[
    EXPECTED_LIFECYCLE_PROBE.name
  ];
  const bundles = profileManifest.dsh?.profile?.bundles;
  const bundleIndexes = Array.isArray(bundles)
    ? bundles.flatMap((name, index) =>
        name === EXPECTED_LIFECYCLE_PROBE.name ? [index] : []
      )
    : [];
  let installedManifestBytes = null;
  try {
    installedManifestBytes = await readFile(
      resolve(
        profileRoot,
        'node_modules/@dsh-themes/rc2-lifecycle-probe/package.json'
      )
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const installedManifest = installedManifestBytes
    ? JSON.parse(installedManifestBytes.toString('utf8'))
    : null;
  if (expectedActive) {
    const checks = {
      directThemeCount: directThemeEntries.length,
      listedProbePresent: listedProbe !== undefined,
      listedVersionExact:
        listedProbe?.version === EXPECTED_LIFECYCLE_PROBE.version,
      dependencySpecString: typeof dependencySpec === 'string',
      dependencySpecFile:
        typeof dependencySpec === 'string' && dependencySpec.startsWith('file:'),
      dependencySpecTarball:
        typeof dependencySpec === 'string' && dependencySpec.endsWith('.tgz'),
      bundleIndexCount: bundleIndexes.length,
      installedManifestPresent: installedManifest !== null,
      installedNameExact:
        installedManifest?.name === EXPECTED_LIFECYCLE_PROBE.name,
      installedVersionExact:
        installedManifest?.version === EXPECTED_LIFECYCLE_PROBE.version,
    };
    if (
      checks.directThemeCount !== 1 ||
      !checks.listedVersionExact ||
      !checks.dependencySpecString ||
      !checks.dependencySpecFile ||
      !checks.dependencySpecTarball ||
      checks.bundleIndexCount !== 1 ||
      !checks.installedNameExact ||
      !checks.installedVersionExact
    ) {
      fail(
        `probe is not the one exact active profile dependency: ${label}; checks=${JSON.stringify(checks)}`
      );
    }
  } else if (
    directThemeEntries.length !== 0 ||
    listedProbe !== undefined ||
    dependencySpec !== undefined ||
    bundleIndexes.length !== 0 ||
    installedManifestBytes !== null
  ) {
    fail(`probe remained in the isolated profile after removal: ${label}`);
  }
  return {
    label,
    activePackage: expectedActive
      ? {
          name: EXPECTED_LIFECYCLE_PROBE.name,
          version: EXPECTED_LIFECYCLE_PROBE.version,
        }
      : null,
    directThemeCount: directThemeEntries.length,
    bundleIndex: expectedActive ? bundleIndexes[0] : null,
    dependencySpecSha256: expectedActive ? sha256(dependencySpec) : null,
    listStdoutSha256: sha256(listResult.stdout),
    profileManifestSha256: sha256(profileManifestBytes),
    lockfileSha256: lockfileBytes ? sha256(lockfileBytes) : null,
    installedManifestSha256: installedManifestBytes
      ? sha256(installedManifestBytes)
      : null,
  };
}

async function createLifecycleProbe(profileDir, contract) {
  const sourceDir = resolve(profileDir, 'certification-probe-source');
  const outputDir = resolve(profileDir, 'certification-probe-artifact');
  await Promise.all([
    mkdir(sourceDir, { recursive: true, mode: 0o700 }),
    mkdir(outputDir, { recursive: true, mode: 0o700 }),
  ]);
  const manifestBytes = Buffer.from(
    `${JSON.stringify(contract.probePackage.packageManifest, null, 2)}\n`
  );
  const patchBytes = Buffer.from(contract.probePackage.bundlePatch);
  await Promise.all([
    writeFile(resolve(sourceDir, 'package.json'), manifestBytes, { mode: 0o600 }),
    writeFile(resolve(sourceDir, 'cordis.patch.yml'), patchBytes, { mode: 0o600 }),
  ]);
  const pack = await runCaptured(
    process.execPath,
    [pnpmBin, 'pack', '--pack-destination', outputDir],
    {
      cwd: sourceDir,
      env: dshEnvironment(profileDir),
    }
  );
  if (pack.code !== 0 || pack.signal !== null) {
    fail('pinned pnpm could not build the isolated lifecycle probe');
  }
  const artifacts = (await readdir(outputDir)).filter((name) =>
    name.endsWith('.tgz')
  );
  if (artifacts.length !== 1) {
    fail('pinned pnpm did not produce one lifecycle probe tarball');
  }
  const path = resolve(outputDir, artifacts[0]);
  const artifactBytes = await readFile(path);
  if (artifactBytes.length === 0 || artifactBytes.length > 1024 * 1024) {
    fail('lifecycle probe tarball has an invalid byte size');
  }
  return {
    path,
    evidence: {
      package: {
        name: contract.probePackage.name,
        version: contract.probePackage.version,
      },
      packTool: contract.probePackage.packTool,
      packageManifestBytes: manifestBytes.length,
      packageManifestSha256: sha256(manifestBytes),
      bundlePatchBytes: patchBytes.length,
      bundlePatchSha256: sha256(patchBytes),
      artifactBytes: artifactBytes.length,
      artifactSha256: sha256(artifactBytes),
      packCommand: commandEvidence(
        'pack-probe',
        ['pnpm', 'pack', '--pack-destination', '<isolated-output>'],
        pack
      ),
    },
  };
}

async function runVersion(dshBin, profileDir) {
  const child = spawn(process.execPath, [dshBin, '--version'], {
    cwd: profileDir,
    env: {
      ...process.env,
      DSH_HOME: profileDir,
      DSH_TELEMETRY_DISABLED: '1',
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });
  const exit = await new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => accept({ code, signal }));
  });
  if (exit.code !== 0 || stdout.trim() !== '0.1.1-rc.2') {
    fail(`dsh --version failed (${exit.code ?? exit.signal})`);
  }
  return {
    stdout: stdout.trim(),
    stderrSha256: sha256(stderr),
  };
}

async function startAndInspectWeb(dshBin, profileDir, contracts) {
  const command = [
    process.execPath,
    dshBin,
    'web',
    '--host',
    '127.0.0.1',
    '--no-open',
    '--port',
    '0',
  ];
  let output = '';
  const child = spawn(command[0], command.slice(1), {
    cwd: profileDir,
    env: {
      ...process.env,
      DSH_HOME: profileDir,
      DSH_TELEMETRY_DISABLED: '1',
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const origin = await new Promise((accept, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('dsh web did not report its loopback URL')),
        45_000
      );
      const inspect = (chunk) => {
        output += chunk.toString('utf8');
        const match = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match) {
          clearTimeout(timeout);
          accept(match[1]);
        }
      };
      child.stdout.on('data', inspect);
      child.stderr.on('data', inspect);
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timeout);
        reject(new Error(`dsh web exited before readiness (${code ?? signal})`));
      });
    });
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.protocol !== 'http:' ||
      parsedOrigin.hostname !== '127.0.0.1' ||
      parsedOrigin.username ||
      parsedOrigin.password ||
      parsedOrigin.pathname !== '/'
    ) {
      fail('dsh web reported a non-loopback origin');
    }

    const root = await fetchBounded(`${origin}/`);
    const contentType = root.response.headers.get('content-type') ?? '';
    const contentSecurityPolicy = root.response.headers.get(
      'content-security-policy'
    );
    const html = root.bytes.toString('utf8');
    if (
      !contentType.toLowerCase().includes('text/html') ||
      !/<html[\s>]/i.test(html)
    ) {
      fail('root response is not HTML');
    }
    if (
      contentSecurityPolicy !==
      contracts.protocol.cspBoundary.expectedServedContentSecurityPolicy
    ) {
      fail('served CSP boundary differs from the pinned contract');
    }

    const bootstrapIndex = html.indexOf('window.__ModuleLoader__');
    const modulesPreloadIndex = html.indexOf(
      '/plugins/@deepseek-ai/dsh-client-modules/client.js'
    );
    const bootIndex = html.indexOf('globalThis["__DSH_BOOT__"]');
    const moduleEntryIndex = html.indexOf('<script type="module"');
    if (
      bootstrapIndex < 0 ||
      modulesPreloadIndex <= bootstrapIndex ||
      bootIndex <= modulesPreloadIndex ||
      moduleEntryIndex <= bootIndex
    ) {
      fail('IndexInjection order differs from the RC.2 boot contract');
    }

    const bootMatch =
      /globalThis\["__DSH_BOOT__"\] = (\{.*?\})<\/script>/s.exec(html);
    if (!bootMatch) fail('HTML does not contain a parseable __DSH_BOOT__ graph');
    const boot = JSON.parse(bootMatch[1]);
    if (
      typeof boot.rev !== 'string' ||
      !Array.isArray(boot.entries) ||
      boot.entries.length < 10 ||
      new Set(boot.entries.map((entry) => entry.id)).size !==
        boot.entries.length
    ) {
      fail('__DSH_BOOT__ graph is malformed or contains duplicate ids');
    }
    const requiredIds = [
      '@deepseek-ai/dsh-client-modules',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-renderer',
      '@deepseek-ai/dsh-client-ui-theme',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-conversation',
    ];
    if (
      requiredIds.some(
        (id) => boot.entries.filter((entry) => entry.id === id).length !== 1
      )
    ) {
      fail('__DSH_BOOT__ lacks one exact required client entry');
    }

    const bundles = await mapLimited(boot.entries, 6, async (entry) => {
      if (
        typeof entry.id !== 'string' ||
        typeof entry.url !== 'string' ||
        !entry.url.startsWith('/plugins/') ||
        !entry.url.includes('?rev=')
      ) {
        fail('boot graph contains a mutable or malformed bundle URL');
      }
      const result = await fetchBounded(new URL(entry.url, origin));
      const type = result.response.headers.get('content-type') ?? '';
      if (!/javascript/i.test(type)) {
        fail(`client bundle has the wrong MIME type: ${entry.id}`);
      }
      const text = result.bytes.toString('utf8');
      if (!text.includes('window.__ModuleLoader__.load({')) {
        fail(`client bundle is not a DSH module registration: ${entry.id}`);
      }
      return {
        id: entry.id,
        url: entry.url,
        bytes: result.bytes.length,
        sha256: sha256(result.bytes),
      };
    });
    bundles.sort((left, right) => left.id.localeCompare(right.id));

    const mainMatch =
      /<script type="module"[^>]* src="([^"]+)"[^>]*><\/script>/.exec(html);
    if (!mainMatch) fail('HTML lacks the Vite client entry');
    const main = await fetchBounded(new URL(mainMatch[1], origin));
    const mainType = main.response.headers.get('content-type') ?? '';
    const mainText = main.bytes.toString('utf8');
    const expectedMain = contracts.protocol.installedArtifacts.find(
      (entry) => entry.package === '@deepseek-ai/dsh-web-frontend'
    );
    if (
      !/javascript/i.test(mainType) ||
      main.bytes.length !== expectedMain.bytes ||
      sha256(main.bytes) !== expectedMain.sha256 ||
      !mainText.includes('__DSH_TRANSPORT__') ||
      !mainText.includes('loadBundle')
    ) {
      fail('served main entry differs from the optional transport contract');
    }

    const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)];
    if (styles.length < 2) fail('HTML lacks the expected official stylesheets');
    const stylesheetResults = await mapLimited(styles, 4, async (match) => {
      const result = await fetchBounded(new URL(match[1], origin));
      if (
        !(result.response.headers.get('content-type') ?? '')
          .toLowerCase()
          .includes('text/css')
      ) {
        fail(`stylesheet has the wrong MIME type: ${match[1]}`);
      }
      return {
        url: match[1],
        bytes: result.bytes.length,
        sha256: sha256(result.bytes),
      };
    });

    const missingAsset = await fetchBounded(
      `${origin}/assets/__dsh_themes_rc2_missing__.js`,
      404
    );
    const missingRoute = await fetchBounded(
      `${origin}/__dsh_themes_rc2_missing__/nested`,
      404
    );
    for (const missing of [missingAsset, missingRoute]) {
      if (
        missing.bytes.length !== 0 ||
        (missing.response.headers.get('content-type') ?? '')
          .toLowerCase()
          .includes('text/html')
      ) {
        fail('a missing static path returned an HTML SPA fallback');
      }
    }

    return {
      command: ['web', '--host', '127.0.0.1', '--no-open', '--port', '0'],
      root: {
        status: root.response.status,
        contentType,
        bytes: root.bytes.length,
        sha256: sha256(root.bytes),
      },
      indexInjection: {
        order: [
          'module-loader-queue',
          'parser-preload',
          '__DSH_BOOT__',
          'vite-module-entry',
        ],
        status: 'passed',
      },
      bootGraph: {
        rev: boot.rev,
        entries: boot.entries.length,
        requiredIds,
        bundleSetAlgorithm: 'sorted-id-tab-url-tab-bytes-tab-sha256-lf',
        bundleSetSha256: canonicalDigest(bundles),
      },
      transport: {
        optionalGlobal: '__DSH_TRANSPORT__',
        loadBundleBranchPresent: true,
        servedMode: 'http-websocket-default',
        explicitTransportExecution: 'not-exercised-by-served-web',
      },
      assets: {
        main: {
          url: mainMatch[1],
          bytes: main.bytes.length,
          sha256: sha256(main.bytes),
          contentType: mainType,
        },
        stylesheets: stylesheetResults,
      },
      static404: {
        missingAsset: { status: 404, bytes: missingAsset.bytes.length },
        missingRoute: { status: 404, bytes: missingRoute.bytes.length },
        htmlFallback: false,
      },
      csp: {
        responseHeader: contentSecurityPolicy,
        schemasteryNewFunctionPresent: true,
        strictCspCompatibilityClaimed: false,
      },
      serverOutputSha256: sha256(output),
    };
  } finally {
    await stopChild(child);
  }
}

async function writeThemePreference(profileDir, preference) {
  if (!EXPECTED_THEME_PREFERENCES.includes(preference)) {
    fail(`unsupported lifecycle theme preference: ${preference}`);
  }
  const bytes = Buffer.from(`ui-theme:\n  preference: ${preference}\n`);
  const path = resolve(profileDir, 'settings.yaml');
  await writeFile(path, bytes, { mode: 0o600 });
  const readback = await readFile(path);
  if (!readback.equals(bytes)) {
    fail(`theme preference did not persist exactly: ${preference}`);
  }
  return { bytes: readback.length, sha256: sha256(readback) };
}

function executeThemeBootstrap(script, systemDark) {
  let bodyDarkAttribute = null;
  const document = {
    documentElement: { style: {} },
    body: {
      toggleAttribute(name, enabled) {
        if (name !== 'data-ds-dark-theme' || typeof enabled !== 'boolean') {
          fail('theme bootstrap wrote an unexpected body attribute');
        }
        bodyDarkAttribute = enabled;
      },
    },
  };
  runInNewContext(
    script,
    {
      document,
      matchMedia: (query) => {
        if (query !== '(prefers-color-scheme: dark)') {
          fail('theme bootstrap queried an unexpected media feature');
        }
        return { matches: systemDark };
      },
    },
    {
      timeout: 1_000,
      contextCodeGeneration: { strings: false, wasm: false },
    }
  );
  const colorScheme = document.documentElement.style.colorScheme;
  if (
    !['light', 'dark'].includes(colorScheme) ||
    bodyDarkAttribute !== (colorScheme === 'dark')
  ) {
    fail('theme bootstrap execution produced an invalid palette state');
  }
  return { systemDark, colorScheme, bodyDarkAttribute };
}

async function startLifecycleWeb(
  dshBin,
  profileDir,
  { id, preference, expectedProbeActive }
) {
  const profileManifestBytes = await readFile(
    resolve(profileDir, 'profiles/web/package.json')
  );
  const profileManifest = JSON.parse(profileManifestBytes.toString('utf8'));
  const probeBundles = (profileManifest.dsh?.profile?.bundles ?? []).filter(
    (name) => name === EXPECTED_LIFECYCLE_PROBE.name
  );
  const probeDependency =
    profileManifest.dependencies?.[EXPECTED_LIFECYCLE_PROBE.name];
  if (
    expectedProbeActive !==
      (probeBundles.length === 1 && typeof probeDependency === 'string')
  ) {
    fail(`lifecycle launch profile state differs before ${id}`);
  }
  const command = [
    process.execPath,
    dshBin,
    'web',
    '--host',
    '127.0.0.1',
    '--no-open',
    '--port',
    '0',
  ];
  let output = '';
  let outputExceeded = false;
  const child = spawn(command[0], command.slice(1), {
    cwd: profileDir,
    env: dshEnvironment(profileDir),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const inspect = (chunk) => {
    output += chunk.toString('utf8');
    if (Buffer.byteLength(output) > MAX_COMMAND_OUTPUT_BYTES) {
      outputExceeded = true;
      child.kill('SIGTERM');
    }
  };
  child.stdout.on('data', inspect);
  child.stderr.on('data', inspect);
  try {
    const origin = await new Promise((accept, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`lifecycle web launch timed out: ${id}`)),
        45_000
      );
      const poll = () => {
        if (outputExceeded) {
          clearTimeout(timeout);
          reject(new Error(`lifecycle web output exceeded byte limit: ${id}`));
          return;
        }
        const match = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match) {
          clearTimeout(timeout);
          accept(match[1]);
          return;
        }
        if (child.exitCode !== null || child.signalCode !== null) {
          clearTimeout(timeout);
          reject(
            new Error(
              `lifecycle web exited before readiness: ${id} (${child.exitCode ?? child.signalCode})`
            )
          );
          return;
        }
        setTimeout(poll, 25);
      };
      poll();
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    const root = await fetchBounded(`${origin}/`);
    const html = root.bytes.toString('utf8');
    const themeScriptMatch =
      /<script>(\(\(\) => \{\s+const preference = "(light|dark|system)"[\s\S]*?document\.body\.toggleAttribute\('data-ds-dark-theme', dark\)\s+\}\)\(\))<\/script>/.exec(
        html
      );
    if (
      root.response.status !== 200 ||
      !(root.response.headers.get('content-type') ?? '')
        .toLowerCase()
        .includes('text/html') ||
      themeScriptMatch?.[2] !== preference
    ) {
      fail(`lifecycle theme bootstrap differs for ${id}`);
    }
    const bootstrapExecution = [false, true].map((systemDark) =>
      executeThemeBootstrap(themeScriptMatch[1], systemDark)
    );
    return {
      id,
      command: ['web', '--host', '127.0.0.1', '--no-open', '--port', '0'],
      processId: child.pid,
      preference,
      probeActive: expectedProbeActive,
      profileManifestSha256: sha256(profileManifestBytes),
      rootBytes: root.bytes.length,
      rootSha256: sha256(root.bytes),
      bootstrapScriptSha256: sha256(themeScriptMatch[1]),
      bootstrapExecution,
      serverOutputSha256: sha256(output),
    };
  } finally {
    await stopChild(child);
  }
}

async function runNegativeEvidenceCases(profileDir, candidate) {
  const directory = resolve(profileDir, 'negative-evidence');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const receipts = [];
  for (const scenario of EXPECTED_NEGATIVE_EVIDENCE_CASES) {
    const bytes = buildNegativeCandidateFixture(candidate, scenario.id);
    const input = resolve(directory, `${scenario.id}.json`);
    await writeFile(input, bytes, { mode: 0o600 });
    const result = await runCaptured(
      process.execPath,
      [candidateValidator, '--input', input],
      {
        cwd: profileDir,
        env: dshEnvironment(profileDir),
      }
    );
    const stderr = result.stderr.toString('utf8');
    if (
      result.code === 0 ||
      result.signal !== null ||
      !stderr.includes(scenario.expectedStderrIncludes)
    ) {
      fail(`negative evidence did not fail closed: ${scenario.id}`);
    }
    receipts.push({
      id: scenario.id,
      mutation: scenario.mutation,
      inputBytes: bytes.length,
      inputSha256: sha256(bytes),
      expectedStderrIncludes: scenario.expectedStderrIncludes,
      command: commandEvidence(
        scenario.id,
        ['validate-baseline-candidate.mjs', '--input', '<isolated-input>'],
        result
      ),
    });
  }
  return receipts;
}

async function runLifecycleAcceptance(dshBin, profileDir, contracts) {
  const contract = contracts.protocol.lifecycleAcceptance;
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
  const probe = await createLifecycleProbe(profileDir, contract);
  const commands = [];
  const states = [];
  const launches = [];
  const listArgs = ['plugin', '--profile', 'web', 'list', '--json'];
  const addArgs = [
    'plugin',
    '--profile',
    'web',
    'add',
    probe.path,
    '--save-exact',
  ];
  const receiptAddArgs = [
    'plugin',
    '--profile',
    'web',
    'add',
    '<probe-artifact>',
    '--save-exact',
  ];
  const removeArgs = [
    'plugin',
    '--profile',
    'web',
    'remove',
    EXPECTED_LIFECYCLE_PROBE.name,
  ];

  let execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'initial-list',
    listArgs
  );
  commands.push(execution.evidence);
  states.push(
    await inspectProbeState(
      profileDir,
      'initial-list',
      execution.result,
      false
    )
  );

  execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'add-exact-artifact',
    addArgs,
    receiptAddArgs
  );
  commands.push(execution.evidence);
  execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'list-after-add',
    listArgs
  );
  commands.push(execution.evidence);
  states.push(
    await inspectProbeState(
      profileDir,
      'list-after-add',
      execution.result,
      true
    )
  );

  for (const preference of EXPECTED_THEME_PREFERENCES) {
    const settings = await writeThemePreference(profileDir, preference);
    const id = `mode-${preference}`;
    launches.push({
      ...(await startLifecycleWeb(dshBin, profileDir, {
        id:
          preference === 'system'
            ? 'mode-system-first-cold-start'
            : id,
        preference,
        expectedProbeActive: true,
      })),
      settings,
    });
  }
  const systemSettings = await writeThemePreference(profileDir, 'system');
  launches.push({
    ...(await startLifecycleWeb(dshBin, profileDir, {
      id: 'mode-system-second-cold-start',
      preference: 'system',
      expectedProbeActive: true,
    })),
    settings: systemSettings,
  });

  execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'remove-exact-package',
    removeArgs
  );
  commands.push(execution.evidence);
  execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'list-after-rollback',
    listArgs
  );
  commands.push(execution.evidence);
  states.push(
    await inspectProbeState(
      profileDir,
      'list-after-rollback',
      execution.result,
      false
    )
  );
  launches.push({
    ...(await startLifecycleWeb(dshBin, profileDir, {
      id: 'rollback-built-in-cold-start',
      preference: 'system',
      expectedProbeActive: false,
    })),
    settings: systemSettings,
  });

  execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'reverse-add-exact-artifact',
    addArgs,
    receiptAddArgs
  );
  commands.push(execution.evidence);
  execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'list-after-reverse',
    listArgs
  );
  commands.push(execution.evidence);
  states.push(
    await inspectProbeState(
      profileDir,
      'list-after-reverse',
      execution.result,
      true
    )
  );
  launches.push({
    ...(await startLifecycleWeb(dshBin, profileDir, {
      id: 'reverse-installed-cold-start',
      preference: 'system',
      expectedProbeActive: true,
    })),
    settings: systemSettings,
  });

  execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'final-remove-exact-package',
    removeArgs
  );
  commands.push(execution.evidence);
  execution = await runSuccessfulDshCommand(
    dshBin,
    profileDir,
    'final-list',
    listArgs
  );
  commands.push(execution.evidence);
  states.push(
    await inspectProbeState(
      profileDir,
      'final-list',
      execution.result,
      false
    )
  );

  if (
    JSON.stringify(commands.map((entry) => entry.id)) !==
      JSON.stringify(EXPECTED_LIFECYCLE_COMMAND_SEQUENCE) ||
    JSON.stringify(launches.map((entry) => entry.id)) !==
      JSON.stringify(EXPECTED_LIFECYCLE_WEB_SEQUENCE)
  ) {
    fail('lifecycle execution order differs from the closed contract');
  }
  const negativeEvidence = await runNegativeEvidenceCases(
    profileDir,
    candidate
  );
  return {
    probeArtifact: probe.evidence,
    commands,
    stateSnapshots: states,
    webLaunches: launches,
    negativeEvidence,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  let gha = null;
  let profileDir = null;
  let base = {
    schemaVersion: 1,
    receiptKind: 'rc2-final-baseline-matrix-job',
    finalizationInput: true,
    promotionAuthority: false,
    installable: false,
    productionReady: false,
    baseline: EXPECTED_BASELINE,
    officialSourceCommit: EXPECTED_SOURCE_COMMIT,
    startedAt,
    expected: {
      platform: args.expectedPlatform,
      nodeVersion: args.expectedNode,
    },
  };
  try {
    gha = githubEnvironment();
    const combination = EXPECTED_MATRIX.find(
      (entry) =>
        entry.platform === args.expectedPlatform &&
        entry.nodeVersion === args.expectedNode
    );
    if (
      !combination ||
      process.platform !== combination.platform ||
      process.versions.node !== combination.nodeVersion
    ) {
      fail(
        `runner identity ${process.platform}@${process.versions.node} differs from ${args.expectedPlatform}@${args.expectedNode}`
      );
    }
    base = {
      ...base,
      environment: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.versions.node,
        github: gha,
      },
    };

    const offline = await validateFinalContractOffline();
    const contracts = await loadFinalContracts();
    const [sourceFiles, npmTarballs] = await Promise.all([
      validatePinnedOfficialSources(contracts),
      validateOfficialTarballs(contracts),
    ]);
    profileDir = await mkdtemp(resolve(tmpdir(), 'dsh-rc2-final-'));
    const dshBin = resolve(localRuntimeDir, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
    const version = await runVersion(dshBin, profileDir);
    const web = await startAndInspectWeb(dshBin, profileDir, contracts);
    const lifecycleEvidence = await runLifecycleAcceptance(
      dshBin,
      profileDir,
      contracts
    );

    const receipt = {
      ...base,
      status: 'passed',
      completedAt: new Date().toISOString(),
      inputAuthorities: {
        candidateSidecarSha256: offline.candidate.sidecarSha256,
        pendingAttestationSha256:
          offline.candidate.pendingAttestationSha256,
        pendingReceiptSha256: offline.candidate.pendingReceiptSha256,
        lockfileSha256: offline.candidate.lockfileSha256,
        protocolContractSha256: offline.protocolContractSha256,
        selectorContractSha256: offline.selectorContractSha256,
        selectorCatalogSha256: offline.selectorCatalogSha256,
      },
      frozenClosure: {
        productionPackages: offline.candidate.productionPackages,
        dshPackages: offline.candidate.dshPackages,
        allDshPackagesExactRc2: true,
      },
      version,
      registryTarballs: npmTarballs,
      fixedSourceProtocol: {
        sourceCommit: EXPECTED_SOURCE_COMMIT,
        files: sourceFiles,
      },
      installedProtocol: {
        artifacts: offline.installedArtifacts,
        selectorCatalog: {
          algorithm: contracts.selector.algorithm,
          selectors: contracts.selector.selectors.length,
          sha256: contracts.selector.sha256,
        },
        uiSlotChain: 'verified-exact-source-and-installed-bundles',
        sessionStateWire: 'verified-exact-source-and-installed-bundle',
        credentialAuthorizationEvents:
          'verified-exact-source-and-installed-bundles',
        bwrapPrivatePidProc:
          process.platform === 'linux'
            ? 'profile-bytes-verified-execution-not-required'
            : 'profile-bytes-verified-non-linux-runner',
      },
      web,
      lifecycleEvidence,
      acceptance: {
        exactReleaseAndClosure: 'passed',
        exactRegistryTarballs: 'passed',
        fixedSourceProtocol: 'passed',
        webNoOpenLoopback: 'passed',
        recursiveClientBundlesAndMime: 'passed',
        indexInjectionOrder: 'passed',
        transportBoundary: 'passed-with-explicit-served-mode-scope',
        staticFrontend404: 'passed',
        selectorAndUiSlotContract: 'passed',
        sessionStateWireContract: 'passed',
        credentialAuthorizationEvents: 'passed',
        cspBoundary: 'passed-with-strict-csp-not-claimed',
        bwrapProfile: 'passed-static-contract',
        installListRemove: 'passed',
        lightDarkSystem: 'passed',
        managedColdRestart: 'passed',
        rollbackReverse: 'passed',
        malformedEvidenceFailsClosed: 'passed',
        mixedVersionEvidenceFailsClosed: 'passed',
      },
      limitation:
        'This is one matrix input. It cannot authorize a baseline or an item by itself. Finalization requires the exact 6/6 GitHub Actions receipt set; theme, skin, and extension installability remains a separate item-level authority.',
    };
    await writeReceipt(args.receiptPath, receipt);
    process.stdout.write(
      `${JSON.stringify({
        receipt: args.receiptPath,
        status: receipt.status,
        matrix: `${process.platform}@${process.versions.node}`,
        bootEntries: receipt.web.bootGraph.entries,
        productionReady: false,
      })}\n`
    );
  } catch (error) {
    const receipt = {
      ...base,
      status: 'failed',
      completedAt: new Date().toISOString(),
      environment:
        base.environment ?? {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.versions.node,
          github: gha,
        },
      error: error instanceof Error ? error.message : String(error),
      productionReady: false,
      installable: false,
      promotionAuthority: false,
    };
    await writeReceipt(args.receiptPath, receipt);
    throw error;
  } finally {
    if (profileDir) await rm(profileDir, { recursive: true, force: true });
  }
}

await run();
