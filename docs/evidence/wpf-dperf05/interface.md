# WPF-DPERF05 Interface

`parseStatus(markdown, taskId)` 和公开输出不变。唯一新增 private `parseUtcUpdate(record)`：明确 UTC 的首个数值日期前缀 → canonical ISO 毫秒 UTC；格式、日期或时钟无效 → null，由原 errors 写“缺少可解析 UTC 更新时间”。无 I/O、缓存、日期库、公开新 DTO。

字段是混合文字，不是独立 ISO 值：保留说明/backticks，先选第一个数值加连字符的日期候选，再在该位置严格解析；不扫描下一条合法时间。保守地将此前类似数值日期前缀的坏记录视为未知，不能让后面的 main 同步时间冒充更新。结果后的字母/数字/下划线/点/冒号/斜杠/正负号拒绝，防止从坏 timezone 尾部截取合法前缀。

接受四位公历年、两位月日时分，空格或 T，秒可选，fraction 只随秒出现，zone 为 UTC/Z/+00:00。不推断本地时区、不接受任意非零偏移或 -00:00。fraction 显式截取前三位，不四舍五入；原 updatedRecord 按既有 plain 规则保留显示文本。先严格核公历日期，再允许 24:00 的零分秒且所有 fraction 都为零，规范成次日午夜。setUTCFullYear 避免 Date.UTC 的 0–99 年自动映射。toISOString 前核 finite。

其他字段、TODO、source/live/check/review/main、mtime 与 aggregate aging 全不改；此处只提供真正时间值，不能让过期记录伪 current。规则依据为 root 已读 ECMAScript 主源，见 approved-design.json。

## 检查边界

新 test 只 import Node 内建及 status.mjs。传递依赖 human/task-links/proof/git-snapshot 都是原基线；proof 导入 Git 执行工具，但 parseImplementation 与模块初始化不调用观察函数，不启动 Git/PG/HTTP。未来实际入口是 `node --test apps/execution-dashboard/test/status-timestamps.test.mjs`，只此文件，不使用 test/fixture.mjs 或 aggregate。当前未运行，56 是静态展开数量。

未来 gate proposal：15 秒总预算含至少 5 秒 cleanup、tmp 2MiB、raw 512KiB、network deny；未取得执行许可。Lead 集成时还须真实 aggregate 原异常/duplicate/stale/future 消费端与 fraction+offset 等价 age 检查；部署/TUI/COST/MATURE02 freshness 由 Lead/原 operator 提供，owner 不采 4320。
