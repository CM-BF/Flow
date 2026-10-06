# 结果与下一轮建议

2026-10-06 03:20 UTC。三个场景完成相同10000新增文本，最终40+10000行均有真实DOM断言。检查通过只表示负载/采样有效，**不表示已达到性能SLA或已优化**。

## 固定输入与出处

生产输入 `c526c1c889437ee39155d669921577995195c74e`。1/16task脚本为 `c40f1a02252198f4a4b1a80474743d72b1fa1dca`；128task成功重跑为 `3d47cdd4eae959119f154a0d06964cf65006f8c9`。后者仅修分页等待并加入局部重跑参数/文件名限制，没有改变采样与App；两次全部生产assets字节/gzip/hash和HTML完全相同（[汇总](summary.json)）。

| 场景 | Raw / environment | 状态 |
| --- | --- | --- |
| 1 task | [baseline-1](baseline-1.json) / [环境](baseline-environment.json) | passed，c40 |
| 16 tasks | [baseline-16](baseline-16.json) / [环境](baseline-environment.json) | passed，c40 |
| 128 tasks 首次 | [baseline-128](baseline-128.json) / [截图](baseline-128-failure.png) | failed，开始负载前的harness分页竞态；0测量点，不是App性能超时 |
| 128 tasks 重跑 | [retry128-128](retry128-128.json) / [环境](retry128-environment.json) | passed，3d47；[重跑结果](retry128-run.json) |

原首次[运行记录](baseline-run.json)保留1/16通过、128失败，不改写。`fixture-checks.json`、`projection-retention.json`是最后3d47运行的辅助检查，已由重跑更新；不能声称这两份辅助文件仍是原c40版本。

机器 Apple M3 Max /16逻辑核/64GiB，Darwin25.6 arm64；Node24.20.0、Chrome154.0.8037.98 headless、1440×1000、reduced-motion=reduce，无CPU/网络限速。同机有其他agents开发，两个run开始loadavg分别9.54/8.70/8.01与6.89/7.99/7.87；每规模一次，不是独占机器重复实验。

## 观察值

“键盘→rAF”每场96个可信keydown、“wheel→观察到offset改变的rAF”每场32个实际滚动样本。以下中位数/最大值是这些相关自动化动作的描述性统计，不是INP、p95或真实用户分布。

| tasks | 最终记录行 | DOM元素：初始→最终 | 未强制GC JS heap样本 | 整场longtasks条数 / 最大 | 键盘→rAF 中位 / 最大 | wheel→offset rAF 中位 / 最大 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 10,040 | 404 → 70,404 | 19.6 → 67.9 MiB | 8 / 705ms | 11.25 / 70.4ms | 33.25 / 75.8ms |
| 16 | 10,040 | 1,006 → 71,006 | 21.4 → 57.3 MiB | 7 / 719ms | 12.75 / 58.8ms | 33.10 / 82.2ms |
| 128 | 10,040 | 1,017 → 71,281 | 26.0 → 65.1 MiB | 17 / 712ms | 11.65 / 85.8ms | 33.60 / 70.7ms |

Event Timing threshold-filtered样本分别189/200/201个，inputDelay中位均约0.1ms、最大40.2/26.6/50.6ms；duration中位均24ms、最大72/64/88ms。原始事件按>=16ms报告且8ms量化，低于阈值事件不完整，因此不从“没报慢事件”推零延迟或p95。详见[原始汇总](summary.json)。

705/719/712ms最大longtask均在`delivery-10000`阶段；`delivery-5000`有307/313/318ms。该阶段还包含HTTP到达、reveal、自动化与DOM/CDP采样，**不是因果trace，不能把这几个数等同纯React render或paint时间**。`attention` phase还延续到主题切换/截图，不能只按phase名理解为决策显示处理。 同样最终reveal综合壁钟2495.09/2550.68/2519.73ms、attention刷新综合壁钟5166.04/5374.16/5383.48ms包含Playwright定位、等待、原轮询及采样开销，不拿来承诺中心响应延迟。

每场workspace请求259次；全部API请求265/280/283次（多task的预先index与chat检查不同）。详情每场始终1次：未展开0、首次1、缓存重开仍1；取消请求0、pageErrors=[]。1/2pane与至多8个保留chat的SSE预算是**负载前功能检查**。完整长feed阶段在overview，活跃chat SSE为0，测的是workspace HTTP连续分页与React列表，不是128个并发SSE或执行agent。

最终DOM随已显示记录增加约7万个元素是直接观察。JS heap样本57–68MiB受GC与已访问视图影响，不作为泄漏证明；UserAgentSpecificMemory不可用（非cross-origin isolated），renderCount与p95均null。没有特殊production profiling构建，也没有可测render次数的假零值。

## 独立驻留与体积

[Node公共projection检查](projection-retention.json)在第50批为entries5040/buffered0，第100批为entries5040/buffered5000；reveal后10040/0。它通过真实HTTP，但不含浏览器DOM/输入/GC，不是实际App heap对象数或用户延迟。

生产JS合计1,105,326B，Node gzip默认配置估算329,001B；CSS86,919B/gzip15,778B。当前HTML同时入口与modulepreload加载两大JS组，未声称首屏lazy。测试静态HTTP实际不压缩，gzip是可比文件指标，不等同本次网络传输量；不会因chunk超过500kB调整告警门槛。

## 下一轮唯一建议（候选暂缓，未认领/实施）

因用户改为优先真实持续对话，PERF02准备暂缓，尚无新tree/claim/生产写入。保留证据支持的候选：申请 **workspace activity有界DOM窗口渲染** 的小范围实验：在保留全部记录可访问性、已有HTTP历史/新记录缓冲/决策与详情语义的前提下，让同时挂载行数有界；先保留projection数据缓存，不把内容永久截断。证据是3个场景每次显示10k后都有约70k DOM元素和大批reveal附近longtasks；这足以选下一轮实验，不能证明完成优化或排除采样/其他工作造成的耗时。

拟生产范围由管理者与M02唯一owner协调后另领（当前PERF无生产写权）：workspace-feed渲染/专用验证；不改Thread、公共契约、不引状态库或盲目删官方组件。验收须同条件重新测，验证历史分页锚点、变高行、键盘焦点/查阅、reveal跟随与缓冲、引用按需0→1/缓存、双主题与窄屏；报告DOM上限与交互变化，并说明可访问性/浏览器find/屏读取舍。若数据仍无收益就保留失败，不扩大框架。

内存有界缓存和首屏分包是另两个待证据问题，本轮不同时实施，避免把CSS content-visibility当成对象驻留或DOM预算。

## 图与检查边界

[1task浅色](baseline-1-light.png)、[1task深色](baseline-1-dark.png)、[16task浅色](baseline-16-light.png)、[16task深色](baseline-16-dark.png)、[128task浅色](retry128-128-light.png)、[128task深色](retry128-128-dark.png)。owner已目视1task浅色与16task深色；本轮固定desktop，不冒充窄屏/屏读/Safari/Firefox新验收。

检查：最终target3d47 Web typecheck通过，2组局部fixture/projection有效性通过；生产smoke与三个完整负载有效（出处见上）。Root独立APPROVED target3d47与报告adc2595，读代码并重算raw、核build hash与浅深图；未独立重跑browser/typecheck，避免干扰。批准只覆盖benchmark。
