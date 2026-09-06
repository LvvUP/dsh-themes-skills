import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ALPHA_SOURCE, readAlphaRuntime } from "./dsh-alpha.mjs";
import { isExactSemver } from "./semver.mjs";

export const alphaSha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const INITIAL_ALPHA_AUTHORITY_SHA256 =
  "e31252736c472f4750d467c48b685ef1e907697f8bc2a073b0dfa152796f3789";
const REFRESHED_ALPHA_AUTHORITY_SHA256 =
  "eb66299a36c2c3e1431bcdd92826fe98f7e32e53825b1fa005d51b30c5520c39";
export function stableAlphaJson(value) {
  const stable = (entry) =>
    Array.isArray(entry)
      ? entry.map(stable)
      : entry && typeof entry === "object"
        ? Object.fromEntries(
            Object.keys(entry)
              .sort()
              .map((key) => [key, stable(entry[key])]),
          )
        : entry;
  return JSON.stringify(stable(value));
}

export function alphaRuntimeProjection() {
  const runtime = readAlphaRuntime();
  return {
    schemaVersion: 3,
    distribution: "source",
    attestationSha256: ALPHA_SOURCE.verification.sha256,
    dshPackageVersion: ALPHA_SOURCE.version,
    sourceCommit: ALPHA_SOURCE.commit,
    runnerLockfileSha256: ALPHA_SOURCE.lockfileSha256,
    packageManagerName: "pnpm",
    packageManagerVersion: ALPHA_SOURCE.pnpm,
    lifecycle: runtime.launch.lifecycle,
  };
}

export function loadAlphaHostedAuthority() {
  const authority = JSON.parse(
    readFileSync(
      new URL("../references/alpha-hosted-artifacts.json", import.meta.url),
      "utf8",
    ),
  );
  return validateAlphaHostedAuthority(authority, (file) =>
    readFileSync(new URL(`../references/${file}`, import.meta.url)),
  );
}

function validateLayoutFixSettings(result) {
  for (const phase of ["rendered", "coldRestart"]) {
    const modes = result[phase]?.modes;
    if (
      !Array.isArray(modes) ||
      modes.length < 1 ||
      modes.length > 2 ||
      modes.some((mode) => !["light", "dark"].includes(mode.mode)) ||
      new Set(modes.map((mode) => mode.mode)).size !== modes.length ||
      (phase === "rendered" && modes.length !== 2)
    )
      throw new Error(
        "The layout fix requires both rendered modes and each actually selected cold-restart mode.",
      );
    for (const mode of modes) {
      const check = mode.settingsLayout,
        g = check?.geometry;
      if (check?.status !== "passed" || check.contentReadable !== true || !g)
        throw new Error("The layout fix lacks readable Settings evidence.");
      for (const [name, rect] of Object.entries({
        viewport: g.viewport,
        dialog: g.dialog,
        overlay: g.overlay,
        content: g.content,
        options: g.options,
      })) {
        if (
          !rect ||
          ![rect.width, rect.height].every(
            (value) => Number.isFinite(value) && value > 0,
          ) ||
          (name !== "viewport" && ![rect.x, rect.y].every(Number.isFinite))
        )
          throw new Error("The layout fix has non-finite Settings geometry.");
      }
      const { viewport, dialog, overlay, content, options } = g;
      const width = Math.min(800, viewport.width - 48),
        height = Math.min(800, viewport.height - 48);
      const x = (viewport.width - width) / 2,
        y = (viewport.height - height) / 2;
      const close = (a, b) => Math.abs(a - b) <= 1;
      if (
        viewport.width < 320 ||
        viewport.height < 240 ||
        !close(check.expectedWidth, width) ||
        !close(check.expectedHeight, height) ||
        !close(check.expectedX, x) ||
        !close(check.expectedY, y) ||
        !close(dialog.width, width) ||
        !close(dialog.height, height) ||
        !close(dialog.x, x) ||
        !close(dialog.y, y) ||
        !close(overlay.width, viewport.width) ||
        !close(overlay.height, viewport.height) ||
        !close(overlay.x, 0) ||
        !close(overlay.y, 0) ||
        content.width < (viewport.width <= 720 ? width : width - 188) - 1 ||
        options.width < (viewport.width <= 720 ? width : width - 188) - 1 ||
        content.x < dialog.x - 1 ||
        content.x + content.width > dialog.x + dialog.width + 1 ||
        options.x < content.x - 1 ||
        options.x + options.width > content.x + content.width + 1 ||
        g.contentHorizontalOverflow !== false ||
        g.optionsHorizontalOverflow !== false
      )
        throw new Error(
          "The layout fix has compressed, overflowing or displaced Settings content.",
        );
    }
  }
}

