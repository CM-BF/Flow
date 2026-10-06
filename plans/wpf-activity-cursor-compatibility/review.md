# WPF-ACTIVITYC01 Review

**状态：NOT_STARTED**

Review target commit：UNKNOWN

Base：86a36eaeffbf09f0a3772c3d1509c17dc0a76f92。实现范围 apps/web/src/conversation-activity/projection.ts、apps/web/test/conversation-activity.test.ts。工作树/分支见[status](status.md)。

只读任务：核实际HEAD/dirty与固定target，读两文件diff，运行显式 activity direct test。确认允许 raw scan 跨过过滤空/尾页，同时保留身份、entries递增、next/watermark/hasMore/after/reset、冲突/重复与生命周期护栏。核 fixture 来源明确为已通过HTTP断言的 contract fixture，不是rawcapture。发现交唯一owner修复，不写他人树。

当前已执行：来源/规则只读核验。尚未执行：实现测试、独立review、HTTP/DB/browser/model。Findings/独立结论：未执行，不表示通过。
