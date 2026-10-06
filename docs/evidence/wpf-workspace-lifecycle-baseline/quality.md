# Skills / clean-code

2026-10-06 10:56:41 UTC：复用本地find-skills方法，实际读新树AGENTS/plans、父MATURE05。选用 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,webapp-testing,vercel-react-best-practices}/SKILL.md；clean-code固定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，无重复安装。

采用实际repo TypeScript Playwright+已有动态HTTPfixture代替额外Python server；poll/SSE页面以特定可见状态与稳定frame判断，不用networkidle等待永不安静的网络。codebase-design把实验Interface限定为已存在的HTTP/UI seam；React技能只用于观察mounted hidden与卸载区别，不实施未经领取的生产优化。每段/交付核命名、单责、错误处理、预算和cleanup；不能为通过基线清除受保护draft/receipt。

实施安全点：两个新增脚本只通过公开UI/HTTP seam，不注入私有React对象；静态核到closed conversation保留view/projection，仅记录可观察DOM/GET差异。新增late reply detail重开读数，不以0请求推断内存大小。unknown采用现fixture掉响应，原key由真实retry按钮发出；不会在实验服务器删除receipt。

验证预备：frozen lock安装未改manifest/lock。全Web tsc发现基线已有web-release-compatibility.fixture.ts:127/134的string|undefined两错误，保留types-first.log，不越scope修；定向命令首次root cwd找不到vite/client是作者调用路径错误，移apps/web cwd后两入口及直接依赖types通过（types-final.log）。这些不是基线browser实验，尚未启动90秒窗口。

首browser实验11:00:27启动至约11:01前退出：前三档、双pane、clean关闭重开、protected新稿/knowledge、Send/Queue unknown及late detail共7段日志通过；随后delayed snapshot被浏览器撤销，测试wrapper仍把已destroyed req交给旧async HTTP handler，触发ECONNRESET未处理异常。整轮partial、最终报告未写出，不声称实验成功/cleanup报告完整。独立只读process观察未留playwright Chrome主进程，Node退出已关闭本进程动态server；不操作既有服务。修wrapper在投递前核req/res生存并消费handler Promise，把错误记raw；每段checkpoint降低末尾失败丢证据。

总实验预算继续≤90秒：首轮按保守45秒计（真实约32秒），修复后仅45秒含10秒cleanup，不给第二个90秒。环境依赖/静态types准备不计浏览器实验；不延长窗口追全绿。首status曾手写未来11:02，实际clock11:00:27已更正，不作为真实执行时间。

11:05 UTC 交付清码：修复wrapper投递已取消request与Promise拒绝处理，第二轮errors/transportErrors为空，cleanup fulfilled。实验状态不靠“8 PASS”冒充整体通过；末尾Chats切换侧栏导致locator不可见，已留失败并停止追加。该测试导航未修/未验证，作为partial交付限制。生产既有路径全部只读。无新增调度器/缓存authority或为了回收丢receipt。

命名复核：raw `overview-hidden` 指聊天 panes 被总览隐藏，validation已解歧义；DOM/closed/cache口径分开。budget默认90秒单次，当前授权按首45保守+修复45配置使用，实际第二34.322秒；不能把脚本可再次运行理解成当前有额外预算。source frozen 1711，报告hash全匹配，不回填当时HEAD。未解决：末尾截图脚本导航、native page-hidden/late history/heap未测；无产品blocking判定。

11:06:23 UTC 固定目标局部strict tsc exit0，未新起browser/build；actual status parser errors=[]、human complete、checks failed/partial 与 review NOT_STARTED 如实可解析，7 Markdown/30本地链接无断链。最终证据约437KB，远低8MiB；生产/共享全0diff。