/** Compose exact old and new item receipts without claiming the retained items were rerun. */
export function validateAlphaHostedAuthority(authority, readReceipt) {
  if (
    ![1, 2, 3].includes(authority.schemaVersion) ||
    authority.sourceCommit !== ALPHA_SOURCE.commit ||
    authority.runtimeAttestationSha256 !== ALPHA_SOURCE.verification.sha256 ||
    !Array.isArray(authority.entries)
  )
    throw new Error(
      "Alpha hosted authority does not match the pinned source runtime.",
    );
  if (authority.status !== "runtime-verified") {
    if (authority.entries.length !== 0)
      throw new Error(
        "Pending Alpha authority must not contain executable artifacts.",
      );
    return authority;
  }
  const ids = new Set(),
    tuples = new Set();
  if (authority.entries.length !== 54)
    throw new Error("The complete final Alpha hosted receipt is required.");
  const refreshIds = [2001, 2004, 2006, 2007, 2030, 2044];
  const layoutFixIds = Array.from(
    { length: 49 },
    (_, index) => 2001 + index,
  ).filter((id) => id !== 2042);
  const finalCorrectionIds = [
    2002, 2003, 2017, 2019, 2020, 2021, 2022, 2024, 2029, 2036, 2045, 2046,
    2047, 2048,
  ];
  let initialAuthority, previousAuthority;
  if (authority.schemaVersion >= 2) {
    const initialBytes = readReceipt("alpha-hosted-artifacts-initial.json");
    if (alphaSha256(initialBytes) !== INITIAL_ALPHA_AUTHORITY_SHA256)
      throw new Error("The original Alpha artifact authority digest differs.");
    initialAuthority = JSON.parse(initialBytes.toString("utf8"));
    validateAlphaHostedAuthority(initialAuthority, readReceipt);
  }
  if (authority.schemaVersion === 3) {
    if (
      stableAlphaJson(authority.previousAuthority) !==
      stableAlphaJson({
        file: "alpha-hosted-artifacts-refresh-20260906.json",
        sha256: REFRESHED_ALPHA_AUTHORITY_SHA256,
      })
    )
      throw new Error(
        "The layout fix must bind its exact prior Alpha authority.",
      );
    const previousBytes = readReceipt(
      "alpha-hosted-artifacts-refresh-20260906.json",
    );
    if (alphaSha256(previousBytes) !== REFRESHED_ALPHA_AUTHORITY_SHA256)
      throw new Error("The prior refreshed Alpha authority digest differs.");
    previousAuthority = JSON.parse(previousBytes.toString("utf8"));
    if (previousAuthority.schemaVersion !== 2)
      throw new Error("The layout fix requires the original schema 2 parent.");
    validateAlphaHostedAuthority(previousAuthority, readReceipt);
  }
  const registrations =
    authority.schemaVersion === 1
      ? [
          {
            id: "initial-alpha-54",
            file: "alpha-hosted-runtime-final.json",
            sha256: authority.finalReceiptSha256,
            indexSha256: authority.finalIndexSha256,
            verifiedPackageCount: 54,
          },
        ]
      : authority.receiptRegistry;
  if (
    !Array.isArray(registrations) ||
    registrations.length !==
      (authority.schemaVersion === 3 ? 4 : authority.schemaVersion)
  )
    throw new Error("Alpha receipt registry is incomplete.");
  if (
    authority.schemaVersion === 2 &&
    (registrations[0].id !== "initial-alpha-54" ||
      registrations[0].sha256 !==
        "dc349f47903ef26ef337caecc643e125598a4fb9f647f00929cbd417a954ce8b" ||
      registrations[1].id !== "refresh-20260906-6" ||
      authority.retainedPackageCount !== 48 ||
      authority.refreshedPackageCount !== 6)
  )
    throw new Error(
      "Alpha refresh must retain the original 54-item receipt and replace exactly six selections.",
    );
  if (
    authority.schemaVersion === 3 &&
    (authority.retainedPackageCount !== 6 ||
      authority.refreshedPackageCount !== 48 ||
      stableAlphaJson(registrations.slice(0, 2)) !==
        stableAlphaJson(previousAuthority.receiptRegistry) ||
      registrations[2].id !== "layout-fix-20260906-48" ||
      registrations[3].id !== "layout-final-corrections-20260906")
  )
    throw new Error(
      "The layout fix must retain both historical receipts and select exactly 34 original layout fixes plus 14 final corrections.",
    );
  const receipts = new Map();
  for (const [index, registration] of registrations.entries()) {
    const expectedFile =
      index === 0
        ? "alpha-hosted-runtime-final.json"
        : index === 1
          ? "alpha-hosted-runtime-refresh-20260906.json"
          : index === 2
            ? "alpha-hosted-runtime-layout-fix-20260906.json"
            : "alpha-hosted-runtime-layout-final-corrections-20260906.json";
    const expectedCount = [54, 6, 48, finalCorrectionIds.length][index];
    if (
      registration.file !== expectedFile ||
      registration.verifiedPackageCount !== expectedCount ||
      !/^[a-f0-9]{64}$/.test(registration.sha256 ?? "") ||
      !/^[a-f0-9]{64}$/.test(registration.indexSha256 ?? "")
    )
      throw new Error("Invalid Alpha receipt path or identity.");
    const receiptBytes = readReceipt(registration.file);
    if (alphaSha256(receiptBytes) !== registration.sha256)
      throw new Error("Final Alpha hosted receipt digest differs.");
    const receipt = JSON.parse(receiptBytes.toString("utf8"));
    if (
      receipt.stage !== "final" ||
      receipt.status !== "passed" ||
      receipt.results.length !== expectedCount ||
      new Set(receipt.results.map((item) => item.catalogId)).size !==
        expectedCount ||
      receipt.indexSha256 !== registration.indexSha256 ||
      receipt.dshVersion !== ALPHA_SOURCE.version ||
      receipt.sourceCommit !== ALPHA_SOURCE.commit
    )
      throw new Error("Final Alpha hosted lifecycle coverage is incomplete.");
    if (
      index === 1 &&
      JSON.stringify(
        receipt.results.map((item) => item.catalogId).sort((a, b) => a - b),
      ) !== JSON.stringify(refreshIds)
    )
      throw new Error("Refresh receipt covers unexpected package IDs.");
    if (
      index === 2 &&
      JSON.stringify(
        receipt.results.map((item) => item.catalogId).sort((a, b) => a - b),
      ) !== JSON.stringify(layoutFixIds)
    )
      throw new Error("Layout fix receipt covers unexpected package IDs.");
    if (
      index === 3 &&
      JSON.stringify(
        receipt.results.map((item) => item.catalogId).sort((a, b) => a - b),
      ) !== JSON.stringify(finalCorrectionIds)
    )
      throw new Error(
        "Final correction receipt covers unexpected package IDs.",
      );
    if (index >= 2)
      for (const result of receipt.results) {
        const previous = previousAuthority.entries.find(
          (item) => item.catalogId === result.catalogId,
        );
        if (
          result.slug !== previous?.slug ||
          result.kind !== "full-skin" ||
          result.status !== "passed" ||
          !/^[a-f0-9]{64}$/.test(result.artifactSha256 ?? "") ||
          ["rendered", "coldRestart", "recovery"].some(
            (phase) =>
              result[phase]?.status !== "passed" ||
              result[phase]?.errors?.length !== 0,
          )
        )
          throw new Error(
            "Layout lifecycle receipt contains an invalid or failed package row.",
          );
        validateLayoutFixSettings(result);
      }
    receipts.set(registration.id, receipt);
  }
  for (const entry of authority.entries) {
    if (
      !Number.isInteger(entry.catalogId) ||
      entry.catalogId < 1000 ||
      entry.catalogId > 9999 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
      !["theme", "full-skin"].includes(entry.kind) ||
      !isExactSemver(entry.version) ||
      entry.packageName !== `@dsh-themes/${entry.slug}` ||
      !/^[a-f0-9]{64}$/.test(entry.artifactSha256 ?? "") ||
      !/^[a-f0-9]{64}$/.test(entry.manifestCanonicalSha256 ?? "") ||
      !/^[a-f0-9]{64}$/.test(entry.payloadSha256 ?? "") ||
      entry.status !== "runtime-verified" ||
      ids.has(entry.catalogId) ||
      tuples.has(`${entry.packageName}@${entry.version}`)
    )
      throw new Error(
        "Alpha hosted artifact identities are invalid or duplicated.",
      );
    ids.add(entry.catalogId);
    tuples.add(`${entry.packageName}@${entry.version}`);
    const manifest = entry.releaseRecord?.manifest;
    if (
      manifest?.schemaVersion !== "3.0" ||
      manifest.kind !== entry.kind ||
      manifest.slug !== entry.slug ||
      manifest.version !== entry.version ||
      manifest.artifact?.name !== entry.packageName ||
      manifest.artifact?.version !== entry.version ||
      manifest.artifact?.sha256 !== entry.artifactSha256 ||
      manifest.artifact?.fileName !== `${entry.slug}-${entry.version}.tgz` ||
      manifest.artifact?.integrity !==
        `sha256-${Buffer.from(entry.artifactSha256, "hex").toString("base64")}` ||
      manifest.artifact?.digestScope !== "artifact-tgz" ||
      manifest.payload?.sha256 !== entry.payloadSha256 ||
      manifest.payload?.fileName !==
        `${entry.slug}-${entry.version}.payload.tar` ||
      manifest.payload?.integrity !==
        `sha256-${Buffer.from(entry.payloadSha256, "hex").toString("base64")}` ||
      manifest.payload?.digestScope !==
        "canonical-tar-payload-excluding-manifest" ||
      alphaSha256(stableAlphaJson(manifest)) !==
        entry.manifestCanonicalSha256 ||
      entry.releaseRecord.artifactSha256 !== entry.artifactSha256 ||
      entry.releaseRecord.verified !== true
    )
      throw new Error(
        `Alpha manifest and artifact bindings differ for #${entry.catalogId}.`,
      );
    if (initialAuthority && authority.schemaVersion === 2) {
      const initial = initialAuthority.entries.find(
        (item) => item.catalogId === entry.catalogId,
      );
      if (!initial)
        throw new Error("Alpha refresh cannot add or reassign catalog IDs.");
      if (!refreshIds.includes(entry.catalogId)) {
        const { runtimeReceiptId: _receiptId, ...retained } = entry;
        if (stableAlphaJson(retained) !== stableAlphaJson(initial))
          throw new Error(
            `Retained Alpha artifact #${entry.catalogId} changed.`,
          );
      } else if (
        entry.slug !== initial.slug ||
        entry.kind !== initial.kind ||
        entry.packageName !== initial.packageName ||
        !initial.version.endsWith("-alpha.1") ||
        entry.version !== initial.version.replace(/alpha\.1$/, "alpha.2") ||
        entry.artifactSha256 === initial.artifactSha256
      )
        throw new Error(
          `Refreshed Alpha artifact #${entry.catalogId} has a stale or reassigned identity.`,
        );
    }
    if (previousAuthority) {
      const previous = previousAuthority.entries.find(
        (item) => item.catalogId === entry.catalogId,
      );
      if (!previous)
        throw new Error("The layout fix cannot add or reassign catalog IDs.");
      if (!layoutFixIds.includes(entry.catalogId)) {
        if (
          entry.kind !== "theme" ||
          stableAlphaJson(entry) !== stableAlphaJson(previous)
        )
          throw new Error(
            `Retained simple Alpha theme #${entry.catalogId} changed.`,
          );
      } else {
        const version = /^(.*-alpha\.)([1-9][0-9]*)$/.exec(previous.version);
        if (
          entry.slug !== previous.slug ||
          entry.kind !== "full-skin" ||
          previous.kind !== "full-skin" ||
          entry.packageName !== previous.packageName ||
          !version ||
          entry.version !== `${version[1]}${Number(version[2]) + 1}` ||
          [...previousAuthority.entries, ...initialAuthority.entries].some(
            (item) => item.artifactSha256 === entry.artifactSha256,
          )
        )
          throw new Error(
            `Layout-fixed Alpha artifact #${entry.catalogId} has a stale or reassigned identity.`,
          );
      }
    }
    const receiptId =
      authority.schemaVersion === 1
        ? "initial-alpha-54"
        : entry.runtimeReceiptId;
    if (
      authority.schemaVersion === 2 &&
      receiptId !==
        (refreshIds.includes(entry.catalogId)
          ? "refresh-20260906-6"
          : "initial-alpha-54")
    )
      throw new Error(
        `Incorrect lifecycle receipt selection for #${entry.catalogId}.`,
      );
    if (
      authority.schemaVersion === 3 &&
      receiptId !==
        (layoutFixIds.includes(entry.catalogId)
          ? finalCorrectionIds.includes(entry.catalogId)
            ? "layout-final-corrections-20260906"
            : "layout-fix-20260906-48"
          : previousAuthority.entries.find(
              (item) => item.catalogId === entry.catalogId,
            ).runtimeReceiptId)
    )
      throw new Error(
        `Incorrect layout lifecycle receipt selection for #${entry.catalogId}.`,
      );
    if (
      authority.schemaVersion === 3 &&
      finalCorrectionIds.includes(entry.catalogId) &&
      receipts
        .get("layout-fix-20260906-48")
        .results.find((item) => item.catalogId === entry.catalogId)
        .artifactSha256 === entry.artifactSha256
    )
      throw new Error(
        `The visually superseded layout artifact #${entry.catalogId} cannot be selected.`,
      );
    const receipt = receipts.get(receiptId);
    const result =
      receipt?.results.filter((item) => item.catalogId === entry.catalogId) ??
      [];
    if (
      result.length !== 1 ||
      result[0].artifactSha256 !== entry.artifactSha256 ||
      result[0].slug !== entry.slug ||
      result[0].kind !== entry.kind ||
      result[0].status !== "passed" ||
      ["rendered", "coldRestart", "recovery"].some(
        (phase) =>
          result[0][phase]?.status !== "passed" ||
          result[0][phase]?.errors?.length !== 0,
      )
    )
      throw new Error(
        `Missing final lifecycle evidence for #${entry.catalogId}.`,
      );
  }
  return authority;
}

