# WPF-PERF01 Web 性能基线与持续优化

创建/更新：2026-10-06。状态：`accepted`（方向已授权，实施排队）；唯一计划/status owner：d01_owner / gpt-6-astra ultra。父计划：[WPF-001](../plan.md)。固定基线 `d444608ab6c796c731e44e51a892868bf39bec2a`；当前文档在 `codex/web-platform-management`，不代表实现已开工。

## 目标与已确认约束

按用户持续优化要求分轮测量、定位、修正和复验，不把无限优化或“完美”声明完成。先完成W01官方Thread与新布局行为稳定，再挑实际瓶颈；不得为bundle指标盲删用户要求的官方组件。owner空出后独立worktree实施，当前W01可先提供生产build体积。

历史W01证据基线：CSS12.50kB/gzip3.23，mainJS329.14/gzip100.65，assistant-ui284.85/gzip83.60。新官方Thread/Markdown/AI Elements依赖已改变，应建立新基线并报告增量，不以“chunk小于500kB”当性能验收，也不把调整chunk分组声称减少首屏总JS。

## 测量方案与验收

记录机器、浏览器、build SHA/模式、fixture规模、命令、采样方法、实际样本与失败。固定生产build测冷启动/首次可交互、tab切换/split/merge；多次样本才报中位数，p95仅在样本数足够时报告，否则保留原始范围。React Profiler开发耗时不冒充生产；真实用户INP75百分位与本地动作时长分开。

同时检查每task观察请求数、同task不重复observer、首屏detail请求0/首次打开1/重复缓存、关闭tab释放观察但不cancel、长历史DOM/滚动稳定、草稿保留。1000/10000 synthetic是本地规模测试，不宣称模型容量。懒chunk必须error boundary/retry/离线明示，防止未加载即离线整页崩溃。

按local tests约束先模块+直接依赖，触及共享接口才扩链路；性能改动保留关键行为/视觉/a11y回归。每轮只实施有证据的瓶颈优化，保留前后同条件比较和代价。

## 当前新增基线与下一可测问题

W01 cb4a392生产产物：JS1,081,775B/gzip323,056B；CSS82,839B/gzip15,047B。HTML同时入口与modulepreload两个大JS组，当前均为首屏请求，不能称已懒加载。后续测连接页/工作总览request/parse/interactive，再评估Thread与重renderer动态边界；保留官方完整组件。content-visibility仅减少屏外绘制，不等于网络或DOM有界。

React.lazy会缓存load Promise/rejection；仅reset ErrorBoundary不保证重试import。必须实测chunk失败后实际再次请求/恢复与离线反馈，lazy定义模块级稳定，切换焦点/草稿不丢。不因本研究阻断当前两feature，仍按独立性能轮推进。

原Goal Owner定向增量：后续用固定1/16/128合成task连续更新，同时实际输入与滚动，记录输入延迟/render数/long tasks/attention出现延迟。保持每task独立projection、未变对象与可见片区窄订阅；不指望startTransition把external mutation变非阻塞，不为猜测引状态库或全量机械memo。此为UI合成负载而非agent容量证明；现阶段M02/P01继续。

优先正确性发现：root已用7chat浏览器复现HTTP/1 SSE连接占满，P2 blocking，修复已由M02 d47完成并获root独立APPROVED；性能轮保留观察请求数/可见pane预算回归，不等待bundle优化。Node并发测试不替代浏览器连接池证明，停观察不可cancel任务或重置幂等ACK；当前补2page/hidden恢复/2split的实际局部验收。跨多窗口集中预算留主线B01后续，当前不引SharedWorker/BroadcastChannel。具体步骤见研究RS14。

## TODO

- [ ] **WPF-PERF01-01** 记录新W01生产体积、依赖使用和固定环境/fixture交互基线。
- [ ] **WPF-PERF01-02** 选一项实际瓶颈，在独立owner worktree进行有界优化。
- [ ] **WPF-PERF01-03** 同条件比较、功能回归与独立review，登记下一轮证据支持的优化。

## 来源与变更

需求见父计划U00～U07及稳定REQ表；工程研究/官方出处见[研究台账](../../../docs/evidence/web-platform/research.md)。2026-10-06首版：建立独立验收与唯一status/review；未实施事项保持pending。


## 长时feed驻留：待浏览器量测的具体假设

root只读固定M02 d47：accept对entries/buffered全量Map+sort，当前无客户端驻留上限。不是已证实的UI性能故障。readonly公开refresh探针100批×100条、每条256字符，前50批following、后50批reading；第1/10/50/100批entries为100/1000/5000/5000，末buffered5000，revealNew后entries10000/buffered0。Node sampled refresh0.443～0.702ms（首0.484）仅进程内函数测量，不是浏览器输入延迟、内存、网络或模型容量。

下一固定生产浏览器样本合并现有1/16/128合成task与连续10k记录，记录retained entries、buffered entries、DOM数量、实际输入/滚动延迟、long tasks及可测内存。先证据再选择bounded history/cache或订阅改动；必须保留历史分页锚点、新记录缓冲、决策到达及展开详情缓存语义。content-visibility跳过部分layout/paint不减少JS保留对象，不能把CSS当驻留预算；来源为[MDN content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility)和[React external store](https://react.dev/reference/react/useSyncExternalStore)。


## 下一段精确测量范围（03:06 UTC）

P01整体6ce已获APPROVED，拟复用w01_owner为WPF-PERF01实施owner；独立tree web-performance / branch codex/web-performance，从已审M02最终metadata c526c1c889437ee39155d669921577995195c74e仅初始化，D04 receipt后正式写入。拟精确scope仅 apps/web/test/performance-fixture.ts、apps/web/test/performance-probe.ts、plans/wpf-perf01-web-performance/、docs/evidence/wpf-perf01/；没有生产路径，也不碰I01 App。

这是固定M02预I01基线，不冒称未来I01最终性能。真实production App指标与公共projection隔离对象驻留计数分报告；浏览器内存API不可用就记录不可用，不推算堆对象。输出原始样本/机器/build/模式/方法与局限，性能因果未验证不抢先优化。实际owner三件套建立后本管理目录转stub，唯一source移交。新实现待基线证据后单独申请生产scope。
