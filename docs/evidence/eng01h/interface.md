# ENG01H Interface

固定base aeb764e5d2c2ec043ae8673cde2724f5330db2ab，G/F已审输入；0provider/无DDL。

Module：engineering-native合同定义有限v2 profile/intent/receipt；native-profile复用immutable publication表并核pin/purpose；native-verification只核受信runner声明与当前attempt、最新artifact和完整snapshot关联。复用现事务与S01 fence，不复制runtime/lease/outbox/checker算法。

POST /api/runner/native-engineering-profile 输入 {configuration: NativeEngineeringProfileConfiguration}，runner role，返回 NativeEngineeringProfilePublished。GET /api/native-engineering-profiles?after=<uuid>&limit=1..100 返回 NativeEngineeringProfilePage，owner role，独立catalog、no-store。旧路由返回/JSON/hash不变。F01后接薄client/export。

新purpose engineering-native、profile protocol flow.engineering-profile.v2，task engineering protocol flow.engineering.v2，harness codex/adapter engineering-codex-1、显式project/base/checker/model/authority qualification引用；任意path/argv/env/unknown字段拒绝。发布只表明runner声明，availability固定host-qualification-required，不表示可执行。旧host入口不识别v2，缺真实资格零transport。

任务受理/claim前重复核对purpose、target、profile pin、project/base/checker；禁止ordinary/conversation/goal/resume/text-verifier借用。native独立verifier flow.engineering.native/version1。新外层receipt绑定F格式check证据与host声明的writer撤销；F writerSettlement仍not-attested。中心不信native stdout，不import/eval源码、不重算算术、不声称证明OS权限或所有writer停止，只核声明一致性与当前owner。

资源：分页<=100加sentinel；snapshot沿128files/64KiB每file/512KiB总量，receipt<=512KiB，检查源码<=2KiB、diff<=256KiB。拒绝错误/旧attempt/错lease或artifact/失败receipt的succeeded，事务失败不丢原outbox批次。无资格实际host、停止和独立actor最终验收均后继。实际接线只允许复用G writer/F capture，不能把profile存在当qualification。
