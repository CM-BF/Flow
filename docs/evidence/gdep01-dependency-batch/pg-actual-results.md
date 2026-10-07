# GDEP01 单次真实 PG 结果

固定执行 HEAD `850d61376373eb59df8afdf6004ef7dda030bd10`，源 `bcbce5cca9dbe4b8d504e0b06deed40f0039f765`。唯一窗口 GDEP01-DEPENDENCY-BATCH-PG-20261007-ONCE，8 选 8 通过、0 失败；不重跑。完整结果及限制见 pg-actual-summary.json，原件在 pg-run-62498c0a8b9d4eca89aa3328070d87a4。

199 个短依赖由一次产品 SELECT 返回，解码正文 UTF8 3870B，与固定旧顺序读取 oracle 相同。48000 等值后的完整跨界行返回 48001B；48000+合法1MiB跨界返回 1096576B。空输入零查询、重复顺序、Unicode/CRLF、四键绑定、缺失/hash/长度首错、回滚和项目锁竞争八项通过。EXPLAIN ANALYZE BUFFERS TIMING OFF 一份：Planning 0.143ms / Execution 0.482ms，仅此样本计划事实，不证明加速或生产时延。

准入原件：floor 17756192768B；outer-start free18019688448B，caller origin 再采18019680256B；不得回改。admin预检100-3reserved-6used=91可用≥19，pool已关闭。预检与主体分别计时，主体140s不借预检；512文件/20alias事后核符，13已审源对执行HEAD逐字未变。

主体outer开始22:45:32.728788Z、terminal22:45:34.364426Z；Vitest受监督1500ms，caller仅保留回执前1587ms。DB cleanup receipt22:45:34.309Z；精确caller回执和TMP删除wall未存，保持UNKNOWN，不从terminal倒推。outer PID/PGID87472在22:47:04.910696Z跟踪均ESRCH；这是后续确认时间。预检87406与主87611均exit0/finalabsent/MERGED EOF，完整原raw，无first/secondary/signals，初EPERM原样保留。

同一marked DB OID1362819，admin+aux闭合、0conn普通DROP+absence；未启动HTTP/listener。caller原件记同身份scratch移除并exactENOENT，未重访目录。外置公开许可/receipt10份9858B同identity逐字归档launch；原/tmp目录保留SEALED_PUBLIC_RECEIPTS_KEEP且无未来写入，不含配置值。归档确认22:48:09.320783Z，晚于运行收尾，不声称整个封包在140秒内。第一次归档因/tmp父级canonical映射在任何copy前AssertionError，处理事实留return-followup，0新PG/资源动作。

DB三安全点7602703/8969239/8969239B不是峰值；WAL128MiB仅规划，3连接是配置上限。种子为受控直接SQL，公开写入/execute/native/progression组合未在本轮执行，main未集成。局部结果待独立只读审查；原source/local/PG准备批准不替代本次结果审查。
