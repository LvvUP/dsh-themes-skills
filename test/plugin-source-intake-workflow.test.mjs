import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = '.github/workflows/alpha1-plugin-source-intake.yml';

test('source-intake workflow audits source and static risk without executing candidates', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /candidate-intake\.mjs --github-matrix/);
  assert.match(workflow, /repository: \$\{\{ matrix\.repository \}\}/);
  assert.match(workflow, /ref: \$\{\{ matrix\.commit \}\}/);
  assert.match(workflow, /persist-credentials: false/g);
  assert.match(workflow, /audit-candidate-source\.mjs/);
  assert.match(workflow, /audit-candidate-risk\.mjs/);
  assert.match(workflow, /aggregate-source-intake\.mjs/);
  assert.equal(
    [...workflow.matchAll(/test "\$status" -eq 0 \|\| test "\$status" -eq 2/g)].length,
    2
  );
  assert.match(workflow, /aggregate-candidate-risk\.mjs/);
  assert.match(workflow, /static-risk-summary\.json/);
  assert.doesNotMatch(workflow, /(?:path:|mkdir -p|--input|--out(?:-dir)?) [^\n]*\.ci(?:\/|\\)/u);
  assert.match(workflow, /path: ci-evidence\/receipt/);
  assert.match(workflow, /max-parallel: 20/);
  assert.doesNotMatch(workflow, /npm (?:install|ci)|pnpm (?:install|run)|yarn|candidate\/.*(?:\.js|\.mjs|\.cjs)/u);
  const actionUses = [...workflow.matchAll(/^\s*uses:\s*(\S+)/gmu)].map((match) => match[1]);
  assert.ok(actionUses.length >= 6);
  assert.ok(actionUses.every((value) => /@[a-f0-9]{40}$/.test(value)));
});
