<div align="center">

# DSH-Themes Skills

**以证据为先的 Agent Skills，用于发现、创作、投稿、安装和恢复 DeepSeek Harness 主题。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Version 0.5.1](https://img.shields.io/badge/version-0.5.1-246BCE)](package.json)
[![候选认证待完成](https://img.shields.io/badge/DSH%200.1.1--rc.2-%E5%80%99%E9%80%89%E8%AE%A4%E8%AF%81%E5%BE%85%E5%AE%8C%E6%88%90-D97706)](skills/dsh-theme-manager/references/dsh-0.1.1-rc.2.candidate.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [前往 dsh-themes.com 探索主题 →](https://dsh-themes.com/zh/explore)

</div>

版本 **0.5.1** 保留 DeepSeek Harness **`0.1.1-rc.2`** 的精确、fail-closed 认证候选通道，并让网站数字 `#ID` 成为从卡片到 package index 的唯一公开目录身份。它固定官方发布、npm integrity、冻结 lock 与完整依赖闭包，让后续认证不需要解析 `latest` 或 `next`。

这条候选通道**尚未完成认证**。它不能用于创作、投稿、返回可安装的 Finder 结果，也不能安装站内或社区软件包。在真实 RC.2 运行回执满足下述全部晋级门槛之前，保留的 **`0.1.0-rc.8` 已认证通道仍是唯一可运行通道**。

## 请选择一种情况

### 我已经安装 DeepSeek Harness — 用一个编号安装

在 DSH Themes 的卡片或详情页左上角找到唯一公开 `#编号`，例如 `#2004`。把它告诉 Agent 就可以了。只有紧邻数字的 `#编号` 才是安装 ID；`DSH-2206`、`DSH-FS-009` 等旧式或内部标记不是别名，不能授权安装。你不需要准备包名、版本、下载地址或校验值。

<details>
<summary>Skill 会在后台做什么？</summary>

Skill 会根据公开 `#编号` 找到唯一目录记录。对于站内条目，它会继续从可信站点 API 读取对应发布记录和精确清单，交叉核对身份、版本、受控下载路径与摘要，再让 Manager 用本地固定权威复核同一个元组。包名、版本、URL 和哈希只作为后台校验字段，不会形成第二套用户编号。只要有内容缺失、过期、互相矛盾或指向另一个条目，它就会停止并用简单语言说明原因。你不需要自己收集任何技术字段。

</details>

这次协同发布定义了 **95 个稳定编号**：21 个主题、52 个皮肤和 22 个界面增强插件。`#2027`–`#2029` 是没有可执行软件包的第一方视觉概念；Finder 可以展示它们的固定证据，但永远不会把它们显示为可安装。`/install` 页面、95 条目录、这三个编号和站内发布 API 流程，只有在配套的 DSH Themes 站点版本一同发布后才成为生产契约。在站点版本部署完成前，真实查询可能会正确地失败关闭，而不会声称当前生产站点已经具备这套新契约。

### 通用安装

一次安装 Finder 和两个配套安装器：

```bash
npx --yes skills@1.5.23 add \
  https://github.com/LvvUP/dsh-themes-skills/tree/v0.5.1 \
  --skill dsh-theme-finder \
  --skill dsh-theme-manager \
  --skill dsh-community-skin-installer
```

固定的 `v0.5.1` 发布引用只会随上文所述的站点协同版本一同发布。在该标签存在之前，本分支仅供审查，不得用 `main`、`latest` 或其他可变引用替代。

然后直接告诉 Agent：

```text
请帮我安装 DSH Themes 的 #2004。
```

Finder 会用精确公开 `#编号` 解析生产目录记录、说明必要的权利与运行风险，并在后台处理包名、版本、地址和校验值。只有所选编号与所有内部字段始终指向同一个条目，而且该条目的认证门槛通过后，它才把最小化的已验证记录交给 Manager，或把既有 allowlist 记录交给 Community Skin Installer。安装器会再次核对自己的本地权威，并在真正修改本地 `web` profile 之前向你确认。

如果 Harness 缺失、尚未完成首次启动，或者版本不符合已认证通道，安装器会停止并指向上面的独立安装说明。它不会安装 Harness、修改 Node、降级现有 DSH，也不会把 DSH 安装和所选 `#ID` 合并成一个任务。

### 专属安装

在 [dsh-themes.com](https://dsh-themes.com/zh) 打开喜欢的主题、皮肤或界面增强插件详情页，复制该页面的专属安装提示词即可。专属方式与通用方式使用同一个新手契约：`请帮我安装 DSH Themes 的 #2004。`，页面会把示例替换为当前条目的公开 `#编号`。Agent 会通过可信 API、固定 sidecar 与安装器本地权威自动解析并验证技术元组。你不需要分别复制目录 URL、包版本、制品 URL、哈希或内部 `DSH-*` 标记。名称、slug 或详情页地址可以帮助找到卡片，但它们本身不能授权站内安装。

两种方式使用同一套 fail-closed 安全规则。待验证、无法唯一匹配、证据矛盾或仅供展示的条目只会得到清楚说明，不会被拼装成安装命令。RC.2 认证仍待完成期间，两种方式都只能通过保留的 RC.8 已认证通道运行。

### 我还没有安装 DeepSeek Harness

请前往 [DSH Themes 安装页面](https://dsh-themes.com/zh/install)，复制独立的**安装 DeepSeek Harness**任务，再交给 Agent。完成该任务并确认 DSH 可以打开后，再回到这里选择一个 `#编号`。

Harness 安装与目录内容安装会始终分开。本仓库的 Skill 在安装主题、皮肤或界面增强插件时，不会顺带安装 Harness 或 Node.js，也不会把某个目录条目混入 Harness 安装任务。

<details>
<summary>高级说明：精确的 Harness 测试边界</summary>

- 已测试的 Node 范围是 Node 22 中的 `22.19.0` 或更高版本，或 Node 24 中的 `24.15.0` 或更高版本。如果没有 Node，或者版本不在这些范围内，Agent 必须先停止；在运行 Homebrew、`apt` 或其他系统级安装器之前，必须先取得你的明确同意。
- 固定启动命令是 `npx @deepseek-ai/dsh@0.1.1-rc.2 web`，对应官方 commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`。禁止使用可变的 `latest` 或 `next`。
- 只打开 DSH 输出的本机回环地址（`127.0.0.1` 或 `localhost`），然后在设置页面配置模型供应商和模型。API Key 只保存在 DSH 自己的凭据流程中，不要放进主题安装提示词。
- RC.2 能够启动，不代表本仓库待完成的 RC.2 目录证据已经晋级。新安装的 RC.2 可以使用 DSH 内置外观，但目录安装必须等独立认证门槛完成。Skill 不会降级 RC.2，也不会暗中替换成 RC.8。

</details>

## 证据状态

| 通道 | 当前已有证据 | 安装状态 |
| --- | --- | --- |
| **已认证运行通道 — `0.1.0-rc.8`** | 不可变 Manager attestation、冻结闭包、Linux/macOS/Windows × Node 22.19/24.15 的六项成功任务、站内权威与 11 条社区回执。 | **已启用**，但仍须通过每个条目/制品门槛并取得用户明确同意。 |
| **RC.2 候选 — 精确输入** | 官方 `dsh-v0.1.1-rc.2` / commit `b150a551…`、精确 npm integrity、冻结 lock、505 个软件包闭包，以及 188 个版本完全一致的 DSH 软件包。 | **已禁用** — `certification-pending`、`installable: false`。 |
| **RC.2 候选 — 运行证据** | 六份公开、非晋级 GitHub Actions 回执记录了 Linux/macOS/Windows × Node 22.19/24.15 上隔离运行 `dsh web --no-open` 的成功启动。另一组经过清理且摘要绑定的本机回执记录了全部 **32/32 份当前站内制品字节元组**在 darwin/arm64、Node 24.15 上完成精确 add/list/remove、两次冷启动、递归客户端模块 HTTP/MIME 检查、卸载与内置主题恢复。 | **启动 smoke：6/6；站内生命周期 smoke：32/32；完整认证验收：0/6**。安装仍禁用：32 份制品仍内嵌 RC8 兼容基线，模式、功能、视觉/无障碍、rollback/reverse、RC.2 重打包/selector 与最终 attestation 门槛仍未完成。 |
| **RC.2 社区通道** | 已固定 11 个条目身份，并不可变地关联保留的 RC8 回执。 | **待完成：0/11 个条目**，可安装记录为 0。 |

主仓库 CI 是一个**候选证据契约矩阵**，配置为 Linux、macOS、Windows × Node.js `22.19.0`、`24.15.0`。它检查冻结安装、精确闭包、install/list/remove 与 rollback/reverse 单元契约、畸形/混合证据拒绝，以及 pending 状态本身。另有独立的 [`RC.2 runtime smoke`](.github/workflows/rc2-runtime-smoke.yml) workflow：它会使用隔离的 `DSH_HOME` 真正启动精确候选 runner，以仅回环的 `dsh web --no-open` 运行，获取 HTML/client 入口，并为每个矩阵任务上传非晋级 smoke 回执。[run 32626363582](https://github.com/LvvUP/dsh-themes-skills/actions/runs/32626363582) 的六份回执已保存在[摘要绑定的 smoke 索引](skills/dsh-theme-manager/references/rc2-runtime-smoke/index.json)下；另有一份 darwin/arm64、Node `24.15.0` 的[本机 smoke 回执](skills/dsh-theme-manager/references/runtime-smoke.dsh-0.1.1-rc.2.darwin-arm64-node24.15.local.json)作为补充。

[32 项站内生命周期索引](skills/dsh-theme-manager/references/rc2-hosted-lifecycle-smoke/index.json)冻结了第二组覆盖范围更广、但仍不具备晋级权的本机证据。去敏回执记录了全部当前站内字节元组在一次性 profile 中完成精确安装、列举、两次托管冷启动、递归客户端模块 HTTP/MIME 抓取、卸载，以及卸载后的一次内置主题冷启动。公开档案保留原始回执摘要，同时排除本机绝对路径、原始日志、凭据和临时端口；原始回执本身并未公开。它固定公开候选 head `70a58c43…` 与私有运行脚本 head `349b9e67…`。仓库测试会重新计算四项公开候选权威摘要，并将每个 slug/version/制品 SHA 元组与签入的站内权威进行交叉校验。

这仍只是**单机生命周期 smoke，而不是可由公众独立复现的认证**。全部制品仍内嵌 RC8 基线；light/dark/system、功能激活、视觉/无障碍、rollback/reverse、RC.2 重打包/selector、最终 attestation、六项完整验收矩阵及全部 11 个社区条目仍待完成。因此，启动与生命周期 smoke 的成功数量不会改变完整认证验收仍为 **0/6** 的事实。

晋级必须由独立且经过复核的运行 workflow 与回执证明：

1. 六个精确 OS/Node **完整验收**任务（而非仅启动 smoke）全部成功完成。
2. 真实 install/list/remove、light/dark/system、冷重启与 rollback/reverse 场景通过。
3. 畸形证据和混合版本证据均 fail closed。
4. RC.2 selector 与站内制品已重新生成并绑定摘要。
5. 全部 11 个社区条目均重新运行并取得条目级回执。
6. 使用经过复核的最终 attestation 替换待认证回执，而不是直接修改 pending 状态冒充完成。

## 检查证据

在不修改 profile 的情况下要求 Agent 报告证据：

```text
请查询我信任的 DSH-Themes 目录，并分别报告权利、运行时行为、
精确兼容性、不可变源码 revision、分发方式与安装门槛；
不要安装待验证条目或 showcase-only 条目。
```

在本地检查两个基线通道：

```bash
node skills/dsh-theme-manager/scripts/verify-runner.mjs
node skills/dsh-theme-manager/scripts/validate-baseline-candidate.mjs
node skills/dsh-theme-finder/scripts/find-themes.mjs \
  --catalog /absolute/path/to/catalog.json \
  --dsh-version 0.1.1-rc.2
```

最后一个命令在 RC.2 pending 期间会有意返回 0 条可安装结果。

## 五个职责明确的技能

| 技能 | 职责 |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | 将可信目录记录分类为站内制品、allowlist 社区运行时或不可安装的 showcase。 |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | 在已认证通道下校验、安装、切换、移除和恢复一个精确站内主题。 |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | 只有已认证 Manager、条目回执、本地权威与用户同意全部通过时，才安装 11 条 allowlist 社区记录之一。 |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | 通过 13 个 Token 与本地栅格素材创建确定性的纯数据 V3 清单。 |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | 在本地验证清单，并打开不携带凭据的网站审核 handoff。 |

```text
站内主题       Finder ──精确发布记录──▶ Manager
社区皮肤       Finder ──固定且需同意的记录──▶ Community Skin Installer
新主题         Creator ──声明式清单──▶ Submitter ──▶ 网站
候选认证       精确 sidecar + lock ──▶ pending 矩阵 ──▶ 最终回执
```

每个 Skill 都从 `baseline-policy.json` 选中的固定 sidecar 读取精确基线。运行代码拒绝可变 dist-tag、版本范围、混合闭包与候选状态越权。RC8/RC6/RC5 的精确证据继续保留，用于已认证运行、恢复或历史审计；新增 RC.2 文件不会改写这些历史证据。

## 兼容性边界

- **可运行：**DeepSeek Harness `0.1.0-rc.8`，最终 Manager attestation `1cd9a0b4…`，32 个当前站内制品元组，以及 11 条受独立规则约束的社区记录。
- **候选：**DeepSeek Harness `0.1.1-rc.2`，已归档 32/32 单机站内生命周期 smoke；最终 attestation、RC.2 selector/重打包制品、跨平台完整验收、社区运行验证及安装仍待完成。
- **历史：**`0.1.0-rc.6` V2 与 `0.1.0-rc.5` V1 在普通验证中仅供审计。只有经过复核的精确保留前序版本才能穿过 rollback/reverse 门槛。
- [`release-state.json`](release-state.json) 只是信息摘要；它会将 6/6 启动 smoke、32/32 单机生命周期 smoke 与 0/6 完整验收矩阵分开报告，不能替代 sidecar、validator、冻结 runner、制品记录、allowlist 或回执。

候选权威被有意拆分：

- [`baseline-policy.json`](skills/dsh-theme-manager/references/baseline-policy.json) 选择 certified 或 candidate 通道。
- [`dsh-0.1.1-rc.2.candidate.json`](skills/dsh-theme-manager/references/dsh-0.1.1-rc.2.candidate.json) 固定上游与 registry 事实。
- [`runtime-dsh-0.1.1-rc.2`](skills/dsh-theme-manager/runtime-dsh-0.1.1-rc.2) 保存精确 lock 与 pending attestation。
- [`certification-receipt…pending.json`](skills/dsh-theme-manager/references/certification-receipt.dsh-0.1.1-rc.2.pending.json) 记录 0/6 完成状态，永远不能授予安装权限。
- [`rc2-runtime-smoke/index.json`](skills/dsh-theme-manager/references/rc2-runtime-smoke/index.json) 将六份成功的 Web 启动 smoke 回执绑定到对应 workflow run 与精确证据字节，并明确不授予晋级或安装权限。
- [`rc2-hosted-lifecycle-smoke/index.json`](skills/dsh-theme-manager/references/rc2-hosted-lifecycle-smoke/index.json) 将全部 32 个当前站内字节元组的去敏逐项生命周期回执绑定到原始回执与制品摘要；它仍不具备晋级权，也不可安装。

## 信任边界

- SHA-256 只能证明内容与选定字节一致，不能证明身份、作者、所有权或超出复核范围的安全性。
- 权利、来源、运行时行为、兼容性与分发是彼此独立的事实。
- 目录文案是不受信任的元数据，永远不会被当作指令执行。
- 站内安装要求已认证本地权威中的精确完整制品摘要与受控路由。
- 社区安装要求独立的条目证据与明确同意；Manager attestation 本身并不足够。
- Creator 只接受声明式 JSON 与栅格素材，不接受作者 JavaScript、CSS、HTML、依赖、生命周期脚本、SVG、字体或远程运行时素材。
- Submitter 永远不会索取 Cookie、密码、API Key 或 Authorization Header。

## 开发

```bash
npm ci --ignore-scripts
npm test
npm run validate
npm run format:check
```

`npm test` 使用 Corepack 固定的 `pnpm@11.7.0`、冻结 lockfile 与禁用生命周期脚本，引导保留的已认证 runner 和**待认证候选依赖闭包**。`npm run format:check` 只使用 Node.js 与 Git，对仓库文本文件检查 UTF-8、LF 换行、末尾换行、行尾空白与 JSON 可解析性。本地或仓库测试为绿色，只能证明证据契约成立；它不能代替尚未完成的 RC.2 真实运行认证 workflow。

提交 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请按 [SECURITY.md](SECURITY.md) 私密报告。本项目由社区独立维护，与 DeepSeek AI 无隶属或背书关系。

仓库主体采用 [Apache-2.0](LICENSE)。随附的纯 CSS 适配保留了上游 notice，详见 [NOTICE](NOTICE)。
