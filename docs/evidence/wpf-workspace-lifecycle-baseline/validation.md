# 验证与基线结果

目标 `1711e2b0933ec28b8bbd9af11cba4243b644e0d7`，基线 `c450c2da7e6185b88db9f46e0299ee504ee6f3e8`。作者 browser 实际读取 HEAD `313fdee5d3f40b7c7648b68460cf64bdc0a53098` 加两个未提交脚本修复；[原始报告](2026-10-06T11-02-23.650Z-report.json) 没有回填成目标 SHA。[checks](checks.json) 独立逐字节绑定两源到固定目标，并核 180 只读依赖均等于基线。

## 执行结果：partial

第二轮 `2026-10-06T11:02:23.650Z` 至 `11:02:57.972Z`，34,322 ms，cleanup 85 ms，所有 own close Promise fulfilled、cleanupErrors=[]，pageErrors=[]，fixture transportErrors=[]；8 检查完成、1 测试导航失败、exit1。不是 9/9 或全套通过。[修复轮日志](experiment-repaired.log) 原样保留。

第一轮 `11:00:27 UTC` 启动，日志最后写入 `11:00:59.444486Z`，约 32 秒后 delayed 已取消 HTTP request 被 fixture 再投递，async handler 拒绝未处理而终止；7 段仅日志通过，没有最终报告或完整 cleanup 审计。[首轮原日志](experiment.log) 保留。只读进程观察未见残留 Playwright Chrome main process，不冒称已测完整资源指标。首轮保守计 45 秒、第二轮配置 45 秒（35 秒动作 + 10 秒清理），累计保守 79,322 ms ≤90 秒；首轮不是机器精确 elapsed。代码修复/静态类型检查不算浏览器运行时。未启动第三轮。

原始证据计量 364,009 bytes，限额 8,388,608；后续 metadata/hash 清单另有小量增长，最终目录计量记录在 metadata 检查中。没有 trace/video/heap dump。

末尾失败原因有源码佐证：App 的 Chats action 同时 `setOverview(false)` 与 `setSidebar(!sidebar)`（基线 App.tsx:664），测试前侧栏已开；runner 随后直接以侧栏 Conversation 3 定位导致 3 秒 timeout。未取得最终浅深 screenshots/theme 草稿断言，未当产品回归；已完成的 DOM 采样不是截图验收。保留失败测试和原报告，不隐去该缺口。

## 可观察样本

8/16/32 是**仍保留打开的 conversation 数**，不是关闭后累计访问计数；另有 1 个初始 New chat draft pane。DOM 是 document elements，不是 JS object 或 heap。

| 样本 | 全文档 DOM | 已挂载 tabpanels / textareas | 可见 pane | fixture 活跃 task SSE |
| --- | ---: | ---: | ---: | ---: |
| 打开 8 | 1202 | 9 / 9 | 1 | 1 |
| 打开 16 | 1962 | 17 / 17 | 1 | 1 |
| 打开 32 | 3482 | 33 / 33 | 1 | 1 |
| 32 中 split 两个 | 3485 | 33 / 33 | 2 | 2 |
| 关闭 28/29/30 | 3200 | 30 / 30 | 2 | 2 |
| 重开 30 | 3295 | 31 / 31 | 2 | 2 |

隐藏 conversation 保留 DOM；关闭三个后 DOM 少 285、textarea 少 3。没有据此推算内存、泄漏速率或允许最大会话数。每个稳定观察窗实际 2201–2205 ms，隐藏/关闭 conversation 新请求 unexpected=[]；旧在途完成单独记 late。样本的活跃 SSE 数不是中心任务执行容量。

重开 30 看到当前 snapshot、queue 和 task SSE 请求；记录窗内没有重复 `/turns` history GET。这仅证明这次 UI/HTTP 观察，不能据此报缓存对象数或 heap 释放。关闭 1 后已启动 reply detail 仍在约 900 ms 后完成；重开全文可见且同 detail HTTP 总数从 1 保持 1。**closed DOM 不等于 late body/cache 被回收**，这正是下一回收设计的输入。

Protected：关闭/重开 3 保留精确新草稿和 1 条知识选择，未额外请求 knowledge resolve；Send 和 Queue 分别模拟已受理但响应丢失，关闭/重开后新草稿保留，点击 Retry 原 key/body 字节相同，未自动发 task cancel。这里仅同页面生命周期，不是 reload 持久化。

Delayed snapshot：chat-6 GET 在隐藏后关闭 socket，fixture 延迟到期标记 `cancelledBeforeHandling=true`；chat-7 保持可见，没有旧响应覆盖新 UI。该行为和 close 后 detail 继续返回是两个不同读取生命周期。

## Overview / page visibility

实际六个观察窗都单独记录 `/api/workspace`；五个聊天窗各 1 次，总览可见窗 1 次。总览可见时 per-pane requests 为 0。窗口不等于完整 2500 ms 周期，**不从此推 QPS**。`overview-hidden` 原始 label 意为聊天 panes 被 overview 隐藏，不是 overview 自己 hidden，更不是 `document.hidden`。浏览器 native page hidden 未测。

只读固定源码：App.tsx:801 始终挂 WorkspaceOverview；WorkspaceOverview.tsx:19 的 effect 无条件 start、active 仅控制 hidden/ActivityWindow；App pageVisible 没传入该组件。workspace-feed/projection.ts:51 默认 2500 ms，mergeEntries 对 entries/buffered 没驻留上限。overview 同时给 sidebar/task summaries，不能简单离开就 stop；stop/invalidate 会清 actions pending，观察暂停必须与命令结果分开。以上是源码事实，不是实际 heap/QPS。本片不修生产，下一最小建议见 [Interface](interface.md)。

## 类型与范围

- 固定目标两新入口及直接依赖 strict TypeScript 于11:06:23 UTC exit0（[精确命令与来源](checks.json)、[固定日志](types-fixed.log)）；前期定向检查亦 PASS（[types-final](types-final.log)、修复后 [types-repaired](types-repaired.log)）；空日志配命令 exit0，由作者观察。
- 全 Web tsc FAILED：未改的 web-release-compatibility.fixture.ts:127、134 两处 string|undefined；[原日志](types-first.log)。不以定向通过覆盖它。
- 第一次定向命令从 root 找 vite/client 失败为作者 cwd 调用错误，[日志](types-targeted.log)；随后 apps/web cwd 命令通过。
- target 范围只有两个新脚本；源 diffcheck0、只读依赖/生产根 manifest/lock 未变。root于11:07:36 UTC独立审查APPROVED限定partial基线，见下；不能把作者browser当root运行。

未测：native page hidden、JS cache/heap、延迟分位数、32 次逐个关闭后全量回收、late history-page 请求关闭、真实网络/中心/provider/DB、最终双主题 screenshots。后续若需补测须单独预算，不能改本报告的 partial。

## 独立审查归因

Root `2026-10-06 11:07:36 UTC` APPROVED固定1711有界partial基线，未新增blocking。独立严格Node24 tsc exit0；两源/180依赖hash、范围与diffcheck核验原样见 [root-audit](root-audit.json) 与 [root-strict-types](root-strict-types.log)。未重跑browser，cleanup/DOM/HTTP计数是作者报告复核。P3缺项与非机器精确的首轮预算说明保留。主线尚未接收。
