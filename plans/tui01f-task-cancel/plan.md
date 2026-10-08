# TUI01F — 聊天任务显式取消与接续

状态：completed（仅本TUI01F计划的限定验收）；创建：2026-10-06 15:47 UTC；最近更新：2026-10-08T02:57:06.693Z。所属大task [TUI-001](../../../tui-client/plans/tui01-terminal-client/plan.md)，原 TODO06/08；co-lead Execution Lead。

## 小交付与 Interface

在既有聊天终端增加 `/cancel <displayed-task-id>`，typed command 为 `{type:'cancel',taskId}`；任务须来自当前可见、已观察的会话执行，不能猜最新目标。复用已有 FlowClient.cancel、单 durable intent/controller、private journal。先保存原 task/key/空 body，未知 ACK 只用显式 /recover 原请求核对。返回受理不等于 runner 停止，uncertain 不变 cancelled；Ctrl-C/quit/disconnect 不提交取消。不增加中心协议或 attempt CAS、不读取 task prompt、不复制 Web 私有状态、不造第二 FSM。

新增小 Module 是 task-control 的意图 schema/回执校验/端口；宿主 controller 仍拥有观察、草稿、连接 epoch 和唯一未决命令。候选可选 `taskControl: Pick<FlowClient,'cancel'>`，未注入显式 unsupported，中心拒绝不自动改目标重投。旧 create/send/queue journal 格式逐字兼容。统一遵循[模块化规则](../../AGENTS.md#modular-design)。

## TODO

- [x] TUI01F-01：固定源码 Interface、取消意图与终端入口，保留旧规则。
- [x] TUI01F-02：新增公开 controller 定向行为用例，明确实际执行状态。
- [x] TUI01F-03：资源/依赖具备后，真实 HTTP 与专用 PG 丢 ACK/恢复旅程及实际 PTY 验证。
- [x] TUI01F-04：固定af51/d629/ec30实际 App ↔ TUI 同会话交替，CAS拒绝保草稿与观察接续；限定独审/main已收，19alias准入遗漏不追认满足。见[验收回执](../../docs/evidence/tui01f/web-handoff/r4-final-receipt.json)。

最初阶段只授权 source/合同/用例准备；后续已获得文末所列独立运行窗口。仍禁止安装/复制依赖/full build/未授权PG/browser/provider；不借 moving main 运行，也不把 NOT_RUN 写成 red/green。A-E 已有检查作为历史输入，不重复全集。源码用例覆盖缺端口/错误目标/回执身份/原 key 重报/退出/旧 journal；03/04 待 fresh 资源窗口。有限实际 source-only 闭包见 design-input.json，runner/center 未物化，不偷用最新树。

## 验收边界

取消 API 仅 task ID+key、空请求体；没有 task-attempt CAS。原 send/queue 命令验证第二客户端引起的 revision 409：原文草稿保留、只观察、不自动换 revision 重发。JSONL 是 shared controller 消费者，非 PTY；PTY 输出与 raw-mode/resize 是终端证据，非实际浏览器。App 需固定真实构建产物/源+同后台 tuple，不能用壳页或 API 请求替代可见交互。机械 fixture 不证明所有 native/A2A cancellation，也不计 provider 验收。

源码准备已固定 `044ab84db42606fb1757903258078e3dfbab9545`，8 个公开边界用例仅源码未执行；NOT_RUN。不以源审推进 03/04 完成。

2026-10-06 16:03 UTC：追加已授权局部运行，35+1 分轮全绿（36 distinct），focused noEmit0。依赖视图由 Lead 受控创建，0安装/PG/HTTPserver/PTY/browser/provider。原 source-only NOT_RUN 说明为历史；03/04 仍开放。

2026-10-06 16:13 UTC：controller+静态Ink接线限定 APPROVED，main `83f535b54f2390a729f02bc818e07ba684d94ccb` 接收9源零差。本片段delivered不等完整TUI；03/04未勾选，下一最小source闭包见 [followup](../../docs/evidence/tui01f/followup-acceptance.md)。仍保留原claim，无新运行/产品写入。

2026-10-06 16:23 UTC：同claim实施03测试harness源码；仅fixture.ts、journey.test.ts、cancel_driver.py。最多一个随机库/一个中心与runner/A-B-C三个轮次，两项显式cancel及A原key重报。完整checkpoint成功先于DROP/rm，整个owned PGID停止未确认则保留。尚未运行，04 App driver本轮不创建。

2026-10-06 16:33 UTC：03固定da673获得SOURCE_PRECHECK_NO_P1_P2，仅源码；运行仍NOT_RUN，03/04未勾选。原a1f限定controller/static Ink批准与main83f保留。

2026-10-06 16:45 UTC：TUI01F-03已执行有界focused类型检查，修正fixture宿主身份字段；实际两场景PG/PTY仍NOT_RUN，保留03 in-progress/04 pending。见[类型检查证据](../../docs/evidence/tui01f/journey-static-validation.md)。

2026-10-06 16:49 UTC：静态增量40508f已SCOPED_APPROVED；真实03/04不因源码/类型通过完成。仅列运行依赖视图提议，交Lead按后续窗口建立，未安装或运行。

2026-10-06 17:02 UTC：运行links由Lead完成，固定实际factory/PTY入口文件已核齐；本轮只metadata，后续唯一命令/2选择及unknown保留边界见[journey-runtime-entry](../../docs/evidence/tui01f/journey-runtime-entry.md)。03/04尚未执行/完成；等待另定串行窗口，原建议32MiB不冒实测峰值。

2026-10-06 17:17 UTC：03首次真实2场景行为通过，但afterAll连接检查unknown导致suite失败，未完成03。原DB/tmp和checkpoint保留；[窗口结果](../../docs/evidence/tui01f/journey-1714/README.md)。未自动重试/清理，04浏览器仍open。

2026-10-06 17:29 UTC：原claim内收尾修复仅test-only：≤3s连接观察、初始dev/ino和checkpoint门槛。10新定向检查/types0；未重跑原两行为或36，原suite exit1/旧tmp KEEP保留，03/04继续open。独立审查后再决定必要PG cleanup-only。

2026-10-06 17:43 UTC：独立cleanup-only actual1/1、源f4批准/新证据待审。历史2行为suite exit1不改、旧tmp KEEP；03暂保持开放直到独审收口，04未实现。另原claim v2增旧TUI journey.test.ts用于新profile union直接消费者兼容，仅focused types0，无旧旅程重跑。

2026-10-06 17:48 UTC：两test-only增量获独立APPROVED，legacy profile兼容与单PG收尾分开绑定；保持原whole-suite exit1/旧tmpKEEP，不称旧suite重跑通过。待main接收收口，完整04实际App交替仍open。本轮仅metadata，无新增运行。

2026-10-06 17:57 UTC：03已审组合经受控集成进入main8d84；原两行为suite exit1未被改写，独立cleanup-only1/1足够闭合已定位收尾边界，旧tmp仍KEEP。04仍open，仅形成[一条真实双界面候选](../../docs/evidence/tui01f/web-handoff-preparation.md)，无产品/driver新增、无运行授权。

2026-10-06 20:06:45 UTC：原04明确获实施授权，由native_center_owner合法接收v4；按[固定Interface](../../docs/evidence/tui01f/web-handoff/interface.md)实现测试driver。源码/便宜纯检查可推进；完整PG/Chrome旅程等待另行窗口，0provider。旧默认recipe与所有历史证据保持。

2026-10-06 20:24:06 UTC：04四源准备target `d147a636f9cb54a8c87a89a89963d13e937cee9c`，原同一TODO进入独审；4纯检查/两focused types通过，完整双界面旅程NOT_RUN。固定Interface采用90s行为+60s收尾/150s独立总监督，原03证据和open TODO保持。

2026-10-07T23:59:03.635522+00:00：TUI01F-04恢复准备已固定薄OPS14启动入口；原c612实验/fixture与af51/d629/ec30实际组合保持。新5不同纯入口例与实际受限import不替代真实PTY/Chrome；实际运行仍待独审与新窗口。完整04继续开放，原失败/KEEP不回填。见[本次Interface](../../docs/evidence/tui01f/web-handoff/r2-interface.md)。

2026-10-08T02:57:06.693Z：四项TUI01F TODO按各自原证据完成。R4真实1/1与精确RETURN获独立限定批准并main eb06d5323接收，唯一[验收与父任务交接](../../docs/evidence/tui01f/web-handoff/r4-final-receipt.json)引用原件，不复制raw。缺失19alias准入观察仍NOT_RETROSPECTIVELY_SATISFIED，采样非峰值/两个负样本、旧FAIL/KEEP和runtimeFinalization未插桩保留；不代表current779/native/provider或完整TUI-001日用验收。后继准入方法只登记既有缺口，不开R5；本片停写。
