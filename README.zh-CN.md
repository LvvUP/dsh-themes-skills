<div align="center">

# DSH-Themes Skills

**一组开放、可审计的 Agent Skills，用于发现、创作、投稿并安全管理 DeepSeek Harness 主题与社区皮肤。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [前往 dsh-themes.com 浏览展廊 →](https://dsh-themes.com/zh/gallery)

</div>

DSH-Themes Skills 由五个彼此独立的技能组成。站内 Manager、Creator、Submitter 与 Finder 已升级为精确的 DeepSeek Harness `0.1.0-rc.8` V3，并由 Linux、macOS、Windows 共六个运行时矩阵任务认证。11 个社区皮肤已经过独立运行时验证，并且只能通过需要明确同意、受回执约束的安装通道进入。

本仓库覆盖三条工作流：

- **站内主题：**`Finder → Manager`，处理精确且已验证的 `@dsh-themes/*` 制品。
- **社区皮肤：**`Finder → Community Skin Installer`，处理精确 11 条固定记录。安装需要条目运行时证据、精确 RC.8 Manager attestation、最终脱敏回执与用户明确同意同时成立。
- **创作与发布：**`Creator → Submitter → 网站`，生成确定性的声明式清单，并进入正常的登录审核流程。

## 快速开始

使用 Node.js 22 系列的 `22.19+`，或 Node.js 24 系列的 `24.15+`。

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

给 Agent 一个明确的证据请求：

```text
请从 DSH-Themes 目录查找面向 RC.8 的皮肤，分别展示权利、运行时、
兼容性、固定源码 revision/subdir 与安装门槛；不要安装待验证条目或
showcase-only 条目。
```

继续访问网站：

- [展廊](https://dsh-themes.com/zh/gallery)
- [界面增强](https://dsh-themes.com/zh/ui-extensions)
- [贡献者](https://dsh-themes.com/zh/contributors)
- [主题工坊](https://dsh-themes.com/zh/submit)

## 五个技能

| 技能 | 适用场景 |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | 搜索用户明确信任的目录，并区分站内制品、allowlist 社区运行时与不可安装的外部展示。 |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | 校验、安装、切换、移除或回滚 Harness `web` profile 中的一个精确站内主题。 |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | 检查固定的 Skin Center/社区适配证据，并强制执行 RC.8 条目门槛与 Manager 门槛。 |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | 基于语义 Token 与本地栅格素材创建确定性的声明式主题或 Full Skin 清单。 |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | 在本地校验清单，并将作者引导至网站的登录与审核流程。 |

## 信任边界

- `hosted-verified-artifact` 只有在完整认证兼容记录、完整制品 SHA-256 与受控下载路由全部成立时，才能交给 Manager。
- `external-runtime-verified` 是独立且需要用户同意的通道。Finder 与 Installer 都会要求本地 allowlist、精确源码/包身份、条目运行时证据，以及精确的 RC.8 Manager attestation。
- `external-showcase` 永远只用于发现，不提供制品、安装命令或 Installer handoff。
- 权利、运行时行为、兼容性、分发与源码来源是彼此独立的轴。开源协议不会自动证明插画或商标权利，运行时回执也不会改变许可证。
- SHA-256 只能证明内容与选定记录一致，不能证明发布者身份、作者身份或权利归属。
- 目录中的名称、说明、作者和证据备注都是不受信任的元数据，不会被作为指令执行。
- Manager 使用具备 attestation 的启动器、精确版本、仅回环地址验收、关闭遥测并保留回滚证据；社区可执行 hooks 会单独披露。
- Creator 只接受声明式 JSON 与本地栅格素材，不接受作者 JavaScript、CSS、HTML、依赖、生命周期脚本、字体、SVG 或远程运行时素材。
- Submitter 不会索取浏览器 Cookie、密码、API Key 或 Authorization Header。

完整边界请阅读每个 Skill 与[安全策略](SECURITY.md)。

## 兼容性状态

- 当前已认证 V3 通道：**DeepSeek Harness `0.1.0-rc.8`**，官方 tag `dsh-v0.1.0-rc.8`，提交 `141eb6fef83422698aef7a981029e843e8161534`，最终 runtime attestation 为 `1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae`。
- 历史 V2 通道：**`0.1.0-rc.6`**，只用于审计，不作为当前安装通道。
- 历史 V1 通道：**`0.1.0-rc.5`**，不会被视为当前版本。
- [`release-state.json`](release-state.json) 是版本通道的信息摘要，但不能替代 validator、冻结 runner 证据、条目 allowlist 或运行时验收。
- [`rc8-v3-candidate.json`](skills/dsh-theme-manager/references/rc8-v3-candidate.json) 作为历史 pending 证据保留，不能代替最终 attestation。
- 主题与皮肤变更使用托管冷重启；RC.8 合同不承诺生产环境 live unload/HMR。
- 本项目由社区独立维护，与 DeepSeek AI 无隶属或背书关系；相关名称与商标属于各自权利人。

## 开发

```bash
npm ci --ignore-scripts
npm test
npm run validate
```

`npm test` 只会用 Corepack 固定的 `pnpm@11.7.0`、冻结 lockfile 与禁用生命周期脚本，引导当前已认证的 RC.8 Manager runner。RC.6 runtime 文件继续以字节不变的方式保存历史证据；社区测试会验证独立的 11 条回执，并只使用隔离临时 profile。

欢迎参与贡献。提交 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。如发现疑似漏洞，请按 [SECURITY.md](SECURITY.md) 的私密流程报告，不要创建公开 Issue。

仓库主体采用 [Apache-2.0](LICENSE)。两个随附的纯 CSS 社区适配在各自素材目录内保留上游 BSD-3-Clause 许可与 NOTICE；详见 [NOTICE](NOTICE)。
