# O10 最小Interface（准备中）

固定产品fc113945ff73d1a43092d0a70b51e901aa4be1e2 / Claude SDK0.3.290。实验driver默认preflight，只核本地版本/schema/源码/配置，不调用query/auth、不建DB。

`--rehearse --output <new-directory>`：一次隔离PG+HTTP、独立runner进程，query transport合成注入；使用生产createServer/FlowClient owner native admission/runRunner/createClaudeAdapter/profile guard/verifier。支持固定坏init/Read拒绝/is_error等测试场景，不连接provider。

未来`--execute --output <new-directory> --permit <new-GO-record>`保留显式入口；本轮不生成有效permit/不调用。O10预算固定1query/3turn/USD0.10/60s，源digest/worktree/新approvalId/有效期全绑定。一次reservation和query-started均wx+sync，失败不重试。O08原许可种类/限额不同，不能拿旧permit冒用；仅复用其已审算法及通用stopWorker/recordHostDecisions。

结果为分层raw：requested/init、host决定、Read原生start/result、task/attempt/profile/input、typed final/artifact/verifier、semanticAcceptance=not-evaluated，资源清理独立。不会自动accept-delivery。凭据/thinking/原始tool参数不保存；合成材料及最终文字可保存供人工核对。
