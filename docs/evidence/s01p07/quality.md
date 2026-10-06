# S01P07 质量与验证边界

2026-10-06 20:14:41 UTC，status_read / gpt-6-astra。方法来源固定在 methods.json，沿已安装 find-skills、brainstorming、clean-code、codebase-design、tdd，无安装/更新。

首段：把现 claim 分配 SQL/过滤保留在 runners.ts 单一私有内核，v1/v2 同 transaction + runner 强锁。compact receipt 单独模块只持久非空身份，不复用会缓存 empty 的通用 command helper。响应按操作区分 empty/missing；read current lease 向下取整并复用 AttemptControl 的 1..300000ms 约束，未续租。新 client 沿原 transport/no retry，v1 method 不改。

已写5组 contract 行为检查，全部 NOT_RUN；不是 red/green 证据。当前检查仅静态 diff/接口阅读，未执行 import/types/test/PG/provider。完整运行接线、journal、direct consumer 和真实 PG 仍待实现/独立窗口。候选依赖仅现成路径读取，无 link/install。source-supply-request 只请求固定 base 的缺失 readonly/test source，Lead sole materialization。

2026-10-06 20:25:05 UTC 安全点：journal 保持一处 durable change，初始化/accept 非空有写，empty 只读已有 key；runner 身份与旧 v1 unknown 分开。新三方法均 guard/pending；旧 peer 适配保留行为断言，新增直接恢复用例覆盖 lost ACK、missing 同key、restart、不可执行receipt、身份变化与fatal状态。无新增通用框架；0检查事实保持到原始receipt。18依赖link固定现成package版本，无安装或跨WT @flow。

首批真实局部检查：28新入口+42旧runner/stop+9capacity通过；旧CLI因未物化new URL入口失败，保留原断言/原raw，请求22source+protocol package metadata，不自行物化。types第一轮相对root路径多一级导致TS5083/TS18003，0源码类型检查；仅修own config三级相对路径，根strict未放宽。自有检查worker/group与temp全已结束清理，真实4PG未选。
