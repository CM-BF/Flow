# Native activity body：既有 Web 消费后继

合同固定 `7d0751b2d22afddd1da6b25bfa9db0c32ab772f4`，Web 消费源读取固定 `60ca1942411634843fda14e158f138191b832d8b`。仅合同与只读研究；domain、PG、mount 和实际消费均未因此获批。180来源是已登记、待实际加载，本组未取样。

[原研究](owner-report.md)及[15项固定对象核验](manager-verification.json)只收敛三个已有验收条件：

1. 沿未来正式公共 client/codec 绑定 task/attempt/activity/body 身份与分页校验，区分分片校验和完整摘要校验；不能自造 fetch/DTO。
2. 展开前零正文，按明确需求读取；一个共享 reader 有累计字节/条目/并发上限，保 abort、授权和 generation 检查，不把8MiB单体上限当浏览器缓存预算。
3. 为正文提供真实可到达的 Terminal/body-tab 入口，按字面显示材料，区分局部、receiving、interrupted、legacy 和工具状态；不伪造旧记录被截断的尾部。

归原 **CHAT05P01-06 / WPF-REQ-04、10、11、12**；公共输入交付依赖沿 CHAT05P01-05。不新增任务、claim 或 slot，不阻塞 backend 准备，不接管其他 owner 的计划。

[合同与依赖确认入站](lead-contract-and-dependency-incoming.json)同时保留 Lead 对 workspace-cache 有界确认的 ACK：其仅准备完整 metadata/恢复操作候选，所有实际 dependency payload 仍 KEEP，deps/preview 未改变。后续真实操作仍归 Lead 独立审批及 fresh guard，本组没有删除、恢复或运行许可。
