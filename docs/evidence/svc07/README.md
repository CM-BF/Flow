# SVC07 公开事务生命周期证据

2026-10-06 20:04 UTC。Owner db_transaction_owner / gpt-6-astra，co-lead mika；唯一状态见 [status](../../../plans/svc07-transaction-recovery/status.md)。固定输入 22a0806bc2465e11096949618113833f31766b19；18路径供给364267B，源清单由Lead保存在 `/tmp/flow-mika-three-source-provision.json`。原子领取见 [receipt](claim-receipt.json)。

## Module 与 Interface

| Module / 所有者 | 输入输出与不变量 | 依赖与错误/释放 |
| --- | --- | --- |
| database.transaction | Pool、一次业务回调、readOnly → 原业务结果或最初失败 | 同一个借用client执行事务；监听从checkout callback内到同步release交接；坏连接destroy |
| 业务调用者 | 拥有业务幂等键、回调与恢复查询 | 不因本模块发生自动重执；回调自身无限等待无新增取消能力 |
| pg-pool | 拥有空闲/重新分配连接 | release可能同步给下一borrower；只移除自己的监听，不假定已idle/物理关闭 |

使用原公开 Interface 的 fake 可替换 Pool/PoolClient 行为，无新增公有 helper、数据库框架或全局 error handler。正常读写 BEGIN 保持原SQL；首次故障的内存状态每次事务独立，清理完成移除本监听。测试将记录SQL次序、回调次数、release/destroy次数与后继连接成功，不由模块拆分推断整体吞吐改善。

## 技能与质量

任务/stack：REQ-19/SVC07、Node24/TypeScript/pg8.23.1/Vitest4.0.18。按 find-skills 方法优先匹配本地技能：`/Users/citrine/.agents/skills/find-skills/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`，并用 brainstorming 的有界设计方法核对既有授权。无重装。

clean-code 来源沿既定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；本地 SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`。实际应用：单一连接生命周期职责、保留小公开接口、错误优先级集中、无重执/无复制业务状态机、通过公开接口反例验收。20:04启动复核确认不改两个已有专用插件连接，不新增抽象；完成段/交付前继续复核。

## 固定源码依据与验证边界

pg8.23.1 `client.js:416–422` 使查询失效并同步emit；其query失败排nextTick。pg-pool3.14.0 `index.js:344` 借出移除idle listener，`:385` release先接idle listener，之后可能同步分配下一borrower。官方 [pool文档](https://node-postgres.com/apis/pool#error) 将池error描述为空闲连接错误。

首片不启动PG/浏览器/native/provider，不改个人服务。真实消费者候选、完整SQL与专库另经Lead窗口；fake不证明历史事故根因或真实网络断连。源码/小检查门槛为fresh free≥1107296256B，依赖仅复用Lead提供的固定入口，所有输出与cache归本证据范围。

2026-10-07 HTTP交付安全点：[唯一实际消费者结果](http-checks.md)为1选1过、exit0、总wall2.979205375s；Mika已根据原始回执确认资源closure并归还窗口。固定233输入、manifest、产品e28、旧HOLD/PG原件均保持不变；没有重测旧15fake/2断连、迁移监督或新增依赖。沿既有clean-code/codebase-design复核职责、原失败保留、一次关闭及证据范围，当前仅归档等待固定结果独审/main接收。
