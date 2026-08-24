<div align="center">

# DSH-Themes Skills

**只需告诉 Agent 一个公开 `#编号`，其余技术细节由 Skill 自动解析和校验。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Version 0.6.0](https://img.shields.io/badge/version-0.6.0-246BCE)](package.json)
[![RC.2 运行基线已认证](https://img.shields.io/badge/DSH%200.1.1--rc.2-%E8%BF%90%E8%A1%8C%E5%9F%BA%E7%BA%BF%E5%B7%B2%E8%AE%A4%E8%AF%81-16836B)](skills/dsh-theme-manager/references/runtime-baseline.dsh-0.1.1-rc.2.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [前往 dsh-themes.com 探索主题 →](https://dsh-themes.com/zh/explore)

</div>

版本 **0.6.0** 新增了经过加密来源验证的 DeepSeek Harness **`0.1.1-rc.2` 运行基线**，同时保留可工作的 **`0.1.0-rc.8` 逐项安装通道**。两者有意分开：

- **RC.2 运行基线：**六个操作系统/Node 任务全部通过，最终归档和独立 Sigstore 来源证明校验成功。这说明固定的 Harness 基线可以用于生产验证。
- **主题、皮肤和插件安装：**RC.2 还没有逐项安装权威，因此 Finder 对 RC.2 返回 0 个条目，也不会交给安装器。基线认证不会自动让某个目录条目变成可安装项目。
- **RC.8 逐项通道：**只对已有独立条目证据的精确站内和社区记录继续开放。

这种分层可以防止“运行测试通过”被误用成“任何主题都能安装”。

## 从这里开始

### 通用安装

如果你已经安装了 DeepSeek Harness，请在 DSH Themes 卡片或详情页左上角找到唯一公开 `#编号`，例如 `#2004`，然后告诉 Agent：

```text
请帮我安装 DSH Themes 的 #2004。
```

这就是普通用户需要提供的全部内容。你不需要准备包名、版本、下载地址、`.tgz` 路径或校验值。Skill 会在后台解析这些信息，确认每个字段都指向同一个条目，说明即将进行的修改，并在真正更改 profile 前向你确认。

`DSH-2206`、`DSH-FS-009`、名称、slug 和详情页地址属于旧标记、内部坐标或查找线索，**不是**第二套安装编号。

固定 `v0.6.0` 标签发布后，只需安装一次配套 Skill：

```bash
npx --yes skills@1.5.23 add \
  https://github.com/LvvUP/dsh-themes-skills/tree/v0.6.0 \
  --skill dsh-theme-finder \
  --skill dsh-theme-manager \
  --skill dsh-community-skin-installer
```

不要把固定版本替换成 `main`、`latest` 或 `next`。标签发布前，promotion 分支仅供审查。

### 专属安装

在 [dsh-themes.com](https://dsh-themes.com/zh) 打开主题、皮肤或界面增强插件详情页。页面的复制按钮会使用相同的简短提示词，并自动放入当前页面的公开 `#编号`：

```text
请帮我安装 DSH Themes 的 #2004。
```

通用安装与专属安装使用同一个解析器和同一套失败关闭检查。如果条目待验证、仅供展示、无法唯一匹配或证据冲突，Agent 会直接说明暂时不能安装，而不会让你收集一长串技术字段。

### 我还没有安装 DeepSeek Harness

请先使用 [DSH Themes 安装页面](https://dsh-themes.com/zh/install)中独立的**安装 DeepSeek Harness**任务。确认 DSH 能正常打开后，再选择一个 `#编号`。

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
| **RC.8 逐项通道** | 最终 Manager 证明、32 个精确站内元组，以及 11 个由独立规则约束的社区记录 | 只有每个条目的制品、权利、运行、同意和回滚门槛全部通过时才可运行 |
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
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | 解析一个公开 `#编号`、分类证据，且只在所选条目具有独立权威时交给安装器。 |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | 在可运行通道中验证、安装、切换、移除和恢复一个精确站内条目。 |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | 只有 Manager、条目回执、用户同意和回滚门槛全部通过时，才安装 allowlist 社区条目。 |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | 在可运行的 RC.8 创作 sidecar 下创建确定性、纯数据 V3 清单；RC.2 创作仍禁用。 |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | 验证清单并打开不携带凭据的网站交接；RC.2 投稿仍禁用。 |

```text
一个公开 #编号
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
