# ATTACHI02 生产附件接线证据

固定实现 **9eec51b72c6432b5b41df52f5b8fa783eb45e65b**，base **1c4968354dabce1e6748f3301a2e6eecd33e77d4**。[计划](../../../plans/wpf-attach-i02-production-binding/plan.md) / [状态](../../../plans/wpf-attach-i02-production-binding/status.md) / [review](../../../plans/wpf-attach-i02-production-binding/review.md)。Root独立复审 **APPROVED / 0 blocking**（2026-10-06 13:02:28 UTC），[原样结论](root-9eec-review.json)。main **NOT_INTEGRATED**。

真实App已接 P01 Files/@file、官方上传/拖入、按需预览、Send/Queue有序固定附件、旧key恢复与CACHE保护。只读共享decoder、Input controller/recovery/adapter、官方Thread、contracts/client/deps；原模块Picker与CSS经v3授权仅做长名布局修复；无第二registry。完整职责与限制见[Interface](interface.md)。

**主线集成条件仍开放：**本树factory固定较早base，不能证明当前main的context-history producer × attachment-only合法材料组合；须由其合法owner/Execution Lead在接收时组合验证。**持久Send/Queue未知收据恢复仍待MATURE06-04**，本片不提供ready草稿跨reload或跨tab journal原子性，也不是完整附件大task Done。

## 作者实际检查

- [189项/7文件](phase2-direct-final.log)：材料/Outbox/Queue/P01/projection/messages/binding直接消费者；位于最终mixed小修之前。
- [最终17项官方core/binding](candidate-binding-tests.log)：fixed f82；mixed complete+requires-action 准备失败/取消后不编辑/不recapture，直接remove必须同时移除Input item，held材料仍受保护。此前[red](mixed-remove-red.log)15通过2失败与[green](mixed-remove-green.log)17通过均保留。
- [Web tsc0](candidate-types-fixed.log) 和 [固定候选 build0](candidate-build.log)。原类型错误与中间日志未清洗。build仍有大chunk警告；未宣称性能改善。
- 生产App实际旅程：[production-complete](production-complete-browser.json) **10项已通过、末项失败**，不是全绿；[production-plain](production-plain-browser.json)只针对末项1通过。合并覆盖11项行为，分别绑定各报告源码。后者等待真实GET/可发送按钮后Enter，修的是测试时序，没改产品。
- 最后mixed remove是private binding三行语义修复及直接test，未为它重跑全部浏览器。当前24声明路径与每轮变化精确列在[manifest](source-manifest.json)；实际App证据除这项后续binding delta外对应相同生产源码。最终新build只编译，不冒浏览器重跑。

局部命令（PATH前置 `/opt/homebrew/opt/node@24/bin`）：`pnpm --filter @flow/web exec vitest run test/conversation-context-receipts.test.ts test/conversation-outbox.test.ts test/conversation-queue.test.ts test/plugin-host.test.ts test/attachment-integration.test.ts test/conversation-messages.test.ts test/conversation-projection.test.ts`；最后只运行 `test/attachment-integration.test.ts`。types为`pnpm --filter @flow/web exec tsc --noEmit`。fixture/browser运行入口为本scope的两份 `attachment-integration.*.ts`，不需要额外测试文件。

## 实际App / HTTP矩阵

| 旅程 | 证据与边界 |
| --- | --- |
| 显选project / prepare | 零turn，保草稿；CREATE ACK保守cap之后真实GET确认 |
| Files / preview | P01面板、metadata先行，Enter展开才content GET，正文转义/复用缓存 |
| Send v2坏200 | 已提交中心后proxy损坏ACK；unknown→同key/body重试，v2公共decoder，新稿保持 |
| upload + Queue Enter | 官方adapter与真实POST；Queue坏200同key/body恢复，不cancel任务 |
| offline | 在提交前断线，0新queue POST，原text/chips/controller保留；不假称actualApp命中准备中断时隙 |
| disable / hidden / split / close | 插件撤权保材料，原生hidden与split恢复，关闭带材料view由CACHE保留 |
| 两主题390 /键盘 | [light](production-complete-light-390.png)、[dark](production-complete-dark-390.png)，真实Dialog Tab/Escape、reducedMotion配置；不是屏读/Safari验证 |
| unknown upload reload | badUpload→浏览器reload→显式第六client `attachmentUploadReceipt`，原scope/key、无自动新POST/附稿；明确Use recovered |
| @file / drag / remove | 同一插件面板、文本marker仅原稿匹配才移除，官方Dropzone真实upload；显式Remove file同步Input，无DELETE |
| storage错误 | 只破坏恢复storage读取，局部错误且纯文本仍真实发送；空attachments省略 |
| unbound legacy | 实际无project旧会话plain发送，无attachments/context。并非另外启动旧版本center的全兼容矩阵 |

