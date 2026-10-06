# Versioned configured native profile catalog — design only

WPF-MATURE-02-04；owner chatui01_owner，co-lead Mika。读取基线固定 `f181d84b5fb3652d62e2a181acff442d42b3e066`，2026-10-06 10:20:00 UTC。本文是既有大task的下一片合同建议；未领取新增生产路径、未实施、未运行测试。真实Codex目录探针与R05D生产启动仍未证明可用；此片不依赖它们。更新参照main `41315b033deb0b1953484359b686c0b228997367`：17个目录来源blob与f181全部相同；R05D四源与独审178ef49e完全匹配，见[接入核验](r05d-dependency.json)，旧实现/运行manifest不改。

## 已有 seam 与缺口

| 固定源码 / symbol | 当前事实 | 设计约束 |
| --- | --- | --- |
| packages/contracts/src/execution-profiles.ts / nativeExecutionProfileConfigurationSchema、nativeExecutionProfileConfigurationJson | Claude/Codex配置union和publication已有，旧Claude codec不默认新增字段；Codex请求字段与hostLimits明确 | 复用完整configuration与reference；不删字段、改默认值或重算成旧Claude digest |
| 同文件 / NativeExecutionProfile、ExecutionProfilePage | 原生publication可返回Codex，但page仍只含旧ExecutionProfile | 新page独立命名并携带精确protocol，旧type不拓宽 |
| apps/server/src/execution-profiles/store.ts / listProfiles、profileView、publishProfile | 旧SQL在LIMIT前过滤Claude及不协商的activeSteering；每runner配置不可变；view已有runner-configured/not-probed/resolvedModel:null | 保留旧reader；新reader复用view，不复制发布/摘要/配置状态机 |
| apps/server/src/execution-profiles/index.ts / registerExecutionProfileRoutes | 一个GET /api/execution-profiles，header精确单份steering-v1；no-store、UUID cursor、limit默认20/最大100 | 在同挂载函数新增明确native分支；不要求改全局server启动入口 |
| packages/contracts/src/native-harness.ts；apps/runner/src/native-harness/descriptor.ts | descriptor是本地factory产物，ports仅steering/goalTools/goalGraphTools；明确不传中心、不改digest | 不从它推导已运行provider/模型能力；没有resume/普通会话端口就不凭harness名字宣称可续聊 |
| apps/runner/src/native-harness/codex/index.ts / configureCodexHarness | 配置构造不启动进程；C1 Codex descriptor ports为空 | 展示已配置事实，不把构造成功当可运行或账号entitlement |
| packages/client/src/index.ts / executionProfiles、publishNativeExecutionProfile | 有旧目录和原生发布的薄HTTP方法，无原生目录reader；request仅JSON cast | 新独立reader精确协商并检查新envelope；publication及旧method不变 |
| packages/contracts/src/conversations.ts；apps/server/src/conversations/{commands,admission,state}.ts | 创建schema为Claude literal，admission写Claude，固定ConversationCapabilities.followUp=true；Codex pin与Claude input不匹配 | 不拓宽旧conversation合同，不把其能力对象套在Codex上；任务支持不等于会话支持 |

固定source bytes/SHA见[来源绑定](native-catalog-sources.json)。这只是只读设计输入，不是工程通过manifest。

## 推荐：同一路径的独立 versioned reader

使用已有 `X-Flow-Execution-Profile`，新增精确值 `native-v1`。仅单个原始header且值完全相等才进新reader；无header/steering-v1/不识别或重复header仍按现legacy分支处理。新client必须验响应protocol，旧center忽略新header并返回legacy 200时明确报不支持协议，不能静默当原生目录成功。

新page候选（名字由共享owner落定）：

```ts
interface NativeExecutionProfileCatalogPage {
  protocol: 'flow.native-execution-profile-catalog.v1';
  profiles: Array<{
    profile: NativeExecutionProfile;
    conversation:
      | { state: 'existing-claude-contract'; capabilitySource: 'conversation-response' }
      | { state: 'unsupported'; reason: 'codex-conversation-unimplemented' | 'profile-purpose-not-supported' };
  }>;
  nextCursor: string | null;
}
```

