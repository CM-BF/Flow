# CHAT06 持久助手正文流证据

固定实现 **5ff8880b3518992121216998c169dd01ab44cee0**，base79d6204e4a5781a7041a1545a7424513feaccdae，已受控合入main115b/acfd依赖。此交付是SDK adapter→既有durable outbox→真实PG→owner HTTP的零模型片段；**没有实际provider请求、云调用、Web页面验收或现服务操作**。Root已独立只读APPROVED该实现；[正式review](../../../plans/chat06-assistant-stream/review.md)记录核对范围，未重跑检查。main/生产挂载仍待Lead接收。

## 行为与读取

固定ClaudeSDK0.3.290启用includePartialMessages，只接受parent=null的text_delta。身份来自session/native message_start ID/block index，外层wire UUID只作帧来源；完整assistant单块可先于block_stop，核对完整块但不重复append。多消息/多索引正文保留，工具前独立文字不丢弃；aborted、supersedes、缺起点/完整块、源冲突与不完整关闭均保留明确状态。缺失/未知帧不是凭空可恢复的文字，不能声称检测任意上游丢帧。

正文250ms或8KiB合并，封存后不改ID/seq，背压下不承诺固定端到端延迟；每attempt最多1MiB文字、256块、4096持久patch，mapper另有16384源帧/256工具界限、中心512 marker界限。超限明确截断/拒绝，未保存的文字没有取回路径。隐藏thinking、签名、工具参数与子agent正文不进主正文流，既有CHAT05工具观察仍独立。

主界面自动消费task+attempt+sequence增量页，不必展开工具详情，不轮询增长的完整前缀。每页最多8个patch，每个文字≤8KiB；初次从0分页、重连从已应用cursor，携task/attempt归属。列表仅轻引用；全文读取也绑定task+block。当前conversation聚合和liveAssistantText能力字段未修改；**route存在不等于产品Web已启用**。Lead须先协调Web兼容reader/实际消费者，再同批启用后端能力。

## 明确的最终结算

SDKResult没有nativeMessageId关联字段，本片**不声称provider一一对应**。Flow presentation policy `flow.assistant-draft` version1，在assistant-final的同一报告事务记录final/task/attempt/session、完整不交叉的replace/retain ID集合。真实root tool边界前先flush文字，再持久marker；中心验证CHAT05同attempt/session工具输入证据。最后工具边界前的完整文字（含独立text message）retain，之后的临时正文group由final替换；无工具用attempt-draft政策。源缺口、aborted、不完整、缺工具证据或文字跨边界则unavailable及reason，replace空、历史全部保留；final仍能独立显示。superseded历史保留其状态。原patch永不删除，final不会append成重复正文；验证/任务完成权威不变。

失败/取消/uncertain只保证已持久prefix仍可读并标interrupted。普通SDK错误/正常关闭在仍有所有权时flush已观察前缀；abort/失联不能承诺尾部内存flush，旧outbox中已持久的事件仍可重报。既有本机恢复不等于跨query/provider token流resume。

## 实际检查

最终[checks-final.txt](checks-final.txt)：**72/72，7个显式文件，11.56s**；[typecheck-final.txt](typecheck-final.txt) exit0；diffcheck通过。

| seam | 实际通过 | 内容 |
| --- | --- | --- |
| 新mapper/coalescer公开Interface | 11 | UTF8、完整块先于stop、父隔离、重复、aborted/supersedes、限额、timer、错误/关闭、工具前flush、缺完整块 |
| 新真实PG/HTTP/runtime | 19 | task/attempt绑定、轻引用、重报/重启、offset/hash拒绝、线性增量读取、失败取消、SDK闭环、ACK前后恢复、settlement/原子回滚、篡改拒绝 |
| 独立首次022升级 | 1 | 新专库实际旧schema1/2+009，先存task/attempt/detail，确认无022/无表，再首次升级保持旧行/空活动，再次幂等 |
| 直接Claude adapter消费者 | 26 | 原只读权限/session/final/usage/abort行为 |
| 直接node/graph SDK消费者 | 10+3 | 既有goal能力/工具策略保持 |
| 公共contracts直接消费者 | 2 | 原schema契约 |

三种SDK闭环均在result前通过owner HTTP读到文字；success保留两个独立工具前text message，并由canonical final结算工具后的draft（final正文故意不同）；failure/cancel不制造final。两次ACK丢失窗口在保存前/后分别终止runner并重启中心，再由原outbox恢复，不再次调用注入SDK。SDK query均为注入函数，不能冒充真实provider验收。

小型传输样例：[wire-bytes.json](wire-bytes.json)。98,304正文bytes，12patch，持久文字98,304bytes、持久patch JSON104,866bytes，owner两页JSON共107,220bytes。重连cursor后返回空页；未反复传递增长全文。数值仅为本例**逻辑JSON bytes**，不含PG WAL/磁盘物理写放大、HTTP/TLS封套或provider流量；不作吞吐/费用/首token声明。服务端每patch重读并重哈希已有prefix，累计DB读取为O(n²)，未做容量优化；Root列为REQ15/17非阻断后继（CHAT06-07），本样例不能证明DB容量。

初始红：[mapper-red.txt](mapper-red.txt)为公开空实现返回空，HTTP红为原事件入口400 unsupported_event。后续[boundary-red.txt](boundary-red.txt)、[integrity-red.txt](integrity-red.txt)分别定位迟到aborted/不一致schema、缺完整块及持久patch篡改读取。原输出保留；checks-first64与checks-before-integrity-refinement70是中间阶段，不替代最终72。中间typecheck-first有测试UUID类型比较错误，已修，不删原记录。旧CHAT05的85条未重跑。

重跑（Node24 / pnpm9.15.4；固定安装，无新依赖）：

```sh
pnpm exec vitest run apps/runner/src/assistant-stream/stream.test.ts apps/server/src/assistant-stream/stream.test.ts apps/server/src/assistant-stream/migration.test.ts apps/runner/src/claude.test.ts apps/runner/src/goal-tool-bridge/sdk.test.ts apps/runner/src/goal-graph-tools/sdk.test.ts packages/contracts/src/contracts.test.ts
pnpm typecheck
```

本测试使用随机`flow_chat06_*`专库/动态端口、自有runner临时目录，全部finally清理；[cleanup.json](cleanup.json)核剩余0库。不操作flow_i01/c01或个人预览，不启动任何真实模型。生产入口归Lead：先009/020、再migrateAssistantStreams(022)，注册registerAssistantStreamRoutes，公共export/client同批；本分支未擅自改server index/根依赖/conversations。

固定来源：[sdk-source.json](sdk-source.json)绑定实际本机0.3.290声明/package hash；官方[streaming-output](https://code.claude.com/docs/en/agent-sdk/streaming-output)于2026-10-06只读核对完整单块与partial顺序。已获准设计/技能应用见[quality.md](quality.md)，正式DTO见[interface.md](interface.md)。
