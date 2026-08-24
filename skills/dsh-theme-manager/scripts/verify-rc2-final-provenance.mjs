#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sha256 } from './rc2-final-contract.mjs';

const REPOSITORY = 'LvvUP/dsh-themes-skills';
const SOURCE_REF = 'refs/heads/main';
const SIGNER_WORKFLOW = `${REPOSITORY}/.github/workflows/rc2-certification.yml`;
const CERTIFICATE_IDENTITY =
  `https://github.com/${SIGNER_WORKFLOW}@${SOURCE_REF}`;
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const PROVENANCE_PREDICATE = 'https://slsa.dev/provenance/v1';
const SHA = /^[a-f0-9]{40}$/;
const DIGITS = /^\d+$/;
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 4 * 1024 * 1024;
const MAX_GH_OUTPUT_BYTES = 4 * 1024 * 1024;

function fail(message) {
  throw new Error(`RC.2 final provenance refused: ${message}`);
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null || values.has(key)) {
      fail(
        'usage: verify-rc2-final-provenance.mjs --artifact <absolute-tar.gz> --bundle <absolute-sigstore-json> --run-id <digits> --run-attempt <digits> --source-sha <40-hex>'
      );
    }
    values.set(key, value);
  }
  const expected = [
    '--artifact',
    '--bundle',
    '--run-id',
    '--run-attempt',
    '--source-sha',
  ];
  if (
    values.size !== expected.length ||
    expected.some((key) => !values.has(key))
  ) {
    fail(
      'usage: verify-rc2-final-provenance.mjs --artifact <absolute-tar.gz> --bundle <absolute-sigstore-json> --run-id <digits> --run-attempt <digits> --source-sha <40-hex>'
    );
  }
  const artifact = values.get('--artifact');
  const bundle = values.get('--bundle');
  const runId = values.get('--run-id');
  const runAttempt = values.get('--run-attempt');
  const sourceSha = values.get('--source-sha');
  if (!isAbsolute(artifact) || !isAbsolute(bundle)) {
    fail('artifact and provenance bundle paths must be absolute');
  }
  if (
    !DIGITS.test(runId) ||
    runId.length > 20 ||
    !DIGITS.test(runAttempt) ||
    runAttempt.length > 10 ||
    !SHA.test(sourceSha)
  ) {
    fail('run identity or source SHA is malformed');
  }
  const expectedArtifactName =
    `rc2-final-baseline-certification-${sourceSha}-run-${runId}-attempt-${runAttempt}.tar.gz`;
  if (
    basename(artifact) !== expectedArtifactName ||
    basename(bundle) !== `${expectedArtifactName}.sigstore.json`
  ) {
    fail('artifact filenames are not bound to this source, run, and attempt');
  }
  return {
    artifact: resolve(artifact),
    bundle: resolve(bundle),
    runId,
    runAttempt,
    sourceSha,
  };
}

async function readBoundedRegularFile(path, maxBytes, label) {
  const details = await lstat(path);
  if (!details.isFile() || details.isSymbolicLink()) {
    fail(`${label} is not a regular non-symlink file`);
  }
  if (details.size <= 0 || details.size > maxBytes) {
    fail(`${label} byte size is outside the closed limit`);
  }
  return readFile(path);
}

export function buildGhVerifyCommand(args) {
  return [
    'attestation',
    'verify',
    args.artifact,
    '--bundle',
    args.bundle,
    '--repo',
    REPOSITORY,
    '--cert-identity',
    CERTIFICATE_IDENTITY,
    '--cert-oidc-issuer',
    OIDC_ISSUER,
    '--predicate-type',
    PROVENANCE_PREDICATE,
    '--source-ref',
    SOURCE_REF,
    '--source-digest',
    args.sourceSha,
    '--signer-digest',
    args.sourceSha,
    '--deny-self-hosted-runners',
    '--format',
    'json',
  ];
}

async function runGhVerify(args) {
  const command = buildGhVerifyCommand(args);
  const child = spawn('gh', command, {
    env: { ...process.env, GH_PAGER: 'cat', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let overflowLabel = null;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, 120_000);
  const append = (current, chunk, label) => {
    const next = current + chunk.toString('utf8');
    if (Buffer.byteLength(next) > MAX_GH_OUTPUT_BYTES) {
      overflowLabel = label;
      child.kill('SIGKILL');
      return current;
    }
    return next;
  };
  child.stdout.on('data', (chunk) => {
    stdout = append(stdout, chunk, 'stdout');
  });
  child.stderr.on('data', (chunk) => {
    stderr = append(stderr, chunk, 'stderr');
  });
  let exit;
  try {
    exit = await new Promise((accept, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => accept({ code, signal }));
    });
  } finally {
    clearTimeout(timeout);
  }
  if (timedOut) {
    fail('GitHub CLI provenance verification timed out');
  }
  if (overflowLabel) {
    fail(`GitHub CLI ${overflowLabel} exceeded the byte limit`);
  }
  if (exit.code !== 0) {
    fail(
      `GitHub CLI rejected the signed provenance (${exit.code ?? exit.signal}): ${stderr.trim()}`
    );
  }
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    fail('GitHub CLI did not return parseable provenance verification JSON');
  }
  if (!Array.isArray(result) || result.length === 0) {
    fail('GitHub CLI returned no verified provenance statements');
  }
  return result;
}

