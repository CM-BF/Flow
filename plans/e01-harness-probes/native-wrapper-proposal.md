# E01 原生工程能力与 stock wrapper 兼容性提案

状态：**真实调用 NOT_APPROVED；仅允许 0 模型兼容/参数预检**。2026-10-06 UTC；owner runner_owner / gpt-6-astra。Goal Owner 经 Lead 回传已审定研究方向：收敛为先原生工程能力、后原样包装层同类兼容性，不为对齐而改造出自制 harness。旧方案见历史提交 0c53387fe50a000a7ec03e8d1a944c4afe64b6dd，已被本版替代，不能用旧文档启动执行。auth/Paseo 已审原始结果不变，R02/I01 5/5 额度封存。

## 已核实的选型事实

以下来自已安装固定版本源码/声明的只读核对，不是新模型实测。具体位置与 SHA256 见 [comparison-source-hashes.json](../../docs/evidence/e01/comparison-source-hashes.json)。

| 维度 | 原生 SDK0.3.290 / stock wrapper1.0.143 的事实与影响 |
| --- | --- |
| 依赖版本 | 原生实装0.3.290；wrapper独立bridge package/lock pin SDK0.3.281、CLI2.1.281。顶层安装0.3.290不会自动升级bridge。版本不同，不能声称严格公平胜负 |
| Prompt | SDK不设systemPrompt是minimal；stock wrapper明确claude_code preset+append。原生工程验证应显式选preset并记录完整profile，不能把默认prompt差异归wrapper |
| 设置发现 | 0.3.290公开settingSources可传[]；stock start schema/query未透传该字段。空skills在host发送时被省略，不能以调用者传[]断言真实零发现 |
| 预算 | 原生maxBudgetUsd可用；stock settings/start/query只有maxTurns，没有maxBudgetUsd透传。不能在报告里虚构wrapper已实施相同USD限制 |
| 取消 | stock bridge调用query传abortSignal；0.3.290公开Options字段是abortController。该差异不等于已证明0.3.281取消失败；必须对其实际固定版本/公开stop与外部deadline做零模型预检 |
| 工具权限 | stock已有builtin过滤/approval，但query中PreToolUse只显式处理AskUserQuestion，不是Flow逐工具ownership/path gate。原样能力是否满足本任务约束需要预检，不能靠改一整套工具系统“证明兼容” |
| 用量 | stock bridge从成功result.usage映射token、另读total_cost_usd，没有保留modelUsage。主循环usage不等于整个query pipeline；缺失统计应如实unknown/incomplete，不能悄补harness后当stock结果 |
| Auth | stock doStart直接await subscription resolver；file优先级/refresh/writeback/无取消等已有合成证据。旧FLOW002真实路径曾refresh400，未到模型，实际当前可用性未知；不读真实凭据来预先证明 |
| 状态位置 | stock bootstrap依据sandbox HOME写自身状态。不同宿主/凭据来源/会话目录是比较配置的一部分，不为消除差异而重设HOME或重造bootstrap |

## 执行顺序与问题

1. **先原生能力**：在明确模型写入资格、认证、范围和新预算获批后，用固定原生SDK完成一个受控工程任务，验证实际修改、测试和固定产物。它只证明该配置的一次工程能力，不证明Flow完整交付或生产最终选型。
2. **再 stock wrapper 兼容性**：先0模型检查其公开入口/配置/取消/预算/工具和认证前提；只有明确安全且另获批才尝试同类任务。保留stock0.3.281版本与设置差异，记录能/不能满足哪些Flow Interface，而非宣布谁更快/更省。
3. 只有实际最小adapter必需的补丁才可另提：说明缺口、来源hash、精确diff、影响/许可和新检查target；补丁变体的结论与stock分开。**本版不授权 auth/bootstrap/budget/cancel/settings/toolgate/usage 的组合改造，也不默认将bridge升级到0.3.290。**

零模型预检限本地固定文件/合成输入：逐项判定“公开支持 / 源码存在但未实测 / 不暴露 / 不满足”，必要时仅运行纯函数或注入的公开seam，不触发SDK进程、真实认证、网络或模型。预检可以认定某一路当前不适用，不能为凑齐两路不断扩研究。若需要新的依赖/宿主搭建或大面积shim，给出具体阻塞交Lead选型。

## 拟用的工程输入与产物

由Astra先准备两个独立合成repo，初始文件逐字相同并固定hash：`SPEC.md`、`src/records.mjs`、`tests/records.test.mjs`、`package.json`。不加载Flow源码、CLAUDE.md、用户材料或旧模型session。冻结测试先在有意缺陷实现上失败。拟任务为修复`decodeRecords(chunks,{maxLineBytes})`：跨chunk UTF8中文/emoji、LF/CRLF/空行、最后一行、坏JSON及按字节计算的行上限。只允许改源码并写RESULT.md，不能改验收测试。

