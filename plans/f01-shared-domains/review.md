# F01 共享接线审查

**当前增量状态：APPROVED（O05薄client e28；生产挂载待另审，下方历史批准保留）
Review target commit：e28d547ed3b446a252595bd1960953382ffa4dd8
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

## CHAT真实运行限定报告

Root只读APPROVED `cc73ada6bf331fdcfadf7f61a30778ac4d892ab8`：19份manifest固定/working hash一致；独立核同conversation/session、不同task/attempt、第二input无nonce但reply精确相等、两正文digest、专用Chrome退出重开与SDK保守和$0.013442。目视真实第一图、原pending第二图和两份无遮挡重放图。无重跑/新query。结论仅真实后台两轮记忆+首轮UI、零模型重放；第二轮live UI仍NOT_PROVEN。thinking unknown、实际3plugins/3skills/内部Haiku与归一化usage非wire均保留，不关闭完整U11。

## O03同事务接缝与SDK环境隔离

Root只读APPROVED `dbb57268889b82efb74c330bbf268b13f01b6402`：两文件提取commandInTransaction/applyGoalCommand，原事务/幂等/锁/wake复用同PoolClient；源码与固定target一致，9/9真实PG与原始失败/安装/最终tsc均核。未重跑；不背书O03新授权。

Root只读APPROVED `26ddd8de9fde0d67e6e42bd81a583facc993a31a`：native SDK env允许清单与合成子进程回归，固定SDK替换语义、原red、26/26 green403ms/tsc已核，source一致，无finding/无query。仅环境隔离，不证明provider登录、HOME插件沙箱或工程写能力。SVC715ec启动器另由Execution Lead独审。

## CHAT04薄client / O03薄client
Mika独立只读APPROVED `83f7da6c6e366e3520c8373c7d21408dad5fb145`，3文件66行，2/2保存HTTP与tsc，未重跑；限定queue6方法。runner_owner / gpt-6-astra ultra独立只读APPROVED `dc9a9f1682aaf24a44e2630284aac03cb93685ed`，3文件71行，1/1保存HTTP与tsc，未重跑；限定O03八方法。两审批都不含生产mount/scan，后者等待独审，不能继承批准。

## CHAT04/O03 production mount
Mika独立只读APPROVED固定`b87a4bb1d6e6459eb97a689d6c32ab9f65d91d18`两文件，核11/11保存PG与noEmit，未重跑；默认串行scan/关闭等待与011/012初始化，原失败/owner修复均保留。当前生产index对target零diff。后补`dc506b9419cae76b679d0166e99f6a96ef62ac7c`仅测试，新增factory false到默认startup的真实flag消费1/1（2未选），无生产更改。CHAT04领域及Web reader的各自批准不扩展完整queue UI。

## O05薄client独立批准
固定e28d547，3文件52行，仅四个owner方法/导出/真实HTTP用例。固定合同589a；request原文/revision/key/digest、cursor编码、AbortSignal与409不暗重试。domain/PG/模型/生产挂载均非本增量结论。

Mika独立只读APPROVED e28d547ed3b446a252595bd1960953382ffa4dd8，现场clean846c1aa；3文件52行对target零diff，合同589a逐字相同。四方法编码/body/key/digest/CAS/AbortSignal与共同鉴权/409不重试，6manifest hash及1/1 HTTP/noEmit原始证据已核、未重跑；无blocking。仅薄传输，不提前批准领域/挂载/NL。

## O05生产挂载待审

Review target commit：208a928969c8e343ea09ecc06db80a6808bbbd74
范围仅上述三文件；Mika O05领域1f211与薄client e28各自已审。见[o05-production-manifest](../../docs/evidence/f01/o05-production-manifest.json)，8不同检查最终通过、原失败保存；不证明NL/原生query。当前增量NOT_STARTED。
