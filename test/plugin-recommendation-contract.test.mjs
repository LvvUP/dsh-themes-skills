import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertRecommendationOnlyTransition,
  loadRecommendationTransition,
  recommendationSha256,
} from "../scripts/plugin-recommendation-contract.mjs";

const root = new URL(
  "../skills/dsh-plugin-installer/references/",
  import.meta.url,
);
async function fixture() {
  return {
    transition: JSON.parse(
      await readFile(new URL("recommendation-transition-alpha.json", root)),
    ),
    data: {
      previousCatalogBytes: await readFile(
        new URL("history/plugins-before-spotlight.json", root),
      ),
      currentCatalogBytes: await readFile(new URL("plugins.json", root)),
      individualReceiptBytes: await readFile(
        new URL("runtime-installation-alpha.json", root),
      ),
      previousTop10ReceiptBytes: await readFile(
        new URL("history/top10-before-spotlight-alpha.json", root),
      ),
    },
  };
}
test("current Web-only recommendation preserves all 100 original recipes and individual evidence", async () => {
  const f = await fixture();
  assert.equal(
    assertRecommendationOnlyTransition(f.transition, f.data)
      .individualItemsReused,
    100,
  );
  const result = await loadRecommendationTransition(
    fileURLToPath(new URL("..", import.meta.url)),
  );
  assert.equal(result.status, "verified-recommendation-only");
  assert.equal(result.currentTop10[9], 3004);
});
test("recipe, identity, setup, source and runtime changes cannot reuse old proofs even after rehashing the new catalog", async () => {
  for (const change of [
    (c) => {
      c.items[0].packageName = "other";
    },
    (c) => {
      c.items[0].sourceRevision = "0".repeat(40);
    },
    (c) => {
      c.items[0].artifact.sha256 = "0".repeat(64);
    },
    (c) => {
      c.items[0].profile = "tui";
    },
    (c) => {
      c.items[0].validation.featureVerification = "all-verified";
    },
    (c) => {
      c.items[0].setup.requirements.push("Changed setup");
    },
    (c) => {
      c.items[0].catalogId = 3999;
    },
    (c) => {
      c.sourceRevision = "0".repeat(40);
    },
    (c) => {
      c.items.pop();
    },
    (c) => {
      c.items.reverse();
    },
    (c) => {
      c.top10[0] = 3045;
    },
    (c) => {
      c.top10[9] = 3045;
    },
  ]) {
    const f = await fixture();
    const catalog = JSON.parse(f.data.currentCatalogBytes);
    change(catalog);
    f.data.currentCatalogBytes = Buffer.from(JSON.stringify(catalog));
    f.transition.currentCatalogSha256 = recommendationSha256(
      f.data.currentCatalogBytes,
    );
    assert.throws(() =>
      assertRecommendationOnlyTransition(f.transition, f.data),
    );
  }
});
test("the full old catalog, aggregate and previous Top 10 proof are immutable anchors", async () => {
  for (const key of [
    "previousCatalogBytes",
    "individualReceiptBytes",
    "previousTop10ReceiptBytes",
  ]) {
    const f = await fixture();
    f.data[key] = Buffer.concat([f.data[key], Buffer.from("\n")]);
    assert.throws(() =>
      assertRecommendationOnlyTransition(f.transition, f.data),
    );
  }
});
