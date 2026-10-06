# RELEASE03 固定组合验证：可实施的只读准备

当前未取得验证树/claim/PG或Chrome授权，未运行实验。SOURCE_REQUEST仍由Lead唯一Git owner处理。此方案只让输入ready后可直接实施；不是兼容通过或发布许可。沿已有find-skills/clean-code方法，以生命周期、身份与原字节证据检查收口。

## 准确输入与现成接缝

- 实际backend工厂固定 `362af3bac77541e5a60979326bcf4d4b8c947915`，`apps/server/src/index.ts:createServer`（54）。默认迁移attachments/contextHistory（88–89），默认queue扫描（112–115）；不手工mount、不关默认scanner、不导入后继修复server。
- 新Web实际sourceHead `5069586a9f17332de526e101eca3a4250cbc8d91`，生产源码获审provenance `9eec51b72c6432b5b41df52f5b8fa783eb45e65b`；不可把sourceHead写9eec。
- 私有正式产物 root `/private/tmp/flow-release03-prepare-5069586-u1zh3mln/artifacts`；artifactId=manifestDigest `d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88`；format2 releaseId `388371a4972c469b8ace623454594132`；10files/1,588,311bytes，Node24.20.0/Vite8.3.2。完整原字节身份见同run `prepare-handoff.json` / `artifact-result.json`，不重build。
- 工具固定84005：`verifyWebArtifact`（web-artifact.mjs:60–72）直接接受现descriptor/root并验全文件集/hash。`web-release.mjs:43–68` 的 import/verifyCompatibility也直接接受descriptor；其逻辑不验证业务真伪，只验证4份observation及report原字节绑定，必须实际检查后才生成。四工具在362→84005 git diff为空，可复用源树里的相同字节，按本sources.json核hash。
- 旧RELEASE01 fixture/browser位于362的 `apps/web/test/web-release-compatibility.{fixture,browser}.ts`。**不能整段执行**：fixture 125起会新建双checkout、install、prepare，常量仍b1c/8d8，browser测试旧双版本并输出旧evidence。仅复用其真实HTTP观测代理/原key断言/四check schema与资源所有权经验。当前四scope用新的RELEASE03两脚本+自身plan/evidence，不改旧记录。
- ATTACHI506 `attachment-integration.browser.ts:105–146` 可只读复用Files/Knowledge准备、v2 Send/Queue未知ACK及新稿断言；其fixture:95–100会build并用旧base工厂，不调用它。不要再次跑17模块/旧完整浏览器矩阵。

## 最小 fixture Interface

`startCurrentPreviewFixture({ backendRoot, artifactRoot, descriptor, signal, deadline, evidence })` 返回实际HTTP centerUrl、临时token（仅内存）、单一Web URL、受控proxy fault开关、bounded wire记录、公共owner/runner FlowClient、幂等close。两脚本内部私有Interface，不新发布框架。

1. 来源ready时由sole Git owner提供明确固定362 backendRoot；导入其actual createServer与同根client/contracts。生成一个随机DB名+专用owner marker，一个内存owner token；实际createServer默认路由与migration，listen随机port。
2. 使用verifyWebArtifact返回dist/manifest，以内置Node HTTP承载真实immutable字节。可直接复用84005导出的 `releaseAsset`（web-release.mjs:154–165）做exact file/hash/路径读取：由verified manifest构造最小index+namespace→file map，namespace严格 `/__flow_releases/388371a4972c469b8ace623454594132/`；index来自原bytes，未授权path不fallback成任意文件。API请求转发实际center。这是测试host，不写web-release指针、个人目录或fake compatibility；也无需Vite/cache。`/__flow_preview_identity`只返回真实descriptor。
3. 原SVC `startStaticWeb`读取release pointer时要求compatibility，因此不能在验收前捏造report；它无pointer时的Vite fallback也不能假定能正确服务format2 namespace。测试host只为本轮字节与API组合；真正SVC host/发布仍原operator的后续步骤。
4. proxy沿RELEASE01 `http.request`流透传，保authorization（不记token）、Idempotency-Key、X-Flow-Assistant-Stream、X-Flow-Execution-Profile及内容类型；SSE不await全量text、不套普通JSON短timeout。一次lostACK只在真实成功响应后丢给浏览器，并保存真实response身份与原请求key/body哈希；额外bad200若检查，标注和丢包是不同故障。网络错误只允许确切注入路径，不全局忽略console错误。
5. 0provider runner不用导入整个apps/runner runtime或SDK适配器：fixture用固定362公共FlowClient注册合成runner、publish固定configuration，再显式claim/report原生session、assistant-final/verification/completed事件。这是runner协议模拟，不声称真实provider验证；两个history用例必须经过HTTP reportEvents，不直接调用store。队列保留真实默认scan。若有必要verifyText仅取固定pure helper，不能引整runner依赖链。

## 用例顺序与通过门槛

