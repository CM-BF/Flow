# ENG01E 固定Interface

`parseCalculatorSource(source: unknown) -> CalculatorProgram | null`：最多2048字节、ASCII空格/tab/CR/LF和固定语法。完整文件为两个唯一 `export const add=(a,b)=>L OP R;` / `subtract` 声明，顺序可交换；L/R只能a或b，OP只能+ - * /。任何额外语句、注释、调用、属性、import、Unicode/控制字符或部分匹配拒绝。成功返回深冻结的有限算术表示，不包含可执行源码；不执行/import/eval输入。

`checkCalculatorSnapshot(expected: unknown, input: unknown) -> CalculatorCheckReport`：纯同步模块，expected须通过CalculatorBinding验证，由受信host提供 `{leaseId,baseCommit,headCommit,snapshotDigest}`；输入严格协议 `flow.calculator-snapshot.v1`，带相同绑定、完整 `files`（复用EngineeringFile形状）和全部文本contents。检查canonical engineeringSnapshotJson的digest与expected精确一致；完整集合必须恰好一个普通100644 calculator.mjs，base/index/worktree均存在、无新增/删除/额外/unsupported文件；contents只能有同一文件，字节/digest匹配worktree；集合数量在解析任何成员前拒绝。stage与worktree可不同，但都保留在完整snapshot绑定，检查只针对被绑定的worktree内容。

调用方必须从真实已停止writer后的完整host snapshot及读取内容构造此输入，并在未来接线证明内容集完整。模块只验证提供集合的封闭性/内容与绑定，不证明caller提供了真实完整文件系统，不接收任务提供路径、不读磁盘、不授予stopped、不伪造snapshot来源。缺数据/不支持文件/绑定不匹配一律 `rejected`，不运行任何被测代码。

受信checker内部固定sum/difference断言，解释有限表示，只返回host构造、深冻结的 `flow.calculator-check.v1` 报告：passed/failed与各断言、固定checker/policy版本、绑定和sourceDigest；rejected只返回有限原因。源码错误算术应failed，非法源码应rejected。无任意 expectedChecks、stdout、命令、callback或调用方测试结果入口。报告不是现v1 EngineeringReceipt，不发事件或触达中心；未来native purpose/profile/checker版本需独立接线。

这仅验证受限calculator recipe语义，不是通用JS执行器。旧fixture/checker/profile/runtime零改；无provider/app-server/账户/模型。实际native文件工具、写入完整停止、独立actor接受/拒绝仍属后继，本模块不能以host-applied替代真实native工程验收。
