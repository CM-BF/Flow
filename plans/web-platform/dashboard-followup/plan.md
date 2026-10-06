# WPF-D01 Dashboard 协作需求与来源登记

更新：2026-10-06 04:50 UTC。唯一计划/status owner：d01_owner / gpt-6-astra ultra。父计划：[WPF-001](../plan.md)。固定文档基线 `d444608ab6c796c731e44e51a892868bf39bec2a`；本计划始终只做协作登记，没有第二个dashboard实现。

## 唯一实施边界

紧凑中性工作台和高层语义由主线D03实现；D04负责PostgreSQL分配账本与领取展示。4320服务由原Lead单写管理，我方不停止、重启、改代码或另派dashboard owner。用户U09架构tab已由主线D05部署，原canonical [D05](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture/plans/d05-architecture-view/plan.md)记录；D06已在独立树完成固定8f刷新（ef42277），实际main4e/4320部署已核，最终6ea2且claim v2 released。本计划保留后继快照提示/性能候选，未再领取实现。

我方负责提交用户需求与canonical status来源，核对领取/来源是否真实呈现。手填进度只在各唯一status，JSON/网页派生；assignment账本只记owner/lead/scope/claim/handoff，不复制TODO/check/review。分支实现、检查、独立审查和main集成分开，缺失/过时/失败标未知，不猜百分比或ETA。

## 已落实的来源方案

管理准备nested计划中的P01/M02/I01/PERF01/PERF02/CHAT均已受控转交独立平级canonical planDir，旧三件套改只读stub。因此没有为注册而放宽nested路径限制，也没有第二手填status。七源及路径见[集成清单](../../../docs/evidence/web-platform/integration-checklist.md)。root于03:12:04.035Z实核五源human字段完整、PERF claim匹配、unregisteredAssignments空。管理者03:17:14.324Z专项比对main8c57的17原ID与实际30源，全部保留，见[核验摘要](../../../docs/evidence/web-platform/dashboard-source-verification.json)。

D04领取详情已经root实际CUA验证ID/version/lead/worker/scope/branch/时间，M02v2移出三文件→I01v1取得的committed receipts也已实读存证。领取数不是agent数；零literal重叠不代表功能逻辑绝无重复。

## 新架构tab协作验收

父U09原话为“把产品Web UI打开留着可随时看，且工程dashboard增架构tab”，由原Goal Owner逐字转交。主线唯一owner按已建立[D05 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture/plans/d05-architecture-view/plan.md)实施该tab，后续提供实际可访问入口和检查/审查目标；本计划仅确认链接与需求覆盖，不自行定义第二架构事实源或代写其实现。收到交付后只读验入口与来源，若未实现保持pending。

## TODO

- [x] **WPF-D01-01** 将紧凑视觉/高层语义需求及管理来源清单交主线D03，确认唯一owner边界。
- [x] **WPF-D01-02** 只读确认17原来源保留，新增WPF来源正确且当前未知项诚实显示。
- [x] **WPF-D01-03** 完成子计划唯一来源方案：独立平级canonical注册、旧nested转stub，不放宽路径校验；记录实际入口与验收边界。
- [x] **WPF-D01-04** U09已关联主线D05；root已读取部署架构图固定3773，管理CUA确认架构入口可访问；来源陈旧由下一刷新工作处理。
- [x] **WPF-D01-05** 将新架构图刷新到固定main8f要求交主Lead，取得旧claim释放/正式转交、新独立tree与literal receipt后才派实施；保持App/chat与未交付功能边界。

## 未验证与来源

工程dashboard实现行为、双主题/窄屏/键盘、安全测试和发布review均由其主线owner负责；本协作检查不冒充重新运行那些测试。root部署后发现详情用户决定仍读旧章节导致NONE显示未知，已交原dashboard owner；我方不写app.js，不因此撤销领取功能验证。详情见[研究台账](../../../docs/evidence/web-platform/research.md)。

04:07:57实际42来源、当前21activewriterclaims literal0overlap，PERF02 b617 main集成记录正确；仅X03新claim待canonical注册。管理者独立CUA实际看见owner/lead/worktree/branch/16scope/state/version与来源，见[领取可见实证](../../../docs/evidence/web-platform/assignment-visibility-verification.json)。U12不新增第二账本；进度仍唯一owner status。

- [ ] **WPF-D01-06** D06新轮已从固定eb14991/独立新树正式take五scope，w01刷新源码结构并把短SHA/实际源码核验时间/固定快照提示放标题旁，继续同一baseline对象。旧8f已审记录保持历史，等待新target独审与唯一registry迁移后部署验收。

- [x] **WPF-D01-07** 已移交WPF-DPERF01独立领取与验证：5cd获审，临时样本Git启动29→24且跨snapshot/异target语义保留；不是线上提速承诺，main6b4已含并bb7efv2释放。

## 性能候选的历史依据（现已由DPERF独立完成）

root两次只读/api/snapshot工具elapsed约2.67/2.73秒、51源，属于端到端观察而非benchmark。源码aggregate.mjs对同task先compareImplementation(target)，review approved且target相同时再跑相同proof；proof.mjs每次spawn多条git。server已合并in-flight HTTP，无持续cache；可见页面20秒刷新。候选先做单次snapshot内部同key（worktree、target、HEAD、literal scopes）的Promise复用实验，不跨snapshot缓存dirty或claim、不降事实新鲜度。不同target必须分开；如果再考虑Git并发上限，先测进程/延时，不凭感觉限流。实验/实现须明确原owner停写与独立DPERF scope/receipt，不因本协作计划获得写权，不阻PROFILE/queue当前交付。

05:00 协作编号更新：WPF-D01-07的proof性能候选正式移交WPF-DPERF01，不能称主线D07（后者human筛选由其owner负责）。新bb7ef22fv1四scope已take，canonical初始化，实际实现/检查由独立owner记录；本协作项只跟踪，不写dashboard或另建第二进度源。

05:23 WPF-D01-06优先范围已由GoalOwner扩为同一次固定源码基线刷新与标题快照提示；只读proposal已回root，由其一次桥Lead定正式base/原源迁移。候选五literal无现active冲突仍须新take，不建平行architecture-data或重复权威图。旧D06继续保留历史8f审查与释放链，新片review必须绑定新固定base/target，运行实证单列。
