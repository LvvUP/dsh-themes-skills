import { createHash, randomBytes } from 'node:crypto';
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  realpath,
  unlink,
} from 'node:fs/promises';
import { join, parse, relative, resolve } from 'node:path';

function inside(parent, child) {
  const path = relative(parent, child);
  return path && !path.startsWith('..') && !parse(path).root;
}

async function privateDirectory(parent, name) {
  const path = join(parent, name);
  if (!inside(parent, path)) throw new Error(`unsafe artifact directory: ${name}`);
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${name} must be a real directory`);
  }
  if ((info.mode & 0o077) !== 0) {
    throw new Error(`${name} must not be accessible by group or other users`);
  }
  if ((await realpath(path)) !== path) {
    throw new Error(`${name} must not resolve through a symlink`);
  }
  return path;
}

async function hashOpenedFile(handle, maxBytes) {
  const initial = await handle.stat();
  if (!initial.isFile() || initial.size < 1 || initial.size > maxBytes) {
    throw new Error('plugin artifact must be a regular allowlisted file within 64 MiB');
  }
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of handle.createReadStream({ autoClose: false })) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      throw new Error('plugin artifact exceeded the Manager size limit while reading');
    }
    digest.update(chunk);
  }
  const final = await handle.stat();
  if (
    bytes !== initial.size ||
    final.size !== initial.size ||
    final.dev !== initial.dev ||
    final.ino !== initial.ino
  ) {
    throw new Error('plugin artifact changed while it was being read');
  }
  return { digest: digest.digest('hex'), size: bytes, info: initial };
}

async function verifyExistingSnapshot(path, expectedDigest, expectedSize, maxBytes) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== expectedSize) {
    throw new Error('existing verified artifact snapshot is not a stable regular file');
  }
  if ((info.mode & 0o077) !== 0) {
    throw new Error('existing verified artifact snapshot has unsafe permissions');
  }
  const handle = await open(path, 'r');
  try {
    const verified = await hashOpenedFile(handle, maxBytes);
    if (verified.digest !== expectedDigest) {
      throw new Error('existing verified artifact snapshot digest does not match its name');
    }
  } finally {
    await handle.close();
  }
}

export async function snapshotAllowedArtifact(
  artifactPath,
  {
    workspace = process.cwd(),
    allowedDigests,
    maxBytes = 64 * 1024 * 1024,
  }
) {
  if (!(allowedDigests instanceof Set)) {
    throw new TypeError('allowedDigests must be a Set');
  }
  const canonicalWorkspace = await realpath(resolve(workspace));
  if (canonicalWorkspace === parse(canonicalWorkspace).root) {
    throw new Error('plugin add workspace cannot be a filesystem root');
  }
  const sourcePath = resolve(artifactPath);
  if (sourcePath !== artifactPath) {
    throw new Error('plugin artifact must use an absolute path');
  }
  const pathInfo = await lstat(sourcePath);
  if (
    !pathInfo.isFile() ||
    pathInfo.isSymbolicLink() ||
    pathInfo.size < 1 ||
    pathInfo.size > maxBytes
  ) {
    throw new Error('plugin artifact must be a regular allowlisted file within 64 MiB');
  }

  const source = await open(sourcePath, 'r');
  let incomingPath;
  try {
    const openedInfo = await source.stat();
    if (
      !openedInfo.isFile() ||
      openedInfo.size !== pathInfo.size ||
      openedInfo.dev !== pathInfo.dev ||
      openedInfo.ino !== pathInfo.ino
    ) {
      throw new Error('plugin artifact changed while it was being opened');
    }

    const control = await privateDirectory(canonicalWorkspace, '.dsh-themes');
    const snapshots = await privateDirectory(control, 'verified-artifacts');
    incomingPath = join(
      snapshots,
      `.incoming-${process.pid}-${randomBytes(8).toString('hex')}.tgz`
    );
    const destination = await open(incomingPath, 'wx', 0o600);
    const digest = createHash('sha256');
    let bytes = 0;
    try {
      for await (const chunk of source.createReadStream({ autoClose: false })) {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          throw new Error('plugin artifact exceeded the Manager size limit while reading');
        }
        digest.update(chunk);
        let offset = 0;
        while (offset < chunk.length) {
          const { bytesWritten } = await destination.write(
            chunk,
            offset,
            chunk.length - offset,
            null
          );
          if (bytesWritten < 1) {
            throw new Error('plugin artifact snapshot write made no progress');
          }
          offset += bytesWritten;
        }
      }
      await destination.sync();
    } finally {
      await destination.close();
    }
    const finalInfo = await source.stat();
    const sha256 = digest.digest('hex');
    if (
      bytes !== openedInfo.size ||
      finalInfo.size !== openedInfo.size ||
      finalInfo.dev !== openedInfo.dev ||
      finalInfo.ino !== openedInfo.ino ||
      !allowedDigests.has(sha256)
    ) {
      throw new Error('plugin artifact is not in the current install allowlist');
    }

    const snapshotPath = join(snapshots, `${sha256}.tgz`);
    let reused = false;
    try {
      await link(incomingPath, snapshotPath);
      await chmod(snapshotPath, 0o600);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      reused = true;
      await verifyExistingSnapshot(snapshotPath, sha256, bytes, maxBytes);
    }
    await unlink(incomingPath);
    incomingPath = undefined;
    return { path: snapshotPath, sha256, size: bytes, reused };
  } finally {
    await source.close();
    if (incomingPath) await unlink(incomingPath).catch(() => undefined);
  }
}
