import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { parse } from 'yaml';

import {
  loadAuthority,
  PENDING_PUBLICATION_BOUNDARY,
  PROMOTED_PUBLICATION_BOUNDARY,
  validateAuthority,
} from '../skills/dsh-harness-installer/scripts/authority.mjs';
import {
  aggregateRuntimeCandidate,
  assertNoRuntimeSecrets,
  canonicalRuntimeJson,
  scanRuntimeEvidence,
  staleRuntimeComboUrl,
  validateRuntimeGithubIdentity,
  validateRuntimeBootGraph,
  verifyRuntimeCandidate,
} from '../skills/dsh-harness-installer/scripts/runtime-certification.mjs';
import {
  atomicReplaceRuntimeAuthorityFile,
  buildPromotedRuntimeAuthority,
  isDirectRuntimePromotionInvocation,
} from '../skills/dsh-harness-installer/scripts/promote-runtime-authority.mjs';
import {
  runtimeProvenanceSetSha256,
  runtimeReceiptSetPayloadSha256,
  runtimeTasks,
} from '../skills/dsh-harness-installer/scripts/runtime-authority.mjs';
import {
  buildRuntimeGhVerifyCommand,
  validateRuntimeGithubProvenanceResult,
} from '../skills/dsh-harness-installer/scripts/verify-runtime-provenance.mjs';

const workflowPath = resolve('.github/workflows/alpha2-runtime-certification.yml');
const authorityPath = resolve(
  'skills/dsh-harness-installer/references/alpha2-release-authority.json'
);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function tuple(task) {
  return `${task.platform}-${task.arch}-node-${task.nodeVersion}`;
}

function syntheticReceipt(authority, task, index, workflowSha256) {
  return {
    schemaVersion: 1,
    status: 'alpha2-runtime-task-passed',
    scope: 'one-platform-node-task',
    source: {
      tag: authority.release.tag,
      commit: authority.release.commit,
      tree: authority.release.tree,
      lockfileSha256: authority.source.lockfileSha256,
    },
    task,
    artifacts: {
      officialNpm: {
        installReceiptSha256: sha256(Buffer.from(`install-${index}`)),
        installedCliSha256: authority.officialNpm.cliSha256,
        tarballSha256: authority.officialNpm.tarballSha256,
        resolutionLockfileSha256: authority.runtimeInstall.lockfileSha256,
      },
      sourceCrossBuild: {
        buildReceiptSha256: sha256(Buffer.from(`build-${index}`)),
        builtCliSha256: sha256(Buffer.from(`cli-${index}`)),
        reportedVersion: authority.release.version,
      },
    },
    provenanceBoundary: {
      officialNpmOperationalRuntime: true,
      exactSourceCrossBuild: true,
      npmGitHeadPresent: false,
      npmProvenanceAttestationPresent: false,
      binarySourceEquivalenceClaimed: false,
      artifactRelationship: 'independent-artifacts-no-source-package-binding',
    },
    probes: {
      cli: { reportedVersion: authority.release.version },
      profile: { name: 'web', dumpConfigPassed: true },
      browserAuth: {
        unauthenticatedRootStatus: 401,
        launchExchangeStatus: 303,
        authenticatedSessionStatus: 200,
        hostOnlyRejectionStatus: 403,
        originOnlyRejectionStatus: 403,
        crossSiteRejectionStatus: 403,
        restartStatus: 'prior-session-persisted-launch-credential-rotated',
      },
      webProtocol: {
        entriesAndBatches: true,
        comboUrl: true,
        revision404: true,
        javascriptMime: 'text/javascript',
        sourceMapMime: 'application/json',
        gzip: true,
        identity: true,
        cache: true,
        bootReady: true,
      },
    },
    ci: {
      repository: 'LvvUP/dsh-themes-skills',
      workflowPath: '.github/workflows/alpha2-runtime-certification.yml',
      workflowSha256,
      runId: '123456789',
      runAttempt: 1,
      jobId: `runtime-${tuple(task)}`,
      headSha: '6'.repeat(40),
    },
    privacy: {
      capturesProcessOutput: false,
      capturesEnvironment: false,
      capturesBrowserSecrets: false,
      capturesSecretDerivedDigest: false,
    },
  };
}

