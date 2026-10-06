# 技能与 clean-code

2026-10-06 03:08 UTC：按 find-skills 本地优先发现并读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`vercel-react-best-practices/SKILL.md`（含 content-visibility / defer-reads 规则）、`webapp-testing/SKILL.md`、`clean-code/SKILL.md`。已有本地适用技能，不重新安装。clean-code 固定来源 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，保持已有基线；其他本地 skill 版本未通过新联网安装推算。

应用：生产性能先采样后建议；content-visibility 不当 DOM/heap 上限；Playwright 做真实页面动作/截图/异常收集，沿仓库 TypeScript 工具，不因 Python 示例改栈。clean-code 检查 fixture 只负责合成契约，probe 只负责运行/采样/报告；错误不隐藏，不以庞大测试框架替代两份有界脚本。

启动检查：固定 M02 基线与新 claim 4 个 literal scope 已核，无原有改动可覆盖。本段无生产优化，不把已批准方向再次送设计审批。每段完成/约30分钟安全停点/交付追加实际发现与修复。

03:11 UTC 方法边界（root 官方研究复核后先记录再实现）：Event Timing observer 显式 durationThreshold=16（默认104ms，duration以8ms量化）；inputDelay=processingStart-startTime 与到下次绘制的 duration 分列。wheel 连续事件不在 Event Timing 内，单独记录 wheel 分派至实际 scroll 变化与下一 rAF 的近似，不称 INP/物理呈现。LongTask >=50ms 且能力检测，无样本不写零延迟。普通 production Profiler 默认关闭，render count 标 unknown；不启特殊 profiling build 干扰当前基线。CDP JSHeapUsedSize 是未强制GC的浏览器样本，不能推算 retained objects 或泄漏。

来源：[W3C Long Tasks editor draft](https://w3c.github.io/longtasks/)、[W3C Event Timing](https://w3c.github.io/event-timing/)、[MDN Event Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming)、[React Profiler](https://react.dev/reference/react/Profiler)、[CDP Performance domain](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)。

安装：pnpm9.15.4 frozen install 返回 ERR_PNPM_OUTDATED_LOCKFILE（输入M02 Web manifest已有官方组件依赖而根lock尚旧）；按授权执行 no-frozen-lockfile，仅此树产生临时lock，无新增依赖/manifest改动，交付保存patch并恢复。

03:10–03:13 UTC（该段时段记录） 范围纠正：Goal Owner 指出本次4路径claim不含根lock，历史例外不能继承。已将本次安装差异保存至本范围 dependency-lock.patch 后恢复根lock，后续只用已安装依赖，不再改lock/manifest；生产范围如需变更须先amend。先前派发中的例外已由此新指令收紧。

03:13 UTC 最小样本发现与修复：首smoke实际wheel滚动已发生，但采样器在wheel handler取from（compositor可能更早滚动），误判无scroll变化并超时；失败JSON/截图保留 sampling-wheel-first-failure。修复为分派前读取offset，wheel后rAF观察实际offset差，指标改称wheel时间戳至首次rAF观察变化，不假称paint/INP。生产页面没有修改。另将128任务行为检查选择初始catalog可见的最后8个ID，避免fixture测试本身找未分页ID。typecheck发现readonly数组与新interactionId DOM类型缺口已以窄扩展修正。

03:13:46 UTC 再次smoke捕获采样器pageerror `__name is not defined`：tsx为浏览器序列化函数的局部具名函数插入helper，页面未提供。移除具名递归helper，保留原始serialization失败JSON。不是App异常，不把失败样本用于性能结论。

03:15 UTC 段末 clean-code：最小生产smoke通过（100/240新增，实际140/280行，48次真实keydown、16次wheel；2组局部HTTP/projection有效性、typecheck通过）。第三次smoke是定位器包含隐藏chat与可见attention的重复文本，改为限定真实Work overview region，原失败JSON保留。fixture新artifact内容与hash同步；128任务只从初始可见catalog选检查ID。将失败报告与context/server/temp清理改为嵌套finally，报告写入失败也释放服务。没有生产变化；采样不使用React内部/render计数，不报p95。下一步三个真实生产规模测量，以固定脚本SHA记录。

03:18 UTC 完整矩阵：1/16task均完成全部10000新增；128在负载前Task index分页循环遇到harness竞态（读取旧visible按钮后再click等待已disabled、随后移除的按钮），15s失败原样保留baseline-128.json与截图。修复等待每页实际card数增加再下一页；新增严格受控tasks子集与plain label供局部重跑，避免覆盖原证据。新target只改probe，生产build与工作负载不变；128重跑单独retry128前缀，不掩盖首矩阵失败。

03:20:41 UTC 交付前clean-code：代码仍固定3d47，无生产/根manifest/lock变更；1/16保留c40来源，128局部重跑生产assets/HTML字节与hash一致。所有成功场景96可信key/32实际wheel、10040行、pageErrors0；辅助fixture/projection报告来自最后3d47运行。表格明确中间采样/综合壁钟、阈值过滤EventTiming、未强制GC与Profiler不可用，未将数字当性能SLA。Root只读复算同值；保留128首harness失败及三类smoke诊断，未删断言或放宽固定超时。服务/浏览器/temp已finally清理，截图目视浅/深可读。结构复核保持fixture/probe两个职责文件，没有加状态库/插件/生产补丁。无未解决代码finding；正式review待报告回传。
