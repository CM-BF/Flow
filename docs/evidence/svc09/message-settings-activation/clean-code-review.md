# SVC09A 源码安全点复核

时间：2026-10-07T14:30:04.774611Z。范围：11个本片产品/专测文件及本地运行入口；源码 8d532613e876d34812554572fb32d46bf582de44。

沿已固定 [skills.json](skills.json) 的 find-skills/codebase-design/clean-code/brainstorming 方法，无安装。把槽位不可变身份与配置集中在 runner-slots，小接口由 preview/environment/maintenance/diagnostics 实际消费；原中心、进程监督、维护 CAS、合同 codec 与错误记录继续复用。没有新增一般配置框架/第二状态机。

检查命名、单一职责、边界、错误与取消：只准两槽、先 intent 后副作用、目录/内容 pin、未知保留、只关闭新槽、逐槽 CAS 与旧记录兼容。修复了后续 accepting version 被误认本次恢复、settings 错误归属和汇总遗漏第二槽 uncertainty 的风险；新增定向例并保留旧失败。新 runtime 在 drain/stop/spawn 前资格核验；生产没有具体提交常量。

局部注入消费者不等于真实注册/发布/专库/进程生命周期通过。文件 fixture 临时峰值未采样，原 Node experimental VM warning 保留。实际新 artifact、CORE 组合、PG、Web/TUI、个人激活和资格均需后继固定输入与独立验收，不作为本次完成项。
