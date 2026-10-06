# WPF-RECOVERY01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06T17:43:28.863916+00:00 |
| 所属大task | [WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md) |
| co-lead | Web /root（执行管理 d01_owner） |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery |
| Branch | codex/web-conversation-recovery |
| 工作基线 / HEAD | base84005a260dfcb668cd38b09c21564d0754a0f513；最新browser窄修checkpoint 667889058d3decc0abc9f635a37fd0f05f2c090c，fixture=768/17其他源=1b8；当前metadata HEAD以Git为准 |
| 工作树dirty状态 | 两harness源码已固定、仅own metadata收口；正常push后核local=origin/clean；17其他源保持1b8 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 768 ACK task身份P2已源码修正，公共decoder校验原请求与嵌套task.id；固定候选待窄审/尚未运行 |
| 下一可用交付 | 刷新后保留原草稿与未决发送身份，重新连接后由用户明确恢复 |
| 当前阻塞 | ACTIVE: 真实浏览器与完整构建仍等待运行资源和中心会话语义核验；本段定向检查已完成 |
| 需用户决定 | NONE |
| 检查状态 | 历史1b8受控direct27/27 PASS（execution0eef，2.034s）；累计direct4.574/30s。新fixture delta仅静态diffcheck0，types/direct/browser NOT_RUN；types累计52.814/60s未新增 |
| 实现目标 | UNKNOWN |
| 实现范围 | apps/web/src/App.tsx, apps/web/src/attachments/controller.ts, apps/web/src/connection/session.ts, apps/web/src/conversation-context/controller.ts, apps/web/src/conversation-steering/SteeringControl.tsx, apps/web/src/conversation-steering/control.ts, apps/web/src/conversations/ConversationThread.tsx, apps/web/src/conversations/outbox.ts, apps/web/src/conversations/projection.ts, apps/web/src/conversations/queue/commands.ts, apps/web/src/plugin-integration/attachments.tsx, apps/web/src/plugin-integration/knowledge.tsx, apps/web/src/plugin-integration/session.ts, apps/web/src/plugin-integration/steering.tsx, apps/web/src/recovery/binding.tsx, apps/web/src/recovery/journal.ts, apps/web/test/conversation-recovery.browser.ts, apps/web/test/conversation-recovery.fixture.ts, apps/web/test/conversation-recovery.test.ts |
| 已集成main状态 / HEAD | 本片正在实现/未集成；输入main 84005a260dfcb668cd38b09c21564d0754a0f513 |
| Review | [review.md](review.md)，NOT_STARTED |
| 领取 | 6ff988b2-c8cc-4c05-ae12-b3d7af87f2ab v4 active，仅原21scope；14:05:53.395Z正式收窄回执已核字段归档，所有ignored依赖只读 |
| 架构影响 | 新ConnectionSession/Journal与P01私有binding沿原controllers接管；固定实现后交D06后继更新队列，不改图 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-RECOVERY01-01 | in-progress | workspace_panels_owner | [live领取](../../docs/evidence/wpf-conversation-recovery/live-claim.json)，输入/容量研究已读，ConnectionSession/Journal第一段源码与types检查已落 |
| WPF-RECOVERY01-02 | in-progress | workspace_panels_owner | 原Outbox/Queue/Steer同步receipt后检查点屏障已接源码；行为待测 |
| WPF-RECOVERY01-03 | in-progress | workspace_panels_owner | P01实际sidebar.footer、cookie连接与完整稿/原controller恢复已有接线；完整Webtypes0，行为尚未完成 |
| WPF-RECOVERY01-04 | in-progress | workspace_panels_owner | [当前27 direct](../../docs/evidence/wpf-conversation-recovery/direct-second.json)通过，源绑定1b8；受控IDB/mock fetch，不冒真实浏览器或完整controller矩阵 |
| WPF-RECOVERY01-05 | blocked | workspace_panels_owner | 资源与中心语义验收门槛未满足 |
| WPF-RECOVERY01-06 | pending | workspace_panels_owner | 1b8 M1/M2独立源码addressed；完整feature独审NOT_STARTED/main未完成 |

## 阻塞 / 风险 / 未验证

