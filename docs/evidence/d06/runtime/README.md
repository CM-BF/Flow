# D06 固定运行架构刷新

实现 `2c3160f42784ee814d968a953d557251c81a243d`；固定源码 `f181d84b5fb3652d62e2a181acff442d42b3e066`。唯一 [plan](../../../../plans/d06-architecture-refresh/plan.md) / [status](../../../../plans/d06-architecture-refresh/status.md) / [review](../../../../plans/d06-architecture-refresh/review.md) 在本树；旧D06只读历史见 [history](history.md)。root10:18:41 UTC已独立限定APPROVED；尚未主线接收。

五图保留原renderer/CSS：运行边界新增TUI与显式Codex adapter边界；模块图32节点准确标明App已接stream/知识/steering、生产loader仍fixture/Claude；数据/FSM区分正文规则和工程验收；配置并发1–16、中心登记capacity与真实provider容量独立。附件合同/持久输入及Web-only发布切换在该源码尚未实现，不因未来分支或task登记当已上线。个人artifact/backend运行版本须服务owner独立回执，本图不写死旧current。

- [检查来源](checks.json)、[固定source绑定](source-binding.json)、[逐来源/策展行](source-audit.json)、[验证与限制](validation.md)、[质量](quality.md)。
- [运行图](runtime-light.png)、[模块上部](modules-light.png)、[模块下部](modules-bottom-light.png)、[深色390](data-dark-narrow.png)、[浅色390](data-light-narrow.png)。390保留42%最小zoom与局部滚动，不承诺整图同屏。
- 独立预览 `http://127.0.0.1:49510/#architecture`，进程session2032。动态端口、空registry，仅静态图；不连接协调或产品DB，不读取真实服务。

复验（Node24、既有锁依赖）：

```sh
node --test apps/execution-dashboard/test/architecture.test.mjs
node docs/evidence/d06/runtime/source-audit.mjs
node docs/evidence/d06/runtime/preview.mjs
# 使用上条自己的实际loopback端口
node docs/evidence/d06/runtime/browser-check.mjs http://127.0.0.1:49510/
```

source-audit/browser会在本证据目录产生新观察，独立review只读时请仅运行Node或把输出另存临时路径，勿改author原报告。检查只验证策展与局部真实浏览器，不复测所述各领域执行能力/真实provider。
