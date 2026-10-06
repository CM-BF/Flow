# F01 共享接线审查

**当前增量状态：APPROVED**
Review target commit：095497dc1719d10df8309fdf17d95539fc891e06
Scope：X02公共挂载/export/client/CLI；CHAT生产入口37ab367另列同批检查。Mika独立只读APPROVED 095497：7薄client方法/CLI稳定key与schema/PG消费者检查完整核对，5源码与raw输出hash一致，无finding，未重跑。CHAT生产37ab由Goal Owner独立只读批准，核007/009迁移、鉴权后挂载、错误清理与10/10原始证据；未重跑。

## 历史已审接线

**状态：APPROVED**
Review target commit：36aeaff12000d77ebd025859f999c69612fce653
Reviewer：Goal Owner，只读，2026-10-06 03:02:23 UTC。

Scope：9db3ce1 protocol production挂载、71bff1f projects合同export/client/CLI、36aeaff测试setup适配。已读完整delta和新增真实PG/CLI测试；未运行工程测试。作者实际11/11+client4/4+typecheck见[质量记录](../../docs/evidence/f01/quality.md)。无blocking。G01/P02核心模块各自批准，不由接线审查替代；不覆盖G01自动调度、原生runner时钟、MCP持久交互或额外模型。

| Severity | Finding | Blocking | 作者回应/复审 |
| --- | --- | --- | --- |
| — | 无新增发现 | 否 | 绑定上述target |

可复制审查：先核对本plan/status及实际base/head/dirty，仅对明确新commit的共享接线差异只读审查，列已执行/未执行与限制；修复交owner，直接写入须Sol以上、独立worktree和有效claim。

## O01消费者增量独立批准

Goal Owner只读APPROVED `2b75416326162000e517d1e845cc7b9921b54695`，核clean metadata28aa5f5。完整审查3文件110行与实际route/schema、幂等/error、公开PG CLI测试，读取初次6/6、final1/1/typecheck及保留初始类型失败；未运行测试。O01领域相对6bb零diff，无blocking。只覆盖手动goal命令/read/input/history与CLI，不是自然语言或真实模型工程验收。后续CHAT客户端841另独立审查，不能继承本批准。

## CHAT薄客户端独立批准

Goal Owner只读APPROVED `84117ca1c7446ee2e2b50f0526f3460dd42a2869`：6methods/export/HTTP test、raw5/5(386ms)+tsc输出均已读，原文/key/revision/路径编码/鉴权/AbortSignal/unsupported409不暗重试；无blocking。未独立重跑，不覆盖中心PG/真实聊天。Web受控patch仅移除无关上下文，before/after hash和来源保存，不重测metadata。

## 执行配置client独立增量

Mika只读APPROVED，固定94f50acf38213caacb2852d740c818b8480e3d15，范围packages/client/src/index.ts、packages/client/src/execution-profiles.test.ts、packages/contracts/src/index.ts。1/1 HTTP(366ms)+tsc及原始hash核，未重跑；无finding。目录/发布仅薄传输，不批准CHAT03领域实现或后续SDK依赖。检查hash ac2b6fbbdbfd096e39c401e814484e46ef9690bee4ad42312c2f13bdf3747183，tsc1185ecf11053eb49f76c61e0735805fedcc40c0559340400df8b4df87f0a295a。

CHAT03 mount独立增量：Root只读APPROVED 300f0035b4c754cd09a4e38680378d8fb81924cc，仅apps/server/src/index.ts三行。检查/source hash见quality.md；不继承为真实模型通过，未重跑。领域Mika a28与thin client94f各自独审。

O02共享依赖：Root只读APPROVED dac8c3910eee1828e7081a3d33e19a89a056f4d4（runner manifest+lock importer），无resolved版本漂移。真实CHAT报告独立验收待Root，尤其第二轮live可见正文明确NOT_PROVEN；不能沿用历史接线approval覆盖新模型/浏览器结论。
