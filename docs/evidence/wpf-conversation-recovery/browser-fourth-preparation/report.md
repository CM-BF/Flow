# Recovery fourth9835 — static PREPARED_NOT_RUN

固定 metadata `4c0852e6295e64216c8f3b34cfc626db08f06beb`，19源=`9835e7488dd9b0b44b3afbc285336defdd739e98`，工作树/branch正确且clean。2026-10-07T04:48:00.233681Z安全D04 list核原6ff988b2 v4 active/原21/唯一owner/overlap=[]，仅静态准备、不是资源准入。原50 direct与10项真实转译受控检查不重跑，完整feature target UNKNOWN / review NOT_STARTED；三个实际browser失败、清理和原预算保留。

## 原入口及最小变化

Parent与worker仍同一原文件：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery/apps/web/test/conversation-recovery.browser.ts`（SHA256 `3646f92d261f46dfbf6a03107deec4775d962f74fd01d55abde1f26817c5daba`）；worker仅原parent经IPC以`--worker`启动。fixture仍原 `apps/web/test/conversation-recovery.fixture.ts`（SHA256 `cb3cb9577f7833c8d56f9dc35274e0e3b7dca8a7524a969f63ac9fbefd3765f3`）。前置built-ins、原marked DB lease、两自有进程组、harddeadline、250ms轮询、晚终态/actualexit分类、native Chrome sandbox与原业务断言均未改。不是独立新runner。

对已消费next8ed的唯一码差异在 `source-minimal.diff`：两处page-evaluated IDB包装改为已审method定义，防TSX keepNames闭包外__name；不删page-only auth loss/CSRF/offline/视觉焦点断言、不注入全局helper。静态抽取parent字节等8ed；源码审与实际旧负例/新10项serialization出处在manifest，不能当实际nativeIDB/browser通过。

本包只重绑metadata HEAD、browser源hash/已有源审、第三次18份原件、晚预算与新claim观察；没有复制旧gate、创建run目录、adminenv、可执行wrapper或预约。既有已消费packet全部只读保留。

## 固定输入与保留证据

`manifest.json`列19 source/current/fixed一致、9公共输入、11 package真实路径/版本/packagehash、11 runtime入口、Node24真实二进制hash；Chrome可执行文件与plist仍旧固定版本154.0.8037.98。@flow仍指Recovery本树，第三方只读donor为web-attachment-production。现99项静态核验无差异；这不是完整动态import闭包或运行就绪保证，不安装/恢复依赖、不借已退役workspace-cache。

原25份加第三次18份，共43 raw / 83,339B，逐hash及当前Git原件核符。第三次晚parent stdout=12,843.615667ms，累加先前晚25,520.435ms，权威累计 **38,364.050667ms**。三budget.json的较早序列化累计38,356.250334ms仅保历史；原parent仍扫描这些旧budget，不回写历史，future gate以更小晚终态余量兜住总90,000ms。

下一整数 **51,635ms total = 36,635ms work + 15,000ms cleanup**。64MiB scratch / 8MiB retained evidence / 5MiB每run预留 / 1MiB process log不变，原start 1,207,959,552B、stop 1,140,850,688B不变。仅数本owner retained logical evidence 1,245,027B，预留5MiB后仍余1,900,701B；这不是physical占用、fresh free或瞬时峰值，无statfs/free采样。最后原件显示DB removed/0connections/remaining[]、ownedgroups absent、scratch removed、fixture cleanup完整；本批没有运行/残留的新进程或服务，也未额外探测进程。

## 实际launch最少条件

1. root/manager明确交接本次**实际PG + 自有HTTP服务 + Chrome**窗口；不能叫0PG、不能与ENG01I实际PG或Quick b2浏览器并跑。静态准备不占预约。实际类别隔离需调度事实，不凭本包时间或“没消息”推无人使用。
2. actualHEAD仍4c0852、branch/clean、原21合法权属、19源/依赖pins复核；fresh组合resource准入遵守上述原门槛与共享活动声明。无新安装/build、个人service/provider或用户tab。
3. 管理者通过原获准fixed `ef458ff06cf7f12549b4bf3e10fc9b3e4c886ec7:apps/web/test/web-current-preview.browser.ts` 专用test endpoint提供新的owner-only隔离admin env。旧env已删除且不可复用；本包无credential值、读取、探测或新env。实际只由原fixture创建owned随机DB并正常清理。
4. 新单次gate绑定上列HEAD/19hash，新的独占run id/有效期，totalMs最多51635、scratchParent=/private/tmp/max64MiB及原startfloor。必须新run目录；旧gate均已消费，绝不重开。本包未生成allowRun gate。
5. 原命令运行一次，原外层捕获完整stdout/stderr+真实exit，不造新collector；报告/budget与最后stdout必须合并判定，晚stop/failure覆盖早PASS。实际terminal先报告DB/fixture/ports/两组/scratch收尾，管理删本次env并归还窗口；失败保原件，不自动重试。

原命令模板（占位值不是可用输入）：

```text
cwd /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery
FLOW_RECOVERY_BROWSER=1 FLOW_RECOVERY_GATE=<NEW_SINGLE_USE_GATE> TSX_DISABLE_CACHE=1 NODE_DISABLE_COMPILE_CACHE=1
/opt/homebrew/opt/node@24/bin/node --env-file=<NEW_CONTROLLED_OWNER_ONLY_ADMIN_ENV> --import tsx apps/web/test/conversation-recovery.browser.ts
```

## 既有旅程和未验边界

原same-origin journey保持cookie read/SSE握手、text/intent/两附件原序恢复、跨tab CAS、真实bodyloss/原key-body-refs-turn/task显式retry与下一稿、page-only auth loss+abort/重新认证0POST、CSRF/offline、双主题390和Enter/Escape focus。第三次前段4checks已过/后段在__name异常处失败或未跑，不回填通过；修复仅已获源码与受控serialization证据。本次不加case或削断言。

SSE真实delivery、CREATE两阶段/lostACK、Queue/Steer恢复、完整profile/knowledge/steering稿、secondcenter/完整撤权/并发Restore编辑仍未由既有subset全部验收。三中心语义caller-Origin/迟到ClearCookie/repeatedConnect与lostACK32slot仍是完整feature开放项，先前root明确不阻这个已准备same-origin子集；本批不重新判断中心能力。C02 v2接线仅只读候选，未进入这19源；其ReasoningGroup标签适配的最终最小scope待共享gate固定后确认。

应用既有本地find-skills/clean-code/webapp-testing：复用原受控入口/身份与错误边界，严格按真实row定位和公开行为断言，不引入通用runner；静态准备与运行事实分开。0产品import/Node检查/types/test/HTTP/PG/Chrome/free/个人凭据；仅正常D04协调读取与文件/Git字节核对。所有项目/source/status与旧packet未改。

最新协调事实（归root入站，不是本owner运行/采样）：ENG01I-PG-20261007-R1已接下一唯一实际PG窗口，2 selected / <=150s，actual cleanup前Recovery PG必须HOLD。Quick b2在2026-10-07T04:48:10.247247Z失败归还Chrome（父计量而非产品断言红）；这不授Recovery同时使用PG。原Recovery parent对独立evidence路径直接treeBytes、对scratch独立treeBytes，未使用Quick的sizes(BASE)-sizes(scratch)差分，也未复制/改写任何新计量器。轮询和多次文件读取仍非OS硬quota/原子全目录快照；按原已审边界保持，不冒资源实际准入。
