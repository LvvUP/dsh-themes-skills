#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { mkdir, mkdtemp, open, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RUNTIME_REPOSITORY,
  RUNTIME_WORKFLOW,
  runtimeSha256,
} from './runtime-authority.mjs';

const SOURCE_REF = 'refs/heads/main';
const SIGNER_WORKFLOW = `${RUNTIME_REPOSITORY}/${RUNTIME_WORKFLOW}`;
const CERTIFICATE_IDENTITY = `https://github.com/${SIGNER_WORKFLOW}@${SOURCE_REF}`;
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const PROVENANCE_PREDICATE = 'https://slsa.dev/provenance/v1';
const SHA40 = /^[a-f0-9]{40}$/u;
const DIGITS = /^[1-9]\d{0,19}$/u;
const MAX_SUBJECT_BYTES = 2 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 4 * 1024 * 1024;
const MAX_GH_OUTPUT_BYTES = 4 * 1024 * 1024;
const REPOSITORY_ID = '1334241402';
const REPOSITORY_OWNER_ID = '280906680';
const PINNED_GH_SHA256 = Object.freeze({
  'linux-x64': '014fcd614de4de5b4a1441d298175684bad99f713d10296c5fcaaba47ac332d1',
  'darwin-arm64': 'a38e8ea1b9794a445a1ce746392e36111ca00a3242a6447b49cd4c162cb191a7',
});

function fail(message) {
  throw new Error(`alpha.1 runtime provenance refused: ${message}`);
}

async function readBoundedRegularFile(file, maximum, label) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile() || info.size < 2 || info.size > maximum) {
      fail(`${label} must be a bounded regular non-symlink file`);
    }
    return await handle.readFile();
  } catch (error) {
    if (error.message?.startsWith('alpha.1 runtime provenance refused:')) throw error;
    fail(`${label} must be a bounded regular non-symlink file`);
  } finally {
    if (handle) await handle.close();
  }
}

function exactKeys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