function hasExactKeys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort())
  );
}

function isExactGithubWorkflowProvenance(
  entry,
  { artifactName, artifactSha256, runId, runAttempt, sourceSha }
) {
  const statement = entry?.verificationResult?.statement;
  const predicate = statement?.predicate;
  const definition = predicate?.buildDefinition;
  const workflow = definition?.externalParameters?.workflow;
  const internalGithub = definition?.internalParameters?.github;
  const dependency = definition?.resolvedDependencies?.[0];
  const runDetails = predicate?.runDetails;
  return (
    statement?.predicateType === PROVENANCE_PREDICATE &&
    Array.isArray(statement.subject) &&
    statement.subject.some(
      (subject) =>
        subject?.name === artifactName &&
        subject?.digest?.sha256 === artifactSha256
    ) &&
    hasExactKeys(predicate, ['buildDefinition', 'runDetails']) &&
    hasExactKeys(definition, [
      'buildType',
      'externalParameters',
      'internalParameters',
      'resolvedDependencies',
    ]) &&
    definition.buildType ===
      'https://actions.github.io/buildtypes/workflow/v1' &&
    hasExactKeys(definition.externalParameters, ['workflow']) &&
    hasExactKeys(workflow, ['ref', 'repository', 'path']) &&
    workflow.ref === SOURCE_REF &&
    workflow.repository === `https://github.com/${REPOSITORY}` &&
    workflow.path === '.github/workflows/rc2-certification.yml' &&
    hasExactKeys(definition.internalParameters, ['github']) &&
    hasExactKeys(internalGithub, [
      'event_name',
      'repository_id',
      'repository_owner_id',
      'runner_environment',
    ]) &&
    internalGithub.event_name === 'workflow_dispatch' &&
    internalGithub.runner_environment === 'github-hosted' &&
    Array.isArray(definition.resolvedDependencies) &&
    definition.resolvedDependencies.length === 1 &&
    hasExactKeys(dependency, ['uri', 'digest']) &&
    dependency.uri ===
      `git+https://github.com/${REPOSITORY}@${SOURCE_REF}` &&
    hasExactKeys(dependency.digest, ['gitCommit']) &&
    dependency.digest.gitCommit === sourceSha &&
    hasExactKeys(runDetails, ['builder', 'metadata']) &&
    hasExactKeys(runDetails.builder, ['id']) &&
    runDetails.builder.id === CERTIFICATE_IDENTITY &&
    hasExactKeys(runDetails.metadata, ['invocationId']) &&
    runDetails.metadata.invocationId ===
      `https://github.com/${REPOSITORY}/actions/runs/${runId}/attempts/${runAttempt}`
  );
}

export function validateGithubProvenanceResult(result, policy) {
  if (!Array.isArray(result) || result.length === 0) {
    fail('GitHub CLI returned no verified provenance statements');
  }
  if (
    !result.some((entry) => isExactGithubWorkflowProvenance(entry, policy))
  ) {
    fail('verified provenance does not match the exact archive and workflow policy');
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const [artifactBytes] = await Promise.all([
    readBoundedRegularFile(
      args.artifact,
      MAX_ARTIFACT_BYTES,
      'final certification archive'
    ),
    readBoundedRegularFile(
      args.bundle,
      MAX_BUNDLE_BYTES,
      'detached Sigstore provenance bundle'
    ),
  ]);
  const artifactSha256 = sha256(artifactBytes);
  const verified = await runGhVerify(args);
  validateGithubProvenanceResult(verified, {
    artifactName: basename(args.artifact),
    artifactSha256,
    runId: args.runId,
    runAttempt: args.runAttempt,
    sourceSha: args.sourceSha,
  });
  process.stdout.write(
    `${JSON.stringify({
      status: 'verified-github-artifact-provenance',
      artifact: basename(args.artifact),
      artifactSha256,
      repository: REPOSITORY,
      signerWorkflow: `${SIGNER_WORKFLOW}@${SOURCE_REF}`,
      sourceSha: args.sourceSha,
      runId: args.runId,
      runAttempt: args.runAttempt,
    })}\n`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
