# Recovery有限独立选择入口

2026-10-07 05:21:31 UTC；固定source `dd6645b7f3ea84d758705684190c094ad3c87460`，前序 `1bc4f20b9257b294adcadd6b68b1b9e015e04e86`。本次原browser 74+/12-，18其他source及fixture不变；[19源manifest](journey-selection-checkpoint.json)。

## Interface与隔离

Gate新增必填 `journey`，只允许 `full`、`recovery-chain`、`page-auth`、`csrf-offline`、`appearance`；缺失/未知（包括原已消费gate）拒绝。`full`是保留的完整原七组模式，不是缺字段默许。值经Gate→Init→WorkerResult原样传递；parent从自身固定enum推required，不信worker缩列表。required/completed顺序、checks数、coverage全通过且无failure/pageErrors/cleanupErrors才可判selected完成；父监督仍须原deadline/资源/owned cleanup全通过。零组/缺组/前置失败不通过。

同一次attempt只运行一个journey，依旧原新markedDB、动态center/HTTP、公开client种子project/conversation/two files、新BrowserContext和实际cookieConnect。没有以newContext冒服务端隔离，没有改fixture全表expire/revoke或lost/wire语义。无PG/Chrome并行入口；parent/worker仍原同文件，不新增supervisor。

`full`保原七组同顺序与全部断言；`recovery-chain`保cookie→完整材料Restore→同draft跨tabCAS→原key/body/ref lostACK四组。其余单选先执行同cookieRead组：page-auth通过真实UI写并确认正常checkpoint，再运行原目标DB abort/无reload失权/reauth0POST；csrf-offline通过真实UI种出自己的固定预期稿，之后原403/离线/同稿/no新增命令；appearance通过真实UI种一条代表性saved draft并核对话框包含该行，再执行原两主题390/Enter/Escape/overflow与截图。单选种稿不代材料恢复或未知回执验收，不写IDB种子。

未选择组 `NOT_SELECTED`，选中但未到 `NOT_RUN`，失败 `FAILED`；真正共享链仍fail-fast。supervisor同时输出 `selectedPassed`、`fullJourneyPassed`，后者只在journey=full且整个run通过时true，仍不是feature全验收。SSE只保握手，delivery/CREATE/Queue/Steer等原PENDING不升级。

## 可比较计时口径

worker入口 `performance.now()`为唯一单调时钟原点。initialization从该入口（包括worker动态import与fixture/Chrome连接）至新context/page就绪；失败记录FAILED和elapsed，worker无结果则parent为null，不能当0。它不含parent先前DB lease创建和spawn，整次成本仍以原budget/晚stdout为准。

最多原7条 groupTimings，记录group、起止offsetMs、elapsedMs与PASSED/FAILED；不选组无伪造0条目。每组自有UI seed计入该组，cookieConnect仍计cookieRead。原full各组不被重写/重排。当前只是计量接缝，尚无新真实browser数据，不声称提速。

## 作者有界local检查

[完整raw/index](journey-selection-local/index.json)：同一授权30s段分两次必要增量，总12462.477ms，网络/项目写sandbox禁用、无emit/cache/服务。第一次noEmit0及111项原映射校验；增timing后最终noEmit0（5985.815ms）、119项实际抽取函数/回调校验（196.055ms）。负例涵盖缺/未知选择、Gate/worker不等、required缩减、空/缺/乱序/重复完成组、0checks、FAILED/NOT_SELECTED/NOT_RUN、前置/page/cleanup错误；actual run回调用受控clock验证成功/失败/未选计时。该受控clock不是实际性能测量，未import或启动产品/fixture/parent。四子Node均双EOF/reaped/ownedPGID absent；小raw保留。

运行源当时dirty，最终SHA7a20a80a7c58f77fc1d43a709c2313a8e097283fff1fde82519d74ca0f28fcc3与固定dd6645逐字相同。原50/serialization10没有重复，历史四次browser失败保真。独立源审PENDING、真实新journey NOT_RUN；没有第五packet/gate/adminenv/PG或Chrome预约。

## 后续实际收据

新单次gate须显式选择上述一个journey并绑定最终metadata/19pins；仍只有原入口 `FLOW_RECOVERY_BROWSER=1 FLOW_RECOVERY_GATE=<new> ... node --env-file=<controlled admin> --import tsx apps/web/test/conversation-recovery.browser.ts`。root先审最小diff，再选择剩余额度内一次旅程；不复用旧gate或偷拆多次startup。

外层原actualexit/完整stdout/stderr、browser.json的journey/required/completed/coverage/timings、supervisor的selectedPassed/fullJourneyPassed、原DB/group/scratch清理及晚终态须共同判断。剩余最多35116ms包含15000cleanup，原晚累计54883.199542保持；本local检查不记作真实browser耗时，也不增加该总额。
