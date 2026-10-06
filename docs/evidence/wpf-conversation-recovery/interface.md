# WPF-RECOVERY01 Interface

父MATURE06-04，唯一21scope/84005基线。结构设计root已批准，尚未实现或验证。ConnectionSession只使用FlowClient.browserSession/connectBrowserSession/logoutBrowserSession；ready四字段centerId/ownerPrincipalId/expiresAt/csrfToken，namespace不含csrf/短期session。原Bearer保持兼容，真实恢复必须cookie路径；unsupported不伪造ready。认证失败停命令，离线与resource403分开；本地expiry仅触发read，不凭本机时钟断言过期。

Journal提供verified-namespace读取、draft版本写、prepare/dispatching/checkpoint/eligible-dismiss事务；同transaction完整预算+CAS，resolve仅transaction.complete，strict为UA hint。原Outbox/Queue/Steer管理业务state；同步receipt存在后才能await。每个阶段世代隔离，迟到不得重写新状态；0自动mutation恢复。

RecoveryBinding真实注册P01 sidebar.footer私有命令；App只挂surface和提供bound callbacks。操作逐次验证namespace/view/project/当前grant，UI禁用不绕barrier。恢复不按opaque ID前缀授权、不用全局selectedTask猜归属。

容量和完整草稿依据保存在[envelope研究](envelope-research.txt)、[实测候选](envelope-results.json)、[请求上界](request-bounds-research.txt)、[draft接缝](draft-seams-research.txt)。这是固定旧基线只读设计，不是当前实现检查。正文对象只一份；CREATE兩key/body预留、cancel-task目标明确、metadata-first；IDB异常保材料和memorydraft，不发送纯文替代。

浏览器总预算90s含15scleanup、raw≤8MiB；当前禁止安装/build/PG/Chrome，定向轻量测试条件满足才跑。最终中心callerOrigin/迟到clearCookie/重复Connect门槛另核。
