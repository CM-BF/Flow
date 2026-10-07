# O16-06 — 原生分阶段候选（0 query 准备）

2026-10-07；所属FLOW-001，原O16三literal。新claim55c4e833 v1，旧f72/rehearsal许可与原FAIL/KEEP都不复用。已main的零模型旅程仍是独立已验事实；本候选未运行PG/auth/query，也未产生有效模型许可。[固定只读输入](readonly-inputs.json)来自本树23d0821/f5a实际闭包；先保这个已验产品base，若Lead后续指定新base，只比较实际输入，不整merge。

## 实际差异与最小源范围

| 已存在的接缝 | 当前真实缺口 | 原scope内最小改动 |
| --- | --- | --- |
| driver `plan/confirm/children/decide` + 原runtime/SDK loop | operator只支持 `--rehearse`，终态只认independently-accepted且DB/tmp已删除 | 在operator.mjs增加显式phase选择，复用supervise/watchdog；按阶段读既有report，plan以准确proposal、0child、已停进程/已关连接/保留资源收据为终态，不强迫整旅程通过 |
| runPaths/measureRun、已登记组和150swatchdog | operator一个run reservation/STOP路径不能支撑各阶段新的有限运行，且材料保留无到期守卫 | operator-bounds.mjs采用同run内固定phase子目录，阶段动作只许首次exclusive；不覆盖历史operator目录。整run raw仍合计2MiB，私有runtime仍8MiB候选，deadline每次新段而非改旧封套；持久reviewUntil过期仅拒继续，不自动删除 |
| resources.finish(destroy:false)、marker/devino和3s连接观察 | 能关闭资源但没有明确保留截止、恢复前完整暂停收据；仅内存workerStopped不足以放行后继 | resources.mjs为暂停写耐久receipt，含实际已登记组末态、app/pool关闭、连接空观察、DB/目录身份和期限。恢复先读原receipt和marker；未知保留，不重新建库/换namespace |
| 原driver实际proposal/confirmation-draft和同key确认 | 首错会被finally收尾错误覆盖；plan待审材料和资源关闭事实分散 | driver.mjs先耐久业务结果/首错，再关闭；cleanup错误另列。最终stage receipt绑定proposal/input/profile/draft与关闭结果，children或accept绝不自动发生 |
| native worker仍用runRunner/createClaudeAdapter | phase-host native目前继承process.env；adapter persistSession=true，现有认证选择多源 | 只在明确既有登录来源与可写位置后给phase-host.mjs有限env视图。不得复制SDK pump、修改apps/runner或凭据、把dontAsk/空settings当OS隔离 |

新增最多一个小的 `stage-policy.mjs`/直接test，隐藏phase→预期report/暂停expiry/path规则；由operator调用，driver仍唯一公开旅程组合。必要影响验证只选operator/resource/phase-policy的暂停、到期、已有namespace拒绝、首错/cleanup分离用例；不重跑旧26或已过全旅程。实现时更新identity和README/Interface的陈旧“PG未跑”当前叙述，旧原始记录不改。现仍只是具体源码候选，未改实验行为。

## 第一段与独立复核

候选入口为原operator扩展后的 `--plan <new-run> <new-plan-permit>`，默认仍不运行native。plan许可固定sourceDigest、SDK路径/配置、既有登录来源种类、材料与合成目标、1次SDK入口/4turn/请求USD0.20/90s；这些是候选，不是已授预算或计费硬限。先wx/fsync消费原permit/slot，再启动原worker。graph grant=1proposal/0apply/2nodes/1edge，中心audit必须匹配实际run/task/attempt/ownerVersion；不让driver补造proposal。

成功停止点：proposal原文/两完整GoalInput/citation/profile tuple/digest、未批准confirmation-draft、SDK声明/实际工具audit/usage以及不含凭据的pause receipt全部耐久；所有已登记自有组已停止，center/pools结束，专库无残留连接，没有worker/SDK/poller等待owner。DB与devino目录仅保留恢复所必需材料，候选reviewUntil=关闭后15分钟且写入前固定。到期不运行、不自动DROP；owner明确放弃或收尾时另用原marker/零连接/normalDROP规则。无法证明关闭或报告不完整仍unknown，不能声称“成功暂停”。进程组观察不证明任意逃逸后代全部停止。

后继owner根据**实际**proposal决定确认范围/预算；confirmation阶段不启动runner，严格原body/key落盘且ACK未知仅按原key恢复。children使用另一期许可，绑定真实proposalDigest/confirmationDigest/profile/两项依赖，最多2SDK入口。原中心scan推进，driver不派发第二项。两个child各60s是各自请求上限，不能保证在原120s工作总界限内都用满；候选沿每段120s work+30s cleanup/150s外限，准备、查询、证据共同消耗，超时停unknown，若未来要求更长须明确新段预算，不能隐式加时。独立语义接受是之后明确动作，机械passed不自动接受。

## 登录来源与总写入：具体尚缺事实

只读installed package元数据仍SDK0.3.290/MCP1.32.1；O10旧成功报告有runtime2.1.290/model claude-sonnet-5-5及managed名字，但**没有**可核对的登录来源种类/位置收据。当前原adapter nativeEnvironment允许HOME、CLAUDE_CONFIG_DIR、OAuth/API相关env等多个候选来源，且persistSession=true。不能把旧成功或Sonnet声明当当前登录/网络/写入范围证明。本次没有读取任何凭据值、私人配置、keychain，也没有auth probe。

实际native入口前需固定一个既有已登录来源（例如现有登录配置路线，还是operator已存在OAuth环境来源），仅记录类型/非秘密路径与相关变量名，不复制或输出凭据，不改变登录，不新建认证。phase worker必须排除center/runner/DB secrets，TMPDIR/cwd/native生成材料限定自有目录。若所选登录路线同时把会话/缓存写到个人HOME，当前8MiB私有计量不能声称覆盖总写入；须先用固定SDK源码确认可分离登录读取与私有会话写入，或明确可观测的受限位置并获对应既有授权。不能以私有HOME导致登录未知后再盲试原环境。

候选运行界限沿原raw2MiB（stdout/stderr/所有stage报告总和）、runtime8MiB、PG/WAL单列、fresh1GiB+128MiB加现场并行预算；有限review保留期也计入资源。外部未绑定SDK写入或managed副作用不被冒充为硬总写入上限。这个输入缺口不阻零query阶段operator/pause逻辑实施，但会阻止真实native准入。

## 当前交付与未开放边界

下一可交付是上述原scope小delta和0query直接故障/暂停检查，随后独立review；不是再交“等预算”空状态。真实PG、SDK/auth、模型费用与实际材料语义依次独立安排。旧O08/O10预算sealed；旧O16FAIL/KEEP不读改删；resume/compaction情景、实际native工程写权/ENG资格不在本候选。只复用既有监督、SDK与公共产品，不新造scheduler/执行器/认证平台。
