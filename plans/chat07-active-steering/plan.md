# CHAT07 持久修改指令协议

状态：in-progress。Owner runner_owner / gpt-6-astra。2026-10-06 06:57:05 UTC。base07b7e5bdbd8c9f68e8e7de7e13a03d60f948999a，024已正式预留，合法claim见status。

本片交付owner持久单在途命令、当前runner的fenced收据与final seal事务seam。生产steer capability和受理保持关闭，不改claude/runtime/旧events；未接seam的旧final不宣称已有竞争保护。真实runner消费、SDK streaming-input/interrupt、预算和Web启用是后继，0provider/无模型预算。

命令绑定task/attempt/ownerVersion/controlRevision，现时授权/fence在同key重放之前核验；一条在途，重报幂等，未知不自动重投或建新task。received、observed-consumed和模型遵从分开；观察收据是受信runner报告，不是独立provider证明。正文按UTF8字节有界；列表/收据只轻metadata，文本经owner授权lazy detail读取，不复制到每次heartbeat或状态页。

final seal和受理共用runner→task→attempt锁序，必须在调用方写final的同一事务中执行。未知/未决拒绝seal；seal先赢后续指令冲突。只测试本领域seam的真实双事务竞争，不冒称旧事件主线已接保护。

| TODO ID | 交付/验收 | Owner | 依赖 |
| --- | --- | --- | --- |
| CHAT07-01 | 固定DTO/入口与有界设计，真实领取及三件套 | runner_owner | GO已准最窄方案 |
| CHAT07-02 | 024/持久命令/轻读与lazy正文、审计幂等 | runner_owner | 01 |
| CHAT07-03 | fenced收据、unknown及同TX seal竞争 | runner_owner | 02 |
| CHAT07-04 | 随机专库真实HTTP/双连接竞争、首次升级/重启、独立review | runner_owner / Lead | 02/03 |
| CHAT07-05 | 后继runner/SDK及旧final同TX接线、公共能力与Web | 后继owner待派 | 首片通过及独立授权 |

仅五literal：packages/contracts/src/active-steering.ts、apps/server/src/active-steering/、packages/storage/migrations/024-active-steering.sql、plans/chat07-active-steering/、docs/evidence/chat07/。共享export/client/mount归Lead。技能本地find-skills/codebase-design/clean-code/tdd/brainstorming已读应用；有界方案已有GO批准，不重复普通审批。HTTP公开Interface红→绿，错误/锁序/保密/清理作为验收，不跑全产品/现服务。
