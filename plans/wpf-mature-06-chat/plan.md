# WPF-MATURE-06 完整可靠聊天与执行控制

| 字段 | 内容 |
| --- | --- |
| 大task ID | WPF-MATURE-06 |
| 状态 | in-progress；完整验收未完成 |
| co-lead | Web /root（执行管理 d01_owner） |
| 优先级 | P1 |
| 唯一来源 | 本目录plan/status/review，管理worktree合法claim v3；不另填聚合进度 |
| 用户来源 | [成熟度原话与六项分工](../../docs/evidence/web-platform/mature-task-handoff.md)；原WPF REQ仅追溯，不形成第三层 |
| 收益 | 真实增量聊天、工具与thinking详情、队列/补充指令/取消及恢复形成连续可靠旅程，输入与滚动不被后台更新破坏。 |
| 边界 | 本计划定义完整用户结果；具体实现须独立worktree、fresh精确scope take和固定独审，计划目录领取不授产品写权 |
| 依赖 | STEER01模块已main；STEIRI01十三scope实际App片已main f181/原scope释放，CONTEXTI亦已main并释放；CHAT10 admission/公共client已固定，个人steering仍off。真实provider观察预算须单独明确；voice公开输入依赖待核。 |

## 已有能力与gap

CHAT06I01固定9da已main，官方runtime权威repository避免伪branch；ActivityI ba341懒tool/thinking与offline隔离已交；QUEUE01 pause与cancel分开；READ527保留行动错误和配置详情；通过项仅引用原证据。

已main的STEIRI接线沿原canonical证据；尚缺：端到端真实生效证据、跨reload原key恢复、voice失败退文本、Markdown/代码复制/重连/滚动/IME完整组合验收。

当前子任务唯一来源：[STEER01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-control/plans/wpf-steering-control/status.md)。功能通过不等用户个人runtime已启用；源码main与个人运行产物分开；当前运行版本引用[服务owner最新正式回执](../../docs/evidence/web-platform/mature-task-handoff.md)，旧32c/v9仅历史观察。

## 稳定TODO与完整验收

- [ ] **WPF-MATURE-06-01** 盘点通过项与真实缺口：逐条引用stream/activity/queue/readability固定证据与限制，模块/fixture/真实provider分开，不重复勾整体Done。
- [ ] **WPF-MATURE-06-02** 完成STEER独立控制与接线：admission仅快照非许可，POST重验、原key unknown、receiptRevision更新、received不冒模型遵从；模块和App接线分别验收。
- [ ] **WPF-MATURE-06-03** 验证正文与活动显示：真实增量、settlement retain/replace、typed-final完成状态、provider实际thinking才显示、tool unknown不伪造；Markdown/复制/懒详情。默认正文+简短自然状态，工程ID/计数/原因Details按需；成功回复的Activity succeeded/Open task controls/More actions/Task output/空0 waiting Center queue入口收敛，error/unknown/decision始终直接可见；普通hi、正常stream/tool、queue等待、断线unknown四旅程及390/双pane验收，error/unknown/恢复不能隐藏，系统通知不冒模型回复。 验证呈现区分正文规则、工程检查、独立审查/用户接受；缺source或artifact版本绑定为限定范围/unknown，A失败/B通过不能回写A。GO固定f181源码观察与ENG-001依赖见[研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)，不是新browser复现。
- [ ] **WPF-MATURE-06-04** 完成输入错误与持久恢复：键盘/IME/下一草稿、断线重连、queue/steer/cancel、lostACK原身份恢复；当前跨reload未完成项明确开放；有效登录期内刷新/重开回同中心会话，HTTP+SSE一致认证，错误Bearer不得回退owner，cookie不隔离端口，详见下方与[接口研究](../../docs/evidence/web-platform/mature-task-handoff.md)。
- [ ] **WPF-MATURE-06-05** 控制滚动与语音退路：后台更新不抢用户历史滚动；voice能力显式，不可用/失败可回文本并保草稿，无自动模型调用。
- [ ] **WPF-MATURE-06-06** 完成可靠真实聊天旅程：实际App fixture覆盖失败/恢复/双pane；明确预算后单次真实provider观察，至少两次正文增长才称增量，没有partial如实记录不补query。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

### 语音成功路径与归属（09:09 UTC GO审计）

沿原VOICE TODO：开始→停止→转写到当前pane可编辑草稿→用户明确Send/Queue；切pane、关闭、取消均释放mic，迟到不能污染另pane或新稿。失败退回文本，未经授权不新增付费调用。当前STEER独立模块已审不代表语音成功路径已完成。

### 同一聊天呈现TODO的总体验收补充

GO最新要求（非新增大task）：默认先正文、简短自然状态与需要行动；识别tool标题即可，native ID/Provider observations分页、来源计数/原因统一Details按需。成功回复不应常驻Activity succeeded、Open task controls、More actions、Task output和空0 waiting Center queue多处入口；收敛默认入口，但error/unknown/decision必须直接可见。系统状态与模型正文来源分开，不用模板冒充回复或模型润色；真实error/unknown/未确认取消/queue-steer受理≠生效及恢复动作必须可达。验收普通hi、正常stream/tool、queue等待、断线unknown四旅程，390及双pane不长期被工程说明占据。390截图若侧栏正打开，只能证明该状态，既不能推断手机坏，也不能当侧栏关闭时正文阅读/输入验收；此要求不导致重跑已审RELEASE。本段为原MATURE06呈现验收、MATURE01视觉依赖，不扩大已审VISUAL或STEIRI业务写权。

WPF-MATURE-06-03的事实/呈现边界与四旅程细目见[固定研究](../../docs/evidence/web-platform/mature-theme-presentation-research.md)。[ACTIVITYREAD01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-readability/plans/wpf-activity-readability/status.md)f2bc已审并main f181/原scope释放，仅已展开活动区域；外层queue/stream/react仍后继，不将本片当整条TODO完成。

## 会话刷新恢复补充（GO经root，2026-10-06 10:24:48 UTC）

归原WPF-MATURE-06-04，不新task：明确浏览器登录有效期内刷新/重开应回同中心/会话，避免反复复制owner token。GO只读Connect页面/README，未reload/登录/发送，不推断断开原因。候选中心可撤销有限期HttpOnly session，token不入localStorage/URL；须中心owner精确接口与独立claim后实施。验退出/撤销/过期/重启、多tab/切中心；退出停止观察不cancel，unknown发送不自动重投。同源自托管优先，跨origin/127.0.0.1多端口边界单列，cookie须Origin/CSRF防护不只SameSite。此为结果/责任/验收研究，未实现/未授权改auth。
