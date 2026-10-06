# S01P07 质量与验证边界

2026-10-06 20:14:41 UTC，status_read / gpt-6-astra。方法来源固定在 methods.json，沿已安装 find-skills、brainstorming、clean-code、codebase-design、tdd，无安装/更新。

首段：把现 claim 分配 SQL/过滤保留在 runners.ts 单一私有内核，v1/v2 同 transaction + runner 强锁。compact receipt 单独模块只持久非空身份，不复用会缓存 empty 的通用 command helper。响应按操作区分 empty/missing；read current lease 向下取整并复用 AttemptControl 的 1..300000ms 约束，未续租。新 client 沿原 transport/no retry，v1 method 不改。

已写5组 contract 行为检查，全部 NOT_RUN；不是 red/green 证据。当前检查仅静态 diff/接口阅读，未执行 import/types/test/PG/provider。完整运行接线、journal、direct consumer 和真实 PG 仍待实现/独立窗口。候选依赖仅现成路径读取，无 link/install。source-supply-request 只请求固定 base 的缺失 readonly/test source，Lead sole materialization。
