# Skills / clean-code

2026-10-06 10:56:41 UTC：复用本地find-skills方法，实际读新树AGENTS/plans、父MATURE05。选用 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,webapp-testing,vercel-react-best-practices}/SKILL.md；clean-code固定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，无重复安装。

采用实际repo TypeScript Playwright+已有动态HTTPfixture代替额外Python server；poll/SSE页面以特定可见状态与稳定frame判断，不用networkidle等待永不安静的网络。codebase-design把实验Interface限定为已存在的HTTP/UI seam；React技能只用于观察mounted hidden与卸载区别，不实施未经领取的生产优化。每段/交付核命名、单责、错误处理、预算和cleanup；不能为通过基线清除受保护draft/receipt。

实施安全点：两个新增脚本只通过公开UI/HTTP seam，不注入私有React对象；静态核到closed conversation保留view/projection，仅记录可观察DOM/GET差异。新增late reply detail重开读数，不以0请求推断内存大小。unknown采用现fixture掉响应，原key由真实retry按钮发出；不会在实验服务器删除receipt。

验证预备：frozen lock安装未改manifest/lock。全Web tsc发现基线已有web-release-compatibility.fixture.ts:127/134的string|undefined两错误，保留types-first.log，不越scope修；定向命令首次root cwd找不到vite/client是作者调用路径错误，移apps/web cwd后两入口及直接依赖types通过（types-final.log）。这些不是基线browser实验，尚未启动90秒窗口。
