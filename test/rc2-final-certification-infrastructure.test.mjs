import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  EXPECTED_LIFECYCLE_COMMAND_SEQUENCE,
  EXPECTED_LIFECYCLE_WEB_SEQUENCE,
  EXPECTED_NEGATIVE_EVIDENCE_CASES,
  buildNegativeCandidateFixture,
  loadFinalContracts,
  validateFinalContractOffline,
} from '../skills/dsh-theme-manager/scripts/rc2-final-contract.mjs';
import {
  loadAndValidateMatrixReceiptSet,
  loadCandidateSidecar,
  validateLifecycleEvidence,
  validateLifecycleWebLaunchEvidence,
} from '../skills/dsh-theme-manager/scripts/rc2-final-evidence.mjs';
import { validateGithubProvenanceResult } from '../skills/dsh-theme-manager/scripts/verify-rc2-final-provenance.mjs';
import { run } from './helpers.mjs';

const manager = resolve('skills/dsh-theme-manager');
const finalAttestation = resolve(
  manager,
  'references/attestation.dsh-0.1.1-rc.2.final.json'
);
const finalReceipt = resolve(
  manager,
  'references/certification-receipt.dsh-0.1.1-rc.2.final.json'
);

test('RC.2 final contract is exact but remains certification-pending offline', async () => {
  const result = await validateFinalContractOffline();

  assert.equal(result.status, 'final-infrastructure-ready-certification-pending');
  assert.equal(result.productionReady, false);
  assert.equal(result.baseline, '@deepseek-ai/dsh@0.1.1-rc.2');
  assert.equal(
    result.sourceCommit,
    'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e'
  );
  assert.equal(
    result.candidate.lockfileSha256,
    'b00224c0188c8d4c7b45a3553051da4a4f8e4fd4f89bc98b3a0bb845a3308255'
  );
  assert.equal(result.candidate.productionPackages, 505);
  assert.equal(result.candidate.dshPackages, 188);
  assert.equal(result.installedArtifacts.length, 11);
  assert.equal(result.completedMatrixJobs, 0);
  assert.equal(result.requiredMatrixJobs, 6);
});

test('no final attestation or certification receipt is checked in', async () => {
  await assert.rejects(access(finalAttestation));
  await assert.rejects(access(finalReceipt));

  const policy = JSON.parse(
    await readFile(resolve(manager, 'references/baseline-policy.json'), 'utf8')
  );
  assert.equal(policy.candidate.status, 'certification-pending');
  assert.equal(policy.candidate.installable, false);
  assert.match(policy.candidate.attestationPath, /attestation\.json$/);
  assert.match(policy.candidate.receiptPath, /\.pending\.json$/);
});

test('final receipt-set validation refuses an incomplete directory', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rc2-final-empty-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await assert.rejects(
    loadAndValidateMatrixReceiptSet(directory),
    /expected exactly 6 matrix receipts, found 0/
  );
});

test('RC.2 lifecycle contract names every real command, restart, and negative case', async () => {
  const { protocol } = await loadFinalContracts();
  const lifecycle = protocol.lifecycleAcceptance;

  assert.deepEqual(
    lifecycle.commandSequence,
    EXPECTED_LIFECYCLE_COMMAND_SEQUENCE
  );
  assert.deepEqual(
    lifecycle.webLaunchSequence,
    EXPECTED_LIFECYCLE_WEB_SEQUENCE
  );
  assert.deepEqual(
    lifecycle.negativeEvidenceCases,
    EXPECTED_NEGATIVE_EVIDENCE_CASES
  );
  assert.deepEqual(lifecycle.themePreferences, ['light', 'dark', 'system']);
  assert.equal(
    lifecycle.probePackage.name,
    '@dsh-themes/rc2-lifecycle-probe'
  );
  assert.equal(lifecycle.probePackage.packTool, 'pnpm@11.7.0');
});

