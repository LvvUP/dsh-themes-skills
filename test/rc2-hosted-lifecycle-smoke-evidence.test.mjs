import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  CURRENT_CATALOG_INDEX_SHA256,
  CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
} from "../skills/dsh-theme-manager/scripts/hosted-artifact-authority.mjs";

const evidenceRoot = resolve(
  "skills/dsh-theme-manager/references/rc2-hosted-lifecycle-smoke",
);
const indexPath = resolve(evidenceRoot, "index.json");
const authorityPaths = {
  candidateSidecarSha256: resolve(
    "skills/dsh-theme-manager/references/dsh-0.1.1-rc.2.candidate.json",
  ),
  pendingRuntimeAttestationSha256: resolve(
    "skills/dsh-theme-manager/runtime-dsh-0.1.1-rc.2/attestation.json",
  ),
  pendingCertificationReceiptSha256: resolve(
    "skills/dsh-theme-manager/references/certification-receipt.dsh-0.1.1-rc.2.pending.json",
  ),
  runnerLockfileSha256: resolve(
    "skills/dsh-theme-manager/runtime-dsh-0.1.1-rc.2/pnpm-lock.yaml",
  ),
};
const SHA256 = /^[0-9a-f]{64}$/;
const EXPECTED_PUBLIC_HEAD = "70a58c43bf95536b07077151b338ca0a9742bc68";
const EXPECTED_PRIVATE_RUNNER_HEAD = "349b9e674e0b20466c223e77c92cbf208c1ab349";
const EXPECTED_PRIVATE_RUNNER_BLOB = "f962741c2e6197dc1de8e4c0ccbfc7f3d359145b";
const EXPECTED_RAW_SET_SHA256 =
  "fa8988f2e83b7d50e153f8c7faab06f389a196a46a24be87eb67efa6061fa259";
const EXPECTED_ARCHIVED_SET_SHA256 =
  "2170e123ae115a8898c49a1b96ba7388b73cc4ed7953317313232abb9b47a0b8";
const EXPECTED_SMOKE_HOSTED_INDEX_SHA256 =
  "f706364d3f44fb0667147155c8400fe456da482fb908625e4d4c2c301022bbe6";
