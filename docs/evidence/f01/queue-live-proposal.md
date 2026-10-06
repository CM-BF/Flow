# 真实 Web 排队与同会话回复：待执行提案

2026-10-06 05:59 UTC，仅准备，当前 NOT_RUN。本提案是新独立预算，R02 5/5与CHAT 2/2保持封存；未获此提案的实际调用窗口，不运行模型。执行owner Execution Lead，runner_owner只读核方案；固定Web/main 3d4985fca060155435b159e0467815bf8e88b8b8，固定已加载center/runner fb906cb42391971a8b315dbd813f7633927d7265。使用独立动态端口测试Vite连接现有61227，不重启61228或后台。

## 预算与资源
最多2次SDK query；每次最多2turns/$0.20/60秒，总保守SDK估算上限$0.40/120秒。沿配置实际固定模型，不可用不换、不预热、不retry、不补第3次；0工程文件/终端/工具写。每query保存归一化usage及requested/resolved模型/实际tools与plugins/skills/thinking；unknown usage即停。resume继承usage不可冒充本轮增量，使用可论证的保守上界并注明，不能丢内部pipeline模型成本。

先以0模型专用fixture验证同一driver和严格locator，再等待GO明确实际运行许可。专用隔离浏览器进程，不关闭用户IAB、4320/61228/49922或其他tab。运行环境选择必须在许可前明确：专用DB/runner可清理，若选择保留常驻部署只创建本次专属会话、不清库、不停用户服务。两者不能混写报告；SDK隔离环境沿已审产品入口，不复用早期宽环境测试launcher。

## 两条消息与可证步骤
1. 专用新会话，第一条为“记住 <随机nonce>，现在只回复‘已记住’。”确认HTTP回执与实际对应task.status=running，不以本地isRunning推断已执行。
2. 必须从Web先提交持久pause并确认ACK，再在首轮仍running时 Queue next，第二条为“只回复刚才记住的标记，不要任何其他文字。”第二输入不含nonce。保存时间、queueId/turn/task关系和waiting读取证据。若首轮已结束，本轮覆盖NOT_PROVEN，停止或按已发生调用如实收束，绝不追加试跑。
3. 首条succeeded且usage已知/保守成本满足预算后，从Web显式 Continue queue；它只允许一条队列项晋升。失败/unknown/超限保持paused，停止，不以HTTP接受代替实际执行。此场景验证显式恢复，不宣称两真实query证明自动promotion；自动恢复保留既有0模型PG证据。
4. 第二条真实running后关闭仅本次浏览器进程，保存进程退出。新开浏览器重新连接原conversation，等待真实终态与第二assistant正文。专属browser退出后立即只读task：仍running才记录后台继续PROVEN；已终态只证明重新读取，后台继续项NOT_PROVEN。closedAt和数据库completed_at仅辅助，不假定两时钟完全同步。
5. 严格只查 `.flow-chat-group.focused .flow-tab-body:not([hidden])` 中第二个assistant正文，完整文本精确等于nonce。排除第一用户prompt、第一assistant、隐藏pane与单纯节点数。最终实际locator需QUEUE01固定source验证，不能事后放宽断言。保存实际浅色/390深色截图并目视。

## 证据与停止
固定main/实际loadedcenter与runner/Web版本、配置digest、SDK query计数≤2（底层provider请求计数unknown；内部pipeline可能多次请求）、两task/attempt同conversation/nativeSession且不同turn、queue入队时首轮running、pause/continue回执、所有原始时间与浏览器进程退出、严格UI断言、最终usage与资源处置。预算失败不改PASSED旧文件；任何backend成功但UI不足分开报告。本次只普通对话/排队，不关闭context/files/voice/steer/自然语言完整工程目标验收。

## 当前依赖
QUEUE01实现309ec0已独审并main3d；中心/runner fb906已通过SVC02受控升级、v3接受。05:52:51零模型共用driver预演10步骤通过；实际配置/服务/专用Vite代理预检已通过，见queue-live-preflight。固定Claude SDK0.3.290、claude-sonnet-5-5、tools[]请求、2turn/$0.20/60s。正式调用窗口仍待GO；preflight没有POST/模型调用。
