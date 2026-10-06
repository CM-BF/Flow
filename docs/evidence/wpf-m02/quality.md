# WPF-M02 技能与质量

2026-10-06 02:25 UTC，owner workspace_panels_owner，派发模型 gpt-6-astra/ultra。已核验新树/branch/clean，读取新树 AGENTS、plans/AGENTS/README及管理草案三件套。授权从W01 `cb4a39211e264538704ba9d474eeb08fc4b2759c` 创建独立树，完整 no-ff 合入M02 `e888862570cba3c59789053e68df7d5720650c36`，merge `c0c41f9881713f3b371ba62c8f4e68ca5d71e8db` 无冲突。已存在提交的共享改动来自此授权merge，不是本owner重写；后续新增改动限定apps/web/本plan/本evidence。

按find-skills方法识别本任务为React/TypeScript/HTTP消费/浏览器阅读锚点；已有匹配本地skill，沿用本session已完整读取的版本，不重复安装：

| Skill | 本地路径/固定来源 | 本次实际应用 |
| --- | --- | --- |
| find-skills | `/Users/citrine/.agents/skills/find-skills/SKILL.md` | 优先本地匹配，避免无关安装 |
| codebase-design | `/Users/citrine/.agents/skills/codebase-design/SKILL.md` | 独立WorkspaceFeedProjection与view；App仅接入导航与下钻callbacks |
| clean-code | `/Users/citrine/.agents/skills/clean-code/SKILL.md`；sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5 | 分离双向游标、索引、命令行为；每段/安全停点/交付记录真实发现 |
| assistant-ui | `/Users/citrine/.agents/skills/assistant-ui/SKILL.md`；assistant-ui/skills@139674dc888ee076982b6726e8e6f5d0fe0b5f67 | 保留官方Thread + ExternalStoreRuntime；跨任务feed用语义list，不造第二聊天权威状态 |
| ai-elements | `/Users/citrine/.agents/skills/ai-elements/SKILL.md`；vercel/ai-elements@6a9d5b1822ffb10bba4bd97175f01edd7d8651cd | 复用已review右侧Terminal/FileTree；不把workspace API当fs/PTY |
| vercel-react-best-practices | `/Users/citrine/.agents/skills/vercel-react-best-practices/SKILL.md` | 异步generation、窄订阅、惰性详情与独立UI状态 |
| frontend-design / webapp-testing | `/Users/citrine/.agents/skills/{frontend-design,webapp-testing}/SKILL.md` | 紧凑中性工作记录；实际浏览器测锚点/双主题/键盘与390px |

实现前已按固定M02提交读取architecture/types/client/server。确定历史before的nextCursor不得覆盖前向cursor；watermark不等于已消费；传signal时显式叠加超时；100条快照缺席不推断完成；queryTasks summary不带decision，用户显式inspect才show。用户已经授权实现，不重复设计批准。

## Clean-code 段记录

| UTC | 范围 | 实际发现/处理 | 未解决 |
| --- | --- | --- | --- |
| 02:25 | 开工输入/模块设计 | 完整merge保证workspace client/type来自本树；将连续投影和tabs业务分开，App只桥接，避免继续堆积App。 | 实现与行为验证尚待完成 |


## 2026-10-06 02:33 UTC — implementation segment

- 合入已审 main `8c57f2f97345167207fa0d2590e9ad6310c922d4`，no-ff merge `35f0bb9df3f57b858c39b13fab940137c747d1f1`，无冲突；包含 M02 >200 accepted/output 因果顺序修正。原有未提交仅本feature新文件保留。
- Node24 / pnpm9.15.4 在本树独立安装，新增依赖0；安装补齐W01既有manifest的rootlock临时差异见 dependency-install.patch。已恢复根lock后merge，不提交手写rootlock。
- clean-code范围：feed projection / task-index / overview / attention。分离实时和历史游标，拆任务索引与生命周期；修复disconnect让pending永久卡住（invalidate仅清pending不丢未知请求key），明确初次失败是未知而非空态。
- 局部projection 10项PASS：双游标/重复/迟提交、缓冲、catch-up有界/退避/断网、reset+历史迟响应、decision409不自动重答、离线命令key与pending恢复、stop/show迟到隔离、失败非空态、Abort、索引精确total/filter隔离。浏览器与真实中心尚未通过，不能从单测外推。
- 只读官方Thread与panels沿用已审输入；App仅导航/下钻桥，feed功能不继续堆App。剩余风险：实际滚动锚点、窄屏、跨任务reference/真实中心10任务。


## 2026-10-06 02:45 UTC — delivery safe point / clean-code

- Scope: independent feed/index/UI, minimal App bridge, selected-task observation lifecycle, terminal task footer, active workspace tab visibility, own HTTP/real-center tests. Naming and single responsibility reviewed; no generic plugin protocol, shared client or backend changes authored here.
- Fixed actual findings: (1) offline pending action lock without lost-key reset; (2) initial failure must stay unknown; (3) hidden chat SSE connection starvation, separated `setVisible` from online/selection generations; (4) failed snapshot must expose Retry instead of new composer; (5) late acceptance preserves selected overview route; (6) completed/failed/cancelled footer is factual; (7) controlled detail tab offscreen at390px; (8) cross-task reference focus waits for the actual new task/tab to mount.
- Browser evidence for (7): selected Verification evidence tab right603.64 vs viewport right360 before fix, preserved controlled-tab-before.png. After layout/resize horizontal reveal, entire active tab is visible; no scroll animation. (8) explicit focus assertion failed before bridge request serial/mounted-tab synchronization, then passed.
- Scope receipt timing:17 lines of WorkspacePanels layout/resize logic landed under existing broad apps/web authorization before the manager's new per-file receipt gate arrived. File was held unchanged after that message. MainLead transitional receipt c2de313ce5a6f036f07bbfb28d52a7e1a2cc1b9f at02:43:31.089188Z then explicitly registered this file. This is a transitional assignment, not a PG receipt; do not backdate.
- Final local checks02:44–02:45:20 module/direct-dependency tests,9 HTTP fixture browser groups,6 HTTP/1 observer/tab browser groups,4 real PostgreSQL/HTTP groups with10 protocol-runner tasks, app typecheck/build allPASS. Browser pageerror arrays empty. Expected simulated socket-loss proxy error is the Retry test, not an unexplained failure.
- Two-page test uses two real Chrome pages and HTTP/1; headless document visibility is explicitly dispatched because headless may keep both documents visible. Native desktop hidden-tab behavior awaits independent CUA review. No task cancellation on hiding/closing, no SharedWorker/BroadcastChannel.
- Remaining limits: fixture runner protocols are not live Claude models; no arbitrary filesystem/PTY; plugin host integration is a separate queued handoff; feed retains explicitly loaded history in memory (no virtualization claim); build reports542.49kB application and562.05kB assistant-ui chunks beforegzip, performance follow-up remains.
