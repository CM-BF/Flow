# WPF-DPERF05 — Status UTC 时间解析

创建与更新：2026-10-06 18:54:27 UTC；状态：completed。直接父 [D01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/execution-dashboard/plans/d01-execution-dashboard/plan.md)，co-lead Web /root。

## 目标与范围

让唯一 status 更新时间支持明确 UTC 的高精度时间，非法日期通过既有 errors 返回，不抛异常、不取后来 main 同步时间。仅修改 status.mjs 私有解析边界与新纯 parser test；保留 parseStatus 输出、原始更新时间显示、其他字段、aging/aggregate/schema/registry。

## Interface 与决定

私有函数输入 status 表格字段字符串，输出规范 UTC ISO 字符串或 null；接受分钟/秒 UTC、Z、分数秒与 +00:00。分数显式截到毫秒，日期/时钟严格核验；24:00 仅零分秒及零 fraction 时为次日午夜。先将明示 main 同步/main sync 后段排除，再取主段独立 year-prefix；首候选不合法即失败，不能跳到第二个时间；任务 ID 说明前缀不能被当作日期。原有 backticks/说明文字容器保留。

不引入日期框架或新公共接口。错误仍由 parseStatus 的既有 errors 承载。复用 find-skills、codebase-design、clean-code；记录见 [skills](../../docs/evidence/wpf-dperf05/skills.json)。本片无架构数据/生命周期变化。

## TODO

- [x] DPERF05-01 — 核领取/固定基线，建立唯一 canonical 与 Interface。
- [x] DPERF05-02 — 私有 UTC parser 与纯行为测试固定源码。
- [x] DPERF05-03 — 获明确运行准入后定向检查，保留原始结果。
- [x] DPERF05-04 — 独立 review、主线受控接收与停止写入。

## 验证与边界

已获单次pure gate并完成62/62检查，详情与限制见[validation](../../docs/evidence/wpf-dperf05/validation.md)。新专测只 Node 内建与 parser，不导入旧 PG/Git/HTTP fixture。本次纯检查15秒含至少5秒cleanup额度、tmp2MiB/raw512KiB；实际201.404ms/清理完整，未自动获第二次许可。真实 aggregate aging 与部署观察由 Lead 集成阶段执行；本片不复制其公式冒充消费端验证。

## 来源

固定 base `ec5da343880879154e2392f52eaa915d5b08aa77`，设计见 [approved-design](../../docs/evidence/wpf-dperf05/approved-design.json)；[根模块规则](../../AGENTS.md#modular-design)。

## 2026-10-06 20:05:22 UTC — main接收

固定main `aca6e89214711ef3787ac3e3ee3b2754bb40b960` 已接两源码，原62不重跑；[Lead/I02接收](../../docs/evidence/wpf-dperf05/main-close.json)含一次实际aggregate506ms和选定DPERF05的部署读取。全片限定parser完成，未扩大到全173来源或个人产品；本次metadata封存后四scope全部停写，等待manager释放。
