# ENG01I 恢复：最小编排接口与领取建议

只读建议，未take/改ENG产品。原树 engineering-native-host / codex/engineering-native-host，HEAD66fc4068a9ba19d288024ef2d36caf40d41c2af3 clean；原73bbb9e0 v2已released。04:14:57.482Z fresh账本六范围无冲突。19个直接输入逐固定Git比较仅runtime从原280到已审main422变化，工程G/F/H、公开wire、outbox与Codex exchange/turn均未变。建议保留原own三件套，受控消费固定main422f4b150e5801d6010e5bbd6b53574e35384f87再实施与验证，不拿旧领取循环冒最新恢复事实。

## 精确take（同原六literal）

- apps/runner/src/engineering/native-adapter.ts（新）
- apps/runner/src/engineering/native-adapter.test.ts（新）
- apps/runner/src/engineering/calculator-receipt.ts
- apps/runner/src/engineering/calculator-receipt.test.ts
- plans/eng01i-native-engineering-host
- docs/evidence/eng01i

只需要以上产品/记录。SVC08已原子退还5产品，仅docs仍持有；不冲突。CHAT05P01占contracts/runner.ts，MATURE02C02占Codex adapter/exchange/turn等；本片不领取/编辑它们。runtime当前无匹配writer但仍只读消费，不借此扩scope。正式take需当次fresh，不用本报告充当写权。无新migration、配置、runner注册或public client。

## Module 与 Interface

保留已固定 `createNativeEngineeringAdapter({project, configuration, reference, authority}) -> HarnessAdapter`：可信host提供SyntheticProject、v2有限配置、immutable profile reference及真实NativeWriteAuthority对象；配置hash/项目/base/checker/model/pin构造时解析复制，JSON资格digest只是受信配置引用，不是OS attestation。任务目录/argv/authority不从task传入，缺authority零transport。

run从真实 `context.executionIdentity`绑定task/attempt/ownerVersion/runner；严格intent v2+profile/purpose/target校验后唯一acquire。私有decorator只观察实际同authority open/close的不可变binding和revoked回执。G `createCodexEngineeringWriter` 与 `executeEngineeringWriter`仍是唯一执行路径，不注入任意第二writer/重建pump。普通final/close child/abort/Promise结束不能作stopped。即使close称revoked，G仍unknown也不得capture。

只有G stopped/completed、同binding实际撤销事实和当前ownership俱成立，才F `captureCalculatorWorkspace`。F保持完整before/after snapshot、2KiB有界读取和唯一纯calculator解释；本片让calculator-receipt复用H `nativeEngineeringCheckEvidenceSchema`/identity shape，保持现v1字段顺序与JSON bytes、重新计算report，不搬算法到contracts/中心。report rejected或failed均映为公开native receipt failed，不能伪passed。

构造H `flow.engineering.native-receipt.v1`：check仍writerSettlement:not-attested；独立writer部分由观察到的实际authority close绑定产生，身份/lease/base/profile/model/qualificationDigest全关联。既有emit/outbox先artifact，再verification（flow.engineering.native@1，digest按既有函数）；completed只由runtime决定。中心仅校验绑定，不声称再执行算术或撤销OS权限。

可能启动writer起默认保留lease：写入未知、撤销失败/错binding、ownership/abort、capture未知、artifact或verification emit拒绝/ACK未知均NativeExecutionError unknown且不release。可信停止的失败或全部发布成功才release，release错误仍unknown。私有单assignment重复调用拒绝新writer；跨进程恢复用现active-lease marker与runtime admission/outbox，保留marker时不能重建工作区或再次claim。S01的新runnerIdentity/opportunity恢复由已审runtime独占，无第二恢复循环。

## 最短验证与资源

先局部：F既有receipt字节兼容/伪report拒绝及capture直接消费者；新adapter用自有真实Git+注入authority/真实G JSONL peer覆盖合法通过、错误算术失败、writer unknown、撤销unknown/错binding、abort/ownership、artifact ACK未知。peer只是本测试的固定协议进程，0模型/无app-server/无真实资格probe。停止必须记录自有peer与tmp身份，测试额外清理知识不写成生产authority证明。

再独立PG窗口：一专库，公共v2 profile→task→runRunner→artifact/detail/verification；成功与lost-artifact-ACK/同stateDirectory重开（0新writer/claim）两个关键旅程。尽量同test文件沿原6scope，自有PG身份/reservation/checkpoint先于cleanup，有界连接观察，unknown保留；准备后另给实际选中数/入口闭包和预算。不重跑原H61/G105/F20、不启动provider、不抢C02/个人端口/重窗口。单纯模块绿不代表真实>=Sol写改、实际强制权限、完整writer撤销或独立语义接受。

原Interface的0query宿主组合可直接实施，无需等待Mika真实native资格。首片不提供concrete authority/production启动；其资格仍明确后继开放。遵循原find-skills/codebase-design/clean-code方法：把生命周期组合集中在adapter，保留G/F/H单一事实源。
