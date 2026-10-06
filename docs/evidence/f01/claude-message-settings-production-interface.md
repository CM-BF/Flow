# F01 消息设置生产直接消费准备

2026-10-06 17:14:15 UTC。准备源码 `5ce424ee5676b24863f3b0c3e5d21c578650a415`，只新增专测，**NOT_RUN**。F01 claim8470e7d2 v46已新增该literal；O14此前已main `bd14f984e3927df139815597c4c3171af84ec4b7`，原批准只覆盖73a，C01原树停止写。父能力合同CORE `ea276572c3c99fb8400808a93efc69ce530d55a4` 与C01 `563b1ea151d8d26a2100238d8faf26b697f38d71` 不重设计。CORE当前等待唯一正式独审；新test不表示生产已接入。

生产改动只需从`conversations/message-settings-migration.ts`导入`migrateClaudeMessageSettings`，在现createServer migration block内、030后且authentication/package worker/scheduler/onReady扫描之前await。现profiles/conversations/queue已由唯一注册入口在全局authentication hook后挂载，无需第二route/鉴权或新timer。CORE未APPROVED及受控输入未接前不改该入口。

专测唯一入口`packages/client/src/claude-message-settings-production.test.ts`：调用真实createServer，**不手动迁移032、不替换路由**。公开FlowClient发布合成configured profile、严格协商catalog并核旧reader隔离，发送冻结A/入队冻结B时修改调用方草稿；接受receipt、当前read和数据库snapshot保持A/B。精确多字节preview；已收ACK后关闭/重启以同key/body重放、异body409且只有1task/1queue/0attempt。该旅程不启动runner或SDK，不把profile记录当实际模型资格；没有observed execution断言。

一个随机专库；名/marker/创建请求先落独占0600 checkpoint，正常关闭app/pool、marker和零连接后先fsync清理前证据再DROP。unknown关闭/marker/连接则保留，不FORCE。证据≤32KiB；beforeAll fresh≥1GiB+32MiB，单case30s、setup30s、cleanup30s；外层工作120s+清理观察30s、raw≤2MiB/cache≤8MiB是待Lead窗口核准的计划界限，不是已测峰值。两库/额外SDK矩阵均不在此片。

动态资源闭包：沿已核208源/28SQL/19包的O14真实factory闭包，再增加032 SQL与migration入口；固定数组12/13、17/19不能被TSimport扫描遗漏。新增public client调用依赖C01固定方法/ACK/export；CORE约34源由Lead批准后受控接收，不能只复制DTO或伪造本树已有能力。实际输入准备状态见`claude-message-settings-production-inputs.json`。无新依赖安装/运行配置/公共client更改。

准备命令（NOT_RUN）：`Node24 node_modules/vitest/vitest.mjs run packages/client/src/claude-message-settings-production.test.ts --maxWorkers=1 --no-cache`。须CORE正式APPROVED、固定输入/materialization完整、薄032接线固定且Leader明确独占PG窗口后执行。Web B正在占窗口，本片不会启动。
