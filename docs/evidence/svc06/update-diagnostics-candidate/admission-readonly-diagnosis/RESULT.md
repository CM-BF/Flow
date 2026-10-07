# R4 后同操作只读 admission 诊断

原公开 status 前后都确认 draining/v19、同operation e6550b3c-1f67-4c2c-869d-e84d5e838113、active0/uncertain0。精确80B admission 是合法三键version1、assignments空、inFlight为非null UUID（仅摘要保存）；所以strict idle拒绝正确，未见schema变更。原R4丢失的结构不补造，此记录是单独授权的一次新观察。

426ms/exit0，自有组absent/双EOF、stderr0，无任务/模型/维护动作；私有0600观察记录包含身份/bytes/hash和安全shape，未复制admission正文或UUID。只读status内部原preview锁正常释放，不改变持久maintenance。

固定af51 runtime先检查journal.unresolved，再begin→真实claim→仅确定响应accept；recover不清未知intent。中心active0不足以替代缺失claim结果。公开同op/CAS resume可解除中心drain，但本地未决intent仍阻止实际claim；原host resume只适用于ready-paused，不能硬套。当前没有发送resume，没有清/退役/重投。

最小后继由Lead对当前精确intent作独立语义裁决，不能套旧已消费退役许可；若仅选择恢复中心接单状态，必须明确仍未恢复runner实际接单。继续更新需要本次受审保护/同operation维护屏障及旧runner确停。原drain900秒截止13:34:53.793Z不重置，未知保持。固定源字节与完整边界见conclusion.json。
