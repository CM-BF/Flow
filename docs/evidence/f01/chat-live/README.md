# CHAT 两轮真实执行与界面补证

实际产品main：`dd1b9dafc77fb56a580d3d41dc7ddec3b1996ef8`。原生Claude SDK0.3.290，执行时间2026-10-06 04:20:44～04:21:02 UTC。**2次query预算已全部使用，不再自动调用。**

## 已证明与尚未证明

真实中心/PostgreSQL/独立runner/产品Web完成两次真实query：首轮正文“已记住”；只关闭本次专用Chrome进程并确认exit0，新开Chrome恢复同一conversation，第二次输入不包含标记，原生session resume精确返回原nonce。两task/attempt不同、session相同，正文与当前attempt绑定，产物固定版本及中心flow.text验证通过。首次实际Web正文已等待并截图。无工具报告/权限拒绝，所有临时进程/数据库/私有目录清理，未动用户4320/49922/IAB。主动区段14.767秒。

**完整第二轮live可见正文没有被本次截图证明。** 原验收脚本只等assistant内容节点数量2，第二轮原图`two-rounds.png`仍是pending。原`checks.json`/stdout的PASSED和原图完整保留，不能据此审批完整第二轮UI。HTTP真实终态、nonce回复和谱系证据有效。脚本后来补了focused可见pane内第二assistant-content精确文本断言，但不再运行真实query。

另作**零模型、保存响应重放**：复用已批准Web HTTP fixture，只用两个真实保存turn/body，将第二项从pending切换为已保存final，等focused且可见的第二assistant-content精确等于nonce（不能匹配第一用户prompt/隐藏pane）。轮询后通过、pending消失；浅色桌面与深色390px实际截图已查看，无pageerror、无POST、0模型。见`replay-checks.json`与`replay-two-rounds-*.png`。这证明产品UI能消费这些实际响应，不改称同一次live截图或真实浏览器端完整终态验收通过。首次重放仅主题按钮定位写错失败，原`replay-checks-initial.json`/`replay-initial.txt`保留；修正为现有Use dark theme后重放通过。第二份窄屏图保留了展开的侧栏并遮挡正文，不能用DOM可见断言冒充无遮挡阅读；该图和检查保存为`replay-narrow-sidebar-open.png`、`replay-checks-sidebar-open.json`。后续仅零模型重放增加用户关闭侧栏动作，04:28:13 UTC通过后实际查看深色390px截图：两轮正文无遮挡可读。此次重放运行于main4e0289f；Web产品和fixture源码相对dd1b9daf零差异，新增插件模块并未挂App。原数据sourceMain仍指真实响应采集基线，完整区分见`replay-source.json`。

## 谱系与成本

Conversation `c61e9d0a-6c3e-42bb-bd6b-ce80f0aff948`；native session `f3e33626-864f-4ad1-8d32-cb4ca13951ab`。

| Turn | Task | Attempt | SDK样本合计 |
| --- | --- | --- | --- |
| 1 | 4d92c78c-7f05-4941-80c0-01d0019bea43 | f90a59b9-a3f4-4858-9bce-1e61a02ed213 | $0.004281 |
| 2 | a8acdec1-e24c-4e18-b05c-d6351a20b784 | a0de47e5-9575-4c68-8932-2d088bb63498 | $0.009161 |

两次SDK累计样本保守求和 **$0.013442 <= $0.40**；第二次baseline仍unknown，不当增量账单/全项目预算。请求和init报告主模型均claude-sonnet-5-5，SDK pipeline modelUsage另含claude-haiku-4-5-20251001，已计入，不能宣称所有底层模型请求都只有Sonnet。2次query不等于2次provider HTTP调用。保存的是中心忠实归一化的SDK modelUsage事件字段，不是未处理SDK wire全文。

请求manifest为0材料/0工具、plugins=[]、skills=[]、dontAsk、thinking disabled、每query2turns/$0.20/60s；实际reported tools=[]，thinking仍unknown（SDK不证明其生效）。**两轮init实际均报告3个plugins（agents-md、telemetry、plugin-authoring）及3个skills（design、doctor、plugin-authoring）**，与请求空数组不同；此实验不能称零扩展/干净上下文或公平harness对照。它只记录固定请求配置与实际报告，两者不混同。产品conversation.requested runner-default/configured-readonly与runner实际none/model配置分开。短回复无Read full reply按钮，浏览器自动详情请求0；长回复显式展开仍仅此前Web fixture证据，不冒称本轮真实展开。

## 资源与方法

`resource-receipt.json`保存端口/runner/进程ID，秘密未保存。Chrome67583/70702 exit0；runner67580/center66439 exit0、Web67581正常TERM143，均未force。清理后只读检查三个自建PGID无剩余进程。专库flow_chat_live_910ac310610c4674已删除。

真实执行脚本固定commit `de9dfdf83b88cdfc7e4d2411e15e14db222cf1f7`，路径`docs/evidence/f01/chat-live.mjs`；后来修断言的源码不冒充当时已执行。默认仅source preflight；`--prepare-resources`零模型资源检查；`--execute-approved-two-query`需要冻结main参数与明确预算，不可自动重跑。重放命令：`node --import tsx docs/evidence/f01/chat-live-replay.mjs`，独立临时fixture/Chrome并自行清理。

限制：普通两轮短会话，不是工程写改、NL目标规划、streaming、queue/steer、语义verifier或100agents容量。临时验收服务已清理；常驻产品入口由SVC01单独交付。
