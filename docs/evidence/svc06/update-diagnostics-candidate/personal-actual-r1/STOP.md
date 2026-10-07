# 启动前调用失败：个人未操作

原只读helper `facts.mjs` 的主入口要求一个输出路径。此次漏参，在第112行 `OUTPUT_REQUIRED` 退出，早于 `snapshot()`；51ms/exit1，owned组absent、双EOF。原始stderr仅源码路径与参数错误，未包含凭据。53runtime、3input、4alias、978包文件、claim v9及空间已fresh核过，但个人安装/数据库事实尚未fresh取得，不能称所有准入通过。

0个人读取、0SQL、0迁入、0替换、0报告/策略写入、0维护、0provider。个人迁入run与outer仍不存在。保留preflight-bindings与fresh-before-outer，不重写原件、不自动再执行；窗口已告Lead归还。

后继正确只读接口是固定Node调用原helper并传入全新独占0600结果路径；已有helper自行durable记录，监督stdout只是摘要，不能按完整facts解析。修正只涉及操作调用参数/读其明确输出，不改已审migration source或产品；本记录不授权继续执行。
