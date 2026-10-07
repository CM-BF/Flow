# DPERF04 固定前端/专测独立只读审查

固定 implementation `4facd052c25e63ea300f72ea46c03c51fb983980`，metadata 输入 `84c3cb195bbbe707f51dcf70087c427018cf7f6d`，base `c837b5dccaea429b0112d1c7e0c752c41334204a`。Reviewer workspace_panels_owner / gpt-6-astra ultra。首次与收口 HEAD/branch/dirty、四主审源码及四必要引用的固定 SHA256 见 sources.json；只按固定 git show 审，不以 moving 文件作结论。

结论：**CHANGES_REQUESTED**。一项实际 client P2 和一项 browser 证据因果门禁 P2。没有发现 P1 数据/权限写入路径；没有运行复现，以下是具体源码可达时序。root负责 read-model/aggregate/server全面审查，本报告仅为客户端与专测范围，不替代其结论。

## 1. DPERF04-C1 / P2：自动刷新打断当前文档与键盘阅读

- `public/app.js:359` 每20秒页面可见即调用与手动同一个 refresh。
- `191–194` 对任何 selectedTask 无条件 invalidateDetail 并 renderDetailShell；`164–167` 隐藏 document-view、清图片；`251–252` replaceChildren 移除全部当前详情按钮。成功后 `207–210` 再次重建并取 detail，即使 sourceKey/digest 完全没变化。
- `public/index.html:35` 文档正文 pre 有 tabindex=0。用户聚焦正文读长文或聚焦原文按钮时，timer到来会隐藏其焦点节点或把按钮移出DOM。`app.js:273` 只在显式父子导航聚焦标题；`350–353` 只在modal关闭恢复外部invoker；自动重建没有等价焦点/阅读上下文处理。
- 可达步骤：打开任务→plan.md→Tab到正文/原文按钮→保持页面可见跨一次定时同步。即使底层status未变，文档被收起，按钮/正文焦点丢失，必须重新找入口；下次timer重复。旧版refresh未重建已打开modal，本片引入回归。
- 最小修订：区分自动观察更新与用户显式切换/刷新；现场proof可以明确失效，但不要以无条件隐藏文档和replaceChildren销毁正在阅读的内容/焦点。若必须替换源identity则保守提示，并把焦点移到明确可达的当前逻辑目标。无需新模块/状态权威。
- 必要回归：实际文档已打开且正文/按钮获焦点→一次自动刷新，同source及source变化分别核阅读上下文、原时间/旧proof标记、焦点；Escape仍回原invoker。当前两browser脚本只测显式导航和Escape，没有此场景。

## 2. DPERF04-C2 / P2：迟到响应的否定断言可早于真正送达

`test/summary-detail.browser.mjs:174–187,190–205,206–218,220–239` 使用 latch 放行旧detail/document/assignment，但放行函数只resolve Promise。route handler后续的 `route.fulfill` 没有完成门禁；调用者只等两帧requestAnimationFrame就断言旧内容/旧错误不存在。`181,211` 还 catch 并吞掉fulfill失败。

具体可触发路径：Playwright协议或本地响应发送比两帧慢，旧route尚未fulfill/旧fetch body尚未settle，否定断言已通过；随后立即导航/关闭/下一轮代际变化，旧响应再到达便被后续动作排除，即使待测旧回调在原时点缺guard，这组测试仍可能绿。两帧是渲染采样，不证明恶意旧响应已经进入consumer。

最小修订：在该fixture既有fetch包装/route seam记录可等待的旧响应交付和body结算信号（包括失败），等准确那次请求真正settle后再查DOM。不能把fulfill失败静默当作已证明ignore-abort；若浏览器确因关闭请求无法投递，应该标本次未覆盖。保留现所有断言，不增加通用网络框架。此项是测试可靠性问题，不断言当前product guard已有错；当前guard源码本身见下文符合设计。

## 3. Node 显式入口：可作受控小检查，但入口自身不是完整资源监督器

命令：`/opt/homebrew/opt/node@24/bin/node --test apps/execution-dashboard/test/summary-detail.test.mjs`，当前未运行。

