# X01-REMOVAL-REFERENCES-CLIENT

所属[X01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/plans/x01-plugin-management/plan.md)，co-lead Mika。目标：现FlowClient/CLI单registration材料引用一次一页，观测不等于删除许可。

- [x] X01RC-01 单一transport与纯ACK验证，保既有方法。
- [x] X01RC-02 CLI手动分页/错误语义，公开行为与focusedtypes。
- [ ] X01RC-03 独审/窄main接收。

Interface：pluginRemovalReferences(id,{materialInstallOperationId,cursor?},signal?)；plugin removal-references PLUGIN MATERIAL_INSTALL_OPERATION [--after CURSOR]。64KiBsuccess/4KiBerror/40条/opaque768，不自动翻页/GET/retry。空页也可next；409不reset；坏ACK UNKNOWN4，输入usage2。只核top注册/operation，同physicalmaterial引用允许不同operation；不以失微秒createdAt重构cursor或强加顺序。hostRelease unknown/physicalRemoval not-authorized/registration-only保持。

复用pluginAcknowledgement/request与parser，纯decoder只管shape+身份，无新transport/删除动作。按根modular-design、find-skills本地codebase-design/clean-code与brainstorming bounded（Mika已明确批准接口）。20min12:16:18–12:36:18含等待；child60s/累计120s/TMP16MiB/raw512KiB/meta2MiB，0PG/Chrome/provider/install。backend R1failed/R2NOT_OPEN不被consumer验证覆盖。
