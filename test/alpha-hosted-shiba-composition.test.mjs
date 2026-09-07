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
const parentBytes = await readFile(new URL(parentFile, reference)).catch(
  async (error) => {
    // Before publication the unchanged schema 3 authority is still the current file.
    if (error.code !== "ENOENT") throw error;
    return readFile(new URL("alpha-hosted-artifacts.json", reference));
  },
);
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
const receiptFile = "alpha-hosted-runtime-shiba-welcome-panel-20260907.json";
const receiptId = "shiba-welcome-panel-20260907";

function fixture() {
  // Synthetic contract fixture only, based on the retained measured field shape.
  // Never published or presented as a new runtime measurement or authorization.
  const authority = structuredClone(parent),
    files = new Map(preserved);
  const entry = authority.entries.find((row) => row.catalogId === 2043);
  const oldReceipt = JSON.parse(
    files.get(
      parent.receiptRegistry.find((row) => row.id === entry.runtimeReceiptId)
        .file,
    ),
  );
  const result = structuredClone(
    oldReceipt.results.find((row) => row.catalogId === 2043),
  );
  authority.schemaVersion = 4;
  authority.previousAuthority = { file: parentFile, sha256: parentSha };
  authority.retainedPackageCount = 53;
  authority.refreshedPackageCount = 1;
  entry.version = "1.0.1-alpha.3";
  entry.artifactSha256 = alphaSha256("synthetic-shiba-panel-artifact");
  entry.payloadSha256 = alphaSha256("synthetic-shiba-panel-payload");
  entry.runtimeReceiptId = receiptId;
  const manifest = entry.releaseRecord.manifest;
  manifest.version = entry.version;
  manifest.artifact.version = entry.version;
  manifest.artifact.fileName = `${entry.slug}-${entry.version}.tgz`;
  manifest.artifact.sha256 = entry.artifactSha256;
  manifest.artifact.integrity = `sha256-${Buffer.from(entry.artifactSha256, "hex").toString("base64")}`;
  manifest.payload.fileName = `${entry.slug}-${entry.version}.payload.tar`;
  manifest.payload.sha256 = entry.payloadSha256;
  manifest.payload.integrity = `sha256-${Buffer.from(entry.payloadSha256, "hex").toString("base64")}`;
  manifest.visual.mobileWelcomeOffset = -60;
  manifest.visual.welcomeSurfaceStyle = "panel";
  for (const mode of ["light", "dark"]) {
    const sha = alphaSha256("synthetic-shiba-panel-preview-" + mode);
    const asset = manifest.assets.find((row) => row.role === `preview-${mode}`);
    asset.sha256 = sha;
    asset.path = `assets/${sha}.webp`;
    asset.url = `/__dsh-themes/${entry.slug}/${asset.path}`;
    manifest.preview[mode].sha256 = sha;
    manifest.preview[mode].url = asset.url;
  }
  entry.manifestCanonicalSha256 = alphaSha256(stableAlphaJson(manifest));
  entry.releaseRecord.artifactSha256 = entry.artifactSha256;
  entry.releaseRecord.artifactUrl = `https://dsh-themes.com/api/themes/${entry.slug}/download/${entry.version}`;
  result.artifactSha256 = entry.artifactSha256;
  result.manifestSha256 = alphaSha256("synthetic-shiba-panel-manifest");
  result.packedManifestSha256 = alphaSha256(
    "synthetic-shiba-panel-packed-manifest",
  );
  for (const phase of ["rendered", "coldRestart"])
    for (const mode of result[phase].modes) {
      for (const resource of mode.resources) {
        const asset = manifest.assets.find((row) => row.role === resource.role);
        if (asset)
          Object.assign(resource, {
            url: asset.url,
            sha256: asset.sha256,
            expectedSha256: asset.sha256,
            sizeBytes: asset.sizeBytes,
          });
        else if (resource.role === "skin-css")
          resource.sha256 = resource.expectedSha256 = alphaSha256(
            "synthetic-shiba-panel-css",
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
  const receipt = {
    schemaVersion: 1,
    stage: "final",
    status: "passed",
    indexSha256: alphaSha256("synthetic-shiba-final-index"),
    dshVersion: oldReceipt.dshVersion,
    sourceCommit: oldReceipt.sourceCommit,
    requestedSlugs: [entry.slug],
    results: [result],
  };
  const bytes = Buffer.from(JSON.stringify(receipt));
  files.set(receiptFile, bytes);
  authority.receiptRegistry.push({
    id: receiptId,
    file: receiptFile,
    sha256: alphaSha256(bytes),
    indexSha256: receipt.indexSha256,
    verifiedPackageCount: 1,
  });
  return {
    authority,
    files,
    entry,
    read: (file) => {
      assert.ok(files.has(file), "Unexpected evidence path");
      return files.get(file);
    },
  };
}

function rewriteReceipt(fixture, mutate) {
  const receipt = JSON.parse(fixture.files.get(receiptFile));
  mutate(receipt);
  const bytes = Buffer.from(JSON.stringify(receipt));
  fixture.files.set(receiptFile, bytes);
  fixture.authority.receiptRegistry[4].sha256 = alphaSha256(bytes);
}

function rehashManifest(fixture) {
  fixture.entry.manifestCanonicalSha256 = alphaSha256(
    stableAlphaJson(fixture.entry.releaseRecord.manifest),
  );
}

function coherentArtifactChange(fixture, sha) {
  fixture.entry.artifactSha256 =
    fixture.entry.releaseRecord.artifactSha256 =
    fixture.entry.releaseRecord.manifest.artifact.sha256 =
      sha;
  fixture.entry.releaseRecord.manifest.artifact.integrity = `sha256-${Buffer.from(sha, "hex").toString("base64")}`;
  rehashManifest(fixture);
  rewriteReceipt(fixture, (receipt) => {
    receipt.results[0].artifactSha256 = sha;
  });
}

test("schema 4 selects only the Shiba alpha.3 row and preserves 53 entries and four receipt registrations", () => {
  const f = fixture();
  assert.equal(validateAlphaHostedAuthority(f.authority, f.read), f.authority);
  assert.deepEqual(
    f.authority.entries.filter((row) => row.catalogId !== 2043),
    parent.entries.filter((row) => row.catalogId !== 2043),
  );
  assert.deepEqual(
    f.authority.receiptRegistry.slice(0, 4),
    parent.receiptRegistry,
  );
  assert.equal(validateAlphaHostedAuthority(parent, f.read), parent);
});

test("every retained entry rejects changes and cannot be reassigned to the new receipt", () => {
  for (const previous of parent.entries.filter(
    (row) => row.catalogId !== 2043,
  )) {
    for (const change of ["name", "runtimeReceiptId"]) {
      const f = fixture();
      f.authority.entries.find((row) => row.catalogId === previous.catalogId)[
        change
      ] = change === "name" ? "Changed retained entry" : receiptId;
      assert.throws(
        () => validateAlphaHostedAuthority(f.authority, f.read),
        /Retained Alpha artifact/,
        `${previous.catalogId} ${change}`,
      );
    }
  }
});

test("schema 4 rejects parent rewrites, registration drift, missing rows and reassigned identities", () => {
  for (const mutate of [
    (f) => {
      f.files.set(parentFile, Buffer.concat([parentBytes, Buffer.from(" ")]));
    },
    (f) => {
      f.authority.previousAuthority.sha256 = "0".repeat(64);
    },
    (f) => {
      f.authority.previousAuthority.file = "../parent.json";
    },
    (f) => {
      f.authority.receiptRegistry[0].sha256 = "0".repeat(64);
    },
    (f) => {
      f.authority.receiptRegistry[3].id = "renamed-history";
    },
    (f) => {
      f.authority.receiptRegistry[4].id = "different-refresh";
    },
    (f) => {
      f.authority.receiptRegistry[4].file = "../replacement.json";
    },
    (f) => {
      f.authority.receiptRegistry[4].verifiedPackageCount = 48;
    },
    (f) => {
      f.authority.receiptRegistry[4].indexSha256 = "0".repeat(64);
    },
    (f) => {
      f.authority.receiptRegistry[4].sha256 = "0".repeat(64);
    },
    (f) => {
      f.authority.retainedPackageCount = 52;
    },
    (f) => {
      f.authority.refreshedPackageCount = 2;
    },
    (f) => {
      f.authority.entries.pop();
    },
    (f) => {
      f.authority.entries[0] = structuredClone(f.entry);
    },
    (f) => {
      f.entry.catalogId = 2999;
    },
    (f) => {
      f.entry.name = "Another work";
    },
    (f) => {
      f.entry.version = "1.0.1-alpha.4";
    },
    (f) => {
      f.entry.runtimeReceiptId = parent.entries.find(
        (row) => row.catalogId === 2043,
      ).runtimeReceiptId;
    },
    (f) => {
      f.files.set(
        receiptFile,
        Buffer.concat([f.files.get(receiptFile), Buffer.from(" ")]),
      );
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});

test("rehashed old artifacts and incomplete new manifest or preview bindings remain rejected", () => {
  for (const old of [
    parent.entries.find((row) => row.catalogId === 2043),
    ...JSON.parse(
      preserved.get("alpha-hosted-artifacts-initial.json"),
    ).entries.filter((row) => row.catalogId === 2043),
  ]) {
    const f = fixture();
    coherentArtifactChange(f, old.artifactSha256);
    assert.throws(
      () => validateAlphaHostedAuthority(f.authority, f.read),
      /stale or reassigned/,
    );
  }
  for (const mutate of [
    (f) => {
      f.entry.manifestCanonicalSha256 = "0".repeat(64);
    },
    (f) => {
      f.entry.releaseRecord.manifest.payload.sha256 = "0".repeat(64);
    },
    (f) => {
      f.entry.releaseRecord.manifest.artifact.integrity = "sha256-invalid";
    },
    (f) => {
      f.entry.releaseRecord.distribution.installability = "unrestricted";
    },
    (f) => {
      f.entry.releaseRecord.artifactUrl = "https://other.example/archive.tgz";
    },
    (f) => {
      f.entry.releaseRecord.manifest.preview.light.source = "artwork";
    },
    (f) => {
      f.entry.releaseRecord.manifest.preview.light.sha256 = parent.entries.find(
        (row) => row.catalogId === 2043,
      ).releaseRecord.manifest.preview.light.sha256;
    },
    (f) => {
      delete f.entry.releaseRecord.manifest.preview.dark;
    },
    (f) => {
      f.entry.releaseRecord.manifest.assets.find(
        (row) => row.role === "preview-light",
      ).width = 1;
    },
    (f) => {
      f.entry.releaseRecord.manifest.assets.find(
        (row) => row.role === "background",
      ).sha256 = "0".repeat(64);
    },
    (f) => {
      f.entry.releaseRecord.manifest.tokens["--dsw-alias-label-primary"].light =
        "#FFFFFF";
    },
    (f) => {
      f.entry.releaseRecord.manifest.modeBackgrounds.light = "0".repeat(64);
    },
    (f) => {
      delete f.entry.releaseRecord.manifest.visual.welcomeSurfaceStyle;
    },
    (f) => {
      f.entry.releaseRecord.manifest.visual.mobileWelcomeOffset = -120;
    },
  ]) {
    const f = fixture();
    mutate(f);
    if (f.entry.manifestCanonicalSha256 !== "0".repeat(64)) rehashManifest(f);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});

test("a rehashed receipt cannot hide wrong identity, incomplete phases, unreadable settings or bad resource recovery", () => {
  for (const mutate of [
    (r) => {
      r.stage = "candidate";
    },
    (r) => {
      r.status = "failed";
    },
    (r) => {
      r.indexSha256 = "0".repeat(64);
    },
    (r) => {
      r.sourceCommit = "0".repeat(40);
    },
    (r) => {
      r.dshVersion = "0.1.0-rc.8";
    },
    (r) => {
      r.requestedSlugs = ["other-skin"];
    },
    (r) => {
      r.results.push(structuredClone(r.results[0]));
    },
    (r) => {
      r.results[0].catalogId = 2044;
    },
    (r) => {
      r.results[0].artifactSha256 = "0".repeat(64);
    },
    (r) => {
      r.results[0].rendered.errors.push("failure");
    },
    (r) => {
      r.results[0].coldRestart.status = "failed";
    },
    (r) => {
      r.results[0].recovery.errors = undefined;
    },
    (r) => {
      r.results[0].rendered.modes.pop();
    },
    (r) => {
      r.results[0].coldRestart.modes = [];
    },
    (r) => {
      r.results[0].recovery.modes.pop();
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.contentReadable = false;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.dialog.width = 20;
    },
    (r) => {
      r.results[0].coldRestart.modes[0].settingsLayout.escape = "failed";
    },
    (r) => {
      r.results[0].recovery.modes[0].settingsLayout.contentReadable = false;
    },
    (r) => {
      r.results[0].recovery.modes[0].settingsLayout.status = "passed";
    },
    (r) => {
      r.results[0].rendered.modes[0].welcomeSurfaces[0].contrast = 1;
    },
    (r) => {
      r.results[0].rendered.modes[0].welcomeSurfaces[0].bounds.x = -100;
    },
    (r) => {
      r.results[0].rendered.modes[0].welcomeSurfaces[1].backgroundOpaque = false;
    },
    (r) => {
      r.results[0].coldRestart.modes[0].welcomeSurfaces = [];
    },
    (r) => {
      r.results[0].rendered.modes[0].tokens["--dsw-alias-label-primary"] =
        "#FFFFFF";
    },
    (r) => {
      r.results[0].rendered.modes[0].resources.find(
        (row) => row.role === "preview-light",
      ).expectedSha256 = "0".repeat(64);
    },
    (r) => {
      r.results[0].coldRestart.modes[0].resources.pop();
    },
    (r) => {
      r.results[0].recovery.modes[0].dataSkin = "shiba-morning-post";
    },
    (r) => {
      r.results[0].recovery.recoveryResources[0].status = 200;
    },
  ]) {
    const f = fixture();
    rewriteReceipt(f, mutate);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});
