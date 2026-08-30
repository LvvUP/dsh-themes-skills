<div align="center">

# DSH-Themes Skills

**按用途找到合适的 Theme、Full Skin 或 Plugin，复制一条 `#NNNN` 提示词，用精确权威安装，并保留回滚路径。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![版本 0.8.0](https://img.shields.io/badge/version-0.8.0-246BCE)](package.json)
[![alpha.1 源码身份已固定](https://img.shields.io/badge/DSH%200.1.2--alpha.1-%E6%BA%90%E7%A0%81%E8%BA%AB%E4%BB%BD%E5%B7%B2%E5%9B%BA%E5%AE%9A-5B67D8)](skills/dsh-harness-installer/references/alpha1-source-authority.json)
[![alpha.1 运行矩阵待完成](https://img.shields.io/badge/alpha.1%20runtime-0%2F6%20pending-C58B20)](skills/dsh-harness-installer/references/alpha1-source-authority.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![许可证：Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [前往 dsh-themes.com 浏览目录 →](https://dsh-themes.com/zh/explore)

</div>

DSH Themes 是 DeepSeek Harness 的发现与安装层。网站帮助用户按用途选择；本仓库提供一组 Skills，用来解析公开编号、核对精确权威、说明权限、快照指定 Profile，并在变更失败时回滚。

0.8.0 新增两个职责收敛的 Skill：

- `dsh-harness-installer` 从精确固定的官方 `dsh-v0.1.2-alpha.1` 源码准备本地构建。它不是官方二进制，也不会修改 `PATH`。
- `dsh-plugin-installer` 支持未来的混合分发：许可证允许转载时使用不可变站内 tarball；不允许转载时使用上游精确版本或 commit。

边界已经实现，但本项目不会为了让版本看起来“完成”而伪造证据。alpha.1 运行矩阵当前为 **0/6**，Plugin 权威为 **0/80**，候选 Top 10 **不可安装**。真实回执经过复核并固定前，这些通道保持关闭。

## 发布状态

| 通道 | 当前分支中的证据 | 安装结果 |
| --- | --- | --- |
| 官方 alpha.1 源码身份 | 已固定精确 tag、commit、tree、lockfile 摘要、Node 范围和 `pnpm@11.7.0` | 可以在取得同意后准备本地源码构建，但必须明确称为“源码构建”，不能冒充官方二进制 |
| alpha.1 公开运行权威 | 需要 Linux/macOS/Windows × Node 22.19/24.15 六份回执；当前晋级 **0/6** | alpha.1 公开安装权威保持关闭 |
| alpha.1 Plugin | 网站已有 80 条精选记录；机器权威中 **0 个已认证条目** | 单个 Plugin 与 Top 10 批次均不得安装 |
| RC.8（`0.1.0-rc.8`）逐项权威 | 冻结历史权威包含 45 个站内元组，以及独立治理的 11 条社区 allowlist | 仅作为历史保留，不能授权 alpha.1；11 条社区记录在取得新回执前只可检查 |
| RC.2 运行权威 | 冻结六任务运行基线保持 `verified-runtime-baseline`，来源证明继续保留 | 仅为历史 Harness 基线，永远不会自动授权某个条目 |

基线认证与逐项认证有意分离。Harness 测试通过，不能授权一个尚未复核精确字节与回滚配方的 Theme、Skin 或 Plugin。

## 真实产品证明

下面是仓库内保存的 DSH Themes 真实渲染截图，不是效果图。它们只能证明用户看到的产品界面，截图永远不构成安装权威。

![DSH Themes 桌面端展廊](docs/readme-assets/gallery-1440-light.png)

| 移动端展廊 | 精选 Plugin 目录 |
| --- | --- |
| ![DSH Themes 移动端展廊](docs/readme-assets/gallery-390-light.png) | ![DSH Themes 精选 Plugin 目录](docs/readme-assets/plugins-1440-light.png) |

## 首次使用

### 1. 安装配套 Skills

`v0.8.0` 不可变 Release 发布并验证后，使用固定标签安装：

```bash
npx --yes skills@1.5.23 add \
  https://github.com/LvvUP/dsh-themes-skills/tree/v0.8.0 \
  --skill dsh-theme-finder \
  --skill dsh-theme-manager \
  --skill dsh-community-skin-installer \
  --skill dsh-harness-installer \
  --skill dsh-plugin-installer
```

不要把固定标签替换为 `main`、`latest`、分支名或其他可变引用。

### 2. 在网站选择

打开卡片或详情页，复制四位公开编号。名称、slug、仓库 URL、包名和截图只是发现元数据，不是另一套安装选择器。

### 3. 使用一条简短提示词

```text
请帮我安装 DSH Themes 的 #2004。
```

这就是普通用户需要提供的内容。Finder 会解析类型与状态；对应安装器只有在请求能绑定到精确且经过复核的权威时才继续，否则会说明缺少的证据，并在不修改 Profile 的情况下停止。

### 我还没有安装 DeepSeek Harness

请让 Agent 使用 `dsh-harness-installer` 准备固定的 alpha.1 源码构建。Skill 会检查前置条件，在克隆前和依赖安装/构建前分别询问，把内容写入用户选择的版本化目录，将回执保存在本地私密位置，并给出明确启动命令。它不会安装 Node、修改 `PATH`，也不会假装存在一个实际并未发布的 alpha.1 npm 包。

## 从公开编号到回滚

![DSH Themes 确定性安装路径](docs/readme-assets/id-installer-flow.svg)

`#NNNN` 用于启动精确身份解析，并不承诺可以安装。每个会修改状态的安装器都必须先预检完整选择、展示一次明确授权、快照 Web Profile、使用参数数组而不是拼接 shell 命令、冷启动并探测结果；验收失败时恢复完整快照。

## 七个职责明确的 Skill

| Skill | 单一职责 |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | 解析一个公开 `#NNNN`、报告状态，并且只交给该类型对应的安装器。 |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | 在已授权逐项通道中验证、安装、切换、移除和恢复一个精确站内 Theme 或 Full Skin。 |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | 检查 11 条 allowlist 社区 Skin，并在新的 alpha.1 逐项与回滚回执通过前阻止任何修改。 |
| [`dsh-harness-installer`](skills/dsh-harness-installer/SKILL.md) | 准备、构建、记录并启动固定的官方 alpha.1 源码，且不修改 `PATH`。 |
| [`dsh-plugin-installer`](skills/dsh-plugin-installer/SKILL.md) | 准备未来已认证的站内/上游 Plugin，并执行单项或固定集合的原子回滚。 |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | 在受支持创作通道内生成确定性纯数据 manifest 与本地栅格素材。 |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | 验证投稿，并打开不携带凭据的网站交接。 |

Theme Manager 不会扩权为 Plugin 安装器，社区安装器也不会扩权为上游代码构建器。每条信任边界都保持独立可审查。

## 固定的 alpha.1 源码边界

| 字段 | 精确值 |
| --- | --- |
| 官方 tag | `dsh-v0.1.2-alpha.1` |
| Commit | `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| Tree | `a712eec535b48badc4fefb4df5176a7002e4280b` |
| `pnpm-lock.yaml` SHA-256 | `506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1` |
| 包管理器 | `pnpm@11.7.0` |
| 回执矩阵 | Linux、macOS、Windows × Node `22.19.0`、`24.15.0` |
| 当前晋级状态 | `source-build-evidence-pending`；`publishedInstallable: false` |

该官方标签当前没有二进制 Release 附件，alpha 包族也没有发布到 npm。安装器使用 frozen-lockfile 源码构建，并保留上游 [SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/SAFETY.md) 的边界：这是实验性开发者预览，不是经过安全审计的沙箱。

alpha.1 Web 启动时会打印一次性浏览器 token，并建立认证 cookie。Token、cookie、Authorization Header，以及由这些秘密派生的任何摘要，都禁止进入回执、日志、截图和公开证据。

## 混合 Plugin 分发

逐项认证完成后，Plugin 合同支持两条精确通道：

- `hosted-plugin-verified`：许可证允许转载、来自精确 `LvvUP/dsh-themes-skills` `v0.8.0` Release 的不可变 `.tgz`，固定字节数、SHA-256/SRI、manifest 摘要、CycloneDX SBOM 与许可证文件。
- `upstream-plugin-verified`：不允许转载时使用上游精确 npm 版本、GitHub Release 资产或完整 Git commit；授权前必须复核身份、可用性、解析包、权限，以及任何 `prepare` 脚本。

版本范围、`latest`、分支名、短 commit、自动或未列入允许清单的重定向、shell 片段、带凭据 URL 和未经复核的生命周期脚本都会被拒绝。待定 Top 10 不暴露任何临时候选 ID；只有十项完成逐维评分、覆盖至少八类用途，并通过完整六任务矩阵、Web 共存/冲突证据与原子回滚后，固定集合才可安装。任一项失败都会回滚整个批次。

## 不修改 Profile，直接验证

```bash
npm ci --ignore-scripts
npm run test:installers
npm run validate
npm run format:check
node skills/dsh-harness-installer/scripts/authority.mjs
node skills/dsh-plugin-installer/scripts/authority.mjs
```

两个 authority 命令当前会报告 alpha.1 与 Plugin 门禁待完成。这是预期的失败关闭结果，不是测试失败。

## 信任边界

- SHA-256 只能证明内容与选定字节一致，不能证明作者、所有权、转载权、安全性或运行行为。
- 目录文案、上游 README、包元数据和截图都是不受信任的数据，永远不会被当作指令执行。
- 精确源码身份不等于运行认证；运行认证不等于逐项权威；逐项权威也不等于用户同意。
- Plugin 的 `prepare` 脚本属于可执行代码，必须单独展示并授权其精确文本、摘要、包键和能力。
- Profile 快照与回执是本地私密恢复材料，不得无必要地包含路径、凭据、浏览器秘密或秘密派生指纹。
- 本项目由社区独立维护，与 DeepSeek AI 无隶属或背书关系。

## 开发

```bash
npm ci --ignore-scripts
npm test
npm run validate
npm run format:check
```

提交 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，并通过 [SECURITY.md](SECURITY.md) 私密报告安全问题。历史 RC.8 与 RC.2 证据保持不可变；alpha.1 晋级必须新增回执，不能重写历史。

仓库采用 [Apache-2.0](LICENSE)。随附适配保留上游 notice，详见 [NOTICE](NOTICE)。