test('negative candidate fixtures are deterministic malformed and mixed inputs', async () => {
  const candidate = await loadCandidateSidecar();
  const malformed = JSON.parse(
    buildNegativeCandidateFixture(
      candidate,
      'malformed-evidence-fails-closed'
    )
  );
  const mixed = JSON.parse(
    buildNegativeCandidateFixture(
      candidate,
      'mixed-version-evidence-fails-closed'
    )
  );

  assert.equal(
    malformed.compatibility.npmArtifacts.dsh.version,
    'latest'
  );
  assert.equal(
    mixed.compatibility.npmArtifacts.dsh.version,
    '0.1.0-rc.8'
  );
  assert.equal(candidate.compatibility.npmArtifacts.dsh.version, '0.1.1-rc.2');
});

test('final evidence refuses static lifecycle status without command and file receipts', async () => {
  const [contracts, candidate] = await Promise.all([
    loadFinalContracts(),
    loadCandidateSidecar(),
  ]);

  assert.throws(
    () =>
      validateLifecycleEvidence(
        {
          installListRemove: true,
          lightDarkSystem: true,
          managedColdRestart: true,
          rollbackReverse: true,
        },
        contracts,
        candidate
      ),
    /lifecycle evidence keys differ from the closed schema/
  );
});

test('theme-mode evidence must contain the executed bootstrap result', () => {
  const digest = (value) =>
    createHash('sha256').update(value).digest('hex');
  const settingsBytes = Buffer.from('ui-theme:\n  preference: system\n');
  const launch = {
    id: 'mode-system-first-cold-start',
    command: ['web', '--host', '127.0.0.1', '--no-open', '--port', '0'],
    processId: 1234,
    preference: 'system',
    probeActive: true,
    profileManifestSha256: '1'.repeat(64),
    rootBytes: 1,
    rootSha256: '2'.repeat(64),
    bootstrapScriptSha256: '3'.repeat(64),
    bootstrapExecution: [
      {
        systemDark: false,
        colorScheme: 'light',
        bodyDarkAttribute: false,
      },
      {
        systemDark: true,
        colorScheme: 'dark',
        bodyDarkAttribute: true,
      },
    ],
    serverOutputSha256: '4'.repeat(64),
    settings: {
      bytes: settingsBytes.length,
      sha256: digest(settingsBytes),
    },
  };
  const expected = {
    id: launch.id,
    preference: 'system',
    probeActive: true,
  };

  assert.doesNotThrow(() =>
    validateLifecycleWebLaunchEvidence(launch, expected)
  );
  assert.throws(
    () =>
      validateLifecycleWebLaunchEvidence(
        {
          ...launch,
          bootstrapExecution: [
            ...launch.bootstrapExecution.slice(0, 1),
            {
              systemDark: true,
              colorScheme: 'light',
              bodyDarkAttribute: false,
            },
          ],
        },
        expected
      ),
    /theme bootstrap execution differs from the fixed contract/
  );
});

test('finalizer refuses to issue evidence outside the pinned GitHub Actions job', async (t) => {
  const receipts = await mkdtemp(join(tmpdir(), 'dsh-rc2-final-input-'));
  const output = await mkdtemp(join(tmpdir(), 'dsh-rc2-final-output-'));
  t.after(() =>
    Promise.all([
      rm(receipts, { recursive: true, force: true }),
      rm(output, { recursive: true, force: true }),
    ])
  );

  const result = await run(
    resolve(manager, 'scripts/finalize-rc2-certification.mjs'),
    ['--receipts', receipts, '--output', output],
    { env: { GITHUB_ACTIONS: '' } }
  );
  assert.notEqual(result.code, 0);
  assert.match(
    result.stderr,
    /only by the pinned GitHub Actions finalizer/
  );
});

test('finalizer refuses a lookalike workflow ref', async (t) => {
  const receipts = await mkdtemp(join(tmpdir(), 'dsh-rc2-final-ref-input-'));
  const output = await mkdtemp(join(tmpdir(), 'dsh-rc2-final-ref-output-'));
  t.after(() =>
    Promise.all([
      rm(receipts, { recursive: true, force: true }),
      rm(output, { recursive: true, force: true }),
    ])
  );

  const result = await run(
    resolve(manager, 'scripts/finalize-rc2-certification.mjs'),
    ['--receipts', receipts, '--output', output],
    {
      env: {
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'LvvUP/dsh-themes-skills',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_WORKFLOW: 'RC.2 final baseline certification',
        GITHUB_WORKFLOW_REF:
          'LvvUP/dsh-themes-skills/.github/workflows/rc2-certification.yml@refs/heads/main-lookalike',
        GITHUB_RUN_ID: '1234',
        GITHUB_RUN_ATTEMPT: '2',
        GITHUB_JOB: 'finalize',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_SHA: 'a'.repeat(40),
      },
    }
  );

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /only by the pinned GitHub Actions finalizer/);
});

