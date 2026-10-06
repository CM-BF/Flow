# D05FIT01 交付证据

固定实现 `0ac7a127f06d534f6514a98331f533e42993378a`，基线`7106a35447bf43026ad7b5ad7c25dc530fd0c4f5`；两实现文件，四literal领取范围。唯一[status](../../../plans/d05-first-fit/status.md)与[review](../../../plans/d05-first-fit/review.md)。root2026-10-06 08:46:46 UTC已限定APPROVED；当前未main，范围与独立CUA见review。

[源码绑定](source-binding.json)将两SHA256与[最终浏览器报告](second-green.json)逐字核同；报告保留运行时3f797d7+dirty，不回填为target。首次1280x720自动71%，可同屏看到Runner；390仍42%并局部滚动，无整页横溢。手动模式分别按五视图保留，Fit可恢复响应宽度，刷新进度不改zoom。

复验（Node24，现有Playwright1.63+Chrome；本树不安装新依赖）：
```sh
PLAYWRIGHT_MODULE=file:///Users/citrine/Projects/AgentHarness/Flow/node_modules/@playwright/test/index.mjs D05FIT_LABEL=independent node apps/execution-dashboard/test/architecture-viewport.browser.mjs
node apps/execution-dashboard/test/architecture-viewport.browser.mjs --preview
```
脚本启动自身动态loopback静态HTTP，synthetic empty进度数据，不连接看板4320或协调/产品DB；默认浏览器后自动关闭，preview模式单独保留。当前preview http://127.0.0.1:61461/#architecture，session82968。

[详细验证与失败](validation.md)、[质量记录](quality.md)、[原始领取](take-receipt.json)。图的fixed9c6数据与个人runtime都未改变，不能从本显示修复推断任何新平台能力/真实provider验证。
