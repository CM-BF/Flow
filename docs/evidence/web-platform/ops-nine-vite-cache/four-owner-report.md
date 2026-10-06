# OPS：四个 exact .vite 的退役证据核对

结论：**候选 0；四项均 KEEP。** 读取的唯一 status / own validation / README 都保留长期 Vite 预览，未建立正式退役事实。任务 delivered、释放代码 claim 或单次测试 cleanup 不足以允许缓存删除。未查进程、端口、缓存目录身份或外部 symlink consumer；这些由 Lead 单独核，未知仍 KEEP。

共同父目录：`/Users/citrine/Projects/AgentHarness/Flow-worktrees`。下面 cache 路径均为该父目录下精确路径，不授权删除整个 node_modules。

| exact cache | 固定 HEAD | 决定与精确依据 |
| --- | --- | --- |
| `web-plugin-integration/apps/web/node_modules/.vite` | f4335af151bc41ebed8886ea113ae6f854f579e0 | **KEEP**。`plans/wpf-i01-plugin-integration/status.md:44–48` 长期55049/session79831明确保留，另引用用户保留的M02/49922；`docs/evidence/wpf-i01/validation.md:10–11,31` 明确所有长期预览保留。fixture `apps/web/test/workspace-preview.ts:1,4–10,16–20` 仍提供Vite dev入口。未见此长期进程正式退役回执。 |
| `web-plugin-management-integration/apps/web/node_modules/.vite` | 05b92d30c953413ab66d8b69447c9b44c9121a6a | **KEEP**。`plans/wpf-x03-plugin-integration/status.md:11,35–37,43–45` 明确59473/session96967在main收口后保留；`docs/evidence/wpf-x03/README.md:11–14` 与 `validation.md:22` 同符。后者只结束误启动的新session63813，不能套作96967退役。fixture `apps/web/test/plugin-management-integration.fixture.ts:60,72–73,83–88` 默认app-preview走Vite createServer。 |
| `web-steering-control/apps/web/node_modules/.vite` | 01842a87f768bd28ce7370681ff02d7b834765f7 | **KEEP**。`plans/wpf-steering-control/status.md:38,42` 留63251/session13237；`docs/evidence/wpf-steering-control/README.md:5,24` 明确 retained preview、每次browser只关闭自有动态fixture，不停止它。fixture `apps/web/test/conversation-steering.fixture.ts:74–78` 是独立Vite入口；build输出临时目录清理不等于此cache可删。 |
| `web-unified-workspace/apps/web/node_modules/.vite` | 4069566a80ead3c2e93ef9032fc2de689d50a1d0 | **KEEP**。`plans/wpf-m02-web-workspace/status.md:30,36` 与 `docs/evidence/wpf-m02/validation.md:13` 记录用户预览49922；I01固定status:48及validation:11明确该树用户保留入口未停/重启。fixture `apps/web/test/workspace-preview.ts:1,4–10,16–20` 是Vite dev入口。本片源码停止/移交不撤销这个服务保留事实。 |

上述端口/session是历史文档身份，不是本次进程观察。源码展示createServer consumer路径；没有把未执行的Vite配置推成现进程必定正在读cache，也没有凭不存在显式cacheDir就认定目录可删。所读vite.config.ts保持只读，实际realpath/当前process归Lead核。

只复用本地find-skills/clean-code既有方法：分别核“任务结束”“测试清理”“长期预览退役”，不混为同一职责；使用固定Git对象和有限own文件，sources/hash见audit.json。没有广扫目录/消费者、proc、du/free、API/页面/HMR/build/test、cache/依赖写或停服务。没有正式退役证据时不能宣称“无外部consumer”。Recovery candidate原样；Lead仍为唯一后续operator。
