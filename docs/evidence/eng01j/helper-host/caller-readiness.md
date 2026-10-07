# 单stock入口：固定准备，尚未执行

本片实现前页next-run的最小组合；原四产品f15已审/main de1fe732，不变。新增两个evidence入口：prepare-once.ts调用现prepareDarwinStockHelper/takeLaunch；stock-once.py只编排现OPS14与已审stock-helper/run.py:exec_only，没有新监督循环、transport、授权FSM或生产入口。

唯一候选命令：

```
/opt/homebrew/opt/python@3.13/bin/python3.13 -B docs/evidence/eng01j/helper-host/stock-once.py --run
```

cwd固定原engineering-native-authority。stock-run-once目录必须不存在且exclusive创建；固定stock-inputs.json包含22个源码/配置/安装入口绑定，执行fresh重核，失败0stock拒绝。claim仍原ENG01J v1；执行前由owner fresh核并按Lead明确实际窗口运行，本页不授执行。TSX沿既有I02已装4.23.15读取，不装依赖；入口/package摘要不等整个系统与转移依赖payload不可变证明。

总10s独立alarm先于准备；无写盘的退出handler保持unknown。每子组根据同一monotonic总截止扣除已用时间，最多prepare2s和stock3s，另.2 TERM/.3reap，余2s用于证据与清理；不足则0child拒绝。借用相同已审OPS14，不靠node:test超时。stock最多一次，旧shim同PID exec，stdin只读regular、额外FD关闭、stdout/stderr是监督pipe；内部native参数固定，network/Mach/fork规则不扩。

prepare Node只生成受信launch材料和policy/request摘要；进程结束后外层将`-p`同文本落盘为`-f`并逐hash匹配。既有shim准确固定binary，工作目录与HOME/TMPDIR/CODEX_HOME沿生成材料。request≤旧shim1KiB；本实验只有一字节X。actual成功还需目标原dev/ino+字节X、baseline0且workspace仅两个原文件、完整payload/exit0/dualEOF/finalabsent。由于准备Node已退出，其host.observe闭包不跨进程伪恢复；这里的文件/响应断言是本次实验事实，host.observe仍仅已有注入检查，writeAccess始终unknown。

fresh≥1,107,296,256B；private≤1MiB末采/128entries、关闭core dump。每子raw硬上限prepare2048B/stock16384B，总低于64KiB；结果/元数据另作有限大小复核。保留完整限额内stdout/stderr，错误payload不等成功；首失败与cleanup独立。目标/request/policy身份与实际结果checkpoint先耐久，再仅same dev/ino scratch且所有已启动组最终absent/双EOF正常删除；任何不可观察资源保留，不自动重跑。这里private为末采/显式文件上限，非磁盘配额，不把它写成连续峰值。

入口目前只静态读和Python AST解析；没有运行prepare-once、stock-once、binary或新纯例，不把原5例当本caller实际加载证据。旧原始失败、页大小负例、原4局部检查与5新准备检查均不重复。本caller供唯一独立边界审查；真实独立helper即便通过，也不能提升app-server派生、模型资格/provider、可信全部writer撤销或个人服务验收。
