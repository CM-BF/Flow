# ENG01I 候选宿主Interface（只读准备，尚未take/实现）

输入：A source916e59f69cea6f5eef4fe8cd80dc1f735c5b705b；G source8f067b4b7a7acf3506ebcea08e8724cfa9baaf7d；F source1b3c9023020985f15486368301ccfece993a3ff3。实际读Mika WT固定ff927712ae8560a26febf01279b44c2fc12a1666的`native-engineering-authority-inputs.md`与rootliteral/run-report.md。只读源码/probe已保存记录，无新probe/模型/个人服务。

## 调用路径与唯一所有者

`FLOW_ENGINEERING_SETUP_FILE` → 已有engineering/launch按显式v1/v2版本选择可信setup → v2恢复原标记合成project与immutable pin → 每assignment构造G writer + **具体已批准authority** → G唯一exchange/R06 → writer stopped且authority同binding撤销事实 → F capture → A新版receipt → context.emit artifact/verification → runtime决定terminal。

Native setup不扩旧setup.ts，不让v1 fixture接受新字段；原entry仍要求独立单project/单attempt宿主。task不提供path/argv/checker脚本/factory。`prepareNativeEngineeringSetup(workingDirectory, manifestFile)`只认固定recipe/model/qualification引用；先解析并核真实host资格，缺失时不publish、不创建project、不启动transport。不能把HTTP profile publication响应看成host资格。publication/pin/恢复用现FlowClient薄出口、directory identity、wx/fsync记录及原workspace恢复；不重建不完整目录/active lease。

`createNativeEngineeringAdapter({ project, configuration, reference, qualifiedAuthority })`是新真实consumer，不复制fixture writer/checker：每attempt从context.executionIdentity冻结真实facts，校验intent/profile/purpose后acquire原workspace；每attempt authority一次open/close，G继续单实例一次execute。authority保存私有代际、目录真实路径/inode、资格/配置digest与R06 handle；其关闭事实只读地提供给该adapter。此事实不是给任意调用者的新JSON签名接口；不接受task/native自报revoked。

A receipt check字段保持F的`writerSettlement:not-attested`；只有adapter观察`executeEngineeringWriter(...).settlement=stopped`且从同authority实例读到精确撤销事实，才包A writer字段。F负责完整文件集合、before/after与有限算术；中心负责关联，不重新解释源码。公共wire shape由A唯一DTO供后继F消费，删除F私有重复shape而保留其报告重算与旧JSON顺序；不得复制算术算法。

## 停止、持久恢复与错误

- 无资格/配置不符：launch failclosed，零transport。没有已批准recipe时不实现“JSON qualified → 可用factory”的旁路。
- 已可能open/dispatch而失败、取消、ownership丢失、身份错配、close超时或native未知：保留unknown与active lease，不能check/release/出verification/completed。
- 确认stopped但native失败：失败结果允许既有runtime结算；不伪通过检查。确认completed再capture；capture unknown仍保留lease。
- 发布artifact/verification期间错误也保留工程lease并转unknown；runtime/outbox已拥有lost/journal，adapter不从Promise rejection推断未写/未提交，不自己重新发送或构造第二journal。尤其lost artifact ACK：中心可能已保存artifact、verification仍pending；重启只恢复原事件和admission，writer调用次数保持1。
- active lease记录仍使用原project生命周期。host崩溃时不靠PID重建authority、不能把新进程收到的旧receipt当stop证明；恢复保留不可用状态。旧同UID协作边界不升级成OS sandbox声明。

资源：沿G每open/ownership一个writerTimeoutMs窗口，close另一个同上限窗口，再有R06关闭；不是单30秒总时限。沿F完整snapshot/2KiB源码/受限解释，A receipt512KiB。authority私有资格/撤销证据候选总16KiB、refs<=128B、主体<=16；首单进程实现若成立只应出现1写入主体，不为16主体实现通用registry。同步FS操作不承诺可硬抢占。

## 当前不能签发真实authority

Mika固定输入明确：rootliteral只是固定C、regular stdio、完整测量PASS；Node候选NOT_OPEN。当前没有Node/Codex同recipe兼容、native fileChange实际执行机制、强制file-only/所有自动通道覆盖、实际>=Sol且无fallback、完整撤销事实。C成功不能逐层自动升格。

最小具体实现候选仍为固定Seatbelt单原生writer + R06唯一进程所有者；**成立前提**是实际Codex在该recipe下不产生/委托任何其他获写主体，且精确路径、临时状态/链接/FD通道受控。只有前提已证且确认该主体完整退出，close才可签同lease revoked。如果工具实际依赖子进程，候选不成立，必须另审有界shell/完整隔离生命周期，不靠PGID消失补证。禁止把当前readonly/untrusted请求或观察到的item名单当实际强制。

模型资格必须在授写前来自真实可信执行身份与no-fallback约束；directory/requested/thread接收配置、缺少reroute不能替代。若当前协议无法提供授写前所需事实，维持unsupported并交Lead明确替代合格执行路径，不能先写再反证模型。provider通信网络能力另明示，network:false不能自动证明隔离。

最小0模型预检继续归Mika唯一owner：固定exec/policy/env/stdio；实际Node/Codex启动/close；自有文件允许与越界/链接/exec/后台FD写入拒绝及关闭完整性；全部原raw与失败清理。此文件不授予运行窗口或新grant。本worker不重复其诊断。真实fileChange和>=Sol模型仍需之后独立有界模型验收。

## 最小新scope候选

- apps/runner/src/engineering/native-authority.ts、native-authority.test.ts：具体受信recipe与代际撤销，等固定资格输入；缺输入拒绝，不造默认executable。
- apps/runner/src/engineering/native-adapter.ts、native-adapter.test.ts：G停止→F完整检查→A receipt，所有未知状态保留lease。
- apps/runner/src/engineering/native-setup.ts、native-setup.test.ts：有限v2配置、恢复与pin、资格先行。
- apps/runner/src/engineering/native-launch.test.ts：实际入口/公开PG/原outbox与lostACK重启。
- apps/runner/src/engineering/launch.ts：两种已显式版本setup组合，不改main/runtime。
- apps/runner/src/engineering/calculator-receipt.ts、calculator-receipt.test.ts：消费A共享wire，保留单一pure检查/旧JSON；先类型shape保持行为，再真实组合。
- plans/eng01i-native-engineering-host、docs/evidence/eng01i。

固定OS recipe路径待Mika提供实际可审输入后协调，不在此预占。R06若缺必要事实，先给其owner最窄delta；不复制spawn/pump/close。当前没有足以完成native-authority生产实现的资格证据，不能用又一组fixture-only通过替代；A中心交付、B未来接线与真实用户工程验收分别记录。