export function buildRuntimeGhVerifyCommand(args) {
  return [
    'attestation',
    'verify',
    args.subject,
    '--bundle',
    args.bundle,
    '--repo',
    RUNTIME_REPOSITORY,
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

function exactGithubWorkflowProvenance(entry, policy) {
  const statement = entry?.verificationResult?.statement;
  const predicate = statement?.predicate;
  const definition = predicate?.buildDefinition;
  const workflow = definition?.externalParameters?.workflow;
  const github = definition?.internalParameters?.github;
  const dependency = definition?.resolvedDependencies?.[0];
  const runDetails = predicate?.runDetails;
  const verification = entry?.verificationResult;
  const certificate = verification?.signature?.certificate;
  return statement?.predicateType === PROVENANCE_PREDICATE &&
    Array.isArray(statement.subject) && statement.subject.some((subject) =>
      subject?.name === policy.subjectName && subject?.digest?.sha256 === policy.subjectSha256) &&
    exactKeys(predicate, ['buildDefinition', 'runDetails']) &&
    exactKeys(definition, [
      'buildType', 'externalParameters', 'internalParameters', 'resolvedDependencies',
    ]) && definition.buildType === 'https://actions.github.io/buildtypes/workflow/v1' &&
    exactKeys(definition.externalParameters, ['workflow']) &&
    exactKeys(workflow, ['ref', 'repository', 'path']) &&
    workflow.ref === SOURCE_REF &&
    workflow.repository === `https://github.com/${RUNTIME_REPOSITORY}` &&
    workflow.path === RUNTIME_WORKFLOW &&
    exactKeys(definition.internalParameters, ['github']) &&
    exactKeys(github, [
      'event_name', 'repository_id', 'repository_owner_id', 'runner_environment',
    ]) && github.event_name === 'workflow_dispatch' && github.runner_environment === 'github-hosted' &&
    String(github.repository_id) === REPOSITORY_ID &&
    String(github.repository_owner_id) === REPOSITORY_OWNER_ID &&
    Array.isArray(definition.resolvedDependencies) && definition.resolvedDependencies.length === 1 &&
    exactKeys(dependency, ['uri', 'digest']) &&
    dependency.uri === `git+https://github.com/${RUNTIME_REPOSITORY}@${SOURCE_REF}` &&
    exactKeys(dependency.digest, ['gitCommit']) && dependency.digest.gitCommit === policy.sourceSha &&
    exactKeys(runDetails, ['builder', 'metadata']) && exactKeys(runDetails.builder, ['id']) &&
    runDetails.builder.id === CERTIFICATE_IDENTITY &&
    exactKeys(runDetails.metadata, ['invocationId']) &&
    runDetails.metadata.invocationId ===
      `https://github.com/${RUNTIME_REPOSITORY}/actions/runs/${policy.runId}/attempts/${policy.runAttempt}` &&
    typeof certificate?.certificateIssuer === 'string' &&
    certificate.certificateIssuer.includes('sigstore') &&
    certificate?.issuer === OIDC_ISSUER &&
    certificate?.subjectAlternativeName === CERTIFICATE_IDENTITY &&
    certificate?.githubWorkflowTrigger === 'workflow_dispatch' &&
    certificate?.githubWorkflowSHA === policy.sourceSha &&
    certificate?.githubWorkflowName === 'DSH alpha.1 runtime certification' &&
    certificate?.githubWorkflowRepository === RUNTIME_REPOSITORY &&
    certificate?.githubWorkflowRef === SOURCE_REF &&
    certificate?.buildSignerURI === CERTIFICATE_IDENTITY &&
    certificate?.buildSignerDigest === policy.sourceSha &&
    certificate?.runnerEnvironment === 'github-hosted' &&
    certificate?.sourceRepositoryURI === `https://github.com/${RUNTIME_REPOSITORY}` &&
    certificate?.sourceRepositoryDigest === policy.sourceSha &&
    certificate?.sourceRepositoryRef === SOURCE_REF &&
    String(certificate?.sourceRepositoryIdentifier) === REPOSITORY_ID &&
    certificate?.sourceRepositoryOwnerURI === 'https://github.com/LvvUP' &&
    String(certificate?.sourceRepositoryOwnerIdentifier) === REPOSITORY_OWNER_ID &&
    certificate?.buildConfigURI === CERTIFICATE_IDENTITY &&
    certificate?.buildConfigDigest === policy.sourceSha &&
    certificate?.buildTrigger === 'workflow_dispatch' &&
    certificate?.runInvocationURI ===
      `https://github.com/${RUNTIME_REPOSITORY}/actions/runs/${policy.runId}/attempts/${policy.runAttempt}` &&
    certificate?.sourceRepositoryVisibilityAtSigning === 'public' &&
    Array.isArray(verification?.verifiedTimestamps) && verification.verifiedTimestamps.length > 0;
}

export function validateRuntimeGithubProvenanceResult(result, policy) {
  if (!Array.isArray(result) || result.length === 0 ||
      !result.some((entry) => exactGithubWorkflowProvenance(entry, policy))) {
    fail('verified statement does not match the exact subject, workflow, runner, and run policy');
  }
  return true;
}

async function validatePinnedGh(ghPath) {
  const expected = PINNED_GH_SHA256[`${process.platform}-${process.arch}`];
  if (!expected || !path.isAbsolute(ghPath) || path.basename(ghPath) !== 'gh') {
    fail('GitHub CLI platform or absolute pinned path is outside policy');
  }
  let handle;
  try {
    handle = await open(ghPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    const bytes = await handle.readFile();
    if (!info.isFile() || runtimeSha256(bytes) !== expected) {
      fail('GitHub CLI bytes do not match the pinned verifier toolchain');
    }
    return bytes;
  } catch (error) {
    if (error.message?.startsWith('alpha.1 runtime provenance refused:')) throw error;
    fail('GitHub CLI must be a readable regular non-symlink file');
  } finally {
    if (handle) await handle.close();
  }
}

async function runGhVerify(args) {
  const privateRoot = await mkdtemp(path.join(os.tmpdir(), 'alpha1-runtime-gh-'));
  try {
    const config = path.join(privateRoot, 'gh');
    await mkdir(config, { mode: 0o700 });
    const verifierPath = path.join(privateRoot, 'pinned-gh');
    const subjectPath = path.join(privateRoot, 'runtime-receipt-set.json');
    const bundlePath = path.join(privateRoot, 'runtime-receipt-set.json.sigstore.json');
    const verifier = await open(verifierPath, 'wx', 0o700);
    try {
      await verifier.writeFile(args.ghBytes);
      await verifier.sync();
      await verifier.chmod(0o700);
    } finally {
      await verifier.close();
    }
    for (const [file, bytes] of [
      [subjectPath, args.subjectBytes],
      [bundlePath, args.bundleBytes],
    ]) {
      const handle = await open(file, 'wx', 0o600);
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
    const env = {
      GH_CONFIG_DIR: config,
      GH_PAGER: 'cat',
      HOME: privateRoot,
      NO_COLOR: '1',
      XDG_CONFIG_HOME: privateRoot,
    };
    for (const name of [
      'SystemRoot', 'SYSTEMROOT', 'WINDIR',
      'LANG', 'LANGUAGE', 'TZ', 'GH_TOKEN',
    ]) {
      if (typeof process.env[name] === 'string') env[name] = process.env[name];
    }
    const child = spawn(verifierPath, buildRuntimeGhVerifyCommand({
      subject: subjectPath,
      bundle: bundlePath,
      sourceSha: args.sourceSha,
    }), {
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderrBytes = 0;
    let overflow = false;
    const appendStdout = (chunk) => {
      if (overflow) return;
      stdout += chunk.toString('utf8');
      if (Buffer.byteLength(stdout) > MAX_GH_OUTPUT_BYTES) {
        overflow = true;
        child.kill('SIGKILL');
      }
    };
    child.stdout.on('data', appendStdout);
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_GH_OUTPUT_BYTES) {
        overflow = true;
        child.kill('SIGKILL');
      }
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 120_000);
    timer.unref();
    const exit = await new Promise((resolve, reject) => {
      child.once('error', () => reject(new Error('GitHub CLI provenance verifier failed to start')));
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    clearTimeout(timer);
    if (timedOut) fail('GitHub CLI verification timed out');
    if (overflow) fail('GitHub CLI verification output exceeded the private bound');
    if (exit.code !== 0) fail('GitHub CLI rejected the signed provenance; private output withheld');
    try {
      return JSON.parse(stdout);
    } catch {
      fail('GitHub CLI did not return valid verification JSON');
    }
  } finally {
    await rm(privateRoot, { recursive: true, force: true });
  }
}

export async function verifyRuntimeProvenance({ subject, bundle, runId, runAttempt, sourceSha, ghPath }) {
  if (![subject, bundle].every(path.isAbsolute) || path.basename(subject) !== 'runtime-receipt-set.json' ||
      path.basename(bundle) !== 'runtime-receipt-set.json.sigstore.json' || !DIGITS.test(runId) ||
      !Number.isSafeInteger(runAttempt) || runAttempt < 1 || runAttempt > 1000 || !SHA40.test(sourceSha)) {
    fail('subject, bundle, or run identity is outside the closed policy');
  }
  const [subjectBytes, bundleBytes] = await Promise.all([
    readBoundedRegularFile(subject, MAX_SUBJECT_BYTES, 'receipt-set subject'),
    readBoundedRegularFile(bundle, MAX_BUNDLE_BYTES, 'detached Sigstore bundle'),
  ]);
  const subjectSha256 = runtimeSha256(subjectBytes);
  const ghBytes = await validatePinnedGh(ghPath);
  const result = await runGhVerify({ subjectBytes, bundleBytes, sourceSha, ghBytes });
  validateRuntimeGithubProvenanceResult(result, {
    subjectName: path.basename(subject),
    subjectSha256,
    runId,
    runAttempt,
    sourceSha,
  });
  return {
    status: 'verified-github-runtime-provenance',
    subjectSha256,
    sourceSha,
    runId,
    runAttempt,
  };
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || values.has(key)) fail('arguments must be unique --name value pairs');
    values.set(key, value);
  }
  const expected = ['--subject', '--bundle', '--run-id', '--run-attempt', '--source-sha', '--gh'];
  if (values.size !== expected.length || expected.some((key) => !values.has(key))) {
    fail('usage requires --subject --bundle --run-id --run-attempt --source-sha --gh');
  }
  if (!/^\d{1,4}$/u.test(values.get('--run-attempt'))) fail('run attempt is malformed');
  return {
    subject: values.get('--subject'),
    bundle: values.get('--bundle'),
    runId: values.get('--run-id'),
    runAttempt: Number(values.get('--run-attempt')),
    sourceSha: values.get('--source-sha'),
    ghPath: values.get('--gh'),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(
      await verifyRuntimeProvenance(parseArgs(process.argv.slice(2)))
    )}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
