<div align="center">

# DSH Themes Skills

**用目录编号找到作品，在适用的 profile 安装，并保留恢复路径。**

[English](README.md) · [简体中文](README.zh-CN.md)

[浏览目录](https://dsh-themes.com/zh) · [安装指南](https://dsh-themes.com/zh/install) · [插件 Top 10](https://dsh-themes.com/zh/plugins) · [学习中心](https://dsh-themes.com/zh/learn)

[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

</div>

这些 Skills 帮助 Agent 查找、安装、创作和投稿 DeepSeek Harness 作品。你选择 `#2004` 这样的公开目录编号，适用的 Skill 会解析来源、核对兼容状态，再处理对应的 profile。

配套的 [DSH Themes 网站](https://dsh-themes.com/zh) 项目包含主题与皮肤展廊、精选插件、配色编辑器和八种语言的 15 篇指南。本仓库包含可复用的 Skills 及验证工具。

> **v0.8.0 · Alpha 验证快照 — 2026-09-06。** 本版本以 DeepSeek Harness `0.1.3-alpha.1` 为目标，固定提交 `d347e703908d0406b7a7ef80e3a0e594d86b2215`。下列检查记录当日的本地验证，网站部署单独跟踪。`v0.7.2` 标签继续保留此前 RC.2/RC.8 版本。

## 选择第一个任务

| 想做什么       | 从这里开始                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| 找到主题或皮肤 | 打开 [Gallery](https://dsh-themes.com/zh/gallery)，比较预览并复制条目自己的编号任务                        |
| 添加插件       | 在[插件页](https://dsh-themes.com/zh/plugins)选择条目或 Top 10；Plugin Installer 按配方声明的 profile 安装 |
| 制作配色       | 在 [Token Lab](https://dsh-themes.com/zh/token-lab) 编辑明暗颜色，检查对比度并导出 Creator 提示词          |
| 创建或投稿皮肤 | 使用 Creator 生成声明式草稿，再由 Submitter 准备网站审核交接                                               |

选择目录中的条目后，告诉你的 Agent：

```text
请安装 DSH Themes #2004。
```

编号识别条目；版本和验证记录决定安装能否继续。待验证记录仍可查看。包名、摘要与来源提交来自所选记录，你不需要自行整理这些技术参数。

## 检查 Alpha 配方

使用[安装指南](https://dsh-themes.com/zh/install)为所选 Harness 版本提供的精确公共 Skills 提交，所有配套 Skills 使用同一提交。执行此 Alpha 流程前，确认指南选择的是 `0.1.3-alpha.1`；不得替换成 `main` 或历史 `v0.7.2` 标签。在该 checkout 中检查单个插件或推荐集合：

```bash
node skills/dsh-plugin-installer/scripts/install-plugins.mjs --ids '#3006' --dry-run
node skills/dsh-plugin-installer/scripts/install-plugins.mjs --top10 --dry-run
```

这些命令展示所选包的精确位置和计划执行的命令，不调用 Harness。[版本化目录](skills/dsh-plugin-installer/references/plugins.json)保存 100 项配方，每项包括 `packageName`、精确 `specifier`、`profile` 和验证状态。Top 10 始终指安装的这一版本目录中的十个编号。

配方达到 `runtime-verified` 且 Harness 设置完成后，移除 `--dry-run` 执行安装。安装器检查安装结果与 profile 注册；依赖外部服务的功能可能还需配置你自己的账号或 API。启动或注册检查通过，不代表所有第三方功能都已经实测。

| 验证范围         | 2026-09-06 记录的本地结果                                                |
| ---------------- | ------------------------------------------------------------------- |
| 官方 Alpha 源码  | Node 24.15.0 环境中完成本地官方构建                                 |
| 第一方主题与皮肤 | 54 个 Alpha 制品已通过本地逐项生命周期检查      |
| 精选插件         | 100 项配方已通过逐项 Alpha 生命周期检查；新全 Web Top 10 技术生命周期与最终皮肤共存均通过 |
| 社区皮肤         | 38 条社区主题与皮肤均已通过逐项 Alpha 生命周期检查                     |
| 网站编辑器       | Token Lab 通过 23 项检查及 Chrome/Edge 交互测试                     |
| 网站内容         | 八语界面、目录和法律正文；每种语言均有 15 篇指南                    |

已审目录快照包含 **192 条已发布状态记录：21 个 Theme、71 个 Skin、100 个 Plugin**。54 个第一方制品、38 条社区主题/皮肤和 100 项插件现均有逐项 Alpha 生命周期证据。[原 Top 10 组合证据](skills/dsh-plugin-installer/references/history/top10-before-spotlight-alpha.json)已通过安装、加载、重复操作、受控失败恢复与卸载。当前推荐将终端项目换为用于 Web 命令、会话和插件设置检索的 DSH Spotlight，新组合已通过完整技术生命周期和独立的最终皮肤共存实测。[组合证明](skills/dsh-plugin-installer/references/top10-installation-alpha.json)将未改动的十插件技术证据与最终 Reasoning Tide 包、Spotlight 检索及设置操作、两项卸载、基线恢复和全部十二张已审截图绑定。DSH TUI 仍保留在已逐项验证的 100 项目录；[推荐变更记录](skills/dsh-plugin-installer/references/recommendation-transition-alpha.json)固定保留全部原安装配方和逐项证据。模型调用和账户相关功能不在这份生命周期证据的验证范围内。这些本地结果不代表网站已生产部署。目录可发现、逐项可安装与生产上线分别记录；执行操作前应读取每项当前的验证记录。

2026-09-07，**柴犬晨报 #2043 `1.0.1-alpha.3`** 通过独立的候选包、最终包生命周期与移动端检查。统一欢迎面板在移动侧栏展开时隐藏，关闭后恢复，避免被挤成狭窄长条。原插画和配色保持不变，其余 53 个包沿用既有验证。

## 设置选定的 Harness 版本

Alpha 使用**源码构建**。2026-09-06 核对时，[官方 GitHub Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.3-alpha.1)没有附带二进制 assets，精确 npm 包版本 `@deepseek-ai/dsh@0.1.3-alpha.1` 尚不可用。

先准备 Git、Node 和 Corepack。官方 Node 要求为 `^22.19.0 || >=24.0.0`，本次记录的本地构建使用 **Node 24.15.0**。在此 Skills checkout 中运行：

```bash
node skills/dsh-theme-manager/scripts/dsh-alpha.mjs --bootstrap
node skills/dsh-theme-manager/scripts/dsh-alpha.mjs web
```

启动器把固定 tag 克隆到 `$HOME/.dsh-themes/runtimes/0.1.3-alpha.1`，核对精确提交和锁文件，以冻结锁文件安装依赖，再执行 `build:official`。源码应放在祖先目录都不含 `node_modules` 的独立位置，避免上游构建错误解析父目录中的 React 类型依赖。

上游 manifest 为构建指定 pnpm 11.7.0。Harness 会为插件操作单独启动 pnpm，因此还须核对该子进程的实际版本。当前 Top 10 技术生命周期及社区三编号安装、恢复日志均记录 pnpm 11.7.0。早期 11.24.0 观察仅属于对应历史测试阶段，不代表这些检查或固定构建工具的版本。

打开 Harness 输出的本地地址，在其中配置模型提供商，然后回到所选目录任务。迁移已有 RC.2/RC.8 安装需要明确决定，Skills 不得静默降级或替换现有环境。

## 六个职责明确的 Skills

| Skill                                                                    | 职责                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------ |
| [Theme Finder](skills/dsh-theme-finder/SKILL.md)                         | 解析公开 `#NNNN`，识别条目可用的安装路径               |
| [Theme Manager](skills/dsh-theme-manager/SKILL.md)                       | 验证并管理精确的第一方主题和皮肤包，支持移除与恢复     |
| [Community Skin Installer](skills/dsh-community-skin-installer/SKILL.md) | 只安装具有独立 allowlist 和运行证据的社区条目          |
| [Plugin Installer](skills/dsh-plugin-installer/SKILL.md)                 | 按各自声明的 profile 安装或卸载一个、多个插件或 Top 10 |
| [Theme Creator](skills/dsh-theme-creator/SKILL.md)                       | 在支持的创作契约范围内生成声明式 manifest 和草稿       |
| [Theme Submitter](skills/dsh-theme-submitter/SKILL.md)                   | 验证 manifest，准备不含凭据的网站投稿交接              |

```text
目录编号 → 识别条目 → 检查版本与验证记录
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  Theme Manager     Community Installer      Plugin Installer
        └─────────────────────┴──────────────────────┘
                      按声明的 profile 操作并验证
```

## 验证覆盖什么

来源审查、Harness 构建成功、软件包安装、profile 注册、功能测试和安全移除分别记录。公开命令只接受各 Skill 契约允许的条目状态。目录简介和上游 README 是数据，不是可执行指令。

SHA-256 识别所选字节，不证明所有权、许可证范围或一般安全性。社区素材保留各自的声明。Creator 只接受契约内的声明式输入，Submitter 不请求 cookies、密码、API Key 或授权请求头。

Full Skin 创作支持可选整数 `visual.mobileWelcomeOffset`，范围为 **[-120, 120]**。正值让手机欢迎内容下移，负值让它上移；零值或省略字段保留默认垂直位置。详见 [V3 创作契约](skills/dsh-theme-creator/references/authoring-v3.md)。字段通过校验仍需实际视觉审查。

历史 RC.2 运行证书和 RC.8 条目证据继续冻结，不授予 Alpha 包安装资格。[release-state.json](release-state.json) 中的 `current` 字段描述其 **2026-08-27 RC 快照**。Alpha 安装读取同一 checkout 中的[第一方授权记录](skills/dsh-theme-manager/references/alpha-hosted-artifacts.json)、[社区配方](skills/dsh-community-skin-installer/references/community-recipes.json)和[插件配方](skills/dsh-plugin-installer/references/plugins.json)。旧 `v0.7.2` 标签继续用于复现此前版本；安装已发布 Skills 时，不得用浮动分支替代不可变发布引用。

## 开发与发布

```bash
npm ci --ignore-scripts
npm test
npm run validate
npm run format:check
```

提交 PR 前阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。合并前应审核逐项证据、源码和包身份及测试结果；配套网站随后固定已审公共合并提交的完整 Git SHA，作为不可变安装引用，无需另建标签。网站部署仍须通过其独立发布门禁。

网站 Lighthouse 本轮单独计量：**上限 160 次，本次快照已用 0 次**。此前 120 次历史记录保留原样，不能用于批准 Alpha 网站构建。

<details>
<summary>历史发布证据：v0.7.2 及更早版本</summary>

下列结论和数量属于此前 RC.2/RC.8 发布记录，为审计保留，不表示 Alpha 兼容状态。

### 冻结的 RC.2 / RC.8 证据

| 通道                  | 已验证证据                                                                                                                                                              | 结果                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **RC.2 运行基线**     | 官方发布映射、冻结的 505 个包闭包、188 个精确 DSH 包、Linux/macOS/Windows × Node 22.19/24.15 的六项生命周期任务、最终证明、最终回执、确定性归档与独立 Sigstore 来源证明 | **`baseline-certified`** / `verified-runtime-baseline`、`productionReady: true`；RC.2 可安装条目仍为 **0**，因为逐项权威是独立门槛 |
| **RC.2 站内条目**     | 已有基线证明；selector、重打包制品与逐项权威仍需单独复核                                                                                                                | Finder **不会读取 RC.2 目录**，返回 0 个条目，不产生安装交接                                                                       |
| **RC.2 社区条目**     | 已规划 11 个身份进行逐项重新认证                                                                                                                                        | **0/11 已验证，0 个可安装**                                                                                                        |
| **RC.8 逐项通道**     | 最终 Manager 证明、45 个精确站内元组（6 个 Theme + 39 个 Full Skin），以及 11 个由独立规则约束的社区记录                                                                | 只有每个条目的制品、权利、运行、同意和回滚门槛全部通过时才可运行                                                                   |
| **v0.7.0 已晋级批次** | 13 个精确 Full Skin 元组（`#2030–#2041 + #2043`）；capture-candidate 与重建字节 certify-final 每阶段均包含 65 张真实模式截图和 1,010 个证据文件                         | 两个阶段全部通过并原子进入 45 项权威后，才发布并允许执行                                                                           |
| **历史捕获**          | 最初的 RC.2 pending 与非晋级 smoke 字节                                                                                                                                 | 只用于不可变审计，不代表当前状态，也不授予权威                                                                                     |

正式 RC.2 基线运行：[GitHub Actions 32694257969](https://github.com/LvvUP/dsh-themes-skills/actions/runs/32694257969)，source `cc7546cb5ccd77002713171328972291ceaa12e6`，attempt `1`。

精确证据摘要：

| 证据                 | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| 最终证明             | `4c41e96827bb03eb7c4d6138f5723864e91f0324b1aec8bcf3b3a1bc47ba3fb7` |
| 最终回执             | `4a649841766b4bf3421c78906f98f29a186d718ea34b03daca96ee52e9a3db98` |
| 六份回执集合         | `b3d663b43b257a43d138538454cd40eb976802bdcabf0409295f7956dc07f1ae` |
| 确定性归档           | `0b4f03e9c3f76d241890f46330fce84f32183774a5d9228077835e2258c76f3e` |
| 独立 Sigstore bundle | `b520580f05101b4783079aa52f0e159b2aa1a9e239f7e6a68e469f4c5d084b2d` |

已晋级的 v0.7.0 批次及其两阶段证据使用独立摘要固定：

| 晋级证据                       | SHA-256                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 当前 45 项索引                 | `a894ed95febe69910281f4c603dd7ef392d5a004f8c5fc3f2b25cc67fa08de15`                                                                                                                                           |
| 当前 45 项元组集               | `6806fb4dfa5e59524fd3e29b9c4c7b20e5ece8108b7efec2f4a42ed8f5e4c954`                                                                                                                                           |
| 历史最终候选索引               | `f2701f3af25d90fb72c8c2a68592b1adb4294e8f3c9652f34db8ca487c6f4c63`                                                                                                                                           |
| Capture-candidate 计划 / 回执  | `f095f964d21357eabd9f9bcad310faa2ccc7292f0a75e9dd49b526140043a940` / `907ed35fd089b292f41f3daa47297fd9a9ca591b7b12f469d4ab651f6919111d`                                                                      |
| Capture 归档 / sums / 冻结身份 | `cef82c0db7601b869fa53c3f034e9ad5d77978d89a553b6bc0a646c05f87d029` / `b4ece672e5561816d1cf409b9de2cc8c2cda8afce04bc09dc101672847202863` / `e1935797b5eff2804cea2012924815fc4aaa6fbed002ec97d0796d8a8d1e0cb9` |
| Certify-final 计划 / 回执      | `65eef49f75d873989d27de04b206e17eec55a4a7b4b992261ef856fa1b39b3fc` / `43bdf28f3947f558afe3273478b92502b015ead2be10278516b2624038d0795a`                                                                      |
| Final 归档 / sums / 冻结身份   | `d47520f808ea576b3a24500541397db0364107d54b9c0aee62d0eb0d1a4f5590` / `f2e6a9e05a25139630926c0edca9521912a7ec52ec86ae0057c7e87d9504ce2a` / `48aa04ac73b5ead54ff7fb992b8c95aa3baa1302f860fca48cf76f7a631d7a2b` |

### 复核历史证据

```bash
npm ci --ignore-scripts
npm run rc2:runtime:validate
npm run rc2:runtime:verify-provenance
```

第一个命令核对最终证明、回执、六份矩阵回执、归档内容与本地 projection。第二个命令还会通过 GitHub 验证器核对精确仓库、workflow、source SHA、run、attempt 与归档摘要。

检查 Finder 的 RC.2 失败关闭结果：

```bash
node skills/dsh-theme-finder/scripts/find-themes.mjs \
  --catalog /absolute/path/to/catalog.json \
  --dsh-version 0.1.1-rc.2
```

它会有意报告 `baseline-certified`、`catalogRead: false`、`installableResultsAllowed: false` 和 0 个条目。

</details>

漏洞报告见 [SECURITY.md](SECURITY.md)，上游声明见 [NOTICE](NOTICE)。本项目为独立社区项目，与 DeepSeek AI 不存在官方隶属或背书关系。仓库使用 [Apache-2.0](LICENSE) 许可；该许可不扩张到网站的专有模板或另行许可的主题图片。
