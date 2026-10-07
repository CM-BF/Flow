# 任务开工 / 完成 / 已历时：最小展示合同（只读提案）

固定 main/origin `943a66bfa5f71f4a5000ff2674ac1973e85e0353`，相关8源hash见sources.json。没有读取登记配置/凭据、没有真实聚合/Node/import/测试/HTTP/PG/Chrome/free/proc/安装/构建；没有项目写或领取。沿已装find-skills发现本地方法、codebase-design限定唯一status Interface、clean-code核来源/缺失/异常与最少职责。

## 现有能力与缺项

- `status.mjs:11–32,64–79` 已有 DPERF05 严格UTC解析：UTC/Z/+00:00、分数截毫秒、合法日历/24:00；隔离后段main同步，首主时间无效不改取另一个。`status-timestamps.test.mjs:23–130`已有格式/日期/不借main时间/未来时间交给aggregate政策的专测源码。它是**更新时间解析增强**，没有开工、完成或历时字段；旧检查不能当本提案目标通过。
- `aggregate.mjs:27–38,49–71`读取登记的唯一owner status，缺失退frozen并标未知；已有path/mode/stale/syncedAt/git来源。`87`已有整份快照generatedAt。status对象原样进结果，无须新源或新endpoint；mtime、syncedAt、claim时间、Git时间都不是开工/完成。
- `public/app.js:18,164–169`现详情只显示更新时间/文件修改/本次读取时间；timestamp用浏览器local locale，未明示时区。`58–71`共享compact卡、`124–133/213`既有20s快照刷新与失败保上次快照。没有任务计时器。
- `human.mjs:3–10,37–59`明确legacy completed只是分支作者进度，review/integration/delivered阶段也不能推用户全任务完成。当前规则模板只有最近更新以及分支/检查/main事实（template7,14–18），没有可靠start/end。

## 推荐：两个新增时间字段，阶段事实保持独立

由原Lead在唯一status模板/OPS规则先固定字段名和语义；建议顶层表格两行：`任务开工时间`、`任务完成时间`。值只取明确UTC时刻，原文保留；字段缺失/UNKNOWN/非法都显示“未记录/待核实”，不历史回填。完成指**本登记任务既定验收范围全部完成**，不能由分支完成、子任务完成、全部checkbox、review/main/部署其中一步代写。分支交付、独审、main接收、部署继续各自独立；若要它们的时间，只接受owner显式对应里程碑字段，不从一段说明串提取时间或拿现场核验时间当事件时间。首片不必增加这4个可选时间字段才能显示两项任务时间。

关键区别：完成字段缺失是“结束未知”，**不等于尚未完成**。为了合法显示进行中历时，建议在同完成字段允许一个明确负事实值 `NOT_COMPLETED`（owner声明截至最近状态尚未完成）；不读取“当前阻塞/工作分支状态”自然语言来补这个事实。若Lead已选等价的明确状态枚举，复用那个枚举，不再造第二状态。两种可计算区间：

1. start与completion均valid，且start<=completion<=snapshot.generatedAt：`已历时（含等待）=completion-start`。
2. start valid、completion明确NOT_COMPLETED、当前来源可信且时钟一致：`已历时（含等待，截至本次同步）=snapshot.generatedAt-start`。

start缺失、completion UNKNOWN、future/负区间、来源frozen/stale/missing或读取失败后的旧快照：显示时间声明本身并标来源/截至时点；不得展示仍在推进的“进行中”或用本机now延长。没有等待区间也可显示**含等待的日历历时**，绝不叫实际工时/CPU耗时。分支交付不会自行停止用户全任务历时。

Parser建议新增一个小 `timing` 结果（如 started/completed 的 {state,value,record}、issues），只派生不持久化；其他status/progress/review/main字段继续原样。复用现严格UTC日期内核，保旧parseUtcUpdate“截main后段”的兼容wrapper；新独立时间字段用整字段校验，不能照搬任意前缀搜日期使非法时间被后文合法时间救活。非法新可选字段独立标timing未知，不能清空其它已知事实或使旧任务因没有新字段变全局错误。 `aggregate.mjs:49,69–71`会把status.errors传播成current=false及TODO进度null，因此新字段缺失/单项坏时间只进timing.issues，不加入旧全局errors；旧status零迁移。独审/main/部署事件若另展示，必须随目标SHA/来源记录：旧目标日期可作历史，不能由“日期存在”把outdated review、未证main或未部署改成已完成。既有review/proof判定完全保留。

## UI与来源最小接线

- 在共用compact卡加一行紧凑历时/未知标记，在原详情facts加开工、完成、历时说明与原UTC原文。新时间显示明确UTC，`<time datetime>`保规范ISO；不悄把本机local时区当UTC。用现task.source.path/mode/git.head及status原文说明“owner声明”，不宣称独立审计事件。
- 计算仅用同一快照的generatedAt；现20s刷新时更新，不新增每卡setInterval、后端轮询或事件数据库。失败时保上次快照并标旧；后续如增加live tick也不能把旧数据变fresh。
- 暂不计算净工作时长。未来只有owner显式等待区间表(begin/end均UTC、来源/原因)才显示可核等待；未知开口/重叠/负值/超任务范围单独标异常，无完整区间覆盖不得从branch blocked/ACTIVE文字或claim touch间隔推等待/净工时。

## 最窄 literal 提案（NOT_TAKEN）

产品2条：`apps/execution-dashboard/src/status.mjs`（复用UTC内核+可选timing）、`apps/execution-dashboard/public/app.js`（同快照派生历时、紧凑卡/详情）。专测可复用 `apps/execution-dashboard/test/status-timestamps.test.mjs` 添加实际parser的两字段/隔离case；UI采用新单目的 `apps/execution-dashboard/test/task-timing.browser.mjs`，复用现fixture方法但仅自有样本/随机端口，不能默跑默认真实registry。own原计划/evidence由manager指定。无需改server/aggregate/human/registry/CSS或引入新store。若实施发现真实CSS或fixture seam缺项，先给精确原因再amend。

规则由Lead另占 `plans/templates/status.md` 与 `plans/AGENTS.md`（必要OPS计划同步）；worker不能批改历史owner status。DPERF04仍未main且持app等范围，server刚partial交权；本提案不借它的read-model/未验source，也不写当前4320入口修复。后续取权必须中央串行，未来DPERF04合入只透传同一个timing结果，不复制parser。

## 有界验收点（本段全NOT_RUN）

- 纯parser：UTC/Z/+00一致；缺字段与NOT_COMPLETED区别；完成只有结束无开始不算；非法日历/无时区/重复矛盾/未来/负区间分别未知；旧updated/main后段语义与其它字段仍在。固定explicit now样本，避免当天日期依赖。
- 自有browser：同snapshot时钟渲染进行中/完成；分支已交付且任务未完成不停止；所有stage不借用别的时间；frozen/stale/网络失败旧快照不继续增长；大天数/未知文案390px不溢出、详情键盘与阅读焦点保持。轻量纯计算不等所有这些UI实证。
- 不以旧DPERF05解析PASS或DPERF04旧Node结果声明新target通过；实际入口与预算在实现固定后再独立准入。
