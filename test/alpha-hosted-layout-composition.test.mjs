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
const parentBytes = await readFile(
  new URL("alpha-hosted-artifacts-refresh-20260906.json", reference),
);
const parent = JSON.parse(parentBytes);
const preserved = new Map(
  await Promise.all(
    [
      "alpha-hosted-artifacts-initial.json",
      "alpha-hosted-artifacts-refresh-20260906.json",
      "alpha-hosted-runtime-final.json",
      "alpha-hosted-runtime-refresh-20260906.json",
    ].map(async (file) => [file, await readFile(new URL(file, reference))]),
  ),
);
const receiptFile = "alpha-hosted-runtime-layout-fix-20260906.json";
const freshReceiptId = "layout-fix-20260906-48";
const refinementFile =
  "alpha-hosted-runtime-layout-final-corrections-20260906.json";
const refinementId = "layout-final-corrections-20260906";
const refinementIds = [
  2002, 2003, 2017, 2019, 2020, 2021, 2022, 2024, 2029, 2036, 2045, 2046, 2047,
  2048,
];

function measuredSettings() {
  return {
    status: "passed",
    expectedWidth: 800,
    expectedX: 320,
    expectedHeight: 800,
    expectedY: 50,
    contentReadable: true,
    geometry: {
      viewport: { width: 1440, height: 900 },
      dialog: { x: 320, y: 50, width: 800, height: 800 },
      overlay: { x: 0, y: 0, width: 1440, height: 900 },
      content: { x: 508, y: 50, width: 612, height: 800 },
      options: { x: 508, y: 104, width: 612, height: 746 },
      contentHorizontalOverflow: false,
      optionsHorizontalOverflow: false,
    },
  };
}

function fixture() {
  // Synthetic future rows test rejection only. They are never written as runtime evidence.
  const authority = structuredClone(parent),
    files = new Map(preserved);
  const results = [];
  authority.schemaVersion = 3;
  authority.previousAuthority = {
    file: "alpha-hosted-artifacts-refresh-20260906.json",
    sha256: alphaSha256(parentBytes),
  };
  authority.retainedPackageCount = 6;
  authority.refreshedPackageCount = 48;
  for (const entry of authority.entries) {
    if (entry.kind === "theme") continue;
    const oldReceipt = JSON.parse(
      files.get(
        parent.receiptRegistry.find((r) => r.id === entry.runtimeReceiptId)
          .file,
      ),
    );
    const result = structuredClone(
      oldReceipt.results.find((r) => r.catalogId === entry.catalogId),
    );
    entry.version = entry.version.replace(
      /alpha\.(\d+)$/,
      (_, n) => "alpha." + (Number(n) + 1),
    );
    entry.artifactSha256 = alphaSha256("layout-fixture:" + entry.catalogId);
    entry.runtimeReceiptId = freshReceiptId;
    const manifest = entry.releaseRecord.manifest;
    manifest.version = entry.version;
    manifest.artifact.version = entry.version;
    manifest.artifact.fileName = `${entry.slug}-${entry.version}.tgz`;
    manifest.artifact.sha256 = entry.artifactSha256;
    manifest.artifact.integrity = `sha256-${Buffer.from(entry.artifactSha256, "hex").toString("base64")}`;
    manifest.payload.fileName = `${entry.slug}-${entry.version}.payload.tar`;
    entry.manifestCanonicalSha256 = alphaSha256(stableAlphaJson(manifest));
    entry.releaseRecord.artifactSha256 = entry.artifactSha256;
    entry.releaseRecord.artifactUrl = `https://dsh-themes.com/api/themes/${entry.slug}/download/${entry.version}`;
    result.artifactSha256 = entry.artifactSha256;
    for (const phase of ["rendered", "coldRestart"])
      result[phase].modes = (
        phase === "rendered" ? ["light", "dark"] : ["dark"]
      ).map((mode) => ({
        mode,
        settingsLayout: measuredSettings(),
      }));
    results.push(result);
  }
  const receipt = {
    stage: "final",
    status: "passed",
    indexSha256: "c".repeat(64),
    dshVersion:
      parent.entries[0].releaseRecord.manifest.compatibility.dshPackageVersion,
    sourceCommit: parent.sourceCommit,
    results,
  };
  const bytes = Buffer.from(JSON.stringify(receipt));
  files.set(receiptFile, bytes);
  authority.receiptRegistry.push({
    id: freshReceiptId,
    file: receiptFile,
    sha256: alphaSha256(bytes),
    indexSha256: receipt.indexSha256,
    verifiedPackageCount: 48,
  });
  const refinement = { ...receipt, indexSha256: "d".repeat(64), results: [] };
  for (const id of refinementIds) {
    const entry = authority.entries.find((item) => item.catalogId === id);
    const result = structuredClone(
      results.find((item) => item.catalogId === id),
    );
    entry.artifactSha256 = alphaSha256("final-correction-fixture:" + id);
    entry.runtimeReceiptId = refinementId;
    entry.releaseRecord.artifactSha256 = entry.artifactSha256;
    entry.releaseRecord.manifest.artifact.sha256 = entry.artifactSha256;
    entry.releaseRecord.manifest.artifact.integrity = `sha256-${Buffer.from(entry.artifactSha256, "hex").toString("base64")}`;
    entry.manifestCanonicalSha256 = alphaSha256(
      stableAlphaJson(entry.releaseRecord.manifest),
    );
    result.artifactSha256 = entry.artifactSha256;
    refinement.results.push(result);
  }
  const refinementBytes = Buffer.from(JSON.stringify(refinement));
  files.set(refinementFile, refinementBytes);
  authority.receiptRegistry.push({
    id: refinementId,
    file: refinementFile,
    sha256: alphaSha256(refinementBytes),
    indexSha256: refinement.indexSha256,
    verifiedPackageCount: refinementIds.length,
  });
  return {
    authority,
    files,
    read: (file) => {
      assert.ok(files.has(file), "Unexpected evidence path");
      return files.get(file);
    },
  };
}

