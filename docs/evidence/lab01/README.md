# LAB01 结果与边界

2026-10-06 UTC，本工作分支完成两个本地 vanilla toy。每策略 2 次预热、20 次有效测量，共 80 个正式样本；配对顺序交替，所有正确性检查通过，浏览器运行错误为 0。[原始数据](results.json)、[独立重算检查](checks.json)、[首次 smoke](smoke.json)、[复跑方法](../../../experiments/performance-probes/README.md)。首次 smoke 对应其 JSON 中的较早源码摘要，不参与正式分位数。

## A：按需详情减少了本数据集传输，展开多一次请求

固定 seed 41721，32 条时间线，各含 8 KiB 合成伪随机 ASCII 工具结果。两策略的全部正文与引用身份摘要相同，首条展开内容的 SHA-256 相同。固定只展开首条，不声称覆盖任意展开比例。

| 指标 | 完整 payload | 正文 + id/title，按需详情 |
| --- | ---: | ---: |
| timeline 未压缩正文 | 268,903 B | 4,071 B |
| timeline 实际 gzip 正文 | 199,819 B | 476 B |
| timeline 浏览器 transferSize | 200,119 B | 776 B |
| 展开首条后合计未压缩 / gzip 正文 | 268,903 / 199,819 B | 12,394 / 6,795 B |
| 展开后合计 transferSize | 200,119 B | 7,395 B |
| 含展开的请求数 | 1 | 2 |
| timeline JSON.parse p50 / p95 | 0.10 / 0.20 ms | 0.00 / 0.10 ms |
| 含展开的 JSON.parse 合计 p50 / p95 | 0.10 / 0.20 ms | 0.00 / 0.10 ms |
| timeline fetch 至正文就绪 p50 / p95 | 2.00 / 2.30 ms | 0.90 / 1.10 ms |
| 展开至 DOM 赋值 p50 / p95 | 0.00 / 0.00 ms | 0.70 / 1.00 ms |

字节值在所有有效样本相同。压缩比例只属于此合成数据集；gzip 在服务器启动时预计算，HTTP 样本不包含压缩 CPU。未压缩正文按 UTF-8 字节检查；实际压缩正文来自浏览器 `encodedBodySize`，`transferSize` 是浏览器正文加响应头计数，不是 TCP/TLS 抓包或全部网络开销。[Resource Timing 定义](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Resource_timing)、[encodedBodySize](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/encodedBodySize)。HTTP 使用 localhost、no-store；结果不包含远程 RTT。展开计时止于 DOM 文本赋值，摘要核验在计时后；它不是实际 paint。传输节约不等于 LLM token 节约。

## B：DOM 写入减少，总完成时间增加；此负载未暴露长任务瓶颈

同一确定性序列含 128 个模拟 agent × 64 步，共 8,192 个逻辑事件。两策略逐条消费全部逻辑事件，以唯一 ID、校验和、128 个最终状态与实际 DOM 文本检查一致性。批量策略每块最多 1,024 事件，块内合并同 agent 的显示写入，块间等待 rAF；不添加忙等或强制布局来制造收益。

| 指标（p50 / p95） | 逐条 DOM 更新 | 有界批量更新 |
| --- | ---: | ---: |
| MutationObserver 实际字符数据变更 | 8,192 / 8,192 | 1,024 / 1,024 |
| 处理至最终 DOM 赋值 completionMs | 1.40 / 2.20 ms | 116.80 / 118.00 ms |
| 排队控制动作代理 | 3.50 / 4.40 ms | 2.10 / 2.50 ms |
| 相交长任务数 / 长任务总时长 | 0 / 0 ms | 0 / 0 ms |

批量策略将 DOM 变更减少 87.5%，但 7 次帧等待明显增加完成时间。较小的控制排队代理差异不足以证明产品交互收益。计时前排入 `setTimeout(0)`，在浏览器内触发合成按钮事件，记录排队至处理器开始的时间；所有事件 `isTrusted=false`。它包含事件循环/计时器调度，不是自动化命令耗时、真实用户输入延迟或 Core Web Vitals INP。

本次 Chrome 的 Long Tasks API 支持已核验；使用 `entry.startTime + duration > start && entry.startTime < end` 按区间相交筛选，避免漏掉起点早于函数内计时的承载 task。两次末尾 rAF 用于观察器交付，位于 completionMs 之外，不作为实际绘制测量。未用额外负载验证该观察器对人工制造长任务的灵敏度，因此只报告本次未观测到相交长任务。[Long Tasks API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)。