`profile`完整复用已发布的结构，source固定runner-configured、availability固定not-probed、resolvedModel=null、providerCapabilities=unknown；effort/serviceTier只是configured-request，不产生fast=true。wrapper里的conversation是中心路由兼容信息，不进入configuration/configDigest。新codec必须把wrapper conversation与profile.configuration.harness/access交叉校验，禁止Codex配existing-claude-contract或goal profile配普通会话标记。Codex统一unsupported，语义覆盖create/follow-up/native resume/queue/steer/live assistant/下一条设置修改全部不可用；UI不可因为模型目录有Codex而提交普通聊天。没有普通会话权限的goal-tools/goal-graph-tools profile也明确profile-purpose-not-supported。其余Claude指向既有conversation响应的能力对象，不另复制queue/knowledge/live flags为第二权威；实际admission仍重新核pin/revocation/settings/session。

这是新catalog的独立描述，不修改既有ConversationCapabilities的followUp:true或“整会话Locked”。02-09的下一条settingsRevision/CAS/历史与队列冻结仍为后继，当前目录不可冒称实现。

两个替代方案已比较：单独新URL可隔离路由，但增加一个挂载/版本入口而没有新增存储职责；直接拓宽旧page/旧SQL会把Codex交给未识别它的旧读者，拒绝。建议同path、显式header与新envelope/新method，复用现挂载和鉴权。

## 单一 reader 的实现边界

GET沿server/index既有owner-only鉴权，nativeheader不增加访问权限。在现store增加 `listNativeProfiles(pool, after, limit)`，并复用唯一profileView。SQL仍JOIN未revoked的runner；**在ORDER BY/LIMIT前**按已支持 `(harness, adapterVersion)` 对过滤：Claude/claude-sdk-0.3.290-v2与Codex/codex-app-server-0.154.0-v1。native-v1识别现有activeSteering字段，因此可读这类Claude配置，字段原样保留；未来未知harness/adapter不能靠type cast进入页面。普通/goal用途由已验证configuration.access投影，不更改admission。

取limit+1、有界页、UUID after、同一只读transaction，不做全表load再JS过滤。对选中行用既有strict native配置codec校验并复算现有canonical digest、核reference；已识别版本却坏shape/digest时整页返回固定安全 `execution_profile_unavailable`，不跳行、不删字段、不伪造旧摘要。limit+1哨兵行同样校验，避免下一页才出现被隐瞒的损坏。未知版本由SQL排除；已知版本损坏不通过skip隐藏。no-store不宣称快照跨页一致；并发撤销/发布后重取或admission再次核pin，cursor不是授权。

共享contracts增加严格的新page/envelope codec，复用configuration/reference现codec；严格区分两种profile.controls，禁止Codex包进Claude branch。未知protocol/缺protocol/错误shape在新client成为固定安全错误 `native_catalog_protocol_unavailable`，不保留远端正文、Zod actual或原始cause。body仍是无secret的公共profile DTO，禁止路径、配置文件、账号email、token进入此接口。只暴露已配置model标识，不调用model/list、account/read、认证或provider。

新client候选 `nativeExecutionProfiles({ after?, limit? }, signal?)`：固定native-v1 header，每页都发；复用已有Bearer/AbortSignal/错误传播，不接受任意protocol字符串，不自动重试或fallback到旧method。旧 `executionProfiles` 与两个publication methods原样。GET超时/abort只意味着读取未知，不得刷新runner身份或发布配置。

## 精确文件与owner交接

| 路径候选 | 负责方 / 必要变化 |
| --- | --- |
| packages/contracts/src/execution-profiles.ts | 共享合同owner：常量、新page/codec与conversation兼容union；已有schema/Json/publication不改 |
| packages/contracts/src/execution-profiles.test.ts | 同owner：旧canonical bytes与新strict DTO直接检查 |
| apps/server/src/execution-profiles/store.ts | 经Lead分配的领域writer：新listNativeProfiles、复用view和digest核验；旧listProfiles SQL保持 |
| apps/server/src/execution-profiles/index.ts | 同领域writer：精确header分支、新DTO响应；现register函数继续承载 |
| apps/server/src/execution-profiles/native-catalog.test.ts（新） | 同领域writer：自有PG/HTTP fixture覆盖两reader、分页与未知数据 |
| packages/client/src/index.ts | TUI01B当前writer/ExecutionLead协调后继：新增独立薄reader及protocol校验，不改旧method |
| packages/client/src/native-profile-catalog.test.ts（新） | Lead后续分配：真实自有dynamic-port HTTP读取回归，无provider/child |

