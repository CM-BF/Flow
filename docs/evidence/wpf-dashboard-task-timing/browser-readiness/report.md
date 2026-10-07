# Timing browser 有界只读准备

产品72a9407e固定，root限定source/parser批准；实际browser NOT_RUN。当前 ACCESS 持有共享窗口，本片无运行/预约。

真实入口为新树`apps/execution-dashboard/test/task-timing.browser.mjs`的`createTaskTimingFixture()`和`runTaskTimingChecks({page,fixture,outputDir,checkpoint})`，无顶层启动。新fixture仅Node builtins +本树status/human/task-links/proof（其Node builtin依赖）与本树public实际六静态文件；未导入原含pg的fixture，不需要pg/React/Vite/TSX/install/links。五组检查覆盖明确任务时间和分支已交付、未知/未来/逆序/陈旧/冻结、失败保旧详情焦点、新快照与旧打开详情、light/dark390键盘/两PNG。synthetic owner/Git/overview只是呈现样本，不冒真实registry/mainproof/部署。

已只读确认现有playwright-core 1.63.0：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/index.mjs`，Node`/opt/homebrew/opt/node@24/bin/node`，Chrome 154.0.8037.98 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，关键entry/package/native pins见inputs.json（逐file/hash/realpath）。core导出的chromium可直接消费，无需@playwright/test或包别名。未import或启动任何二进制；包内部动态资源闭包仍需实际runner准入时沿现已审方法核，文件存在不等运行通过。

未来实际worker一次调用上述原函数，不复制断言或跑旧task-links.browser。复用既有owned native Chrome sibling + sandboxed Node/loopback方法即可：显式MAC_CHROMIUM_TMPDIR/BREAKPAD_DUMP_LOCATION/profile指短owned scratch；独立ChromePGID与NodePGID归父唯一监督，Chromium原生sandbox保留。Chrome不受自定义Node外层write/egress约束，必须本新runner精确边界核定，不继承Settings/Quick/DPERF旧授权。

建议总60s含15s清理、TMP256MiB（含profile，不等raw）、raw8MiB；0旧累计，0PG/provider。绝对deadline从启动前计，失败/中断也入单份记录；逐项finally关闭page/browser/fixture，再reap两个ownedgroups，清scratch前后终态采样及保Chrome exit/close事实；普通stop不得PASS，最终外层actualexit+唯一terminalseal+result/budget/5checks/2PNG+cleanups相符才接收。轮询不称硬quota，不采私人profile，不禁sandbox，不装依赖。

本段只是可复用入口/依赖与边界清单，没有新supervisor、gate、容量采样或实验。READY条件：root接受实际隔离runner/native边界、固定当前metadata/source/readonlyinputs、共享窗口归还后的fresh实际资源条件。当前保持HOLD/NOT_RUN，随后idle给管理安排。