const EXPECTED_SLUGS = [
  "abyssal-maid",
  "arcana-nocturne",
  "arctic-panel",
  "argentina-matchday",
  "bamboo-quietude",
  "banff-alpine",
  "copper-wire",
  "deep-ocean",
  "eiffel-lumiere",
  "england-matchday",
  "fire-horse-chronicle",
  "frontier-ink",
  "germany-matchday",
  "graphite-relay",
  "harbour-pulse",
  "high-signal",
  "jade-circuit",
  "jianghu-ink",
  "liberty-ink",
  "neon-afterline",
  "paper-console",
  "quiet-matrix",
  "reasoning-tide",
  "redline-02",
  "sakura-kawaii",
  "savanna-horizon",
  "solar-trace",
  "spain-matchday",
  "st-basils-avant",
  "suomenlinna-nordic",
  "swanstone-modern",
  "yellowstone-wpa",
];
const EXPECTED_PENDING = [
  "lightDarkSystem",
  "featureActivation",
  "visualAccessibility",
  "rollbackReverse",
];
const EXPECTED_STEPS = [
  "initial-list",
  "add-exact-artifact",
  "list-after-add",
  "remove-exact-package",
  "final-list",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNoLocalOrSecretMaterial(value, label) {
  const text = JSON.stringify(value);
  assert.doesNotMatch(
    text,
    /\/(?:Users|home|tmp|var\/folders)\//,
    `${label} contains an absolute local path`,
  );
  assert.doesNotMatch(
    text,
    /[A-Za-z]:[\\/]/,
    `${label} contains a Windows absolute path`,
  );
  assert.doesNotMatch(text, /file:\/\//i, `${label} contains a file URL`);
  assert.doesNotMatch(
    text,
    /"(?:authorization|cookie|password|apiKey|secret)"\s*:/i,
    `${label} contains a credential-bearing field`,
  );
  assert.doesNotMatch(
    text,
    /(?:BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{20,})/,
    `${label} contains secret-shaped material`,
  );
}

async function loadBundle() {
  const indexBytes = await readFile(indexPath);
  const index = JSON.parse(indexBytes.toString("utf8"));
  const authorityDigests = Object.fromEntries(
    await Promise.all(
      Object.entries(authorityPaths).map(async ([name, path]) => [
        name,
        sha256(await readFile(path)),
      ]),
    ),
  );
  const receipts = new Map();
  for (const entry of index.receipts) {
    const bytes = await readFile(resolve(entry.path));
    receipts.set(entry.path, {
      bytes,
      value: JSON.parse(bytes.toString("utf8")),
    });
  }
  return { authorityDigests, index, indexBytes, receipts };
}

function validateBundle(index, receipts, authorityDigests) {
  assert.equal(index.schemaVersion, 1);
  assert.equal(
    index.evidenceKind,
    "rc2-hosted-current-bytes-lifecycle-smoke-set-sanitized-non-promotional",
  );
  assert.equal(index.promotionAuthority, false);
  assert.equal(index.installable, false);
  assert.equal(index.baseline, "@deepseek-ai/dsh@0.1.1-rc.2");
  assert.deepEqual(index.environment, {
    platform: "darwin",
    arch: "arm64",
    nodeVersion: "24.15.0",
  });
  assert.equal(index.source.publicCandidateHead, EXPECTED_PUBLIC_HEAD);
  assert.equal(index.source.privateRunnerHead, EXPECTED_PRIVATE_RUNNER_HEAD);
  assert.equal(index.source.privateRunnerGitBlob, EXPECTED_PRIVATE_RUNNER_BLOB);
  assert.equal(
    index.source.privateRunnerPath,
    "scripts/dsh-rc2-hosted-lifecycle-smoke.mjs",
  );
  assert.equal(index.scope.receiptCount, 32);
  assert.equal(index.scope.themeCount, 6);
  assert.equal(index.scope.fullSkinCount, 26);
  assert.equal(index.scope.status, "lifecycle-smoke-passed");
  assert.deepEqual(index.scope.pendingChecks, [
    ...EXPECTED_PENDING,
    "rc2HostedArtifactRepack",
    "rc2SelectorCatalog",
    "finalRuntimeAttestation",
  ]);
  assert.equal(index.aggregate.ordering, "slug-ascending");
  assert.equal(index.aggregate.rawReceiptSetSha256, EXPECTED_RAW_SET_SHA256);
  assert.equal(
    index.aggregate.archivedReceiptSetSha256,
    EXPECTED_ARCHIVED_SET_SHA256,
  );
  assert.deepEqual(index.authorityBindings, {
    ...authorityDigests,
    hostedIndexSha256: EXPECTED_SMOKE_HOSTED_INDEX_SHA256,
  });
  assert.notEqual(
    CURRENT_CATALOG_INDEX_SHA256,
    EXPECTED_SMOKE_HOSTED_INDEX_SHA256,
    "the immutable smoke archive should retain its prior index binding while current catalog metadata evolves",
  );

  const slugs = index.receipts.map(({ slug }) => slug);
  assert.deepEqual(slugs, EXPECTED_SLUGS);
  assert.equal(new Set(slugs).size, 32);
  assert.equal(receipts.size, 32);
  assert.equal(CURRENT_INSTALLABLE_HOSTED_ARTIFACTS.size, 32);

  for (const entry of index.receipts) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(entry.packageName, `@dsh-themes/${entry.slug}`);
    assert.match(entry.artifactSha256, SHA256);
    assert.match(entry.rawReceiptSha256, SHA256);
    assert.equal(entry.embeddedCompatibilityBaseline, "0.1.0-rc.8");
    assert.equal(
      CURRENT_INSTALLABLE_HOSTED_ARTIFACTS.get(
        `${entry.packageName}@${entry.version}`,
      ),
      entry.artifactSha256,
      `${entry.slug}: lifecycle receipt differs from hosted authority`,
    );
    assert.equal(
      entry.path,
      `skills/dsh-theme-manager/references/rc2-hosted-lifecycle-smoke/${entry.slug}.json`,
    );

    const archived = receipts.get(entry.path);
    assert.ok(archived, `${entry.slug}: receipt file is missing`);
    assert.equal(sha256(archived.bytes), entry.sha256, entry.slug);
    const receipt = archived.value;
    assert.equal(receipt.schemaVersion, 1);
    assert.equal(
      receipt.receiptKind,
      "rc2-hosted-current-bytes-lifecycle-smoke-sanitized-non-promotional",
    );
    assert.equal(receipt.promotionAuthority, false);
    assert.equal(receipt.installable, false);
    assert.equal(receipt.status, "lifecycle-smoke-passed");
    assert.equal(receipt.baseline, index.baseline);
    assert.equal(
      receipt.source.publicCandidateRepository,
      index.source.publicCandidateRepository,
    );
    assert.equal(receipt.source.publicCandidateHead, EXPECTED_PUBLIC_HEAD);
    assert.equal(
      receipt.source.privateRunnerRepository,
      index.source.privateRunnerRepository,
    );
    assert.equal(
      receipt.source.privateRunnerHead,
      EXPECTED_PRIVATE_RUNNER_HEAD,
    );
    assert.equal(
      receipt.source.privateRunnerGitBlob,
      EXPECTED_PRIVATE_RUNNER_BLOB,
    );
    assert.equal(
      receipt.source.privateRunnerPath,
      index.source.privateRunnerPath,
    );
    assert.equal(receipt.source.rawReceipt.sha256, entry.rawReceiptSha256);
    assert.equal(receipt.source.rawReceipt.published, false);
    assert.equal(receipt.target.slug, entry.slug);
    assert.equal(receipt.target.kind, entry.kind);
    assert.equal(receipt.target.packageName, entry.packageName);
    assert.equal(receipt.target.version, entry.version);
    assert.equal(receipt.target.artifactSha256, entry.artifactSha256);
    assert.equal(receipt.target.embeddedCompatibilityBaseline, "0.1.0-rc.8");
    assert.deepEqual(receipt.environment, index.environment);
    assert.equal(receipt.candidate.status, "certification-pending");
    assert.equal(receipt.candidate.installable, false);
    assert.equal(
      receipt.candidate.sidecarSha256,
      index.authorityBindings.candidateSidecarSha256,
    );
    assert.equal(
      receipt.candidate.attestationSha256,
      index.authorityBindings.pendingRuntimeAttestationSha256,
    );
    assert.equal(
      receipt.candidate.receiptSha256,
      index.authorityBindings.pendingCertificationReceiptSha256,
    );
    assert.equal(
      receipt.candidate.lockfileSha256,
      index.authorityBindings.runnerLockfileSha256,
    );
    assert.equal(receipt.candidate.completedMatrixJobs, 0);
    assert.equal(receipt.candidate.requiredMatrixJobs, 6);
    assert.equal(
      receipt.target.artifactFile,
      `${entry.slug}-${entry.version}.tgz`,
    );
    assert.equal(
      receipt.target.hostedIndexSha256,
      index.authorityBindings.hostedIndexSha256,
    );
    assert.equal(receipt.isolation.disposableDshHome, true);
    assert.equal(receipt.isolation.loopbackOnly, true);
    assert.equal(receipt.isolation.cleanupRequired, false);
    assert.equal(receipt.isolation.profileRemoved, true);
    assert.deepEqual(
      receipt.steps.map(({ label }) => label),
      EXPECTED_STEPS,
    );
    for (const step of receipt.steps) {
      assert.equal(step.code, 0);
      assert.equal(step.signal, null);
      assert.equal(step.processOutput.rawLogsExcluded, true);
      assert.deepEqual(Object.keys(step.processOutput.stdout).sort(), [
        "bytes",
        "sha256",
      ]);
      assert.deepEqual(Object.keys(step.processOutput.stderr).sort(), [
        "bytes",
        "sha256",
      ]);
      assert.match(step.processOutput.stdout.sha256, SHA256);
      assert.match(step.processOutput.stderr.sha256, SHA256);
    }
    assert.equal(receipt.coldStarts.length, 2);
    for (const start of [
      ...receipt.coldStarts,
      receipt.postRemovalBuiltInStart,
    ]) {
      assert.equal(start.loopbackHttp, true);
      assert.equal(start.html.contentType, "text/html; charset=utf-8");
      assert.match(start.html.sha256, SHA256);
      assert.ok(start.clientModuleGraph.moduleCount > 0);
      assert.ok(start.clientModuleGraph.totalBytes > 0);
      assert.match(start.clientModuleGraph.modulesSha256, SHA256);
      assert.match(start.clientModuleGraph.graphSha256, SHA256);
      assert.equal(start.processOutput.rawLogExcluded, true);
    }
    assert.deepEqual(receipt.acceptance, {
      exactArtifactIdentity: "passed",
      installListRemove: "passed",
      clientModuleGraphHttpMime: "passed",
      twoManagedColdStarts: "passed",
      postRemovalBuiltInColdStart: "passed",
      lightDarkSystem: "pending",
      featureActivation: "pending",
      visualAccessibility: "pending",
      rollbackReverse: "pending",
    });
    assert.deepEqual(
      Object.entries(receipt.acceptance)
        .filter(([, status]) => status === "pending")
        .map(([name]) => name),
      EXPECTED_PENDING,
    );
    assert.deepEqual(receipt.sanitization, {
      absoluteLocalPathsExcluded: true,
      rawCommandOutputExcluded: true,
      credentialsExcluded: true,
      loopbackPortsExcluded: true,
    });
    assertNoLocalOrSecretMaterial(receipt, entry.slug);
  }

  const rawLines =
    index.receipts
      .map(({ slug, rawReceiptSha256 }) => `${slug}\t${rawReceiptSha256}`)
      .join("\n") + "\n";
  const archivedLines =
    index.receipts
      .map(
        ({ slug, artifactSha256, rawReceiptSha256, sha256: receiptSha256 }) =>
          `${slug}\t${artifactSha256}\t${rawReceiptSha256}\t${receiptSha256}`,
      )
      .join("\n") + "\n";
  assert.equal(sha256(Buffer.from(rawLines)), EXPECTED_RAW_SET_SHA256);
  assert.equal(
    sha256(Buffer.from(archivedLines)),
    EXPECTED_ARCHIVED_SET_SHA256,
  );
  assertNoLocalOrSecretMaterial(index, "index");
}

test("RC.2 hosted lifecycle archive covers all 32 current hosted byte tuples", async () => {
  const bundle = await loadBundle();
  validateBundle(bundle.index, bundle.receipts, bundle.authorityDigests);

  const files = (await readdir(evidenceRoot)).sort();
  assert.deepEqual(
    files,
    [...EXPECTED_SLUGS.map((slug) => `${slug}.json`), "index.json"].sort(),
  );
});

test("RC.2 hosted lifecycle archive is fail-closed against promotion and tampering", async () => {
  const bundle = await loadBundle();

  const promoted = clone(bundle.index);
  promoted.promotionAuthority = true;
  assert.throws(() =>
    validateBundle(promoted, bundle.receipts, bundle.authorityDigests),
  );

  const installable = clone(bundle.index);
  installable.installable = true;
  assert.throws(() =>
    validateBundle(installable, bundle.receipts, bundle.authorityDigests),
  );

  const wrongDigest = clone(bundle.index);
  wrongDigest.receipts[0].sha256 = "0".repeat(64);
  assert.throws(() =>
    validateBundle(wrongDigest, bundle.receipts, bundle.authorityDigests),
  );

  const missingReceipt = new Map(bundle.receipts);
  missingReceipt.delete(bundle.index.receipts[0].path);
  assert.throws(() =>
    validateBundle(bundle.index, missingReceipt, bundle.authorityDigests),
  );

  const localPath = clone(bundle.index);
  localPath.source.privateRunnerPath = "/Users/example/private-script.mjs";
  assert.throws(() =>
    validateBundle(localPath, bundle.receipts, bundle.authorityDigests),
  );

  const driftedAuthority = {
    ...bundle.authorityDigests,
    candidateSidecarSha256: "0".repeat(64),
  };
  assert.throws(() =>
    validateBundle(bundle.index, bundle.receipts, driftedAuthority),
  );
});
