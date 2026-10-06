# SVC05 首接口与依赖

固定backend 362af3bac77541e5a60979326bcf4d4b8c947915。实验输入仅：实际保留descriptor集合（artifactId/sourceHead/manifestDigest）、已核只读artifact路径、固定backend源码、专属随机PG与自建token、证据目录。禁止接收个人DB/token/端口作为验证输入。

1. `inventory` 只读私人state/release和artifact文件的白名单字段/hash，输出不含配置正文/凭据。个人状态不被复制为第二控制权威。
2. `compatibility` 使用生产createServer、公开owner/runner HTTP与确定性adapter、真实已构建App。逐artifact生成固定backend的read/send/recover/negotiation原始事实和现有flow-web-api-v1格式报告；未通过不生成通过报告。
3. 新backend自有随机库复现必要旧历史与升级/重启；原key/body恢复，不自动cancel或自动执行provider。轻读新增context/goal历史能力与旧Web解析分开标证据。
4. 复用 `verifyWebArtifact` / `startStaticWeb` / `importWebCompatibility` / `verifyWebCompatibility`，仅在自有副本/临时目录调用可写函数；不调用个人preview start/stop/maintenance/publish。
5. 先固定checkpoint再DROP专库/清理临时资源。全部资源自有；错误不打印真实凭据。

现有 RELEASE01 fixture绑定旧常量并顶层执行，不能直接import改用新backend；将复用纯发布模块，参考其公开交互断言，避免重造发布/调度状态机。实际App构建源与每个加载asset hash绑定。Chrome使用自有context及明确ready locator。ATTACHI02 App附件后继target待Web组固定，当前未纳入批准。

依赖：本地固定Node24/pnpm9.15.4/现有pg+tsx+Playwright Chrome+Vite；无需新增manifest/lock。真实服务继续backend b1c、Web8d8/caa1（待现场只读核）。本次无生产部署入口，不新增公共API。