function pendingAuthority(authority) {
  const pending = structuredClone(authority);
  pending.publication = {
    status: 'official-npm-runtime-evidence-pending',
    publishedInstallable: false,
    completedReceipts: [],
    receiptSetSha256: null,
    boundary: PENDING_PUBLICATION_BOUNDARY,
  };
  return validateAuthority(pending);
}

async function syntheticInput(root) {
  const authority = await loadAuthority();
  const workflowSha256 = sha256(await readFile(workflowPath));
  const input = join(root, 'input');
  await mkdir(input);
  for (const [index, task] of runtimeTasks().entries()) {
    await writeFile(
      join(input, `${tuple(task)}.json`),
      canonicalRuntimeJson(syntheticReceipt(authority, task, index, workflowSha256))
    );
  }
  return { authority, input };
}

test('alpha.2 workflow is manual, exact-six, dual-artifact, candidate-only, and pins every action', async () => {
  const source = await readFile(workflowPath, 'utf8');
  const runtimeSource = await readFile(resolve(
    'skills/dsh-harness-installer/scripts/runtime-certification.mjs'
  ), 'utf8');
  const provenanceSource = await readFile(resolve(
    'skills/dsh-harness-installer/scripts/verify-runtime-provenance.mjs'
  ), 'utf8');
  const workflow = parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.jobs.runtime.strategy.matrix.include.length, 6);
  assert.deepEqual(
    workflow.jobs.runtime.strategy.matrix.include.map((entry) => [
      entry.platform,
      entry.arch,
      entry.node,
    ]),
    [
      ['linux', 'x64', '22.19.0'],
      ['linux', 'x64', '24.15.0'],
      ['darwin', 'arm64', '22.19.0'],
      ['darwin', 'arm64', '24.15.0'],
      ['win32', 'x64', '22.19.0'],
      ['win32', 'x64', '24.15.0'],
    ]
  );
  const actions = [...source.matchAll(/^\s*uses:\s*([^\s]+)$/gmu)].map((match) => match[1]);
  assert.ok(actions.length >= 6);
  for (const action of actions) assert.match(action, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[a-f0-9]{40}$/u);
  assert.match(source, /build-source\.mjs/u);
  assert.match(source, /install-official\.mjs/u);
  assert.match(source, /--install-receipt/u);
  assert.match(source, /runtime-certification\.mjs run-task/u);
  assert.match(source, /runtime-certification\.mjs aggregate/u);
  assert.match(source, /actions\/attest@1e69f48acb82d1966a394da916b4c1698aa569d6/u);
  assert.match(source, /verify-runtime-provenance\.mjs/u);
  assert.match(source, /github\.ref == 'refs\/heads\/main'/u);
  assert.deepEqual(workflow.jobs.aggregate.permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs['verify-signed'].permissions, { contents: 'read' });
  assert.equal(workflow.jobs.sign.permissions['id-token'], 'write');
  assert.equal(workflow.jobs.sign.permissions['artifact-metadata'], 'write');
  assert.equal(workflow.jobs.sign.steps.some((step) => step.uses?.startsWith('actions/checkout@')), false);
  assert.doesNotMatch(JSON.stringify(workflow.jobs.sign), /npm ci|skills\//u);
  assert.match(source, /runtime-evidence-predicate\.json/u);
  assert.match(source, /retention-days: 90/u);
  assert.match(source, /candidate convenience copy without changing authority/u);
  assert.doesNotMatch(source, /promote-runtime-authority\.mjs/u);
  assert.doesNotMatch(source, /(?:push|pull_request):/u);
  assert.match(runtimeSource, /expect\(priorSession\.status, 200, 'prior session after cold restart'\)/u);
  assert.match(runtimeSource, /timingSafeEqual\(previousBytes, currentBytes\)/u);
  assert.match(runtimeSource, /prior-session-persisted-launch-credential-rotated/u);
  assert.match(runtimeSource, /validateSettingsDescribeResponse/u);
  assert.doesNotMatch(runtimeSource, /expect\(priorSession\.status, 401/u);
  assert.match(provenanceSource, /constants\.O_RDONLY \| constants\.O_NOFOLLOW/u);
  assert.match(provenanceSource, /\[subjectPath, args\.subjectBytes\]/u);
  assert.match(provenanceSource, /\[bundlePath, args\.bundleBytes\]/u);
  assert.match(provenanceSource, /subject: subjectPath/u);
  assert.match(provenanceSource, /bundle: bundlePath/u);
});

test('six canonical receipts aggregate without changing the promoted 6/6 authority', async () => {
  const root = await mkdtemp(join(tmpdir(), 'alpha2-runtime-candidate-test-'));
  try {
    const { authority, input } = await syntheticInput(root);
    const before = await readFile(authorityPath);
    const candidate = join(root, 'candidate');
    const receiptSet = await aggregateRuntimeCandidate({
      input,
      output: candidate,
      workflowPath,
    });
    const verified = await verifyRuntimeCandidate({ candidate, workflowPath, authority });
    assert.equal(receiptSet.receipts.length, 6);
    assert.equal(
      receiptSet.provenanceSetSha256,
      runtimeProvenanceSetSha256(receiptSet)
    );
    assert.equal(
      receiptSet.receiptSetPayloadSha256,
      runtimeReceiptSetPayloadSha256(receiptSet)
    );
    assert.deepEqual(await readFile(authorityPath), before);
    assert.equal(authority.publication.status, 'runtime-receipt-verified');
    assert.equal(authority.publication.publishedInstallable, true);
    assert.equal(authority.publication.completedReceipts.length, 6);
    assert.equal(
      authority.publication.receiptSetSha256,
      '3a1017961b0fbc2ac3e773913009c842332b030b5494a5af454594afdb679d0a'
    );
    assert.throws(
      () => buildPromotedRuntimeAuthority(authority, verified),
      /exact pending 0\/6/u
    );
    const promoted = buildPromotedRuntimeAuthority(pendingAuthority(authority), verified);
    assert.equal(promoted.publication.publishedInstallable, true);
    assert.equal(promoted.publication.completedReceipts.length, 6);
    assert.equal(promoted.publication.boundary, PROMOTED_PUBLICATION_BOUNDARY);
    assert.doesNotThrow(() => validateAuthority(promoted));
    const leakedAuthority = structuredClone(promoted);
    leakedAuthority.publication.completedReceipts[0].jobId = 'A'.repeat(43);
    assert.throws(() => validateAuthority(leakedAuthority), /canonical unique task/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('publication boundary exactly distinguishes pending and promoted authority', async () => {
  const promoted = await loadAuthority();
  assert.equal(promoted.publication.boundary, PROMOTED_PUBLICATION_BOUNDARY);
  const pending = pendingAuthority(promoted);
  assert.equal(pending.publication.boundary, PENDING_PUBLICATION_BOUNDARY);

  const pendingWithPromotedBoundary = structuredClone(pending);
  pendingWithPromotedBoundary.publication.boundary = PROMOTED_PUBLICATION_BOUNDARY;
  assert.throws(
    () => validateAuthority(pendingWithPromotedBoundary),
    /exactly describe the pending state/u
  );
  const promotedWithPendingBoundary = structuredClone(promoted);
  promotedWithPendingBoundary.publication.boundary = PENDING_PUBLICATION_BOUNDARY;
  assert.throws(
    () => validateAuthority(promotedWithPendingBoundary),
    /exactly describe the promoted state/u
  );
});

test('candidate verification rejects missing, tampered, cross-run, and provenance-drift evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'alpha2-runtime-reject-test-'));
  try {
    const { input } = await syntheticInput(root);
    const missing = join(root, 'missing');
    await mkdir(missing);
    const names = await Promise.all(runtimeTasks().slice(0, 5).map(async (task) => {
      const name = `${tuple(task)}.json`;
      await writeFile(join(missing, name), await readFile(join(input, name)));
      return name;
    }));
    assert.equal(names.length, 5);
    await assert.rejects(
      aggregateRuntimeCandidate({ input: missing, output: join(root, 'missing-out'), workflowPath }),
      /exactly six/u
    );

    const candidate = join(root, 'candidate');
    await aggregateRuntimeCandidate({ input, output: candidate, workflowPath });
    const firstPath = join(candidate, 'linux-x64-node-22.19.0.json');
    const first = JSON.parse(await readFile(firstPath));
    first.ci.runId = '987654321';
    await writeFile(firstPath, canonicalRuntimeJson(first));
    await assert.rejects(
      verifyRuntimeCandidate({ candidate, workflowPath }),
      /bytes or digest|binding/u
    );

    const provenanceCandidate = join(root, 'provenance-candidate');
    await aggregateRuntimeCandidate({ input, output: provenanceCandidate, workflowPath });
    const provenancePath = join(provenanceCandidate, 'runtime-provenance-set.json');
    const provenance = JSON.parse(await readFile(provenancePath));
    provenance.workflow.runId = '987654321';
    await writeFile(provenancePath, canonicalRuntimeJson(provenance));
    await assert.rejects(
      verifyRuntimeCandidate({ candidate: provenanceCandidate, workflowPath }),
      /provenance-set binding/u
    );

    const durableCandidate = join(root, 'durable-candidate');
    await aggregateRuntimeCandidate({ input, output: durableCandidate, workflowPath });
    const durablePath = join(durableCandidate, 'runtime-evidence-predicate.json');
    const durable = JSON.parse(await readFile(durablePath));
    durable.receipts[0].probes.browserAuth.hostOnlyRejectionStatus = 200;
    await writeFile(durablePath, canonicalRuntimeJson(durable));
    await assert.rejects(
      verifyRuntimeCandidate({ candidate: durableCandidate, workflowPath }),
      /durable evidence predicate binding/u
    );

    const authority = await loadAuthority();
    const receiptSet = JSON.parse(await readFile(join(candidate, 'runtime-receipt-set.json')));
    receiptSet.provenanceSetSha256 = '7'.repeat(64);
    receiptSet.receiptSetPayloadSha256 = runtimeReceiptSetPayloadSha256(receiptSet);
    assert.throws(
      () => buildPromotedRuntimeAuthority(pendingAuthority(authority), {
        receiptSet,
        receiptSetBytes: Buffer.from(canonicalRuntimeJson(receiptSet)),
        receiptBytesBySha256: new Map(),
      }),
      /header or digest|six independently/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('privacy scanner rejects query credentials and standalone 43-character BrowserAuth material', async () => {
  assert.throws(
    () => assertNoRuntimeSecrets('{"value":"http://127.0.0.1/?token=fixture"}'),
    /forbidden secret/u
  );
  assert.throws(
    () => assertNoRuntimeSecrets(`{"value":"${'A'.repeat(43)}"}`),
    /forbidden secret/u
  );
  for (const contents of [
    '{"tokenDigest":false}',
    `{"cookieFingerprint":"${'a'.repeat(64)}"}`,
  ]) {
    assert.throws(
      () => assertNoRuntimeSecrets(contents),
      /forbidden secret/u
    );
  }
  const root = await mkdtemp(join(tmpdir(), 'alpha2-runtime-secret-test-'));
  try {
    await writeFile(join(root, 'receipt.json'), `{"value":"${'B'.repeat(43)}"}\n`);
    await assert.rejects(scanRuntimeEvidence([root]), /forbidden secret/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('tuple receipt identity admits only the exact main GitHub workflow context', () => {
  const task = { platform: 'linux', arch: 'x64', nodeVersion: '22.19.0' };
  const environment = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'LvvUP/dsh-themes-skills',
    GITHUB_WORKFLOW: 'DSH alpha.2 runtime certification',
    GITHUB_WORKFLOW_REF:
      'LvvUP/dsh-themes-skills/.github/workflows/alpha2-runtime-certification.yml@refs/heads/main',
    GITHUB_RUN_ID: '123456789',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SHA: '6'.repeat(40),
    GITHUB_JOB: 'runtime',
  };
  assert.equal(validateRuntimeGithubIdentity(environment, task).runId, '123456789');
  assert.throws(
    () => validateRuntimeGithubIdentity({
      ...environment,
      GITHUB_WORKFLOW_REF: environment.GITHUB_WORKFLOW_REF.replace('/main', '/feature'),
    }, task),
    /workflow reference/u
  );
  assert.throws(
    () => validateRuntimeGithubIdentity({
      ...environment,
      GITHUB_REPOSITORY: 'attacker/fork',
    }, task),
    /identity mismatch/u
  );
});

test('boot graph verifier requires entries+batches, combo URLs, both phases, and one assignment', () => {
  const entryNonce = 'c'.repeat(16);
  const graph = {
    rev: '0'.repeat(12),
    entries: [
      { id: 'bootstrap', url: `/plugins/??bootstrap/client.js&rev=${entryNonce}-0`, rev: `${entryNonce}-0` },
      { id: 'application', url: `/plugins/??application/client.js&rev=${entryNonce}-1`, rev: `${entryNonce}-1` },
    ],
    batches: [
      {
        phase: 'bootstrap',
        url: `/plugins/??bootstrap/client.js&rev=${'a'.repeat(12)}`,
        rev: 'a'.repeat(12),
        entries: ['bootstrap'],
      },
      {
        phase: 'application',
        url: `/plugins/??application/client.js&rev=${'b'.repeat(12)}`,
        rev: 'b'.repeat(12),
        entries: ['application'],
      },
    ],
  };
  graph.rev = createHash('sha1').update(JSON.stringify({
    entries: graph.entries,
    batches: graph.batches,
  })).digest('hex').slice(0, 12);
  assert.doesNotThrow(() => validateRuntimeBootGraph(graph));
  const duplicate = structuredClone(graph);
  duplicate.batches[1].entries = ['bootstrap'];
  assert.throws(() => validateRuntimeBootGraph(duplicate), /entry|assignment|combo URL/u);
  const noCombo = structuredClone(graph);
  noCombo.batches[0].url = `/plugins/bootstrap/client.js?rev=${'a'.repeat(12)}`;
  assert.throws(() => validateRuntimeBootGraph(noCombo), /combo URL/u);
  const wrongEntryUrl = structuredClone(graph);
  wrongEntryUrl.entries[0].url = `/bootstrap/client.js?rev=${entryNonce}-0`;
  assert.throws(() => validateRuntimeBootGraph(wrongEntryUrl), /entry mismatch/u);
  const wrongEntryRevision = structuredClone(graph);
  wrongEntryRevision.entries[0].rev = 'a'.repeat(12);
  assert.throws(() => validateRuntimeBootGraph(wrongEntryRevision), /entry mismatch/u);
  const mixedEntryNonce = structuredClone(graph);
  mixedEntryNonce.entries[1].rev = `${'d'.repeat(16)}-1`;
  mixedEntryNonce.entries[1].url = `/plugins/??application/client.js&rev=${'d'.repeat(16)}-1`;
  assert.throws(() => validateRuntimeBootGraph(mixedEntryNonce), /revision nonce/u);
  const wrongGraphRev = structuredClone(graph);
  wrongGraphRev.rev = 'f'.repeat(12);
  assert.throws(() => validateRuntimeBootGraph(wrongGraphRev), /revision mismatch/u);
  const stale = staleRuntimeComboUrl(graph.batches[0]);
  assert.equal(stale, `/plugins/??bootstrap/client.js&rev=${'0'.repeat(12)}`);
  assert.doesNotMatch(stale, /%3F|%2F/iu);
  assert.throws(
    () => staleRuntimeComboUrl({ ...graph.batches[0], rev: 'short' }),
    /stale combo revision/u
  );
});

test('promotion CLI requires explicit absolute candidate and bundled authority paths', () => {
  const script = resolve(
    'skills/dsh-harness-installer/scripts/promote-runtime-authority.mjs'
  );
  const result = spawnSync(process.execPath, [
    script,
    '--candidate',
    'relative-candidate',
    '--provenance',
    'relative-provenance',
    '--authority',
    authorityPath,
    '--gh',
    'relative-gh',
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /absolute paths/u);
});

test('promotion CLI canonicalizes a symlinked entrypoint instead of silently doing nothing', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'alpha2-promotion-entrypoint-test-'));
  try {
    const script = resolve(
      'skills/dsh-harness-installer/scripts/promote-runtime-authority.mjs'
    );
    const alias = join(root, 'promote-runtime-authority.mjs');
    await symlink(script, alias);
    assert.equal(await isDirectRuntimePromotionInvocation(alias), true);
    const result = spawnSync(process.execPath, [
      alias,
      '--candidate',
      'relative-candidate',
      '--provenance',
      'relative-provenance',
      '--authority',
      authorityPath,
      '--gh',
      'relative-gh',
    ], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /absolute paths/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('signed provenance policy binds subject, main workflow, hosted runner, source, and run attempt', () => {
  const sourceSha = '6'.repeat(40);
  const subjectSha256 = 'a'.repeat(64);
  const runId = '123456789';
  const runAttempt = 2;
  const identity =
    'https://github.com/LvvUP/dsh-themes-skills/.github/workflows/alpha2-runtime-certification.yml@refs/heads/main';
  const result = [{
    verificationResult: {
      statement: {
        predicateType: 'https://slsa.dev/provenance/v1',
        subject: [{ name: 'runtime-receipt-set.json', digest: { sha256: subjectSha256 } }],
        predicate: {
          buildDefinition: {
            buildType: 'https://actions.github.io/buildtypes/workflow/v1',
            externalParameters: {
              workflow: {
                ref: 'refs/heads/main',
                repository: 'https://github.com/LvvUP/dsh-themes-skills',
                path: '.github/workflows/alpha2-runtime-certification.yml',
              },
            },
            internalParameters: {
              github: {
                event_name: 'workflow_dispatch',
                repository_id: '1334241402',
                repository_owner_id: '280906680',
                runner_environment: 'github-hosted',
              },
            },
            resolvedDependencies: [{
              uri: 'git+https://github.com/LvvUP/dsh-themes-skills@refs/heads/main',
              digest: { gitCommit: sourceSha },
            }],
          },
          runDetails: {
            builder: { id: identity },
            metadata: {
              invocationId:
                `https://github.com/LvvUP/dsh-themes-skills/actions/runs/${runId}/attempts/${runAttempt}`,
            },
          },
        },
      },
      signature: {
        certificate: {
          certificateIssuer: 'CN=sigstore-intermediate,O=sigstore.dev',
          issuer: 'https://token.actions.githubusercontent.com',
          subjectAlternativeName: identity,
          githubWorkflowTrigger: 'workflow_dispatch',
          githubWorkflowSHA: sourceSha,
          githubWorkflowName: 'DSH alpha.2 runtime certification',
          githubWorkflowRepository: 'LvvUP/dsh-themes-skills',
          githubWorkflowRef: 'refs/heads/main',
          buildSignerURI: identity,
          buildSignerDigest: sourceSha,
          runnerEnvironment: 'github-hosted',
          sourceRepositoryURI: 'https://github.com/LvvUP/dsh-themes-skills',
          sourceRepositoryDigest: sourceSha,
          sourceRepositoryRef: 'refs/heads/main',
          sourceRepositoryIdentifier: '1334241402',
          sourceRepositoryOwnerURI: 'https://github.com/LvvUP',
          sourceRepositoryOwnerIdentifier: '280906680',
          buildConfigURI: identity,
          buildConfigDigest: sourceSha,
          buildTrigger: 'workflow_dispatch',
          runInvocationURI:
            `https://github.com/LvvUP/dsh-themes-skills/actions/runs/${runId}/attempts/${runAttempt}`,
          sourceRepositoryVisibilityAtSigning: 'public',
        },
      },
      verifiedTimestamps: [{ type: 'tlog' }],
    },
  }];
  const policy = {
    subjectName: 'runtime-receipt-set.json',
    subjectSha256,
    runId,
    runAttempt,
    sourceSha,
  };
  assert.doesNotThrow(() => validateRuntimeGithubProvenanceResult(result, policy));
  const selfHosted = structuredClone(result);
  selfHosted[0].verificationResult.statement.predicate
    .buildDefinition.internalParameters.github.runner_environment = 'self-hosted';
  assert.throws(
    () => validateRuntimeGithubProvenanceResult(selfHosted, policy),
    /exact subject, workflow, runner, and run/u
  );
  const forgedCertificate = structuredClone(result);
  forgedCertificate[0].verificationResult.signature.certificate.runInvocationURI =
    'https://github.com/LvvUP/dsh-themes-skills/actions/runs/999/attempts/1';
  assert.throws(
    () => validateRuntimeGithubProvenanceResult(forgedCertificate, policy),
    /exact subject, workflow, runner, and run/u
  );
  const command = buildRuntimeGhVerifyCommand({
    subject: '/candidate/runtime-receipt-set.json',
    bundle: '/candidate/runtime-receipt-set.json.sigstore.json',
    sourceSha,
  });
  assert.ok(command.includes('--deny-self-hosted-runners'));
  assert.ok(command.includes('--source-ref'));
  assert.ok(command.includes('--signer-digest'));
});

test('POSIX authority replacement is durable and stale-input failure leaves the target unchanged', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'alpha2-runtime-atomic-test-'));
  try {
    const target = join(root, 'authority.json');
    const original = Buffer.from('{"state":"pending"}\n');
    await writeFile(target, original);
    await assert.rejects(
      atomicReplaceRuntimeAuthorityFile(
        target,
        Buffer.from('{"state":"other"}\n'),
        { state: 'promoted' }
      ),
      /changed during promotion/u
    );
    assert.deepEqual(await readFile(target), original);
    await atomicReplaceRuntimeAuthorityFile(target, original, { state: 'promoted' });
    assert.equal(await readFile(target, 'utf8'), '{\n  "state": "promoted"\n}\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