export function validateAlphaRelease(record, rawOrigin) {
  const origin = new URL(rawOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("A credential-free HTTPS catalog origin is required.");
  const manifest = record?.manifest;
  const expectedCompatibility = {
    ...readAlphaRuntime().compatibility,
    runtimeAttestationSha256: ALPHA_SOURCE.verification.sha256,
  };
  if (
    record.verified !== true ||
    manifest?.schemaVersion !== "3.0" ||
    stableAlphaJson(manifest.compatibility) !==
      stableAlphaJson(expectedCompatibility) ||
    stableAlphaJson(record.runtimeAttestation) !==
      stableAlphaJson(alphaRuntimeProjection()) ||
    stableAlphaJson(record.distribution) !==
      stableAlphaJson({
        kind: "hosted-verified-artifact",
        installability: "manager",
        redistribution: "allowed",
        previewPolicy: "hosted",
      })
  )
    throw new Error(
      "Alpha release record has mismatched runtime or distribution evidence.",
    );
  const entry = loadAlphaHostedAuthority().entries.find(
    (item) =>
      item.packageName === manifest.artifact?.name &&
      item.version === manifest.version,
  );
  if (
    !entry ||
    entry.artifactSha256 !== record.artifactSha256 ||
    entry.artifactSha256 !== manifest.artifact.sha256 ||
    entry.manifestCanonicalSha256 !== alphaSha256(stableAlphaJson(manifest)) ||
    entry.payloadSha256 !== manifest.payload?.sha256
  )
    throw new Error(
      "Alpha release is not an exact runtime-verified hosted artifact.",
    );
  const artifactUrl = new URL(record.artifactUrl, origin);
  if (
    artifactUrl.origin !== origin.origin ||
    artifactUrl.username ||
    artifactUrl.password ||
    artifactUrl.search ||
    artifactUrl.hash ||
    artifactUrl.pathname !==
      `/api/themes/${entry.slug}/download/${entry.version}`
  )
    throw new Error(
      "Alpha artifact URL must use the same-origin controlled download route.",
    );
  return {
    status: "current",
    installableCurrent: true,
    dshVersion: ALPHA_SOURCE.version,
    sourceCommit: ALPHA_SOURCE.commit,
    packageName: entry.packageName,
    version: entry.version,
    artifactUrl: artifactUrl.href,
    artifactSha256: entry.artifactSha256,
    payloadSha256: entry.payloadSha256,
    runtimeAttestationSha256: ALPHA_SOURCE.verification.sha256,
    lifecycle: "managed-cold-restart",
    artifactAuthority: "current-installable",
    runtimeDistribution: "source",
  };
}
