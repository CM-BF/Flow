# 最小零模型后继候选（不执行、不放宽现源）

本轮source0cf7与许可已消费，保留FAIL/KEEP；没有第二query许可。现只用固定源码和本轮已保存的规范化init投影，不重新查询目录/认证/模型。原始SDK wire frame未单独持久，observed-init.json明确是原plan.json的逐值提取。

| 层 | 已有权威与本轮事实 | 最小候选 |
| --- | --- | --- |
| 模型/运行身份 | exact model=claude-sonnet-5-5、runtime2.1.290与二进制hash；本轮init匹配，只是声明 | 继续严格核；result/modelUsage与实际资格仍独立，缺usage不估0 |
| 可执行能力 | requested tools=[]、exact两个graph allowedTools、dontAsk、SDK-source/connected的flow-graph、固定PreToolUse/center grant | 全部保持严格；工具/MCP/model/权限变动仍拒绝，不新增Skill/插件执行授权 |
| 插件/skill名单 | 旧O10继承的O08固定config仅历史声明名单，不是权限；当前私有HOME/persist=false recipe显示两plugin/两skill | 将“历史观察”和“本recipe受审声明”分开。候选为本source/environment唯一私有recipe固定此次完整名单；不接受任意字符串/自动学习新名单。新增未知、重复、缺失结构及冲突init继续拒绝。是否将已知非执行metadata缺省设为可记录差异，由Lead有限审查决定，当前源码不先改 |
| 执行与撤销 | adapter/单iterator/PreToolUse/中心ownerVersion/有限proposal grant唯一；插件名从未证明执行 | 不复制loop，不把SDK close或组absent升级为所有writer撤销 |

最窄源码候选仅原实验 `config.mjs/query-policy.mjs/query-policy.test.mjs`：明确绑定private环境的声明策略并加有效/未知名单/工具及MCP篡改直接例。普通adapter、SDK源码、历史O08/O10、许可及费用门槛均不改。旧O08 config注释本就只称observed names/non-trust；O16 config将其作为全环境exact值是此次静态可定位不匹配。不能把当前初始化成功等同正常SDK认证/实际模型资格。

结果可观测性两项另列最小实验修复候选：`driver.mjs`失败finally在首次checkpoint前从已收worker归并实际queryCalls，缺worker保持unknown；`operator.mjs`只记录有界安全的测量失败阶段/name/code及约束名，并在末测从durable resource facts获取原owned目录，未知不写0。不直接忽略ENOENT、放宽bytes、增加重试或回填旧结果。相关stub/故障注入足够，原15/16/26、SDK和PG不重复。源修改/新检查须沿原合法scope由Lead继续安排；此页仅可审候选。