pre-provision可用1,584,984,064B，建树后管理报告1,416,241,152B，非当前fresh资源测量。禁止目前install/build/PG/Chrome。中心三语义不阻首代码，但最终cookie/SSE旅程仍需核。旧upload journal跨tabCAS与历史metadata隔离开放，不冒本片修复。

## 下一步与handoff

已在App接cookie观察器/P01入口，当前fixture修复源码冻结待窄审；1b8单次27 direct已完成，下一步真实浏览器旅程须新HEAD/19hash门槛与中心语义证据，不自行续跑；不得孤立journal交付。完整feature目标仍UNKNOWN、review NOT_STARTED；2498仅阶段binding源码结论。唯一status由本owner维护。

## Dashboard同步

登记已闭合：管理固定main d679444c4bed52bbd53d38f4944f914b30fbbd92核registry指向本唯一canonical；Lead 2026-10-06 14:51:18Z实际观察161 sources，本任务live/parser0/human完整。[原归因观察](../../docs/evidence/wpf-conversation-recovery/registry-deployment-observation.json)已原样保存；这不是本owner新API采样。dcaf SOURCE_READY为历史请求，不冒后续源码已验。

## 本段轻量检查 / 资源

两次合法依赖link+types窗口各5.272s/5.969s，0install/build/Vitest/PG/Chrome/provider。首types失败含2处新代码问题（已修）及缺传递声明；第二完整Webtypes exit0，仅当前部分源码。原日志与源hash保留；不称完整功能验证。41+11逐包links全部指获准第三方真实包或本树@flow源码，其他树0写。第二结束可用1,207,238,656B，属全卷观察，不归因链接分配。现所有依赖路径停写，继续原21轻量源码。

## 14:23 UTC 源码安全点

原5项root预审和3项peer预审按来源记于quality，均只读早期检查，不是正式approval。App接线及修正尚dirty；最新获准noEmit检查6.191s/exit2/862B原日志保留，两个窄化已源码修正。累计三轮types17.432s，后续获准总60s/单次15s/日志512KiB，尚无Vitest/HTTP/PG/Chrome。已加入同事务仅改动record写入，非实测性能收益。

## 14:33 UTC 固定源码检查点

八项早期修正的代码映射见[checkpoint review map](../../docs/evidence/wpf-conversation-recovery/checkpoint-review-map.md)。这是待行为验证的阶段检查点，不是交付target，review仍NOT_STARTED。新增直接test使用受控IDB事件端口，不冒真实浏览器IDB；真实cookie/CSRF/SSE/跨重开旅程尚未写完或运行。完整Webtypes两次修后绿分别5.663s与5.616s，累计28.711s、余31.289s；原红不改。所有ignored依赖只读，0安装/build/测试服务。

## 后续固定点 / 行为前置

f13两P1、同key终态对账、迟到CAS与failed-open修复映射已更新。实际App fixture/browser已写但0运行；直接检查已获单文件/30秒累计/至少5秒cleanup许可，先等X01真实结束与管理fresh窗口，不启动重叠负载。全类型累计40.603秒、余19.397秒，当前修复类型通过不冒行为批准。

## 15:06 UTC 单文件基线与后继修复

[首direct原报告](../../docs/evidence/wpf-conversation-recovery/direct-first.json)固定4ba，20/20 PASS，runner2.540s/cleanup fulfilled/tmp9227B，全部mockIDB/mockfetch；不覆盖后继R4。已修auth-null期间成功commit版本记账、明确Restore同key终态后解除该receipt blocker并保存deferred下一稿。新22case目标待fresh运行，原4ba日志不改。新增真实App fixture/browser仍0执行，中心/IDB跨重开语义不由直接检查代替。

## 15:11 UTC 未来浏览器验证入口修复

Root只读[2498预检](../../docs/evidence/wpf-conversation-recovery/2498-browser-preflight-review.json)发现RB1父监督/硬截止、RB2未知CREATE清理、RB3缓存与递归证据计量、RB4材料和page-only auth-loss覆盖缺口。没有运行造成的泄漏或数据丢失复现。现6ff v4 active/21scope已本人live核；先source-only修两脚本。4ba20/20不覆盖新增2case；第二direct剩27.460s，本段0types/PG/Chrome/HTTP/Vite import/install，空间不足不轮询准入。

