# P03 A2A状态轮询传输

创建/更新：2026-10-06。状态：in-progress。Owner b01_bounded_reads / gpt-6-astra ultra，lead mika。固定base ac4e34de2331dce276440df8969883c1883060ef。

目标：P02 runner只消费Task状态/artifacts时，SendMessage配置与GetTask均显式historyLength=0；保留A2APeer.snapshot/observe默认行为，固定官方SDK1.3.0和A2A1.0。零模型/云，不改lock、bridge、材料导入、租约算法或共享contracts。

方案：snapshot继续接受现有id字符串，另可接受显式{id,historyLength}选择；RequestOptions仍独立保留。Runner在send和snapshot明确选0。外部HTTP官方SDK handler是协议验证Seam，公开center/独立runner过程是直接consumer Seam；此Seam与用户/Lead派工一致，按tdd逐片红→绿，不mock内部实现。

依据：[A2A1.0 §3.2.4](https://a2a-protocol.org/v1.0.0/specification/#324-history-length-semantics)：不设使用server默认，0请求不返回history，正数只取最近N。已核本地SDK的optional字段toJSON保留0，但必须经真实HTTP验证，不能只用schema推断。

## TODO

- [x] P03-01 显式history选择、默认snapshot/observe保留、官方SDK真实HTTP wire/大历史bytes证据。
- [x] P03-02 Runner send/GetTask选择0，status/artifacts/digest/uncertain/recovery行为保留；直接consumer运行于唯一临时DB。
- [x] P03-03 固定commit、独立review与owner修复、dashboard聚合核验。
- [ ] P03-04 Execution Lead接收main，记录实际集成事实。

范围：领取的六个精确源码/测试文件与本plan/evidence目录。两片TDD分别先失败行为再最小实现；保持旧断言。生产协议范围是A2A1.0 JSONRPC，不扩展到旧0.3/新transport。真实official handler in-memory store是测试fixture，不代表Flow持久能力或上游执行容量。

验证：第一片显式0在wire存在、默认不设、正数最近N、1/1024条中文history的响应bytes，状态/artifacts保持；第二片独立子进程runner首次send和恢复轮询wire均0、同版本artifact与verification保留、uncertain不重发。使用动态HTTP端口；runtime.test先改独占临时DB，只清自己库，禁止触flow_p02/既有服务。按显式测试路径，Node24/pnpm9.15.4/Vitest4.0.18，保留失败退出码与实际测试数。

架构影响：A2APeer.snapshot Interface增加可选任务选择，runner读取请求减少history；公共中心API/FSM、SDK版本与外部依赖边界不变。交付由Execution Lead核实dashboard外部依赖/运行视图相关target说明，分支不冒充main。

边界：historyLength0请求省略history，不是总响应硬上限，不证明任意第三方peer遵守；artifact仍完整读取，既有guardedFetch响应字节/超时保护不改。只比较同task版本的UTF8载荷，不将RPC ID或首连时延作为性能改善。
