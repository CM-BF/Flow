# CHAT04 v2 验证证据

固定实现 `ae9d7203c30bdf5ec6825cee0e6ce86231c34cb2`，base `dd1b9dafc77fb56a580d3d41dc7ddec3b1996ef8`。完整[manifest](checks.json)绑定产品、测试和consumer可执行harness的实际SHA256、原始日志、命令、退出码及UTC。

最终32个queue用例 +22个原conversation消费者用例 = **54个不同用例通过**，noEmit exit0。旧1/2/14/15/16/18片段、v1 consumer均不重复相加；resume-red的16 skipped来自定向测试选择，最终32全跑无skip。

## 真实验证与资源

- `v2-matrix.log`：真实HTTP/PostgreSQL/pg-boss，32/32；实际fixture起止见v2-matrix-cleanup。onSend在命令COMMIT后直接断开连接来丢失enqueue/pause/resume ACK；重放原receipt与GET当前事实分开断言。
- `consumer.log`：22/22。`run-consumer.mjs`保留固定原conversations.test.ts所有test body/断言，只替换临时资源生命周期及显式migration11，生成测试位于已领范围并finally删除。原文件/生成文件hash与实际时间在consumer-result。涉及模型适配器的用例使用既有注入SDK，0真实模型/云。
- `typecheck-result.json`：强制noEmit的确切命令、exit0及真实时间，空stdout的hash不单独冒充完成证据。
- 唯一临时库创建前拒绝既存、动态HTTP端口、关闭own centers/boss/pools、等自有DB连接归零后普通DROP；queue/consumer cleanup均remaining[]。不碰旧flow_chat01、4320/49922/55049或他人服务。已安装依赖复用且11个@flow链接均指本WT；无安装/lock改动。

## 行为覆盖

FIFO/双客户端CAS、只读等待分页/UTF8边界、100pending上限、取消与提升同锁竞争、双中心最多一次、重启、unknown/missing/busy session/invalid pin/失败取消uncertain冻结；conversation锁先task锁，task/wake/turn/item同事务。受控PG触发器使item更新失败，公开queue/turn状态不变且无孤立wake；scan失败报错并轮转，不饿死其他ready项，检查时间不增revision。

v2持久pause先于cancel。真实HTTP reportEvents在cancel_requested后提交succeeded，pause跨重启仍挡自动提升；另有pause/完成/promote三方并发。promotion抢先时旧pause revision 409，刷新后新ACK返回真实currentTurn；terminal引用不冒称active。空queue同样queue-paused，follow-up不能绕过；enqueue/cancel保留暂停。

resume严格queue+task双CAS、前task门禁，显式同事务提升首waiting并清pause，双resume只一次。failed/cancelled需要显式continue；新失败不能继承许可。空queue可按同门禁unpause，但后来的waiting不获自动失败续跑授权。active/uncertain/unknown/revoked/busy/invalid pin均拒绝且状态不变。resume中途失败回滚pause清除与task/wake/turn/item。无marker、新broker或runner/events/SDK产品改动。

## 失败保留与修正

首red除了预期enqueue stub失败，还有fixture afterAll误用expect.poll导致清理失败；只清自有唯一库，恢复JSON证明0连接后普通DROP。改为显式有界等待后重跑红/绿。首次consumer缺已安装SDK导致0 tests失败，复用既有依赖后通过；未把0 tests计通过。初次noEmit因测试callback隐式any exit2，补类型后通过。v1/v2的预期red日志均保留，最终日志未掩盖它们。

## 实际边界

SQL fixture仅构造受控执行状态以测queue门禁，不冒充模型执行；stop竞态则走真实既有HTTP cancel/reportEvents。54项是模块及直接consumer证据，生产migration/routes/client/scan生命周期与Web真实入口仍由Lead/Web接线并另验。Root已于2026-10-06 04:41:23 UTC APPROVED本target；main尚未接收，生产接线仍待另验。

类型兼容独审修复：最终target ae9d7203将queue能力改boolean（旧中心false仍合法），server仍true；运行时源码与32+22测试时2f40ac2完全相同，仅noEmit重跑。Web projection接受true/false需Web owner同步，Lead成套集成。该跨owner依赖不被模块测试替代。
