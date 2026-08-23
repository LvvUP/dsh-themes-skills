<div align="center">

# DSH-Themes Skills

**以证据为先的 Agent Skills，用于发现、创作、投稿、安装和恢复 DeepSeek Harness 主题。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Version 0.5.0](https://img.shields.io/badge/version-0.5.0-246BCE)](package.json)
[![候选认证待完成](https://img.shields.io/badge/DSH%200.1.1--rc.2-%E5%80%99%E9%80%89%E8%AE%A4%E8%AF%81%E5%BE%85%E5%AE%8C%E6%88%90-D97706)](skills/dsh-theme-manager/references/dsh-0.1.1-rc.2.candidate.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [前往 dsh-themes.com 探索主题 →](https://dsh-themes.com/zh/explore)

</div>

版本 **0.5.0** 为 DeepSeek Harness **`0.1.1-rc.2`** 增加了一条精确、fail-closed 的认证候选通道。它固定官方发布、npm integrity、冻结 lock 与完整依赖闭包，让后续认证不需要解析 `latest` 或 `next`。

这条候选通道**尚未完成认证**。它不能用于创作、投稿、返回可安装的 Finder 结果，也不能安装站内或社区软件包。在真实 RC.2 运行回执满足下述全部晋级门槛之前，保留的 **`0.1.0-rc.8` 已认证通道仍是唯一可运行通道**。

## 证据状态

| 通道 | 当前已有证据 | 安装状态 |
| --- | --- | --- |
| **已认证运行通道 — `0.1.0-rc.8`** | 不可变 Manager attestation、冻结闭包、Linux/macOS/Windows × Node 22.19/24.15 的六项成功任务、站内权威与 11 条社区回执。 | **已启用**，但仍须通过每个条目/制品门槛并取得用户明确同意。 |
| **RC.2 候选 — 精确输入** | 官方 `dsh-v0.1.1-rc.2` / commit `b150a551…`、精确 npm integrity、冻结 lock、505 个软件包闭包，以及 188 个版本完全一致的 DSH 软件包。 | **已禁用** — `certification-pending`、`installable: false`。 |
| **RC.2 候选 — 运行验收** | 已声明六个必需任务身份与六种验收场景，作为后续认证计划。 | **待完成：0/6 项任务**。尚无最终 selector 目录、站内制品、runtime attestation 或验收回执。 |
| **RC.2 社区通道** | 已固定 11 个条目身份，并不可变地关联保留的 RC8 回执。 | **待完成：0/11 个条目**，可安装记录为 0。 |

主仓库 CI 是一个**候选证据契约矩阵**，配置为 Linux、macOS、Windows × Node.js `22.19.0`、`24.15.0`。它检查冻结安装、精确闭包、install/list/remove 与 rollback/reverse 单元契约、畸形/混合证据拒绝，以及 pending 状态本身。另有独立的 [`RC.2 runtime smoke`](.github/workflows/rc2-runtime-smoke.yml) workflow：它会使用隔离的 `DSH_HOME` 真正启动精确候选 runner，以仅回环的 `dsh web --no-open` 运行，获取 HTML/client 入口，并为每个矩阵任务上传非晋级 smoke 回执。仓库另行保存了一份 darwin/arm64、Node `24.15.0` 的[本机非晋级 smoke 回执](skills/dsh-theme-manager/references/runtime-smoke.dsh-0.1.1-rc.2.darwin-arm64-node24.15.local.json)；它不是经过复核的 CI 矩阵任务，所以认证计数仍为 **0/6**。两条 workflow 和这份本机回执都**不代表 RC.2 最终认证已经完成**：smoke 尚未执行主题安装、light/dark/system 切换、托管冷重启、制品回滚或全部 11 个社区条目。

晋级必须由独立且经过复核的运行 workflow 与回执证明：

1. 六个精确 OS/Node 任务全部成功完成。
2. 真实 install/list/remove、light/dark/system、冷重启与 rollback/reverse 场景通过。
3. 畸形证据和混合版本证据均 fail closed。
4. RC.2 selector 与站内制品已重新生成并绑定摘要。
5. 全部 11 个社区条目均重新运行并取得条目级回执。
6. 使用经过复核的最终 attestation 替换待认证回执，而不是直接修改 pending 状态冒充完成。

## 快速开始

使用标准 Skills CLI 安装单个技能：

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

然后要求 Agent 先报告证据：

```text
请查询我信任的 DSH-Themes 目录，并分别报告权利、运行时行为、
精确兼容性、不可变源码 revision、分发方式与安装门槛；
不要安装待验证条目或 showcase-only 条目。
```

在不修改 profile 的前提下检查两个基线通道：

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
- **候选：**DeepSeek Harness `0.1.1-rc.2`，最终 attestation 缺失，selector 缺失，站内/社区运行验证待完成，安装已禁用。
- **历史：**`0.1.0-rc.6` V2 与 `0.1.0-rc.5` V1 在普通验证中仅供审计。只有经过复核的精确保留前序版本才能穿过 rollback/reverse 门槛。
- [`release-state.json`](release-state.json) 只是信息摘要，不能替代 sidecar、validator、冻结 runner、制品记录、allowlist 或回执。

候选权威被有意拆分：

- [`baseline-policy.json`](skills/dsh-theme-manager/references/baseline-policy.json) 选择 certified 或 candidate 通道。
- [`dsh-0.1.1-rc.2.candidate.json`](skills/dsh-theme-manager/references/dsh-0.1.1-rc.2.candidate.json) 固定上游与 registry 事实。
- [`runtime-dsh-0.1.1-rc.2`](skills/dsh-theme-manager/runtime-dsh-0.1.1-rc.2) 保存精确 lock 与 pending attestation。
- [`certification-receipt…pending.json`](skills/dsh-theme-manager/references/certification-receipt.dsh-0.1.1-rc.2.pending.json) 记录 0/6 完成状态，永远不能授予安装权限。

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
```

`npm test` 使用 Corepack 固定的 `pnpm@11.7.0`、冻结 lockfile 与禁用生命周期脚本，引导保留的已认证 runner 和**待认证候选依赖闭包**。本地或仓库测试为绿色，只能证明证据契约成立；它不能代替尚未完成的 RC.2 真实运行认证 workflow。

提交 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请按 [SECURITY.md](SECURITY.md) 私密报告。本项目由社区独立维护，与 DeepSeek AI 无隶属或背书关系。

仓库主体采用 [Apache-2.0](LICENSE)。随附的纯 CSS 适配保留了上游 notice，详见 [NOTICE](NOTICE)。
