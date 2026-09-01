#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROMOTED_PUBLICATION_BOUNDARY,
  validateAuthority,
} from './authority.mjs';
import {
  canonicalRuntimeJson,
  verifyRuntimeCandidate,
} from './runtime-certification.mjs';
import {
  RUNTIME_WORKFLOW,
  runtimeSha256,
  validateRuntimeReceiptSet,
} from './runtime-authority.mjs';
import { verifyRuntimeProvenance } from './verify-runtime-provenance.mjs';

const canonicalAuthorityPath = fileURLToPath(
  new URL('../references/alpha2-release-authority.json', import.meta.url)
);
const canonicalWorkflowPath = fileURLToPath(
  new URL(`../../../${RUNTIME_WORKFLOW}`, import.meta.url)
);
const systemGitPath = '/usr/bin/git';

function fail(message) {
  throw new Error(message);
}

function git(repository, args) {
  const result = spawnSync(systemGitPath, ['-C', repository, ...args], {
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) fail('promotion checkout Git identity is unavailable or dirty');
  return result.stdout.trim();
}

export function buildPromotedRuntimeAuthority(authorityInput, verifiedCandidate) {
  const authority = validateAuthority(structuredClone(authorityInput));
  if (authority.publication.status !== 'official-npm-runtime-evidence-pending' ||
      authority.publication.publishedInstallable !== false ||
      authority.publication.completedReceipts.length !== 0 ||
      authority.publication.receiptSetSha256 !== null) {
    fail('runtime promotion requires the exact pending 0/6 authority');
  }
  const { receiptSet, receiptSetBytes, receiptBytesBySha256 } = verifiedCandidate;
  if (!Buffer.isBuffer(receiptSetBytes) ||
      !receiptSetBytes.equals(Buffer.from(canonicalRuntimeJson(receiptSet), 'utf8'))) {
    fail('verified candidate receipt-set bytes mismatch');
  }
  validateRuntimeReceiptSet(receiptSet, { authority, receiptBytesBySha256 });
  const promoted = structuredClone(authority);
  promoted.publication = {
    status: 'runtime-receipt-verified',
    publishedInstallable: true,
    completedReceipts: receiptSet.receipts.map((entry) => ({ ...entry })),
    receiptSetSha256: runtimeSha256(receiptSetBytes),
    boundary: PROMOTED_PUBLICATION_BOUNDARY,
  };
  return validateAuthority(promoted);
}

export async function atomicReplaceRuntimeAuthorityFile(
  authorityPath,
  originalBytes,
  nextAuthority
) {
  if (process.platform === 'win32') {
    fail('atomic authority replacement is not certified on win32; use a reviewed POSIX checkout');
  }
  const directory = path.dirname(authorityPath);
  const temporary = path.join(
    directory,
    `.${path.basename(authorityPath)}.${process.pid}.${Date.now()}.tmp`
  );
  let created = false;
  let directoryHandle;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    created = true;
    try {
      await handle.writeFile(canonicalRuntimeJson(nextAuthority));
      await handle.sync();
      await handle.chmod(0o644);
    } finally {
      await handle.close();
    }
    const current = await readFile(authorityPath);
    if (!current.equals(originalBytes)) fail('authority changed during promotion review');
    const info = await lstat(authorityPath);
    if (!info.isFile() || info.isSymbolicLink()) fail('authority target changed during promotion');
    directoryHandle = await open(directory, 'r');
    await rename(temporary, authorityPath);
    created = false;
    let postRenameError;
    try {
      await directoryHandle.sync();
    } catch (error) {
      postRenameError = error;
    }
    try {
      await directoryHandle.close();
    } catch (error) {
      postRenameError ??= error;
    } finally {
      directoryHandle = undefined;
    }
    if (postRenameError) {
      const durabilityError = new Error(
        'authority was atomically replaced, but directory durability confirmation failed; promotion is present with durability unconfirmed',
        { cause: postRenameError }
      );
      durabilityError.code = 'E_PROMOTION_DURABILITY_UNCONFIRMED';
      throw durabilityError;
    }
  } finally {
    if (directoryHandle) await directoryHandle.close();
    if (created) await rm(temporary, { force: true });
  }
}

async function acquirePromotionLock(repository) {
  const repositoryKey = createHash('sha256').update(repository).digest('hex');
  const lockPath = path.join(os.tmpdir(), `dsh-alpha2-runtime-promotion-${repositoryKey}.lock`);
  let handle;
  try {
    handle = await open(lockPath, 'wx', 0o600);
    await handle.writeFile(`${process.pid}\n`);
    await handle.sync();
    return { handle, lockPath };
  } catch (error) {
    if (handle) await handle.close();
    if (error.code === 'EEXIST') fail('another alpha.2 runtime promotion holds the checkout lock');
    throw error;
  }
}

async function releasePromotionLock(lock) {
  await lock.handle.close();
  await rm(lock.lockPath, { force: true });
}