test('workflow has the exact six-job matrix and gates finalization on main', async () => {
  const workflow = await readFile(
    resolve('.github/workflows/rc2-certification.yml'),
    'utf8'
  );

  assert.match(workflow, /^name: RC\.2 final baseline certification$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request):$/m);
  assert.equal((workflow.match(/^          - os:/gm) ?? []).length, 6);
  assert.equal((workflow.match(/^            platform: linux$/gm) ?? []).length, 2);
  assert.equal((workflow.match(/^            platform: darwin$/gm) ?? []).length, 2);
  assert.equal((workflow.match(/^            platform: win32$/gm) ?? []).length, 2);
  assert.equal((workflow.match(/^            node: 22\.19\.0$/gm) ?? []).length, 3);
  assert.equal((workflow.match(/^            node: 24\.15\.0$/gm) ?? []).length, 3);
  assert.match(
    workflow,
    /Upload the non-promotional matrix receipt[\s\S]*if: always\(\)/
  );
  assert.match(
    workflow,
    /needs\.certify\.result == 'success' && github\.ref == 'refs\/heads\/main'/
  );
  assert.match(workflow, /finalize-rc2-certification\.mjs/);
  assert.match(workflow, /validate-rc2-final-certification\.mjs/);
});

test('final evidence schema is one-way: receipts to attestation to certification', async () => {
  const source = await readFile(
    resolve(manager, 'scripts/rc2-final-evidence.mjs'),
    'utf8'
  );
  const attestationBuilder = source.slice(
    source.indexOf('export function buildFinalAttestation'),
    source.indexOf('export function buildFinalCertificationReceipt')
  );
  const certificationBuilder = source.slice(
    source.indexOf('export function buildFinalCertificationReceipt'),
    source.indexOf('function assertFinalIssuer')
  );

  assert.match(attestationBuilder, /receipts: rows/);
  assert.doesNotMatch(attestationBuilder, /FINAL_CERTIFICATION_FILE/);
  assert.match(certificationBuilder, /path: FINAL_ATTESTATION_FILE/);
  assert.doesNotMatch(certificationBuilder, /matrix\//);
});

test('workflow pins every action and binds every artifact to the run attempt', async () => {
  const workflow = await readFile(
    resolve('.github/workflows/rc2-certification.yml'),
    'utf8'
  );
  const actionUses = [...workflow.matchAll(/uses: ([^@\s]+)@([^\s]+)/g)];

  assert.ok(actionUses.length >= 10);
  for (const [, action, revision] of actionUses) {
    assert.match(revision, /^[a-f0-9]{40}$/, `${action} is not SHA-pinned`);
  }
  assert.equal(
    (workflow.match(/persist-credentials: false/g) ?? []).length,
    3
  );
  assert.match(
    workflow,
    /actions\/attest@1e69f48acb82d1966a394da916b4c1698aa569d6/
  );
  assert.doesNotMatch(workflow, /actions\/attest-build-provenance@/);
  assert.doesNotMatch(
    workflow,
    /^    env:\n(?:      .*\n)*?      .*\$\{\{ runner\./gm,
    'runner context is unavailable in job-level env'
  );
  assert.match(workflow, /final_release_dir="\$RUNNER_TEMP\/rc2-final-release"/);
  assert.match(workflow, /^      attestations: write$/m);
  assert.match(workflow, /^      id-token: write$/m);
  assert.match(
    workflow,
    /name: rc2-final-matrix-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}-/
  );
  assert.match(
    workflow,
    /pattern: rc2-final-matrix-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}-\*/
  );
  assert.match(
    workflow,
    /name: rc2-final-baseline-certification-\$\{\{ github\.sha \}\}-run-\$\{\{ github\.run_id \}\}-attempt-\$\{\{ github\.run_attempt \}\}/
  );
  assert.match(workflow, /steps\.final-bundle-provenance\.outputs\.bundle-path/);
  assert.match(workflow, /^  verify-downloaded-provenance:$/m);
  assert.ok(
    workflow.indexOf('Sign the final bundle with GitHub artifact provenance') <
      workflow.indexOf(
        'Upload final evidence, archive, and detached provenance'
      )
  );
});

test('matrix runner refuses a lookalike workflow ref before certification work', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rc2-final-ref-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const receipt = resolve(directory, 'receipt.json');
  const result = await run(
    resolve(manager, 'runtime-dsh-0.1.1-rc.2/run-final-matrix.mjs'),
    [
      '--receipt',
      receipt,
      '--expected-platform',
      process.platform,
      '--expected-node',
      process.versions.node,
    ],
    {
      env: {
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'LvvUP/dsh-themes-skills',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_WORKFLOW: 'RC.2 final baseline certification',
        GITHUB_WORKFLOW_REF:
          'LvvUP/dsh-themes-skills/.github/workflows/rc2-certification.yml@refs/heads/main-lookalike',
        GITHUB_RUN_ID: '1234',
        GITHUB_RUN_ATTEMPT: '2',
        GITHUB_JOB: 'certify',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_SHA: 'a'.repeat(40),
        RUNNER_OS: 'Test',
        RUNNER_ARCH: process.arch,
        ImageOS: 'test-image',
        ImageVersion: '20260824.1',
      },
    }
  );

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /only by the pinned GitHub Actions workflow/);
});