- `summary-detail.test.mjs:1–11` 只导入Node内置与本地Module；import browser.mjs不会调用其 `260` 的main-only runBrowserCheck；Playwright动态import只在实际browser分支103，未由direct触发。
- test顶层 `26` timeout25000；`summaryFixture` browser文件21–47创建**一个**自有mkdtemp根、其下owner/main**两个Git repository**，固定两任务≤6。不要混称两个独立mkdtemp root。
- 临时status/files/Git全部在该根；根rm hook立即注册，server closeAllConnections/close hook在listen前注册。server loopback动态端口；Node实际fetch本fixture，故应称“0外部网络”，不能称0HTTP。
- `summaryFixture:44` 和direct传入observer均显式synthetic；`read-model:112–118`真实PG导入在默认observer调用时才发生，这个fixture不调用。`server:78` CLI默认registry/4320也有main-only guard。`fixture.mjs:10`仅复用status文本helper。
- 每个Git3s；traced execute的maxBuffer2MiB。测试内没有累计30s父监督、tmp8MiB/raw2MiB实时门禁，25s node:test timeout不等于所有child/HTTP/cleanup已结束。尤其失败时不能只凭TAP结束认为临时根/端口已清零。
- 启动前仍需fresh单次gate和外部已有runner：限定自身TMPDIR/PGID、工作≤25s并保≥5s cleanup，总≤30s；日志≤2MiB、tmp≤8MiB；允许loopback，禁止外网/真实registry/PG；剥离FLOW_/PG/DATABASE_URL等敏感环境，核source pins。只清自己的tmp/进程，结束核根不存在、server关闭；cleanup未知判FAIL。本文未创建runner、未签gate、未采空间。

## 4. 当前前端正确保留的边界

- app `173–189` assignment独立epoch；旧成功/失败在commit前均核epoch。`30–35` registryFingerprint不匹配则unknown/byTask null，不把旧无claim映射到新登记。pending保旧available时 `71–74` 明示“上次观察/正在刷新”；失败清observation并显示unknown。写权始终原子协调入口，不新增HTTP写入。
- `191–222` summary single-flight，不被慢assignment await；失败保旧snapshot/completedAt并独立失败时间。声明summary不再用旧绿色review/main badge：`122–160` 明确作者记录/现场未核验。
- `276–293` detail token绑定request/selection/summary epoch、task ID、sourceKey、digest以及dialog open；response identity/fingerprint匹配才publish。A→B→A及同ID关闭重开有独立generation，catch同样active；不只依靠abort。
- `295–316` 只有matched status before/after与当前summary digest时显示旧review/main badge，仍保task.current门禁。mismatch展示观察期间来源变化和原proof facts，不称原子快照；所有原技术内容/范围/TODO/doc入口可达。
- `319–344` document有独立epoch/selection/summary/ID，json/text/arrayBuffer每await后和catch/图片handler都核active；每次换图换DOM img，避免旧onload覆盖。文档仍走registered task/path endpoint；不会跟raw parent links读任意路径。
- `37–76,243–249` registered/unregistered claims完整scope/next/needsVerification可达；textContent构造，注入不当HTML。`79–104` unknown parent即使有registered targetId只给登记资料下钻，原声明仅文本，不赋执行层级。
- `264–274,350–354` 显式父子导航复用同modal，标题焦点，Escape回最初invoker/重绘后的同task按钮。上述认可限显式导航，不包含C1的自动刷新丢焦点。

## 5. Browser资源与现有断言的限度（未运行）

两个脚本复用runBrowserCheck与同budgetFile，60s累计/15s cleanup：未清理budget.complete=false阻止后继；固定sourceHead/七hash；Chrome自有detached组，loopbackfixture/synthetic claims，无真实ledger。正常/失败清理记录、hardDeadline不报告绿色。task-links保原parent/child/rawlink escaping/unknown/claim scope与390双主题断言，没有按静态path伪造批准。

资源门槛由后置外部gate负责：本browser runner没有free-space监测，retained8MiB是最后递归证据检查，不是全程scratch/Chromeprofile物理峰值硬上限；不可复用Node gate跑Chrome。hard deadline落不完整清理时需实际人工窄核，不自动下一轮。两帧截图采样和现时序断言均未执行，本审查不声称截图/焦点动态通过。

## 方法与范围

按本地find-skills优先复用clean-code/codebase-design，sources.json记录技能SHA。实际采用：把三读模型的观测身份与UI生命周期分别审，检查success/catch/abort/刷新/关闭，再从fixture刺激和断言的因果顺序核验；避免为问题新造缓存/权限authority。0产品import、测试、服务、HTTP调用、PG、Chrome、空间采样、registry采样；只写本/tmp报告与hash，项目0修改。Recovery源码冻结，本报告不是其工作延伸。
