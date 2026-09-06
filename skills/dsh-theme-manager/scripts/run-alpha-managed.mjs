import { resolve } from 'node:path';
import { loadAlphaHostedAuthority } from './alpha-authority.mjs';
import { snapshotAllowedArtifact } from './artifact-snapshot.mjs';
import { main as runAlpha, verifyAlphaBuild } from './dsh-alpha.mjs';
import { buildDshChildArgs, isAllowedRunnerCommand } from './runner-policy.mjs';

/** The source runner retains the Manager's narrow command grammar and exact artifact snapshots. */
export async function runAlphaManaged(values) {
  if (!isAllowedRunnerCommand(values)) throw new Error('Unsupported Alpha Manager command.');
  verifyAlphaBuild();
  const args = [...values];
  if (args[0] === 'plugin' && args[3] === 'add') {
    if (resolve(args[4]) !== args[4]) throw new Error('The verified artifact path must be absolute.');
    const authority = loadAlphaHostedAuthority();
    if (authority.status !== 'runtime-verified')
      throw new Error('Final Alpha hosted package verification is not complete.');
    const snapshot = await snapshotAllowedArtifact(args[4], {
      workspace: process.cwd(),
      allowedDigests: new Set(authority.entries.map((entry) => entry.artifactSha256)),
    });
    args[4] = snapshot.path;
  }
  return runAlpha(buildDshChildArgs(args, resolve));
}
