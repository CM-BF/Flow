# CHAT04 v1 验证证据（v2 pause/resume 待实现）

实现 target `6fc9df40033e135159719121f7a3ae473d025a9f`（包含可执行 consumer harness，产品源码与77168cc完全一致），固定 base `dd1b9dafc77fb56a580d3d41dc7ddec3b1996ef8`。`checks.json` 绑定全部实现文件及原始日志 SHA256、确切命令、实际 UTC 与退出码。

- 最终 queue 15/15，`queue-final.log`：真实 HTTP + PostgreSQL + pg-boss。包含实际 onSend 断开已提交命令 ACK，原 key 重放仍得原 receipt，readItem 得 promoted 事实。
- 直接 consumer 22/22，`consumer.log`：原 `conversations.test.ts` 的全部 test body/断言保持；`run-consumer.mjs` 仅生成到已领范围，替换临时资源生命周期并显式 migration11，执行后删除生成文件。原源码/生成文件 hash 记 consumer-result。测试通过注入 SDK，不调用真实模型。首次缺已安装 SDK 的 0 tests 是失败（保留），复用既有依赖后重跑通过。
- noEmit exit0：`typecheck-result.json` 有准确命令/时间；初次参数隐式any exit2保留。首轮14矩阵不与最终15重复计数。
- 首red除了预期enqueue未实现外误用了Vitest afterAll中的expect.poll，清理失败；仅本worker唯一库确认0连接后正常DROP，恢复见 first-red-cleanup-recovery。修后red与各green自有DB均清。没有强制DROP、停止他人服务或旧 flow_chat01 suite。

## 关键行为与限度

conversation锁先于task锁；task、pg-boss wake、turn、item promoted同事务。受控数据库触发器使item更新失败，公开queue/turn不变且无孤立wake；scan单项失败报错，公平轮转已先提交，从而继续其他ready项。轮转不增queueRevision。列表只waiting，SQL从PG取最多512字符前缀及byte长度标记，输出再按完整code point截≤512 UTF8 bytes；detail才取全文≤16000B。pending≤100、page≤50。

成功后的known session/初次空conversation可提升；failed/cancelled/uncertain/active/unknown或missing session/invalid pin/busy session冻结。SQL fixture只构造有出处的执行状态来验证queue门禁；不冒充真实模型或128-agent容量。22个直接消费者用例覆盖既有 runner/assistant/session 行为。取消待提升项和提升持同锁裁决，promotion先时明确返回task引用；follow-up不得插队。

真实生产迁移、路由、public client、定时scan/onClose与Web入口由Lead分别接线；本branch不能据模块通过声称生产入口已挂。Stop与success竞态意图边界待Goal Owner确定；当前仅按真实task状态，不新增stop-all/pause。

## 资源

`latest-cleanup.json` 与 `consumer-cleanup.json`：两个独立临时数据库仅创建前拒绝既存、关闭全部own pools/centers、等0连接再普通DROP，remaining[]。随机动态HTTP端口。固定 Node24/Vitest4.0.18，已安装依赖复用，@flow contracts 指本WT，未安装/改lock。
