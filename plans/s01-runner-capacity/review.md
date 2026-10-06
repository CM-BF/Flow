# S01 独立审查

状态：APPROVED
Review target commit：2ab7967f2eb808fecd1205f7552a119eee8e0b36

当前：W2准备2ab与实际结果0dac均独立APPROVED；页首target绑定实现，结果范围见下节。W2已清理，待main接收。

历史准备target：9da9de1b6778afec5219e55f39b53b365c8cf900

批准范围：`experiments/runner-capacity` 的8任务协议超领门禁和16任务四进程测量入口，**仅运行准备**。运行必须有Goal Owner/Execution Lead协调的窗口；未批准容量结果、ACK故障或浏览器后继。生产基线115b0dbdfa02db5483f9e9699852682ce699633c，apps/packages零diff。唯一owner Mika / gpt-6-astra，worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-capacity-probe`，branch `codex/runner-capacity-probe`。

独立reviewer `/root/b01_bounded_reads` / gpt-6-astra，于2026-10-06T07:00:33Z只读核查；现场metadata8c5edbfae84d8ca1063cf52e46183a049a775f05 clean。15源码/配置与target/工作树逐项同hash，2raw日志同hash；6纯统计/预算unit tests通过、noEmit0。review者没有运行测试、数据库任务或服务。参见[固定准备证据](../../docs/evidence/s01/window-readiness-manifest.json)、[独审回执](../../docs/evidence/s01/window-independent-review.json)。

## 验收与修复

已核：128空会话完整分页/DB零turn；16任务预受理后四进程共同放行；96 runner events、80 timeline、96 workspace独立游标/内容对账；工具/adapter/人工等待独立计量；首次claim租期推导的时间区间及量化边界；四端点single-flight轻读、真实PG版本/连接分类；20秒工作+10秒清理；同scenario禁重跑、累计64 tasks/attempts及180秒含清理预算；旧run缺完成receipt时拒后继，formal必须先有成功gate。

c32d4d1 formal与6c5568a gate初审的两个P2：末次terminal后读取混入load；gate遗漏完整证据存储字节。9da修复已复核：立即break并保留四端点n=0/active与queue-only分类；完整DB+既有evidence+run-start/owned-process+最终JSON核算。PG版本P3也已补。无未解决P1/P2。

非阻断后继事项：ACK故障阶段若领取但尚未emit，不能仅用report-start计attempt；实施该后继前改claim-grant或保守reservation并测试未知ACK计数。当前两份已审smoke历史均完整计8tasks/8attempts/7154.493916ms，gate失败阻止formal，当前窗口最多累计32tasks，不受该后继事项影响。

## 历史已批准片段与证据边界

- 合同target a553f3f由Execution Lead/Goal Owner独立核对，要求single-flight及总时限含清理，允许首4任务功能smoke。
- bfe49a4首轮smoke整体FAILED：动态SQL引用不存在的attempt.created_at；4任务/24事件/清理局部通过不能抵消失败。[原始结果](../../docs/evidence/s01/smoke-first/result.json)保留。
- Goal Owner批准从可选declared-capacity4对照扣4，使该组16→12，允许一次额外4任务修复复核，总64不变。[分配记录](../../docs/evidence/s01/budget-reallocation.json)。
- 执行53c8713、review target65d7a57的smoke-repair于2026-10-06T06:42:10.555→06:42:13.377通过。独立worker于06:43:50Z APPROVED该功能片段：4任务/24事件/4工具，3进程exit0、DB及outbox清空，12source前后同hash；原失败不改写。见[smoke证据](../../docs/evidence/s01/smoke-manifest.json)及[历史独审](../../docs/evidence/s01/independent-review.json)。smoke8额度已用尽，入口已封闭。

所有上述批准均不表示main已集成或个人服务已刷新；纯unit检查、协议claim容量、真实fixture执行、实际provider能力分开陈述。上述准备审查当时尚未运行正式窗口；后续W1结果审查见下节，仍无模型容量或SLO结论。

## 可复制复审步骤

先核权威worktree/branch/head/dirty和原子claim，按find-skills本地优先方法复用clean-code/codebase-design。读取固定target9da的实验目录、window-readiness-manifest、status及原始logs；对照115b实际公开HTTP/schema与runtime，不依赖README想象字段。核先gate后formal、精确预算及同scenario不可重跑、初次lease时间来源、三个event游标空间、IPC时钟边界和finally自有资源回收。review只读，具体修复交唯一owner；不启动服务/负载，未取得协调窗口不得运行正式入口。新增源码或窗口结果需要新的限定审查，不沿用本准备批准。

## W1 独立结果审查

状态：APPROVED（限定W1结果）

结果target `9e10e0949f3f9977e21cf8aab63e56f5f9231157`；实现target9da、执行HEAD be923afab6d95ea21f493c63818dddbea380af7d；生产base115b。独立reviewer `/root/b01_bounded_reads` / gpt-6-astra 于2026-10-06T07:07:22Z只读复核，无P1/P2。owner后继9811仅TODO metadata；当前更新不修改源码或raw。

核验两raw及manifest哈希、gate10/formal16源码前后与固定commit一致；重算96唯一sender events及ACK、16终ACK先于runner closed、16工具摘要/初始claim及每runner4attempt；保守attempt并发下/上界4/4，IPC adapter/tool观察峰值4。复核nearest-rank、小样本/active分组、PG与center采样、窗口/预算/6进程exit0/两DB及outbox清理。没有新增测试、数据库、服务或负载。

DB/public行集清理后未留存，只认可固定程序完整断言通过，不能把重构数据当实测。poll50ms相对生产默认500ms、读端3–4样本且active2–4、正式3.648秒包含会话创建/启动/清理，均已明确；不得外推100执行agents、provider容量或SLO。

[结果报告](../../docs/evidence/s01/w1-results.md)、[冻结manifest](../../docs/evidence/s01/w1-result-manifest.json)、[独审回执](../../docs/evidence/s01/w1-independent-review.json)。原manifest的pending字段保持原始冻结状态，以独审回执更新结论。

可复制复审：固定9e结果commit，校验manifest SHA及两raw，核对before/after源码与执行be923/已审9da；按sender id/sequence/types/ACK逐项重算、以claim租期保守区间统计峰值、核每端点n与分组及清理/预算；只读，不重新运行负载。W1验收无需补对照；可选后继优先declared4/12task，待Goal Owner决定及窗口，ACK故障/浏览器仍开放。main接收另记。

## W2 准备独审任务

范围experiments/runner-capacity，固定target见页首；生产base115b，唯一权威worktree/claim沿用S01。入口与限制见[W2方法](../../docs/evidence/s01/w2-readiness.md)，源码/检查摘要见[W2 manifest](../../docs/evidence/s01/w2-readiness-manifest.json)。只审准备代码，不运行负载或认为已有窗口。

可复制步骤：核head/dirty与manifest哈希；对2784473审delta，核固定12/1/capacity4/128参数、DB真实注册capacity、per-runner上下峰值不预设串行且不超过声明容量；72runner/60timeline/72workspace及12工具/终ACK/清理契约随tasks推导。核领取未emit与unknown ACK按reservation保守扣额、observed/budgetCharged分开、两个历史smoke固定SHA兼容、missing result failclosed及同scenario禁重跑。读11纯unit/noEmit证据及5red原记录，原W1 raw/manifest不改；0新PG/task/服务。检查≤30秒含10秒清理/原64与180秒及64MiB预算，window仍待GO协调。severity与修复绑定新commit，不能沿用W1批准。

2026-10-06T07:26:06Z W2独立准备审查APPROVED：worker只读核25source/3raw与target/current一致、11unit/noEmit0、5 red保留、原raw/产品不变；固定参数/DB容量/peak不预设串行与保守预算门禁成立，无P1/P2。未运行测试/服务/PG。见[W2独审回执](../../docs/evidence/s01/w2-independent-review.json)。本结论仅准备，窗口与结果需另行记录。

## W2 独立结果审查

状态：APPROVED（限定W2结果）

结果target `0dac4b92747db5a3c8ed2dc25301e7cbecc2e8bf`，实现2ab、执行a626、生产base115b。独立reviewer `/root/b01_bounded_reads` / gpt-6-astra 于2026-10-06T07:40:32Z只读复核，现场同HEAD clean，无P1/P2。18运行source与2ab/a626/WT、5raw/support hash匹配；独立重算12claims/attempts、注册cap4、保守并发1/1及adapter/tool1、72唯一sender/ACK、12终ACK先于close和工具摘要、读分组与nearest-rank、累计44/38/20.925025秒及正常清理，均一致。未执行测试/服务/PG。

两个非阻断P3已补在报告：首PG样本1条空application_name连接保留unknown；terminal后、runner close前一次claim HTTP failure不等于72事件ACK失败。全部12dispatch具lastFalse→firstTrue区间。原raw/manifest不改，DB/public原行集未留限制明确，不计算12/16速度比或provider容量。

[结果独审回执](../../docs/evidence/s01/w2-result-independent-review.json)；[结果报告](../../docs/evidence/s01/w2-results.md)。可复制复审：固定0dac、比对manifest及5raw/support、18源码，重算sender/ACK/claim区间/分位数与清理，禁止重新运行负载。main事实另记。

## S01 mixed 准备独立review（2026-10-06 10:03 UTC）

状态 APPROVED，固定target `634926238f749fb1547a5973b521bc6dc5498574`，[manifest](../../docs/evidence/s01/mixed-preparation/manifest.json)绑定source/raw/readonly；原W1/W2 APPROVED不覆盖本片。base main4391，经scope=[] integration合入7511f559，writer status_read/gpt-6-astra，三目录scope。reviewer architecture_read只读核资源/预算/并发证据，Mika复核。范围新增mixed driver/合同、准备证据与父plan/status；没有产品改动或实际负载。

复制检查：先核codex/runner-capacity-probe真实HEAD/dirty，再核mixed-preparation/manifest.json所列target/source/raw。按1×16/4×4同child、32tasks不补跑、6秒+1500ms settlement、45+15秒与48+16MiB，以及DB权属/lease+adapter区间/ACK/心跳门禁审查。Pool装饰必须透传；PG行查询时间含执行往返，Lock采样遗漏不作零。cleanup未确认closed禁止DROP，creation unknown按唯一dbName核查，原证据冻结。默认不跑测试、DB、HTTP、runner或provider；回具体severity/行/触发，结论绑定target。

作者预审修复：cleanup共用58秒尾部不足→分阶段截止/并行children；CREATE提交丢ACK→发送前creationRequested+最后自有DB核查。14纯tests、strict0；实际接线/清理/容量未知。独立结论待回填，空段不作approval。

2026-10-06 10:05:50 UTC，architecture_read / gpt-6-astra独立只读APPROVED上述634 target，0 P1/P2；19source/16raw/16readonly、6runtime、78legacy全匹配。见[独审回执](../../docs/evidence/s01/mixed-preparation/independent-review.json)。Mika另独核hash与原始14/14/strict0。只批准准备实现，实际容量/取消/清理尚无实测；固定A→B顺序、共享进程/暖机/背景与IPC相位混杂，不作纯锁因果或SLO结论。未补跑。


## S01 mixed 唯一窗口结果独审（2026-10-06 10:15 UTC）

状态 pending；固定结果target由 `docs/evidence/s01/mixed-run/manifest.json` 绑定。实现634保持APPROVED，执行12154仅运行一次；本次runVerdict=FAIL不可被review批准改成PASS。独立reviewer architecture_read已领取只读复核；owner status_read/gpt-6-astra。

复制步骤：核manifest对应固定target/source/raw/CLI与当前WT字节；六份原始driver文件与raw-freeze完全一致；19 mixed source保持634=execution12154=WT，78legacy保持98098354。核16个live/fenced gate和adapter区间、每attempt心跳/533event digest/终ACK、4取消阶段、12成功与verification；确认末尾claim无确定响应、inFlight保留/assignments[]、不启动B/不补跑。核最终10.6731145秒与18,660,992B（归档增量另有保守上界）、两child正常退出、自有DB DROP及唯一retained journal。A-window统计只作分层观测，median/nearest-rank定义固定，B absent，无纯锁时长或容量SLO推断。

原14纯unit/strict0仅准备证据。只读saved raw/source，无新工程测试、HTTP、PG、runner或provider；具体问题交owner修报告，不允许重跑取好结果或清未知。结果批准仅证明如实失败交付可接收。

2026-10-06 10:15:58 UTC结果独审 **APPROVED**，target `6a5961a0d815113bba7cea149bc08ca07fdd128a`，reviewer architecture_read / gpt-6-astra，0 P1/P2证据问题。明确仅如实失败交付，runVerdict=FAIL不变；[独审回执](../../docs/evidence/s01/mixed-run/independent-review.json)。原source/raw/analysis冻结，不补跑、不清unknown；main接收另记。

## after-drain-v1 独立窗口准备

Review target commit: `51541b0cad73dcad32c7374dc87d631f0b9a8432`。本准备已于2026-10-06 10:45:57 UTC经Mika独审APPROVED；之前634准备与6a596如实FAIL结果批准不替代本次审查。范围为2旧源输入适配+2新identity/test，21 source/21 fixed-main readonly/8 new raw/9 support见[manifest](../../docs/evidence/s01/mixed-after-drain-preparation/manifest.json)。请只读核Git/WT/hash、固定base祖先、P03两源及client输入；确认identity只选固定目录与base，负载/观察/cleanup/proof未变。10新纯checks/strict0、初始0tests与1red保留，旧14不重跑。不得由review自行启动窗口；新windowId/execution HEAD仅由Mika最后指定。

2026-10-06 10:45:57 UTC：Mika / gpt-6-astra正式只读APPROVED准备51541b0cad73dcad32c7374dc87d631f0b9a8432，59项绑定一致，0P1/P2。随后只授权并执行一次mika-s01-after-drain-20261006-104557。准备批准不预断实际结果。

## after-drain-v1 真实结果独立审查

Review target commit: `339147cb015fdd40ed1cedbc66aca26e736b3ee7`。状态APPROVED，runVerdict=PASS；固定结果已于2026-10-06 10:53:39 UTC经Mika独审，见末段回执。实现51541b0c，实际execution5ea1b26f，productionBase0cee。57项manifest=21source/21readonly/8raw/7support。审查任务：只读核固定Git/WT/SHA/bytes、32真实身份及A/B各16重叠/各12成功4取消、1027事件id/seq/digest/fence/accepted、5journal清空、资源清理和含清理总预算；保留1次无类别/attemptID的heartbeat错误、略早timer标记与实际adapter区间区别、背景/观测/phase限制。核旧FAIL/raw/journal冻结。不要重审同一source设计、重跑检查/PG/HTTP/provider或追加窗口；如有发现精确定位原证据，修复不能覆盖raw。

2026-10-06 10:53:39 UTC：Mika / gpt-6-astra正式只读 **APPROVED** 结果 `339147cb015fdd40ed1cedbc66aca26e736b3ee7`，0P1/P2；57项与32真实身份、1027事件绑定、5journal、资源/预算、错误/计时/背景限制均复核。详见[回执](../../docs/evidence/s01/mixed-after-drain-run/independent-review.json)。这是本次固定零模型负载PASS证据验收，不是整体S01/FLOW-001或>100容量完成。architecture_read未重复审，未重跑任何检查/窗口。
