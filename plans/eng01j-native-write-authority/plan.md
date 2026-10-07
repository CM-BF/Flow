# ENG01J Darwin native write authority

所属大task：[ENG-001](../../../engineering-delivery/plans/eng01-engineering-delivery/plan.md)；co-lead Execution Lead。

沿已授权[Interface](../../docs/evidence/eng01j/interface.md)，先真实系统调用核关键机制，再决定有限宿主实现；不交空壳永远unsupported实现、不伪造模型资格。

- [x] ENG01J-01：独立树/原子七scope/固定Interface与输入。
- [x] ENG01J-02：真实自有syscall证明初始exec、拒派生/越界/委托及继承FD边界，原失败/退出保留。
- [x] ENG01J-03：实现受限Darwin启动层复用R06，固定FD风险与直接消费者；未授G完整grant，模型/任意IPC/完整撤销留后继。
- [x] ENG01J-04：固定源码/结果独立review与受控接收；真实native模型/网络/用户写改验收仍独立。

遵循根AGENTS模块化、时间与局部连续迭代规则。预算累计≤30s/新raw+私有资源≤2MiB，0PG/Chrome/provider/个人服务；本队local开始/实际清理归还一次通知。未知资源KEEP，不凭group或child close授权后续检查。

- [ ] ENG01J-05：按[stock helper最小候选](../../docs/evidence/eng01j/stock-helper-candidate.md)核实际内部参数/受限文件操作；原段已失败并获限定结果审查，转[既有启动正例收敛](../../docs/evidence/eng01j/stock-helper/convergence.md)。不重复model/list或单名页大小负例，不自动扩权限。

ENG01J-05已获Lead授权的四源后继见[准备Interface](../../docs/evidence/eng01j/helper-host/interface.md)：先5例/聚焦类型与独审，真实stock单文件另固定零provider工作段。原30s段已结束；本次为新≤60s/4MiB普通local，未追溯延长旧失败运行。

独立stock单文件结果已获审/main f39a，完整ENG仍未完成。下一范围只读收敛见[真实app-server路线与停止域](../../docs/evidence/eng01j/helper-host/app-server-route.md)：不重复公开fs外层边界或目录检查；新的受信平台域/两源码路径须由Lead明确scope与固定输入后实施。旧段预算不用于新平台运行。
