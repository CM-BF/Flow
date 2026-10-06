# REQ17 / CHAT06：最小 0 模型测量接缝（只读提案）

固定 main：d721cf28123b45dab5b4e531281b312956e1bc28。没有实施、import、运行或性能结果。采用本地 find-skills → assistant-ui 架构、React deferred-value、clean-code；版本/内容 hash 见 source-pins.json。Root 验收口径 /tmp/root-req17-chat06-measurement-acceptance.json 为共同输入，本报告只补实际复用及 owner 边界，不重开矩阵。

## 1. 复用真实路径，避免另写 renderer / stream

- `apps/web/test/conversation-stream-integration.fixture.ts:7–41,75` 已公开 installStreamFixture、seed、append、finish、setAuto(false)、read 记录与 close。可在后来获领的 Web 测量 fixture 使用这些入口，分别投入短段、长 fenced code、长 GFM table；每组 cadence 对照使用完全相同的最终 UTF-8 原文/hash。固定分块只变到达节奏，与改变分块数的试验分开命名。Node fixture 自身 append:20–31 也计算 prefix hash，应在计时前准备或单列，绝不混进浏览器 digest 成本。
- fixture:67–73 实际按 ≤8 patch/page 读取；`packages/interaction/src/stream/projection.ts:78–82,138–156` 最小250ms调度、每轮最多4页且每页才 publish。因此记录观察到的 page/arrival/apply/publish，不强迫一 patch 一 render。4096总数含 terminal；非法 UTF-8 切分或第4097 patch不能当有效压力样本。
- 真消费链是 `ConversationThread.tsx:84–97,195` → 官方 external-store runtime → `thread.aui.tsx:648–649` → 当前 MarkdownText；保留 stream host 身份/可见性与能力（host.ts:75–91），不直接把全文塞进另一个 react-markdown 页面。
- 旧 stream browser:12 固定 reducedMotion=reduce；其结果不能代表默认 smooth。新测量首先保默认 smooth/defer及 no-preference，若使用 reduced-motion须另列。旧 browser 顶层启动 fixture/Chrome，不可作为纯 helper import。旧 `performance-probe.ts` 同样顶层构建/启动，只取方法，不导入执行其 1/16/128 大矩阵。

## 2. 四类观测的精确接缝

| 观测 | 实际位置与最小观测口 | 明确不能替代的指标 |
| --- | --- | --- |
| digest调用/输入B | shared `stream/patches.ts:13–15` 实际 subtle.digest 的 BufferSource.byteLength；按调用点41–43(identity)、140(fingerprint)、154(full-prefix)分别记调用/字节/失败，其他调用标 unknown。完整性结果、异常、重复与 generation fence保持原样。 | 重放到141–144不会再到154；不能用 patch×最终长度、额外平行hash或全局未分类crypto总数冒 prefix实测。 |
| parser调用/输入B | 当前 `react-markdown@10.1.0/lib/index.js:175–178` 的实际 processor.parse(file)，输入来自286–300的file.value；进入即计数，异常/未commit尝试仍保留，parse与runSync时间可分开。 | assistant-ui `MarkdownText.tsx:200–209` preprocess发生于smooth后、defer前；remark transformer在parse后；二者及React render次数都不是实际parse入口。 |
| React commit | 测量 fixture 外层稳定 `<Profiler>` 包实际 ConversationThread/Thread 子树，onRender记录id/phase/actualDuration/commitTime；只数真实commit，嵌套按id/commitTime区分。 | old performance-probe.ts:71明确renderCount=null。需要独立固定 profiling-enabled构建；普通production无回调、development StrictMode额外工作均不可伪称普通生产commit。 |
| 键盘 | 复用 performance-probe.ts:39–55 的有界浏览器事件采集方法，目标换为真实 `thread.aui.tsx:473–481` 的 textarea “Message input”；可信按键不提交，核输入值和原draft保留。 | 旧测量目标是Find chats input。EventTiming processingStart-startTime才是队列延迟；>=16ms阈值/8ms舍入及缺样本单列。handler→值更新/下一rAF是更窄fallback，不是INP/真实paint；Playwright调用耗时不作指标。 |

最小独立 Web 实现边界：后来精确领取的测量 fixture/browser，仅使用上述真实 consumer 与现端口；一份有界汇总保存调用/字节总量，时间样本有上限与overflow标记，不记录每个完整prefix。真实 React commit 与输入事件可由fixture外包/页面初始化观测取得，不要求改 App、Recovery、QuickControls 或共享调度器。

精确 digest / parse 当前没有公开计数hook。可选最小测试构建插桩是**仅两处精确hash绑定的实际调用点转换**：在测试bundle保留原函数调用/参数/返回/throw，只观测真实BufferSource或file.value，不改磁盘依赖/AST/hash算法；实际命中模块与替换次数必须固定，不匹配则检查不开始。此为待源审的测试接缝，尚未实现或证明可用，不能把计数缺口填成0。UTF-8计数、计时和Profiler会增加开销，必须标instrumented artifact；没有未插桩校验时只报告该构建所观测值，不推出普通production延迟或优化收益。

共享owner边界：`apps/web/src/conversation-stream/patches.ts` 只是 shared re-export，不能复制一套Web hash。任何持久生产observer/性能改动，或 shared emitted-module 插桩的审查，需由原 `packages/interaction/src/stream/patches.ts` owner协调；不属于Web可单方改动范围。parser来自锁定第三方包，不可直接改共享 node_modules；若测试转换不能透明成立，先报精确hook缺口，由既有renderer owner裁决，而非换实现。`markdown-text.tsx:20–22,50–56` 当前只暴露components且已defer，不能把新全局counter塞成生产状态authority。

## 3. 完成/可达性与现有归属

保留 `conversation-stream/messages.ts:7–22` 的draft/canonical分派与精确身份，stream终态、canonical final、task终态、smooth显示追平分别记录；fixture finish:33–41明确final可先于task结束。实际输入保留、exact最终原文/hash、旧draft/unknown语义必须先成立，再解释计数。

`markdown-text.tsx:62–67` code copy需实核完整代码及换行，`thread.aui.tsx:705–715` message Copy需实核原文；`markdown-text.tsx:192–228` 保持原生table/th/td/tr与水平溢出。没有为了减少DOM而截掉raw或把table变普通div。默认按需正文读取仍应由旧stream browser:19–24等0→1/无预取断言约束；新测量不能靠预载全部final掩盖代价。

归原 REQ17 / CHAT06：`plans/chat06-assistant-stream/plan.md:15–16` CHAT06-06负责Web真实消费、CHAT06-07原文字特指DBprefix成本；本报告明确是客户端补充，不冒DB/runner修复已覆盖。生产优化继续落 `plans/wpf-perf01-web-performance/plan.md:21–23` WPF-PERF01-02及既有CHATUI01真实stream验收，具体owner/写scope由Lead/manager串行协调，不新建任务层。首轮只选一个有界对照pair，是否扩到另两种正文由实际证据与资源准入决定；本报告未授权运行。

clean-code只读结论：复用现有fixture深接口；计数、commit和输入延迟保持独立职责；不复制renderer/stream authority，不造调度器或无界prefix日志。未解决项仅实际插桩/构建兼容与所有运行指标，状态均NOT_RUN，不是优化APPROVED。
