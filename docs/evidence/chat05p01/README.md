# CHAT05P01 证据

固定base fc3246b307f5436ccecb97f38ccaba10c7a72a5a，独立native-activity-body树。当前源码和纯模块检查已分片固定；生产开通与真实PG读写仍未验。

- [Interface](interface.md)
- [设计输入](design-input.json)
- [原子领取](claim-receipt.json)
- [技能与质量](quality.md)

0provider；无安装/个人操作。纯模块验证准备与PG后验分开。

首轮纯检查：`pure-run-01` 21/22，>2MiB字节深比较超时（原exit1保留）；`pure-run-02` 仅该项1/1、8未选，完整Buffer字节比较后108ms。22不同检查分轮，不称一次22/22。2,097,275B材料被分为36事件/5批，最大JSON批702,184B；SDK mapper另核>2MiB公开材料与原prefix逐字相同。`types-run-01`记录实际tuple类型/narrowing和pg-boss声明缺件；前两者已修，依赖按批准精确链接。`types-run-02`因fresh1,011,576,832B未达门槛NOT_RUN，未启动compiler。之后新增final barrier与读取/预算保护检查尚NOT_RUN。

精确原临时目录只stat：见`pure-resources-observation.json`。两轮所有body fixture目录已正常移除；411B/134B独立Vitest生成cache仍保留，原raw2209B/609B保留。无安装/PG/provider/个人服务操作。

PG源码候选为`apps/server/src/native-activity-body/{fixture,body.test}.ts`，仅3case：实际ownerHTTP大材料与丢ACK重启重放、冲突/成功final前置/取消与篡改、legacy及033幂等。一随机markedDB、动态loopback port、实际createServer+显式本模块033/routes、原EventOutbox，0runtime/provider；不冒生产默认mount。至少1GiB+96MiB准入，90s工作/后续外层监督待窗口固定；原码仍NOT_RUN，不能据此称通过。checkpoint为追加并fsync，正常DROP前marker与3s有限零连接验证，tmp删除前dev/ino验证；未知保留。运行依赖/类型闭包尚待完整核查，不自动安装或因窗口空闲启动。

本轮受影响接缝：`c86dff85` 相对 `2dd72c8d` 将 ordinary persist 失败纳入同一 outbox failure；新增 storage failure、final barrier、quota/page integrity 4项及原outbox直接4项，另2项实际Claude adapter注入消费 optional port。选择与限额见`direct-check-plan.json`，这10项仍NOT_RUN，不由先前22项代替。

`types-run-03` focused tsc 实际exit2/2433ms：新增partial SDK夹具声明与默认UUID推断；`40af6d90`窄修。`types-run-04` fresh1,080,119,296B低于1,082,130,432B，NOT_RUN、没有compiler。原失败输出不改。

`pg-static-resource-closure.json`只读核209本地源、31个实际URL资源（含033、012/013、017/019动态数组）、3个workspace公开导出manifest，missing=[]；最初observer误假设plugin-runtime index，按真实package export纠正。第三方manifest/link见两轮dependency proposals/receipts；此存在性核不等运行导入或PG通过。

恢复准入轮：`types-run-05`与`pure-run-03`同次fresh1076162560B均未达各自原门槛，0child/NOT_RUN，不算测试选择或通过。source仍40af，唯一独立源审由native_center_owner进行。

## 2026-10-07剩余局部验证

原10direct与focused types已实际补齐，见local-resumed-20261007/summary.json。10/10、types0、3762ms，两组absent/双EOF；总28不同跨轮（原22+6新，4outbox受影响旧重复），不是重复旧22。产品40af无改，PG3/生产挂载仍NOT_RUN。原独审继续SOURCE_APPROVED_PENDING_VALIDATION，本次新增运行结果独立待核。主线ee98的18产品路径前像无漂移，15只读输入变化列于main-preimage-resume，集成须保主线增量，不能覆盖旧整blob。
