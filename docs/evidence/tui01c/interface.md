# TUI01C Interface

输入基线21e0a56c4b2b65a04a1e8d510a9d132e77c3894b；设计已由Execution Lead采用。

| Module | Interface / ownership | Limits / errors |
| --- | --- | --- |
| @flow/interaction/stream | 复用StreamScope/StreamPort/StreamHost与ConversationStreamProjection；新增projectBodySegments(turn,state)→中性BodySegment[]，readCanonicalFinal。只读中心patch/final/settlement，不拥有任务状态 | 原1MiB/256blocks/4096patches、分页与重试界限；hash/身份/gap不满足则stale/incomplete；dispose abort |
| @flow/interaction/activity | parseNativeActivityPage / parseNativeActivityBody / nativeActivityIdentity，正文必须匹配已加载轻引用；不依赖Web状态类 | 每页20；正文按既有64KiB/truncated协议；redacted无正文 |
| interaction observation | 一个当前turn，2个实际并发read、4个等待槽；连接epoch与选择变化取消旧观察；中性正文段+一页活动+显式详情 | 0隐式tool/thinking/final详情；最多4正文缓存；退出不cancel；无后台turn缓存 |
| Ink/Web renderer | 渲染中性正文段，各自使用原UI/runtime；终端转义净化仅显示层 | 不合并不同native block；只按中心明确settlement替换；工具前正文保留 |

TUI命令：/turn <number>选择已加载回合，/activity [next]读取轻列表，/detail <number>展开当前页引用，/reply显式读取完整最终正文，/page <number>读取2,000字符显示页，/back回正文并跟随最新页。默认观察最新回合；发现/帮助不触发模型，send经中心受理可能调用已配置runner。headless复用同controller。

客户端现有assistantStream/assistantStreamPatches/nativeActivities/nativeActivity/conversationDetail均复用，不改HTTP/contract。TUI构造client显式patch-v1协商，旧中心cap false继续最终预览。Web只从browser-safe子路径导入，不能根导入Node controller。

Web已完成正式交接，patches/projection薄re-export，messages仅保留assistant-ui映射，native projection使用共享codec。Web package新增workspace依赖；F01锁输入f77c3979仅新增3行link，无resolved变化，本树原样消费8000bf9d。无新外部包。

BodySegment包含task/attempt/stream身份、draft/final、phase、taskStatus、interrupted/observationPaused/truncated。显示窗口不改原文/hash。显式完整final detail优先于preview参与digest核验；错误字节不进入正文。activity列表不是实时body订阅：task更新时间或状态变化后标stale，只有显式重新读取才清除。headless仍是命令快照，不承诺主动逐token输出。
