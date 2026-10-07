# 晚开视图恢复：限定验证输入

固定组合target `a80339a463c4a1a1a5a679d9a89ea79b1650340e`（产品修复`dce56491db27bac4243243bc94a6aab4437cc52d`，后者3源/16不变），见[checkpoint](stale-route-checkpoint.json)。local已执行：首前置红保留，修后direct1 PASS/54未选、Web noEmit0，见[原index](stale-route-local-index.json)。真实browser NOT_RUN，未创建gate/env或占PG/Chrome窗口。

新direct只选`blocks a bound late-view turn at the durable barrier and releases its next draft only after explicit retry`：原ConversationProjection → RecoveryWorkspace → ConversationRecoveryJournal，controlled IDB put成功后commit abort，等commit前和失败后均0提交；显式retry保原请求key/body，结束handoff后保存deferred下一Steer草稿。它不声称挂载App，也不替代same-document实际回归。

复用已审private `recovery50-once-en2_sud5/vitest.config.mjs`形状，在新own TMP仅改cache路径：原单文件/native config/1fork/maxWorkers1/no-cache；Node24调用现`node_modules/vitest/vitest.mjs run --config <ownconfig> --configLoader native --no-cache --testNamePattern 'blocks a bound late-view turn' --reporter=json --outputFile <own-output>`。实际必须selected1/pass1/该case不skip，其他54未选应明确；不重跑旧50/119。随后同Node调用现`node_modules/typescript/lib/tsc.js --noEmit -p apps/web/tsconfig.json`。复用[原local监督方法](steering-local/run.py)/sandbox networkdeny、project/deps readonly，按管理新有限local预算；原消费目录不写。

已只读确认入口：Node24 realpath `/opt/homebrew/Cellar/node@24/24.20.0/bin/node` SHAee2a4493dc9e1bd0cf10f6a1aa773d0452054e2cb179b461f4d60cef66bd01ba；Vitest4.0.18入口SHA39db22f579acf5639bbb17a261408debbde03f4692c0c439e77e7f13aeba74d6，TypeScript5.9.3入口SHA2cffde0b8c6760dfb0b5b0382bbb7e00ba6a8b2d981b9205b256a700a481d983，均本树node_modules既有只读link到web-attachment-production；root/appsweb tsconfig分别SHA105e978d2cee02714a65d4c9d12d766b1701c6488d89de8b9670c499762379d1 / af4bdc0413d25d7cc3ce81a6f2bd2d5488719e8434d155c4abd2427a24273b59。入口hash不冒全部依赖闭包新复核，执行前按原闭包fresh。

真实回归保原cookieRead+steeringRecovery：session就绪后同页hash打开新聊天，timeOrigin不变；原turn实际HTTP与唯一durable outbox frozen.turnKey/request及accepted turn/task对齐，然后执行完整Guide草稿保存→reload/reauth→显式Restore→真实ACKloss→原key/body retry→nextdraft隔离。所有原5秒断言、actor/lease、清理/权限和旧失败保留。无新增journey/二center。

新[独立90s账](stale-route-phase.json)spent0；每次≤60s含15scleanup、remaining<30s停止，64MiB scratch/9MiB retained/start4MiB/一个markedDB与ownedChrome；0provider/SDK/个人服务。旧90、150、Steer60封闭不transfer；parent390000仅防御外顶。actual需管理共享窗口交接与fresh输入，不从当前无gate推全feature阻塞，完整feature仍IN_PROGRESS。