受测代码必须在无网、无凭据、仅挂载本次合成目录的受限本地容器运行，不在宿主导入模型代码。固定已有image digest/Node版本、只读测试/输入、进程/内存/超时限制；环境不具备则停在预检，不能降级到无隔离执行。具体模型工具surface只采用该路线实际可安全提供的接口并完整披露；若stock不能满足权限/预算，就记录不兼容，不静默补齐。

完成依据是实际允许的源码差异、模型触发的真实测试退出、会话停止后作者独立重跑冻结测试、输入未变、RESULT.md及artifact manifest/diff/日志的hash。两路源码不必字节相同，但验收行为相同。失败、拒绝、超时及已发生副作用都保留。每路仅一个样本，无延迟/成功率/成本排名，不向第二路传递第一路产物。

## 待执行预算，尚未批准

| 项目 | 提议（非当前授权） |
| --- | --- |
| query总数 | 最多2次：原生1，stock兼容性1；两个新session、串行、不resume/continue、不自动补跑 |
| 原生单次 | maxTurns8、maxBudgetUsd1、wall90秒 |
| stock单次 | maxTurns8、wall90秒；USD限制暂缺公开透传，必须先明确可接受约束再批准此路，不声称已有$1 cap |
| 总额 | 拟总USD2客户端估算阈值，不是账单或严格不超额保证；当前0次被批准 |
| 停止规则 | query入口调用即计次，失败不返还；首路已达/超USD1或用量unknown时不启动第二路，回报后再决定 |
| 生命周期 | 单路90秒先取消，3秒后终止本次进程组、再2秒kill；总run不超过5分钟，只清理本次资源IDs |
| 数据 | 每路结构化结果<=1MiB，总归档<=8MiB；超限明确失败，无无界日志/无筛选stderr |

query次数不等于底层API请求数；一次query可有多次主循环和辅助请求。SDK预算可在完成一次响应后发现超额，且只约束本query/clear后的增量，不替代Flow跨任务预算。真实执行前必须绑定批准摘要hash、显式开关、wx新建次数账本；预检通过也不自动解锁真实调用。

## 认证与模型门槛仍是前置

原生拟由官方SDK自行使用本机已有用户登录；stock保持其真实公开认证路径，并先记录当前兼容缺口。脚本不读取/复制credential store、不运行Keychain命令、不主动refresh、不写共享登录、不重设HOME、不购买credits。不因为auth失败导出token或将home挂入容器，也不采用auth:{} +私有bootstrap等组合变体绕过现存缺口。若需新的登录、真实刷新或别的合法认证来源，应另行明确授权，不能挪用旧R02额度。

官方支持页当前June15更新说明SDK/claude -p/第三方SDK应用仍使用现有订阅限额，下方历史monthly-credit方案已暂停；这不证明本机现有身份可用于每条路线。[官方支持页](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

原R02实际返回过claude-sonnet-5-5，可作为候选版本记录，**不等于已确认达到Sol写入门槛**。临时合成repo也不自行豁免模型门槛；真实工程写入前由Goal Owner确认合规模型/范围，必要时由root一次性向用户澄清。所有Flow文件仍由Astra写。未确认时只做0模型准备；不自行换模型试跑或把只读冒烟称为工程交付。

## SDK语义与公平记录

0.3.290公开选项为`systemPrompt.snapshot`，内部初始化字段才叫`systemPromptSnapshot`；preset支持excludeDynamicSections。默认resume沿用已记录prompt直到compaction，新约束须新受理版本/明确消息，并由工具gate执行，不能只改append当作已撤权。本轮拟新session，不新增恢复调用。[官方prompt文档](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)

`usage`是主循环；`modelUsage`累计覆盖query pipeline，但不涵盖所有pipeline外helper。新session读final total；resume可能继承持久baseline，不能再次相加；clear重置；无baseline/崩溃零值不能臆造成本。分别记录stock可见统计和缺项，不拿计数映射当完整账单。[官方cost文档](https://code.claude.com/docs/en/agent-sdk/cost-tracking)

每路记录实际SDK/CLI/model、请求profile、preset/append hash、settingSources、实际tools/resources/skills/plugins、权限/认证模式、session/结果ID、配置差异、setup与query时间边界和已知用量口径。传空列表不证明零内置资源；init的apiKeySource:none也不唯一识别凭据来源。配置/缓存/版本不同必须作为限制，不把所有差异归wrapper。

## 当前交付

仅固定源码/资料核对和本版提案：真实query0、refresh0、未启动新wrapper/测试容器。auth原raw bb7d3f9...与Paseo raw a123e8...不变。Goal Owner允许后续有界0模型兼容/参数预检；没有批准真实模型。下一步优先记录stock选择事实、给最小公开参数检查，避免发展成自制harness；其他ready产品工作可继续，不等待本实验预算。
