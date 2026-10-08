# X01-VERIFIER-CLIENT-ADMISSION01

状态：in-progress。所属大task：[X01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/plans/x01-plugin-management/plan.md)，co-lead mika。

通过现有 FlowClient 创建指定产物的验证任务，校验中心回执确实对应原请求。唯一状态权威仍是中心 commands；没有新哈希、重试器或 receipt store。requestIdentity 版本固定，含规范化 title/rule、registration/revisions 与完整 source tuple。中心先执行原 command 再追加回执身份；历史同 key 回放不重授权。客户端冻结 body/key，通过原 bounded transport 检验服务端身份、任务、binding、project；缺失/错误保持 UNKNOWN。workspace-wide null project scope 合法。取消/丢 ACK 由用户沿原 body/key 恢复，不自动重复受理。

- [x] VCA-01 独立树与精确领取
- [ ] VCA-02 六叶实现与公共消费者检查
- [ ] VCA-03 独立审查与受控 main 接收

验证仅 direct mocked transport/transaction 与 focused strict；真实 PG、公开端到端、worker 与个人部署不由本片证明。响应 65536B/error4096B 沿原接口；输入沿规范化已有 schema。新功能不修改旧 AV/VAR 固定运行输入。
