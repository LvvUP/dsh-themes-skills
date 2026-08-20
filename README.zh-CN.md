<div align="center">

# DSH-Themes Skills

**一组开放、可审计的 Agent Skills，用于发现、创作、投稿并安全管理 DeepSeek Harness 主题。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [前往 dsh-themes.com 探索主题 →](https://dsh-themes.com/zh)

</div>

DSH-Themes Skills 的已认证安装通道面向 DeepSeek Harness `0.1.0-rc.6`，由四个彼此独立的技能组成，覆盖两条清晰的工作流：

- **发现与使用：**先由 `dsh-theme-finder` 提供目录证据，再由 `dsh-theme-manager` 安装或切换符合条件的已验证制品。
- **创作与发布：**先由 `dsh-theme-creator` 生成确定性的纯数据清单，再由 `dsh-theme-submitter` 在本地完成校验，并将用户引导至网站的登录投稿流程。

本仓库不会直接编辑 Harness 安装目录，不会执行主题作者提供的代码，也不会把浏览器凭据交给自动化流程。

## 快速开始

### 1. 安装一个技能

需要 Node.js 22 或更高版本。

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

### 2. 给 Agent 一个明确任务

```text
请从 DSH-Themes 目录中查找适用于 DeepSeek Harness 0.1.0-rc.6 的
可安装 Full Skin。在交给主题管理器之前，先展示兼容性、分发类型和许可信息。
```

### 3. 前往网站继续操作

- [探索主题](https://dsh-themes.com/zh/explore)
- [阅读指南](https://dsh-themes.com/zh/learn)
- [投稿主题](https://dsh-themes.com/zh/submit)

## 四个技能

| 技能 | 适用场景 |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | 搜索用户明确信任的目录，并区分可安装的已验证制品与仅供展示的外部项目。 |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | 校验、安装、切换、移除或回滚 Harness `web` profile 中的一个精确版本主题。 |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | 基于语义 Token 与本地栅格素材，创建确定性的声明式主题或 Full Skin 清单。 |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | 在本地校验清单，并将作者引导至网站正常的登录与审核流程。 |

## 两条工作流如何配合

| 目标 | 流程 | 结果 |
| --- | --- | --- |
| 查找并安装 | `Finder → Manager` | 先对目录证据进行分类；只有符合条件的站内托管制品才能进入安装流程。 |
| 创作并投稿 | `Creator → Submitter → 网站` | 清单在本地生成并校验；作者在自己的浏览器中登录网站并提交审核。 |

## 信任边界

这些技能会明确展示自己的安全边界：

- 只有满足 Manager 契约的 `hosted-verified-artifact` 记录才可进入安装流程。
- `external-showcase` 仅用于发现与展示，不提供安装包、安装命令或经过认证的兼容性结论。
- SHA-256 只能证明下载内容与选定目录记录一致，**不能**证明发布者身份。
- Manager 通过具备 attestation 的启动器执行 Harness 操作，使用精确版本，在引导安装时禁用生命周期脚本，将验收限制在本机回环地址，并保留回滚证据。
- Creator 只接受声明式 JSON 与本地栅格素材，不接受作者提供的 JavaScript、CSS、HTML、依赖、生命周期脚本、字体、SVG 或远程运行时资源。
- Submitter 不会索取或传输浏览器 Cookie、密码、API Key 或 Authorization Header；身份认证始终留在用户自己的浏览器中。

完整边界请阅读各技能的 `SKILL.md` 与[安全策略](SECURITY.md)。

## 兼容性与项目状态

- 当前上游源码 Release：**DeepSeek Harness `0.1.0-rc.8`**，官方 tag 为 `dsh-v0.1.0-rc.8`，对应提交 `141eb6fef83422698aef7a981029e843e8161534`。
- 截至 2026-08-20 的 npm 通道状态：精确 rc.8 位于 **`next`**，**`latest` 仍是 rc.7**。
- 当前验证目标：**DeepSeek Harness `0.1.0-rc.6`**。
- RC.7 与 RC.8 尚未通过 DSH-Themes 认证；Finder、Creator、Submitter 与 Manager 会继续对这些运行时 fail closed。上游发布不等于获得安装授权。
- 面向 `0.1.0-rc.5` 的 V1 发布只作为历史制品保留，绝不会被视为当前 RC.6 制品。
- [`release-state.json`](release-state.json) 是版本状态的规范信息摘要，但不控制 validator、冻结 runner 或安装授权。
- 主题变更后需要重启 Harness。
- 项目目前处于开发者预览阶段，仅支持最新的 `main` 分支。
- 本项目由社区独立维护，与 DeepSeek AI 无隶属或背书关系。DeepSeek 及相关名称是其各自权利人的商标。

## 开发

```bash
npm ci --ignore-scripts
npm test
npm run validate
```

`npm test` 会使用 Corepack 固定的 `pnpm@11.7.0`、冻结锁文件并禁用生命周期脚本，引导嵌套的已验证 runner；在运行测试前，它会校验仓库中提交的 attestation 与关键依赖闭包。

欢迎参与贡献。提交 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。如发现疑似漏洞，请按照 [SECURITY.md](SECURITY.md) 中的私密流程报告，不要创建公开 Issue。

## 网站与许可

主题目录、使用指南与投稿流程均可在 **[dsh-themes.com](https://dsh-themes.com/zh)** 访问。

本项目采用 [Apache-2.0](LICENSE) 许可。署名与商标信息请参阅 [NOTICE](NOTICE)。
