# ENG01D 可审证据

本片只有真实assignment不可变身份与现有普通Codex单回合提取。5个实际变更源码/测试文件；claim中的native-harness.test.ts未改，作为直接消费者核验。未实现native工程writer、文件工具、公开v2、production factory或新的SDK循环。

| 检查 | 实际结果 | 原始来源 |
| --- | --- | --- |
| 自有WT frozen offline install | exit0，Node24.20.0 / pnpm9.15.4 | install.json / install.stdout |
| 身份初红 | 2 failed，缺失identity导致原预期失败 | identity-red.json / identity-red.stdout |
| 身份+普通adapter+launch+旧descriptor | 64 passed = 2 + 44 + 10 + 8 | direct-green.json / direct-green.stdout |
| 已有并发unknown占用用例 | 1 passed / 32未选；不是33通过 | runtime-selected.json / runtime-selected.stdout |
| 身份最终顺序独立用例 | 2 passed，与64中的2重叠 | identity-final.json / identity-final.stdout |
| root noEmit | 首轮0，最终调整测试后0 | types.json / types.stdout；types-final.json / types-final.stdout |
| 静态提取核对 | 原body仅context输入rename后3968字节完全相同，事件块完全相同 | extraction-check.json |

65个不同检查，不把初红/重叠轮次/未选用例计入通过数量。所有stdout由实际本地进程直接保存，JSON记录命令/开始结束/真实exit；没有把工具摘录伪装为进程日志。初红保留。最终身份测试只将并发contexts的数组顺序假设改为按实际attempt匹配，产品没有后续行为改动。最终类型检查覆盖此测试。

真实HTTP身份测试用动态端口/合成token和自有临时目录，afterEach等待runner退出并关闭服务/移除目录。既有Codex矩阵注入真实Node JSONL peer；其afterEach要求每个自有child confirmed-exited后移除目录。普通宿主unknown并发用例沿现HTTP/outbox/journal。全部进程检查结束；本片没有PG、真实app-server、auth、provider或个人服务操作，不重跑工程50。

性能/资源：每个已admitted attempt新增固定4个primitive字段的冻结对象；无新队列/轮询/网络/计时器。回合原超时、输出上限、pump、close/finally和错误归一逻辑相同。上述局部运行时长在raw中，不能据此宣称系统提速或真实native能力。

身份是只读观察事实，不能替代assertOwnership。普通手写fixture context可不提供；新consumer缺失必须在dispatch前拒绝，不能从路径推断。单回合只接收有限prompt/cwd/signal/ownership回调，profile由现受信配置层校验；不持有host事件、claim或outbox。context本身仍可添加原goal/steering端口，只冻结identity值和该属性。

后继仍需真正native写入已停止的证据、host独占可信检查/报告、防stdout伪pass和后台写入、>=Sol模型资格/预算及显式purpose/profile版本。access:none/never/readOnly与本片注入用例不证明native工具隔离；host-applied calculator不得替代首真实native工程验收。