A. **首先实际HTTP attachment-only与mixed context_observation**（每项独立记录，不因首项throw跳过另一项）。只复用已审cde `apps/server/src/context-transparency/attachment-history.test.ts:53–119` 的语义，不导入其createServer或修复文件：
- 各自新project→attachmentCapabilities→upload `.txt`→可选knowledge→profile/project绑定create→submit非空attachments；核v2 frozen refs及claim.executionInputDigest/实际runner prompt含材料。
- actual runner claim后报告session(seq1)，再报告合法context-observation(seq2)；读取owner contextHistory、权威task/attempt/lastSequence；核请求/响应状态、正文不泄露与材料呈现。
- attachment-only不得把`known sources:[]`称有效；mixed不得只知识known而遗漏附件、不得只用知识算materialRevisionDigest。cde已审兼容语义是v2 materials unknown/metadata-unavailable+null digest，同时context detail仍保两类原文；本轮不自行改362规则。
- 362缺口已由既有root audit确认，本轮不重做研究；预计可能失败。实际失败保完整原始status/body（脱临时token）和组合身份；**不得产生整体兼容通过/自动import四绿报告**。可以在剩余预算内继续B取得独立Web事实，但发布仍blocked；异常未退出的任务保实际状态，cleanup移除专库，不绕过/删除观察让其看似成功。

B. **同一真实artifact App，单Chrome**：
- 验index/实际加载JS/CSS与manifest逐byte/hash，真实连接临时center；显式profile/project，prepare-only后GET真实cap，不本地false→true。
- 先一条plain v1（attachments字段省略，不用[]冒旧cap可用），实际Send+task读取；记录owner401/绑定conversation/task/profile身份。
- Files使用预建ready资源，真实v2 Send丢成功ACK→可见unknown；在此期间输入new draft；点击Retry same message，精确同key+同UTF8 body+同turn/task/ref顺序/digest，且new draft保持。GET history不被旧receipt覆盖。
- 保持该运行task未completed，官方upload或显式Files选第二ready资源→Queue next+Enter，真实enqueue accepted并v2材料；可对Queue重复同一种lostACK/显式Retry same enqueue，断言原key/body/item与新draft保持、0 cancel。之后由fixture完成前轮，观察真实默认queue scan（仅必要公开状态，无模型）。
- 正常patch-v1协商+仅去协商header的legacy重读；profile目录/opt-in实际响应。四SVC observations从wire与UI事实计算，不能硬写true。

C. **报告**：保独立history组合结果、App检查、asset hash、fixture source hashes、raw wire、精确预算和cleanup。SVC固定report只容read/send/recover/negotiation四项，**不能把history结果藏在它不表达的schema外后声称兼容全通过**。只有A/B都满足要求才能调用原importWebCompatibility/verifyWebCompatibility；否则保存partial observations而不生成可消费的全绿handoff。backend修复必须原owner提供新fixed实际target，362已失败证据不改写为新target，后续重验需新调度。

## 180秒/8MiB与清理

总计180秒覆盖从启动准备到清理，无build/install。建议工作硬截止160秒、至少20秒cleanup；累计每次启动（包括import/启动失败）都先登记开始，原结果不可覆盖。示意分配：0–10身份/产物、10–50单PG+两history、50–135真实App、135–160协商/报告；实际用时超段可压缩未开始检查并记NOT_RUN，不能降断言/加timeout自动续跑。

一个随机标记DB、一个createServer实例、一个Chrome（串行context可复用），所有端口由系统分配。8MiB包含raw、JSON、日志、截图总量；wire设独立累计上限，截图仅必要light/dark390，原产物只读不复制不计作新证据文件。

所有资源在await创建之前登记owner/启动promise，统一AbortSignal/总deadline；禁止Promise.race超时后遗留未接管startup。deadline触发关闭browser/network及自身fixture进程组（只自己的PGID），等待factory.close（内部boss stop至5秒）/pools完成，marker核对后DROP自己的DB，核DB/连接/端口退出。marker错误禁止drop但仍清其它自己资源并标失败；清理失败不能发成功报告。20秒内无法确认时如实留未清项交原owner，不终止其他进程、不碰个人服务。不得因为是小样本就省略实际预算登记。

## 依赖来源与不可借用项

- backend必须362实际源码及其apps/server/src完整本地import closure/SQL迁移文件（database.ts用readFile，不只index）。contracts/client必须同一固定362源码；禁止从ATTACHI506/当前main/Recovery的@flow symlink/dist借用，这会让history问题悄然被新producer/DTO覆盖。
- server包固定外部依赖含fastify5.12.5、@fastify/cors11.3.0、pg8.23.1、pg-boss12.37.0、zod4.6.5以及plugin-package相关npm-package-arg/pacote/ssri的实际静态import闭包。即使未启包worker，不能假设其静态依赖无需存在。
- 执行TypeScript需要合法已准备的tsx4.23.15/相关传递依赖（不能把Node默认strip-types当支持database构造参数属性）；浏览器需Playwright1.63.0+现有Chrome。正式新树必须先由管理核resolve真实来源与缓存写位置，未ready就停，不自动install/写他树cache。纯第三方只读依赖复用也须显式授权/精确链接scope，不自己创建symlink；不借旧@flow产物。
- 无需react/Vite/devserver，因为Web由正式built bytes提供；无SDK/provider模块，无全runner runtime。固定工具四文件362与84005相同，hash清单见sources.json。
- 当前四scope仍两新test+own plan/evidence，由manager最后给准确literal；若需要新增依赖链接/SQL源码checkout范围，由sole Git owner/source准备另行协调，不用本片test scope越权改依赖或source。

这些是可实施顺序与静态依赖判断，未进行resolve/provision、数据库连接、HTTP、Chrome、任何新prepare/服务/个人目录操作。
