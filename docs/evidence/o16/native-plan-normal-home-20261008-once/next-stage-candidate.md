# O16 真实提案的最小后继候选（仅准备）

时间：2026-10-08T01:50:04.500Z。输入为固定结果 `76a9f36b14c3da1604ee38121f609095cf0cc997`；本说明不更改原结果manifest、pause或私有状态。后继授权/执行：**NOT_GRANTED / NOT_READY**，本说明0query、0apply、0child。

真实模型提案是：先依据固定纸鸢0.1材料起草不超过120汉字的发布说明，再由第二项任务读取草稿与同一材料逐项核对，保留草稿、核对结论和最终稿。两步都禁止写文件、终端、网络、子代理及虚构事实；第二步依赖第一步。它只是两项完整输入的提案，尚未形成草稿或最终稿。

| 实际任务 | 输入与验收边界 |
| --- | --- |
| 起草纸鸢0.1发布说明草稿 | 仅固定材料；包含项目、版本、草稿预览、尚未正式发布，不超过120汉字；当前机械verification只是contains“纸鸢”，不代替独立语义审阅。 |
| 核对事实并给出最终修订稿 | 同一材料与前项已验证草稿；保留两份文本及核对结论，最终稿不超过120汉字；当前机械verification只是contains“最终”，不证明全部事实正确或用户已接受。 |

完整真实输入、知识引用、权限/工具、profile、center audit与usage只引用[原plan.json](../runs/native-plan-normal-home-20261008-once/plan.json)，不再抄一套源。材料版本1，contentDigest `8de2b80dd83557aa67de70ea5d3509211c8b40f84fba405c1f006f9fd4c36ab0`，utf8字节0–114。

明确确认对象应绑定：

- goal `7d22a98e-3337-4d6b-bd39-1f5403f739c2`，proposal `9a3d0320-efd7-4d65-828c-adb42d6dd5c2`，proposalDigest `fe9b12ce0ef7746c399047633639c7c27ad5fe9f21b82cef60b4a4c4de1e3f7b`；expectedProjectRevision=1，当前proposal state=proposed/appliedRevision=null。
- sourceDigest `5efa6412123c8134a80759326f8a53572ec9162a6e858dd09581194c5dff83e4`，environmentDigest `fc5eb96c84081b60cc65a5bf912bd26f3e8820ca5bf3fcf5e8105001aa439bd8`，固定SDK0.3.290/native2.1.290。
- 两节点各自完整input与相互依赖，以及同一个已登记children profile：id `4c6dd8c8-cdf7-45d9-a616-2d6cffdf829b` / runner `c03a73ce-3b5b-4958-bca4-8dc1506b9a1a` / configDigest `397319955a04d1509d3817b84748724117b1ce43fe07c78847662e362509547d`。maxAdmissions=2、externalDependencies=[]，仅本授权内已验证artifact可作为中间产物。
- [confirmation-draft](../runs/native-plan-normal-home-20261008-once/confirmation-draft.json) 中reason仍是待真实审阅后替换的草稿，不是同意；草稿自身expiresAt不能覆盖更早的pause期限。

下一阶段有三项明确决策：

1. **确认实际提案（0query）**：独立owner审阅以上完整输入/版本并给出真实理由后，原 `operator --confirm` 可在未过期且所有绑定仍匹配的pause上执行中心CAS确认；不启动runner、admissions仍0。未授权执行本命令；不为延长时钟而空确认。
2. **执行两个依赖文本任务（拟新增最多2query，尚未授权）**：现有children合同是同模型claude-sonnet-5-5，每项max3turn/SDK估价上限USD0.10/60s，总请求最多2次、SDK上限合计USD0.20、累计SDK最多6；无重试/替代模型/账户切换。估价不是订阅实际扣费硬保证，实际账单UNKNOWN。仅原受控Read材料与已验证上游artifact，禁止Bash/Write/Edit/网络/Agent/Task/Skill，无工程写权。两个查询共享父工作期限；若保持现120s工作+30s清理/150s独立总限，单项60s不是允许叠加额外时间，父期限可能先终止第二项，须FAIL/KEEP而不能延时或重投。
3. **独立接受（0query默认）**：获得两个真实artifact后，由独立actor核对不超过120汉字、四项固定事实、无编造、上游/最终文本和依赖绑定，并明确accept/reject及实际artifact digests；机械verification或模型自述不能代替。原 `operator --decide` 才消费此明确决定，后续DROP/删除仅按既有marker/身份/关闭/预算门，不在本说明授权。

真实实现缺口必须先闭合：`permit.mjs:assertNativePermit` 当前明确只接plan，worker/phase-host/query decorator均调用它；children schema或新JSONpermit无法绕过该guard。因此native children尚不是可运行能力。其次，`stage-policy.mjs:validatePause` 与 `resources.mjs:claimPausedResources` 绑定旧sourceDigest、完整state/report/resources；任何实验源码变更都会改变sourceDigest，不能在现pause上直接换源，也不能改原pause/私有state。若采用受审窄children启用，需要先设计并验证能保留这些旧/新身份、一次性和资源关闭事实的明确续接合同；目前没有该接口，本片不实现或降低检查。无需重新规划已成功提案，也不能把不存在的续接能力宣称已就绪。

