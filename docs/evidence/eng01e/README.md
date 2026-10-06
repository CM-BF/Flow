# ENG01E 可审证据

仅4新增文件：calculator-source.ts / .test.ts 和 calculator-checker.ts / .test.ts。源门27行、checker63行；无现有产品文件修改。纯Module：完整有限ASCII语法转深冻结算术数据，host解释该数据并独占固定sum/difference断言/报告，不import/eval模型JS、不信其stdout、不启动子进程。既有zod、snapshot canonical与digest依赖复用；没有新增包。

| 检查 | 实际结果 | 原raw |
| --- | --- | --- |
| 自有WT frozen offline install | exit0；Node24.20.0/pnpm9.15.4 | install.json / install.stdout |
| 初始行为红 | 33 failed / 34 passed（stub只null/rejected，不是load failure） | red.json / red.stdout |
| 初轮行为绿 | 67 passed = source34 + checker33 | green.json / green.stdout |
| 集合前置边界定向红 | 1 failed / 33未选；Zod先读成员的已复现风险 | bounds-red.json / bounds-red.stdout |
| checker最终绿 | 34 passed；33与首轮重叠，新增加1 | checker-final.json / checker-final.stdout |
| root类型 | 初次exit2（仅测试UUID窄类型）；显式String后最终exit0 | types.json / types.stdout；types-final.json / types-final.stdout |

68个不同用例=未改source34+最终checker34；不能将67+34简单相加。初红、定向红、未选和类型失败保留。所有日志为实际进程直接重定向，JSON记真实命令/起止/exit；green/checker-final还绑定当轮4源码bytes+hash。不为metadata重跑，未跑旧工程50/前片65、PG或provider。

边界：ASCII/2048字节、两个唯一箭头export、固定a/b参数与+ - * /、全输入消费。额外语句、调用/属性、import/process/循环、注释/Unicode隐藏、伪JSON+exit、后台写入/基线改写字符串都被门拒绝，未执行这些字符串。有效错误算术进入host固定断言并failed。返回数据/报告深冻结，输入后续变更不改报告。

完整集合：host expected绑定lease/base/head/snapshot digest，使用既有engineeringSnapshotJson核完整files；恰一calculator.mjs，base/index/worktree均为普通100644，contents精确一项且路径/bytes/SHA256匹配。staged/index事实与worktree均进版本digest，检查只解释绑定的worktree内容；新增、删除、其他路径、可执行模式、缺/多/重复contents、版本不符和自报stopped/pass/stdout均拒绝。此模块不能发现host省略的真实文件，因此未来host必须在真实writer停止后捕获完整内容集并持续核绑定；没有自行宣称完整文件系统来源或停止证明。

资源/性能：合法输入恰1文件/1内容、源最多2048 ASCII字节、2表达式/2固定断言，结果固定字段。异常数组长度不为1时在任何成员解析前拒绝；定向用例让首成员getter抛错，红→绿证明未读取。首轮source34运行3ms、最终checker34运行8ms（仅本机Vitest样本，不是吞吐或用户工程性能承诺）。产品无文件I/O、timer、queue、network、child或provider调用。

报告是内部flow.calculator-check.v1，不是现flow.engineering.receipt.v1；expected/input均运行时验证，报告无任意expectedChecks入口。只证明固定受限recipe的断言结果，不是通用JS执行器或实际模型工程验收。旧fixture/checker/profile/runtime、writer settlement和ENG01D接缝保持base；真正native文件tool、完整writer停止、独立actor接受/拒绝和未来purpose/profile接线仍开放，不以host-applied替代。
