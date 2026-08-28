<div align="center">

# DSH-Themes Skills

**公开 `#NNNN` 首先用于识别条目，并不承诺可以安装。Finder 可以发现全部已发布条目；只有站内托管或社区授权匹配项才会解析制品并安装，其余条目只返回证据或官方来源后停止。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Version 0.7.1](https://img.shields.io/badge/version-0.7.1-246BCE)](package.json)
[![RC.2 运行基线已认证](https://img.shields.io/badge/DSH%200.1.1--rc.2-%E8%BF%90%E8%A1%8C%E5%9F%BA%E7%BA%BF%E5%B7%B2%E8%AE%A4%E8%AF%81-16836B)](skills/dsh-theme-manager/references/runtime-baseline.dsh-0.1.1-rc.2.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [前往 dsh-themes.com 探索 Theme、Full Skin 与精选 Plugin →](https://dsh-themes.com/zh/explore)

</div>

版本 **0.7.1** 是基于未改变的 v0.7.0 晋级批次发布的文档一致性补丁。它修正公开安全说明，使其与 Finder 和 Manager 使用的 45 项权威一致；制品字节、摘要、安装权限与历史证据均未改变。13 个精确 Full Skin 只有在两项必需运行阶段全部通过后，才进入 DeepSeek Harness **`0.1.0-rc.8` 可运行逐项通道**。当前可执行权威为 45 个站内元组（6 个 Theme + 39 个 Full Skin）；经过加密来源验证的 **`0.1.1-rc.2` 运行基线**仍是独立、非逐项权威：

- **RC.2 运行基线：**六个操作系统/Node 任务全部通过，最终归档和独立 Sigstore 来源证明校验成功。这说明固定的 Harness 基线可以用于生产验证。
- **主题、皮肤和插件安装：**RC.2 还没有逐项安装权威，因此 Finder 对 RC.2 返回 0 个条目，也不会交给安装器。基线认证不会自动让某个目录条目变成可安装项目。
- **RC.8 逐项通道：**现在包含 45 个精确站内制品，以及保持不变的 11 条社区允许记录；每一项仍由独立的逐项证据约束。
- **已晋级 Full Skin `#2030–#2041 + #2043`：**精确字节先后通过真实 capture-candidate 与重建字节 certify-final，之后才原子发布并获得 Finder-to-Manager 权威。`#2042` 已签发给另一条记录，从未属于本批次。

这种分层可以防止“运行测试通过”被误用成“任何主题都能安装”。

当前目录权威共 **174 条：21 个 Theme、66 个 Skin、87 个 Curated Plugin**。其中 **166 条已发布：21 个 Theme、65 个 Skin、80 个 Curated Plugin**，另有 8 条未发布。Theme + Skin Gallery 共 86 项，站内权威包含 45 个制品（6 个 Theme + 39 个 Full Skin）。

## 从这里开始

### 通用安装

`#NNNN` 首先启动身份解析，而不是直接安装。Finder 可以发现全部已发布的 Theme、Skin 与 Curated Plugin；只有精确匹配站内托管或社区授权的结果才能继续解析制品并安装。其余结果只返回已复核证据或官方来源，然后停止。下面的示例首先要求 Skill 对条目分类。

如果你已经安装了 DeepSeek Harness，请在 DSH Themes 卡片或详情页左上角找到格式固定为 `#NNNN` 的唯一公开编号，例如 `#2004`，然后告诉 Agent：

```text
请帮我安装 DSH Themes 的 #2004。
```

这就是普通用户需要提供的全部内容。你不需要准备包名、版本、下载地址、`.tgz` 路径或校验值。Skill 会在后台解析这些信息，确认每个字段都指向同一个条目，说明即将进行的修改，并在真正更改 profile 前向你确认。

`DSH-2206`、`DSH-FS-009`、名称、slug 和详情页地址属于旧标记、内部坐标或查找线索，**不是**第二套安装编号。

从已发布且不可变的 `v0.7.1` 标签安装一次配套 Skill：

```bash
npx --yes skills@1.5.23 add \
  https://github.com/LvvUP/dsh-themes-skills/tree/v0.7.1 \
  --skill dsh-theme-finder \
  --skill dsh-theme-manager \
  --skill dsh-community-skin-installer
```

不要把固定版本替换成 `main`、`latest` 或 `next`。默认分支可能包含更新的文档或待审工作，不构成安装权威。

### 专属安装

在 [dsh-themes.com](https://dsh-themes.com/zh) 打开 Theme、Full Skin 或精选 Plugin 详情页。Finder 统一输出规范类型 `plugin`；旧输入 `ui-extension` 仅作为兼容别名保留。页面的复制按钮会使用相同的简短提示词，并自动放入当前页面的公开 `#NNNN`：

`#NNNN` 是每个已发布条目的查找地址，并不承诺每个条目都能安装。只有精确匹配站内权威或社区逐项权威的记录，才能显示并完成安装器交接。大多数 Curated Plugin 仅供展示并提供官方项目链接，永远不会交给 Theme Manager。

```text
请帮我安装 DSH Themes 的 #2004。
```

通用安装与专属安装使用同一个解析器和同一套失败关闭检查。如果条目待验证、仅供展示、无法唯一匹配或证据冲突，Agent 会直接说明暂时不能安装，而不会让你收集一长串技术字段。

### 我还没有安装 DeepSeek Harness

请先使用 [DSH Themes 安装页面](https://dsh-themes.com/zh/install)中独立的**安装 DeepSeek Harness**任务。确认 DSH 能正常打开后，再选择一个 `#NNNN`。

Harness 安装与目录内容安装会始终分开。主题 Skill 不会在安装条目时顺带安装 Node.js、Homebrew、`apt` 软件包或 DeepSeek Harness，也不会在背后降级已有 DSH。

<details>
<summary>高级说明：精确的 Harness 测试边界</summary>

- 已测试 Node 22 中的 `22.19.0` 或更高版本，以及 Node 24 中的 `24.15.0` 或更高版本。运行系统级安装器需要单独请求，并在执行前取得即时明确同意。
- 固定启动命令是 `npx @deepseek-ai/dsh@0.1.1-rc.2 web`，对应官方 commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`。
- 只打开 DSH 输出的本机回环地址，然后在 DSH 设置中配置模型供应商和模型。不要把凭据放入主题提示词。
- RC.2 能启动不等于 RC.2 条目获得安装权威，也不允许暗中降级为 RC.8。

</details>

## 哪些内容已经认证？

| 通道 | 已验证证据 | 结果 |
| --- | --- | --- |
| **RC.2 运行基线** | 官方发布映射、冻结的 505 个包闭包、188 个精确 DSH 包、Linux/macOS/Windows × Node 22.19/24.15 的六项生命周期任务、最终证明、最终回执、确定性归档与独立 Sigstore 来源证明 | **`baseline-certified`** / `verified-runtime-baseline`、`productionReady: true`；RC.2 可安装条目仍为 **0**，因为逐项权威是独立门槛 |
| **RC.2 站内条目** | 已有基线证明；selector、重打包制品与逐项权威仍需单独复核 | Finder **不会读取 RC.2 目录**，返回 0 个条目，不产生安装交接 |
| **RC.2 社区条目** | 已规划 11 个身份进行逐项重新认证 | **0/11 已验证，0 个可安装** |
| **RC.8 逐项通道** | 最终 Manager 证明、45 个精确站内元组（6 个 Theme + 39 个 Full Skin），以及 11 个由独立规则约束的社区记录 | 只有每个条目的制品、权利、运行、同意和回滚门槛全部通过时才可运行 |
| **v0.7.0 已晋级批次** | 13 个精确 Full Skin 元组（`#2030–#2041 + #2043`）；capture-candidate 与重建字节 certify-final 每阶段均包含 65 张真实模式截图和 1,010 个证据文件 | 两个阶段全部通过并原子进入 45 项权威后，才发布并允许执行 |
| **历史捕获** | 最初的 RC.2 pending 与非晋级 smoke 字节 | 只用于不可变审计，不代表当前状态，也不授予权威 |

正式 RC.2 基线运行：[GitHub Actions 32694257969](https://github.com/LvvUP/dsh-themes-skills/actions/runs/32694257969)，source `cc7546cb5ccd77002713171328972291ceaa12e6`，attempt `1`。

精确证据摘要：

| 证据 | SHA-256 |
| --- | --- |
| 最终证明 | `4c41e96827bb03eb7c4d6138f5723864e91f0324b1aec8bcf3b3a1bc47ba3fb7` |
| 最终回执 | `4a649841766b4bf3421c78906f98f29a186d718ea34b03daca96ee52e9a3db98` |
| 六份回执集合 | `b3d663b43b257a43d138538454cd40eb976802bdcabf0409295f7956dc07f1ae` |
| 确定性归档 | `0b4f03e9c3f76d241890f46330fce84f32183774a5d9228077835e2258c76f3e` |
| 独立 Sigstore bundle | `b520580f05101b4783079aa52f0e159b2aa1a9e239f7e6a68e469f4c5d084b2d` |

已晋级的 v0.7.0 批次及其两阶段证据使用独立摘要固定：

| 晋级证据 | SHA-256 |
| --- | --- |
| 当前 45 项索引 | `a894ed95febe69910281f4c603dd7ef392d5a004f8c5fc3f2b25cc67fa08de15` |
| 当前 45 项元组集 | `6806fb4dfa5e59524fd3e29b9c4c7b20e5ece8108b7efec2f4a42ed8f5e4c954` |
| 历史最终候选索引 | `f2701f3af25d90fb72c8c2a68592b1adb4294e8f3c9652f34db8ca487c6f4c63` |
| Capture-candidate 计划 / 回执 | `f095f964d21357eabd9f9bcad310faa2ccc7292f0a75e9dd49b526140043a940` / `907ed35fd089b292f41f3daa47297fd9a9ca591b7b12f469d4ab651f6919111d` |
| Capture 归档 / sums / 冻结身份 | `cef82c0db7601b869fa53c3f034e9ad5d77978d89a553b6bc0a646c05f87d029` / `b4ece672e5561816d1cf409b9de2cc8c2cda8afce04bc09dc101672847202863` / `e1935797b5eff2804cea2012924815fc4aaa6fbed002ec97d0796d8a8d1e0cb9` |
| Certify-final 计划 / 回执 | `65eef49f75d873989d27de04b206e17eec55a4a7b4b992261ef856fa1b39b3fc` / `43bdf28f3947f558afe3273478b92502b015ead2be10278516b2624038d0795a` |
| Final 归档 / sums / 冻结身份 | `d47520f808ea576b3a24500541397db0364107d54b9c0aee62d0eb0d1a4f5590` / `f2e6a9e05a25139630926c0edca9521912a7ec52ec86ae0057c7e87d9504ce2a` / `48aa04ac73b5ead54ff7fb992b8c95aa3baa1302f860fca48cf76f7a631d7a2b` |

## 不修改 profile，直接验证证据

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

## 五个职责明确的 Skill

| Skill | 职责 |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | 解析一个公开 `#NNNN`、分类证据，且只在所选条目具有独立权威时交给安装器。 |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | 在可运行通道中验证、安装、切换、移除和恢复一个精确站内条目。 |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | 只有 Manager、条目回执、用户同意和回滚门槛全部通过时，才安装 allowlist 社区条目。 |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | 在可运行的 RC.8 创作 sidecar 下创建确定性、纯数据 V3 清单；RC.2 创作仍禁用。 |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | 验证清单并打开不携带凭据的网站交接；RC.2 投稿仍禁用。 |

```text
一个公开 #NNNN
      │
      ▼
   Finder ── 站内条目 ──▶ Manager
      └──── 社区条目 ──▶ Community Skin Installer

RC.2 运行基线 ──▶ 只验证 Harness ──╳─▶ 逐项安装权威
```

## 信任边界

- SHA-256 只能证明内容与选定字节一致，不能证明身份、作者、所有权、权利或复核范围以外的安全性。
- 目录名称、简介与备注是不受信任的元数据，永远不会被当成指令执行。
- 站内安装要求精确条目发布记录、受控路由、完整制品摘要、本地逐项权威与明确同意。
- 社区安装还需要独立 allowlist 和逐项回执；Manager 或基线认证本身都不够。
- Creator 只接受声明式 JSON 与本地栅格素材，不接受作者 JavaScript、CSS、HTML、依赖、生命周期脚本、SVG、字体或远程运行时素材。
- Submitter 永远不会索取 Cookie、密码、API Key 或 Authorization Header。

## 开发

```bash
npm ci --ignore-scripts
npm test
npm run rc2:final:contract
npm run rc2:runtime:validate
npm run rc2:runtime:verify-provenance
npm run validate
npm run format:check
```

提交 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请按 [SECURITY.md](SECURITY.md) 私密报告。本项目由社区独立维护，与 DeepSeek AI 无隶属或背书关系。

仓库主体采用 [Apache-2.0](LICENSE)。随附的纯 CSS 适配保留了上游 notice，详见 [NOTICE](NOTICE)。
