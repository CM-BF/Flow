# 双阶段host检查与边界

2026-10-06 14:44:50 UTC，architecture_read/gpt-6-astra。任务按本地find-skills发现已有TypeScript/Node测试与模块方法，应用codebase-design/clean-code（sickn33@bdacd76固定SHA，见Interface）/TDD，无新安装。已授权seam为invokeInstalledTool，真实材料准备和真实ESM import，不mock loader。

先固定46f40f736098f7072d548fc41165834fc4ad143d真实red：旧host在TLA期间撤权仍返回成功；增加最小二phase后最终一次21/21（14旧直接消费者+7新）/严格局部noEmit0，原red和清理raw保留。旧材料51、中心14和全库没有重跑。功能变化仅本地authorize第二参数和invoke前调用；外部Error不包装，pending未知原样，模块无新增状态/缓存/worker/IO层。

命名明确load/invoke，调用者负责当前权限权威；host只负责动作顺序/冻结binding，材料职责继续readInstalledPackage。每阶段授权后ownership+abort检查；import实际await窗口撤权、未知ACK、四个phase×ownership/abort组合、两次成功同一对象有行为断言。额外成本是一次权限往返，仍16KiB输入/配置/输出，稳定file URL，无性能提升宣称。

own测试根red1+green22逐清理报告及当前lexists核均不存在；没有扫描他人目录、删除私人数据或运行PG/provider。异步import/调用的合作abort仍不能卸载ESM/终止包，OUTCOME_UNKNOWN由上层现有retained/journal接线后负责，本片不假装有恢复FSM。当前授权未知通过原Error保持身份，调用者须有其受控deadline；host不对授权重新执行或重试包动作。

架构影响限本地host Interface从一次grant增加load/invoke两动作gate。生产中心live grant、shared frozen binding、runner retained/publicvertical仍后继；集成时由Lead在dashboard固定架构基线记这条时序，本owner不改全局图/共享接口。