**无需新增migration，也无需更改apps/server/src/index.ts**：固定f181已在153行调用registerExecutionProfileRoutes、69行迁移现表；在该Module内部接线即可。packages/contracts/src/index.ts已有execution-profiles的export *，无需新增挂载。NativeHarness descriptor、runner adapter/main/config、conversation schema/state/admission均只读依赖，不在这片修改范围。本owner当前未申请以上新增writer范围；Lead可按上述精确路径分工，不用等待canary成功。Root10:23:06账本输入：contracts execution-profiles及领域store/index当时无writer；实际修改前仍需fresh list与原claim原子amend。packages/client/src/index.ts由TUI01B runner_owner claim198f330a…v1占用，F01 v24持contracts index、client/execution-profiles.test.ts及server/index；本片不能改这些共享入口。第一片可只合同codec+现store/域routes+局部tests，client新method作为明确依赖，不复制HTTP wrapper。

## 直接验收矩阵（均未运行）

1. 新合同：Claude旧配置canonical JSON/digest逐字不变；Codex全部请求字段/null原样；wrapper capabilities不入digest；拒绝未知protocol/错harness-controls/额外私有字段。
2. 新旧reader同时存在：无header/steering-v1仍只Claude；native-v1有Claude+Codex且configured/not-probed；重复/拼接/未知header绝不进native；新client遇legacy 200拒绝，不误回退。
3. SQL分页：limit=1，交错已支持/未知adapter、Codex、Claude steering和revoked行；旧reader过滤在LIMIT前，新reader不漏/不重复/不返回未知；有界查询参数与cursor invalid/limit invalid明确。
4. 损坏已知版本的shape/digest整页安全失败，完整字段未drop；撤销后新目录无该profile，旧pin提交仍拒绝。不得以目录presence充当新授权。
5. conversation：每个Codex目录项均unsupported；旧create仍拒绝harness=codex及Claude请求配Codex pin；Claude普通profile走既有路由，goal profile不伪装可普通聊天。无native resume/stream/queue新承诺。
6. client：Bearer、每页精确header、cursor编码、AbortSignal、safe错误/unknown body、无retry；旧client目录/发布两组行为保持。
7. fixed f181受影响contracts/server/client TypeScript检查；现有execution-profiles与steering-admission中相关目录/鉴权/分页直接消费者、conversation创建拒绝行为需在实际集成点核验。无需27语义、31 transport子进程、C1 provider/全库/Web全集重跑。计数按实现后实际选择记录，本文不预报通过数。

工程fixture使用自有PG database及系统dynamic port、bounded IO与finally cleanup；不动个人服务，不启动runner真实transport/SDK/provider。若共享版本前进，Lead需固定新base、路径writer冲突与直接消费者后再实施。

## 结构复核

沿本地find-skills匹配TypeScript/Zod/PG/HTTP合同，采用codebase-design确定单一catalog Module和既有挂载seam；clean-code固定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，复核命名、单一reader职责、错误安全、不复制descriptor/配置状态机、按LIMIT前过滤而非全表扫描。brainstorming按已授权有界设计工作应用；尚未实施，不新增用户审批流程或安装技能。

只读设计约束review：architecture_read/gpt-6-astra基于main41315b给出方向无阻断；精确协议/owner权限、SQL-before-limit与哨兵校验、conversation交叉校验、原配置/null/digest与not-probed边界已纳入。此意见不是尚未实现代码的APPROVED。

Mika方向批准：同path精确native-v1/new envelope、SQL known-pair先过滤、哨兵strict验证、Codex/goal conversation unsupported与旧codec/digest保持。获准下步在现claim原子amend五个精确文件：packages/contracts/src/execution-profiles.ts、packages/contracts/src/execution-profiles.test.ts、apps/server/src/execution-profiles/store.ts、apps/server/src/execution-profiles/index.ts、apps/server/src/execution-profiles/native-catalog.test.ts。先受控同步已审main并fresh ledger；本段只记录授权，实际receipt/工程结果后继另绑。

PG验证来源：复用固定f181的apps/server/src/execution-profiles/execution-profiles.test.ts中自有randomUUID DB、advisory ownership、动态端口、finally server/pool/drop cleanup方法；测试只publication/catalog/admission读取拒绝，不启动runner SDK/transport/provider。fixture可在新专用test文件中局部实现，不抽无关PG平台。现有legacy目录/steering选择用精确Vitest路径/筛选及实际计数；不得以0测试或预估计数当通过。
