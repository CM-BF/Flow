# 完整计划验收矩阵与滚动批次

当前汇总核验：2026-10-06 09:30 UTC，main/origin/main `3418fe682944145494463dca9e09f89c8b9c2295`。下方带日期观察保留历史，不能当个人runtime或当前发布事实。本矩阵是 [FLOW-001](plan.md) 的要求追溯附件，不另建一份替代计划；唯一汇总状态仍在 [status](status.md)。完成定义保持原文，下面未完成项没有因 M1 通过而删减。

| ID / 原始要求 | 任务/依赖 | 验收与所需证据 | 当前事实与缺口 |
| --- | --- | --- | --- |
| REQ-01 FLOW001§1/6/12 连续多任务工作流 | M02 | 同一连续入口至少10任务，跨任务可读解释/不同待决策/原地证据，无需逐task切换；新消息不打断阅读；记录切换、重复问题、人工时间 | M02 backend/CLI和WPF-M02 d47已集成；10任务真PG/HTTP4组、8chat双split及窄屏证据已审；确定性交互成立，跨任务语义解释质量/人工时间对照仍open；CHAT01/02/03+Web7cb已审并集成：持久conversation/typed正文/配置pin。2query真实session记忆与首轮Web正文通过；第二轮live UI未证实，保存响应零模型重放通过，报告cc73已获限定独立批准；U11执行选项主界面2e4与紧凑配置摘要55b已审集成；只允许真实配置能力，目录登记不等于provider在线；持久queue/pause/resume后台与旧新兼容reader已审集成，队列UI309ec0已独审并集成；独立新queue两query已真实验收：运行中暂停/入队、显式继续、同session精确回忆正文、专属浏览器退出后真实GET仍running并最终恢复正文；2/2已封存，证据b8e0fed，SDK保守费用和$0.012396；这次不宣称自动promotion真实调用验收；CHAT08多turn/条件final收口d4e与024默认关闭接线fe5已独审main9c；CHAT09显式配置/目录协议与runtime门禁已审main32c；CHAT10领域/薄client/可信启动已审main d7e1，实际steering provider与Web未启用；context选择UI/files/voice等仍open |
| REQ-02 §7/8 Project/Workspace、动态计划 | G01，接M02/C02 | 项目授权边界，版本化新增/拆分/依赖更改，禁止循环，取消传播与失效决策/旧结果拒绝；故障后保留因果记录 | G016394项目revision/节点version/依赖无环/CAS与历史持久化、CLI已集成；O01 a4首段及F01公共goal命令已集成，真实PG diamond证明输入/依赖版本失效；自然语言规划/自动调度/取消传播完整范围仍open |
| REQ-03 §7/12 未知副作用和恢复 | C02已集成 | 失联保留占用；实际结果核对、人工停止确认/副作用证据、不可变审计、显式新task retry；旧attempt不能复活；PG重启后审计仍在 | C02已独立审查并集成：停止/副作用审计、安全重跑依据、新task provenance、旧fence拒绝；operator断言不等于外部客观停止 |
| REQ-04 §5.3/12 A2A双向互操作 | P01 SDK已集成；P02首出站已集成 | 固定实际SDK/规范/对端，发现/auth/直接响应/长任务/补充输入/产物/取消；至少一侧官方SDK；重复、ACK丢失、重连/降级/大inline | 官方SDK1.3互操作和P02 f942 task-based持久意图/binding/重启Get/取消/产物验证已集成；失ID不重发。P03显式send/Get historyLength0已审集成，同task1024历史wire2,185,338→16,580B且状态/产物相同；真实外部agent语义/所有输入与预算路径仍未完整 |
| REQ-05 §5.3/12 MCP client | P01 | 固定规范、角色/transport/capability；tools/resources/prompts/elicitation权限进入业务决策；draft Tasks显式实验；runner持会话，Web关闭后继续 | 官方SDK tools/resources/prompts/elicitation互操作已审；与中心持久input-required决策/runner会话整合未完成。ACP/AGUI/MCP server依实际需要 |
| REQ-06 §4/12 FLOW002-T05/T07 真实工程任务与harness关键场景 | [ENG-001](../eng01-engineering-delivery/plan.md)唯一生产目标；E01只对照研究 | 明确工作区/权限/profile→合格native模型实际改源码→host监督不可改基线检查→固定diff/产物→独立接受；恢复/取消/未知/secret边界；公平对照另记版本与配置 | 现Claude只读与flow.text不足以工程交付。ENG-001已建立计划，优先在TUI首片/R05 Codex基础接通之后、COST之前；先0模型真实Git/PG纵向片，真实native需固定>=Sol来源和单独预算。只读O10、fixture和模型自报不算工程通过；E01原研究/失败保留，不另造生产计划 |
| REQ-07 FLOW002-T08 上游模块实际复用 | E01 | 固定Hermes/T3/Paseo模块/许可证/归属，提取真正采用代码及测试、记录差异；选择不适用项给证据 | E01固定Paseo7a30305原文模块实际在合成子进程probe运行，db2f2d0方法已审；UTF8/字节限额/脱敏缺口已证实限定场景，生产安全修复与采用仍open |
| REQ-08 §9 Context原文/版本引用 | X01/context，接G01 | 目标/约束/验收/预算+固定版本引用和增量；原文可追回，来源更新使摘要/下游证据失效；按需tool schema，大结果工具侧筛选 | O02 d819实际MCP桥接/固定原文版本引用/有界回复已审集成；仍先读完整中心snapshot，只减模型侧回复字节，不声称token/DB收益。CTX01固定acp-kernel0.0.101纯核合成会话压缩/原文hash/恢复实验已审集成；CTX02固定Pi0.85.1+插件0.1.83/实际kernel0.0.98宿主hook实验8abe已审集成；默认loader精确读取隔离拒绝，显式factory/toy窗口配置可回取原文，future sidecar只警告降写是采用阻断。K02固定引用/不可变上下文/私有执行副本已审main115b，K03目标节点固定引用与实际依赖链失效21d2、021共享44bd已独审main07b；独立C不误伤、历史原文保留、私有claim/C02恢复均有真实PG证据；通用压缩owner与跨harness历史编辑仍未完成 |
| REQ-09 §9 成本与预算账本 | [COST-001](../cost01-execution-cost/plan.md)唯一大task；复用usage_samples | 来源/计数范围/cache子集/辅助调用、baseline重置与resume/fork、稳定去重和明确阶段归因；中心预算与未知在途；按验收通过交付比较 | 已有累计usage去重与unknown，cache原始字段未完整归一读出；SDK估价不是订阅账单，input/cache不盲加，缺测不造零。COST已排队在执行工具/终端首片/工程通路之后，不新增模型验证字段；OTel仅出口 |
| REQ-10 §9 KB hybrid检索 | K01，接项目权限/context | 来源导入/版本/权限/位置，FTS+vector，中文/代码标识符/精确事实/权限过滤各自质量集与引用准确性 | K01 ea0c领域与F01公共client/CLI/015生产挂载已独审并集成；12个固定词法样本FTS4/12、literal+FTS12/12仅限定质量集。K02a6版本化引用进入conversation/queue及生产018/Web兼容763已独审并main115b；公有prompt保持用户原文，执行输入下层隔离；Web独立知识选择模块736ef与CONTEXT02回执保护5e821已审main，实际Send/Queue接线仍待后继；K03目标节点引用/实际下游失效与owner懒读已审main07b；0embedding/model，不将simple FTS/literal称hybrid完成 |
| REQ-11 §10 npm插件生命周期 | X01 | 版本/配置/能力/作用域，install/enable/disable/upgrade/remove；可信服务端与隔离第三方边界；真实工具/renderer/verifier示例 | X01完整计划c217已文档批准并集成（plans/x01-plugin-management）；X02 registry/008+公共client/CLI已审集成；X03只读登记与浏览器host分离视图已审集成，Web App只读管理挂载84ac已独审集成；X04 fa2固定版本压缩包下载/完整性/原子落盘模块已审main115b（pacote/ssri受控依赖），无解包/执行/启用；X05持久下载operation/精确版本关系9ebb与可选生产入口3691已独审mainba908；TX外下载/审计/重启显式核对、compressed artifact校验，默认未配置host不启用，npm完整安装/加载/生命周期/隔离仍未完成 |
| REQ-12 §10 插件可替换/通用UI | X01+M02 | 客户端只触发公共命令，CLI等价；未知类型id/title+通用详情；唯一compression owner；明确状态迁移/恢复能力 | trusted Web host6ce3独立已审，WPF-I01 92a主App挂载已审并集成；不替代完整npm生命周期/隔离/CLI；不建设无需求插件市场 |
| REQ-13 §10 上下文插件兼容 | X01+E01 | 确认实际billion-context候选/固定版本，压缩→暂停/恢复/分叉、原文引用、附属存储与跨worker边界 | 已定位billion-context-pi0.1.83及代理候选，未假称用户亲自确认；CTX01固定kernel纯核0模型结果已审，CTX02真实宿主factory零模型实验已审集成；默认入口读取拒绝及未知sidecar降写明确阻断直接采用，不能以同进程重开替代native历史编辑/跨机恢复。完整插件/语义压缩未验；名称不代表原生十亿窗口 |
| REQ-14 §8/12 多runner路由与所有权 | S01前的R03 | 独立runner能力/身份/预算路由，远端凭据归属，互斥session、失联/迟到、停机；真实一任务等决策另一任务可完成 | M1验证两runner争一task及uncertain，不等于完整能力路由；R03 9c597保守租期/失败清理已审并集成，±5分钟/晚回包/中心字段已验证；CHAT03声明能力目录/不可变profile digest与claim执行核验已审集成，登记不等于provider在线；S01P01内核默认1、显式有界pool已审集成；CLI与个人runner仍默认1，真实provider并发未验 |
| REQ-15 §8.1/8.2 分层读取 | B01，接M02 | 同时按条数/块数/字节有界；超长正文/引用分页；详情范围/批量读取；权限校验；原文不静默摘要 | B01按task事务锁推进投影前缀已审集成，长历史空读不再全历史anti-join；详情整项读取、events字节/块数边界未完整，B02已审测量50turn为252 SELECT，128KiB正文×50时应用收到约6.66MB解码JSON（非PG wire）；B03已审集成窄preview reader，长50turn解码JSON6,655,040→555,990B，HTTP454,512B相同；DB全hash/252SELECT保留，不宣称尾延迟收益；CHAT05活动详情当前只保留≤64KiB前缀、full digest与truncated，余文不可追回，不能把此片当REQ15完整原文交付；CHAT06正文增量5ff领域与C02旧timeline兼容77、F01薄client88/022生产da7分别独审；已含原module测试适配与Web raw-cursor reader889，成套main fa9；Web逐段消费模块3ac已审main6426，实际App9dafff已独审/main32c，原R1假分支关闭；provider与个人服务新版本未验。250ms/8KiB flush、UTF8 offsets、patch分页与显式展示settlement；逻辑wire测量不证明DB性能，CHAT06P01真实84patch测量已审mainbbe，64patch旧prefix返回累计1,032,192B；CHAT06P02在PG同TX算完整SHA仅返回digest的最小片b009已审main，仍保留PG全聚合，不宣称整体速度提升 |
| REQ-16 §8.2 缓存/快照与事件 | B01/M02 | workspace+权限+内容版本缓存，切换不清空全部，快照/订阅race与旧cursor无漏/去重；源事务乱序提交真实PG验证 | M02已验证晚提交水位与201task跨batch受理因果，Web保留隐藏view恢复cursor且限制活跃SSE；分层版本缓存/字节预算仍open，不以source bigserial为提交水位 |
| REQ-17 §8.3 交互性能 | B01+S01 | 缓存交互p95<=50ms、查询<=100ms、持久受理<=200ms作为待测初步目标；p95/p99样本量、字节、网络、数据规模/缓存并发分开报告 | LAB01/02有界toy/诊断，B01产品PG/HTTP n50四组前后对照和PERF02三规模10,040条UI窗口证据已审集成；均不替代p99/SLO或真实agent容量，原性能目标仍open |
| REQ-18 §8/12 超100持久会话 | S01，依赖G01/预算/恢复 | 128持久session，分别调节model/tool/DB并发；成功率/资源/连接/写量/延迟/故障；真模型负载独立预算 | 128observer/合成DOM不是agents容量；S01四任务功能smoke首轮尾部统计SQL失败、修复后四任务通过，smoke累计8；正式入口与首个W1结果独审通过并main30b97：128空Flow conversation背景+四fixture runner/16task，实测attempt峰值4；另gate8tasks仅2attempts。累计32tasks/26attempts含原8smoke，0模型；极小样本非容量SLO/128真实agents，W2单进程声明capacity4/12task12attempt实测峰值1已审main6426；累计44task38attempt。S01P01有界并发池d655+ES2023增量48b已审main d7e1，默认1、显式1..16，未知claim跨重启停新受理；CLI选项尚未接入；完整验收未完成 |
| REQ-19 §12/13 自托管部署和故障 | S01 | 一中心本机/远端runner部署文档、持久存储/权限/重启恢复/故障演练；浏览器/中心/runner断连承诺分开 | M1浏览器退出、queued中心重启已有证据；R04 bounded HTTP drain/主进程20s unknown退出已审集成；SVC01独立启动器已审集成并0消息启动61227/61228，用户需首次认证后主动发消息；SVC02 durable drain/maintenance/bootstrap已独审集成并完成一次真实受控升级和恢复接受，最近SVC03受控更新center/runner实际加载b1c2e398、维护v12 accepting，原DB/runner身份/端口保留；固定Web artifact461a973源b1c，用户tab未reload、0operator模型调用。旧Vite随main变化为已替换历史边界；active跨机恢复未完整 |
| REQ-20 §11 验证和证据链 | M02/G01/X01/S01 | 要求→产物版本→独立验证→合并版本可追溯；知识结论来源范围；不同任务可选verifier | M1 flow.text非空/contains已有；工程/知识/扩展验证未完整 |
| REQ-21 工程协作dashboard用户要求 | D03/D04已集成部署 | 结构化human摘要；首屏当前阶段/2–3项工作/下一交付/真正决策，历史折叠；细节可追溯；review实现target与metadata、main祖先关系分离 | D03中性紧凑视图、D04PG原子claim/self-service已独审部署；4320 07:57:46实际90源，新增逐段正文模块已登记；CHAT06/C02组合review锚点已按独立审查与main receipt修正，旧scope已释放；D07显式片段阶段与DPERF单快照核验复用已独审部署，新增claim未登记仍可见；D05架构tab与D06固定115b快照已上线，标题明确源码SHA/核验日期，独立标注常驻runtime版本，历史快照不当最新架构全量证明 |
| REQ-22 §1/5/7/11 自然语言目标到交付 | O01，接G01/M02/E01 | 目标→后台生成/修订版本化子任务与依赖→不同agents产出→独立验证循环→统一解释/用户决策→固定产物交付；复用harness，计划变更仅受限中心commands | O01 a4持久受限命令/真实PG diamond/独立进程失效证据已审集成；O02 d819真实MCP桥接已审集成但无query。O03中心授权与公共client/生产挂载已审集成；O04固定1420dfa+012升级测试a169已独审集成（102+1不同检查）；O05 owner持久graph proposal/apply领域1f211与F01生产挂载208a已独审集成；O06受限graph grant/审计/同TX重放及017/shared接线已独审集成；O07原生graph工具c224与生产018/019依赖已独审main115b闭合，保持注入query/实际MCP边界，不把owner提案等同模型拆图；O08零query真实MCP/PG验收driver与自有进程组清理已独审；原零扩展门槛与实际managed3+3冲突已明确；新已知声明资源基线候选7403获准备独审。GO独立接收O08真实单query固定75ff：原生两图工具持久化3节点/2依赖、同attempt提案与应用、最终解释明确未执行子任务；原driver字面正则误拒导致exit1/FAIL永久保留，GO逐项只读补验实际语义APPROVED，1/1预算封存/SDK估算$.0318802含辅助Haiku；known managed 3plugins/3skills不是隔离沙箱，host read allow不单独证明read执行；无重试，不将后台图成功等于child交付。完整自动拆图→执行→验收仍open，手动10任务不替代最终编排 |

