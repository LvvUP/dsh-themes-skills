import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  finder: 'skills/dsh-theme-finder/SKILL.md',
  manager: 'skills/dsh-theme-manager/SKILL.md',
  community: 'skills/dsh-community-skin-installer/SKILL.md',
  finderContract: 'skills/dsh-theme-finder/references/catalog-contract.md',
  communityContract:
    'skills/dsh-community-skin-installer/references/catalog-contract.md',
  readme: 'README.md',
  readmeZh: 'README.zh-CN.md',
};

async function text(path) {
  return readFile(path, 'utf8');
}

test('installation skills keep technical coordinates inside the trusted workflow', async () => {
  const [finder, manager, community] = await Promise.all([
    text(files.finder),
    text(files.manager),
    text(files.community),
  ]);

  assert.match(finder, /public card ID.*slug.*displayed name.*detail URL/s);
  assert.match(finder, /only accepted installation-ID syntax is exact four-digit `#NNNN`/);
  assert.match(finder, /`DSH-2206`, `DSH-FS-009`/);
  assert.match(finder, /never a second user-facing identifier/);
  assert.match(finder, /Do not ask the user for a package name/);
  assert.match(finder, /selection\.status: "resolved"/);
  assert.match(finder, /`catalogRead` is `true` only after/);
  assert.match(finder, /`installableResultsAllowed` is `true` only when/);
  assert.match(finder, /Ask one concise choice only for `ambiguous`/);
  assert.match(finder, /DSH setup and `#NNNN` installation are separate user tasks/);
  assert.match(finder, /stop before installer handoff/);
  assert.match(finder, /confirm that the required companion Skill is already available/);
  assert.match(finder, /npx --yes skills@1\.5\.23 add[\s\\]+https:\/\/github\.com\/LvvUP\/dsh-themes-skills\/tree\/v0\.7\.2/);
  assert.match(finder, /--skill dsh-theme-finder[\s\\]+--skill dsh-theme-manager[\s\\]+--skill dsh-community-skin-installer/);
  assert.match(finder, /Do not dynamically fetch, synthesize, or import a missing installer/);

  assert.match(manager, /Do not ask the user to discover or type the package name/);
  assert.match(manager, /`DSH-2206`, `DSH-FS-009`/);
  assert.match(manager, /internal validation coordinates, not additional user identifiers/);
  assert.match(manager, /CURRENT_INSTALLABLE_HOSTED_ARTIFACTS/);
  assert.match(manager, /Compute the file digest locally/);
  assert.match(manager, /This Skill never installs DSH, Node\.js/);
  assert.match(manager, /Do not run that command from Manager/);
  assert.match(manager, /never substitute retained RC\.8 behind the user's back/);

  assert.match(community, /Do not ask the user for a package name\/version/);
  assert.match(community, /exact public `#NNNN` shown in the top-left/);
  assert.match(community, /`DSH-2206`, `DSH-FS-009`/);
  assert.match(community, /Resolve the fixed Skin Center package\/version/);
  assert.match(community, /request explicit consent only immediately before mutation/);
  assert.match(community, /DSH setup remains a separate prerequisite/);
});

test('general and dedicated prompts share one public-ID contract across entrypoints', async () => {
  const [
    finder,
    manager,
    community,
    finderContract,
    communityContract,
    finderAgent,
    managerAgent,
    communityAgent,
  ] =
    await Promise.all([
      text(files.finder),
      text(files.manager),
      text(files.community),
      text(files.finderContract),
      text(files.communityContract),
      text('skills/dsh-theme-finder/agents/openai.yaml'),
      text('skills/dsh-theme-manager/agents/openai.yaml'),
      text('skills/dsh-community-skin-installer/agents/openai.yaml'),
    ]);

  for (const value of [finder, manager, community]) {
    assert.match(value, /top-left/);
    assert.match(value, /#NNNN/);
  }
  for (const value of [finderAgent, managerAgent, communityAgent]) {
    assert.match(value, /exact public .*#NNNN/);
    assert.match(value, /top-left/);
    assert.match(value, /legacy|Legacy/);
  }
  assert.match(finder, /slug.*detail URL.*discovery-only/s);
  assert.match(manager, /slug.*detail URL.*never hosted installation authority/s);
  assert.match(community, /Names, slugs.*detail URLs are discovery-only/s);
  assert.match(finderContract, /only installation-ID syntax.*four-digit `#NNNN`/s);
  assert.match(finderContract, /canonical Finder kind.*`plugin`/s);
  assert.match(finderContract, /legacy.*`ui-extension`.*normalized to `plugin`/s);
  assert.match(finderContract, /name, slug, or detail URL is discovery-only/);
  assert.match(finderContract, /not a second user-facing identifier/);
  assert.match(communityContract, /exact public `#NNNN` shown in the top-left/);
  assert.match(communityContract, /Technical coordinates remain internal checks/);
});

test('both README homepages explain current Alpha installation and retain historical release context', async () => {
  const [english, chinese] = await Promise.all([text(files.readme), text(files.readmeZh)]);
  for (const contents of [english, chinese]) {
    for (const skill of ['dsh-theme-finder', 'dsh-theme-manager', 'dsh-community-skin-installer', 'dsh-plugin-installer', 'dsh-theme-creator', 'dsh-theme-submitter']) {
      assert.ok(contents.includes(`skills/${skill}/SKILL.md`), `Missing ${skill} handoff`);
    }
    assert.match(contents, /#2004/);
    assert.match(contents, /0\.1\.3-alpha\.1/);
    assert.match(contents, /d347e703908d0406b7a7ef80e3a0e594d86b2215/);
    assert.match(contents, /dsh-alpha\.mjs --bootstrap/);
    assert.match(contents, /dsh-alpha\.mjs web/);
    assert.match(contents, /install-plugins\.mjs --ids '#3006' --dry-run/);
    assert.match(contents, /install-plugins\.mjs --top10 --dry-run/);
    assert.match(contents, /runtime-verified/);
    assert.match(contents, /references\/alpha-hosted-artifacts\.json/);
    assert.match(contents, /references\/community-recipes\.json/);
    assert.match(contents, /references\/plugins\.json/);
    assert.match(contents, /release-state\.json/);
    assert.match(contents, /v0\.7\.2/);
    assert.match(contents, /<summary>.*(?:Historical|历史).*v0\.7\.2/);
    assert.doesNotMatch(contents, /(?:npx|npm install)[^\n]*@deepseek-ai\/dsh@0\.1\.3-alpha\.1/);
    assert.doesNotMatch(contents, /@deepseek-ai\/dsh@(latest|next)/);
  }
  assert.match(english, /Please install DSH Themes #2004\./);
  assert.match(english, /you do not need to assemble them yourself/);
  assert.match(english, /service-backed features may still need your own account or API configuration/);
  assert.match(english, /Alpha verification snapshot — 2026-09-06/);
  assert.match(english, /full Git SHA is the immutable installation reference, so a new tag is not required/);
  assert.match(english, /These local results do not announce a production deployment/);
  assert.match(english, /2026-08-27 RC snapshot/);
  assert.doesNotMatch(english, /has not completed final promotion or received a new immutable release reference/);
  assert.match(english, /must not silently downgrade or replace/);
  assert.match(english, /https:\/\/dsh-themes\.com\/install/);
  assert.match(chinese, /请安装 DSH Themes #2004。/);
  assert.match(chinese, /不需要自行整理这些技术参数/);
  assert.match(chinese, /配置你自己的账号或 API/);
  assert.match(chinese, /Alpha 验证快照 — 2026-09-06/);
  assert.match(chinese, /完整 Git SHA，作为不可变安装引用，无需另建标签/);
  assert.match(chinese, /这些本地结果不代表网站已生产部署/);
  assert.match(chinese, /2026-08-27 RC 快照/);
  assert.doesNotMatch(chinese, /尚未固定新的不可变发布引用/);
  assert.match(chinese, /不得静默降级或替换/);
  assert.match(chinese, /https:\/\/dsh-themes\.com\/zh\/install/);
});


test('Finder separates the Alpha commit from the fixed historical setup reference', async () => {
  const finder = await text(files.finder);
  assert.match(finder, /exact public Skills commit selected by the website installation guide/);
  assert.match(finder, /full Git SHA is an immutable reference and does not require a new release tag/);
  assert.match(finder, /2026-08-27 RC snapshot/);
  assert.match(finder, /https:\/\/github\.com\/LvvUP\/dsh-themes-skills\/blob\/v0\.7\.2\/README\.md/);
  assert.doesNotMatch(finder, /repository README's fixed RC\.2 setup section/);
});
