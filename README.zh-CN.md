<div align="center">

# DSH-Themes Skills

**五项可审计的 Agent Skills，用于发现、创作、投稿、安装和回滚 DeepSeek Harness 主题，同时严格区分每一条信任边界。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [前往 dsh-themes.com 探索主题 →](https://dsh-themes.com/zh/explore)

[学习中心](https://dsh-themes.com/zh/learn) · [展廊](https://dsh-themes.com/zh/gallery) · [主题工坊](https://dsh-themes.com/zh/create) · [提交](https://dsh-themes.com/zh/submit)

</div>

DSH-Themes Skills 是一组职责明确的安全工作流，不是主题注册表，也不对目录内容作笼统背书。Agent 可以查询用户信任的实时目录、创建纯数据清单、将清单交给网站审核，并且只管理完整本地门槛已经通过的制品。网站当前快照包含 95 条已发布记录：21 个 Themes、47 个 Skins、27 个 UI Extensions；按分发边界分为 30 个站内 V3 制品、11 个由独立规则约束的外部运行时条目和 54 个仅展示条目。这些实时数量描述网站内容，不会扩展任何本地可执行权威。

## 这里真正证明了什么

| 证据 | 能证明什么 | 不能证明什么 |
| --- | --- | --- |
| **固定的 Manager 兼容证明** | 精确的 DeepSeek Harness `0.1.0-rc.8`、V3 Schema、最终运行时证明，以及 Node.js 22/24 上覆盖 Linux、macOS、Windows 的六项任务矩阵。 | 兼容其他 Harness 版本，或允许安装任意软件包。 |
| **站内制品发布记录** | 一个精确的 `@dsh-themes/*` tarball、完整 SHA-256、受控同源下载路由，以及固定的 RC.8 兼容对象。Manager 经复核的当前映射固定 30 个精确的软件包—版本—摘要元组。 | 发布者身份、作者身份、素材权利、软件包级运行矩阵已经完成，或其他版本的安装权限。 |
| **社区运行时权威** | 精确 11 条固定记录；每条均绑定条目级运行验证、最终 Manager 证明、脱敏回执、本地 allowlist 与明确同意。 | 对任意仓库、可变分支或仅展示记录的普遍许可。 |
| **声明式创作契约** | 完整的亮色/暗色语义 Token、本地栅格素材哈希、兼容信息和来源字段，同时拒绝可执行内容。 | 审核通过，或作者确实拥有其声明的全部权利。 |

两类证据始终保持分离：

- [固定的 RC.8 兼容证明](skills/dsh-theme-manager/references/compatibility.md)回答经过证明的 Manager 运行时能否操作一个精确 Harness 基线。最终 attestation 是不可变的。
- 站内主题的 **release-set 报告**回答某一批具体主题制品是否通过该次发布的构建、安装、重启、截图、回滚与摘要检查。当前 `full-skins-2026-08` 报告仍标记为 `pending-managed-cold-restart`；在隔离矩阵真正完成前，不得声称已经取得软件包级运行证据。即使矩阵完成，它也不是新的 Manager 认证，不能代替固定的 RC.8 sidecar 或 attestation。

新的站内主题 slug 会在查询时从实时目录发现，但发现本身永远不会授予执行权限。Manager 当前的发布权威是从已提升索引 SHA-256 `0dd86b35ed13557d8dfa80b20a2290b17476fb03dc096b6f56bf4667c2377645` 生成并复核的 30 条软件包—版本—完整摘要记录；新的站内发布只有在最终制品产生后，才能通过经过复核的 Skills 发布进入这组权威。另有 22 个精确的 V1、V2、V3 前序版本位于独立的仅回滚映射中。全新安装与普通目录验证会拒绝全部 22 个版本；schema-2 回滚或反向恢复还必须让保留的发布记录、本地制品、版本、完整摘要与 payload 摘要完全一致。社区通道则不同：它精确的 11 条记录会一直保持本地固定，除非经过单独复核和重新认证。

## 工作流如何衔接

```text
站内主题       Finder ──已验证发布记录──▶ Manager
社区皮肤       Finder ──固定且需同意的记录──▶ Community Skin Installer
新主题         Creator ──本地清单────────▶ Submitter ──▶ 网站审核
```

- **站内主题：**Finder 对实时记录分类；Manager 根据本地 30 条当前权威再次验证精确 V3 发布，只通过受控路由下载，创建制品快照并保留回滚能力。退役制品不会进入这条普通路径。
- **社区皮肤：**Finder 与 Community Skin Installer 会分别要求本地条目权威、运行时回执、精确源码/软件包身份、RC.8 Manager 门槛与用户明确同意。
- **创作与发布：**Creator 输出确定性的声明式数据；Submitter 在本地验证并返回不携带凭据的浏览器 handoff。网站继续负责素材解码与审核裁决。

## 五个技能

| 技能 | 用它来…… |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | 搜索用户信任的目录，并区分站内制品、allowlist 社区运行时与不可安装的外部展示。 |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | 校验、安装、切换、移除或回滚 Harness `web` profile 中的一个精确站内主题。 |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | 检查固定社区证据，并只在条目、回执、Manager 与同意门槛全部通过后安装。 |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | 通过 13 个语义 Token 与本地栅格素材创建确定性的主题或 Full Skin V3 清单。 |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | 验证本地清单，并在不处理凭据的前提下打开网站的登录审核流程。 |

## 第一次使用

使用 Node.js 22 系列的 `22.19+`，或 Node.js 24 系列的 `24.15+`，然后安装 Finder：

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

向 Agent 提出以证据为先的请求：

```text
请从我信任的 DSH-Themes 目录查找面向 RC.8 的皮肤，分别报告权利、
运行时行为、精确兼容性、固定源码 revision/subdir、分发方式与安装门槛；
不要安装待验证条目或 showcase-only 条目。
```

网站为本地技能补充了实时社区目录、七语言[学习中心](https://dsh-themes.com/zh/learn)、[展廊](https://dsh-themes.com/zh/gallery)、浏览器端[主题工坊](https://dsh-themes.com/zh/create)、[界面增强](https://dsh-themes.com/zh/ui-extensions)和需要登录的[提交流程](https://dsh-themes.com/zh/submit)。

## 信任边界

- `hosted-verified-artifact` 只有在完整认证兼容记录、完整制品 SHA-256 与受控下载路由全部成立时，才能交给 Manager。
- 站内映射包含 30 个当前可安装元组。另有 22 个保留的前序版本仅供回滚；它们必须同时匹配精确的 schema-2 记录与保留的旧发布记录。仅仅出现在 runner 内部摘要并集中，并不会形成独立安装授权。普通验证会继续把其中 6 个 V1/RC.5 与 13 个 V2/RC.6 软件包视为历史记录；只有经过复核的精确元组能够穿过狭窄回滚门槛。另 3 个 V3/RC.8 `1.1.0` 软件包遵循同一门槛。
- `external-runtime-verified` 是独立且需要用户同意的通道。Finder 与 Installer 都要求精确的本地权威、源码/软件包身份、条目运行时证据、回执与 Manager attestation。
- `external-showcase` 永远只用于发现。描述性元数据不能让它获得制品、安装命令或 Installer handoff。
- 权利、运行时行为、兼容性、分发与来源是彼此独立的轴。开源协议不会自动证明插画或商标权利，运行时证据也不会改变许可证。
- SHA-256 只能证明内容与选定记录一致，不能证明发布者身份、作者身份、所有权，或超出已审查范围的安全性。
- 目录标题、说明、作者与证据备注是不受信任的元数据，永远不会被当作指令执行。
- Manager 使用经过 attestation 的启动器、精确版本、仅回环地址验收、关闭遥测、托管冷重启与可恢复回滚；社区可执行 hook 会单独披露。
- Creator 只接受声明式 JSON 与本地栅格素材，不接受作者 JavaScript、CSS、HTML、依赖、生命周期脚本、字体、SVG 或远程运行时素材。
- Submitter 不会索取浏览器 Cookie、密码、API Key 或 Authorization Header。

修改 profile 前，请完整阅读每个 Skill 与[安全策略](SECURITY.md)。

## 兼容性与开发

- 当前已认证通道：**DeepSeek Harness `0.1.0-rc.8`**，官方 tag `dsh-v0.1.0-rc.8`，源码提交 `141eb6fef83422698aef7a981029e843e8161534`，最终 runtime attestation 为 `1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae`。
- 站内软件包权威：**30 个当前可安装 V3 制品**，另有 **22 个保留的 V1/V2/V3 前序版本，仅供经过验证的回滚/反向恢复使用**。当前 release-set 运行矩阵仍在等待执行，此处不会把它描述成已经完成的证据。
- 历史 `0.1.0-rc.6`/V2 与 `0.1.0-rc.5`/V1 通道在普通验证中只用于审计，永远不会被视为当前可安装版本。只有上文所列的精确保留元组，才能由 schema-2 回滚/反向恢复门槛选中。
- [`release-state.json`](release-state.json) 是版本通道的信息摘要，不能替代 validator、冻结 runner、发布记录、条目 allowlist、回执或运行时验收。
- [`rc8-v3-candidate.json`](skills/dsh-theme-manager/references/rc8-v3-candidate.json) 继续保留为历史 pending 证据，永远不能代替最终 attestation。
- 主题与皮肤变更需要托管冷重启；RC.8 契约不承诺生产环境 live unload/HMR。
- 本项目由社区独立维护，与 DeepSeek AI 无隶属或背书关系；相关名称与商标属于各自权利人。

```bash
npm ci --ignore-scripts
npm test
npm run validate
```

`npm test` 只会用 Corepack 固定的 `pnpm@11.7.0`、冻结 lockfile 与禁用生命周期脚本，引导当前已认证的 RC.8 Manager runner。历史 RC.6 runtime 文件继续以字节不变的形式保存证据；社区测试会验证独立的 11 条回执，并且只使用隔离临时 profile。

提交 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。如发现疑似漏洞，请按 [SECURITY.md](SECURITY.md) 的私密流程报告，不要创建公开 Issue。

仓库主体采用 [Apache-2.0](LICENSE)。两个随附的纯 CSS 社区适配在各自素材目录内保留上游 BSD-3-Clause 许可与 NOTICE；详见 [NOTICE](NOTICE)。
