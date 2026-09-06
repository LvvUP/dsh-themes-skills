# Alpha Session v2 副本迁移验证

本次验证在 macOS arm64、Node 24.15.0 上，直接调用官方 `0.1.3-alpha.1` 已编译模块。固定源码为 `d347e703908d0406b7a7ef80e3a0e594d86b2215`，现行 Session format 为 `2`。**11 项检查通过**，覆盖未压缩 JSONL 的历史迁移、持久化重开与消息恢复；不表示真实用户会话或模型继续执行已获认证。

入口为 [verify-dsh-alpha-session-migration.mjs](../../scripts/verify-dsh-alpha-session-migration.mjs)，可审阅回执为 [dsh-alpha-session-migration.json](dsh-alpha-session-migration.json)。该回执字节 SHA-256：

```text
f909cf6bb8a42b865b88cc25d196f4184fb605af9644c075dafe891063739444
```

## 输入与隔离

唯一复制的上游真实格式 fixture 为固定提交中的 [`released-v0-real-shapes.jsonl`](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/session/session-persistence-jsonl/tests/fixtures/released-v0-real-shapes.jsonl)。其余输入是根据官方相邻迁移测试构造的测试数据，模型和工具均只有记录，不发生实际调用。原 fixture、官方源码和已编译模块均只读。

运行数据保存在 `.cache/dsh-alpha/session-copy/run-Z4xdOu/`，没有访问真实 Harness home、用户会话或 API。每次运行创建全新的子目录，不覆盖此前证据。第一次调试回执 `run-HKNsR4/receipt.json` 保留为失败记录：当时合成工具消息没有提供与内容匹配的完整 stream，另有错误分类和非法输入断言需要校正；它不计入本次通过结果，也不代表官方真实 fixture 迁移失败。

## 实际覆盖

| 检查                 | 观察与断言                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 官方 v0 fixture → v2 | `stat/list` 只投影版本、不发布后继；`open` 仅新增 `session.v2.jsonl`，不发布中间 v1；重试延迟、重复 compaction、引用序号重映射和 late-title 内容保留    |
| v0、v1 工具记录 → v2 | `Session.fromRestore().deriveMessages()` 恢复用户、助手和工具结果；包内 stream 与助手消息匹配；工具参数、结果和 opaque 元数据保留，引用按存活事件重映射 |
| v1 packed rows       | 输入确实包含物理 `text-chunks`；解码恢复 `hello`，v0/v1 同目录时选择最高 v1，再发布 v2                                                                  |
| 重开与写入恢复       | 新 backend 重开得到相同事件/消息且不重写 v2；write handle 追加新 turn、flush、close 后再次打开能读回完整前缀和新增事件                                  |
| v2 未知事件          | `ignorable: true` 的未知事件保留，消息投影忽略它；非 ignorable 未知事件明确拒绝                                                                         |
| 历史未知事件         | v0/v1 即使标记 ignorable 仍拒绝迁移，不写出 v2                                                                                                          |
| 未来最高版本         | 存在可读 v0/v2 时，最高 v42 仍拒绝，不退读较低版本                                                                                                      |
| 损坏 header/body     | 记录实际的 corruption/unsupported 错误类别；失败前后全部已有 generation 路径、字节、inode 和 mtime 保持不变                                             |

成功与拒绝路径都核对源副本 SHA-256、字节数、device/inode 与 mtime；结束时再次核对官方 fixture、已选编译入口身份和 `git status`。回执含 `runtime`、`script`、`fixture`、`compiledEntryFiles`、`caseCount/passed/failed`、`results[]` 与 `limitations[]`，便于最终 baseline attestation 绑定精确脚本和输入。

## 复现

先完成固定 Alpha 源码的官方构建，然后在网站仓库根目录执行：

```bash
node scripts/verify-dsh-alpha-session-migration.mjs
```

默认读取 `$HOME/.dsh-themes/runtimes/0.1.3-alpha.1`，也可用 `--runtime <固定源码路径>` 指定已经构建的同一提交。脚本不会安装依赖、构建上游或修改官方源码。stdout 返回此次独立回执路径及 SHA-256；存在失败时退出码为 1。

## 边界

本次不覆盖 Zstandard、torn frame、进程崩溃、磁盘写满、并发 writer、fork seed 边界、第三方扩展 payload 或跨平台文件系统差异；不调用模型、工具或 agent-loop 的实时 resume，也不验证浏览器会话 UI。编译入口指纹只是本检查直接选用的模块，不替代完整依赖闭包证明。官方依据见[固定 persistence 文档](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/docs/subsystems/persistence.md)和该版本的 JSONL generation、v0→v1、v1→v2 测试。
