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
  assert.match(finder, /DSH setup and `#ID` installation are separate user tasks/);
  assert.match(finder, /stop before installer handoff/);
  assert.match(finder, /confirm that the required companion Skill is already available/);
  assert.match(finder, /npx --yes skills@1\.5\.23 add[\s\\]+https:\/\/github\.com\/LvvUP\/dsh-themes-skills\/tree\/v0\.7\.1/);
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
  assert.match(community, /exact public `#ID` shown in the top-left/);
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
    assert.match(value, /#ID/);
  }
  for (const value of [finderAgent, managerAgent, communityAgent]) {
    assert.match(value, /exact public .*#ID/);
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
  assert.match(communityContract, /exact public `#ID` shown in the top-left/);
  assert.match(communityContract, /Technical coordinates remain internal checks/);
});

test('both README homepages explain general and dedicated installation', async () => {
  const [english, chinese] = await Promise.all([
    text(files.readme),
    text(files.readmeZh),
  ]);

  assert.match(english, /### General installation/);
  assert.match(english, /### Dedicated installation/);
  assert.match(english, /unique four-digit public `#NNNN` in the top-left/);
  assert.match(english, /`DSH-2206`, `DSH-FS-009`/);
  assert.match(english, /not.*a second installation ID/s);
  assert.match(english, /Please install DSH Themes #2004\./);
  assert.match(english, /npx --yes skills@1\.5\.23 add[\s\\]+https:\/\/github\.com\/LvvUP\/dsh-themes-skills\/tree\/v0\.7\.1/);
  assert.match(english, /--skill dsh-theme-finder[\s\\]+--skill dsh-theme-manager[\s\\]+--skill dsh-community-skin-installer/);
  assert.match(english, /You do not need to prepare a package name/);
  assert.match(english, /`catalogRead: false`/);
  assert.match(english, /`installableResultsAllowed: false`/);
  assert.match(english, /RC\.2 has no item-level authority/);
  assert.match(english, /https:\/\/dsh-themes\.com\/install/);
  assert.match(english, /Harness setup and catalog installation are intentionally separate/);
  assert.match(english, /<summary>Advanced: exact tested Harness setup boundary<\/summary>/);
  assert.match(english, /npx @deepseek-ai\/dsh@0\.1\.1-rc\.2 web/);
  assert.match(english, /b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/);
  assert.doesNotMatch(english, /@deepseek-ai\/dsh@(latest|next)/);
  assert.match(english, /system-level installer requires a separate request and immediate explicit consent/);
  assert.match(english, /configure your model provider and model/);
  assert.match(english, /do not install Node\.js.*DeepSeek Harness.*never downgrade an existing DSH/s);
  assert.match(english, /fixed `v0\.7\.1` tag/);

  assert.match(chinese, /### 通用安装/);
  assert.match(chinese, /### 专属安装/);
  assert.match(chinese, /卡片或详情页左上角找到唯一公开的四位 `#编号`/);
  assert.match(chinese, /`DSH-2206`、`DSH-FS-009`/);
  assert.match(chinese, /不是.*第二套安装编号/s);
  assert.match(chinese, /请帮我安装 DSH Themes 的 #2004。/);
  assert.match(chinese, /npx --yes skills@1\.5\.23 add[\s\\]+https:\/\/github\.com\/LvvUP\/dsh-themes-skills\/tree\/v0\.7\.1/);
  assert.match(chinese, /--skill dsh-theme-finder[\s\\]+--skill dsh-theme-manager[\s\\]+--skill dsh-community-skin-installer/);
  assert.match(chinese, /你不需要准备包名/);
  assert.match(chinese, /`catalogRead: false`/);
  assert.match(chinese, /`installableResultsAllowed: false`/);
  assert.match(chinese, /RC\.2 还没有逐项安装权威/);
  assert.match(chinese, /https:\/\/dsh-themes\.com\/zh\/install/);
  assert.match(chinese, /Harness 安装与目录内容安装会始终分开/);
  assert.match(chinese, /<summary>高级说明：精确的 Harness 测试边界<\/summary>/);
  assert.match(chinese, /npx @deepseek-ai\/dsh@0\.1\.1-rc\.2 web/);
  assert.match(chinese, /b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/);
  assert.doesNotMatch(chinese, /@deepseek-ai\/dsh@(latest|next)/);
  assert.match(chinese, /运行系统级安装器需要单独请求，并在执行前取得即时明确同意/);
  assert.match(chinese, /配置模型供应商和模型/);
  assert.match(chinese, /不会在安装条目时顺带安装 Node\.js.*DeepSeek Harness.*不会在背后降级已有 DSH/s);
  assert.match(chinese, /固定的 `v0\.7\.1` 标签/);
});