export async function promoteRuntimeAuthority({ candidate, provenance, authorityPath, ghPath }) {
  if (![candidate, provenance, authorityPath, ghPath].every(path.isAbsolute)) {
    fail('--candidate, --provenance, --authority, and --gh must be absolute paths');
  }
  if (path.resolve(authorityPath) !== path.resolve(canonicalAuthorityPath)) {
    fail('--authority must name the bundled alpha.2 authority exactly');
  }
  const repository = path.resolve(path.dirname(canonicalWorkflowPath), '../..');
  const lock = await acquirePromotionLock(repository);
  try {
    const info = await lstat(authorityPath);
    if (!info.isFile() || info.isSymbolicLink() ||
        await realpath(authorityPath) !== path.resolve(canonicalAuthorityPath)) {
      fail('bundled authority must be a real regular file');
    }
    const originalBytes = await readFile(authorityPath);
    let authority;
    try {
      authority = validateAuthority(JSON.parse(originalBytes));
    } catch {
      fail('bundled authority is not a valid alpha.2 authority');
    }
    if (authority.publication.status !== 'official-npm-runtime-evidence-pending') {
      fail('bundled authority is already promoted; promotion accepts only the exact pending 0/6 authority');
    }
    if (git(repository, ['status', '--porcelain=v1', '--untracked-files=all']) !== '') {
      fail('promotion requires an entirely clean exact checkout');
    }
    const verified = await verifyRuntimeCandidate({
      candidate,
      workflowPath: canonicalWorkflowPath,
      authority,
    });
    const signed = await verifyRuntimeProvenance({
      subject: path.join(candidate, 'runtime-receipt-set.json'),
      bundle: provenance,
      runId: verified.receiptSet.workflow.runId,
      runAttempt: verified.receiptSet.workflow.runAttempt,
      sourceSha: verified.receiptSet.workflow.headSha,
      ghPath,
    });
    if (signed.subjectSha256 !== runtimeSha256(verified.receiptSetBytes)) {
      fail('signed provenance subject differs from the structurally verified receipt set');
    }
    const promoted = buildPromotedRuntimeAuthority(authority, verified);

    // Final write-adjacent TOCTOU fence: re-check clean state, HEAD, target identity,
    // and compare-and-swap bytes after all candidate and signature validation.
    if (git(repository, ['status', '--porcelain=v1', '--untracked-files=all']) !== '' ||
        git(repository, ['rev-parse', 'HEAD']) !== verified.receiptSet.workflow.headSha) {
      fail('promotion checkout changed after evidence verification');
    }
    const finalInfo = await lstat(authorityPath);
    if (!finalInfo.isFile() || finalInfo.isSymbolicLink() ||
        await realpath(authorityPath) !== path.resolve(canonicalAuthorityPath) ||
        !(await readFile(authorityPath)).equals(originalBytes)) {
      fail('authority changed after evidence verification');
    }
    await atomicReplaceRuntimeAuthorityFile(authorityPath, originalBytes, promoted);
    return {
      status: 'runtime-authority-promoted',
      completedReceipts: promoted.publication.completedReceipts.length,
      receiptSetSha256: promoted.publication.receiptSetSha256,
    };
  } finally {
    await releasePromotionLock(lock);
  }
}

export async function isDirectRuntimePromotionInvocation(argvPath = process.argv[1]) {
  if (typeof argvPath !== 'string' || argvPath.length === 0) return false;
  const modulePath = fileURLToPath(import.meta.url);
  const canonicalModulePath = await realpath(modulePath);
  try {
    return await realpath(path.resolve(argvPath)) === canonicalModulePath;
  } catch {
    if (path.resolve(argvPath) === path.resolve(modulePath)) {
      fail('promotion CLI entrypoint identity could not be canonicalized');
    }
    return false;
  }
}

function parseArgs(argv) {
  if (argv.length !== 8) {
    fail('usage: promote-runtime-authority.mjs --candidate <absolute-dir> --provenance <absolute-bundle> --authority <absolute-json> --gh <absolute-pinned-gh>');
  }
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--candidate', '--provenance', '--authority', '--gh'].includes(key) || !value || options[key]) {
      fail('usage: promote-runtime-authority.mjs --candidate <absolute-dir> --provenance <absolute-bundle> --authority <absolute-json> --gh <absolute-pinned-gh>');
    }
    options[key] = value;
  }
  if (!options['--candidate'] || !options['--provenance'] || !options['--authority'] || !options['--gh']) {
    fail('usage: promote-runtime-authority.mjs --candidate <absolute-dir> --provenance <absolute-bundle> --authority <absolute-json> --gh <absolute-pinned-gh>');
  }
  return {
    candidate: options['--candidate'],
    provenance: options['--provenance'],
    authorityPath: options['--authority'],
    ghPath: options['--gh'],
  };
}

if (await isDirectRuntimePromotionInvocation()) {
  try {
    process.stdout.write(`${JSON.stringify(
      await promoteRuntimeAuthority(parseArgs(process.argv.slice(2)))
    )}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
