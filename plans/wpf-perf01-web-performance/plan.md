# WPF-PERF01 Web 性能基线与后续优化

创建/更新：2026-10-06。状态：in-progress。唯一 owner：w01_owner（派发 gpt-6-astra / ultra）。固定输入 M02 `c526c1c889437ee39155d669921577995195c74e`；本段仅测量，**不代表 I01 最终性能**。

## 目标与本轮范围

继承主管理 performance-cycle 的稳定任务 ID。先形成有界、可复现的生产 App 性能基线，再用证据提出一个生产优化范围；本轮没有生产代码写权，不把测量或建议标为优化完成。保留官方 Thread / AI Elements、独立任务语义、历史锚点、缓冲、按需详情和观察预算。

唯一可写范围：`apps/web/test/performance-fixture.ts`、`apps/web/test/performance-probe.ts`、本目录、`docs/evidence/wpf-perf01/`。D04 committed receipt 已取得；临时根 lock 仅依已授权安装例外，交付导出 patch 并恢复，不提交根 manifest/lock。

## 测量方法

- 固定生产 build、机器/浏览器版本、viewport 与合成文本长度。先小样本校验采样与 HTTP fixture，再扩大到 1/16/128 个 task、连续 10000 条 workspace 记录；记录实际到达/展示数量和超时，不伪称 agent 容量。
- 真实浏览器输入和滚动，记录原始动作采样、DOM、网络请求与 long tasks；生产 React render 次数无法无侵入取得则标 unknown，不用开发 Profiler 冒充生产。
- 内存 API 支持显式报告；CDP 的 JSHeapUsedSize 若可用只称进程所报 JS heap 样本，不推算驻留对象数/泄漏。另用公共 projection snapshot 做隔离驻留计数，不能代替实际 App heap。
- 记录初次详情 0→1、重复缓存、1/2 可见 pane SSE 预算及关闭不取消。先功能有效性，再性能观察；不以低样本 p95 或本地动作耗时冒充真实用户 INP。
- 最大规模超时/页面错误/失去响应保存失败事实；不降低阈值迁就结果。所有自建服务用动态端口且 finally 关闭，不碰 4320 或其他 owner 服务。

## TODO

- [ ] **WPF-PERF01-01** 记录生产体积、固定环境与真实 App / 隔离 projection 的分离基线。
- [ ] **WPF-PERF01-02** 依证据选择一项瓶颈，另领生产范围后实施有界优化（本测量段仅建议）。
- [ ] **WPF-PERF01-03** 当前测量脚本独立 review；后续优化同条件比较与功能回归，登记下一轮。

## 验收与限制

必须保留原始样本、构建 hash、规模和方法；脚本校验 fixture 页契约、采样确实收到真实输入/滚动/数据，明确重复次数与样本不足。当前无外部中心/模型/真实用户负载；不建立性能 SLA，也不以单次观察证明因果。待稳定提交由独立 reviewer 绑定 SHA 检查。

## 来源

本地 find-skills、vercel-react-best-practices、webapp-testing、clean-code；具体方法与版本见[质量记录](../../docs/evidence/wpf-perf01/quality.md)。公共测量定义使用 W3C Long Tasks / Event Timing 和 Chrome DevTools Protocol 官方文档。