## 早期研究/实验输入（保留当时范围；当前结果以上表为准）

- E01先0模型合成credential store probe：固定本地 wrapper 1.0.143 的subscription resolver文件优先于Keychain、refresh可能写回来源；检查调用链锁，临时假凭据/fake fetch测优先级/过期/并发轮换/持久化，绝不用健康检查名义刷新借用真实登录。新真实调用提交明确场景/数量/总预算给Goal Owner审定，不扩大封存R02额度，也不永久禁止全项目合法低成本实验。
- X01候选已定位并分别固定npm版本/完整性；proxy/native形态、Pi包及bundled kernel不能混作同版。CTX01/02是获授权的有界实验，不以安装成功替代恢复/原文引用验证，也不把候选定位说成用户亲自确认。
- K01先授权子集exact vector检索基线；[pgvector官方filtering](https://github.com/pgvector/pgvector#filtering)说明ANN可能因扫描后过滤不足k，先对照召回再决定ANN。

## 当前滚动调度

本任务cap4（Root + Lead + CHAT08 runner_owner + SVC02更新准备 assignment_review），外部Web最多4，Mika最多2，合计10。任务claim实际原子领取、唯一status、worktree隔离；三队回程限制见OPS-001-06，不把subagent说成可直投用户task。

main115b0db已含CHAT持久会话/typed正文/配置pin/队列后台及UI、O01～O06相应限定片段、K01版本原文与词法检索、X02登记与X03只读App挂载、R04/P03/B01/B03、CTX01/02、SVC02维护。实际center/runner固定fb906cb/v3接受；Web与后台各自版本须记录，不以同SHA作为前后端分离部署门槛。原R02 5/5与CHAT 2/2预算封存，第二轮旧live UI限制保留；新QUEUE两query已真实验收并封存2/2，实际同session正文、运行中排队与浏览器关闭后后台继续成立；保持显式Continue和归一化SDK成本边界，不追改旧日志。

当前ready主线：CHAT06/022/C02及Web兼容已mainfa9；聊天工具活动主界面ba341已main253b。个人常驻中心/runner仍固定fb906；SVC02唯一owner准备新受控更新窗口，0query、不先停服务，不等CHAT08或性能实验。Web逐段正文模块继续独立实施；CHAT08同query多turn与条件final协议0provider实施、cap仍false。S01后继计时窗口及CHAT06prefix成本测量由Mika协调，不抢用户聊天发布。O08原生固定合成图验收已获GO限定接收且预算封存；真正子任务交付/工程harness/插件完整生命周期仍open。

**持续执行**：完成→核查实际证据/验收→集成→下一ready项。阻塞→记录原因/owner/解除条件/绕行与其他独立工作。暂时无ready实现→有界研究或低成本实验，用证据改计划，不增加无意义复杂度，不降低原验收。所有feature仍各自独立worktree/status/review；此矩阵不替代owner状态。

## 早期证据输入补充（历史研究建议；已执行部分以上表与owner证据为准）

- G01：项目revision提交边界内验证无环；真实双事务 A→B/B→A 不能分别验证后合成环。项目范围CAS/锁或可串行化重试由owner选择，不能加全局图锁。先小合同/CLI片段解除O01，不把十个手工任务当自然语言编排。
- E01：Paseo固定7a30305的jsonl-rpc-process/decoder是候选，先测UTF8跨chunk、超长无newline、退出pending和bounded/redacted stderr；T3固定cfa4f76的ClaudeHome与continuation可小型复用，不引整套Effect。保留路径/许可/改动，当前只是源码风险。
- Context：[Claude缓存与tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching)中每轮换tools与deferred discovery不同；先0模型登记各adapter工具发现/原文引用/cacheusage能力，对比稳定小工具面与动态工具集的请求，再按批准小预算测总验收成本。大结果先程序筛选和版本化原文引用，复用harness，不为[Code Execution方向](https://www.anthropic.com/engineering/code-execution-with-mcp)另造通用执行器。
- X01：候选billion-context的[SESSION-IDENTITY](https://raw.githubusercontent.com/ranxianglei/billion-context/master/SESSION-IDENTITY.md)与PLUGIN.md提示匿名历史匹配曾误合并。项目身份仍待确认，实验前固定SHA；测试授权Flow会话ID、resume/fork lineage、同prompt隔离、附属store迁移、compact后原文可用性；同ID不证明跨机恢复。admin保持runner loopback，未知major fail closed。
- K01：先0模型中文连续句/两字词、camelCase/下划线、路径版本数字、同名跨项目/旧版本的带source+locator词法小集。记录PG16 locale/实际tokens，对比simple FTS/exact/pg_trgm；[PG parser](https://www.postgresql.org/docs/16/textsearch-parsers.html)、[pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)不保证两字中文又快又准，缺trigram可能全扫。PGroonga仅候选，真实语义质量不以手造向量代替。
- R03/S01：Lead接收WPF BR-01-A/B/C/D执行位置、受限版本化只读文件、真实process日志、独立PTY。各片段独立交付，M02投影不承诺filesystem。lease使用跨机墙钟相减存在偏差风险，设计剩余租期/请求起点单调基准，0模型测±5分钟、延迟/过期响应，中心fence权威。当前answer20ms唤醒与replayPending全历史目录扫描仅源码风险；内部控制唤醒/待发送索引先量化，不引broker/新DB。
- B01：workspace GET投影anti-join全历史先测长历史p95/扫描量再优化；已验证晚提交与201task受理因果顺序不等于性能通过。

原计划完成后仍按性能、美观、有用功能的明确收益滚动，不为持续目标扩展无根据复杂度。R02 5/5真实模型预算封存；后续E01另交场景、调用数、总预算给Goal Owner审定。

## 2026-10-06 03:17 UTC 新研究输入与实际证据区分

- E01 auth8e232a0及Paseodb2f2d0的固定原文/合成运行/保存结果已由Goal Owner独立只读APPROVED；批准方法和限定观察，不批准上游生产可靠性。auth实际负结果与Paseo UTF8/2MiB暂存/stderr marker见各owner证据，未接触真实凭据或模型。
- O01复用原生Claude SDK `tool`/`createSdkMcpServer` 挂受限中心commands，不另写agent loop；固定本机0.3.290实际声明已核。allowedTools自动许可不等于工具移除，tools:[]及MCP另管；resume工具身份、error与原文引用需用固定版核验。[官方custom-tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)。Pi官方SDK迁至earendil-works/pi，实验仍固定原版本，不能静默升级。
- O01 execution只绑定实际goal/constraints/acceptance及依赖产物版本；全项目revision仅出处。diamond fixture：改B只拒旧B、C仍可接受；换共同A则B/C重新核对，旧证据保留，不自动重跑或宣称取消撤销外部副作用。普通解释在有意义的目标/决策/产物变更时版本化保存，网页刷新仅读。
- [长任务harness研究](https://www.anthropic.com/engineering/harness-design-long-running-apps)支持按实际任务需要委派，不预置每步planner/reviewer硬流程；原生单agent/按需委派/固定委派同验收比较总token、时间、重试。此为实验输入，不是Flow收益。
- [Anthropic多agent研究](https://www.anthropic.com/engineering/multi-agent-research-system)产物直接持久化、协调者轻引用可作设计依据；全文转发vs有界信封按验收总input/output/cache/检索/summary/重试/验证与成功率比较。15倍数字仅其多agent对普通chat，不是A2A通信成本/Flow预测。
- [SDK prompt规则](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)：固定0.3.290实际有preset.excludeDynamicSections/maxBudgetUsd/systemPromptSnapshot。公平比较对齐prompt preset/settingSources/tools/model；SDK minimal不等CLI。snapshot resume默认沿用至compaction，新约束须显式版本化受理/消息。usage主loop与modelUsage整query、resume继承/clear重置须记录；maxBudgetUsd仅本query不能当项目总硬预算。新实验先总体调用/花费/时限上限，不复用封存R02额度。

## 2026-10-06 03:38 UTC 用户真实对话缺口

产品Web49922是明确HTTP fixture，发送hi的固定执行文案不是模型回复；工程dashboard4320与它用途不同。原REQ-01/22及外部唯一web-platform U11逐项追溯model/effort/access/context/files/voice/send/bubbles/queue/steering/tool与可展示thinking，未支持项显式禁用/说明而非伪造生效。CHAT01稳定conversation可按turn绑定独立task/native resume；conversation.revision是命令CAS，不是异步正文缓存水位。CHAT02只typed final首段、不混入hidden reasoning；live streaming/queue/steer仍后继。真正两轮聊天与O01自然语言goal规划是不同验收，都保持未验证。

## 2026-10-06 04:30 UTC 剩余接缝与成本边界

- CHAT04已取独立claim、011，首合同e423；模块stub和首红例不算业务通过。所有queued input先中心持久受理，取消/promotion同conversation锁，failed/cancelled/uncertain冻结并显示原因；新增持久pause与同锁显式resume，暂停先ACK再task取消，不保证撤销已运行操作；不让queue冒充active steering。
- O03 012授予只允许实际task/attempt/fence与固定goal/node/commands；撤销/过期/取消在replay也同事务核验，明确锁序。现readonly profile不能宣称goal写工具；SDK子进程环境须过滤Flow服务凭据。首段不含自动创建graph，不另造agent loop。
- CHAT live请求plugins=[]/skills=[]，实际init仍报告各3项扩展；effective tools=[]、thinking unknown。保留配置差异，不称干净上下文或工程harness公平对照。R02 5/5与CHAT 2/2均封存；新的模型用途须独立小预算。
- U11后继按已配置runner声明/固定SDK0.3.290可观测模型/effort能力构建，alias不当resolved model；supportedModels/startup候选未测时明确unknown，不偷偷预热或发新query。

## 2026-10-06 04:35 UTC E02原生Codex候选（研究准备）

本机codex-cli0.154.0可作原生app-server适配候选，官方 [app-server](https://learn.chatgpt.com/docs/app-server) / [产品嵌入说明](https://developers.openai.com/blog/codex-as-a-platform) 描述持久thread/turn、delta、审批、steer(expectedTurnId)、interrupt及model/list。先核本机固定schema和公开RPC的0query兼容性，官网示例不替代固定版本。model catalog不是账户可用证明；[SIWC](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) 的新OAuth机制不等于授权借用token文件。当前只读help/schema准备，不读凭据、不auth/模型调用，不替换Claude/Pi；真实工程预算与写模型门槛另审。

## 2026-10-06 05:01 UTC 追加研究边界

- 固定本机Codex0.154.0的help/schema只读归档已完成，未启动auth或query。官方[app-server](https://learn.chatgpt.com/docs/app-server)的dynamicTools/调用回复仍experimental且需capability；resume会恢复工具声明，grant必须每次调用核验。Flow runner保有原生连接，Web卸载不等于thread/unsubscribe。thread/shellCommand与process/*可能在Codex sandbox外，command/exec另有约束；steer(expectedTurnId)不接受turn配置覆盖，不能混作queue。最新文档不是固定本机能力证明。
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) 与 [context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing)：tools→system→messages前缀，动态改工具schema/早期消息可能失缓存或native签名。通用纯核压缩成功不能证明Claude/Codex opaque resume可透明改历史；Pi hook单独验证。总成本包含cache写读、摘要、检索、重试与质量，目前CTX01只证明合成bytes/CPU/RSS/hash，不声称省token/账单或100真实agents。
- 用户摘要写获得的能力/实际阻塞，技术SHA/测试命令留详细证据。完成片段与尚未领取后继区分；历史已交付项不因开放TODO重新伪装当前交付。D07与DPERF分别按独立claim实施，不为这次metadata运行产品测试。

## 2026-10-06 06:00 UTC 已排后继研究（非新增交付）

- X04拟复用固定pacote21.5.1：精确registry name/version+SRI、ignoreScripts、独立staging与原子包产物；stream handler重入必须新文件/哈希，下载不等于执行许可，生产不得借全局npm路径。官方依据由GO只读核对：[pacote](https://github.com/npm/pacote)、[npm pack生命周期](https://docs.npmjs.com/cli/v11/commands/npm-pack/)。尚未领取/实现完整npm生命周期。
- CHAT05先完整SDK block和tool_result生命周期，参数完整≠工具成功；正文/输入输出/公开thinking只按需detail，redacted/opaque signature不存可展示正文。partial正文和真正active steering另片，不用快轮询冒充流式或queue别名。
- 观察者性能后继区分一task×128observer与一页面管理128tasks。现LAB02按连接读放大量真实，但不是普通聊天瓶颈；若后续使用[PG LISTEN](https://www.postgresql.org/docs/16/sql-listen.html)/[NOTIFY](https://www.postgresql.org/docs/16/sql-notify.html)，只能唤醒+持久cursor回查/周期兜底，不能当可靠log，不先加broker或广泛triggers。
- K02之后goal引用应有独立node/inputVersion关联，不能伪复用conversation FK；仅两个真实消费者需要时抽同PoolClient resolver/compiler。source head变化要显式freshness和实际下游失效，历史冻结输入不改；现grant不能借此扩大知识读范围。当前A2A仍传完整prompt，未证明跨协议引用。


### 2026-10-06 06:13 UTC E02文档研究增量（未实测）

Goal Owner只读官方[app-server](https://learn.chatgpt.com/docs/app-server)：thread/turns/list的itemsView和thread/items/list仍experimental且受实际store限制；historyMode=paginated创建当前返回-32601，已存paginated的full read/turn page/resume也须按实装failclosed能力核验。固定本机0.154.0的后继0query探针必须验证实际store，schema存在不证明可用；Flow PG轻投影仍权威，不为查看历史开启native resume。thread/list.useStateDbOnly仅候选，支持性与性能未测。没有因此升级/启动auth或模型。

### 2026-10-06 06:29 UTC npm元数据读取候选（未实测）
GO只读官方[npm registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)确认精确版本endpoint。X04目前精确版本仍先取1MiB有界packument，多版本包可能触界；X05记录未来有界比较exact-version与abbreviated packument字节及完整性语义，不据此撤销已审范围，不在本片扩展安装/脚本/模型。


### 2026-10-06 07:02 UTC U11后继与发布边界
固定SDK0.3.290的interrupt/setModel/setPermissionMode适用于streaming input/output；当前string query不能仅凭types宣称active steer。公开interrupt无参数、still_queued不是清空；UUID观察不等于模型遵从。参考[SDK streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)。CHAT07先领域命令/receipt/seal，后继才接真实SDK与生产final同事务门禁。原文UTF8有界、上层轻metadata、授权后懒读，不在回复中暴露hidden reasoning。
CHAT06以明确patch-v1 header协商连接读取能力，旧未协商客户端false，创建幂等ACK稳定false；实际turn是否有patch看持久事实。legacy过滤不删除PG事件，raw-scan cursor可能越过最后可见条目，新Web reader必须接受空页进展。缓存no-store，不能因同批新Web部署假定旧已加载JS消失。


## 2026-10-06 07:26 UTC 当前滚动派工

已审聊天活动主界面已main253b，SVC02复用已审操作工具准备把同一受管安装更新至此固定target；现只读核全库任务/队列/runner与自有进程身份，等GO新窗口，旧窗口不可复用。不会为了等stream App或steer延迟已交付聊天改进。CHAT08从新独立tree领取同query多result/原子final候选闭环，0provider；Web stream只新模块，与消息复用五scope并行。CHAT06P01只有方法/生成器准备，未PG测量；S01原预算中的单进程声明capacity4对照尚待独占窗口。登记87个唯一source的校验通过后由dashboard正常发布，不把数量当完成率。

O08真实一次合成规划已获限定独立语义接收；原driver字面判断FAIL、实际成功图与GO审查三者分别保留，1/1不可重试。下一文本child仅只读设计，尚未授权模型执行；原flow.text是机械验证，不能当语义质量或工程写入能力。

## 2026-10-06 08:08 UTC 当前交付与未完项

工程协作本队4/Web4/Mika2总10；个人运行b54/v6不随main变化。O08已获固定合成图真实原生规划限定验收，1query/$0.0318802估算含辅助Haiku且预算封存；原driver字面正则误拒绝exit1保留，GO只读核真实图/最终文本与清理后接受，非通用规划或child完成。O09领域只读单child与公开thin client已审，生产挂载待窄审；机械flow.text与owner业务接受独立。WPF-CONTEXT01只选择模块批准，Send/Queue接线未做；CHAT09只声明兼容catalog与实际profile门禁，不使个人服务或conversation.steer自动打开。

## 2026-10-06 08:21:00 UTC 后继研究与当前接收

当前主线32c371d包含逐段正文App9dafff、CHAT09 cd859+899协商client、O09 c587生产和0d48CLI，以及CHAT06P02 b009仅将完整prefix SHA留在PG计算的片段；未宣称PG免全文聚合或整体加速。个人runtime仍b54/v6；下一零模型受控更新后再单独申请真实UI预算。O10只准备一次单child差异验收，旧四份模型预算全部封存。历史章节中的“当前”仅描述各自注明时间，不覆盖本节。

Root于本日只读官方[prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)后提供REQ09候选：并发cache要首个响应开始后才可复用，TTL按请求开始；未来应区分同时冷启与自然首个响应后同prefix组放行，不把全任务串行化/额外prewarm当必然省钱。固定native登录是否能控制prefix与cache诊断尚未知，opaque resume不改写。可离线分析既有usage cache字段；API标价不能等同订阅额度，不新增query或owner。

Root只读指出SSE每250ms eventPage复用loadTask SELECT*，任务列表summary亦带入未用submission.prompt；这是源码候选，不是本轮实测因果。待现池/聊天/O10收口，先核未合分支再考虑summary专用窄投影，snapshot/锁写/privateclaim保留。仅局部PG等价与单次bytes，不重做LAB02、不引NOTIFY/cache/broker、不承诺SLO。P01历史摘要与未领取INPUT_REQUIRED后继由原owner取得metadata写权后整理，不勾未完成协议TODO。

2026-10-06 08:45 UTC当前方向：FLOW-002-T09提升为下一批宿主抽象/第二真实harness消费者；SVC03固定前端artifact实施、CHATUI01独立零query准备。O10原生单child1query/2turn/SDK估算$0.0148666经GO限定语义通过且预算封存，不代表工程写改或通用自动交付。用户主动个人请求与operator实验预算分记。

## 2026-10-06 08:57:11 UTC 当前交付与成熟界面追溯

SVC03固定Web产物已实际部署，backend b1c/v12与artifact461a973分别追溯；未来main不自动等于用户页面。R05-A配置提取独审通过、B/C继续：用户优先Claude+Codex，Pi不再是必经前置。WPF-MATURE六个大task由GO定义边界，各co-lead自主拆subtasks；模型/thinking/fast/access及context透明由Mika，视觉/双主题、文件输入、单tab双面板与聊天可靠性由Web，共享runner/center由ExecutionLead依赖接线。完整真实能力与UI验收尚未完成，旧模型预算保持封存。