function rewriteReceipt(f, mutate, file = receiptFile) {
  const receipt = JSON.parse(f.files.get(file));
  mutate(receipt);
  const bytes = Buffer.from(JSON.stringify(receipt));
  f.files.set(file, bytes);
  f.authority.receiptRegistry.find((row) => row.file === file).sha256 =
    alphaSha256(bytes);
}

function coherentArchiveChange(f, catalogId, artifactSha256) {
  const entry = f.authority.entries.find((e) => e.catalogId === catalogId);
  entry.artifactSha256 = artifactSha256;
  entry.releaseRecord.artifactSha256 = artifactSha256;
  entry.releaseRecord.manifest.artifact.sha256 = artifactSha256;
  entry.releaseRecord.manifest.artifact.integrity = `sha256-${Buffer.from(artifactSha256, "hex").toString("base64")}`;
  entry.manifestCanonicalSha256 = alphaSha256(
    stableAlphaJson(entry.releaseRecord.manifest),
  );
  rewriteReceipt(
    f,
    (r) => {
      r.results.find((e) => e.catalogId === catalogId).artifactSha256 =
        artifactSha256;
    },
    refinementIds.includes(catalogId) ? refinementFile : receiptFile,
  );
}

test("schema 3 preserves all six themes and historical receipts while replacing 48 exact skin identities", () => {
  const f = fixture();
  assert.equal(
    validateAlphaHostedAuthority(f.authority, f.read).entries.length,
    54,
  );
  assert.deepEqual(
    f.authority.entries.filter((e) => e.kind === "theme"),
    parent.entries.filter((e) => e.kind === "theme"),
  );
  assert.deepEqual(
    f.authority.receiptRegistry.slice(0, 2),
    parent.receiptRegistry,
  );
  assert.equal(
    f.authority.entries.filter((e) => e.runtimeReceiptId === freshReceiptId)
      .length,
    34,
  );
  assert.deepEqual(
    f.authority.entries
      .filter((e) => e.runtimeReceiptId === refinementId)
      .map((e) => e.catalogId)
      .sort((a, b) => a - b),
    refinementIds,
  );
});

