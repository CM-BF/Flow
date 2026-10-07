# 原 8 组 PG 验证恢复准备

2026-10-07 02:49:24 UTC，status_read / gpt-6-astra。本次为静态准入准备，NOT_OPEN / NO_HOLDER；没有执行 import、工程检查、PG fixture 或 provider。原 85 个非 PG 行为、strict 第 5 轮和 3 个 wrapper fake 不重跑。

## 固定输入与占用

- 开始 HEAD `31ece087e01c3691aaa883072ea20d7d39805a90` / `codex/runner-claim-recovery`，clean；协调 CLI fresh 返回 available，claim `9ec4dbc8-b4d3-4e16-801f-caa3a2cd85ac` v2 ACTIVE / 18 scope，身份和路径与原 amend receipt 一致，未更改 claim。
- 原 [PG manifest](pg-prepared-manifest.json) 仍绑定 `ac3b8532fb23a9c8549c0b32e225a31327bc85f9`，65 项 / 316099B 的 fixed Git、WT、长度与 SHA 全相同；manifest SHA256 `db1364e042fee29978785f93d260504ac12e8f1e7477bcbd7e17107a445fc65f`。产品仍为 `83a0799293057f7472f0329c61e566708b2a2381`，未追主线、未修改输入。
- 原动态清单 30 SQL / 62522B 全在场且同 hash；复核 createServer 迁移调用、002 的 new URL、012/013 与 017/019 的文件数组、032 动态读取。既有声明的 231 份源码闭包均在场且等于本树 HEAD；这是静态齐备，不是实际 import / 初始化通过。
- 24 个依赖链接的 realpath、package.json hash 和版本一致；4 个 @flow 指向本 WT。既有 Node24 路径在场；无安装、复制或新链接。

## 原窗口与有限并行的明确修订

原 [slot request](pg-slot-request.json) 的“fresh serial window”继续要求本片独占 heavy 类别：不得与另一 PG/Chrome、个人发布或性能测量重叠。依据主树 `943a66bfa5f71f4a5000ff2674ac1973e85e0353` 的 `docs/quality/local-validation.md`“资源恢复后的有限并行”，可另配唯一无共享端点的 bounded local；该文档本次读取 SHA256 为 `e07d71c8f867d24c413ae7666353405ca196bd11ec23521b05aec3ae5c379af7`。本段只澄清运行协作条件，原 packet 原字节保留。

- 无 local 配对时保留原 fresh 启动线 **1,207,959,552B**。若配对项的完整新增预算为 32MiB TMP/cache + 256KiB raw/metadata/收尾，额外保留 33,816,576B，组合 fresh 线为 **1,241,776,128B**，并同时满足 local 自身门槛。若其元数据另有预算则继续加上；未知或更大预算不套用此数值。
- co-lead 开窗时明确 local 的固定输入、实际运行阶段与清理归还、隔离 namespace / TMP / 输出；只读 donor 期间不得重写。隔离或预算不能确认时保持串行。wrapper 原 floor 不变，组合门槛由实际开窗 caller 再核，不能仅凭 wrapper 旧 floor 通过就默认准许配对。
- 本次空间观察为 26,585,772,032B，仅是 02:49:24 UTC 的准备事实，不是后续运行授权；实际 OPEN 后仍重新核空间、claim、clean execution HEAD、全部输入和输出不存在。shared PG/WAL 与采样间峰值仍 unknown，不宣称静态硬配额。

## 唯一待开运行

仍只运行原 `apps/server/src/runner-claim-receipts.test.ts` 8 组：16 task、160 HTTP、理论最多 15 连接（8 server + 3 scheduler + 3 fixture + 1 admin）；work 120s、fixture cleanup 最多 70s、afterAll 80s、全自动收尾与外部工具完成合计不超过 200s。原 raw 1MiB / own TMP 32MiB、0 provider 不变。原 4 个 runtime-capacity 真 PG 消费者另列 NOT_RUN，不加入本窗口或以这 8 组抵消。

Mika 在本次收口时明确：61228 恢复 actual 已归还，Web Recovery 的 10s 检查仅为 local，Web 与本队均无 heavy OPEN / 预约，不将该 local 当作 PG 等待依赖。当前只待 Mika 指定本片唯一 namespace 与 OPEN，并确定实际配对 local 的预算；不追无关 main 更新。本次未见本片实际 PG fixture/reservation/child 输出；执行前须对所分配 `docs/evidence/s01p07/checks/<window>` 的十个既有后缀逐一 lstat：`.json`、`.stdout`、`.stderr`、`.fixture.json`、`.reservation.json`、`.child.json`，及 `.fixture.json` 后附 `.reservation.json` / `.root.json` / `.create-request.json` / `.database.json`。全部位于现 evidence scope；外部整体 wall/退出事实也留该 scope。临时根仅沿原 wrapper 创建的自有随机目录，fixture 位于其 TMPDIR 内，不触旧资源。

CREATE 发送前 reservation、ACK + OID/marker 归属、三态自有组观察、一次 TERM/KILL、EOF/leader/group 分列、普通 DROP 前零连接和精确目录身份等原门禁保持。失败或 unknown 保留原始事实和需要保留的身份，不自动重跑。

本段复用 `methods.json` 的本地 find-skills / clean-code / codebase-design，三份来源 hash 未变；核职责、错误/unknown、输出归属与真实复用，未新增框架或每条检查审批包。原准备审查（Mika，2026-10-06 20:53:17 UTC）范围不变，实际 PG 产品验收与 main 集成仍待完成。
