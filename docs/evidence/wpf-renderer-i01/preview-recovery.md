# 独立预览错误与恢复

2026-10-06 06:38:33.480Z，root在本任务57108开发服务实开空白，控制台报告`TypeError: _jsxDEV is not a function at /src/main.tsx:9:68`。owner随后读取持有服务输出，确认23:35:28与23:38:33 local均报相同错误，定位src/main.tsx JSX入口。最终dev/prod专用报告仍为各自动态服务结果，不将该失败隐去。

该长驻dev服务在并行独立dev/production消费者验证期间共享同树Vite依赖缓存；缓存污染为待证实解释，不能由此认定产品修复。仅停止本任务服务、清理本树生成的Vite cache后重启，生产源码保持8014不变，其他服务不动。恢复结果另记。

06:39 UTC确认cache绝对路径在本树内，仅删除生成cache并重启原fixture；新服务http://127.0.0.1:60956，centers60953/60954，进程9055。源码未改，root将在新URL独占复核，owner未重复打开浏览器。

Root于06:40:07Z正式回报新60956实际App抽验正常、无新增error，临时tab29已关闭。核验Enter展开/草稿/native隐藏恢复/disable fallback/split/dark。此恢复仅证明重新启动的预览可用，cache共享归因仍未被独立证实。
