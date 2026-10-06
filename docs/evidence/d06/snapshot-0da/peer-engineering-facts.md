# D06 工程/Codex 六节点补充核验

固定源码 `0da869f7bad98771177472539b5a192365c15117`；仅 Git 对象读取。0 Node/import/测试/服务/provider/资源观察/项目写。原五图旧结果不迁移。复用上一报告的 find-skills/codebase-design/clean-code 方法；本段仅把真实调用链与声明边界分开。

**结论：modules.checker 的“新收据尚未接中心”已陈旧，states.passed 的收据协议列表不完整；另外四处核心未启用边界仍成立，应精确补上“中心 v2 已接，但默认执行链未接”而不是全部改成生产完成。**

## 实际中心链（已接源码，不等运行或资格认证）

- `apps/server/src/index.ts:48,179` 挂载 registerEngineeringRoutes。`engineering/index.ts:12–21` 已有 runner native profile 发布与 owner catalog；v1 仍在23–33。
- `tasks.ts:49–50` → `execution-profiles/store.ts:108–111` → `engineering/profile.ts:30–32` → `native-profile.ts:30–36`：v2 请求必须 dedicated Codex purpose，拒 ordinary executionProfile/resume/fixture/protocol/verification 的混用，核 target runner、project/base、checker 与 published profile。
- `runners.ts:58–70` 将 engineering-fixture/v1 与 engineering-native/v2 分开，后者精确要求 harness codex、adapterVersion engineering-codex-1，并核 profile id/runner/digest/project/base/checker。普通任务不能流入这两种 purpose runner。
- `evidence.ts:23–29` 已接受 `flow.engineering.native`；`engineering/verification.ts:12–14` 把 v2 分派给 `native-verification.ts:30–47`。后者核 current task/attempt/owner、目标 runner、intent、check/writer identity、profile、lease/base、model、policy、qualificationDigest、result/inputDigest 与 artifactVersion。
- 新的中心外层合同是 **flow.engineering.native-receipt.v1**，不是把旧 **flow.engineering.receipt.v1** 默改成 native（`packages/contracts/src/engineering-native.ts:43–67`）。外层 check 内仍是 `flow.calculator-workspace-check.v1`/writerSettlement=not-attested；外层 writer 另有 identity/profile/model/qualificationDigest/writeAccess=revoked 声明。
- `native-verification.ts:13–27` 验冻结内容/digest/check结果声明的一致性，不解释模型源码；`native-profile.ts:12–13,29` 明示 source=runner-declared-native-setup、availability=host-qualification-required。这不能证明 host OS 隔离、真实模型锁定或客观停止。
- `events.ts:66–67` 的 engineering succeeded 调 `assertEngineeringCompletion`；`engineering/verification.ts:33–53` 按 v1/v2 verifier，必须本 attempt 当前精确 artifact 有 passed 收据，并再次校验。不是只信 task 汇总 passed。

## 实际 Runner 链（仍 fixture 默认，不能扩大）

`main.ts:14–36`：FLOW_ENGINEERING_SETUP_FILE 分支调用 loadEngineeringRunner；与 A2A/Claude materials/concurrency≠1 互斥。`engineering/launch.ts:1–5,12–21` 的真实 imports/调用是 prepareEngineeringSetup → publishEngineeringProfile → 校验 canonical config/digest → setup.bind。

`setup.ts:7–9,13,25–26,38–49,62–73` 只选择 calculator-v1、synthetic project、trusted checker，发布 **v1 engineering-fixture/fixture/engineering-1**，writer 写固定 recipe.fixedSource；没有 createCodexEngineeringWriter 或 native profile publication。`adapter.ts:15–22,40–50` 输出 v1 工程收据。不能因为 main 已有 engineering launch 就称 native/Codex 启动已接。

无 engineering/A2A 配置时，`main.ts:31` 仍走 `configuration.ts:28–34`（无 manifest→fixture；显式 manifest→Claude）。Codex 的 `loadCodexRunnerConfiguration/loadSelectedRunnerConfiguration` 在 `configuration.ts:37–50` 是显式 library 路径，普通 main 不调用。`native-harness/codex/launch.ts:4–9` 明确无默认 factory，缺可信 createTransport 会抛错；`exchange.ts:6–23` 的 factory/recipe 为 host 代码注入，不接受 task JSON 隐式配置。

