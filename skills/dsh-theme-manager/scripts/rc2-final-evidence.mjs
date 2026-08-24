import { readdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import {
  EXPECTED_BASELINE,
  EXPECTED_GITHUB_WORKFLOW_REF,
  EXPECTED_LIFECYCLE_COMMAND_SEQUENCE,
  EXPECTED_LIFECYCLE_PROBE,
  EXPECTED_LIFECYCLE_WEB_SEQUENCE,
  EXPECTED_MATRIX,
  EXPECTED_NEGATIVE_EVIDENCE_CASES,
  EXPECTED_SOURCE_COMMIT,
  buildNegativeCandidateFixture,
  loadFinalContracts,
  sha256,
  skillDir,
  validateFinalContractOffline,
} from './rc2-final-contract.mjs';

export const FINAL_ATTESTATION_FILE =
  'attestation.dsh-0.1.1-rc.2.final.json';
export const FINAL_CERTIFICATION_FILE =
  'certification-receipt.dsh-0.1.1-rc.2.final.json';

const SHA256 = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGITS = /^\d+$/;
const SAFE_RUNNER_IMAGE_ID = /^[\x20-\x7e]{1,128}$/;
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const MAX_RECEIPT_FILES = 12;

const REQUIRED_BOOT_IDS = Object.freeze([
  '@deepseek-ai/dsh-client-modules',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-theme',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-conversation',
]);

export const EXPECTED_ACCEPTANCE = Object.freeze({
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
  installListRemove: 'passed-with-list-rendering-diagnostic-only',
  lightDarkSystem: 'passed',
  managedColdRestart: 'passed',
  rollbackReverse: 'passed',
  malformedEvidenceFailsClosed: 'passed',
  mixedVersionEvidenceFailsClosed: 'passed',
});

function fail(message) {
  throw new Error(`RC.2 final evidence refused: ${message}`);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} is not an object`);
  }
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(`${label} keys differ from the closed schema`);
  }
}

function exactJson(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} differs from the fixed contract`);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function isIsoInstant(value) {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function assertDigest(value, label) {
  if (!SHA256.test(value ?? '')) fail(`${label} is not a SHA-256 digest`);
}

function matrixKey(platform, nodeVersion) {
  return `${platform}/${nodeVersion}`;
}

function expectedInputAuthorities(offline) {
  return {
    candidateSidecarSha256: offline.candidate.sidecarSha256,
    pendingAttestationSha256: offline.candidate.pendingAttestationSha256,
    pendingReceiptSha256: offline.candidate.pendingReceiptSha256,
    lockfileSha256: offline.candidate.lockfileSha256,
    protocolContractSha256: offline.protocolContractSha256,
    selectorContractSha256: offline.selectorContractSha256,
    selectorCatalogSha256: offline.selectorCatalogSha256,
  };
}

function assertGithubMatrixIdentity(github) {
  exactKeys(
    github,
    [
      'provider',
      'repository',
      'serverUrl',
      'workflow',
      'workflowRef',
      'runId',
      'runAttempt',
      'runUrl',
      'job',
      'ref',
      'headSha',
      'runnerOs',
      'runnerArch',
      'imageOs',
      'imageVersion',
    ],
    'matrix GitHub identity'
  );
  if (
    github.provider !== 'github-actions' ||
    github.repository !== 'LvvUP/dsh-themes-skills' ||
    github.serverUrl !== 'https://github.com' ||
    github.workflow !== 'RC.2 final baseline certification' ||
    github.workflowRef !== EXPECTED_GITHUB_WORKFLOW_REF ||
    !DIGITS.test(github.runId) ||
    !DIGITS.test(github.runAttempt) ||
    github.runUrl !==
      `https://github.com/LvvUP/dsh-themes-skills/actions/runs/${github.runId}/attempts/${github.runAttempt}` ||
    github.job !== 'certify' ||
    github.ref !== 'refs/heads/main' ||
    !SHA.test(github.headSha) ||
    typeof github.runnerOs !== 'string' ||
    github.runnerOs.length === 0 ||
    typeof github.runnerArch !== 'string' ||
    github.runnerArch.length === 0 ||
    !SAFE_RUNNER_IMAGE_ID.test(github.imageOs ?? '') ||
    !SAFE_RUNNER_IMAGE_ID.test(github.imageVersion ?? '')
  ) {
    fail('matrix receipt is outside the pinned GitHub Actions authority');
  }
}

function assertRegistryTarballs(receipt, candidate) {
  if (!Array.isArray(receipt.registryTarballs)) {
    fail('registry tarball evidence is not an array');
  }
  const expected = Object.values(candidate.compatibility.npmArtifacts)
    .map((artifact) => ({
      name: artifact.name,
      version: artifact.version,
      sha256: artifact.tarballSha256,
      shasum: artifact.shasum,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const actual = receipt.registryTarballs
    .map((artifact) => {
      exactKeys(
        artifact,
        ['name', 'version', 'bytes', 'sha256', 'shasum'],
        `registry artifact ${artifact?.name ?? '<unknown>'}`
      );
      if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0) {
        fail(`registry artifact has an invalid byte count: ${artifact.name}`);
      }
      return {
        name: artifact.name,
        version: artifact.version,
        sha256: artifact.sha256,
        shasum: artifact.shasum,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  exactJson(actual, expected, 'official registry tarball set');
}

function assertFixedSources(receipt, contracts) {
  exactKeys(
    receipt.fixedSourceProtocol,
    ['sourceCommit', 'files'],
    'fixed source protocol'
  );
  if (
    receipt.fixedSourceProtocol.sourceCommit !== EXPECTED_SOURCE_COMMIT ||
    !Array.isArray(receipt.fixedSourceProtocol.files)
  ) {
    fail('fixed source protocol identity differs');
  }
  const actual = receipt.fixedSourceProtocol.files.map((entry) => {
    exactKeys(
      entry,
      ['surface', 'path', 'bytes', 'sha256', 'semanticAssertions'],
      `fixed source ${entry?.path ?? '<unknown>'}`
    );
    return entry;
  });
  const expected = contracts.protocol.sourceFiles.map((entry) => ({
    surface: entry.surface,
    path: entry.path,
    bytes: entry.bytes,
    sha256: entry.sha256,
    semanticAssertions: entry.requiredSubstrings.length,
  }));
  exactJson(actual, expected, 'fixed upstream source evidence');
}

function assertInstalledProtocol(receipt, offline, contracts, platform) {
  exactKeys(
    receipt.installedProtocol,
    [
      'artifacts',
      'selectorCatalog',
      'uiSlotChain',
      'sessionStateWire',
      'credentialAuthorizationEvents',
      'bwrapPrivatePidProc',
    ],
    'installed protocol'
  );
  exactJson(
    receipt.installedProtocol.artifacts,
    offline.installedArtifacts,
    'installed protocol artifact set'
  );
  exactJson(
    receipt.installedProtocol.selectorCatalog,
    {
      algorithm: contracts.selector.algorithm,
      selectors: contracts.selector.selectors.length,
      sha256: contracts.selector.sha256,
    },
    'selector catalog evidence'
  );
  if (
    receipt.installedProtocol.uiSlotChain !==
      'verified-exact-source-and-installed-bundles' ||
    receipt.installedProtocol.sessionStateWire !==
      'verified-exact-source-and-installed-bundle' ||
    receipt.installedProtocol.credentialAuthorizationEvents !==
      'verified-exact-source-and-installed-bundles'
  ) {
    fail('installed slot/session/authorization protocol evidence differs');
  }
  const expectedBwrap =
    platform === 'linux'
      ? 'profile-bytes-verified-execution-not-required'
      : 'profile-bytes-verified-non-linux-runner';
  if (receipt.installedProtocol.bwrapPrivatePidProc !== expectedBwrap) {
    fail('bwrap evidence scope differs for the receipt platform');
  }
}

function assertWebEvidence(web, contracts) {
  exactKeys(
    web,
    [
      'command',
      'root',
      'indexInjection',
      'bootGraph',
      'transport',
      'assets',
      'static404',
      'csp',
      'serverOutputSha256',
    ],
    'web evidence'
  );
  exactJson(
    web.command,
    ['web', '--host', '127.0.0.1', '--no-open', '--port', '0'],
    'dsh web command'
  );
  exactKeys(
    web.root,
    ['status', 'contentType', 'bytes', 'sha256'],
    'web root response'
  );
  if (
    web.root.status !== 200 ||
    !String(web.root.contentType).toLowerCase().includes('text/html') ||
    !Number.isSafeInteger(web.root.bytes) ||
    web.root.bytes <= 0
  ) {
    fail('web root response is not the verified HTML response');
  }
  assertDigest(web.root.sha256, 'web root digest');
  exactJson(
    web.indexInjection,
    {
      order: [
        'module-loader-queue',
        'parser-preload',
        '__DSH_BOOT__',
        'vite-module-entry',
      ],
      status: 'passed',
    },
    'IndexInjection order'
  );
  exactKeys(
    web.bootGraph,
    [
      'rev',
      'entries',
      'requiredIds',
      'bundleSetAlgorithm',
      'bundleSetSha256',
    ],
    'boot graph'
  );
  if (
    typeof web.bootGraph.rev !== 'string' ||
    web.bootGraph.rev.length === 0 ||
    !Number.isSafeInteger(web.bootGraph.entries) ||
    web.bootGraph.entries < 10 ||
    web.bootGraph.bundleSetAlgorithm !==
      'sorted-id-tab-url-tab-bytes-tab-sha256-lf'
  ) {
    fail('boot graph summary is malformed');
  }
  exactJson(web.bootGraph.requiredIds, REQUIRED_BOOT_IDS, 'required boot ids');
  assertDigest(web.bootGraph.bundleSetSha256, 'boot bundle-set digest');
  exactJson(
    web.transport,
    {
      optionalGlobal: '__DSH_TRANSPORT__',
      loadBundleBranchPresent: true,
      servedMode: 'http-websocket-default',
      explicitTransportExecution: 'not-exercised-by-served-web',
    },
    'transport boundary'
  );
  exactKeys(web.assets, ['main', 'stylesheets'], 'served assets');
  exactKeys(
    web.assets.main,
    ['url', 'bytes', 'sha256', 'contentType'],
    'served main entry'
  );
  const expectedMain = contracts.protocol.installedArtifacts.find(
    (entry) => entry.package === '@deepseek-ai/dsh-web-frontend'
  );
  if (
    web.assets.main.bytes !== expectedMain.bytes ||
    web.assets.main.sha256 !== expectedMain.sha256 ||
    !String(web.assets.main.contentType).toLowerCase().includes('javascript') ||
    !Array.isArray(web.assets.stylesheets) ||
    web.assets.stylesheets.length < 2
  ) {
    fail('served main entry or stylesheets differ from the fixed web bundle');
  }
  for (const stylesheet of web.assets.stylesheets) {
    exactKeys(
      stylesheet,
      ['url', 'bytes', 'sha256'],
      'served stylesheet'
    );
    if (!Number.isSafeInteger(stylesheet.bytes) || stylesheet.bytes <= 0) {
      fail('served stylesheet byte count is invalid');
    }
    assertDigest(stylesheet.sha256, 'served stylesheet digest');
  }
  exactJson(
    web.static404,
    {
      missingAsset: { status: 404, bytes: 0 },
      missingRoute: { status: 404, bytes: 0 },
      htmlFallback: false,
    },
    'static frontend 404 behavior'
  );
  exactJson(
    web.csp,
    {
      responseHeader:
        contracts.protocol.cspBoundary.expectedServedContentSecurityPolicy,
      schemasteryNewFunctionPresent: true,
      strictCspCompatibilityClaimed: false,
    },
    'Function/CSP boundary'
  );
  assertDigest(web.serverOutputSha256, 'web server output digest');
}

function assertCommandEvidence(command, { id, argv, success }) {
  exactKeys(
    command,
    [
      'id',
      'argv',
      'exitCode',
      'signal',
      'stdoutBytes',
      'stdoutSha256',
      'stderrBytes',
      'stderrSha256',
    ],
    `lifecycle command ${id}`
  );
  if (
    command.id !== id ||
    JSON.stringify(command.argv) !== JSON.stringify(argv) ||
    command.signal !== null ||
    (success ? command.exitCode !== 0 : command.exitCode === 0) ||
    !Number.isSafeInteger(command.exitCode) ||
    !Number.isSafeInteger(command.stdoutBytes) ||
    command.stdoutBytes < 0 ||
    !Number.isSafeInteger(command.stderrBytes) ||
    command.stderrBytes < 0 ||
    command.stdoutBytes + command.stderrBytes > 4 * 1024 * 1024
  ) {
    fail(`lifecycle command result differs: ${id}`);
  }
  assertDigest(command.stdoutSha256, `${id} stdout digest`);
  assertDigest(command.stderrSha256, `${id} stderr digest`);
}

function expectedLifecycleCommandArgs(id) {
  if (id.includes('list')) {
    return [
      'plugin',
      '--profile',
      'web',
      'list',
      '--json',
      '--depth',
      '0',
    ];
  }
  if (id.includes('add-exact-artifact')) {
    return [
      'plugin',
      '--profile',
      'web',
      'add',
      '<probe-artifact>',
      '--save-exact',
    ];
  }
  if (id.includes('remove-exact-package')) {
    return [
      'plugin',
      '--profile',
      'web',
      'remove',
      EXPECTED_LIFECYCLE_PROBE.name,
    ];
  }
  fail(`unknown lifecycle command id: ${id}`);
}

function assertLifecycleState(state, { label, active }) {
  exactKeys(
    state,
    [
      'label',
      'activePackage',
      'profileDirectThemeCount',
      'pnpmListDiagnosticThemeCount',
      'lockfileFormatVersion',
      'lockfileImporterCount',
      'lockfileThemeImporterCount',
      'lockfileThemeEntryCount',
      'lockfileThemeImporterSha256',
      'bundleIndex',
      'dependencySpecSha256',
      'lockfileSpecifierSha256',
      'lockfileVersionSha256',
      'dependencyArtifactPathSha256',
      'lockfileSpecifierArtifactPathSha256',
      'lockfileVersionArtifactPathSha256',
      'listStdoutSha256',
      'profileManifestSha256',
      'lockfileSha256',
      'installedManifestSha256',
      'installedManifestCanonicalSha256',
      'installedBundlePatchSha256',
    ],
    `lifecycle state ${label}`
  );
  if (
    state.label !== label ||
    state.profileDirectThemeCount !== (active ? 1 : 0) ||
    !Number.isSafeInteger(state.pnpmListDiagnosticThemeCount) ||
    state.pnpmListDiagnosticThemeCount < 0 ||
    state.pnpmListDiagnosticThemeCount > (active ? 1 : 0) ||
    !Number.isSafeInteger(state.lockfileImporterCount) ||
    state.lockfileImporterCount < 0 ||
    state.lockfileThemeImporterCount !== (active ? 1 : 0) ||
    state.lockfileThemeEntryCount !== (active ? 1 : 0) ||
    (active
      ? JSON.stringify(state.activePackage) !==
          JSON.stringify({
            name: EXPECTED_LIFECYCLE_PROBE.name,
            version: EXPECTED_LIFECYCLE_PROBE.version,
          }) ||
        state.lockfileFormatVersion !== '9.0' ||
        state.lockfileImporterCount < 1 ||
        !SHA256.test(state.lockfileThemeImporterSha256 ?? '') ||
        !Number.isSafeInteger(state.bundleIndex) ||
        state.bundleIndex < 0 ||
        !SHA256.test(state.dependencySpecSha256 ?? '') ||
        state.lockfileSpecifierSha256 !==
          state.dependencySpecSha256 ||
        !SHA256.test(state.lockfileVersionSha256 ?? '') ||
        !SHA256.test(state.dependencyArtifactPathSha256 ?? '') ||
        state.lockfileSpecifierArtifactPathSha256 !==
          state.dependencyArtifactPathSha256 ||
        state.lockfileVersionArtifactPathSha256 !==
          state.dependencyArtifactPathSha256 ||
        !SHA256.test(state.installedManifestSha256 ?? '') ||
        !SHA256.test(state.installedManifestCanonicalSha256 ?? '') ||
        !SHA256.test(state.installedBundlePatchSha256 ?? '')
      : state.activePackage !== null ||
        state.lockfileThemeImporterSha256 !== null ||
        state.bundleIndex !== null ||
        state.dependencySpecSha256 !== null ||
        state.lockfileSpecifierSha256 !== null ||
        state.lockfileVersionSha256 !== null ||
        state.dependencyArtifactPathSha256 !== null ||
        state.lockfileSpecifierArtifactPathSha256 !== null ||
        state.lockfileVersionArtifactPathSha256 !== null ||
        state.installedManifestSha256 !== null ||
        state.installedManifestCanonicalSha256 !== null ||
        state.installedBundlePatchSha256 !== null)
  ) {
    fail(`lifecycle state differs: ${label}`);
  }
  assertDigest(state.listStdoutSha256, `${label} plugin-list digest`);
  assertDigest(state.profileManifestSha256, `${label} profile digest`);
  if (label === 'initial-list') {
    if (state.lockfileSha256 !== null) {
      assertDigest(state.lockfileSha256, `${label} lockfile digest`);
    }
    if (
      ![null, '9.0'].includes(state.lockfileFormatVersion) ||
      (state.lockfileFormatVersion === null
        ? state.lockfileImporterCount !== 0
        : state.lockfileImporterCount < 1)
    ) {
      fail(`${label} lockfile identity differs`);
    }
  } else {
    assertDigest(state.lockfileSha256, `${label} lockfile digest`);
    if (
      state.lockfileFormatVersion !== '9.0' ||
      state.lockfileImporterCount < 1
    ) {
      fail(`${label} lockfile identity differs`);
    }
  }
}

export function validateLifecycleWebLaunchEvidence(launch, expected) {
  exactKeys(
    launch,
    [
      'id',
      'command',
      'processId',
      'preference',
      'probeActive',
      'profileManifestSha256',
      'rootBytes',
      'rootSha256',
      'bootstrapScriptSha256',
      'bootstrapExecution',
      'serverOutputSha256',
      'settings',
    ],
    `lifecycle web launch ${expected.id}`
  );
  exactKeys(launch.settings, ['bytes', 'sha256'], `${expected.id} settings`);
  const settingsBytes = Buffer.from(
    `ui-theme:\n  preference: ${expected.preference}\n`
  );
  if (
    launch.id !== expected.id ||
    JSON.stringify(launch.command) !==
      JSON.stringify([
        'web',
        '--host',
        '127.0.0.1',
        '--no-open',
        '--port',
        '0',
      ]) ||
    !Number.isSafeInteger(launch.processId) ||
    launch.processId <= 0 ||
    launch.preference !== expected.preference ||
    launch.probeActive !== expected.probeActive ||
    launch.settings.bytes !== settingsBytes.length ||
    launch.settings.sha256 !== sha256(settingsBytes) ||
    !Number.isSafeInteger(launch.rootBytes) ||
    launch.rootBytes <= 0
  ) {
    fail(`lifecycle web launch differs: ${expected.id}`);
  }
  assertDigest(
    launch.profileManifestSha256,
    `${expected.id} profile manifest digest`
  );
  assertDigest(launch.rootSha256, `${expected.id} root digest`);
  assertDigest(
    launch.bootstrapScriptSha256,
    `${expected.id} theme bootstrap digest`
  );
  const expectedBootstrapExecution = [false, true].map((systemDark) => {
    const dark =
      expected.preference === 'dark' ||
      (expected.preference === 'system' && systemDark);
    return {
      systemDark,
      colorScheme: dark ? 'dark' : 'light',
      bodyDarkAttribute: dark,
    };
  });
  exactJson(
    launch.bootstrapExecution,
    expectedBootstrapExecution,
    `${expected.id} theme bootstrap execution`
  );
  assertDigest(launch.serverOutputSha256, `${expected.id} server digest`);
}

export function validateLifecycleEvidence(evidence, contracts, candidate) {
  exactKeys(
    evidence,
    [
      'probeArtifact',
      'commands',
      'stateSnapshots',
      'webLaunches',
      'negativeEvidence',
    ],
    'lifecycle evidence'
  );
  exactKeys(
    evidence.probeArtifact,
    [
      'package',
      'packTool',
      'packageManifestBytes',
      'packageManifestSha256',
      'packageManifestCanonicalSha256',
      'bundlePatchBytes',
      'bundlePatchSha256',
      'artifactBytes',
      'artifactSha256',
      'packCommand',
    ],
    'lifecycle probe artifact'
  );
  const manifestBytes = Buffer.from(
    `${JSON.stringify(
      contracts.protocol.lifecycleAcceptance.probePackage.packageManifest,
      null,
      2
    )}\n`
  );
  const patchBytes = Buffer.from(
    contracts.protocol.lifecycleAcceptance.probePackage.bundlePatch
  );
  if (
    JSON.stringify(evidence.probeArtifact.package) !==
      JSON.stringify({
        name: EXPECTED_LIFECYCLE_PROBE.name,
        version: EXPECTED_LIFECYCLE_PROBE.version,
      }) ||
    evidence.probeArtifact.packTool !== EXPECTED_LIFECYCLE_PROBE.packTool ||
    evidence.probeArtifact.packageManifestBytes !== manifestBytes.length ||
    evidence.probeArtifact.packageManifestSha256 !== sha256(manifestBytes) ||
    evidence.probeArtifact.packageManifestCanonicalSha256 !==
      sha256(
        canonicalJson(
          contracts.protocol.lifecycleAcceptance.probePackage.packageManifest
        )
      ) ||
    evidence.probeArtifact.bundlePatchBytes !== patchBytes.length ||
    evidence.probeArtifact.bundlePatchSha256 !== sha256(patchBytes) ||
    !Number.isSafeInteger(evidence.probeArtifact.artifactBytes) ||
    evidence.probeArtifact.artifactBytes <= 0 ||
    evidence.probeArtifact.artifactBytes > 1024 * 1024
  ) {
    fail('lifecycle probe artifact differs from its exact source contract');
  }
  assertDigest(
    evidence.probeArtifact.artifactSha256,
    'lifecycle probe artifact digest'
  );
  assertCommandEvidence(evidence.probeArtifact.packCommand, {
    id: 'pack-probe',
    argv: ['pnpm', 'pack', '--pack-destination', '<isolated-output>'],
    success: true,
  });

  if (!Array.isArray(evidence.commands)) {
    fail('lifecycle command evidence is not an array');
  }
  exactJson(
    evidence.commands.map((entry) => entry.id),
    EXPECTED_LIFECYCLE_COMMAND_SEQUENCE,
    'lifecycle command sequence'
  );
  for (const id of EXPECTED_LIFECYCLE_COMMAND_SEQUENCE) {
    assertCommandEvidence(
      evidence.commands.find((entry) => entry.id === id),
      { id, argv: expectedLifecycleCommandArgs(id), success: true }
    );
  }

  const expectedStates = [
    { label: 'initial-list', active: false },
    { label: 'list-after-add', active: true },
    { label: 'list-after-rollback', active: false },
    { label: 'list-after-reverse', active: true },
    { label: 'final-list', active: false },
  ];
  if (!Array.isArray(evidence.stateSnapshots)) {
    fail('lifecycle state evidence is not an array');
  }
  exactJson(
    evidence.stateSnapshots.map((entry) => entry.label),
    expectedStates.map((entry) => entry.label),
    'lifecycle state sequence'
  );
  expectedStates.forEach((expected, index) =>
    assertLifecycleState(evidence.stateSnapshots[index], expected)
  );
  const [, installed, rollback, reverse, final] = evidence.stateSnapshots;
  if (
    installed.installedManifestCanonicalSha256 !==
      evidence.probeArtifact.packageManifestCanonicalSha256 ||
    installed.installedBundlePatchSha256 !==
      evidence.probeArtifact.bundlePatchSha256 ||
    installed.installedManifestSha256 !==
      reverse.installedManifestSha256 ||
    installed.installedManifestCanonicalSha256 !==
      reverse.installedManifestCanonicalSha256 ||
    reverse.installedBundlePatchSha256 !==
      evidence.probeArtifact.bundlePatchSha256 ||
    installed.lockfileSpecifierSha256 !==
      installed.dependencySpecSha256 ||
    reverse.lockfileSpecifierSha256 !==
      reverse.dependencySpecSha256 ||
    installed.lockfileThemeImporterSha256 !==
      reverse.lockfileThemeImporterSha256 ||
    installed.lockfileVersionSha256 !== reverse.lockfileVersionSha256 ||
    installed.dependencyArtifactPathSha256 !==
      reverse.dependencyArtifactPathSha256 ||
    rollback.profileManifestSha256 !== final.profileManifestSha256 ||
    rollback.lockfileSha256 !== final.lockfileSha256
  ) {
    fail('rollback/reverse profile bytes did not return to their exact states');
  }

  const expectedLaunches = [
    { id: 'mode-light', preference: 'light', probeActive: true },
    { id: 'mode-dark', preference: 'dark', probeActive: true },
    {
      id: 'mode-system-first-cold-start',
      preference: 'system',
      probeActive: true,
    },
    {
      id: 'mode-system-second-cold-start',
      preference: 'system',
      probeActive: true,
    },
    {
      id: 'rollback-built-in-cold-start',
      preference: 'system',
      probeActive: false,
    },
    {
      id: 'reverse-installed-cold-start',
      preference: 'system',
      probeActive: true,
    },
  ];
  if (!Array.isArray(evidence.webLaunches)) {
    fail('lifecycle web launches are not an array');
  }
  exactJson(
    evidence.webLaunches.map((entry) => entry.id),
    EXPECTED_LIFECYCLE_WEB_SEQUENCE,
    'lifecycle web launch sequence'
  );
  expectedLaunches.forEach((expected, index) =>
    validateLifecycleWebLaunchEvidence(evidence.webLaunches[index], expected)
  );
  for (const launch of evidence.webLaunches.slice(0, 4)) {
    if (launch.profileManifestSha256 !== installed.profileManifestSha256) {
      fail('installed-mode launch is not bound to the installed profile state');
    }
  }
  if (
    evidence.webLaunches[4].profileManifestSha256 !==
      rollback.profileManifestSha256 ||
    evidence.webLaunches[5].profileManifestSha256 !==
      reverse.profileManifestSha256
  ) {
    fail('rollback/reverse launch is not bound to its profile state');
  }

  if (!Array.isArray(evidence.negativeEvidence)) {
    fail('negative evidence is not an array');
  }
  exactJson(
    evidence.negativeEvidence.map((entry) => entry.id),
    EXPECTED_NEGATIVE_EVIDENCE_CASES.map((entry) => entry.id),
    'negative evidence sequence'
  );
  for (const expected of EXPECTED_NEGATIVE_EVIDENCE_CASES) {
    const entry = evidence.negativeEvidence.find(
      (candidateEntry) => candidateEntry.id === expected.id
    );
    exactKeys(
      entry,
      [
        'id',
        'mutation',
        'inputBytes',
        'inputSha256',
        'expectedStderrIncludes',
        'command',
      ],
      `negative evidence ${expected.id}`
    );
    const input = buildNegativeCandidateFixture(candidate, expected.id);
    if (
      entry.id !== expected.id ||
      entry.mutation !== expected.mutation ||
      entry.expectedStderrIncludes !== expected.expectedStderrIncludes ||
      entry.inputBytes !== input.length ||
      entry.inputSha256 !== sha256(input)
    ) {
      fail(`negative evidence input differs: ${expected.id}`);
    }
    assertCommandEvidence(entry.command, {
      id: expected.id,
      argv: [
        'validate-baseline-candidate.mjs',
        '--input',
        '<isolated-input>',
      ],
      success: false,
    });
  }
}

export async function loadCandidateSidecar() {
  return JSON.parse(
    await readFile(
      resolve(skillDir, 'references/dsh-0.1.1-rc.2.candidate.json'),
      'utf8'
    )
  );
}

export function validateMatrixReceipt(
  receipt,
  { offline, contracts, candidate }
) {
  exactKeys(
    receipt,
    [
      'schemaVersion',
      'receiptKind',
      'finalizationInput',
      'promotionAuthority',
      'installable',
      'productionReady',
      'baseline',
      'officialSourceCommit',
      'startedAt',
      'expected',
      'environment',
      'status',
      'completedAt',
      'inputAuthorities',
      'frozenClosure',
      'version',
      'registryTarballs',
      'fixedSourceProtocol',
      'installedProtocol',
      'web',
      'lifecycleEvidence',
      'acceptance',
      'limitation',
    ],
    'matrix receipt'
  );
  if (
    receipt.schemaVersion !== 1 ||
    receipt.receiptKind !== 'rc2-final-baseline-matrix-job' ||
    receipt.finalizationInput !== true ||
    receipt.promotionAuthority !== false ||
    receipt.installable !== false ||
    receipt.productionReady !== false ||
    receipt.baseline !== EXPECTED_BASELINE ||
    receipt.officialSourceCommit !== EXPECTED_SOURCE_COMMIT ||
    receipt.status !== 'passed' ||
    typeof receipt.limitation !== 'string' ||
    !receipt.limitation.includes('cannot authorize') ||
    !isIsoInstant(receipt.startedAt) ||
    !isIsoInstant(receipt.completedAt) ||
    Date.parse(receipt.completedAt) < Date.parse(receipt.startedAt)
  ) {
    fail('matrix receipt is not a successful non-promotional finalization input');
  }
  exactKeys(receipt.expected, ['platform', 'nodeVersion'], 'expected runner');
  exactKeys(
    receipt.environment,
    ['platform', 'arch', 'nodeVersion', 'github'],
    'runner environment'
  );
  if (
    receipt.expected.platform !== receipt.environment.platform ||
    receipt.expected.nodeVersion !== receipt.environment.nodeVersion ||
    typeof receipt.environment.arch !== 'string' ||
    receipt.environment.arch.length === 0
  ) {
    fail('expected and observed matrix identities differ');
  }
  if (
    !EXPECTED_MATRIX.some(
      (entry) =>
        entry.platform === receipt.environment.platform &&
        entry.nodeVersion === receipt.environment.nodeVersion
    )
  ) {
    fail('receipt is outside the fixed six-job matrix');
  }
  assertGithubMatrixIdentity(receipt.environment.github);
  exactJson(
    receipt.inputAuthorities,
    expectedInputAuthorities(offline),
    'matrix input authority bindings'
  );
  exactJson(
    receipt.frozenClosure,
    {
      productionPackages: offline.candidate.productionPackages,
      dshPackages: offline.candidate.dshPackages,
      allDshPackagesExactRc2: true,
    },
    'frozen package closure'
  );
  exactKeys(receipt.version, ['stdout', 'stderrSha256'], 'dsh version check');
  if (receipt.version.stdout !== '0.1.1-rc.2') {
    fail('dsh --version differs from RC.2');
  }
  assertDigest(receipt.version.stderrSha256, 'dsh --version stderr digest');
  assertRegistryTarballs(receipt, candidate);
  assertFixedSources(receipt, contracts);
  assertInstalledProtocol(
    receipt,
    offline,
    contracts,
    receipt.environment.platform
  );
  assertWebEvidence(receipt.web, contracts);
  validateLifecycleEvidence(receipt.lifecycleEvidence, contracts, candidate);
  exactJson(receipt.acceptance, EXPECTED_ACCEPTANCE, 'matrix acceptance');
  return {
    platform: receipt.environment.platform,
    nodeVersion: receipt.environment.nodeVersion,
    github: receipt.environment.github,
  };
}

async function collectFiles(directory, root, output) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (output.length >= MAX_RECEIPT_FILES) {
      fail('receipt directory exceeds the bounded file count');
    }
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) fail('receipt directory contains a symlink');
    if (entry.isDirectory()) {
      await collectFiles(path, root, output);
    } else if (entry.isFile()) {
      if (!entry.name.endsWith('.json')) {
        fail(`receipt directory contains a non-JSON file: ${entry.name}`);
      }
      output.push({ path, relativePath: path.slice(root.length + 1) });
    } else {
      fail(`receipt directory contains an unsupported entry: ${entry.name}`);
    }
  }
}

export async function loadAndValidateMatrixReceiptSet(receiptsDirectory) {
  const root = resolve(receiptsDirectory);
  const files = [];
  await collectFiles(root, root, files);
  if (files.length !== EXPECTED_MATRIX.length) {
    fail(`expected exactly 6 matrix receipts, found ${files.length}`);
  }
  const [offline, contracts, candidate] = await Promise.all([
    validateFinalContractOffline(),
    loadFinalContracts(),
    loadCandidateSidecar(),
  ]);
  const receipts = [];
  for (const file of files) {
    const bytes = await readFile(file.path);
    if (bytes.length === 0 || bytes.length > MAX_RECEIPT_BYTES) {
      fail(`matrix receipt byte size is invalid: ${file.relativePath}`);
    }
    let value;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail(`matrix receipt is not JSON: ${file.relativePath}`);
    }
    const identity = validateMatrixReceipt(value, {
      offline,
      contracts,
      candidate,
    });
    receipts.push({ ...file, bytes, value, ...identity, sha256: sha256(bytes) });
  }
  receipts.sort(
    (left, right) =>
      left.platform.localeCompare(right.platform) ||
      left.nodeVersion.localeCompare(right.nodeVersion)
  );
  const actualMatrix = receipts.map((entry) =>
    matrixKey(entry.platform, entry.nodeVersion)
  );
  const expectedMatrix = [...EXPECTED_MATRIX]
    .sort(
      (left, right) =>
        left.platform.localeCompare(right.platform) ||
        left.nodeVersion.localeCompare(right.nodeVersion)
    )
    .map((entry) => matrixKey(entry.platform, entry.nodeVersion));
  exactJson(actualMatrix, expectedMatrix, 'six-job matrix');
  if (new Set(actualMatrix).size !== EXPECTED_MATRIX.length) {
    fail('matrix contains a duplicate platform/Node combination');
  }
  const github = receipts[0].github;
  for (const receipt of receipts.slice(1)) {
    for (const key of [
      'repository',
      'workflow',
      'workflowRef',
      'runId',
      'runAttempt',
      'ref',
      'headSha',
    ]) {
      if (receipt.github[key] !== github[key]) {
        fail(`matrix receipts disagree on GitHub ${key}`);
      }
    }
  }
  return { receipts, offline, contracts, candidate, github };
}

function finalAuthorityBindings(offline) {
  return {
    candidateSidecar: {
      path: 'references/dsh-0.1.1-rc.2.candidate.json',
      sha256: offline.candidate.sidecarSha256,
    },
    pendingAttestation: {
      path: 'runtime-dsh-0.1.1-rc.2/attestation.json',
      sha256: offline.candidate.pendingAttestationSha256,
    },
    pendingCertificationReceipt: {
      path: 'references/certification-receipt.dsh-0.1.1-rc.2.pending.json',
      sha256: offline.candidate.pendingReceiptSha256,
    },
    lockfile: {
      path: 'runtime-dsh-0.1.1-rc.2/pnpm-lock.yaml',
      sha256: offline.candidate.lockfileSha256,
    },
    protocolContract: {
      path: 'references/rc2-final-protocol-contract.json',
      sha256: offline.protocolContractSha256,
    },
    selectorContract: {
      path: 'references/rc2-final-selector-contract.json',
      sha256: offline.selectorContractSha256,
    },
  };
}

export function buildFinalAttestation({ receiptSet, issuer, issuedAt }) {
  const rows = receiptSet.receipts.map((entry) => ({
    platform: entry.platform,
    nodeVersion: entry.nodeVersion,
    path: `matrix/${entry.platform}-node-${entry.nodeVersion}.json`,
    sha256: entry.sha256,
  }));
  const setDigest = sha256(
    rows
      .map(
        (entry) =>
          `${entry.platform}\t${entry.nodeVersion}\t${entry.sha256}\n`
      )
      .join('')
  );
  return {
    schemaVersion: 1,
    evidenceKind: 'rc2-final-baseline-attestation',
    certificationStatus: 'verified-runtime-baseline',
    productionReady: true,
    installableItems: false,
    itemInstallability: 'separate-authority-required',
    baseline: EXPECTED_BASELINE,
    officialRelease: {
      tag: 'dsh-v0.1.1-rc.2',
      sourceCommit: EXPECTED_SOURCE_COMMIT,
    },
    issuedAt,
    issuer,
    authorityBindings: finalAuthorityBindings(receiptSet.offline),
    matrix: {
      status: 'passed',
      requiredJobs: EXPECTED_MATRIX.length,
      completedJobs: rows.length,
      receiptSetAlgorithm: 'sorted-platform-tab-node-tab-sha256-lf',
      receiptSetSha256: setDigest,
      receipts: rows,
    },
    acceptance: EXPECTED_ACCEPTANCE,
    scope: {
      baselineRuntime: 'certified',
      fullSkinSelectors: receiptSet.contracts.selector.selectors.length,
      servedTransportMode: 'http-websocket-default',
      explicitTransportExecution: 'not-exercised-by-served-web',
      strictCspCompatibilityClaimed: false,
      bwrap: 'fixed-profile-contract-only',
      lifecycleScenarioClasses: 6,
      lifecycleScenarioExecutions: EXPECTED_MATRIX.length * 6,
      negativeEvidenceCases: EXPECTED_NEGATIVE_EVIDENCE_CASES.length,
      pluginListRendering:
        'command-success-json-only-non-authoritative',
      themeSkinExtensionInstallability: 'not-granted',
    },
  };
}

export function buildFinalCertificationReceipt({
  attestationSha256,
  issuer,
  issuedAt,
}) {
  return {
    schemaVersion: 1,
    evidenceKind: 'rc2-final-baseline-certification-receipt',
    status: 'baseline-certified',
    productionReady: true,
    installableItems: false,
    itemInstallability: 'separate-authority-required',
    baseline: EXPECTED_BASELINE,
    officialSourceCommit: EXPECTED_SOURCE_COMMIT,
    issuedAt,
    issuer,
    attestation: {
      path: FINAL_ATTESTATION_FILE,
      sha256: attestationSha256,
    },
    matrix: {
      status: 'passed',
      requiredJobs: EXPECTED_MATRIX.length,
      completedJobs: EXPECTED_MATRIX.length,
    },
    lifecycle: {
      status: 'passed',
      scenarioClasses: 6,
      matrixExecutions: EXPECTED_MATRIX.length * 6,
      negativeEvidenceCases: EXPECTED_NEGATIVE_EVIDENCE_CASES.length,
    },
    limitation:
      'This receipt certifies only the fixed RC.2 baseline. It does not make any theme, skin, or extension installable; each item still requires a separate immutable item-level authority.',
  };
}

function assertFinalIssuer(issuer) {
  exactKeys(
    issuer,
    [
      'provider',
      'repository',
      'serverUrl',
      'workflow',
      'workflowRef',
      'runId',
      'runAttempt',
      'runUrl',
      'job',
      'ref',
      'headSha',
    ],
    'final issuer'
  );
  if (
    issuer.provider !== 'github-actions' ||
    issuer.repository !== 'LvvUP/dsh-themes-skills' ||
    issuer.serverUrl !== 'https://github.com' ||
    issuer.workflow !== 'RC.2 final baseline certification' ||
    issuer.workflowRef !== EXPECTED_GITHUB_WORKFLOW_REF ||
    !DIGITS.test(issuer.runId) ||
    !DIGITS.test(issuer.runAttempt) ||
    issuer.runUrl !==
      `https://github.com/LvvUP/dsh-themes-skills/actions/runs/${issuer.runId}/attempts/${issuer.runAttempt}` ||
    issuer.job !== 'finalize' ||
    issuer.ref !== 'refs/heads/main' ||
    !SHA.test(issuer.headSha)
  ) {
    fail('final issuer is outside the pinned GitHub Actions authority');
  }
}

export async function validateFinalCertificationBundle(bundleDirectory) {
  const root = resolve(bundleDirectory);
  const attestationPath = resolve(root, FINAL_ATTESTATION_FILE);
  const certificationPath = resolve(root, FINAL_CERTIFICATION_FILE);
  const [attestationBytes, certificationBytes, offline, contracts, candidate] =
    await Promise.all([
      readFile(attestationPath),
      readFile(certificationPath),
      validateFinalContractOffline(),
      loadFinalContracts(),
      loadCandidateSidecar(),
    ]);
  const attestation = JSON.parse(attestationBytes.toString('utf8'));
  const certification = JSON.parse(certificationBytes.toString('utf8'));
  exactKeys(
    attestation,
    [
      'schemaVersion',
      'evidenceKind',
      'certificationStatus',
      'productionReady',
      'installableItems',
      'itemInstallability',
      'baseline',
      'officialRelease',
      'issuedAt',
      'issuer',
      'authorityBindings',
      'matrix',
      'acceptance',
      'scope',
    ],
    'final attestation'
  );
  if (
    attestation.schemaVersion !== 1 ||
    attestation.evidenceKind !== 'rc2-final-baseline-attestation' ||
    attestation.certificationStatus !== 'verified-runtime-baseline' ||
    attestation.productionReady !== true ||
    attestation.installableItems !== false ||
    attestation.itemInstallability !== 'separate-authority-required' ||
    attestation.baseline !== EXPECTED_BASELINE ||
    !isIsoInstant(attestation.issuedAt)
  ) {
    fail('final attestation identity or fail-closed item scope differs');
  }
  exactJson(
    attestation.officialRelease,
    { tag: 'dsh-v0.1.1-rc.2', sourceCommit: EXPECTED_SOURCE_COMMIT },
    'final official release'
  );
  assertFinalIssuer(attestation.issuer);
  exactJson(
    attestation.authorityBindings,
    finalAuthorityBindings(offline),
    'final authority bindings'
  );
  exactJson(attestation.acceptance, EXPECTED_ACCEPTANCE, 'final acceptance');
  exactJson(
    attestation.scope,
    {
      baselineRuntime: 'certified',
      fullSkinSelectors: contracts.selector.selectors.length,
      servedTransportMode: 'http-websocket-default',
      explicitTransportExecution: 'not-exercised-by-served-web',
      strictCspCompatibilityClaimed: false,
      bwrap: 'fixed-profile-contract-only',
      lifecycleScenarioClasses: 6,
      lifecycleScenarioExecutions: EXPECTED_MATRIX.length * 6,
      negativeEvidenceCases: EXPECTED_NEGATIVE_EVIDENCE_CASES.length,
      pluginListRendering:
        'command-success-json-only-non-authoritative',
      themeSkinExtensionInstallability: 'not-granted',
    },
    'final scope'
  );
  exactKeys(
    attestation.matrix,
    [
      'status',
      'requiredJobs',
      'completedJobs',
      'receiptSetAlgorithm',
      'receiptSetSha256',
      'receipts',
    ],
    'final matrix'
  );
  if (
    attestation.matrix.status !== 'passed' ||
    attestation.matrix.requiredJobs !== EXPECTED_MATRIX.length ||
    attestation.matrix.completedJobs !== EXPECTED_MATRIX.length ||
    attestation.matrix.receiptSetAlgorithm !==
      'sorted-platform-tab-node-tab-sha256-lf' ||
    !Array.isArray(attestation.matrix.receipts) ||
    attestation.matrix.receipts.length !== EXPECTED_MATRIX.length
  ) {
    fail('final matrix is incomplete');
  }
  const receiptBytes = [];
  const seen = new Set();
  for (const entry of attestation.matrix.receipts) {
    exactKeys(
      entry,
      ['platform', 'nodeVersion', 'path', 'sha256'],
      'final matrix receipt binding'
    );
    const expectedPath = `matrix/${entry.platform}-node-${entry.nodeVersion}.json`;
    if (entry.path !== expectedPath || basename(entry.path) !== entry.path.slice(7)) {
      fail('final matrix receipt path is not canonical');
    }
    const key = matrixKey(entry.platform, entry.nodeVersion);
    if (seen.has(key)) fail('final matrix contains a duplicate receipt');
    seen.add(key);
    const bytes = await readFile(resolve(root, entry.path));
    if (sha256(bytes) !== entry.sha256) {
      fail(`final matrix receipt digest differs: ${entry.path}`);
    }
    const value = JSON.parse(bytes.toString('utf8'));
    validateMatrixReceipt(value, { offline, contracts, candidate });
    if (
      value.environment.github.runId !== attestation.issuer.runId ||
      value.environment.github.runAttempt !== attestation.issuer.runAttempt ||
      value.environment.github.workflowRef !== attestation.issuer.workflowRef ||
      value.environment.github.headSha !== attestation.issuer.headSha ||
      value.environment.github.ref !== attestation.issuer.ref
    ) {
      fail('matrix receipt and final issuer are from different workflow runs');
    }
    receiptBytes.push(entry);
  }
  const expectedMatrix = EXPECTED_MATRIX.map((entry) =>
    matrixKey(entry.platform, entry.nodeVersion)
  ).sort();
  exactJson([...seen].sort(), expectedMatrix, 'final matrix coordinates');
  const sortedBindings = [...receiptBytes].sort(
    (left, right) =>
      left.platform.localeCompare(right.platform) ||
      left.nodeVersion.localeCompare(right.nodeVersion)
  );
  const setDigest = sha256(
    sortedBindings
      .map(
        (entry) =>
          `${entry.platform}\t${entry.nodeVersion}\t${entry.sha256}\n`
      )
      .join('')
  );
  if (setDigest !== attestation.matrix.receiptSetSha256) {
    fail('final matrix receipt-set digest differs');
  }

  exactKeys(
    certification,
    [
      'schemaVersion',
      'evidenceKind',
      'status',
      'productionReady',
      'installableItems',
      'itemInstallability',
      'baseline',
      'officialSourceCommit',
      'issuedAt',
      'issuer',
      'attestation',
      'matrix',
      'lifecycle',
      'limitation',
    ],
    'final certification receipt'
  );
  if (
    certification.schemaVersion !== 1 ||
    certification.evidenceKind !==
      'rc2-final-baseline-certification-receipt' ||
    certification.status !== 'baseline-certified' ||
    certification.productionReady !== true ||
    certification.installableItems !== false ||
    certification.itemInstallability !== 'separate-authority-required' ||
    certification.baseline !== EXPECTED_BASELINE ||
    certification.officialSourceCommit !== EXPECTED_SOURCE_COMMIT ||
    certification.issuedAt !== attestation.issuedAt ||
    typeof certification.limitation !== 'string' ||
    !certification.limitation.includes('does not make any theme')
  ) {
    fail('final certification receipt identity or item scope differs');
  }
  exactJson(certification.issuer, attestation.issuer, 'certification issuer');
  exactJson(
    certification.attestation,
    { path: FINAL_ATTESTATION_FILE, sha256: sha256(attestationBytes) },
    'certification-to-attestation binding'
  );
  exactJson(
    certification.matrix,
    {
      status: 'passed',
      requiredJobs: EXPECTED_MATRIX.length,
      completedJobs: EXPECTED_MATRIX.length,
    },
    'certification matrix'
  );
  exactJson(
    certification.lifecycle,
    {
      status: 'passed',
      scenarioClasses: 6,
      matrixExecutions: EXPECTED_MATRIX.length * 6,
      negativeEvidenceCases: EXPECTED_NEGATIVE_EVIDENCE_CASES.length,
    },
    'certification lifecycle summary'
  );
  return {
    status: certification.status,
    baseline: certification.baseline,
    productionReady: certification.productionReady,
    installableItems: certification.installableItems,
    completedMatrixJobs: certification.matrix.completedJobs,
    requiredMatrixJobs: certification.matrix.requiredJobs,
    attestationSha256: sha256(attestationBytes),
    certificationReceiptSha256: sha256(certificationBytes),
  };
}
