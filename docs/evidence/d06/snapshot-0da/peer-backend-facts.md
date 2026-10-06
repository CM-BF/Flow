# D06 固定主线：backend / PG / runner 事实供给

固定主线 `0da869f7bad98771177472539b5a192365c15117`；旧图仍固定 aeb。仅源码策展输入，非独审APPROVED、运行或部署事实。D06 owner为d01_owner，我是只读peer。先复用管理architecture-snapshot-next intake/16pins；每个原始SHA256与branch祖先核在source-audit.json，不改变checkout。技能：本地find-skills、codebase-design、clean-code；实际按配置→鉴权→事务→宿主调用追踪，避免把目录/route/合同/运行四种事实合并。

## 已在固定 main 的事实

1. **028 browser session：中心显式信任配置，HTTP/SSE共用授权。** `apps/server/src/index.ts:101–108,155–156,189` 实际迁移、认证、mount与SSE注入；`main.ts:14–22` 仅宿主FLOW_BROWSER_SESSION_JSON显式启用。auth `browser-session/index.ts:16–17,45–59` 校验cookieOrigin、trustedOrigins、epoch，真实scheme+Host匹配目标，safe无Origin仅same-origin fetch上下文；不是任意Origin反射。`70–89` 显式Bearer先判owner/runner，非法Bearer不回落cookie；`62–68` cookie写要求当前CSRF。`streams.ts:16,33,46,58–62` 不只握手认证，每轮读/发布前再核。`028:2–16` 持久随机center/principal与哈希session；store:19–58不以GET续期，epoch改变撤旧session，满32拒绝，绝对8h（contracts:5–6）。**不可画成身份系统新增多用户CRUD或所有已部署Web已恢复。** 还须保：row绑cookieOrigin而不是每个sourceOrigin（store:39–53）；connect每次新token（auth:101–107），logout仍Clear-Cookie（109–113）。不要把原callerOrigin/重复connect/迟到ClearCookie语义开放项画成已解。

2. **029 static install与runner host是两个层次。** factory index:102,174在同auth下仅有pluginInstallHost时mount。`plugin-installations/commands.ts:26–48` 复用registration/version/revision、成功fetch attempt、精确artifact/store/digest；`99–131` preparing提交后才做FS，session丢失保unknown，reconcile须trusted executionSettled。`029:3–30,31–58` 保存immutable来源、状态、receipt、审计；不是把包内容塞PG。`apps/runner/src/plugins/host.ts:64–86` 检查安装receipt/tree/ownership，load前72与invoke前78各重查当前授权；模块顶层本身可执行。`48–61` abort是停止观察，已开始则OUTCOME_UNKNOWN，不证明包停止。**main只有该library入口，未找到生产runner调用invokeInstalledTool；host:3也标future center binding/claim另属后继。** 不把安装成功画成启用、可调用或npm完整生命周期/OS沙箱。

3. **030 grant/progression与031 owner confirmation分工。** factory index:103–104,125–139,167–168执行迁移、挂载并串行调度queue/progression bounded scan，复用原center生命周期。`goal-progression/index.ts:23–28` owner授权/只读/撤销入口；`store.ts:19–22,29–57` 固定project/node/input/previous execution/profile与依赖版本，24h内显式有限授权、configured-readonly；`advance.ts:9–21,23–55` 每扫描<=20，锁后重新评估，调用原executeGoalNode，错误保halt，非无限自主agent loop。`030:1–16,31–52` grant及execution关联不可变。`goal-plan-confirmation/index.ts:18–23` 无runner确认口；store:17–26,29–75在原事务/幂等里核proposal digest+revision，apply graph、define inputs、建立授权及receipt。`031:1–33` 绑定proposal/application/goal/progression。图必须分开read、确认与后续受限推进；不能凭route声称自然语言规划/真实连续provider验收全过。

