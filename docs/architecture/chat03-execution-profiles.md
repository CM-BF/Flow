# CHAT03 执行profile

中心profile为已注册runner声明的不可变配置，source=runner-configured、availability=not-probed。仅允许已知claude v2 policy；model.value来自manifest，resolvedModel=null/providerCapabilities=unknown，SDK ModelInfo只复用字段概念，不执行supportedModels或认证网络。configuration digest由固定schema顺序JSON计算；materialScopeDigest是本地材料路径集合的opaque摘要，不发送路径/正文，不证明材料内容版本。

runner token只能发布自己的profile；锁runner后同config重放返回同profile，修改拒绝，需新runner identity。owner按reference id/runnerId/configDigest选择；conversation创建与turn公共acceptTask校验同一pin，claim加runner约束且再次核对profile。无profile继续既有行为。resume需原session runner，不能借新profile迁移上下文。

普通runner启动从一次读取的manifest同时产生adapter和profile；发布得到reference，外层adapter guard在调用真实adapter前比较reference/configDigest。profile requested声明与CHAT02实际effective分离，SDK init未知不会被目录默认值填补。任务仍使用既有lease/fencing，不新增provider连接、热更新、预热或会话状态机。

## 普通启动与公共接线

沿用普通 runner 的 `FLOW_URL`、`FLOW_RUNNER_TOKEN`、`FLOW_RUNNER_WORKDIR`，并将 `FLOW_CLAUDE_MATERIALS_FILE` 指向显式私有 manifest 的绝对路径。可参考[不授权文件读取的配置示例](../evidence/chat03/manifest-example.json)；该示例没有执行过真实模型调用。manifest 缺省时仍 fixture-only；A2A 专用启动分支不变。

加载只读一次 manifest，通过 `loadRunnerConfiguration` 构造 adapter 和白名单配置。`publishExecutionProfile` 使用共享 FlowClient 与 5 秒取消期限，在任何 claim 前完成；`guardExecutionProfile` 校验本地 digest、adapter version、任务的完整 pin，再调用既有 ownership gate 与 adapter。中心拒绝发布会终止启动。修改配置须重新注册 runner；旧配置仍由原 identity 表示，不从文件热加载。

中心集成入口为 `migrateExecutionProfiles(pool)`（在 conversations migration007 之后）及 `registerExecutionProfileRoutes(app,pool)`；migration010 与其他迁移共用 advisory 锁。parent 负责生产 server/index 接线，本分支测试在真实 createServer 上通过公开 register/migrate seam 挂载，不自称生产共享入口已接线。公共 exports/client 来自 Lead 固定 94f50acf38213caacb2852d740c818b8480e3d15。

## 安全与状态边界

profile 是认证 runner 的配置声明，不是第三方代码或 provider 的可信证明。只投影固定字段，拒绝未知属性；公开 model 仅接受字母数字及 `. _ : -` 组成的 1～180 字符标识，拒绝自由文本与文件路径，未覆盖其他自定义 provider 的 model 字符语法。绝不从凭据、环境全量、材料正文或真实登录生成目录。授权材料路径只参与 opaque digest，内容变更不是本片段的版本证明。

撤销 runner 后新目录查询不再提供其 profile，已有 conversation 新 turn 和直接 task pin 均拒绝；已排队任务不会转移给其他 runner。profile、conversation pin 和原任务历史保留，显式取消/核对沿用中心既有命令。新配置 identity 不能接走原 native session。目录无 online/heartbeat 健康保证，断连时可保持 queued。

conversation.revision 仅是命令 CAS，不是异步回复缓存版本。实际模型、tools、permissionMode 来自 typed final 的 SDK 报告；未报告就是 unknown/null，thinking 仍 unknown，即使配置声明请求 disabled。恢复查询以 task.updatedAt 与 reply contentDigest 更新。无 per-turn override、effort、queue、steer、预热、热更新、多provider目录或新的真实模型预算。
