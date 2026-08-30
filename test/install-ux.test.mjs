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
  assert.match(finder, /stop before (?:item-)?installer handoff/);
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

test('both README homepages explain the v0.8 first-use and separate Harness paths', async () => {
  const [english, chinese] = await Promise.all([
    text(files.readme),
    text(files.readmeZh),
  ]);

  assert.match(english, /## First use/);
  assert.match(english, /### 1\. Install the coordinated Skills/);
  assert.match(english, /### 2\. Choose on the website/);
  assert.match(english, /### 3\. Ask with one short prompt/);
  assert.match(english, /four-digit public ID/);
  assert.match(english, /not alternate installation selectors/);
  assert.match(english, /Please install DSH Themes #2004\./);
  assert.match(english, /dsh-themes-skills\/tree\/v0\.8\.0/);
  assert.match(
    english,
    /--skill dsh-theme-finder[\s\\]+--skill dsh-theme-manager[\s\\]+--skill dsh-community-skin-installer[\s\\]+--skill dsh-harness-installer[\s\\]+--skill dsh-plugin-installer/
  );
  assert.match(english, /### I do not have DeepSeek Harness yet/);
  assert.match(english, /use `dsh-harness-installer`/);
  assert.match(english, /does not install Node, modify `PATH`/);
  assert.match(english, /nonexistent alpha\.1 npm package/);
  assert.match(english, /`#NNNN` starts exact identity resolution/);
  assert.match(english, /alpha\.1 runtime matrix is currently \*\*0\/6\*\*/);
  assert.match(english, /Plugin authority is \*\*0\/80\*\*/);
  assert.match(english, /candidate Top 10 is \*\*not installable\*\*/);
  assert.match(english, /`hosted-plugin-verified`/);
  assert.match(english, /`upstream-plugin-verified`/);
  assert.doesNotMatch(english, /npx @deepseek-ai\/dsh/);
  assert.doesNotMatch(english, /@deepseek-ai\/dsh@(latest|next)/);

  assert.match(chinese, /## 首次使用/);
  assert.match(chinese, /### 1\. 安装配套 Skills/);
  assert.match(chinese, /### 2\. 在网站选择/);
  assert.match(chinese, /### 3\. 使用一条简短提示词/);
  assert.match(chinese, /复制四位公开编号/);
  assert.match(chinese, /不是另一套安装选择器/);
  assert.match(chinese, /请帮我安装 DSH Themes 的 #2004。/);
  assert.match(chinese, /dsh-themes-skills\/tree\/v0\.8\.0/);
  assert.match(chinese, /### 我还没有安装 DeepSeek Harness/);
  assert.match(chinese, /使用 `dsh-harness-installer`/);
  assert.match(chinese, /不会安装 Node、修改 `PATH`/);
  assert.match(chinese, /并未发布的 alpha\.1 npm 包/);
  assert.match(chinese, /`#NNNN` 用于启动精确身份解析/);
  assert.match(chinese, /运行矩阵当前为 \*\*0\/6\*\*/);
  assert.match(chinese, /Plugin 权威为 \*\*0\/80\*\*/);
  assert.match(chinese, /候选 Top 10 \*\*不可安装\*\*/);
  assert.match(chinese, /`hosted-plugin-verified`/);
  assert.match(chinese, /`upstream-plugin-verified`/);
  assert.doesNotMatch(chinese, /npx @deepseek-ai\/dsh/);
});
