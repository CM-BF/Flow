# Plugin 模块 b2 实际与独立验收

固定源 `a952ae81fefd3a82c9dfe42067048bcf2702d1c3`；实际 metadata HEAD `756fde2afffc8131f485857e8a65300145b11be3`。[独立审查](root-actual-visual-review.json)为 **APPROVED_SCOPED_BROWSER_VISUAL_AND_COMPLETE_RETURN**，0 findings。

实际 outer exit0，唯一 PASS terminal 与四个 sealed 文件、五个 runtime 文件完全核同，原六组全部报告通过、无 page error。真实键盘触发只读刷新，在解码响应并解除 pending 后自然保持焦点；没有末尾补 focus。[原件索引](index.json)、[保守结算](summary.json)、[实际返回](outer/return-receipt.json)逐字保留。

本次7566ms，连同首失败12385ms累计19951/60000ms，40049ms未用并关闭；parent历史19864及terminal7480口径不回改。旧b1 FAILED仍reported0/6、0PNG，不能补签前五通过。没有追加types/direct或第三browser。

12:50:25.968903Z完整归还：outer/worker/Chrome精确PID+PGID均ESRCH，3个owned端口refused，fixture/context关闭，profile/scratch消失，内3流外2流EOF/drop0，cleanupErrors[]。早期return原件里的visual PENDING_ROOT保留；后来的独立review提供最终视觉结论。

## 实际截图范围

[浅色390×844](runtime/plugin-runtime-light-390.png)和[深色390×844](runtime/plugin-runtime-dark-390.png)经root实际目视：Center B高级身份折叠态可读、无横溢，浅色刷新焦点环可见。深色图在切主题后取得，不冒另一次深色键盘测试；完整长UUID展开态、顶层列表与生产App未覆盖。

## 启动方式与接收边界

固定入口 `runPluginRuntimeManagementChecks` 使用 synthetic public DTO/owned HTTP，与真实 React/Tailwind/CSS、PluginHost、管理组件、session controller及FlowClient codec。私有Vite不读站点config/env/proxy，两个动态loopback服务；旧双PG入口未调用。父调用器/worker和native边界见 [已审准备](../browser-focus-fix/README.md)，已消费包只作证据，不是运行指令。

原生Chrome保内建sandbox，无custom outer OS写/egress约束；Node维持原外层限制。公共OPS helper仅retained计量，scratch仍独立原scanner/cap，未声称完整迁移。

[主线接收清单](../main-intake.json)仅五产品literal；App/session、真实后台加载、真实双center/principal、日用HOST候选、config/grants写入及removal引用均为后继。当前未集成main、未部署。
