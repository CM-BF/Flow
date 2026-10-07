# ENG01J-05：stock helper 准备接口局部交付

source `f15dc1cc`：四个TS源与精确e7ff recipe输入，原C/R06/C02/G/I无改。 [Interface](interface.md)说明stdio协议与停止所有权；[下一实际调用候选](next-run.md)仍NOT_RUN。

本轮使用原已装Node24/Vitest4.0.18/TypeScript，0安装。5个新用例全部通过，4个旧用例未选；focused types exit0。两轮outer实际exit0，原工具输出数字如实抄存[run.json](run.json)；监督1775ms，含caller1820ms（两者与工具wall不是同一口径）。raw2037B、末采私有最大252B，均在checkpoint后正常删除，两组最终absent和双EOF。各reservation绑定本次四源、caller、fixture与配置；原始stdout/stderr和checkpoint不改。

3例是显式Darwin文件fixture准备与注入结果：读取固定binary核hash，**没有执行binary**。2例为纯recipe边界检查。测试中的X由测试写入，因此不构成stock成功；实际模型/provider、native file helper、完整writer停止均未验。原471通过、原shim/native启动失败和负例均保持。

clean-code/codebase-design安全点：一个recipe映射入口，一个host准备接口；复用旧digest/身份函数与OPS14，不复制R06握手、loop或授权FSM。input/output有界，冻结请求，失败消费单次spec，结果未知不重试；identity与输出不充分时保持unknown。潜在能力边界：返回launch描述不能使外部caller自动遵守FD要求；必须由后续实际OPS14+已审exec-only组合证实。read-only库目录亦未由摘要物理冻结。review待独立。
