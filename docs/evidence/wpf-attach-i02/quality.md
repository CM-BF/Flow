# 技能与 clean-code

## 启动 2026-10-06 12:08 UTC

任务 stack：React19.3、assistant-ui0.15.23/core0.3.22、TypeScript、P01/FlowClient。按 find-skills 先核本地已安装技能，路径与内容 hash 见 [skills.json](skills.json)。已有相似本地版本，未联网重装；clean-code 来源 sickn33/agentic-awesome-skills，沿全局既有固定安装记录。实际重读 find-skills、assistant-ui、codebase-design、clean-code；复用前段已读 brainstorming（已批准设计）、React best practices 与 webapp-testing 方法。

应用：将材料不可变规则集中一处，由真实 Outbox/Queue 调用；binding 隐藏 private client/授权/取消，P01 是唯一生命周期。错误不吞成 unsupported，未知回执不换 key。分段测真实消费者，不复制 decoder、不改 protected 模块。约30分钟安全点以及交付前复核命名、单责、接口、重复、错误和资源释放。

官方参考：[attachments](https://www.assistant-ui.com/docs/guides/attachments)；官网可能新于安装版本，实际 API 以固定0.15.23/0.3.22源码为准，不升级。官方 composer async preparation 风险通过同步 submission capture 和 local receipt handoff 验证，而非修改 runtime。

本段 clean-code：计划边界/状态所有权与受控 scope 核对完成；尚未编写或测试产品源。未解决：完整 App 路径须下一阶段 amend，后续必须实际 HTTP/生产 App 验证，不把首段当完成。

## 第一工作段 2026-10-06 12:17 UTC

实际材料消费者先红后绿：最初28项5失败，修复材料冻结后28通过（中间3失败日志保留）。新增 binding 使用真实 PluginHost/FlowClient/Outbox/QueueCommands；FlowClient fetch 在本段为内存响应，不冒真实 HTTP。首12阶段五文件88 tests通过，类型首次发现context narrowing、后一次测试nullability，均窄修后Web types0；最后binding12复验。未运行PG/browser/provider。

clean-code检查：冻结只留一个实现，旧知识函数名是同函数alias；公共matcher唯一分派v1/v2，不复制协议。binding内private client与只读/上传权力分开，P01上传command只调raw端口不递归。stable view.key与可变route分开；Dialog关闭不撤pane读取资格。输入15s取消信号经过P01传到HTTP；storage初始化失败局部显示并保护raw。新增类型能力只在已有P01 union/validation，不建注册表。

root已证实官方complete恢复窗口；本段真实core0.3.22消费者（完整/需send准备两形态）验证失败后text/chips/controller一致及可再次capture。facade只拦自动reconcile，不吞用户显式remove；preparing/failed hold有显式恢复/丢弃/真实receipt交接边界，隐藏不解除；新本地receipt同栈consume，网络不清新稿。当前仍需要阶段二真实App组合和控制前onNew捕获，不将本段结果泛化为实际UI通过。

## 第二工作段安全点 2026-10-06 12:35 UTC

复核实际官方runtime准备、receipt所有权、fixture启动/清理、P01授权和stable-view。修复prepare/cancel不经onNew时pending悬挂，直接官方core四形态回归14项通过；CREATE后以公开GET刷新能力，未合成true。fixture从SSE整包buffer改真实流透传，启动Abort与finally共享所有权、20秒cleanup预留、原始失败轮次也计入600秒。六轮累计81.621秒，6库清理通过；仍未完成组合matrix。

当前发现：共享journal的unknown保护错误归属所有view，正在按实际view发起key限定；第六轮离线触发晚于本地receipt，是测试时序而非成功的准备失败证据。所有原报告不改，下一定向检查有新hash。没有改旧五模块、公共DTO/client或依赖。完整独审仍NOT_STARTED。

## 交付安全段 2026-10-06 12:47 UTC

固定 f82a3a7436f123ab741fd5ce845eb39cb752da3b。clean-code再核单一材料冻结/公共matcher、P01 rawwrite无递归、stable key与route分离、storage错误局部、host取消与record归属。新增view-owned upload key集合仅记录此input的journal.begin（最多继承journal16项限制），不把全局恢复目录当view草稿；A移除unknown chip后仍保护，空B同/异project无pin。原journal记录不删、不隐藏。

官方core混合恢复的事件顺序由root确认，原测试先recapture/setText掩盖直接remove。新增failure/cancel两项先红，最小修复在观察真实submission结束/草稿回返时记录restored IDs；不能等queued failed状态之后才识别。17 fixed tests通过，原五module不改。原稿held所有权与新草稿、显式remove与自动清理保持分开。

真实App/HTTP通过10+1项，production-complete仍含最后1失败，明确不是整轮通过；定向plain等待GET完成后通过。最终mixed三行语义delta只重新跑直接17与types/build，未冒完整browser重跑。15轮217.181秒+候选build1.181秒，清理无残留；中间harness/locator错误全部原样保留。当前22路径fixed/current hash一致、保护0diff、claim外0，独审尚未开始。没有真实provider/个人服务操作，main新history producer交组合验证。

## 2026-10-06 12:54 UTC 窄屏补验安全点

沿已读 clean-code/webapp-testing 方法复核现有fixture所有权与错误处理。只增加自有browser的longnames模式（25s工作+20s清理），不修改产品/原模块。首轮filechooser等待与click分开await使等待Promise先reject，Node中断；手工按本轮唯一随机库/创建时间/空连接清理，总39.143s。改用Promise.all立即接管两Promise，并在官方Add Attachment前显式打开Files取得能力；未降低长名几何断言。局部重跑待root确认，旧15轮不可覆盖。

12:55 UTC第二轮达到实际UI：双主题390宽度388→1740，证明完整文件名反复放入button形成不可断行min-content；优先短可见动作+完整accessible name，原strong保持全文，再有界CSS，避免仅断行造成重复长按钮。产品未改，先申请两literal。预算累加改为同轮budget/browser较大值，保守266.129s且不改raw。

## 2026-10-06 12:58 UTC 交付安全复核

已读取/核验v3原子scope后修改两UI文件。短动作与完整accessible name拆分只影响展示，无第二状态/权限或新依赖；原强文本保留文件名，CSS尺寸适配所有同面板动作。旧Single-upload门禁未改，专测逐文件真实ACK与draft ready等待，消除同步setFiles不代表上传完成的误用；Chooser两个promise立即接管。最终longnames源码hash固定，scope26外0、保护3模块/官方Thread/shared零改；Webtypes0与实际App2项通过。前15旅程不伪称用新CSS重跑，首长名轮人工清理/次轮产品溢出/修后首轮采样竞争均保原始日志。无未修作者发现，正式P2关闭待独审。

## 2026-10-06 13:02 UTC 批准metadata安全段

原样归档root新target独审，准确区分旧f82业务191通过与本轮仅UI/sampler delta只读复审；P2关闭历史不覆盖。纠正README首摘要、当前24源/26scope、3保护模块及main未接边界。检查命名/单一source/错误和限制措辞，无产品变更、无重复测试/build/browser；主线history合法attachment-only组合与MATURE06-04持久收据仍醒目标开放。仅实际parser/本地链接与源码diff验证后正常commit/push。
