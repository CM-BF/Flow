# rec8ed page.evaluate 自包含修复 — SOURCE_FIXED / NOT_RUN

2026-10-07 02:20:08 UTC。固定source `9835e7488dd9b0b44b3afbc285336defdd739e98`，前序失败metadata `a3449380d75839358f4a6df6f53c747872676efa`；仅 browser.ts一文件3增2删，其余18源不变，见[19源manifest](page-evaluate-checkpoint.json)。

真实第三次失败保留于[browser-third](browser-third-validation.md)：前段材料/CAS/原key重试已完成，pageOnlyAuthLoss注入时ReferenceError `__name`，不是应用pageerror或产品丢稿已证。本次不改生产App/IDB/journal，也不改先前raw。

原487–498行 `page.evaluate` callback内，`Object.defineProperty`的 `value: function` 是带推断名称的匿名函数；本机tsx4.23.15转换器`dist/index-DE3OBZuV.mjs:14`实际声明`keepNames:!0`与`minifyWhitespace:!0`并调用esbuild（已装0.28.2）。该组合可引入外层__name引用，与真实错误吻合；精确转换及因果尚待局部检查，不把静态配置视为已运行证明。

最小修复为原生method shorthand `value(this,...args) {...}`，恢复hook也用method descriptor，避免需要外层命名helper。仍由原IDB方法接收this/全部args，返回同一transaction；只有确切journal DB+readwrite才queueMicrotask abort。恢复仍换回原prototype方法并删除自有hook；try/finally原调用不改。不加window.__name、通用注入框架或页面权限，不删pageOnlyAuthLoss/CSRF/offline/390双主题及键盘断言。

拟局部<=10s / tmp<=8MiB / raw<=256KiB：精确提取原与修后callback，以实际已装esbuild及上述tsx选项转换后，提取运行时函数toString并放入无__name的隔离vm。原反例须ReferenceError；修后核this/args/return、目标readwrite abort、其他DB及readonly不abort、恢复原函数并清hook。真实转译后的callback是待验证对象；不import产品，不重跑50，不PG/Chrome/HTTP/provider，受控IDB端口不冒native IDB/browser复验。

当前TUI01G占local检查槽，0局部check启动；须manager实际窗口归还后再准入。浏览器无新grant，原晚耗38364.050667ms、余51635.949333ms，未来整数最多51635ms含15000cleanup。所有原失败、50批准范围和完整feature NOT_STARTED保持。
