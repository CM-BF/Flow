# MessageSettings 固定源码检查准备（未运行）

本次只读复核作者的现成方案，不另建依赖视图。目标 ed769f929a7efe01a279ddd85c2e1e88b46839e6，实际 metadata 8bdcde32f1d1d23ec3525170eaefdac4cf844a05 / codex/web-message-settings，现场 clean；6 源固定对象、工作字节和作者 manifest 相同。源码独审另由 root/peer 完成，本报告不替代它。

## 可使用的输入

- Node 只读入口 `/opt/homebrew/Cellar/node@24/24.20.0/bin/node`；SHA256 `ee2a4493dc9e1bd0cf10f6a1aa773d0452054e2cb179b461f4d60cef66bd01ba`，50320 B。版本据已装 Cellar 路径，本段未执行二进制；不宣称全部动态库完整性。
- 作者列出的 I02 21 包，逐个 realpath、版本和 package.json hash 全匹配；另外23个编译器/测试器/类型/公开入口存在并钉 hash。具体见 dependency-observation.json。它是入口身份与安装存在检查，非整个传递包树完整性或运行解析已通过。
- 所有 @flow/client、@flow/contracts 精确 alias 均指 web-message-settings 本树源码，不消费 I02/旧树的 @flow 或 dist。类型文件采用只读 TS5.9.3/Vitest4.0.18/Zod4.6.5、React19.3/UI 声明；浏览器相关 Vite/PW 声明仅供 noEmit，不执行服务。
- TSC 配置 `/private/tmp/message-settings-check-preparation/tsconfig.json`，SHA `dd7509cc4ea94a5415f8675edcc4b4020e9b840cfaba32687227036442d9bd84`；Vitest 配置同目录 `vitest.config.mjs`，SHA `614c950567742c8b6e7157fca299782cdf61a2791b53f7413d9d6fe0232fea01`。19 literal/wildcard 类型映射和8个显式 files 均存在；strict/noUncheckedIndexedAccess 继承本树，noEmit=true、incremental=false、include/exclude=[]。

## 必要检查和预算提案

一次受父监督的串行小检查：先上述7项目入口（6新源+原execution-profiles.test.ts）strict noEmit，再同一 Vitest 单worker执行新 message-settings.test.ts 与原 execution-profiles.test.ts。静态为9+11个 it，共20，不是执行结果。原catalog共享生命周期发生变化，旧文件只读回归有直接必要；不扩大源写权。

两份 direct 文件都实际启动自有 127.0.0.1:0 HTTP fixture；应标“真实本机HTTP/0PG/0Chrome”，不能标0HTTP。父runner显式 Node24→TS入口→Vitest入口，Vitest 使用 native config loader、单fork/单worker、无文件并行、无watch/cache，当前已准备配置尚未调用。TSC失败则封存，不把后续direct标通过。

沿作者提案请求共30,000ms，含至少5,000ms清理，工作上限25,000ms；tmp8MiB、raw2MiB。未来若采用此前同类低增量小HTTP门槛，建议 start1,090,519,040B / stop1,082,130,432B，属于待root裁决提案，当前没有新门槛授权或资源采样。监控并非物理硬quota。单一父PGID，只终止自身；失败/超时/预算/清理错误一律失败。环境只调整own TMP/cache/Git路径，不重设HOME/home/CODEX_HOME。sandbox project与donor只读，写仅新own/tmp及明确own证据，网络仅loopback。

未就绪项：源码独审结论；精确父runner和sandbox/pins；新own run路径及两配置对cache/run的最终重绑；fresh claim、source、dependency/hash与单次资源准入。没有allowRun gate，未spawn/compiler/import/HTTP。无需node_modules安装或链接；若实际resolver后续出现遗漏应保原失败、精确列出，不临时改donor或扩大目录。

浏览器另行绑定：现文件仅导出 fixture/scenarios，仍需独立唯一父runner、真实Playwright/Chrome身份、1自有Vite/Chrome、profile/cache峰值与retained分账；本提案不授该窗口，不把noEmit/direct代替双pane/390/键盘/主题或实际App接线。

## 当前其他队列

Recovery7cc原38受控用例可准备重绑既有单文件入口：原累计30s已用4.574，剩25.426s，work≤20.426s并保≥5s清理，tmp8MiB/raw2MiB，既有低增量起1,090,519,040/停1,082,130,432B。先核19新源、实际metadata、原runner/config/sandbox/已装只读依赖；无产品HTTP/PG/Chrome。types原余7.186s另列，不混入直接测试额度；首browser14.846267375s失败及剩75.153732625s只算术，不授重试。原runner旧1b8绑定不能直接执行。

DPERF浏览器仍未运行。所有本组重运行窗口已归还，当前无新window/gate。Lead登记回执与owner status用于当前事实，未复采4320或空间。

## 方法与限制

本地find-skills/clean-code沿已读基线：复用作者清单、分离源码身份/依赖存在/实际执行，保失败和清理责任，避免第二依赖安装或第二状态源。此段只读元数据、固定Git对象及本地文件哈希；输出仅管理证据，0安装、链接、构建、产品import、测试、HTTP、PG、Chrome、个人操作。

## 后继固定输入

18:25安全点作者已修UI源审项，当前实现 f3a6a7ec89d5b3f789c49b0d8662401b23032ab2 / metadata ed921998dc074309d1ad6280300e3cab45dbb876，6源fixed/current重新核同且clean。见上级message-settings-f3-source-intake.json；上文ed769原观察保历史，未来必须绑定f3当前源，不能复用旧source gate。两份/tmp配置原hash未变。新源码限定复审仍待，0运行。
