# RELEASE01：旧 Web 两文件移植准备（SOURCE_PREPARED / NOT_RUN）

固定基底 `7272151bb1e3e59e08937dca44949dcdeb42f009`；唯一补丁取自 MSG 固定 `c848024a20ac59182360d31c7e0087828bca018d`，SHA256 `77bc71c1aa001c693ba08b0a56ccf6e3b8faac5824e056663a9c81893882bdc8`。MSG 当前 HEAD 已前进到 dcdca6b1793b782591da8f9bc5fc2330adc107b9；本准备始终读取 c848 Git 对象，未跟随移动文件。

TMP 位置：`/private/tmp/release01-held-transplant-re0ej6l6`。只对这里的两份固定旧 blob 执行 Git patch check/apply，均 exit 0；这不是编译、产品 import、行为验证或 artifact 构建。完整输入/输出 pins 见 [manifest](manifest.json)。

## 最小结果与旧 consumer

- `apps/web/src/plugin-integration/attachments.tsx`：23,456 B，SHA `802e2666543e63b79c199cda03a0cf868f081b637983bcd19270b867d123e5b4`，逐字同 b924 已审 attachment 文件。借用当前 composer read port，复用原 draftItems；current IDs 优先，held/inTransit 其余排除；无 port 时复用现 restoredDraftIds，仍以实际 input 成员与顺序为准；旧 release 不清新 port。
- `apps/web/src/plugin-integration/session.ts`：24,592 B，SHA `728a08d9e7ba64533da5b0bd9d7fa485f7d1cddefc13554c29101881e9841d9a`。机械确认旧文件恰一处 `binding.input?.getSnapshot().items` → `binding.recoveryDraft()`；其余字节保持7272，明确不等于整份MSG session。
- 旧 Thread `ConversationThread.tsx:148–160` 仍使用原 syncComposerDraft / bindComposer(runtime.thread.composer)；没有新 MSG settings authority 或自动返还guard。此次移植只让旧 Recovery 读取同一个成员投影，不改这些旧线程行为。
- 旧 `AttachmentComposer` `react.tsx:276–285` 显式恢复 A 后仍可能保留 failed hold；复用 current-ID 优先规则与 restoredDraftIds 无 port fallback 正好保留这一旧接口，不用无条件排除held。
- 旧 App `App.tsx:663–668` 仍从 session.recoveryMaterials 得 CompleteDraft；Session 的原附件订阅通知 / Recovery namespace、CAS、保存生命周期不变。六个旧 consumer Git pins 已记录，但未执行其检查。

MSG 根审 b92e4c 已 APPROVED shared source + controlled local（selected 1、strict0）；它不是旧7272 consumer组合的类型/浏览器通过。旧第四实际仍FAIL，旧7272自然同型失败未证明。当前 static apply 不补签任何行为PASS。

## 8964 guard 调整方案（暂不修改）

当前两harness源码保持 `8964dc1185f62ed8934c15416e9798929359ab89`。fixture `:18` 的单一 RECOVERY_RELEASE_SOURCE 被 `:34` backend、`:35` Web 与 `:133` loadApps 同时使用。等 Original 供给正式审定、含上述两file的真实 Web commit/artifact 和修正backend descriptor后：

1. 将单一源常量拆成 **精确固定 Web source** 与 **精确固定 backend source** 两常量；不能从 admission 自己声明的 expectedSource 反向信任，也不只检查40位格式。最终Web SHA未知，不能填7272冒含补丁。
2. assertRecoveryAdmission分别核两descriptor source；loadApps第四App核同一固定Web常量。仍在fixture/PG/Chrome创建前拒绝缺失/错配。既有manifest source/artifactId/digest/releaseId、root/devino、backend sourceTree/Node/fullpins/verifier和context/policy检查全保留。
3. backend 可采用 Original 正式审定的 `04da80692e79e2b7c3f6341c7fa76515a3f719a3` / 6c最小lateLogout组合；现仅明确授权候选，正式源审/artifact尚未提供。两个descriptor仍NULL，未修正6c/7d1不fallback。
4. browser现有报告已分别使用真实App artifact与实际backendHead，不要求共源；无需为拆guard改网络/actor/生命周期/四check。旧三App原生Bearer四报告仍必须在同一新backend/context产生；新App Cookie/refresh/原keyACK/迟到logout独立链不放宽。未来necessary检查只针对该精确input delta，旧绿不重跑冒新绿。

## 权属与供给

Release fresh `27c36b97-162d-45e0-9150-25269d3d3f34 v1` exact4 active/nooverlap。生产 attachment/session 仍属于 MSG claim `7e3fbcf1-befe-4579-9d6c-ee74df6e8c51 v3` exact20，由 workspace_panels_owner 持有。本次只写Release evidence/plan及自有TMP，未改生产/共享配置。

若委派 Release 实际编辑生产，必要新增 literal **仅**：
`apps/web/src/plugin-integration/attachments.tsx`、`apps/web/src/plugin-integration/session.ts`。
须先原owner STOP→当前version移出→Release合法amend后才可写；更直接可由Original受控集成上述已审最小patch到固定7272候选并给准确新commit/descriptor，不能把Release现工作树当7272整树或整拷MSG session。原现claim内fixture guard改动无需新增literal；实际旧base consumer测试若要写 `apps/web/test/conversation-recovery.test.ts` 则仍属MSG，需要另明确handoff/原owner执行，不能视为原4scope已授。

## 下一必要验证与尚未证明

最小旧base consumer验证应实际加载旧 AppPluginSession→绑定→Recovery 投影：heldA/currentB仅B；currentA优先；partial/full A恢复后unmount仍保留；旧port释放不清新port；input.remove不复活；unverified/no-chip有序保留。可复用已审断言，不复制另一selector；当前仅方案、未执行。随后原发布者供不可变新Web/backend，原Release真实四App兼容与完整cleanup/固定context是独立必要证据；不能由MSG1local或TMP apply代替。0 Node产品/PG/Chrome/HTTP/build/install/free、无运行gate或预约。

本地find-skills/clean-code方法已复用：最小补丁、单一成员authority、明确借用port生命周期；将source批准、旧base组合、artifact、actual分层，未新增框架。
