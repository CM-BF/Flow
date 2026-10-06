# ENG01A 独立审查

状态：NOT_STARTED

Base f181d84b5fb3652d62e2a181acff442d42b3e066；target未固定。Reviewer默认只读，修复由owner执行。验收：专用fixture工程intent目标runner门禁；真实自有Git worktree写改；不可由fixture选择/改写的验收基线；完整内容快照含untracked/staged/unstaged/deleted/mode；binary/submodule/symlink明确拒绝；前后内容集相同才可验证通过；实际bounded command退出/完整结果/log版本；server仅核可信receipt与请求/产物/attempt关联且旧flow.text不变；现host/outbox/journal/unknown恢复保持；无个人服务/模型/OS隔离能力声明。按固定commit完整diff、实际stdout/selected、随机DB和自有进程/工作区清理证据独审；空模板不表示通过。

## E0 中心合同局部独审

Review target commit: 909b45e232e1477426cb1d44e696a3187f80cdd8

Execution Lead独立只读APPROVED；8source+17evidence fixed/working bytes与hash全一致。全读合同、targetRunner SQL、evidence/event事务与10cases；原9pass+测试唯一约束1fail、修fixture单选1pass/9未选、root noEmit0与2随机DB正常清理已核；未重跑，无P1/P2。批准限中心intent/当前attempt/精确最新artifact+receipt关联及succeeded事务门禁，旧flow.text隔离；不证明远端checker或工作区。E1仍实施/未审，待真实纵向成套接收。

## E1 待独立审查

Review target commit: 040fdede227fe22504972ea7a053c23f14a30f52

6个新增runner engineering文件及E0已审8源组成14源候选；[固定manifest](../../docs/evidence/eng01a/e1-fixed-manifest.json)覆盖源、直接消费者、受保护宿主输入与原始证据。验收受管Git内容集/固定外部checker/生命周期/unknown与公开PG读回，详见Interface、validation.md。E1状态APPROVED，由runner_owner独立只读审查。targetRunnerId不是能力认证，错误普通target实际claim但不能工程通过是明确已测试限制；后继ENG001-04闭合。0provider/无生产入口。


E1 独立结论：APPROVED，reviewer runner_owner，2026-10-06 10:36:00 UTC，review target 040fdede227fe22504972ea7a053c23f14a30f52。完整读6新源码；14source+6validation+8protected+42evidence fixed/current bytes与SHA一致，manifest SHA256 0fa3fd9c7236fb1b9fc67131100c8f506cf462d34d7b3686008bc166fb52cbbf。E0对909b45零diff；80 distinct分轮/原始失败/DB cleanup/typecheck证据均核，reviewer未重跑测试，0provider。无P1/P2。批准只受信合成setup的0模型真实Git/checker/PG通路；同UID非sandbox、target仅路由pin、lostACK不伪成功、无provider和跨进程project重建结论保持。Owner源码停写等待受控main集成，不改已审target。

主线收口：c5bab40ffd9a334403c0db743f798d10815961f0；owner核14源码hash同独审target。Lead在S01组合点测成功/unknown restart/lost artifact ACK三项，2未选、root types0、随机DB正常清理。原80未重跑，范围限制不变。