## 环境、预算与视觉检查

- 实测为 **Apple M3 Max**、arm64、16 逻辑 CPU、64 GiB RAM、Darwin 25.6.0；不是 M1。Node 24.20.0、Playwright 1.63.0、本机 Chrome 154.0.8037.98 headless；未下载浏览器。共享机器采样前 load average 约 14.00 / 14.16 / 15.41，存在其他 Flow agents 与后台应用噪声，未做机器隔离、节流或统计显著性判断。
- 观测最小正时钟步长约 0.1 ms，零值表示低于本次分辨率，不表示零成本。分位数用最近秩：20 样本排序第 10 / 19 个为 p50 / p95；无 p99、SLO 或容量承诺。
- 正式 benchmark 墙钟 5.273 秒（含浏览器启动/ready/时钟校准，不含截图）；正式全部流程至清理前 5.665 秒。含首次 smoke，benchmark 合计 6.123 秒，流程合计 6.515 秒；最长样本 168.02 ms。0 模型调用、0 云计算。
- 两次执行 API 合计未压缩 6,482,225 B、gzip 4,758,917 B；静态页面、原始 JSON 和四张图片均小于 64 MiB 总额度。源码 SHA-256 已与正式原始 JSON 核对。服务器和浏览器都在 finally 关闭，没有遗留试验服务。
- [桌面浅色](desktop-light.png)、[桌面深色](desktop-dark.png)、[窄屏浅色](narrow-light.png)、[窄屏深色](narrow-dark.png) 均已实际查看；桌面 1365×1000、窄屏 390×844 viewport，全页截图可更高。两栏/堆叠、详情换行及滚动、完整 128 格状态均可见，无横向溢出；窄屏格子文字紧凑，适用于此 toy。截图中的末次值不是统计表。行为检查实际点击按需读取与展开，并检查内容可见；采样通过公开页面函数运行四策略。原生按钮/标签/状态区域/焦点样式有源码检查，未执行完整 a11y 审计或辅助技术测试。
- Playwright 专用浏览器缓存缺失的启动失败已发现，转用已存在 Chrome 后完成本次。额外 `@playwright/cli` 只查询候选版本 0.1.22，**未安装、未做 smoke**；不为可选工具延迟交付。[官方候选](https://github.com/microsoft/playwright-cli)。

## 技能应用与 clean-code 记录

2026-10-06 01:19–01:28 UTC，范围为本 toy 的服务器、页面、测量脚本和证据。按 find-skills 本地优先发现已有相关技能，未安装技能：

| 本地 `/Users/citrine/.agents/skills/` 路径 | 实际应用 | SKILL.md SHA-256 |
| --- | --- | --- |
| `find-skills/SKILL.md` | 本地发现足够，不新增依赖 | `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f` |
| `codebase-design/SKILL.md` | HTTP 数据、页面行为、编排三职责，小型公开 `window.lab` 测量接口 | `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2` |
| `clean-code/SKILL.md` | 命名标明测量终点，显式预算/正确性失败、finally 资源关闭，不引入通用框架 | `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317` |
| `frontend-design/SKILL.md` | 简明工作台、窄屏堆叠、浅深色、可见状态 | `d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3` |
| `webapp-testing/SKILL.md` | 先确认现有浏览器，公开 ready 信号、实际按钮操作与截图检视 | `51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2` |

clean-code 安装来源固定 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`；本地 frontmatter 另标注原始来源 ClawForge。其他技能未核实上游版本，以实际读取文件的摘要固定证据。已读取 webapp-testing helper 帮助；为动态端口与传输预算，使用本地 Node 启停编排。用户要求的 ready 信号替代技能泛例中的 networkidle；流式场景不能依赖网络空闲。

自查发现并修复：长任务改为区间相交；保留含帧等待的 completionMs；为全部 timeline 正文/身份补摘要配对检查；同时记录展开后总字节；使用互斥运行防止 UI 与测量重叠。首次 smoke 后上述测量代码已冻结，正式 88 个含预热样本通过；交付前重读 clean-code、检查代码和分位数/源码摘要。没有为数值更好看扩大负载。未解决项是明确研究边界：单浏览器、单共享机器、小型 vanilla DOM、固定单详情比例、无 React/产品/真实模型/跨机验证。独立 review 仍待执行。
