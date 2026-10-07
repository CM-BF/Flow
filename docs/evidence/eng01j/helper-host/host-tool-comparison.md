# ENG01J：本机受信工具写入口的固定源码比较

结论：**优先准备客户端动态工具路线，比新 Linux 专域更小；不是已验证运行能力。** 这是“原生只读、host 独占 calculator 写入”的新受托写语义，不是原生 fileChange/apply_patch/helper 直写已通过。Linux 方案保留为备选，不作为当前产品必经前置。此次只读固定源码，0运行/安装/服务/provider/PG；[精确输入](host-tool-comparison-inputs.json)。

| 路线 | 现可用输入 | 新增依赖 | 能证明的停止边界 | 真实 harness 路径 |
| --- | --- | --- | --- | --- |
| **客户端动态工具（优先）** | 固定0.154 `item/tool/call`、R06 receive/respond；thread/start.dynamicTools；已有只读启动recipe | 显式实验API opt-in；host单文件写gate；现exchange窄异步回调接缝。无需新包、MCP进程或网络端点 | 只有受信host有工作文件写句柄：关闭admission、等待实际在途写settle、fsync/close后拒绝所有迟到调用；超时/丢响应仍unknown。原生保持工作区OS只读，因此不用凭它退出推断撤销host写入口 | model tool call→app-server `item/tool/call`→原唯一pump→host→同RPC response。实际本机这条回调尚未运行；源码上存在，上游测试用mock Responses，不能当本机/真实模型事实 |
| 配置MCP服务 | 有公开mcpServer/tool/call，但它是向已配置MCP服务调用，不是客户端动态工具回调 | 额外stdio MCP进程，或HTTP服务/网络配置与其生命周期 | 还要拥有服务写权限和全部在途请求收束；没有比直接客户端回调更小 | 原生MCP客户端→外部server；当前没有固定的本任务MCP server/配置，故不选 |
| Linux专域 | 已有内核机制候选；现R06可复用 | 尚无固定Linux binary/image、专属cgroup权限及LSM/挂载配置；需要新平台/预算 | 可覆盖域内原生和helper直接写入者，但必须证明无迁移/域外委托、杀域并确认同代为空 | stock app-server/sandbox/helper均在域内；仍有平台兼容成本，不是本机现成方案 |

**协议不是猜测。** 固定发布源码 `thread.rs:138–144` 将 `dynamicTools` 标作 `thread/start.dynamicTools` 实验字段；因此既存默认稳定 ThreadStartParams schema没有它。原schema的 ServerRequest仍含 `item/tool/call`，参数为 `threadId/turnId/callId/tool/arguments`，可选namespace；响应为 `{contentItems:[{type:'inputText',text:...}],success:boolean}`。当前R06已支持 `initialize.capabilities.experimentalApi`，也已支持一次已接收RPC的respond；不改transport、不开第二receive循环。[注册字段](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/app-server-protocol/src/protocol/v2/thread.rs#L138)、[回调响应处理](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/app-server/src/dynamic_tools.rs#L18)。版本源码对应不等于本机实验API已验；不支持时明确unsupported，不转MCP/开网兜底。

**最小调用与授权。** 只注册固定 `flow_calculator_update` function，严格输入 `{expectedSha256,contentsBase64}`、原有小字节上限；不接受path/executable/lease/model或权限参数。host闭包绑定现G的task/attempt/runner/ownerVersion、lease、baseCommit、规范目录/目标inode、代际；工作区对原生只读，私有运行状态独立，保deny-fork/network/Mach和固定binary。先匹配当前已绑定thread/turn及唯一callId、当前ownership和CAS，再串行执行唯一文件更新。模型传入ID不能自授权。重复callId只读该次receipt，异body拒绝；丢ACK不得再写一次。不接受native fileChange或其它工具作为成功替代。

**取消与撤销由唯一写gate持有。** 取消/lease丢失首先同步封门；授权await结束后、提交写之前重新核封门/ownership和同inode。只允许一个在途有限写，不启动worker/child。已经交给OS的写不能靠AbortSignal或Promise.race称已取消：close须等真实写/同步结束、关闭该专用FD；超时保unknown和lease，禁止snapshot/promotion。封门后任何迟到native回调都返回失败，不再重开FD。这里撤销的是受信host该代的专用写能力，不声称整个Node进程UID失去Unix写权限；可信代码是强制层，原生从未获该工作文件写能力。故也不需要把直属native close冒充全部writer撤销。若无法证明只此gate可写，就不能返回revoked。

**现有代码需要的真实改动。** `CodexExchangeRecipe.respond`目前同步，pump直接调用；不能在同步hook藏fire-and-forget磁盘写。最窄共享改动是允许原respond返回Promise并传已有signal，由同一pump有界await；取消后未settle的host操作交gate close负责，不能丢掉任务。`CodexTurnEvidence`已有consumer checkItem接缝，可让新recipe核dynamicToolCall生命周期/完成，并保普通任务拒绝工具。原fileChange-only recipe及它的成功判定应原样保留，新命名recipe明确不同语义。

候选exact scope：新增 `apps/runner/src/engineering/native-tool-writer.ts` 与 `.test.ts`（唯一写gate），`native-tool-policy.ts` 与 `.test.ts`（受限动态工具recipe）；共享 `apps/runner/src/native-harness/codex/exchange.ts` 与 `.test.ts` 的兼容异步接缝须先fresh核owner/原子交权。现已持有的 `native-authority.ts` / `native-authority-darwin.ts` 及两直接test只在后续明确授权后组合只读native factory。G `native-writer.ts` 的绑定/资格语义若需接线，另由原owner明确scope；本比较不改变旧grant常量或资格门槛。

第一交付可0provider做纯gate/注入R06真实协议帧的直接消费者：越界/异attempt/CAS拒绝、单次写及同callId重放、迟到回调、取消前/写中关闭、写已完成但ACK未知；证明写gate没有遗留在途操作。**这仍不是stock实际回调。** stock真实动态工具调用依赖模型产生工具请求，上游round-trip测试使用mock Responses；当前没有公开RPC直接注入内建模型tool call的已核路径。不得把注入帧报为模型成功，也不为此重复catalog/页大小/fsRPC。后续可以单独安排固定实验API注册/回调兼容验收，但此页不授权模型或网络调用。

资格仍沿已交GO的同一个ENG合同缺口：把写执行移至可信host不会凭空产生actual model/no-fallback保证，也不自动满足现G的授写前locked-no-fallback。它让0provider宿主实现可以继续，并提供更小的本机唯一writer收束路径。方法沿已读find-skills/codebase-design/clean-code：复用原pump、明确能力所有者、不建立MCP服务或新执行器。
