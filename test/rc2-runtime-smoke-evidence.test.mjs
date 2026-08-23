import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const indexPath = resolve(
  'skills/dsh-theme-manager/references/rc2-runtime-smoke/index.json'
);
const pendingReceiptPath = resolve(
  'skills/dsh-theme-manager/references/certification-receipt.dsh-0.1.1-rc.2.pending.json'
);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

test('RC.2 smoke index binds the reviewed PR head, merge ref, and exact authorities', async () => {
  const index = await readJson(indexPath);

  assert.equal(index.evidenceKind, 'rc2-runtime-smoke-set-non-promotional');
  assert.equal(index.promotionAuthority, false);
  assert.equal(index.installable, false);
  assert.equal(index.source.pullRequest, 6);
  assert.equal(
    index.source.pullRequestHead,
    'd76dadf9815bcae2cd1aecec5a224af8d7492341'
  );
  assert.equal(
    index.source.mergeRefCommit,
    '6591581150062a8565f7375964cdd83a4739ee9a'
  );
  assert.deepEqual(index.source.mergeRefParents, [
    'feb600b636cd0cd46494b649666b7325a1b6b449',
    'd76dadf9815bcae2cd1aecec5a224af8d7492341',
  ]);
  assert.equal(index.source.workflowRunId, '32626363582');
  assert.equal(index.source.workflowRunAttempt, '1');
  assert.equal(
    index.source.workflowRunUrl,
    'https://github.com/LvvUP/dsh-themes-skills/actions/runs/32626363582'
  );

  for (const binding of Object.values(index.authorityBindings)) {
    assert.equal(await sha256(resolve(binding.path)), binding.sha256);
  }
});

test('RC.2 smoke evidence covers exactly three platforms by two Node versions', async () => {
  const index = await readJson(indexPath);
  const combinations = index.receipts
    .map(({ platform, nodeVersion }) => `${platform}/${nodeVersion}`)
    .sort();

  assert.equal(index.smokeMatrix.status, 'smoke-passed');
  assert.equal(index.smokeMatrix.completedJobs, 6);
  assert.equal(index.smokeMatrix.requiredJobs, 6);
  assert.deepEqual(combinations, [
    'darwin/22.19.0',
    'darwin/24.15.0',
    'linux/22.19.0',
    'linux/24.15.0',
    'win32/22.19.0',
    'win32/24.15.0',
  ]);
  assert.equal(new Set(combinations).size, 6);
});

test('every archived receipt matches its digest and stays web-startup-only', async () => {
  const index = await readJson(indexPath);

  for (const entry of index.receipts) {
    const path = resolve(entry.path);
    const receipt = await readJson(path);

    assert.equal(await sha256(path), entry.sha256, entry.path);
    assert.equal(receipt.receiptKind, 'rc2-runtime-smoke-non-promotional');
    assert.equal(receipt.promotionAuthority, false);
    assert.equal(receipt.installable, false);
    assert.equal(receipt.baseline, index.baseline);
    assert.equal(receipt.environment.platform, entry.platform);
    assert.equal(receipt.environment.arch, entry.arch);
    assert.equal(receipt.environment.nodeVersion, entry.nodeVersion);
    assert.equal(receipt.environment.githubRunId, index.source.workflowRunId);
    assert.equal(receipt.environment.githubRunAttempt, index.source.workflowRunAttempt);
    assert.equal(receipt.environment.githubSha, index.source.mergeRefCommit);
    assert.equal(
      receipt.sidecarSha256,
      index.authorityBindings.candidateSidecar.sha256
    );
    assert.equal(
      receipt.pendingAttestationSha256,
      index.authorityBindings.pendingRuntimeAttestation.sha256
    );
    assert.equal(receipt.status, 'smoke-passed');
    assert.equal(receipt.health.status, 200);
    assert.equal(receipt.health.hasClientScriptEntry, true);
    assert.deepEqual(receipt.command, [
      'web',
      '--host',
      '127.0.0.1',
      '--no-open',
      '--port',
      '0',
    ]);
    assert.deepEqual(receipt.acceptance, {
      webNoOpenLoopbackHealth: 'passed',
      installListRemove: 'pending',
      lightDarkSystem: 'pending',
      managedColdRestart: 'pending',
      rollbackReverse: 'pending',
      communityItems: 'pending',
    });
  }
});

test('successful startup smoke cannot promote RC.2 certification or installation', async () => {
  const index = await readJson(indexPath);
  const pendingReceipt = await readJson(pendingReceiptPath);

  assert.equal(index.scope.kind, 'web-startup-smoke-only');
  assert.deepEqual(index.certificationAcceptance, {
    status: 'pending',
    completedJobs: 0,
    requiredJobs: 6,
  });
  assert.equal(pendingReceipt.status, 'certification-pending');
  assert.equal(pendingReceipt.installable, false);
  assert.equal(pendingReceipt.matrix.completedJobs, 0);
  assert.equal(pendingReceipt.matrix.requiredJobs, 6);
});
