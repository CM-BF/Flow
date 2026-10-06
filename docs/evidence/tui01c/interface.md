# TUI01C Interface

输入基线21e0a56c4b2b65a04a1e8d510a9d132e77c3894b；设计已由Execution Lead采用。

| Module | Interface / ownership | Limits / errors |
| --- | --- | --- |
| @flow/interaction/stream | 复用StreamScope/StreamPort/StreamHost与ConversationStreamProjection；新增projectBodySegments(turn,state)→中性BodySegment[]，readCanonicalFinal。只读中心patch/final/settlement，不拥有任务状态 | 原1MiB/256blocks/4096patches、分页与重试界限；hash/身份/gap不满足则stale/incomplete；dispose abort |
| @flow/interaction/activity | parseNativeActivityPage / parseNativeActivityBody，正文必须匹配已加载轻引用；不依赖Web状态类 | 每页20；正文按既有64KiB/truncated协议；redacted无正文 |
| interaction observation | 一个当前turn，2并发read；连接epoch与选择变化取消旧观察；中性正文段+一页活动+显式详情 | 0隐式tool/thinking/final详情；最多4正文缓存；退出不cancel；无后台turn缓存 |
| Ink/Web renderer | 渲染中性正文段，各自使用原UI/runtime；终端转义净化仅显示层 | 不合并不同native block；只按中心明确settlement替换；工具前正文保留 |

TUI命令：/turn <number>选择已加载回合，/activity [next]读取轻列表，/detail <number>展开当前页引用，/reply显式读取完整最终正文，/back回正文。默认观察最新回合；发现/帮助不触发模型，send经中心受理可能调用已配置runner。headless复用同controller。

客户端现有assistantStream/assistantStreamPatches/nativeActivities/nativeActivity/conversationDetail均复用，不改HTTP/contract。TUI构造client显式patch-v1协商，旧中心cap false继续最终预览。Web只从browser-safe子路径导入，不能根导入Node controller。

Web待交权后将patches/projection薄re-export，messages保留assistant-ui映射，native projection仅使用共享codec。Web package追加workspace依赖，pnpm-lock由F01负责，无新外部包。
