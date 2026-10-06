# S01P03 实现质量与限制

2026-10-06T10:27:55.254681+00:00，status_read / gpt-6-astra。本地技能及精确hash见skills.json；Mika先审定ce30ec7方案，再逐片red→green，不安装技能/依赖。所属FLOW-001，co-lead mika，claim v1精确4scope。

生产改动限runtime：requestSignal私有函数允许显式取消来源，唯一claim调用选内部fatal shutdown；默认仍沿用原options.signal。deadline仍由发请求的那一次AbortSignal.timeout创建。input.signal立即阻止后继admission、中断现有active；journal持久权威、late assignment不启动、outbox/native unknown及fatal原错误传播保持原实现。没有新增public参数/调度器/状态机或通用fixture框架。

TDD首次环境导入失败0 tests完整保存；补齐被Git忽略的既有包依赖链接后，原代码的1项真实null-cross-stop red出现非空UUID；最小fix后1 green。最终新增10项通过（涵盖该1项，不能累加11），原runner33与capacity19通过，4 PG未选中。所有测试从public runRunner进入真实loopback，私有真实journal/同目录重启；只在时间/文件系统外部seam做可控gate，child强停是真实自有Node进程且awaitclose。resource-check.json明确日志未保存数字PID，证据是实际执行断言/hook，不能声称额外OS扫描。

clean-code安全点：命名区分普通停止与fatal请求取消；只改一个必要选择点和既有helper默认参数，错误不转null、不重试、状态不复制。新测试helper只有本文件使用，保持真实HTTP、有限测试生命周期与显式finally。原消费者、journal、AttemptControl、outbox、client、tsconfig/lock逐字节等于base，未删断言、未调宽超时让结果通过。测试已有native unknown/fatal被吞场景继续通过。

根级noEmit因TUI/interaction未安装依赖失败已保留；Mika批准局部tsconfig只覆盖runtime/新shutdown/原runner/capacity及其imports，继承根strict/ES2023/noUnchecked等全部选项且noEmit0，不冒称根strict通过。normalstop并不保证活动原生执行已停止、late non-null仍保守blocked，完整未知claim恢复仍开放。没有真实PG/provider/mixed后继运行，也没有CLI/main新信号接线。

架构影响只涉及runtime内部signal所有权；公开字段不新增。固定target之后交architecture_read独立只读审查，不沿用方法批准或自批；main集成与registry登记归Lead。本源码和原始检查日志冻结，metadata可后随。
