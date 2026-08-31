#!/usr/bin/env node

import { lstat, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { validateHostedAdaptationRecipe } from './build-hosted-adaptation.mjs';

const recipesRoot = new URL('../references/plugin-runtime-build-recipes/', import.meta.url);

function fail(message) {
  throw new Error(message);
}

function repositoryCoordinate(repository) {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\.git$/u
    .exec(repository);
  if (!match) fail('hosted adaptation repository is not one public GitHub coordinate');
  return match[1];
}

export async function loadHostedAdaptationPlan() {
  const entries = await readdir(recipesRoot, { withFileTypes: true });
  if (entries.length < 1 || entries.some((entry) =>
    !entry.isFile() || entry.isSymbolicLink() || !/^3\d{3}\.json$/u.test(entry.name))) {
    fail('hosted adaptation recipe directory contains a missing or unexpected entry');
  }
  const items = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = new URL(entry.name, recipesRoot);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 1024 * 1024) {
      fail('hosted adaptation recipe must be one bounded regular file');
    }
    const recipe = validateHostedAdaptationRecipe(JSON.parse(await readFile(path)));
    const catalogId = Number(entry.name.slice(0, 4));
    if (recipe.catalogId !== catalogId) fail('hosted adaptation filename and catalog ID differ');
    items.push({
      catalogId,
      repository: repositoryCoordinate(recipe.source.repository),
      commit: recipe.source.commit,
      tree: recipe.source.tree,
      assetName: recipe.output.assetName,
    });
  }
  if (new Set(items.map((item) => item.catalogId)).size !== items.length) {
    fail('hosted adaptation plan contains duplicate catalog IDs');
  }
  return items;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const items = await loadHostedAdaptationPlan();
    if (process.argv.length === 3 && process.argv[2] === 'matrix') {
      process.stdout.write(`${JSON.stringify({ include: items })}\n`);
    } else if (process.argv.length === 2) {
      process.stdout.write(`${JSON.stringify({
        valid: true,
        candidateExecuted: false,
        hostedAdaptationCount: items.length,
        catalogIds: items.map((item) => item.catalogId),
      })}\n`);
    } else {
      fail('usage: hosted-adaptation-plan.mjs [matrix]');
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
