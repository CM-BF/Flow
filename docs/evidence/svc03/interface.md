# SVC03 Interface v1

- `prepareWebArtifact({repository,target,directory})`：可信 clean 精确 SHA，在 private directory/web-artifacts 临时 stage 构建；不读个人配置。清理失败 stage，成功以内容 digest 目录原子发布，不覆盖既有产物。返回 `{artifactId,sourceHead,manifestDigest}`。构建环境只含系统白名单、production/fixture=false，禁 .env 加载；已装依赖，不 install。
- `verifyWebArtifact({directory,artifact})`：严格 descriptor、manifest 与全部文件 sha256/bytes，拒 symlink/越界/额外文件；返回内部 dist 路径与脱敏 manifest。artifactId 不表示部署。
- `startStaticWeb({directory,artifact,repository,webPort,centerPort})`：验证后使用已装 Vite programmatic preview；configFile/envDir 均 false，loopback/strictPort、显式同源 /api 代理；不从工作树提供页面、不加载 dev/HMR。返回可关闭的服务用于测试；private child CLI 只收非秘密路径/descriptor/端口。
- `startPreview`/`maintenance refresh`：原 operation.lock/身份/保留 DB 与显式 resume 不变；产物必须在停止旧服务前完成准备。state 独立保存 webArtifact 和后端 source。ready 必须核 Web identity 响应的 sourceHead/artifactId/manifestDigest。status 报 verified/unknown，不把进程活着当内容校验。
- 回退是单独明确选择兼容旧产物/后端版本的维护动作，非失败后的自动回滚。保留旧产物；不回退 DB、不自动 resume/reload。当前 CLI 协议保持。

验收通过 prepare/verify/startStaticWeb 公开接口、真实临时 HTTP 及既有启动/维护直接消费者。0 query/不触当前个人服务。