test("schema 3 rejects the old three-item selection and fabricated final correction batches", () => {
  for (const mutate of [
    (f) => f.authority.receiptRegistry.pop(),
    (f) => {
      f.authority.receiptRegistry[3].id = "unreviewed-batch";
    },
    (f) => {
      f.authority.receiptRegistry[3].id = "layout-welcome-fix-20260906-3";
    },
    (f) => {
      f.authority.receiptRegistry[3].file = "../replacement.json";
    },
    (f) => {
      f.authority.receiptRegistry[3].file =
        "alpha-hosted-runtime-layout-welcome-fix-20260906.json";
    },
    (f) => {
      f.authority.receiptRegistry[3].verifiedPackageCount = 3;
    },
    (f) => {
      f.authority.receiptRegistry[3].verifiedPackageCount = 51;
    },
    (f) => {
      f.authority.receiptRegistry[3].indexSha256 = "0".repeat(64);
    },
    (f) => {
      f.authority.refreshedPackageCount = 51;
    },
    (f) => {
      f.authority.entries.find((e) => e.catalogId === 2019).runtimeReceiptId =
        freshReceiptId;
    },
    (f) => {
      f.authority.entries.find((e) => e.catalogId === 2001).runtimeReceiptId =
        refinementId;
    },
    (f) =>
      coherentArchiveChange(
        f,
        2019,
        JSON.parse(f.files.get(receiptFile)).results.find(
          (r) => r.catalogId === 2019,
        ).artifactSha256,
      ),
    (f) =>
      rewriteReceipt(
        f,
        (r) => {
          r.results[0].catalogId = 2001;
        },
        refinementFile,
      ),
    (f) =>
      rewriteReceipt(
        f,
        (r) => {
          r.results[0].artifactSha256 = "0".repeat(64);
        },
        refinementFile,
      ),
    (f) =>
      rewriteReceipt(
        f,
        (r) => {
          r.results[0].coldRestart.modes = [];
        },
        refinementFile,
      ),
    (f) =>
      rewriteReceipt(
        f,
        (r) => {
          r.results[0].recovery.status = "failed";
        },
        refinementFile,
      ),
    (f) =>
      rewriteReceipt(f, (r) => {
        r.results.find((x) => x.catalogId === 2019).status = "failed";
      }),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});

test("all 14 final correction IDs reject their superseded original archive even when the new receipt is rehashed", () => {
  for (const catalogId of refinementIds) {
    const f = fixture();
    coherentArchiveChange(
      f,
      catalogId,
      JSON.parse(f.files.get(receiptFile)).results.find(
        (row) => row.catalogId === catalogId,
      ).artifactSha256,
    );
    assert.throws(
      () => validateAlphaHostedAuthority(f.authority, f.read),
      /visually superseded/,
      `Superseded original archive for #${catalogId} must remain unavailable`,
    );
  }
});

test("the final correction receipt requires exactly the 14 approved IDs without missing or duplicate rows", () => {
  for (const mutate of [
    (receipt) => receipt.results.pop(),
    (receipt) => receipt.results.push(structuredClone(receipt.results[0])),
    (receipt) => {
      receipt.results[0].catalogId = receipt.results[1].catalogId;
    },
    (receipt) => {
      receipt.results[0].catalogId = 2042;
    },
  ]) {
    const f = fixture();
    rewriteReceipt(f, mutate, refinementFile);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});

test("schema 3 rejects rehashed stale archives, parent rewrites, identity changes and receipt substitution", () => {
  for (const mutate of [
    (f) =>
      f.files.set(
        "alpha-hosted-artifacts-refresh-20260906.json",
        Buffer.concat([parentBytes, Buffer.from(" ")]),
      ),
    (f) => {
      f.authority.previousAuthority.sha256 = "0".repeat(64);
    },
    (f) => {
      f.authority.previousAuthority.file = "../other.json";
    },
    (f) => {
      f.authority.receiptRegistry[0].indexSha256 = "0".repeat(64);
    },
    (f) => {
      f.authority.receiptRegistry[1].sha256 = "0".repeat(64);
    },
    (f) => {
      f.authority.receiptRegistry[2].file = "../other.json";
    },
    (f) => {
      f.authority.receiptRegistry[2].id = "renamed";
    },
    (f) => {
      f.authority.retainedPackageCount = 48;
    },
    (f) => {
      f.authority.entries.find((e) => e.catalogId === 1001).name =
        "Changed retained theme";
    },
    (f) => {
      f.authority.entries.find((e) => e.catalogId === 1001).runtimeReceiptId =
        freshReceiptId;
    },
    (f) => {
      f.authority.entries.find((e) => e.catalogId === 2002).runtimeReceiptId =
        "initial-alpha-54";
    },
    (f) => {
      f.authority.entries.find((e) => e.catalogId === 2002).version =
        "1.1.1-alpha.1";
    },
    (f) => {
      f.authority.entries.find((e) => e.catalogId === 2002).catalogId = 2999;
    },
    (f) =>
      coherentArchiveChange(
        f,
        2002,
        parent.entries.find((e) => e.catalogId === 2002).artifactSha256,
      ),
    (f) =>
      coherentArchiveChange(
        f,
        2001,
        JSON.parse(
          preserved.get("alpha-hosted-artifacts-initial.json"),
        ).entries.find((e) => e.catalogId === 2001).artifactSha256,
      ),
    (f) =>
      rewriteReceipt(f, (r) => {
        r.results[0].catalogId = r.results[1].catalogId;
      }),
    (f) =>
      rewriteReceipt(f, (r) => {
        r.results[0].recovery.status = "failed";
      }),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});

test("new lifecycle success labels cannot replace real Settings bounds and readable content in both modes", () => {
  for (const mutate of [
    (r) => {
      delete r.results[0].rendered.modes;
    },
    (r) => {
      r.results[0].coldRestart.modes.pop();
    },
    (r) => {
      r.results[0].coldRestart.modes.push(
        structuredClone(r.results[0].coldRestart.modes[0]),
      );
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout = { status: "passed" };
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.contentReadable = false;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.dialog.width = 280;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.dialog.height = 200;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.overlay.height = 200;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.content.width = 92;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.options.width = 92;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.content.x = 0;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.contentHorizontalOverflow = true;
    },
    (r) => {
      r.results[0].rendered.modes[0].settingsLayout.geometry.optionsHorizontalOverflow = true;
    },
  ]) {
    const f = fixture();
    rewriteReceipt(f, mutate);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});

test("a mobile outer dialog cannot conceal the unchanged narrow two-column content", () => {
  const f = fixture();
  rewriteReceipt(f, (receipt) => {
    const layout = receipt.results[0].rendered.modes[0].settingsLayout;
    Object.assign(layout, {
      expectedWidth: 342,
      expectedX: 24,
      expectedHeight: 796,
      expectedY: 24,
    });
    Object.assign(layout.geometry, {
      viewport: { width: 390, height: 844 },
      dialog: { x: 24, y: 24, width: 342, height: 796 },
      overlay: { x: 0, y: 0, width: 390, height: 844 },
      content: { x: 24, y: 24, width: 342, height: 796 },
      options: { x: 24, y: 78, width: 342, height: 742 },
    });
  });
  validateAlphaHostedAuthority(f.authority, f.read);
  rewriteReceipt(f, (receipt) => {
    const geometry =
      receipt.results[0].rendered.modes[0].settingsLayout.geometry;
    geometry.content.width = 154;
    geometry.options.width = 154;
  });
  assert.throws(
    () => validateAlphaHostedAuthority(f.authority, f.read),
    /compressed/,
  );
});