## 15:17 UTC source-only harness安全点

RB1–3已源码修正：父监督持有两进程组和DB lease，硬截止/清理未确认阻止重跑；未知CREATE不凭随机名删除，非空remaining必报错；cache独立scratch/native配置加载、递归计量与live监测写入未来入口。RB4新增实际UI文件引用+丢ACK原body以及无reload的IDB写入abort/auth-loss旅程，但全部NOT_RUN。[覆盖矩阵与运行门禁](../../docs/evidence/wpf-conversation-recovery/browser-harness.md)。本段0types/测试/产品import/HTTP/PG/Chrome，types余7.186s、direct余27.460s；17其他源码及22case对2498零改。待新fixed后，旧2498 direct预检manifest须重绑，不可直接运行。

固定harness提交：`724424237962ed8563db08f5ea8597ee6e7eb11d`；完整feature implementation target仍UNKNOWN，等待必要实际行为和终审。本段只静态diffcheck0，未运行新类型/22case/浏览器；源清单见[harness checkpoint](../../docs/evidence/wpf-conversation-recovery/harness-source-checkpoint.json)。

## 15:28 UTC — 7244 worker预检修复启动

[W01固定报告](../../docs/evidence/wpf-conversation-recovery/7244-worker-report.md)由root复核：恢复附件验证为ready后，Input变化未触发稳定runtime的composer同步；原materialDraft局部断言只看Files行。先修原Thread同步生命周期并核实际composer chip，保首POST精确ref，禁止重新Use或remount掩盖。SSE断言只标cookie握手、键盘只标实际覆盖。管理15:26:53.773Z fresh v4/21scope/无冲突回执已本人核字段归档。本段0types/import/tests/HTTP/PG/Chrome/空间采样，RELEASE为唯一运行owner；剩type7.186s/direct27.460s不变。

## 15:34 UTC — 材料同步源码安全点

7244 peer P2已按源码修正，未运行：稳定准备watcher与ready同步分离，原binding按身份/held/租期排除旧材料；新增2个controlled-composer case（当前24待测），browser改核实际chip/name、保首POST原ref，SSE仅握手、Enter/Escape实际范围。[源码manifest](../../docs/evidence/wpf-conversation-recovery/chip-sync-checkpoint.json)。本段2生产+2专测变化，其余15源对7244相同。整体targetUNKNOWN/reviewNOT_STARTED；原raw/7244保留，types与direct余量不变，暂无运行门槛。

本段固定source checkpoint：`02d5a49aa2f17261d7dfcc9590f433c84b10defe`，非feature交付target；24case与当前types/browser未运行。等待局部源码审，源停写。

## 15:42 UTC — 02d 材料完整性审查修复启动

Root固定[02d报告](../../docs/evidence/wpf-conversation-recovery/02d-material-review.json)发现P1零chip可漏选中材料、P2先B后A验证可反转发送顺序，均为源码可达路径而非新运行复现。15:40:37.800Z管理fresh原21/v4/唯一writer无冲突[观察](../../docs/evidence/wpf-conversation-recovery/02d-material-claim.json)已核。先在原binding统一检查完整选择，再让Thread所有Send/Queue经过执行门禁；不以禁用按钮代替。原02d与raw保留，0types/tests/PG/Chrome/import/free，预算不变。

## 15:46 UTC — 材料完整性固定源码安全点

固定source `1b8a335ecf26ece7539ad19e634508ac12ca3729`，5源变化（Thread/binding/direct/browser/fixture），其余14源对02d相同，[19源manifest](../../docs/evidence/wpf-conversation-recovery/material-integrity-checkpoint.json)。P1/M1完整Input与composer有序交接在Send/Queue执行前校验，P2/M2分批验证不跳过未ready前项；held/inTransit/consumed旧材料与下一稿分离。当前27case及双文件实际App旅程均NOT_RUN，0额外types或空间采样。只静态diffcheck0；完整feature target UNKNOWN/review NOT_STARTED。源冻结待root窄审，metadata正常push后以local/origin及clean事实核。

