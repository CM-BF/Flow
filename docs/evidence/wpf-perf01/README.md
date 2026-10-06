# WPF-PERF01 固定 M02 生产测量

输入 `c526c1c889437ee39155d669921577995195c74e`，最终脚本 target `3d47cdd4eae959119f154a0d06964cf65006f8c9`（1/16结果来自c40，128来自3d47）。这是 **M02 预 I01 基线**，不是主线最终性能，也不是模型/agent执行容量。三个规模均取得成功样本；原128首次harness失败保留。见[结果与下一轮建议](results.md)。

## 复现

在 web-performance worktree 使用 Node24.20.0 / pnpm9.15.4 与已安装依赖：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/performance-probe.ts --self-test
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/performance-probe.ts --smoke
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/performance-probe.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/performance-probe.ts --tasks=128 --label=retry128
```

`--self-test` 仅2组真实HTTP/public projection有效性。`--smoke` 生产build+1task/100与240新增；无参数3场景1/16/128task各10000新增。每次生产build写系统临时目录，普通App编译（没有fixture flag/Profiler替换），浏览器经原连接页使用无秘密的fixture token；同源HTTP/1.1动态端口、静态资源不gzip/不cache，结束清理浏览器/服务/临时build。命令会重写本证据目录的同名raw产物；需比较的旧运行请先另存至自己授权范围。

根lock仍是固定输入版本，冻结安装会因基线manifest不一致失败；本轮已依GoalOwner收紧范围恢复lock，不再修改。`dependency-lock.patch`仅是首次安装差异证据，不授权reviewer应用或重写共享lock；新机器安装须交Lead统一提供批准依赖环境。

## 工作负载和采样含义

- 三场景总新增量都为10000、正文256字符，round-robin分配至task；初始快照40条另计。生产HTTP分页40条，最多3页即时catch-up与250ms退让来自原App。producer每50ms追加100条，阶段100/1000/5000/10000。初始fixture每task另有reference，早于最新40条快照，不将它计为新增文本。
- 初始有效性先打开至多8个chat，再关闭一个，验证稳定时单pane=1/Split=2/Merge=1/overview=0 SSE、不发送cancel；详情0→1→缓存仍1。长feed阶段位于overview，active chat SSE为0；不是128并发SSE测试。完整task index通过正常分页读完并返回Activity，因此后续heap包含这些实际已访问视图状态；1task与多task的初始访问状态差异明确保留。
- 每阶段在到达期间与展示后各12次真实键盘输入（Find chats中p/Backspace交替，最终空值）、4次真实wheel；可信事件、实际scroll offset变化与最终DOM记录数均断言。不是page.evaluate修改输入值或直接调用App方法。
- Event Timing支持检测、durationThreshold16ms，原始duration按浏览器8ms量化；`inputDelay`为processingStart-startTime，`duration`到下次绘制，二者分列。API只报告达到阈值的事件；无样本不是0延迟，不拿这组阈值过滤样本估全体p95/真实用户INP。
- wheel不属于Event Timing。单独先记录分派前offset，再以可信wheel时间戳到首次rAF观察offset改变的差值为近似；不是物理呈现时刻或INP。键盘handler→rAF也只是浏览器采样，不称纯React渲染时间。
- Long Tasks observer仅在支持时启动，报告>=50ms的页面任务；整场raw含导航、有效性检查、网络到达、输入与reveal，按raw phases划分才能讨论某阶段。未启特殊React profiling build，renderCount=null。
- CDP JSHeapUsedSize/TotalSize未强制GC，是粗略JS heap样本，不是实际App存活对象/泄漏证明。跨源隔离与UserAgentSpecificMemory支持逐点记录，不因不可用写0。另一个`projection-retention.json`是Node公共projection+HTTP，明确独立于浏览器heap。
- `before-reveal`只等待server已发出目标cursor，是浏览器应用末页之前或之后的**中间采样**，不声称buffer已完整结算。`revealed`才有40+target实际DOM条数断言。
- `deliveryAndInteractionWallMs`包含producer、HTTP轮询、自动化、reveal与采样；`revealAutomationMs`包含点击、DOM等待、rAF、measure/CDP往返。两者均为综合自动化壁钟，不称render/paint耗时。
- 每个规模仅一次运行；无性能SLA、不报p95，不以共享开发机下的单次差异证明因果。追赶180s/reveal60s是预定有界诊断上限，超限原样失败并继续其他场景。

## 证据

- [环境/生产资产hash](baseline-environment.json)、[矩阵运行](baseline-run.json)、[1task](baseline-1.json)、[16task](baseline-16.json)、[128task重跑](retry128-128.json)、[原128失败](baseline-128.json)。
- [小样本](smoke-1.json)、[局部有效性](fixture-checks.json)、[独立projection驻留](projection-retention.json)。
- [技能与clean-code](quality.md)、[claim回执](coordination-receipt.json)。
- 初始采样器失败保留 `sampling-wheel-first-failure.json` / `sampling-serialization-failure.json` / `sampling-locator-failure.json` 和对应截图。它们是已修测试采样问题，不能混入App性能结果或删去失败事实。

最终代码与raw已获root只读核对，正式review待完整报告返回；所有未来生产优化另领范围，不在这次脚本中改进数字。
