import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { aggregateCandidateStaticRisk } from '../skills/dsh-plugin-installer/scripts/aggregate-candidate-risk.mjs';
import {
  auditCandidateStaticRisk,
  validateCandidateStaticRiskReceipt,
} from '../skills/dsh-plugin-installer/scripts/audit-candidate-risk.mjs';
import { loadCandidateIntake } from '../skills/dsh-plugin-installer/scripts/candidate-intake.mjs';

function candidate(commit) {
  return {
    catalogId: 3088,
    slug: 'static-risk-fixture',
    title: 'Static Risk Fixture',
    repository: 'https://github.com/example/static-risk-fixture.git',
    commit,
    licenseExpression: 'MIT',
    licenseEvidencePath: 'LICENSE',
    primaryUseCase: 'govern-and-secure',
    editorialScore: 80,
    status: 'source-intake-pending',
  };
}

async function riskFixture(t) {
  const source = await mkdtemp(join(tmpdir(), 'dsh-plugin-static-risk-'));
  t.after(() => rm(source, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: source });
  execFileSync('git', ['config', 'user.email', 'tests@example.invalid'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'DSH Tests'], { cwd: source });
  await writeFile(join(source, 'package.json'), `${JSON.stringify({
    name: 'static-risk-fixture',
    version: '1.0.0',
    scripts: { prepare: 'node never-run.mjs' },
    dependencies: { '@deepseek-ai/dsh-client-runtime': '0.1.1-rc.8' },
    dsh: { client: { inject: ['@deepseek-ai/dsh-client-runtime'] } },
  }, null, 2)}\n`);
  await writeFile(join(source, 'index.ts'), [
    "import { spawn } from 'node:child_process';",
    "import { writeFile } from 'node:fs/promises';",
    'const zero = 0;',
    'ctx.webServer.register(route);',
    'const inherited = process.env;',
    "await fetch('https://example.invalid');",
    "spawn('tool', [], { shell: true });",
    "localStorage.setItem('preference', 'on');",
    "element.innerHTML = '<p>fixture</p>';",
    "await writeFile('state', 'fixture');",
    'void inherited;',
    'void zero;',
  ].join('\n'));
  await writeFile(join(source, 'never-run.mjs'), [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync('candidate-executed-marker', 'unexpected');",
  ].join('\n'));
  await writeFile(join(source, 'binary.ts'), Buffer.from([0xff, 0x00, 0x41]));
  const utf16 = Buffer.from([
    "$env:API_KEY = 'fixture'",
    '$env:PATH',
    "Start-Process 'fixture'",
    "Invoke-WebRequest 'https://example.invalid'",
    "Remove-Item 'fixture'",
  ].join('\n'), 'utf16le');
  await writeFile(join(source, 'utf16.ps1'), Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    utf16,
  ]));
  await writeFile(join(source, 'LICENSE'), 'Permission is hereby granted.\n');
  execFileSync('git', ['add', '.'], { cwd: source });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: source });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: source,
    encoding: 'utf8',
  }).trim();
  return { source, commit };
}