test('matrix runner refuses receipts without the hosted runner image identity', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rc2-final-image-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const receipt = resolve(directory, 'receipt.json');
  const result = await run(
    resolve(manager, 'runtime-dsh-0.1.1-rc.2/run-final-matrix.mjs'),
    [
      '--receipt',
      receipt,
      '--expected-platform',
      process.platform,
      '--expected-node',
      process.versions.node,
    ],
    {
      env: {
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'LvvUP/dsh-themes-skills',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_WORKFLOW: 'RC.2 final baseline certification',
        GITHUB_WORKFLOW_REF:
          'LvvUP/dsh-themes-skills/.github/workflows/rc2-certification.yml@refs/heads/main',
        GITHUB_RUN_ID: '1234',
        GITHUB_RUN_ATTEMPT: '2',
        GITHUB_JOB: 'certify',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_SHA: 'a'.repeat(40),
        RUNNER_OS: 'Test',
        RUNNER_ARCH: process.arch,
        ImageOS: 'test-image',
        ImageVersion: '',
      },
    }
  );

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /only by the pinned GitHub Actions workflow/);
});

test('matrix state failures expose only sanitized invariant diagnostics', async () => {
  const source = await readFile(
    resolve(manager, 'runtime-dsh-0.1.1-rc.2/run-final-matrix.mjs'),
    'utf8'
  );

  assert.match(source, /checks=\$\{JSON\.stringify\(checks\)\}/);
  for (const key of [
    'directThemeCount',
    'listedProbePresent',
    'listedVersionExact',
    'dependencySpecString',
    'dependencySpecFile',
    'dependencySpecTarball',
    'bundleIndexCount',
    'installedManifestPresent',
    'installedBundlePatchPresent',
    'installedNameExact',
    'installedVersionExact',
  ]) {
    assert.match(source, new RegExp(`\\b${key}\\b`));
  }
  assert.doesNotMatch(source, /^\s+dependencySpec,$/m);
});

