# Claude逐消息设置：Lead最小交接请求

2026-10-06 15:25:25 UTC；parent WPF-MATURE-02，co-lead mika。GO当前优先Claude产品线；本页是正式待输入，不是领取/实现批准或已交付能力。父进度只在[status](../../../plans/wpf-mature-02-harness-capabilities/status.md)。

## 当前只请求最小core provision与登记

Lead已provision source-only `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core`，branch `codex/claude-message-settings-core`，base `70cc4e852365e974cefde30bfad75c7d233985c6`，clean；95 files/2422458 logicalB、0install/PG，见[正式receipt](/tmp/flow-claude-message-settings-provision.json)。owner status_read/gpt-6-astra、co-lead mika；已COMMITTED领取claim c652bc61-f8a9-4848-a709-978adbb425ed v1（2026-10-06 15:24:10.824Z），task WPF-MATURE-02-CORE，fresh ACTIVE，小源码实施中。child canonical存在后再由Lead登记dashboard。

新owner已原子取得以下四个精确scope；仅这些范围可实施，后继扩大仍须amend：

- `packages/contracts/src/claude-turn-settings.ts`
- `packages/contracts/src/claude-turn-settings.test.ts`
- `plans/wpf-mature-02-message-settings-core`
- `docs/evidence/wpf-mature-02-message-settings-core`

后两者是sibling管理目录，避开本parent scope。**当前不请求contracts index、现有schema或其余30余路径；不移交02的四个execution-profile路径，claim v5保留不amend。** 两新源先交独立小leaf，仍属同一个产品core直接子任务，不增第三层；通过后依精确合同分片amend接中心/adapter。

历史跨task App发送被runtime拒绝（multi-agent v2子agent direct input限制），collaboration目标曾非live；当前Lead已直接持续读取canonical并完成provision，该跨Lead阻塞解除。后续沿canonical交接，不再经GO转发普通ACK。

## 两层直接子任务与用户能力

| 父稳定TODO | 直接子任务与顺序 | 当前状态 |
| --- | --- | --- |
| WPF-MATURE-02-10 | 产品core：两文件有限契约leaf → 中心冻结snapshot → 既有Claude adapter/query传递；status_read/mika | 四scope已COMMITTED，小源码实施；child canonical存在后登记，检查资源pending |
| WPF-MATURE-02-11 | 共享consumer：同中心合同client/interaction/Web/TUI下一草稿控件、intent与历史snapshot；owner/独立WT/精确scope后定 | 待core兼容接口，不在诊断树实现 |

用户可为Claude下一条选择实际支持的model、thinking或effort、fast；requested/observed/unsupported分开。运行A、持久队列B、后来草稿C互不改写；历史可读可续，Web/TUI同合同。不等Codex全资格或Node诊断。

## root已选核心设计

- 新leaf只提供受控finite v1 requested组合、能力校验及ACK组合比较复用，字节/字段有界；暂不挂export、不改现schema。SDK声明不等于账号能力：manual thinking首片unsupported，无可信adaptive/effort/fast能力输入则unknown并拒绝组合。speed显式standard/fast，不暗换model、继承全局或暗示免费；effort not-requested只表示未发送请求，resume重置语义须证明。
- **不引入中心可变next-settings实体或settingsRevision。** draft由客户端持有；配置稳定身份复用profile reference/configDigest，完整组合进入现有请求body幂等digest，避免第二个版本状态机。每runner唯一不可变profile、同session原runner约束不改；旧profile/codec不补键破digest。
- opt-in版本新能力；legacy缺字段走原路径。现client/Web ACK固定要求perTurnModel/Thinking=false与thinking.disabled，先冻结兼容envelope/协商，再开放控件，不能直接全改true。
- task复用现submission JSONB，queue后续只加nullable snapshot；turn从task读取，不存第三份。send/enqueue既有CAS/幂等事务冻结完整组合，自动和手动promotion都只读已存snapshot。

本次设计只读查证baseline7810→70cc相关源码不变；core provision基线70cc4e852365e974cefde30bfad75c7d233985c6；SDK0.3.290 `sdk.d.ts` SHA `193becad9d69bc4d2ccd22def53fb9bff9e2628e324f7657d9497da9476af541`有thinking/effort、Settings.fastMode/fastModePerSessionOptIn和init观测字段。init缺/null保持unknown；不把当前上游新枚举塞进固定SDK，不把观测当真实推理强度/账号效果。

## 首leaf固定Interface

严格有界、无defaults：`protocol`、profile `{id, runnerId, configDigest}`三字段、requested完整组合 `{model, thinking: disabled|adaptive, effort: {kind:level,value:固定SDK五值}|{kind:not-requested}, speed:standard|fast}`。可信允许组合最多32、不得重复，不拼各维度笛卡尔积。not-requested使model选择不依赖effort控件，但仅表示未发请求，不承诺SDK reset/default；future bridge对resume语义未知组合拒绝。legacy缺字段不假填disabled，effective保持unknown。

仅两文件、仅zod，不runtime import SDK/现profile形成循环。helpers：`checkClaudeTurnSettingsAllowed`核精确可信profile及完整combination；`claudeTurnSettingsJson`稳定顺序、不另造hash；`assertClaudeTurnSettingsMatch`将缺失/非法/不匹配统一专用mismatch，供现unknown ACK路径映射。5组待实现检查：strict/字节界限、canonical变化、整组合授权、三字段profile绑定、ACK缺失/不符；当前仅固定设计，不称测试通过。

## 后继由Lead逐片协调，当前不扩scope

F01 v40的client index/ACK/contracts index，R05 profile兼容与Web RECOVERY01 v4均由Lead协调唯一writer。若窄queue snapshot需migration，编号/SQL owner由Lead唯一分配；**030已O14、031已O15，不猜下一号**。02现有execution-profiles.ts/.test.ts、server execution-profiles/index.ts/native-catalog.test.ts保持原claim，完整后继决策到达再明确停写→fresh amend移除→新owner领取，不先交回。store.ts不属本次owner。

最小验收：leaf有限组合/字节/ACK比较与unsupported；后继注入query精确options、legacy/resume和调用前拒绝；真实PG/HTTP A/B/C冻结、同key/CAS/回滚；consumer未知ACK保原key/body/settings。0付费/新安装，PG/构建/实际运行fresh资源未达则PENDING_RESOURCE，不因资源不足省略必要验证。

## 诊断与方法边界

OpenSSL `ca6a7a15f76d333f20caf0690ed85b76e29d2c54` 保持checkpoint/PENDING_RESOURCE/NOT_OPEN，不再扩诊断。Flow Node宿主、Node synthetic canary、固定Codex native binary三角色独立；Node失败不证明Codex失败，也不是所有harness永久前置，完整Codex启动/权限/模型/停止验收保留。

本轮沿15:16:38已复核的本地find-skills/clean-code（`/Users/citrine/.agents/skills/`；用户固定sickn33@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5），15:20:15安全点检查命名、单一owner/有限接口/错误与unknown/无重复状态机。不重装/联网搜索；本轮只管理文档，0工程测试/新target/PG/build。
