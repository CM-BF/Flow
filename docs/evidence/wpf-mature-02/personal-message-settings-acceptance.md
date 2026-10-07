# 个人安装逐消息设置：TODO08/11 验收补充

2026-10-07T13:00:23.336Z fresh 领取观察：父树 HEAD `07341d4672fb3c83090e685847818b47c34f2559`，branch `codex/claude-codex-capabilities`，clean=origin；账本 readId `eed9166d-c355-4d00-854e-4675ebda6e09` 确认 claim `0dd97484-f0ce-4738-8075-505bd5e2541a` v6 ACTIVE，mika/chatui01_owner、同树同分支、matchesSource=true，范围仅父 docs/实验/plan。此片只更新父计划与证据，不恢复已交回 CORE/SVC09/R06 产品写权。

## 当前差距与唯一下一交付

固定 main `7524a7fa6768ace7e284fc80d7cc25c1407ec2a9` 的 `tools/personal-preview/preview.mjs:26` 中 NATIVE_CONFIGURATION 不含 turnSettings；同文件188/254对已存配置严格比较。UI 与后台已部署不能证明个人安装已启用逐消息设置；直接改个人 claude.json 会破坏现有启动契约，不是激活方案。本轮未读取任何个人配置/凭据，实际个人 readiness、账号可用性与部署时间均 UNKNOWN。

下一交付是：用户在其个人安装中，通过真实 Web/TUI 为下一条 Claude 消息选择目录允许的设置，提交后能读回该条冻结的 requested 与实际 observed/unsupported/unknown；历史及原会话继续可用。先完成零模型配置、发布 ACK 与目录验证，不等待 Codex writer 资格，也不以它们代替后续实际 provider 证据。

## 最小生命周期与验收

复用 CORE/SVC09 的 profile、私有配置、身份与启停机制，用一个小 Module 管理固定 legacy 槽与可选 settings 槽。保持旧 runner/token/manifest/workdir/session 原样续接；新能力使用新的 immutable profile/runner，不就地改旧 digest，不创建通用 runner pool、第二队列或新大task。

1. 缺省仍只启动 legacy；启用 settings 时，新 header 的目录读取必须精确匹配新 runnerId/profile/configDigest 与有限 choices，错 ACK、错身份、缺项、unsupported 不得标 ready。account availability 单独保持 unknown，目录不是 entitlement。
2. 两槽的 start/status/stop/maintenance 全部由同一既有宿主管理；明确每槽 PID/身份/状态，任何一槽未 drain/close 不可 refresh 或替换配置。停止未知保留原身份，不自行换目录/runner 绕过。
3. 激活前核 mixed queue 的资格：固定 `apps/server/src/runners.ts:64–88` 的无 pin 旧任务可满足 harness 领取条件，而 opt-in adapter 可能事后 guard 拒绝。必须以现有领取机制隔离旧任务与新设置任务；若需资格 SQL delta，过滤必须在 LIMIT 前并由合法 owner 实施。guard 拒绝不能当混合队列兼容通过。
4. 真实 Web 与 TUI 均能列出该个人安装的新 profile/choices，选择下一草稿 model/thinking或effort/fast，提交同条 settings snapshot；新会话、同 harness 空闲会话后续 turn、排队项各自冻结，不改历史/正在执行项。unsupported 禁选/明示，requested 与 observed 不相互伪造；unknown ACK 保原 key/body/intent，不能自动重提新任务。
5. 旧 runner 上既有 session 继续原身份续接。需要新 runner 的 profile 不隐式迁移旧 session；产品明确保持旧会话或创建新会话的边界，不能为启用设置破坏原 pin。取消、停止与维护覆盖两槽，错误身份/混合队列/未完全关闭均有直接反例。
6. 零模型 config→publication→catalog→Web/TUI 可达证据与真实 provider 后验分开记录。后验另给小费用/时间/输出预算，核 requested/observed/unsupported/unknown、真实账号可用性；没有额度不启动模型，不借用已消费 R02/O16 或 Codex 目录窗口。

## 交权与时序

本补充由 Mika 本轮明确交付要求及其转交 architecture_read 两槽建议收敛；向原作者直接取结论一次遭 threadlimit，未重试/新建任务。可审方向写入原 TODO08/11，不冒称作者已批准实现。Original Lead 新 take 共享配置后才实施；原 SVC06 维护已于 2026-10-07T13:48:49.000Z RETURN（Mika 转交 Original 事实），不再等待该收尾；个人激活仍须另安排真实窗口，不重放旧维护。Web/TUI 仍归原 owner。本父只维护验收与依赖，子进度读取各自 status，不复制第二状态库。

## 本片质量与证据边界

本地 find-skills 已匹配 codebase-design/clean-code，沿 `quality.json` 固定 sickn33@bdacd76 来源，无安装。检查单一生命周期 owner、小 Interface、默认兼容、错误/unknown、资格过滤与有限 choices；只读当前 main 的配置和领取源码。0工程检查/PG/browser/provider/服务/私有配置读取。目录9b9c的6个模型与已收 C02 API/流片仍按原固定证据解释；此文不证明个人激活、实际模型资格或完整 WPF-MATURE-02 完成。架构影响为 planned 两槽组合，待合法产品 owner 的固定实现后由 Lead 更新基线。

## 当前依赖更新

2026-10-07T14:20:38.000Z：CORE 领取资格增量已由 main `677a93e96f228ab76edbdde9e22beb800a320156` [正式接收](/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/i02/core-claim-intake.json)，5 rows / 52,071B 已逐固定 main blob 核符；原 5 PG / 67 HTTP 与 13:59:19.000Z 独审继承，集成直接 10/10 与 types0 只消费原收据，未重跑。当前 [CORE 唯一 status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-settings-claim-eligibility/plans/wpf-mature-02-message-settings-core/status.md) 归 architecture_read；registry 204 来源迁移已接收，actual reload UNKNOWN（收据 NOT_YET），不再等待主线或 D05 登记。历史 ea276 / main8d84 与 handoff 保留。

SVC09A 当前路由为 native_center_owner / `codex/personal-message-settings`，唯一 [两槽宿主 status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/plans/svc09-message-settings-activation/status.md)，已登记 claim8f4071a0 v2。只链接其权威来源，不复制子进度；该树有后续 dirty，旧 status 的 NOT_RUN 不作为当前检查结论，未读取 local 产物。个人设置仍 PERSONAL_SETTINGS_NOT_ACTIVATED；TODO08/11、目录/跨端及独立 provider 后验未完成。

上述第3项 mixed queue 资格已在主线，但个人安装与跨端组合仍须实测；源码与已有专库证据不能代替部署/真实账号/模型观察。14:03 的 READY/NOT_INTEGRATED 观察保留在父 status 历史节与旧 Git，本段不改写历史原件。
