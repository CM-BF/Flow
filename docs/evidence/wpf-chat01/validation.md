# WPF-CHAT01 验证记录

最终已审target `7cbabb737f26b108275e80f1b6cd0425699f3c18`（原首候选`84242ca1d214f9a9ff369b07c13657918862f226`，下列每条按实际执行时点记录），原Web base `b5844442699733558a152c12392ea78f26c393a4`。作者Astra Ultra；独立review结论以canonical review为准。

## 已运行与时间关系

- 2026-10-06 04:03 UTC，固定842后，Node24.20.0 / pnpm9.15.4 / Vitest4.0.18，直接4模块 **33/33 PASS**：[原始JSON](module-results.json)。outbox9、conversation projection14、既有plugin-integration9、公共client1；最后一项为Lead输入未修改测试，不是新编shared测试。
- 03:57 UTC，开发Vite+本机Chrome+独立HTTP fixture **11/11 PASS**，[原始报告](browser-results.json)。
- 03:59:12 UTC，生产bundle+独立HTTP fixture **11/11 PASS**，[原始报告](production-browser-results.json)。同时生成双主题桌面/390px截图，reduced motion、键盘、无横向溢出。该报告发生在最终composer扩展插口和设置来源文案补充之前，不能说11项全部在842之后重跑。
- 04:01:58 UTC，最终composer/配置变化之后重新typecheck、构建，再做其直接影响的生产检查 **1/1 PASS**，[原始报告](composer-production-browser-results.json)：新建与已有conversation的Insert note都显式unsupported且不改draft；Conversation requested / Runner requested / Effective分层与实际model/原requested tools显示正确。[配置截图](conversation-settings.png)。随后仅git提交与metadata，source与842一致；前11项未受此次局部组合/文案影响，明确复用而不冒充重跑。
- App `pnpm --filter @flow/web typecheck` exit0；`VITE_FLOW_FIXTURE=true pnpm --filter @flow/web build` exit0。构建保留chunk>500kB警告：assistant-ui562.41kB（gzip169.77），index609.49kB（gzip180.64）；未借机改构建配置或新增依赖。
- `git diff --check b584..84242`完整结果exit2，仅原始`web-chat-transport.patch:36`的统一diff上下文空格；原始输入证据保持字节不清洗。排除transport/typed两原始patch的source/docs检查exit0；`git diff --check -- apps/web` exit0；主root manifest/lock无diff、插件源无diff。03:59 live D04 claim仍08259c1d v1 active，16scope与receipt一致。

## 行为覆盖

Outbox独立新draft、冻结payload/command key、create/turn双key；unknown→retry不重建conversation；之前unknown的重试403仍unknown；idempotency冲突不当未受理；错误/mismatched 2xx未当ACK。409只刷新不自动换key/revision重发。超长本地输入确定未发HTTP，MessageNotSentError恢复草稿；网络未知不恢复旧text覆盖新输入。

Projection晚snapshot不能降revision，晚ACK不能覆盖同revision异步final；TimeoutError可见，主动隐藏/离线停止观察但不取消已发命令。公共turn分页去重；正文only user/typed available assistant，digest按UTF-8正文验证，typed与artifact来源分别识别，未展开0/首开1/再开cache，换source版本独立缓存。

产品路径包含两轮同conversation、首ACK稳定组件key/键盘焦点、迟到ACK期间编辑、运行中Enter与steer热键不能绕过capfalse；8保留chats最多可见pane SSE、双split+merge；offline/首次未知错误retry；真实message动作到所属task/right Terminal、旧任务控制页显式取消；隐藏ACK不抢焦点、关闭不cancel/不重开；中心A→B同ID的active/hidden草稿和详情缓存清空。生产与开发报告pageErrors均[]。

## 实际发现/修复

- root独立moving CUA复现首ACK因路由key重挂使焦点掉BODY；修为View稳定key，root03:55:53实际复验连续键入保持TEXTAREA；作者browser也覆盖首轮Enter受理焦点及隐藏ACK不抢焦点。此处是过程复验，整包独立批准尚待。
- root提前读出snapshot回退/超时分类、本地schema错误丢draft，管理者研究补unknown历史与ACK验证；均由本owner修，分别纳入上述测试。
- 作者初次浏览器缺默认Playwright下载，改用已有Chrome；两次测试脚本等待点修正（异步POST计数、官方message节点为data-slot），没有篡改产品去适配测试。旧[失败截图](browser-failure.png)保留原始调试现场，不当当前结果。
- clean-code详见[质量记录](quality.md)。没有把formatter、共享协议、TaskProjection或其他owner目录混入范围。

## 未验证与不扩大结论

作者未调用SDK/模型，也未在此Web树跑真PG中心。主线已批准的CHAT01/CHAT02真PG证据仅作输入provenance；实际集成后两次真实模型query由MainLead负责。capfalse后继需求、voice、真实tool/thinking、新模型设置、完整持久插件管理、PTY/fs仍未实现。本记录不声明main已集成，也不继承I01旧approval。

04:04:44 UTC dashboard实采：42 sources，WPF-CHAT01 own source current=true/stale=false、human.complete=true、issues=[]、checks passed绑定842、review not_started、implementationProof unchanged、claim08259c1d v1 active matchesSource=true，main8f method not-contained。采样时仅metadata dirty；见[摘录](dashboard-observation.json)。

## 独立review修复（7cb）

2026-10-06 04:07 UTC，固定`7cbabb737f26b108275e80f1b6cd0425699f3c18`只改projection与相应test。原842正式REQUEST_CHANGES：CHAT-R1重试saved ACK以更高请求序号覆盖final，新增回归实际先失败后通过；CHAT-R2别处一次新增多turn后缺口无cursor，新增[1]→revision3→可加载cursor1→[1,2,3]通过。16projection+9outbox共25 PASS，typecheck0、两文件diffcheck0。旧33/11/11+1证据保持各自target与时间；没有把修复作者结果冒充独立复验或全套重跑。

## 最终独立复验

2026-10-06 04:09 UTC root正式整体限定APPROVED 7cbabb737f26b108275e80f1b6cd0425699f3c18，R1/R2 CLOSED。w01独立16projection+3额外公开探针PASS（saved replay保持final、54→62turn gap分页、fresh ACK→GET升级）；Root代码/来源/局部diff审查与此前CUA/截图复用无其他blocking。原842独立33 tests不冒称在7cb重跑，作者旧11生产/11开发报告不冒称最终全跑。未扩实际模型/真PG或main结论。