能力/list/content/upload/upload-receipt五路通过实际App六client中的五个入口；单resource metadata GET为同场fixture使用第六个真实client `attachment` 做reference核对（不是UI自动详情）。[原wire核算](source-manifest.json)核坏Turn/Queue各2 POST同key/body、v2；badUpload仅1 POST，lookup scope/key与原body相同。恢复未知upload不等于恢复Send/Queue未知消息。

## 历史f82资源 / 原始失败 / 来源

每轮单随机专库+单Chrome、真实createServer默认factory，无手工fallback mount、无runner/provider调用。15轮含全部失败共217.181秒，最终固定build1.181秒，总 **218.362/600秒**。每轮预留20秒清理，实际cleanup全部remaining=[]/errors=[]；数据库名、时间与退出保存在各`*-cleanup.json`。启动、预算先登记，Abort/catch/finally共用所有权；SSE原先buffer风险已修为真实stream透传。没有残留预览，也没操作个人服务/凭据/4320。原日志不清洗。

失败分类：first自动fixture登录配置；second重复Files定位器；third真实CREATE/GET能力差异（已公开GET修复）；fourth/final tooltip节点更新；fifth filechooser；sixth离线注入晚于receipt（改为真实可观察offline-before-submit，准备中断另由core测试）；seventh窄屏侧栏遮挡需正常关闭；eighth drop派发到父form而非官方dropzone；ninth Remove file名称；tenth异步连接时误切sidebar；eleventh隐藏pane重复alert；twelfth wire观察早于HTTP响应；complete末项GET未完成前Enter。所有中间部分通过仍只按原hash解释，不倒填最终target。

[根mixed原诊断](root-attachment-mixed-prepare-remove.json)和[根定向复验](root-attachment-mixed-prepare-remove-fixed.json)为独立纯内存事实，不代表整体review。独立真实provider、个人center、后继main context-history producer × attachment-only共享修复组合、ready草稿/Send或Queue receipt跨reload、跨tab journal原子性、屏读/Firefox/Safari均未验。后继main源由Lead集成验证，固定本树较早factory的成功不替代它。

构建输出保留在本目录ignored `production-artifact/`，其文件hash/字节在manifest；这些是可重新生成的bundle，不作为源修改提交。源码diffcheck0；原始log的终端空白保留，不宣称全metadata无尾空格。阶段一历史见phase1-source-manifest，不覆盖旧模块证据。

## 长文件名复审输入

当前固定target **9eec51b72c6432b5b41df52f5b8fa783eb45e65b**；旧f82完整证据保留在 [原manifest](f82-source-manifest.json)。Root原技术191/191通过后，长名P2使f82正式REQUEST_CHANGES。经 [v3新增两UI路径](longnames-claim-receipt.json) 修复：短动作、原完整aria-label、完整旁边名称及有界布局，原controller/recovery/adapter未动。

- 首定向轮：filechooser Promise未及时接管异常，39.143s含人工恢复清理；未到布局，不能称正常自动cleanup。
- 第二轮：[几何红](production-longnames-second-geometry.json)，390px实际388→1740，旧产品长名失败，8.624s。
- 修后首轮：只等setFiles触发单上传门禁，13.679s；采样器未等ready，产品限制保持。
- [最终定向轮](production-longnames-ready-browser.json)：2项PASS，10.325s，Dialog388/388，11个动作最大124.954px，浅深主题恢复Enter/Escape和原draft保持；原始 [几何](production-longnames-ready-geometry.json)、[清理](production-longnames-ready-cleanup.json)、[浅色](production-longnames-ready-light-390.png)、[深色](production-longnames-ready-dark-390.png)。

累计19轮含所有失败+独立build **290.133/600秒**（按每轮budget/browser较大值），0provider。该轮build编译新UI并真实运行；没有重跑旧10+1旅程/191。Web类型 [longnames-types](longnames-types.log) 通过。当前 [manifest](source-manifest.json)明确每轮缺失或改变的源码，旧报告未追写。

## 正式独立复审

[root原样review](root-9eec-review.json)已读两UI与browser完整delta，24声明源fixed/current/最终browser相同、26scope外0、剩余保护零差；目视浅深390和几何388/388、11按钮≤125，关闭长名P2。先前f82 REQUEST_CHANGES记录保留。191/191是对未变业务源的既有独立结果，本轮未重新跑191或旧完整browser/PG；作者定向longnames检查与root只读审图/几何分开归因。APPROVED只表示此固定片段通过，主线与部署仍待正式接收。
