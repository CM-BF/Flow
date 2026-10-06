# Claude逐消息设置：Lead交接请求

2026-10-06 15:16:38 UTC；parent WPF-MATURE-02，co-lead mika。GO已将Claude产品线提为当前优先；本页为待协调输入，不是生产scope领取或能力交付。父状态唯一来源：[status](../../../plans/wpf-mature-02-harness-capabilities/status.md)。

## 先交付的用户能力

同Claude会话可为下一条选择实际支持的model、thinking或effort、fast；requested/observed/unsupported分开。运行中的A、已排队B、后改的草稿C各自保留配置，历史可读可续。Web/TUI消费同一中心合同，不让Codex资格或Node诊断成为Claude产品线前置。首段固定SDK0.3.290声明、注入SDK及真实中心验证，0付费/新安装；不把注入验证称真实账户效果。

## 两层直接子任务

| 父计划稳定TODO | 子任务范围与owner | 独立目录/分支 | 当前门禁 |
| --- | --- | --- | --- |
| WPF-MATURE-02-10 | 产品core：共享契约、中心事务冻结、既有Claude adapter/query传递；拟owner status_read，co-lead mika | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core`；`codex/claude-message-settings-core` | Lead source-only provision、固定基线/精确scope、原子take后写 |
| WPF-MATURE-02-11 | 共享consumer：F01 client/interaction与Web/TUI下一草稿控件、intent冻结及历史snapshot；owner待Lead分配 | 独立WT/branch待精确scope；不与core或诊断树共写 | 先固定core兼容合同，再按最小vertical领取 |

core的管理目录必须是 sibling `plans/wpf-mature-02-message-settings-core` 与 `docs/evidence/wpf-mature-02-message-settings-core`，避开本parent证据目录领取范围。当前不创建它们、不新建full checkout、不改shared Git/sparse；低磁盘source-only provision由Lead唯一协调。consumer管理路径由最终派工确定，仍归本大task，不另造第三层任务。

## 请求Lead固定的输入

1. **R05/profile兼容。** 每runner唯一不可变profile、同session原runner约束不改；不能每条重发profile或给legacy canonical JSON补键破digest。send/enqueue在既有CAS/幂等事务冻结版本化message settings，promotion仅消费该snapshot。
2. **版本协商/共享消费者。** 现client/Web ACK要求perTurnModel/Thinking=false与thinking.disabled；需先冻结兼容envelope/版本协商，不能整体改true。F01 v40持client index/ACK/contracts index；Web RECOVERY01 v4持相关路径，由Lead协调唯一writer及交接。core只先领取最小必要literal，不一次占全部目录。
3. **数据库。** 若需窄immutable message snapshot migration，唯一编号/SQL owner与挂载由Lead分配，030已O14；不自行占号。PG/HTTP验证仅资源fresh达标后运行。
4. **四个现有02路径。** 本owner明确可在完整scope决策后停写并原子部分移交；目前仅记录可移交，claim v5保留、不先amend。精确路径如下；store.ts已交回，不属于本次可移交承诺。

- `packages/contracts/src/execution-profiles.ts`
- `packages/contracts/src/execution-profiles.test.ts`
- `apps/server/src/execution-profiles/index.ts`
- `apps/server/src/execution-profiles/native-catalog.test.ts`

正式顺序：root固定完整core scope/源基线 → 本owner明确停写上述实际需要路径 → fresh当前version amend移除 → 新owner take成功 → core开工。不得先释放全部02 claim，也不得在移交后恢复写入。本诊断WT只父管理与已领取实验，绝不并行改Claude产品。

## 已有只读输入与最小验收

status_read输入固定main `cbd3dd95754be96bf7eeed534fb4c7fcce8a16a8`；相关源自56d90未变。固定SDK0.3.290 `sdk.d.ts` SHA `193becad9d69bc4d2ccd22def53fb9bff9e2628e324f7657d9497da9476af541`：thinking/effort、Settings.fastMode/fastModePerSessionOptIn、init观测字段存在；未知组合unsupported，init缺/null保持unknown。fast不得暗换model、继承全局或暗示免费；不把当前上游新thinking枚举塞进固定SDK。目录声明、请求选择、SDK实际观测及账户效果分层。

core：注入query核精确options、legacy/resume、unsupported在调用前拒绝；真实PG/HTTP核A/B/C冻结、同key、CAS、回滚。consumer：同DTO贯穿Web/TUI，未知ACK保留原key/body/settings；历史snapshot不被草稿变更重写。不会为低资源跳过必要资源/事务验证，当前小metadata可做，PG/build/实际运行未满足fresh门槛则PENDING_RESOURCE。

## 诊断与方法边界

OpenSSL候选 `ca6a7a15f76d333f20caf0690ed85b76e29d2c54` 保持PENDING_RESOURCE/NOT_OPEN，不扩大诊断。Flow Node宿主、Node synthetic canary、真实固定Codex native binary三角色分开；Node失败不证明Codex失败，Codex自身启动/权限/模型/停止验收仍开放，完整02目标不减。

15:16:38安全点复核本地 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`/Users/citrine/.agents/skills/clean-code/SKILL.md`，安装来源沿固定sickn33@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重装。按clean-code检查命名/单一owner/共享合同与consumer分责、错误与unknown语义，避免双profile/重复状态机；本轮仅管理文档，未跑工程测试。
