import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  alphaSha256,
  stableAlphaJson,
  validateAlphaHostedAuthority,
} from "../skills/dsh-theme-manager/scripts/alpha-authority.mjs";

const reference = new URL(
  "../skills/dsh-theme-manager/references/",
  import.meta.url,
);
const parentFile = "alpha-hosted-artifacts-layout-20260906.json";
const parentSha =
  "cfda9bf95549ea7d6d9d80aa2828123281d0940bdf0c916d6919acce284c4c50";
const parentBytes = await readFile(new URL(parentFile, reference));
assert.equal(alphaSha256(parentBytes), parentSha);
const parent = JSON.parse(parentBytes);
const preserved = new Map(
  await Promise.all(
    [
      "alpha-hosted-artifacts-initial.json",
      "alpha-hosted-artifacts-refresh-20260906.json",
      ...parent.receiptRegistry.map((row) => row.file),
    ].map(async (file) => [file, await readFile(new URL(file, reference))]),
  ),
);
preserved.set(parentFile, parentBytes);
const ids = [2019, 2020, 2027, 2035, 2043, 2047];
const receiptFile = "alpha-hosted-runtime-welcome-layout-20260907.json";
const receiptId = "welcome-layout-20260907-6";

function fixture() {
  // Synthetic contract inputs only. Never saved as a runtime receipt or publication authority.
  const authority = structuredClone(parent),
    files = new Map(preserved),
    results = [];
  Object.assign(authority, {
    schemaVersion: 4,
    previousAuthority: { file: parentFile, sha256: parentSha },
    retainedPackageCount: 48,
    refreshedPackageCount: 6,
  });
  const entries = ids.map((id) =>
    authority.entries.find((row) => row.catalogId === id),
  );
  for (const entry of entries) {
    const oldReceipt = JSON.parse(
      files.get(
        parent.receiptRegistry.find((row) => row.id === entry.runtimeReceiptId)
          .file,
      ),
    );
    const result = structuredClone(
      oldReceipt.results.find((row) => row.catalogId === entry.catalogId),
    );
    entry.version = entry.version.replace(/alpha\.2$/, "alpha.3");
    entry.artifactSha256 = alphaSha256(
      `synthetic-normal-artifact:${entry.catalogId}`,
    );
    entry.payloadSha256 = alphaSha256(
      `synthetic-normal-payload:${entry.catalogId}`,
    );
    entry.runtimeReceiptId = receiptId;
    const manifest = entry.releaseRecord.manifest;
    manifest.version = manifest.artifact.version = entry.version;
    manifest.artifact.fileName = `${entry.slug}-${entry.version}.tgz`;
    manifest.artifact.sha256 = entry.artifactSha256;
    manifest.artifact.integrity = `sha256-${Buffer.from(entry.artifactSha256, "hex").toString("base64")}`;
    manifest.payload.fileName = `${entry.slug}-${entry.version}.payload.tar`;
    manifest.payload.sha256 = entry.payloadSha256;
    manifest.payload.integrity = `sha256-${Buffer.from(entry.payloadSha256, "hex").toString("base64")}`;
    delete manifest.visual.desktopWelcomeLayout;
    delete manifest.visual.desktopWelcomeSurface;
    for (const mode of ["light", "dark"]) {
      const sha = alphaSha256(
        `synthetic-normal-preview:${entry.catalogId}:${mode}`,
      );
      const asset = manifest.assets.find(
        (row) => row.role === `preview-${mode}`,
      );
      Object.assign(asset, {
        sha256: sha,
        path: `assets/${sha}.webp`,
        url: `/__dsh-themes/${entry.slug}/assets/${sha}.webp`,
      });
      Object.assign(manifest.preview[mode], { sha256: sha, url: asset.url });
    }
    entry.manifestCanonicalSha256 = alphaSha256(stableAlphaJson(manifest));
    Object.assign(entry.releaseRecord, {
      artifactSha256: entry.artifactSha256,
      artifactUrl: `https://dsh-themes.com/api/themes/${entry.slug}/download/${entry.version}`,
    });
    Object.assign(result, {
      artifactSha256: entry.artifactSha256,
      manifestSha256: alphaSha256(`synthetic-manifest:${entry.catalogId}`),
      packedManifestSha256: alphaSha256(`synthetic-packed:${entry.catalogId}`),
    });
    for (const phase of ["rendered", "coldRestart"])
      for (const mode of result[phase].modes) {
        delete mode.welcomeSurfaces;
        for (const resource of mode.resources) {
          const asset = manifest.assets.find(
            (row) => row.role === resource.role,
          );
          if (asset)
            Object.assign(resource, {
              url: asset.url,
              sha256: asset.sha256,
              expectedSha256: asset.sha256,
              sizeBytes: asset.sizeBytes,
            });
          else if (resource.role === "skin-css")
            resource.sha256 = resource.expectedSha256 = alphaSha256(
              `synthetic-css:${entry.catalogId}`,
            );
        }
      }
    for (const mode of result.recovery.modes) {
      mode.settingsLayout = structuredClone(
        result.rendered.modes.find((row) => row.mode === mode.mode)
          .settingsLayout,
      );
      mode.settingsLayout.status = "baseline-observation";
    }
    result.recovery.recoveryResources = [
      `/__dsh-themes/${entry.slug}/skin.css`,
      ...manifest.assets.map((asset) => asset.url),
    ].map((url) => ({ url, status: 404 }));
    results.push(result);
  }
  const receipt = {
    schemaVersion: 1,
    stage: "final",
    status: "passed",
    indexSha256: alphaSha256("synthetic-normal-final-index"),
    dshVersion: "0.1.3-alpha.1",
    sourceCommit: parent.sourceCommit,
    requestedSlugs: entries.map((entry) => entry.slug),
    results,
  };
  const bytes = Buffer.from(JSON.stringify(receipt));
  files.set(receiptFile, bytes);
  authority.receiptRegistry.push({
    id: receiptId,
    file: receiptFile,
    sha256: alphaSha256(bytes),
    indexSha256: receipt.indexSha256,
    verifiedPackageCount: 6,
  });
  return {
    authority,
    files,
    entries,
    read: (file) => {
      assert.ok(files.has(file), "Unexpected evidence path");
      return files.get(file);
    },
  };
}
function rewriteReceipt(f, mutate) {
  const receipt = JSON.parse(f.files.get(receiptFile));
  mutate(receipt);
  const bytes = Buffer.from(JSON.stringify(receipt));
  f.files.set(receiptFile, bytes);
  f.authority.receiptRegistry[4].sha256 = alphaSha256(bytes);
}
function rehashManifest(entry) {
  entry.manifestCanonicalSha256 = alphaSha256(
    stableAlphaJson(entry.releaseRecord.manifest),
  );
}
function changeArtifact(f, id, sha) {
  const entry = f.entries.find((row) => row.catalogId === id);
  entry.artifactSha256 =
    entry.releaseRecord.artifactSha256 =
    entry.releaseRecord.manifest.artifact.sha256 =
      sha;
  entry.releaseRecord.manifest.artifact.integrity = `sha256-${Buffer.from(sha, "hex").toString("base64")}`;
  rehashManifest(entry);
  rewriteReceipt(f, (receipt) => {
    receipt.results.find((row) => row.catalogId === id).artifactSha256 = sha;
  });
}

