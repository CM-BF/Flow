# WPF-QUEUE01 作者验证

固定实现`309ec0e37bc92cc0f91d8f3bfd8f9e9f6519432c`，base`14c61b4062f8040ba6c7239860929366e5bd3fc1`，Node24 / pnpm9.15.4 / Vitest4.0.18。所有测试0真实模型、0真实中心/DB。

| 检查 | 实际证据 / 范围 |
| --- | --- |
| 模块及直接消费者 | [direct-tests.log](direct-tests.log)：05:35:27 UTC queue15+conversation projection36=51 PASS；该次之后只改UI/脚本，不改被测commands/projections与直接test。 |
| TypeScript | [typecheck.log](typecheck.log)：最终UI+测试通过。 |
| 生产构建 | [build.log](build.log)：通过，fixture标记构建；已有assistant-ui/index两个>500kB warning保留。 |
| 实际App开发版 | [browser-results.json](browser-results.json)：11旅程，pageErrors=[]，failure=null。 |
| 实际App生产版 | [production-browser-results.json](production-browser-results.json)：11旅程，pageErrors=[]，failure=null。 |
| 固定源码绑定 | [source-binding.json](source-binding.json)：两报告各11个SHA256全匹配固定Git blobs。原报告sourceCommit=c80文档HEAD+dirty，未重写成后来的target/metadata。 |
| 范围与空白 | 实现commit staged diffcheck0；App/原outbox/profile/shared/lock依赖无变更。全metadata diffcheck仅原始build.log:21尾空格、direct-tests.log:11/typecheck.log:4尾空行报错；原log保持不清洗，排除三份raw log的源/文档check为0，不声称所有raw evidence全diffcheck0。 |

核心行为：不可变payload/key、unknown后401仍unknown、畸形2xx不确认、receipt旧ACK不回退当前GET、同queueRevision任务状态更新、分页去重/刷新去除失效项、读取隐藏/离线/超时隔离、命令不因隐藏中止、详情0→1→cache、pause重放后freshGET当前task且取消单独key、409不自动重发。父projection实测capfalse全client仍0queue reads，captrue显式intent且保留运行状态。

实际App脚本还证明运行中按钮和Enter均入队、ShiftEnter换行/IME不发/CtrlShiftEnter不steer、6000中文字符超过16000 UTF-8字节时原草稿保留且0HTTP/0新receipt；合法>512字符可入队，未将preview上限错误用于输入。未知enqueue离线再连原key/body不变、下一草稿独立，GET不把本地unknown猜成accepted。中心仅fixture显式promote，不从Web自动执行。

## 失败→修复与清码

1. [最初browser红测](browser-before-composer-seam.json)与[browser-failure.png](browser-failure.png)：实际Send primitive与form和Input一样受isRunning门禁，不能仅补键盘。增加Thread可选composerSubmit，显式queue按钮和form经公开composer.send({startRun:false})；旧普通follow-up仍官方primitive。无queue adapter/假isRunning，避免默认steer及client-tool abort。composer.send返回void；防连点由QueueCommands同步publish sending/unknown gate负责，不把SDK isSubmitting误说为HTTP等待。
2. [首生产脚本失败](production-before-await-receipt.json)与[原图](production-browser-failure.png)：脚本在上条receipt仍sending时立刻Enter，UI正确保留新草稿未发。脚本改等待Add to queue真正enabled，再注入丢ACK；最终生产11通过。保留失败原timestamp/source，不当当前失败。
3. 清码修复隐藏页面中已发送命令的迟到ACK触发后台GET：receipt照常保存，隐藏标stale并待显示再读；新增局部回归。
4. 删除等待项/确认组卸载后仅原控制仍持焦点且body无其他目标时，回Refresh queue；用户已转移焦点不抢。窄屏粘性composer可能遮住队列control，onFocus限定本队列确保焦点滚到footer上方；实际命中点/Enter操作验证。

## 视觉与范围

[浅色桌面](queue-light.png) · [深色桌面](queue-dark.png) · [浅色390px](queue-light-390.png) · [深色390px](queue-dark-390.png)。实际查看双主题390截图；无横向溢出，减少动画，折叠Enter与取消回焦点通过。[聚合摘录](dashboard-excerpt.json)：65源，stage integration、checks passed/review approved、两个proof unchanged、v1 active/matchesSource=true、issues=[]；采样时309ec0e+metadata dirty如实保留。root05:40:36已对固定target限定APPROVED，独立51 direct及CUA局部，详见[review](../../../plans/wpf-queue01-ui/review.md)；没有独立重跑作者22浏览器全套，不证明真实provider或多窗口全局连接预算。

AI Elements来源：[固定源与hash](queue-source.json)、[原始源](queue-upstream.tsx.txt)、[MIT许可](queue-LICENSE.txt)。只取实际Queue/Section/Item展示部分，existing Button/Collapsible/cn，省略无用途attachments/ScrollArea依赖；动作常显兼容键盘/触摸，减少动画类，本地布局保持浅深tokens。无新增生产依赖或根lock变更。