test('static-risk inventory reads exact Git objects without executing or quoting candidate code', async (t) => {
  const fixture = await riskFixture(t);
  const input = candidate(fixture.commit);
  const receipt = await auditCandidateStaticRisk({ candidate: input, source: fixture.source });

  assert.equal(receipt.status, 'static-risk-inventory-complete');
  assert.equal(receipt.authorityEffect, 'none-review-prioritization-only');
  assert.equal(receipt.candidateExecuted, false);
  await assert.rejects(() => access(join(fixture.source, 'candidate-executed-marker')));
  assert.equal(receipt.declared.lifecycle.prepare, true);
  assert.deepEqual(receipt.classification.baselineAbsentPackages, [
    '@deepseek-ai/dsh-client-runtime',
  ]);
  assert.equal(
    receipt.classification.rawWebRouteAuthState,
    'raw-route-without-official-auth-reference'
  );
  for (const id of [
    'raw-webserver-route',
    'child-process-module',
    'shell-execution-option',
    'environment-read',
    'network-client-api',
    'browser-persistence',
    'dynamic-code-or-html-sink',
    'filesystem-write-api',
    'binary-or-non-utf8-text-file',
    'credential-or-token-reference',
  ]) {
    assert.ok(receipt.scan.findings.some((finding) => finding.id === id), id);
  }
  for (const id of [
    'child-process-module',
    'network-client-api',
    'environment-read',
    'filesystem-write-api',
    'credential-or-token-reference',
  ]) {
    const finding = receipt.scan.findings.find((item) => item.id === id);
    assert.ok(
      finding.locations.some((location) => location.path === 'utf16.ps1'),
      `UTF-16 PowerShell signal ${id}`
    );
  }
  const serialized = JSON.stringify(receipt);
  assert.doesNotMatch(serialized, /never-run\.mjs'|writeFileSync\(|example\.invalid/u);
  assert.deepEqual(receipt.privacy, {
    capturesSourceSnippets: false,
    capturesCredentials: false,
    capturesEnvironmentValues: false,
    capturesLifecycleCommands: false,
  });
});

test('static-risk validator rejects policy, execution, and derived-classification tampering', async (t) => {
  const fixture = await riskFixture(t);
  const input = candidate(fixture.commit);
  const receipt = await auditCandidateStaticRisk({ candidate: input, source: fixture.source });
  for (const mutate of [
    (value) => { value.candidateExecuted = true; },
    (value) => { value.scan.policySha256 = 'f'.repeat(64); },
    (value) => { value.classification.requiresElevatedStaticReview = false; },
    (value) => { value.scan.skippedBinaryCount = 0; },
    (value) => { value.classification.baselineAbsentPackages = []; },
    (value) => { value.privacy.capturesLifecycleCommands = true; },
  ]) {
    const changed = structuredClone(receipt);
    mutate(changed);
    assert.throws(() => validateCandidateStaticRiskReceipt(changed, input), /static-risk receipt/);
  }
});

test('static-risk aggregation requires exact unique coverage and remains non-installing', async (t) => {
  const fixture = await riskFixture(t);
  const base = await auditCandidateStaticRisk({
    candidate: candidate(fixture.commit),
    source: fixture.source,
  });
  const intake = await loadCandidateIntake();
  const input = await mkdtemp(join(tmpdir(), 'dsh-plugin-static-risk-receipts-'));
  const parent = await mkdtemp(join(tmpdir(), 'dsh-plugin-static-risk-summary-'));
  t.after(() => rm(input, { recursive: true, force: true }));
  t.after(() => rm(parent, { recursive: true, force: true }));

  for (const item of intake.items) {
    const directory = join(input, String(item.catalogId));
    await mkdir(directory);
    const receipt = structuredClone(base);
    receipt.catalogId = item.catalogId;
    receipt.source = {
      repository: item.repository,
      commit: item.commit,
      tree: item.commit,
      sourceSubdir: item.sourceSubdir ?? '.',
    };
    await writeFile(
      join(directory, 'static-risk-receipt.json'),
      `${JSON.stringify(receipt, null, 2)}\n`
    );
  }

  const result = await aggregateCandidateStaticRisk({
    input,
    output: join(parent, 'summary'),
  });
  assert.equal(result.summary.status, 'static-risk-review-queue-ready');
  assert.equal(result.summary.auditedCount, 80);
  assert.equal(result.summary.priorityReviewCount, 80);
  assert.equal(result.summary.publication.installable, false);
  assert.equal(result.summary.publication.runtimeCertifiedCount, 0);
  assert.equal(result.summary.receipts.length, 80);
  const persisted = JSON.parse(await readFile(
    join(parent, 'summary', 'static-risk-summary.json'),
    'utf8'
  ));
  assert.equal(persisted.authorityEffect, 'none-review-prioritization-only');

  const last = intake.items.at(-1);
  const first = intake.items[0];
  const duplicate = structuredClone(base);
  duplicate.catalogId = first.catalogId;
  duplicate.source = {
    repository: first.repository,
    commit: first.commit,
    tree: first.commit,
    sourceSubdir: first.sourceSubdir ?? '.',
  };
  await writeFile(
    join(input, String(last.catalogId), 'static-risk-receipt.json'),
    `${JSON.stringify(duplicate, null, 2)}\n`
  );
  await assert.rejects(
    () => aggregateCandidateStaticRisk({ input, output: join(parent, 'duplicate-summary') }),
    /duplicate or missing public IDs/
  );
});

test('checked-in static-risk schemas preserve privacy and non-authority boundaries', async () => {
  const receiptSchema = JSON.parse(await readFile(
    'skills/dsh-plugin-installer/references/plugin-static-risk-receipt.schema.json',
    'utf8'
  ));
  const summarySchema = JSON.parse(await readFile(
    'skills/dsh-plugin-installer/references/plugin-static-risk-summary.schema.json',
    'utf8'
  ));
  assert.equal(receiptSchema.properties.candidateExecuted.const, false);
  assert.equal(
    receiptSchema.properties.authorityEffect.const,
    'none-review-prioritization-only'
  );
  assert.equal(receiptSchema.properties.privacy.properties.capturesSourceSnippets.const, false);
  assert.equal(receiptSchema.properties.privacy.properties.capturesLifecycleCommands.const, false);
  assert.equal(summarySchema.properties.publication.properties.installable.const, false);
  assert.equal(summarySchema.properties.publication.properties.runtimeCertifiedCount.const, 0);
});
