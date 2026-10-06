# ENG01F Interface

`captureCalculatorWorkspace(workspace: EngineeringWorkspace, context: {executionIdentity?,signal,assertOwnership})`：唯一输入是宿主已持有的受管workspace handle及runtime只读身份/ownership端口，不能传task路径、文件子集、报告或stopped。缺失/非法身份先拒，不读取文件。宿主身份复制固定，每个阶段复核ownership/abort。

顺序：完整before snapshot → 仅在恰有calculator.mjs且有界时读取固定路径（复用readTextFile的NONBLOCK/NOFOLLOW/单硬链与前后stat）→ 由before完整files和读到的content构造ENG01E输入 → host checker → 完整after snapshot → before/after canonical digest及diff一致 → 版本化收据。读取字节/digest由checker对before worktree核验；metadata与实际内容不同也不可返回有效检查成功。完整集合有额外/删除/类型不支持时记录rejected证据，绝不忽略这些文件。检查/捕获竞态、ownership失效、异常/abort返回有限unknown且没有收据；不release、不emit、不completed。

收据独立协议 `flow.calculator-workspace-check.v1`：真实taskId/attemptId/ownerVersion/runnerId，lease/base/head、完整files、before/after digest、固定calculator源码或null、diff/digest及ENG01E报告。`writerSettlement:'not-attested'`固定，不能变成stopped。codec有界解析、验证身份/完整canonical/源码/checker结果/diff，归一化并冻结数据；host固定算术可重算，不信输入passed。JSON上限512KiB，源码2KiB，diff262144B与现完整集合上限复用。它不是flow.engineering.receipt.v1，也不是中心已接受的verification。

此模块不启动writer、不声称filesystem省略不可发生或后台写入已停止；未来native调用方必须由独立可信生命周期owner先证明停止，再调用capture，并在unknown时保留原reservation/journal。前后快照一致只证明本次观察内容一致，不是停止证明。现合成workspace与Git共同refs/config/.git仍沿受信同UID边界，真实native前必须在执行策略保护这些元数据；不把worktree锁称OS隔离。当前真实Git试验只使用自有新repo/受信合成写入，0provider，不以host-applied替代真实native工程。

4个新私有源码，旧workspace/checker/source-parser、profile、runtime/outbox和public contracts均不改；后继若公开新receipt/purpose由Lead单独派工。
