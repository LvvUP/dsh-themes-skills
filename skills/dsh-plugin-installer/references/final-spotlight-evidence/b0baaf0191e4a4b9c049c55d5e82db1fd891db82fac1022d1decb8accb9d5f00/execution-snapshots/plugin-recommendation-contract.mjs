import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const ORIGINAL_CATALOG_SHA256 =
  "d74a519032ba74716ef9d4fa03fb56f28a44005d07a1999c2e034645d06a7a81";
export const ORIGINAL_COMBINATION_SHA256 =
  "248099e898a0744ed26ca1717958ac248ea4a5ee4bea7fc6b6741d3a523322ad";
export const INDIVIDUAL_RECEIPT_SHA256 =
  "ab3d2b31e167e4b0e55719f01538c46b1ed138441ae97fb519edc1a0105aa851";
export const recommendationSha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/** A recommendation edit may reuse individual evidence only when every other field is identical. */
export function assertRecommendationOnlyTransition(
  transition,
  {
    previousCatalogBytes,
    currentCatalogBytes,
    individualReceiptBytes,
    previousTop10ReceiptBytes,
  },
) {
  const previous = JSON.parse(previousCatalogBytes),
    current = JSON.parse(currentCatalogBytes);
  assert.equal(transition.schemaVersion, 1);
  assert.equal(transition.kind, "recommendation-only-change");
  assert.equal(
    recommendationSha256(previousCatalogBytes),
    ORIGINAL_CATALOG_SHA256,
  );
  assert.equal(
    transition.previousCatalog.path,
    "history/plugins-before-spotlight.json",
  );
  assert.equal(transition.previousCatalog.sha256, ORIGINAL_CATALOG_SHA256);
  assert.equal(
    transition.currentCatalogSha256,
    recommendationSha256(currentCatalogBytes),
  );
  assert.equal(
    transition.individualReceipt.path,
    "runtime-installation-alpha.json",
  );
  assert.equal(transition.individualReceipt.sha256, INDIVIDUAL_RECEIPT_SHA256);
  assert.equal(
    recommendationSha256(individualReceiptBytes),
    INDIVIDUAL_RECEIPT_SHA256,
  );
  assert.equal(
    transition.previousCombination.path,
    "history/top10-before-spotlight-alpha.json",
  );
  assert.equal(
    transition.previousCombination.sha256,
    ORIGINAL_COMBINATION_SHA256,
  );
  assert.equal(
    recommendationSha256(previousTop10ReceiptBytes),
    ORIGINAL_COMBINATION_SHA256,
  );
  const previousProof = JSON.parse(previousTop10ReceiptBytes);
  assert.equal(previousProof.status, "passed");
  assert.equal(previousProof.catalogSha256, ORIGINAL_CATALOG_SHA256);
  const { top10: oldTop10, ...oldRecipes } = previous;
  const { top10: newTop10, ...newRecipes } = current;
  assert.deepEqual(
    newRecipes,
    oldRecipes,
    "Only top10 may change when reusing individual lifecycle evidence",
  );
  assert.equal(
    transition.unchangedCatalogFieldsSha256,
    recommendationSha256(JSON.stringify(oldRecipes)),
  );
  assert.equal(current.items.length, 100);
  assert.equal(transition.itemsChanged, 0);
  assert.deepEqual(transition.previousTop10, oldTop10);
  assert.deepEqual(transition.currentTop10, newTop10);
  assert.deepEqual(newTop10.slice(0, 9), oldTop10.slice(0, 9));
  assert.equal(oldTop10[9], 3045);
  assert.equal(newTop10[9], 3004);
  assert.equal(newTop10.length, 10);
  assert.equal(new Set(newTop10).size, 10);
  assert.deepEqual(transition.addedToTop10, [3004]);
  assert.deepEqual(transition.removedFromTop10, [3045]);
  const added = current.items.find((item) => item.catalogId === 3004);
  const retained = current.items.find((item) => item.catalogId === 3045);
  assert.equal(added.profile, "web");
  assert.equal(retained.profile, "tui");
  assert.equal(added.validation.status, "runtime-verified");
  assert.equal(retained.validation.status, "runtime-verified");
  assert.equal(transition.sourceReview.catalogId, added.catalogId);
  assert.equal(transition.sourceReview.sourceRevision, added.sourceRevision);
  assert.equal(transition.sourceReview.artifactSha256, added.artifact.sha256);
  return {
    status: "verified-recommendation-only",
    individualItemsReused: 100,
    currentTop10: newTop10,
  };
}

export async function loadRecommendationTransition(skillsRoot) {
  const root = join(skillsRoot, "skills/dsh-plugin-installer/references");
  const currentCatalogBytes = await readFile(join(root, "plugins.json"));
  if (recommendationSha256(currentCatalogBytes) === ORIGINAL_CATALOG_SHA256)
    return null;
  const transitionBytes = await readFile(
    join(root, "recommendation-transition-alpha.json"),
  );
  const transition = JSON.parse(transitionBytes);
  const [
    previousCatalogBytes,
    individualReceiptBytes,
    previousTop10ReceiptBytes,
  ] = await Promise.all([
    readFile(join(root, "history/plugins-before-spotlight.json")),
    readFile(join(root, "runtime-installation-alpha.json")),
    readFile(join(root, "history/top10-before-spotlight-alpha.json")),
  ]);
  const result = assertRecommendationOnlyTransition(transition, {
    previousCatalogBytes,
    currentCatalogBytes,
    individualReceiptBytes,
    previousTop10ReceiptBytes,
  });
  return {
    ...result,
    transitionSha256: recommendationSha256(transitionBytes),
    catalogSha256: recommendationSha256(currentCatalogBytes),
  };
}
