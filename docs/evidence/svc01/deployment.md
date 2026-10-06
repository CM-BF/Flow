# SVC01 实际部署记录

2026-10-06 04:37:35 UTC runner_owner / gpt-6-astra 收录Lead实际启动的脱敏输出；本次只读证据/提交metadata，没有运行测试、操作服务、读取私有config或发送消息。

- 已部署源码：`75a33dec228e17bbbd0d3be9fd01bc9ac18a0133`，启动时clean。main/origin接收由Lead确认；本owner实际核对715eca5为其祖先，且`tools/personal-preview/`完整范围diff为空。
- 实现目标：`715eca5f299fecda9e71a0c58c62f6fa7a5656dc`，独立APPROVED；同部署基线另含Root独审SDK环境隔离26ddd8d。后者不归本启动器review范围。
- Lead启动：2026-10-06T04:36:01.589Z，私有实例目录`/Users/citrine/.flow-personal`；配置文件没有复制或打印。
- 启动观测：2026-10-06T04:36:01.712Z；CLI退出后的状态观测：2026-10-06T04:36:06.754Z。两次均center/runner/web running、专库owned、center reachable。
- 产品Web：<http://127.0.0.1:61228>；中心：<http://127.0.0.1:61227>。原49922 fixture和4320工程dashboard不变。
- Lead记录的owned wrapper PGID：center49219、runner53414、web54573。本次owner没有另查进程或发送signal，以上是部署方观察，不是永久在线承诺。
- total=0、pending=0、lastTaskSucceededAt=null、lastHeartbeatAt=null。model配置为claude-sonnet-5-5，provider明确not-probed；本实例未验证真实query。
- 首次产品UI仍需操作方从本机0600配置输入owner token；本记录不宣称用户已认证或浏览器已验收。Lead后续补零POST浏览器证据，尚未收录。

## 原始输出

| 文件 | SHA256 |
| --- | --- |
| [live-start.json](live-start.json) | 84e09e2ff10004f82485cba661bc575010f055372679070368e7149104cee265 |
| [live-status.json](live-status.json) | c3b406314082effc65021da8dffe1a195613aa2e8f36c336801faf837a4d8db5 |

原文件逐字复制，不重写时间/状态，不把记录刷新为新观测。常驻服务保持运行；后续停止仍须使用私有状态的持有校验，进程状态不等于业务完成。

## 2026-10-06 04:38:36 UTC 收录浏览器限定验收

Lead于2026-10-06T04:37:24.500Z使用专用真实Chrome，同源连接61228，owner token只在内存填入；API只允许GET，0 POST、0模型、无pageErrors，composer可见且fixture标志不存在。Lead已实际查看[截图](connected-zero-model.png)，[原始浏览器事实](browser.json)与[04:37:28.258Z最终状态](live-status-final.json)原样保存。只此自动化browser已认证；用户Root IAB仍未认证。三个服务running、专库owned、total0/pending0，provider仍not-probed。此记录不证明新query或用户已登录。

- `browser.json` SHA256 `f08a714a560fe48570581d3ffcde73ef879b88f6364df82128bd1b701b67f3f9`
- `connected-zero-model.png` SHA256 `69714362f859f40d43b31f129afa6f702f7bf51f341fd6237bf56ac50c162b74`
- `live-status-final.json` SHA256 `fa761d11d969fcbe37b7b9f006d90dd3ef3eed2951e4a3e872e3aadfa47df91e`
