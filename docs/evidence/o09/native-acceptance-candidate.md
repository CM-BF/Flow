# O09 单个文本子任务原生验收候选

2026-10-06 08:09 UTC。**仅方案，0 query；尚无本次 provider 预算或执行许可。** O09 实现与既有调用链已审，不代表本候选已执行。O08 既有预算已封存，不能移用。当前产品源码停止写入；本次只补计划，不创建 driver、permit、runner 或数据库，不操作个人安装。

## 固定输入与执行前置

领域目标为 `7ddd763a2e2274c040dea7e114dcf6d6da226cf6`，已独立 APPROVED；生产 factory/client 挂载由 Lead 完成并独审后，另固定包含这些输入的完整 main SHA、相关源码摘要、锁文件及 SDK `0.3.290`。本方案不把当前分支手动 register 测试当生产挂载证明，也不追逐未审的最新源码。

需要专用 runner 在私有中心登记一个**普通 purpose、configured-readonly** profile，保存实际 `{id,runnerId,configDigest}`、配置与合成材料摘要后，由 owner 显式选该 pin 受理。当前没有可复用的已登记验收 profile：作者随机测试库已删除；个人安装既有 none profile 与 O08 graph-tools profile 都不符合本片要求，不修改或悄悄转换它们。

候选固定配置：仅一个私有合成材料绝对路径，`allowRead:true`、`requireReadApproval:false`、`goalTools:false`、`goalGraphTools:false`、请求 model `sonnet`、最多 3 turns、SDK 估算上限 USD 0.10、60,000 ms 协作超时。其余沿既有 adapter：thinking disabled、dontAsk、Read-only tools、无本次 MCP 工具、host 路径核对、服务凭据不传 SDK 子进程。配置实际登记与 claim 双重核对；本地材料路径摘要只证明路径清单，材料内容另外保存摘要，不能把两者混为一项。

GO 若选择本候选，仍需单独分配一次性预算并绑定最终源码/配置/输入与有效期；未来记录应诚实写 GO 依据既有用户授权的预算分配，不伪称用户新发许可。本方案本身不授予调用权。

## 一个节点、一次受理

owner 在新私有项目建立一个普通文本节点并定义输入 v1，无依赖、无前次 execution。不是再次调用 planner，也不授予创建其他子任务的权限。

| 项目 | 精确候选值 |
| --- | --- |
| 合成材料正文 | `项目：纸鸢。版本：0.1。新增能力：草稿预览。发布状态：内部测试，尚未正式发布。` |
| goal | `读取唯一授权材料，为纸鸢 0.1 写一段不超过 120 个汉字的中文发布说明草稿。` |
| constraints | `仅采用授权材料中的事实；明确仍为内部测试且尚未正式发布；不得补充日期、链接、性能承诺或其他功能；只返回正文，不写文件、不调用其他工具。` |
| acceptance | `人工核对项目、版本、草稿预览及未正式发布四项事实；文字简洁，无材料之外的承诺。` |
| verification | `{kind:'contains',expected:'纸鸢'}`，只证明保存正文含此字串 |

owner 通过 `POST /api/goals/:id/native-executions` 发送当前 nodeId、`expectedInputVersion:1`、`dependencies:[]`、`previousExecutionId:null`、明确 reason 和实际 profile pin，使用事先固定的唯一 key。不直接 submit 绕过 O01/K03；不改变旧 fixture execute 或旧工具 grant。

未来最小验收器复用生产 `createServer`、`runRunner`、`createClaudeAdapter` 与现 SDK，不能复制 agent loop。若要记录 query 次数及原生 init/result，可沿既有实验方法在 adapter 的公开 query seam 放透明观察 wrapper，底层仍调用真实 `nativeQuery`，不改 prompt/options、不伪造 SDK 帧。实现与 0query 检查必须另行派工、领取精确实验范围并固定 review；本轮没有创建它。

## 证据分层与判定

1. **受理与执行归属**：公开 receipt、唯一 goal execution/task/attempt、profile pin、实际输入版本/摘要，现 K03 冻结记录与 native session/typed final/产物版本相互对应。任务受理不等于 query 已发生；仅一个 SDK query 入口调用也不等于一次 HTTP 请求或一个计费模型，辅助模型用量另记。
2. **配置与工具观察**：requested 配置、init 声明、host 判定、原生工具 start/result 分别记录。沿已知 managed 3 plugins + 3 skills 的历史声明基线，不为零扩展要求绕组织配置；init 不证明资源执行或无副作用。只读 host gate 是实际工具权限边界，不称 OS/组织 hook 完全隔离。若实际资源或能力不同于最终获批基线，立即收尾并保留差异，不改配置补次。
3. **Read 的证据强度**：工具被列为 allowed 或 host 放行不等于读取成功；要有对应的原生工具调用/结果才能称实际 Read 通过。现产品普通 Read gate 没有逐条成功判定日志；缺失项写未观察，不从成功正文倒推完整 hook 审计。若未来确需额外观察，只在已审实验 wrapper 记录有界工具名/来源/判定/有限 ID，不存参数、路径之外的宿主数据、thinking 或凭据。
4. **机械结果**：任务 succeeded、独立 flow.text passed、持久 final 与产物正文摘要相同；accepted 仍 null。保存实际 SDK subtype/is_error、turns、各模型 usage/costKind；未知保持 null，USD 是 SDK 估算而非账单。失败、超限、无 final、旧 fence 或 unknown 都不得绿。
5. **业务结果**：GO/独立观察者阅读全文并对照四项事实，给出语义判断及理由；不使用某一句措辞的正则来代替自然语言验收。机械字串检查不验证全部事实、字数或语义。未得到业务接收声明时不调用 accept-delivery；若随后明确授权接受，owner 用现有命令记录理由，仍不宣称系统自动完成语义验证。

原始程序判定与独立语义结论单列，保留失败/unknown 原证据。一次仅证明这个固定合成文本 child，不证明开放式规划、工程写改、批量自治、完整依赖图执行或 UI 体验。

## 预算、失败与资源收尾候选

建议独立候选额度为 **1 次 SDK query / 最多 3 turns / SDK 估算 USD 0.10 / 60 秒协作超时**，目前全部未批准。先落一次性 reservation/attempt marker，再允许底层 query；每次入口核 marker，未知结果封存，不自动重试、resume 或创建第二 execution。任何 preflight、初始化或执行失败均保留原始原因；不得用新 key/新目录绕过已消耗标记。60 秒不叫硬 OS 停止或费用硬保证。

使用新随机专库、动态 loopback 端口、0600 配置/凭据与独立私有工作目录；合成材料是唯一可读文件，不使用 Flow 仓库或用户文件。中心/runner 凭据仅宿主使用，不输出、不读登录文件内容；只复用已批准的本机 Claude 登录状态。主个人 DB/runner/端口/Web tabs 全部不动。

未来验收器须从同一受控生命周期记录自有 PID/PGID、事务和任务终态，停止本次 runner/SDK、中心和连接后再删除私有库/tmp。复用 O08 已审的“leader 退出仍核进程组，TERM 后有界确认，必要时仅杀自有组，unknown 保留资源”原则；组内清理不证明 SDK 脱组子进程不存在。先保存脱敏输出/ID/正文摘要与状态，再清理。取消 ACK 不证明实际停止；清理未知不写全绿，不自动重开试验。

此候选的下一步是 Lead/GO 选定后另派小型验收器准备、固定 production source/profile 与 0query 检查，再申请新单次执行预算。它不阻塞当前 O09 代码片段进入 main，也不要求重跑已通过的 27 个作者检查。