## 2026-10-06 15:55 UTC — 1b8 材料修复独立源码复核归档

Root于2026-10-06T15:52:25.524058Z对固定 `1b8a335ecf26ece7539ad19e634508ac12ca3729` 确认M1/M2 SOURCE_ADDRESSED；[root原报告](../../docs/evidence/wpf-conversation-recovery/1b8-material-root-review.json)与[W01原报告](../../docs/evidence/wpf-conversation-recovery/1b8-material-peer-review/report.md)原样归档。无新增局部blocking，但不代表完整feature批准或行为通过。当前27 direct/types/browser仍NOT_RUN，完整target UNKNOWN/review NOT_STARTED。

本人15:54:29.253Z通过既有协调CLI [fresh窄账本](../../docs/evidence/wpf-conversation-recovery/1b8-material-review-claim.json)核6ff v4 active/原21/本人WT与branch/overlap=[]；不是产品PG实验。全部19源码hash仍等固定manifest，本次0产品改动、0types/tests/PG/Chrome/import/资源采样。仅metadata normal push后核local=origin/clean；未生成运行gate、未释放claim。

## 2026-10-06 16:23 UTC — 单次27 direct完成（非完整feature验收）

管理[单次准入原回执](../../docs/evidence/wpf-conversation-recovery/direct-second-admission.json)于16:21:36.564Z核6ff v4/原21/唯一writer/无overlap，execution HEAD `0eef4cda8813afe336df8dc88256da28e206c0d4` clean，19源逐项等固定 `1b8a335ecf26ece7539ad19e634508ac12ca3729`。实际16:21:52.720658Z启动，16:21:54.776950Z结束；[原日志](../../docs/evidence/wpf-conversation-recovery/direct-second.log)为27/27 PASS，Vitest4.0.18测试245ms/总1.55s，supervisor含清理2.034s。

清理fulfilled/errors=[]，实际0.001s、事先预留5s；只本进程组和本tmp cache。500ms样本tmp最大2,766,490B（不是硬峰值上界），清理前瞬时23,910B，日志330B；两值口径不同。累计direct4.574/30s，余25.426s仅预算算术、无自动续跑许可。[manifest](../../docs/evidence/wpf-conversation-recovery/direct-second-manifest.json)保原始gate/config/sandbox/runner与19hash。没有PG、真实HTTP、Chrome、types、install/build或provider；受控IDB/mock fetch不代替真实cookie/CSRF/SSE/刷新/磁盘耐久。

本次只改own metadata，19源不变；完整feature targetUNKNOWN/reviewNOT_STARTED、真实browser及当前types仍NOT_RUN，原历史失败和20case报告不改。源码继续冻结，正常push后核local=origin/clean。

Root于16:23:29.859009Z对本次原raw/source绑定独立核验，限定[证据接受](../../docs/evidence/wpf-conversation-recovery/direct-second-root-review.json)；没有独立重跑或完整feature批准。

## 2026-10-06 17:09 UTC — fixture代理source-only修复启动

管理[17:09:07.111Z窄观察](../../docs/evidence/wpf-conversation-recovery/native-proxy-claim.json)已本人核原21/v4/本owner/WT/branch/无overlap。Root认可[固定1b8 readiness报告](../../docs/evidence/wpf-conversation-recovery/native-proxy-readiness.md)指出Node fetch传输不能保持公共Host，与fixture的public cookieOrigin及独立center端口不符；这是源码/已固定Node行为推断，不是本次浏览器实测。仅原fixture改native HTTP传输，保caller headers、SSE/abort、逐条Set-Cookie和错误清理；中心协议不改。0runtime/import/types/PG/Chrome/free，原1b8 direct27结果与所有raw保持。

## 2026-10-06T17:14:15.495150+00:00 — native HTTP fixture固定源码安全点