test("historical schema 1, 2 and 3 authorities remain independently valid", () => {
  for (const file of [
    "alpha-hosted-artifacts-initial.json",
    "alpha-hosted-artifacts-refresh-20260906.json",
    parentFile,
  ]) {
    const authority = JSON.parse(preserved.get(file));
    assert.equal(
      validateAlphaHostedAuthority(authority, (file) => preserved.get(file)),
      authority,
    );
  }
});
test("synthetic contract control covers exactly six normal desktop layouts and forty-eight retained entries", () => {
  const f = fixture();
  assert.equal(validateAlphaHostedAuthority(f.authority, f.read), f.authority);
  assert.deepEqual(
    f.authority.entries.filter((row) => !ids.includes(row.catalogId)),
    parent.entries.filter((row) => !ids.includes(row.catalogId)),
  );
  assert.deepEqual(
    f.authority.receiptRegistry.slice(0, 4),
    parent.receiptRegistry,
  );
  for (const entry of f.entries) {
    const visual = structuredClone(
      parent.entries.find((row) => row.catalogId === entry.catalogId)
        .releaseRecord.manifest.visual,
    );
    delete visual.desktopWelcomeLayout;
    delete visual.desktopWelcomeSurface;
    assert.deepEqual(entry.releaseRecord.manifest.visual, visual);
  }
});
test("each of the forty-eight retained entries rejects edits or assignment to new evidence", () => {
  for (const previous of parent.entries.filter(
    (row) => !ids.includes(row.catalogId),
  ))
    for (const key of ["name", "runtimeReceiptId"]) {
      const f = fixture();
      f.authority.entries.find((row) => row.catalogId === previous.catalogId)[
        key
      ] = key === "name" ? "Changed retained work" : receiptId;
      assert.throws(
        () => validateAlphaHostedAuthority(f.authority, f.read),
        /Retained Alpha artifact/,
        `${previous.catalogId} ${key}`,
      );
    }
});
test("schema 4 rejects wrong parents, the withdrawn one-item panel composition and altered registrations", () => {
  for (const mutate of [
    (f) =>
      f.files.set(parentFile, Buffer.concat([parentBytes, Buffer.from(" ")])),
    (f) => (f.authority.previousAuthority.sha256 = "0".repeat(64)),
    (f) => (f.authority.previousAuthority.file = "../parent.json"),
    (f) => (f.authority.retainedPackageCount = 53),
    (f) => (f.authority.refreshedPackageCount = 1),
    (f) => (f.authority.retainedPackageCount = 50),
    (f) => (f.authority.refreshedPackageCount = 4),
    (f) => (f.authority.receiptRegistry[0].sha256 = "0".repeat(64)),
    (f) => (f.authority.receiptRegistry[3].id = "renamed-history"),
    (f) => (f.authority.receiptRegistry[4].id = "shiba-welcome-panel-20260907"),
    (f) => (f.authority.receiptRegistry[4].id = "welcome-layout-20260907-4"),
    (f) =>
      (f.authority.receiptRegistry[4].file =
        "alpha-hosted-runtime-shiba-welcome-panel-20260907.json"),
    (f) => (f.authority.receiptRegistry[4].file = "../outside.json"),
    (f) => (f.authority.receiptRegistry[4].verifiedPackageCount = 1),
    (f) => (f.authority.receiptRegistry[4].verifiedPackageCount = 4),
    (f) => (f.authority.receiptRegistry[4].sha256 = "0".repeat(64)),
    (f) => (f.authority.receiptRegistry[4].indexSha256 = "0".repeat(64)),
    (f) => f.authority.entries.pop(),
    (f) => (f.authority.entries[0] = structuredClone(f.entries[0])),
    (f) =>
      f.files.set(
        receiptFile,
        Buffer.concat([f.files.get(receiptFile), Buffer.from(" ")]),
      ),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});
test("each refreshed work rejects old archives, reassigned identity, stale previews and changes beyond two desktop fields", () => {
  for (const id of ids) {
    const old = parent.entries.find((row) => row.catalogId === id);
    const f = fixture();
    changeArtifact(f, id, old.artifactSha256);
    assert.throws(
      () => validateAlphaHostedAuthority(f.authority, f.read),
      /stale or reassigned/,
    );
    for (const mutate of [
      (entry) => (entry.catalogId = 2999),
      (entry) => (entry.slug = "other-work"),
      (entry) => (entry.name = "Other work"),
      (entry) => (entry.version = "1.0.0-alpha.4"),
      (entry) => (entry.runtimeReceiptId = old.runtimeReceiptId),
      (entry) => (entry.manifestCanonicalSha256 = "0".repeat(64)),
      (entry) => (entry.releaseRecord.manifest.payload.sha256 = "0".repeat(64)),
      (entry) =>
        (entry.releaseRecord.manifest.artifact.integrity = "sha256-invalid"),
      (entry) =>
        (entry.releaseRecord.artifactUrl = "https://other.example/archive.tgz"),
      (entry) =>
        (entry.releaseRecord.distribution.installability = "unrestricted"),
      (entry) =>
        (entry.releaseRecord.manifest.preview.light.sha256 =
          old.releaseRecord.manifest.preview.light.sha256),
      (entry) =>
        (entry.releaseRecord.manifest.preview.light.source = "artwork"),
      (entry) => delete entry.releaseRecord.manifest.preview.dark,
      (entry) =>
        (entry.releaseRecord.manifest.assets.find(
          (row) => row.role === "preview-light",
        ).width = 1),
      (entry) =>
        (entry.releaseRecord.manifest.assets.find(
          (row) => row.role === "background",
        ).sha256 = "0".repeat(64)),
      (entry) =>
        (entry.releaseRecord.manifest.tokens[
          "--dsw-alias-label-primary"
        ].light = "#FFFFFF"),
      (entry) =>
        (entry.releaseRecord.manifest.modeBackgrounds.light = "0".repeat(64)),
      (entry) =>
        (entry.releaseRecord.manifest.visual.desktopWelcomeLayout =
          "compact-left"),
      (entry) =>
        (entry.releaseRecord.manifest.visual.desktopWelcomeSurface = false),
      (entry) =>
        (entry.releaseRecord.manifest.visual.welcomeSurfaceStyle = "panel"),
      (entry) =>
        (entry.releaseRecord.manifest.visual.mobileWelcomeOffset = -60),
      (entry) =>
        (entry.releaseRecord.manifest.visual.mobileWelcomeSurface =
          !entry.releaseRecord.manifest.visual.mobileWelcomeSurface),
    ]) {
      const f = fixture(),
        entry = f.entries.find((row) => row.catalogId === id);
      mutate(entry);
      if (entry.manifestCanonicalSha256 !== "0".repeat(64))
        rehashManifest(entry);
      assert.throws(
        () => validateAlphaHostedAuthority(f.authority, f.read),
        undefined,
        `${id} ${mutate}`,
      );
    }
  }
});
test("rehashed receipts cannot hide wrong coverage, incomplete lifecycle, unreadable Settings or surviving resources", () => {
  for (const mutate of [
    (r) => (r.stage = "candidate"),
    (r) => (r.status = "failed"),
    (r) => (r.sourceCommit = "0".repeat(40)),
    (r) => (r.indexSha256 = "0".repeat(64)),
    (r) => (r.dshVersion = "0.1.0-rc.8"),
    (r) => (r.requestedSlugs = ["shiba-morning-post"]),
    (r) => r.results.pop(),
    (r) => (r.results[0] = structuredClone(r.results[1])),
  ]) {
    const f = fixture();
    rewriteReceipt(f, mutate);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
  for (const id of ids)
    for (const mutate of [
      (r) => (r.artifactSha256 = "0".repeat(64)),
      (r) => (r.manifestSha256 = "invalid"),
      (r) => (r.packedManifestSha256 = null),
      (r) => r.rendered.errors.push("failure"),
      (r) => (r.coldRestart.status = "failed"),
      (r) => delete r.recovery.errors,
      (r) => r.rendered.modes.pop(),
      (r) => (r.coldRestart.modes = []),
      (r) => r.recovery.modes.pop(),
      (r) => (r.rendered.modes[0].settingsLayout.contentReadable = false),
      (r) => (r.rendered.modes[0].settingsLayout.geometry.dialog.width = 20),
      (r) => (r.coldRestart.modes[0].settingsLayout.escape = "failed"),
      (r) => (r.recovery.modes[0].settingsLayout.status = "passed"),
      (r) => (r.recovery.modes[0].settingsLayout.contentReadable = false),
      (r) => (r.rendered.modes[0].welcomeSurfaces = []),
      (r) =>
        (r.rendered.modes[0].tokens["--dsw-alias-label-primary"] = "#FFFFFF"),
      (r) =>
        (r.rendered.modes[0].resources.find(
          (row) => row.role === "preview-light",
        ).expectedSha256 = "0".repeat(64)),
      (r) => r.coldRestart.modes[0].resources.pop(),
      (r) => (r.recovery.modes[0].dataSkin = "still-installed"),
      (r) => (r.recovery.recoveryResources[0].status = 200),
    ]) {
      const f = fixture();
      rewriteReceipt(f, (r) =>
        mutate(r.results.find((row) => row.catalogId === id)),
      );
      assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
    }
});
