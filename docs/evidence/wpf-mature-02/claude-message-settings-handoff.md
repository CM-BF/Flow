# Claude逐消息设置：Lead最小交接请求

2026-10-06 15:20:15 UTC；parent WPF-MATURE-02，co-lead mika。GO当前优先Claude产品线；本页是正式待输入，不是领取/实现批准或已交付能力。父进度只在[status](../../../plans/wpf-mature-02-harness-capabilities/status.md)。

## 当前只请求最小core provision与登记

请Lead以source-only方式准备 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core`，branch `codex/claude-message-settings-core`，拟owner status_read/gpt-6-astra、co-lead mika，并明确固定基线/登记权威status。不得新建full checkout或改shared Git/sparse；低磁盘provision由Lead唯一协调。

随后由新owner fresh账本、原子take以下四个精确scope，COMMITTED后可开始小源码：

- `packages/contracts/src/claude-turn-settings.ts`
- `packages/contracts/src/claude-turn-settings.test.ts`
- `plans/wpf-mature-02-message-settings-core`
- `docs/evidence/wpf-mature-02-message-settings-core`

后两者是sibling管理目录，避开本parent scope。**当前不请求contracts index、现有schema或其余30余路径；不移交02的四个execution-profile路径，claim v5保留不amend。** 两新源先交独立小leaf，仍属同一个产品core直接子任务，不增第三层；通过后依精确合同分片amend接中心/adapter。

既有跨task App发送工具被runtime拒绝（multi-agent v2子agent direct input限制），canonical是正式待输入；不反复调用，不经GO转发普通ACK。

## 两层直接子任务与用户能力

| 父稳定TODO | 直接子任务与顺序 | 当前状态 |
| --- | --- | --- |
| WPF-MATURE-02-10 | 产品core：两文件有限契约leaf → 中心冻结snapshot → 既有Claude adapter/query传递；status_read/mika | 待上述最小WT/登记/take |
| WPF-MATURE-02-11 | 共享consumer：同中心合同client/interaction/Web/TUI下一草稿控件、intent与历史snapshot；owner/独立WT/精确scope后定 | 待core兼容接口，不在诊断树实现 |

用户可为Claude下一条选择实际支持的model、thinking或effort、fast；requested/observed/unsupported分开。运行A、持久队列B、后来草稿C互不改写；历史可读可续，Web/TUI同合同。不等Codex全资格或Node诊断。

## root已选核心设计

- 新leaf只提供受控finite v1 requested组合、能力校验及ACK组合比较复用，字节/字段有界；暂不挂export、不改现schema。SDK声明不等于账号能力：manual thinking首片unsupported，无可信adaptive/effort/fast能力输入则unknown并拒绝组合。fast显式false/true，不暗换model、继承全局或暗示免费；effort omitted与显式值不同，resume重置语义须证明。
- **不引入中心可变next-settings实体或settingsRevision。** draft由客户端持有；配置稳定身份复用profile reference/configDigest，完整组合进入现有请求body幂等digest，避免第二个版本状态机。每runner唯一不可变profile、同session原runner约束不改；旧profile/codec不补键破digest。
- opt-in版本新能力；legacy缺字段走原路径。现client/Web ACK固定要求perTurnModel/Thinking=false与thinking.disabled，先冻结兼容envelope/协商，再开放控件，不能直接全改true。
- task复用现submission JSONB，queue后续只加nullable snapshot；turn从task读取，不存第三份。send/enqueue既有CAS/幂等事务冻结完整组合，自动和手动promotion都只读已存snapshot。

固定只读输入：main `cbd3dd95754be96bf7eeed534fb4c7fcce8a16a8`（status_read核相关源自56d90未变）；SDK0.3.290 `sdk.d.ts` SHA `193becad9d69bc4d2ccd22def53fb9bff9e2628e324f7657d9497da9476af541`有thinking/effort、Settings.fastMode/fastModePerSessionOptIn和init观测字段。init缺/null保持unknown；不把当前上游新枚举塞进固定SDK，不把观测当真实推理强度/账号效果。

## 后继由Lead逐片协调，当前不扩scope

F01 v40的client index/ACK/contracts index，R05 profile兼容与Web RECOVERY01 v4均由Lead协调唯一writer。若窄queue snapshot需migration，编号/SQL owner由Lead唯一分配；**030已O14、031已O15，不猜下一号**。02现有execution-profiles.ts/.test.ts、server execution-profiles/index.ts/native-catalog.test.ts保持原claim，完整后继决策到达再明确停写→fresh amend移除→新owner领取，不先交回。store.ts不属本次owner。

最小验收：leaf有限组合/字节/ACK比较与unsupported；后继注入query精确options、legacy/resume和调用前拒绝；真实PG/HTTP A/B/C冻结、同key/CAS/回滚；consumer未知ACK保原key/body/settings。0付费/新安装，PG/构建/实际运行fresh资源未达则PENDING_RESOURCE，不因资源不足省略必要验证。

## 诊断与方法边界

OpenSSL `ca6a7a15f76d333f20caf0690ed85b76e29d2c54` 保持checkpoint/PENDING_RESOURCE/NOT_OPEN，不再扩诊断。Flow Node宿主、Node synthetic canary、固定Codex native binary三角色独立；Node失败不证明Codex失败，也不是所有harness永久前置，完整Codex启动/权限/模型/停止验收保留。

本轮沿15:16:38已复核的本地find-skills/clean-code（`/Users/citrine/.agents/skills/`；用户固定sickn33@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5），15:20:15安全点检查命名、单一owner/有限接口/错误与unknown/无重复状态机。不重装/联网搜索；本轮只管理文档，0工程测试/新target/PG/build。