固定 `ec91d1113898e70f380f9bb503f3b5ceff9467b2`，只有原fixture传输修改，[19源manifest](../../docs/evidence/wpf-conversation-recovery/native-proxy-checkpoint.json)逐项核current=fixed、其余18源=1b8。原生HTTP连接owned center端口但保浏览器Host/raw caller headers，不合并Set-Cookie、不合成Origin；请求体原字节/Content-Length，响应直接pipe保SSE backpressure，浏览器close/父abort/错误销毁owned upstream，故意丢ACK先drain后断响应。全部为源码实现，NOT_RUN。旧27direct/raw不变、完整feature target UNKNOWN/review NOT_STARTED；本次0类型/运行/空间采样，剩预算未消费。

## 2026-10-06 17:28 UTC — body-loss / PG关闭source-only修复启动

本人核[管理fresh观察](../../docs/evidence/wpf-conversation-recovery/bodyloss-claim.json)：6ff v4原21/本owner/WT/branch/无overlap，02398a clean，apps/web等ec91。preheaders destroy有透明重试风险；本树pg8.23.1/pg-pool3.14.0的Pool.end先移除客户端再等异步关闭，见[root独核](../../docs/evidence/wpf-conversation-recovery/bodyloss-pg-root-risk.json)，不冒TUI故障归因或实际复现。仅两harness及own记录改写：严格真实ACK prefix与同Request headers→failure证据、两个ownedDB检查点有界零连接观察。CREATE/Queue仅helper支持，实际journey仍PENDING；原90s/15s清理不扩，direct剩25.426s/types剩7.186s未使用。0import/types/test/HTTP/PG/Chrome/free/install。

## 2026-10-06T17:35:32.287102+00:00 — body-loss / PG清理固定源码安全点

固定 `7686139952becf530bcf57966425bd9d7b88b697`；[19源manifest](../../docs/evidence/wpf-conversation-recovery/bodyloss-checkpoint.json)核仅两harness变化、其余17源=ec91/1b8。[接口与边界](../../docs/evidence/wpf-conversation-recovery/bodyloss-source.md)：真实ACK full-length/strict-prefix/Connection-close，同Request headers→requestfailed和exact1/2原身份；两个ownedDB零连接观察各≤1s/≤8次并受parent同一hardAt，有限pid/state+safe code，无FORCE。全部NOT_RUN，旧27PASS/原raw保持，不借RELEASE运行证明。CREATE/Queue/Steer实际journey仍PENDING，完整target UNKNOWN/review NOT_STARTED。0types/runtime/PG/Chrome/free；source冻结待独审，metadata正常push后核双端clean。

## 2026-10-06 17:41 UTC — 768 唯一P2源码修复启动

本人核[管理fresh窄观察](../../docs/evidence/wpf-conversation-recovery/768-task-identity-claim.json)：6ff v4原21/唯一owner/overlap[]，a3c clean。[Root原审查](../../docs/evidence/wpf-conversation-recovery/768-root-source-review.json)与[peer](../../docs/evidence/wpf-conversation-recovery/768-peer-review/report.md)一致确认turn.taskId不存在，两个undefined可能错误相等。仅改browser为公共decoder和实际公开conversationTurnSchema（本树无conversationTurnAdmissionSchema同名出口）核原请求与两个真实ACK、非空turn.id/task.id；worker内导入保parent built-ins-only。新P2未运行；0types/import/test/HTTP/PG/Chrome/free，预算不变。

## 2026-10-06T17:43:28.863916+00:00 — ACK身份修复固定源码安全点

固定 `667889058d3decc0abc9f635a37fd0f05f2c090c`；[19源manifest](../../docs/evidence/wpf-conversation-recovery/ack-identity-checkpoint.json)仅browser变化、18源=768。现公共 `conversationTurnSchema` 校验原wire，`decodeConversationTurnAccepted` 对两真实ACK核原conversation/request，明确非空 `turn.id`/`turn.task.id` 后等原身份；worker-only导入，无新公开协议/DTO/HTTP。768唯一P2源码addressed待独立复核，NOT_RUN；旧raw/1b8 direct27保留。1s零连接是观察policy，不含pool acquire的硬上限；迟到零仍拒且parent hard stop记录未完成。0types/import/test/HTTP/PG/Chrome/free，预算不变；完整feature仍NOT_STARTED/targetUNKNOWN。