4. **032 frozen Claude message settings：中心准入与runner请求/观察分开。** factory index:105；`032:36–62` queue字段及task.submission约束、不可变trigger，非另一任务authority。`conversations/message-settings.ts:10–33` 要求精确profile id/runner/digest与已声明tuple；只普通Claude，排fixture/protocol/engineering/steering等，不支持的resume effort省略拒绝。`execution-profiles/store.ts:107–141` 实际task及queue准入调用。`runner/claude.ts:46–53,71–85,113–119,335–339` 真SDK query消费：options模型/thinking/effort/speed与原权限/环境约束并存；`claude-message-settings.ts:6–29` init仅有限observed事实，不推每token实际设置/使用的工具。SDK仍runner package.json:11固定0.3.290。不是任意profile热切换或所有provider通用。

5. **data.history旧不兼容陈述已过时，但inventory尚非完整。** `context-transparency/store.ts:73–85` v2（仅附件和mixed一致）保executionInputDigest，materialRevisionDigest=null，materials=unknown/metadata-unavailable，明确避免knowledge子集冒全量；v1仍knowledge-known。旧“attachment-only min1拒绝待修/mixed未定”应删除。`attachment-history.test.ts:103–140` 有这三种精确行为的源码断言，本次未运行。`routes.ts:8–13` 已挂owner GET，store:104–110仍historical/current与remaining未知。对固定Web仅查contextHistory/ContextHistory/合同名，无直接consumer引用；故可保“历史读口尚无已核Web直接consumer”，**不能再笼统写Web附件未接**（实际附件App接线由root另核）。也不能把v2未知inventory改画成完整附件token计量。

## 精确排除：分支能力不是当前 main

- X01 `37cf1c28d8dd1e45fe1bb3cadda1c6658aac5f56` 非main祖先，main无`apps/server/src/plugin-runtime`/`packages/contracts/src/plugin-runtime.ts`。分支routes:18–23明确仅local注册、先需claim协商/legacy排除/retained；interface:9–18为034 enable/binding/phase authority和runner执行接缝，但生产factory、journal/claim/reconciliation链仍待。main的registry/intake登记不等产品接通。
- S01P07 `83a0799293057f7472f0329c61e566708b2a2381` 非祖先；main无runner-claim公共模块、factory index:195仍旧空body `/api/runner/claim`。分支runtime:70–108已写runnerIdentity、持久同opportunity、status/missing后原key claim与accept，空轮不重写；此与mainruntime blob不同。**图不可先宣布v2丢ACK恢复/空轮0durable写已上线。** 原admission journal/outbox及S01基础并发仍main，不把全部S01画成待实现。
- CHAT05P01 `40af6d9071c621707971fd983a85dd9145f065fd` 非祖先；main没有native-activity-body server/contract，index不migrate033/mount正文reader。分支`native-activity-body/index.ts:7–25`和contract:5–8,35–60是新完整body/chunk能力（8MiB/body、16MiB/attempt、64KiBchunk、页4），本轮owner阶段由root提供SOURCE_APPROVED_PENDING_VALIDATION。**旧CHAT05基础native-activity020已main**：factory index:93,176及native-activity/index.ts:8–22。旧prefix缺失尾部不可因新分支合同称可恢复。

## 五图最小落点与限制

- runtime：center新增会话配置/鉴权，runner Claude新增frozen per-message请求；插件library/current grant与未main runtime binding分开。
- modules：browser-session / static material install / goal progression / confirmation / message-settings各自深接口；原client/Web/TUI由root核，不重复造状态权威。
- data：028身份session、029安装审计、030授权执行关联、031确认receipt、032不可变设置；history v2显式unknown修正。PG连接预算沿原factory pool8，不从迁移数推出更多池或容量。
- state：不改变原task FSM；install unknown、观察abort、session退出/失效均不能画作task cancelled。confirmation/grant不是verification passed。
- dependencies：SDK0.3.290/既有pg/Fastify关系不因032变化；host import执行边界与双重当前授权必须可见，不凭分支代码宣称完整npm启用或隔离。

仅源存在、mount/config条件及静态生命周期可确认。0新tests/HTTP/PG/Chrome/provider/个人部署采样；不重用历史fixture结果证明0da运行，也不把source approval写成用户完整验收。旧aeb图交付历史仍保留，此为合法owner后继策展输入。