当前pause到 **2026-10-08T02:00:32.316Z**。到期仅拒绝并保留DB/private，不自动确认、查询、清理、续期或改变原3次FAIL；固定成功planner结果与上述后继缺口分开审查。

## 2026-10-08T01:54:06.221Z 最小显式续接 Interface 草案

GO已语义接受这份真实proposal的起草→核对/修订、固定引用、120字、不得编造与独立最终接受约束；这不是最终交付接受、签发confirmation或两次child额度。实际结果76a9的限定独审已获APPROVED_LIMITED_ACTUAL_PLANNER_RESULT_FIDELITY/0P1P2，并main254ce9579，唯一I02 `o16-normal-home-planner-result-intake.json`；与本后继设计分开。

选择是**有效暂停内的显式源码身份转换**，不引入第二运行器，不给旧sourceDigest添加模糊兼容别名。由于它需要在未来受控confirm段变更自有journey/resources的source身份，本轮依Lead界限止于此具体方案交审，尚未实施转换代码，更未恢复任何旧private/DB。

| Module / Interface | 职责、输入输出和约束 |
| --- | --- |
| 新小叶 `source-transition.mjs` / `validateSourceTransition` | 纯输入：当前完整sourceIdentity、原pause/report/resources公开绑定、单份审查过的exact old/new文件delta及新确认授权。验证每个new条目匹配当前实际identity；反向替换old条目/移除新增条目，沿原files排序及dependencies重算，必须精确回到原5efa digest。非delta源码或任何依赖漂移一律拒绝。结果为不可变的旧/新source、旧pause/state/report/resources digest与批准ID绑定；JSON文字本身不是授权，operator仍须消费外部明确决定。 |
| `resources.mjs:claimPausedResources` 的受信可选transition接缝 | 先按原source和原15min期限调用现validatePause，核dev/ino、关闭事实、原完整state/report/resources digest，再exclusive消费原pause并先持久transition intent。仅允许sourceDigest字段从精确旧值转到新值；真实proposal/profile/config/material/阶段/credential均不改变。旧pause-plan和原报告不改。利用原writeRecord的wx/fsync/rename保存，并readback核新state/resources；中间任一写结果未知则保留intent/KEEP、没有center.start、无自动重投或回滚。现协议尚无双文件原子事务，必须把部分写当UNKNOWN而不能假报成功。 |
| `driver.mjs:confirm` 的显式确认封套 | 普通原confirmation保持原义；新固定kind才携带真实confirmation与上述transition批准绑定，验证后把受信port传给原privateCenter。只有新state/resources已一致、原pause仍未过期时才走原center.start(false)和既有同key/body CAS确认；不是以确认刷新时钟。原后置confirm pause仅由真实确认成功生成，仍15min。 |
| `permit.mjs:assertNativePermit` | 在既有validated WeakSet、v2、source/env/期限/模型/精确limits基础上，新增明确children分支；它还必须已有实际confirmationBinding。保两个child slot/每task一次与query-run原实际assignment消费，不用登录布尔或普通JSON选择权授权。 |

转换实际输入中的新sourceDigest、exactdelta和新确认批准必须在实现/独审后才能固定；不得预填不存在的review或新版本。新permit只匹配已转换后的source/env及真实confirmationDigest/progressionId。为避免不受控重复转换，当前小接口只从原plan pause进入confirm；其它phase或已存在intent/consumed标记拒绝。

预计真实变更仅 `permit.mjs`、`driver.mjs`、`resources.mjs`、新 `source-transition.mjs`；直接例在现permit/stage-policy/contract测试及一个小transition专测。operator/watchdog/native-environment/生产模块不改；不复制325项来源，delta只列实际变更的old/new hash，完整identity使用原函数。该列表是待审实施范围，不声称已有实现或实际可运行。

相关0query检查须覆盖：

- 原plan默认不变；新children许可必须绑定真实confirmation、两个slot/两task且拒第三/旧permit/错profile/env。
- 完整当前identity反向重建旧digest；拒未列源码改变、依赖改变、重复/漏delta与错误old/new bytes/hash。
- 真实原validatePause正反消费者：到期或future clock即拒绝、proposal/profile/state/report/resources改变拒绝，不生成新的期限。
- 真实wx/rename写接口在自有小fixture上覆盖intent→state→resources/readback各次失败；原首错/intent保留、不start、不伪造rollback/成功；拒已消费namespace。
- 真实confirm装配到center.start前的无PG注入消费者，确认完整封套被实际旧接口消费、无隐含权限变化。

下一检查段上限仍Lead给的累计120s、最多4个受监督child且各≤30s含收尾、8MiB自有材料；目前该新段工程child=0，不因设计稿运行旧阶段。若完成审查时原pause已过期，本方案拒绝本次旧episode，不能追溯改期限或自动改成新goal/新planner；后续处置需显式新方案，旧成功提案与KEEP照常保留。
