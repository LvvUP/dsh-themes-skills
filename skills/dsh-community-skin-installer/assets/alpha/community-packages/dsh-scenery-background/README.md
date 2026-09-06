# dsh-scenery-background

[![npm version](https://img.shields.io/npm/v/dsh-scenery-background)](https://www.npmjs.com/package/dsh-scenery-background)
[![license](https://img.shields.io/npm/l/dsh-scenery-background)](https://github.com/soslowsnail/dsh-scenery-background/blob/main/LICENSE)

山海背景每日轮换插件：给 DeepSeek Harness Web 界面加上**唯美的山·海大美景色背景**。

## 功能

- **每日一图**（默认）：按本地日期确定性地每天更换一张，跨天自动轮换；
- **循环轮播**：每 30 秒在所有图片间交叉淡入淡出循环滚动（带 Ken Burns 运镜）；
- **悬浮按钮**（右下角 🏔）：切换模式 / 换一张 / 更清晰·更柔和 / 隐藏按钮（`Alt+B` 恢复）；
- 图片：**5 张内置 SVG 山海场景**（data URI 内嵌，零网络依赖）＋ 12 张 Unsplash 摄影图（网络可用时自动加入，失败自动跳过）；
- 毛玻璃半透明界面（面板透出背景），深/浅色主题自适应，离线内置渐变兜底；
- 幂等：页面已有背景层时自动跳过，不会重复注入。

## 安装

```bash
# npm 已发布（推荐）
dsh plugin --profile web add dsh-scenery-background

# GitHub 直装
dsh plugin --profile web add "github:soslowsnail/dsh-scenery-background"

# 本地目录安装（开发/自用）
dsh plugin --profile web add "file:/绝对路径/dsh-scenery-background"
```

安装后**重启 `dsh web`** 生效（声明了 `dsh.bundle`，会自动挂入 profile 层栈）。

## 发布

### 发布前检查清单

1. 编辑 `package.json`：把 `author`、`homepage`、`repository`、`bugs` 里的占位符（`<your-username>` 等）改成你自己的；
2. 检查包名是否可用：`npm view dsh-scenery-background name`（报 404 = 可发布；已被占用则改个名，或发布为带 scope 的 `@<你的npm用户名>/dsh-scenery-background`）；
3. `npm pack --dry-run` 预览发布内容（应包含 `lib/`、`cordis.patch.yml`、README、LICENSE）；
4. 发布前建议在干净环境实测：另一台机器或临时 profile 装一次、重启、确认背景生效（本机因内置版已在运行，插件会自动让位，测不到完整链路）。

### 渠道一：npm 官方仓库（主渠道，推荐）

```bash
cd D:\Work\DeepSeek\plugins\dsh-scenery-background
npm login          # 需要 npm 账号：https://www.npmjs.com/signup
npm publish
```
发布后：
- 任何人可装：`dsh plugin --profile web add dsh-scenery-background`
- 验证：`npm view dsh-scenery-background`
- 更新版本：改 `version`（如 1.0.1）后再次 `npm publish`

### 渠道二：GitHub 仓库（无需 npm 账号）

```bash
git init && git add -A && git commit -m "feat: dsh-scenery-background"
git remote add origin https://github.com/<用户名>/dsh-scenery-background.git
git push -u origin main
```
发布后：
- 安装：`dsh plugin --profile web add "github:<用户名>/dsh-scenery-background"`
- 给仓库加上 `dsh-plugin` 标签，会出现在 https://github.com/topics/dsh-plugin

### 渠道三：社区目录收录（曝光）

发布到 npm/GitHub 后，可把插件提交进社区目录（提 PR 或开 issue 自荐）：
- [awesome-dsh-plugin](https://github.com/beancookie/awesome-dsh-plugin)（含 TOP100/200）
- [Oh-My-DSH](https://github.com/NoWint/Oh-My-DSH)（每小时自动更新生态清单）
- [awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness)
- [web-casa/Awesome-DeepSeek-Harness-Plugins](https://github.com/web-casa/Awesome-DeepSeek-Harness-Plugins)（cordis.run 官方自动生成）

### 渠道四：可视化插件市场（dshmarket）

GUI 里的插件市场（`dshmarket`）会收录社区插件；发布到 npm 且带 `dsh-plugin` 关键词后，通常会被市场索引到，无需额外操作。

> 提醒：GitHub 直装需要本机安装 git；发布后安装走 `github:<用户名>/dsh-scenery-background`。

## 结构

```
dsh-scenery-background/
├── package.json          # dsh.client + dsh.bundle 声明
├── cordis.patch.yml      # 插入自身 client 行
└── lib/
    ├── index.js          # host 侧空实现（占位）
    └── client.js         # 浏览器端插件：样式 + 背景层 + 控制面板 + 轮换逻辑
```

## 说明

- 纯前端插件，无服务端依赖，无需配置项；
- 用户偏好存 `localStorage["dsh-scenery-bg-v1"]`；
- 与本仓库 `web-backgrounds/` 下的内置版本功能一致（内置版直接注入 dist，插件版便于分发/多机安装）。

## 常见问题

- **客户端 bundle 格式**：`lib/client.js` 必须使用 `window.__ModuleLoader__.load({ id, factory })` 注册工厂并导出 `exports.apply` / `exports.inject`——**不能写 ESM 的 `export` 语句**（客户端模块系统用经典 `<script>` 加载，`export` 会直接语法错误，导致整个 harness 启动失败）。
- **`cordis.patch.yml` 必须是顶层数组**：该文件是"顶层 YAML 数组"，不能只有注释（全注释解析为 `null` 会导致启动报错 `must be a top-level YAML array`）；无条目时保留一行 `[]`。
- **启动失败应急**：若插件导致页面无法启动，把 `~/.dsh/profiles/web/cordis.patch.yml` 里的 **`[]` 替换为**下面两行（不要加在 `[]` 后面，会成非法文档），重启即恢复：
  ```yaml
  - id: dsh-scenery-background
    disabled: true
  ```