test('matrix listing binds lockfile resolution and physical installation separately', async () => {
  const [runnerSource, evidenceSource] = await Promise.all([
    readFile(
      resolve(manager, 'runtime-dsh-0.1.1-rc.2/run-final-matrix.mjs'),
      'utf8'
    ),
    readFile(resolve(manager, 'scripts/rc2-final-evidence.mjs'), 'utf8'),
  ]);

  for (const source of [runnerSource, evidenceSource]) {
    assert.match(
      source,
      /'list',[\s\S]{0,160}'--json',[\s\S]{0,160}'--lockfile-only',[\s\S]{0,120}'--depth',[\s\S]{0,80}'0'/
    );
  }
  assert.match(runnerSource, /installedManifest\?\.name === EXPECTED_LIFECYCLE_PROBE\.name/);
  assert.match(runnerSource, /installedManifest\?\.version === EXPECTED_LIFECYCLE_PROBE\.version/);
  assert.match(evidenceSource, /state\.installedManifestSha256/);
  assert.match(evidenceSource, /state\.installedBundlePatchSha256/);
  assert.match(evidenceSource, /state\.lockfileSha256/);
  assert.match(
    evidenceSource,
    /installed\.installedManifestSha256\s*!==\s*evidence\.probeArtifact\.packageManifestSha256/
  );
  assert.match(
    evidenceSource,
    /installed\.installedBundlePatchSha256\s*!==\s*evidence\.probeArtifact\.bundlePatchSha256/
  );
});

test('provenance verifier fail-closes before gh for unbound artifact names', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rc2-provenance-name-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const artifact = resolve(directory, 'unbound.tar.gz');
  const bundle = resolve(directory, 'unbound.sigstore.json');
  await Promise.all([writeFile(artifact, 'archive'), writeFile(bundle, '{}')]);

  const result = await run(
    resolve(manager, 'scripts/verify-rc2-final-provenance.mjs'),
    [
      '--artifact',
      artifact,
      '--bundle',
      bundle,
      '--run-id',
      '1234',
      '--run-attempt',
      '2',
      '--source-sha',
      'a'.repeat(40),
    ]
  );

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /filenames are not bound/);
});

test('provenance verifier enforces GitHub signer, ref, digest, and hosted runner', async () => {
  const source = await readFile(
    resolve(manager, 'scripts/verify-rc2-final-provenance.mjs'),
    'utf8'
  );

  assert.match(source, /--cert-identity/);
  assert.match(source, /--cert-oidc-issuer/);
  assert.match(source, /--signer-workflow/);
  assert.match(source, /--signer-digest/);
  assert.match(source, /--source-ref/);
  assert.match(source, /--source-digest/);
  assert.match(source, /--deny-self-hosted-runners/);
  assert.match(source, /--bundle/);
  assert.match(source, /https:\/\/slsa\.dev\/provenance\/v1/);
});

test('provenance policy rejects signed statements with altered workflow inputs', () => {
  const sourceSha = 'a'.repeat(40);
  const artifactSha256 = 'b'.repeat(64);
  const policy = {
    artifactName:
      `rc2-final-baseline-certification-${sourceSha}-run-1234-attempt-2.tar.gz`,
    artifactSha256,
    runId: '1234',
    runAttempt: '2',
    sourceSha,
  };
  const statement = {
    predicateType: 'https://slsa.dev/provenance/v1',
    subject: [{ name: policy.artifactName, digest: { sha256: artifactSha256 } }],
    predicate: {
      buildDefinition: {
        buildType: 'https://actions.github.io/buildtypes/workflow/v1',
        externalParameters: {
          workflow: {
            ref: 'refs/heads/main',
            repository: 'https://github.com/LvvUP/dsh-themes-skills',
            path: '.github/workflows/rc2-certification.yml',
          },
        },
        internalParameters: {
          github: {
            event_name: 'workflow_dispatch',
            repository_id: '1',
            repository_owner_id: '2',
            runner_environment: 'github-hosted',
          },
        },
        resolvedDependencies: [
          {
            uri: 'git+https://github.com/LvvUP/dsh-themes-skills@refs/heads/main',
            digest: { gitCommit: sourceSha },
          },
        ],
      },
      runDetails: {
        builder: {
          id: 'https://github.com/LvvUP/dsh-themes-skills/.github/workflows/rc2-certification.yml@refs/heads/main',
        },
        metadata: {
          invocationId:
            'https://github.com/LvvUP/dsh-themes-skills/actions/runs/1234/attempts/2',
        },
      },
    },
  };
  const result = [{ verificationResult: { statement } }];

  assert.doesNotThrow(() => validateGithubProvenanceResult(result, policy));
  statement.predicate.buildDefinition.externalParameters.workflow.ref =
    'refs/heads/lookalike';
  assert.throws(
    () => validateGithubProvenanceResult(result, policy),
    /does not match the exact archive and workflow policy/
  );
});
