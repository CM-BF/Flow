# 原失败资源的独立收尾记录

2026-10-06 17:19 UTC。Execution Lead在原失败后单独授权：只核原reservation/checkpoint与自有数据库/目录/PGID，0连接及归属一致可正常DROP；不得FORCE或终止其他会话，原结果不改。

17:18:04的一次admin观察：`flow_tui01f_44a622c76d68` OID1160475、owner flow，当前connections=[]，两原PGID均不存在；身份对应原reservation、A/B/C和runner记录。没有输出SQL正文/凭据。17:18:30正常DROP后remaining=[]，未FORCE、未取消/重跑任务；见[观察](operator-observation.json)、[清理](operator-cleanup.json)。这证明后续该专库已正常清理，不能回写原afterAll为passed，也不能推定原失败一定是可见延迟。

原fixture没有存初始目录dev/inode，只有唯一mkdtemp路径与ownerPid。本次lstat看到真实目录dev16777234/ino123096289、无symlink，但不能假称初始inode已核。因此private tmp仍KEEP，本轮不rm；cache/外层raw也保留。原checkpoint/result/stdout/exit1均永久不改。raw先固定在7dd07e90fd72624c382bf6219dc9789c80e40c22，后续receipt是独立事实。

## 最小修正建议（未实施）

原connections代码只有一次即时查询，非空或任何异常都映成unknown，并丢弃rows/error。可在同fixture内给收尾观察一个短有界轮询（如总3秒、间隔50ms），保存每次有限pid/state结果和安全error code；查询异常仍明确unknown，不能用等待吞异常。只有零连接且全部原终止条件成立才能继续现有checkpoint→DROP流程。创建临时目录时保存dev/inode，在rm前核同一身份；未知仍保留。不要修改生产生命周期或取消规则来让测试变绿。

建议后续定向cleanup检查仅覆盖：非空→零、一直非空、查询异常、inode变更四分支；可使用现fixture的小注入观察接缝验证等待/拒绝与记录，不重跑两条行为旅程或旧36。若需要真实PG收尾直接消费者，再由Lead给一个有界专库窗口；本轮未新建库/未执行此检查。03完成仍需独立核本次行为与失败收尾及必要修正，04实际App未验。
