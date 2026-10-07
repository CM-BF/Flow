# TUI01F 局部运行与增量

固定 `a1f82f36a5e63f859ecdcdbd1da3575724e82101`。产品实现与 `044ab84db42606fb1757903258078e3dfbab9545` 相同；仅新增真实 TurnObservation mock-port 聚焦旧轮次用例，README 更新当前验证边界。原 [source-manifest](source-manifest.json) / source-preparation / independent-source-precheck 保持历史原样，NOT_RUN 是当时事实；旧 manifest 的 docs 绑定取历史 delivery d6b8acb30b9ab4064b9098f32b5afdf54a628f77，不冒称当前可变说明逐字相同。

| 实际选择 | 结果 | 边界 |
| --- | --- | --- |
| 7 个原新 controller + 1 journal/JSONL + 15 旧 controller + 12 旧 queue | 35/35，Vitest 991ms | 无 HTTP server / PG；既有单 intent 直接消费者。 |
| real observation controller 命名用例 | 1/1；同文件 7 未选择，415ms | 使用真实 TurnObservation 实现 + mock 只读端口；聚焦旧 turn 时不取消最新 task；activity/refresh 不新增正文读取。 |
| 显式 6 个 TS/TSX entry 的依赖闭包 | focused noEmit exit0，2.19s | **不是 root noEmit**；完整 server/runner 未物化，不补全树。 |

合计 36 个不同用例，分两次运行；其中 9 个新增、27 个旧直接消费者。全部第一次绿，没有 red 或修复故事，不人为制造失败。类型 stdout 0 bytes，exit0 由 bounded-run 实际进程回执 focused-types.json 记录。Node24、Vitest4.0.18、TS5.9.3；精确命令、选择和 raw stdout 在各同名 json/txt。

资源：每次 fresh free 均至少 1GiB+8MiB；自有临时目录采样峰值最多 1357756 B，raw stdout 共 887 B，运行后自有临时目录均已删除。采样不是 OS 总物理峰值或空间预留；既有第三方只读路径由 Lead 创建的 dependency-view.json 绑定，workspace aliases 仅本候选。没有新 node_modules 缓存文件、安装或 donor 修改。证据与 cache/timer 生命周期属于局部窗口，不代表个人服务停机。

仍未执行真实 HTTP/PG cancel、实际 PTY/resize/CJK 操作、真实 App↔TUI；已有 journal/JSONL 与 mock observer 不能替代它们。未知原 request/task/key 和任务范围 cancel 无 attempt CAS 的限制不变。独立预检只 SOURCE_PRECHECK / NO_P1_P2_FOUND；新的 bounded execution/test-only delta 尚待独审，不自行写 APPROVED。

记录 2026-10-06 16:03 UTC；0 provider / 0 个人服务操作。
