# O16 已确认目标的未消费授权替换

本轮实施于 2026-10-08T02:41:54Z 开始，前置只读设计于 02:37:15Z 开始。执行者 native_center_owner / gpt-6-astra；原 55c4e833 v1 exact3 于 02:42:09.829Z fresh active，工作树 222e933a clean。当前仅源码与合成消费者；0 实际 PG/native/auth/query。

Module 只负责已确认、已过期、零 admission 的 progression 替换。使用原公开 GET/revoke/create；不重新确认提案、不重新 planner、不修改图或两份输入。原 confirmationBinding 不变；新的 executionAuthorizationBinding 同时命名旧确认/旧 progression 与新 progression/hash。真实 assignment 仍由原 host/worker 对新 progression 与实际 task/attempt/profile 核验。

同一原 run、原 DB、两个原 private 目录继续 KEEP。原 journey.json、confirmation.json、pause-renew.json、pause.json、resources.json 全部保留；新工作状态与资源/pause 使用固定 execution 文件名，原件不覆盖。新阶段追加的状态、监督输出和后续 children 全计入原 private 8MiB / run 2MiB 总额，不创建第三 private、不重新获得容量。原 material/凭据路径仅由受信资源模块沿原来源读取。

准入先验证原 packet/源差量及同 run，再独占原 pause-consumed-renew.json 与按旧确认摘要命名的一次记录；它与原 children 入口共用同一旧 pause 消费门。部分写/未知留 consumed，不换 run。新阶段复用原 operator/监督和资源生命周期；扫描关闭，在实际公共观察证实过期/0 admission/两 execution null/current revision/input/material/profile 后，分别持久 revoke/create intent 和 ACK。任一步 unknown 停，不重发、不回滚或清理原件。

三类期限分开：总体剩余预算最多两次且此前未消费；READY 后的新阶段准入区间；每个实际 stage 120s 工作+30s 收尾。候选的中心授权期限是新明确绝对值，覆盖该阶段关闭后的新 15min pause 和 children 完整 150s，最多 24h 且不从旧 renew expiry 推导。源码额外要求创建前与 pause 前有足够覆盖；时间不足停止，不延长。实际资源窗口及新 GO 授权未签发。

实现复用 codebase-design 的内聚 Module/受信 Interface、clean-code 的单一职责与首错误保持、brainstorming 的已批准 bounded 设计；find-skills 检索本地匹配技能，无安装。路径为 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,brainstorming}/SKILL.md，沿已有固定技能基线。局部检查在 S01 实际 RETURN/明确许可后才执行，显式文件与选择条件；旧绿例不重跑。

实际局部已于2026-10-08T02:56:24.504Z归还：12不同/13选择通过、3975ms/4027B，原件见[validation](validation.json)。第二非空cache按empty-only KEEP，不读旧private。生产源214a9bf，最终测试增补source8b31a1fedb0b7d8400c0ee0c997761710bc935a0；sourceDigestd6eb39e51601d66b21919346b302a7035bdeb4ed95470398389ea183d41be30e。本次clean-code安全复核已完成，具体三期限/入口/额度见唯一[candidate](candidate.md)；仅候选，不生成actualgrant。
