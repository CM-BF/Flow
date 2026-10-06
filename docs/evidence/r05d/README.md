# R05D 工程证据

Stack：Node24.20.0 / pnpm9.15.4 / Vitest4.0.18 / TypeScript，本地find-skills查找已有匹配；读取/应用 /Users/citrine/.agents/skills/find-skills/SKILL.md、codebase-design/SKILL.md、clean-code/SKILL.md。clean-code沿Lead已固定sickn33 commit bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5、SKILL sha3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317，不反复联网安装。方法：严格配置唯一schema、显式可替换依赖、构造与执行生命周期分开、行为/资源验证按直接消费者。已授权方案以早期小Interface固定，不重复审批。

fresh PostgreSQL ledger确认5源码/本plans/docs无冲突，take后才写；main.ts等待S01停写移交，未领取未修改。R05C已mainf181d84，metadata1ca72bb push，claim949f12bf释放v2 2026-10-06 10:00:37 UTC，本scope保存predecessor-release，不再改旧WT。

D0已运行局部测试、未启动真实app-server/auth/provider。依赖安装使用本WT lock离线frozen；不得指向main的workspace symlink。后续每组保存原始进程stdout/exit/selected，不以fixture或配置声明代替真实启动能力。


## D0 配置片段验证

源码ad05cfd2a0d2c5ab769fddc5483805d5c164bcd4共4文件。显式Codex配置复用严格profile，启动factory由受信代码提供，JSON未知字段与权限扩大拒绝；factory缺失即unsupported，零构造I/O。互斥入口默认fixture，旧Claude loader/profile/hash/steering兼容；main.ts与S01并发逻辑逐字未改，CLI无生产Codex启用入口。

依赖离线frozen安装成功，581复用/0下载，4.1秒；manifest/lock未改，bootstrap.stdout/json。先有意运行新测试：已有15通过、新loader4失败、launch suite缺module未发现test；原red输出保留，不把0 test当通过。实现后第一组实际4文件50/50（launch10、configuration19、profile13、descriptor8），root noEmit0。命令误写不存在main.test.ts并未选到main消费者，随后明确main-concurrency.test.ts单文件22/22，合计72不同检查。每组direct process stdout/exit/selection见d0-*.stdout/json。

资源界限：单manifest 16KiB UTF8；共享读取分配16,385bytes并最多读取同数，多字节超限拒绝，不因stat后增长无界分配；finally关闭仅自己的file handle。测试创建自己的临时manifest并正常移除，构造factory mock调用0，不涉及模型/DB或原生启动。该文件读取界限是源码+行为证据，不是吞吐或生产性能提升结论。

Clean-code安全点 2026-10-06 10:07:27 UTC：检查4源码职责/命名/兼容/资源释放与接口。shared bounded reader替代两套file读取，泛型默认不扩旧调用方类型；小launch seam只组合实际可替换依赖，不发明registry/approved位/通用Git框架。无已知owner finding，等待独审；后继真实recipe与ENG工作各自新scope。

## 独审P2修复

2026-10-06 10:12:48 UTC：初始review指出stat→open(r)间文件可被替换为FIFO，open可能在fstat前阻塞。固定178ef49e568147849e63e08b3f7211ee5df823d3使用O_RDONLY|O_NONBLOCK，仍fstat检查并finally关闭。新测试真实替换FIFO，先断言flag防回归时挂住测试worker，再核拒绝与close恰一次。actual1pass/19未选，root types0；原72未重跑且原证据/manifest不改写。等待增量复审。
