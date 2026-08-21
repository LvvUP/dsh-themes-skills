#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, delimiter, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_ADD_ARTIFACT_SHA256,
  CURRENT_INSTALLABLE_ADD_ARTIFACT_SHA256,
  buildDshChildArgs,
  isAllowedRunnerCommand,
} from './runner-policy.mjs';
import { snapshotAllowedArtifact } from './artifact-snapshot.mjs';
import {
  classifyHostedArtifact,
  CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
  LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
} from './hosted-artifact-authority.mjs';
import { validateReleaseRecord } from './validate-release.mjs';
import { validateRollbackRecord } from './theme-state.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(skillDir, 'runtime-rc8');
const dshBin = resolve(runtimeDir, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
const localBin = resolve(runtimeDir, 'node_modules/.bin');
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function splitRollbackAuthorization(values) {
  if (values[0] !== 'plugin' || values[3] !== 'add' || values.length === 6) {
    return { dshValues: values, authorization: null };
  }
  if (
    values.length !== 12 ||
    values[5] !== '--save-exact' ||
    values[6] !== '--rollback-record' ||
    values[8] !== '--release-record' ||
    values[10] !== '--origin'
  ) {
    throw new Error(
      'rollback add requires --save-exact --rollback-record <absolute-json> --release-record <absolute-json> --origin <https-origin>'
    );
  }
  for (const index of [7, 9]) {
    if (resolve(values[index]) !== values[index]) {
      throw new Error('rollback and release records must use absolute paths');
    }
  }
  return {
    dshValues: values.slice(0, 6),
    authorization: {
      rollbackRecordPath: values[7],
      releaseRecordPath: values[9],
      origin: values[11],
    },
  };
}

export async function prepareAllowedAddArtifact(
  values,
  authorization,
  {
    workspace = process.cwd(),
    currentArtifacts = CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
    legacyArtifacts = LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
    currentAddDigests = CURRENT_INSTALLABLE_ADD_ARTIFACT_SHA256,
    allAddDigests = ALLOWED_ADD_ARTIFACT_SHA256,
  } = {}
) {
  if (values[0] !== 'plugin' || values[3] !== 'add') {
    return values;
  }
  let allowedDigests = currentAddDigests;
  if (authorization) {
    const rollbackRecord = JSON.parse(
      await readFile(authorization.rollbackRecordPath, 'utf8')
    );
    const validatedRollback = await validateRollbackRecord(rollbackRecord, {
      currentArtifacts,
      legacyArtifacts,
    });
    const selected = validatedRollback.previous;
    if (!selected) {
      throw new Error('rollback record restores the built-in palette and has no artifact to add');
    }
    if (resolve(values[4]) !== selected.artifactPath) {
      throw new Error('plugin artifact path does not match the verified rollback record');
    }
    const releaseRecord = JSON.parse(
      await readFile(authorization.releaseRecordPath, 'utf8')
    );
    const expectedAuthority = classifyHostedArtifact(
      selected.packageName,
      selected.version,
      selected.artifactSha256,
      { currentArtifacts, legacyArtifacts }
    );
    const release = await validateReleaseRecord(releaseRecord, {
      origin: authorization.origin,
      authority: expectedAuthority === 'legacy-rollback'
        ? 'legacy-rollback'
        : 'current',
      rollbackRecord,
      currentArtifacts,
      legacyArtifacts,
    });
    if (
      release.packageName !== selected.packageName ||
      release.version !== selected.version ||
      release.artifactSha256 !== selected.artifactSha256 ||
      release.payloadSha256 !== selected.payloadSha256 ||
      !allAddDigests.has(selected.artifactSha256)
    ) {
      throw new Error('release record does not authorize the rollback artifact');
    }
    allowedDigests = new Set([selected.artifactSha256]);
  }
  const snapshot = await snapshotAllowedArtifact(values[4], {
    workspace,
    allowedDigests,
  });
  const snapshotValues = [...values];
  snapshotValues[4] = snapshot.path;
  return snapshotValues;
}

async function main(argv) {
  let parsed;
  try {
    parsed = splitRollbackAuthorization(argv);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  if (!isAllowedRunnerCommand(parsed.dshValues)) {
    fail(
      'unsupported runner command; only version, web, web dump, and exact web-profile plugin list/add/remove are allowed'
    );
  }

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const nodeMinor = Number(process.versions.node.split('.')[1]);
  if (!((nodeMajor === 22 && nodeMinor >= 19) || nodeMajor >= 24)) {
    fail('verified runner requires Node 22.19+ in Node 22, or Node 24+');
  }

  const verification = spawn(
    process.execPath,
    [resolve(skillDir, 'scripts/verify-runner.mjs'), '--quiet'],
    { cwd: process.cwd(), stdio: 'inherit' }
  );
  const verificationStatus = await new Promise((done) =>
    verification.once('exit', (code, signal) => done({ code, signal }))
  );
  if (verificationStatus.code !== 0 || verificationStatus.signal) {
    process.exit(verificationStatus.code ?? 1);
  }

  let childArgs;
  try {
    childArgs = buildDshChildArgs(
      await prepareAllowedAddArtifact(
        parsed.dshValues,
        parsed.authorization
      ),
      resolve
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const child = spawn(process.execPath, [dshBin, ...childArgs], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DSH_TELEMETRY_DISABLED: '1',
      PATH: `${localBin}${delimiter}${process.env.PATH ?? ''}`,
    },
    stdio: 'inherit',
  });
  const result = await new Promise((done) =>
    child.once('error', (error) => done({ code: 1, signal: null, error })).once(
      'exit',
      (code, signal) => done({ code, signal, error: null })
    )
  );
  if (result.error) fail(result.error.message);
  if (result.signal) process.kill(process.pid, result.signal);
  else process.exitCode = result.code ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