`engineering/native-writer.ts:14–21,33–36,54–76` 仍要求外部 NativeWriteAuthority，缺省直接失败；open 要绑定 model/no-fallback/write policy，close 要 revoke 才能 stopped，否则 unknown。固定 `apps/runner/src` 的 symbol 查找只见其定义与 native-writer.test 的调用，没有该符号的生产 consumer；不把这个限定搜索扩大为全仓任意动态实现不存在证明。

## 六节点建议（可直接改原数据文案，短卡片/坐标不必变）

| 节点（data 行） | 判定 | 建议最小事实文本 |
|---|---|---|
| runtime.codex（20） | 默认 factory/CLI 未接的限制仍正确 | 保“显式 factory 的单次 exchange；默认 CLI fixture/Claude，生产 NativeWriteAuthority 未接”。补详情：“中心已接 engineering-native purpose 与 v2 收据校验；这不启用本机 Codex writer，真实 provider/host 资格另验。” |
| modules.nativehost（68） | descriptor 本身未变；“生产 loader仅fixture/Claude”需分层说明 | “普通 loader 保持 fixture/显式 Claude；工程入口另走 dedicated v1 fixture setup。Codex library 需可信显式 factory，中心 v2 purpose 声明不代表执行 host 已启用。”descriptor.ts:5–16 只是构造已验证 profile/ports，不能把工程 v2 塞进它已有普通 profile 的声明。 |
| modules.workspace（70） | synthetic/default固定 writer 仍正确 | 保原限制，明确“FLOW_ENGINEERING_SETUP_FILE 只组合已标记 synthetic project + v1 fixture writer/checker；无任意个人 repo 入口”。workspace.ts:22–23、44–51、87–91 保已知身份/未决 lease 的禁止销毁语义。 |
| modules.nativewriter（71） | authority待接仍正确；中心是否接入不可再混称未接 | “受控 writer 模块可经显式 qualified authority 调单次 Codex exchange；无默认生产 authority/主入口绑定。中心已有 engineering-native 声明、purpose routing 与 v2 收据验证，不能替代 host 授权或停止证明。” |
| modules.checker（72） | **必须更新**“尚未接中心” | “宿主 calculator checker 只解释有限算术，不执行模型源码；check证据已成为中心 v2 native receipt 的嵌套合同。中心核声明、身份与内容/digest一致性，不运行宿主解释器，也不认证真实模型/OS或代替独立审查。”seam可写“calculator check → native receipt v1 → center v2 verifier；fixture v1 另保留”。原 node.source 可保 calculator-receipt.ts，但 source-audit 必须增加 native-verification.ts 与 contracts工程native，不能只引用旧checker文件证明中心已接。 |
| states.passed（118） | 基本含义仍对；seam只列v1不完整 | “中心对固定 artifactVersion 核正文规则或对应工程 v1/v2 收据；engineering succeeded 要求当前 attempt 最新版本的匹配 passed。不会由 task成功推定独立审查或 host qualification。”seam列“flow.text / engineering receipt v1 / native receipt v1”；不新增 task state。 |

## 同批精准更新的旧 source anchor

`architecture.test.mjs:303` 的 checker.locality `/尚未接中心/` 必须替换为真实 v2 verifier/当前未启用 host 的两个分层事实，不直接删除。`snapshot-aeb/browser-check.mjs:49` 同类旧详情断言在新 snapshot 脚本中同步；旧脚本/raw保留。`snapshot-aeb/source-audit.mjs:96` “calculator receipt to center bridge not claimed” limits 对新快照不可继承。

最小新增审核 anchors：server index registerEngineeringRoutes；evidence `flow.engineering.native`；verification v2 dispatch + completion 按 verifierId；native-verification exact check/writer identities；native-profile host-qualification-required；runners engineering-native/Codex；main→launch→setup 的 v1固定writer；codex launch 缺 factory 抛错。沿现有 source-audit 的精确 Git source/pin 机制，不新增 runner/图框架。

本报告仅 SOURCE_FACTS/NOT_RUN；真实 provider、OS authority、个人中心部署、原生工程端到端验收均未由本段验证。详细 pins 见 engineering-followup-audit.json。
