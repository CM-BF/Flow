# D06 本轮验证

实现 `2c857bdc83e4769c5099de2f37f4a7f2140e834b`，源码基线9c6，五执行文件与[浏览器原报告](browser-checks.json)逐hash一致，详[来源绑定](source-binding.json)。原执行HEAD为d8c0e4+dirty；固定实现后无执行文件变化，不回填历史。

| 检查 | 结果与范围 | 原始证据 |
| --- | --- | --- |
| 依赖 | frozen/offline/ignore-scripts成功；lock/manifest零diff | [install](install.log) |
| Node直接 | 13/13 PASS，1868.9955ms | [direct](direct-first.log) |
| 固定源码 | 56节点来源/80策展line核git show9c6 PASS | [log](source-first.log)、[JSON](source-audit.json) |
| Chrome初次 | 详情容器不含节点subtitle导致断言失败；非产品失败，原文保留 | [首次](browser-first.log) |
| Chrome最终 | 2026-10-06T08:10:01.058Z五视图/新节点/Enter+Space/双主题390/减少动画通过；pageErrors=[] | [报告](browser-checks.json)、[stdout](browser-final.log) |
| 作者目视 | modules-light与data-dark-narrow实际查看，固定提示/详情可达，节点布局与窄屏局部滚动保持 | [模块](modules-light.png)、[窄屏](data-dark-narrow.png) |

固定实现diffcheck0；renderer/CSS/packages/rootmanifest/lock相对9c6零diff。原始日志不清洗；本轮完整staged metadata diffcheck0（无原始日志格式例外）。实际parser errors=[]、implementation.errors=[]、human.complete=true；7维护Markdown/43本地链接零断链。以上不等于独立review、生产运行或model能力验证。
