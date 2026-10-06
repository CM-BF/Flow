# 超低成本性能样例

| 字段 | 内容 |
| --- | --- |
| 计划编号 / 状态 | LAB01 / in-progress |
| 创建 / 更新 | 2026-10-06 / 2026-10-06 |
| Owner / model | assignment_review / gpt-6-astra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/performance-probes` / `codex/performance-probes` |
| Base | `5bdb7fa293ebd0d13515fe367f004687927f1897` |

用户授权两个可丢弃本地 toy，独立于产品、W01、D01 和协议 P01。0 付费模型、0 云；复用已有 Node 24、Playwright 与本机 Chrome。仅写 `experiments/performance-probes`、本 plan 目录和 `docs/evidence/lab01`。不改依赖/锁文件，不合并 main。

## TODO

- [x] **LAB01-01** 创建两个最小样例并验证详情展开、逻辑事件与最终状态正确
- [x] **LAB01-02** 每项少量预热、至少20次有效重复；记录原始参数、环境和p50/p95
- [x] **LAB01-03** desktop/narrow及浅深色截图，实际查看并核验功能
- [ ] **LAB01-04** clean-code、测量边界、复跑说明与提交交付，等待独立review

## 测量方案和预算

A：同一固定种子合成工具结果，完整 timeline 对比正文+id/title与按需单详情。HTTP gzip，浏览器记录未压缩字节、encodedBodySize及transferSize、请求数、JSON解析与详情展开延迟；检查展开内容摘要。字节不等于LLM tokens。

B：128个模拟agent接收同一有限事件序列。逐事件更新DOM，对比按有界块合并同agent显示更新；模型仍逐条处理全部逻辑事件。记录真实MutationObserver变更数、longtask和排队控制动作响应时间。确定性控制探针不是INP或人类体验SLO；不推断React、产品或128个真实模型并发。

每样本<10秒；实际benchmark累计目标≤120秒；生成/传输/保存数据各自记录并控制在64MiB内。2次预热，20次配对交替顺序重复；失败样本保留且不进入分位数。页面只使用vanilla JS、本地样式，无外部网络资源。使用ready信号，不能使用networkidle。

## 视觉方案

实验工作台：左对照说明与运行按钮，右事件与128格状态视图；窄屏上下排列。系统无衬线字体，左对齐，避免动画和装饰性图表。浅色`#f3f6fb`/白底、墨蓝`#173454`、蓝`#245db0`、暗绿`#17634d`；深色`#162535`/`#203347`、浅字`#e9f0f8`。重点是可读的真实实验状态，截图不作为性能测量的一部分。

## 验收与限制

先验证一致性才接受性能数字，记录机器/浏览器/计时器精度/当前并行噪声和原始数据。仅报告p50/p95，不报p99。结果待[review](review.md)独立复核；[status](status.md)是唯一手填进度源，main状态单列。

2026-10-06实质记录：全部88个含预热样本有效、四图已查看；[结果报告](../../docs/evidence/lab01/README.md)显示本负载无长任务瓶颈，DOM批量写入减少但帧等待增加完成时间。不增加事件量；CLI额外smoke未做。实测机器为M3 Max，不冒称M1结果。
