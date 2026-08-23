import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  finder: 'skills/dsh-theme-finder/SKILL.md',
  manager: 'skills/dsh-theme-manager/SKILL.md',
  community: 'skills/dsh-community-skin-installer/SKILL.md',
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

  assert.match(finder, /card number.*slug.*displayed name.*detail URL/s);
  assert.match(finder, /Do not ask the user for a package name/);
  assert.match(finder, /selection\.status: "resolved"/);
  assert.match(finder, /Ask one concise choice only for `ambiguous`/);
  assert.match(finder, /DSH setup and `#ID` installation are separate user tasks/);
  assert.match(finder, /stop before installer handoff/);

  assert.match(manager, /Do not ask the user to discover or type the package name/);
  assert.match(manager, /CURRENT_INSTALLABLE_HOSTED_ARTIFACTS/);
  assert.match(manager, /Compute the file digest locally/);
  assert.match(manager, /This Skill never installs DSH, Node\.js/);
  assert.match(manager, /Do not run that command from Manager/);
  assert.match(manager, /never substitute retained RC\.8 behind the user's back/);

  assert.match(community, /Do not ask the user for a package name\/version/);
  assert.match(community, /Resolve the fixed Skin Center package\/version/);
  assert.match(community, /request explicit consent only immediately before mutation/);
  assert.match(community, /DSH setup remains a separate prerequisite/);
});

test('both README homepages explain general and dedicated installation', async () => {
  const [english, chinese] = await Promise.all([
    text(files.readme),
    text(files.readmeZh),
  ]);

  assert.match(english, /### General installation/);
  assert.match(english, /### Dedicated installation/);
  assert.match(english, /unique `#ID` in the top-left/);
  assert.match(english, /Please install DSH Themes #2004\./);
  assert.match(english, /You do not need to prepare a package name/);
  assert.match(english, /RC\.2 certification remains pending/);
  assert.match(english, /Set up and start official DeepSeek Harness as a \*\*separate task\*\*/);
  assert.match(english, /npx @deepseek-ai\/dsh@0\.1\.1-rc\.2 web/);
  assert.match(english, /b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/);
  assert.doesNotMatch(english, /@deepseek-ai\/dsh@(latest|next)/);
  assert.match(english, /must obtain your explicit consent before running a system-level installer/);
  assert.match(english, /configure your model provider and model/);
  assert.match(english, /does not install Harness, change Node, downgrade an existing DSH/);

  assert.match(chinese, /### 通用安装/);
  assert.match(chinese, /### 专属安装/);
  assert.match(chinese, /卡片或详情页左上角找到唯一 `#编号`/);
  assert.match(chinese, /请帮我安装 DSH Themes 的 #2004。/);
  assert.match(chinese, /你不需要准备包名/);
  assert.match(chinese, /RC\.2 认证仍待完成/);
  assert.match(chinese, /作为一个\*\*独立任务\*\*完成/);
  assert.match(chinese, /npx @deepseek-ai\/dsh@0\.1\.1-rc\.2 web/);
  assert.match(chinese, /b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/);
  assert.doesNotMatch(chinese, /@deepseek-ai\/dsh@(latest|next)/);
  assert.match(chinese, /系统级安装器之前，必须先取得你的明确同意/);
  assert.match(chinese, /配置模型供应商和模型/);
  assert.match(chinese, /不会安装 Harness、修改 Node、降级现有 DSH/);
});
