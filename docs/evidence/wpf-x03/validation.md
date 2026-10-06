# WPF-X03I01 验证

实现target `84acdcaaa9687a4ca75ebdb40a6efc7e5539029a`，完整base `4e0289f29ffa48c6c49003837d4520f57c22b6b0`。2026-10-06 04:36 UTC固定。仅3个生产文件和2个专测；测试时HEAD为a5340cd9a4a41790de5cffa026949fbf3ff12ec7加工作变化，报告保留真实sourceCommit，开始时五文件SHA256逐个与最终target及现场相等，见[source manifest](source-manifest.json)。没有把提交后metadata HEAD替换原始运行来源。

| 检查 | 结果与范围 |
| --- | --- |
| 既有依赖安装 | Node24 / pnpm9.15.4 frozen-lockfile通过；本树client/contracts链接，无新增依赖/锁改动；[日志](dependency-install.log) |
| TypeScript | app typecheck exit0，[日志](typecheck.log) |
| 开发App browser | 8/8，2026-10-06T04:35:23.658Z–2026-10-06T04:35:30.021Z，[原始JSON](browser-results.json) / [日志](browser.log)，pageErrors=[] |
| 生产构建 | exit0，[日志](build.log)；真实管理JS/CSS分chunk，JS9.85kB左右；既有assistant-ui/index超过500kB warning保留 |
| 生产App browser | 7/7，2026-10-06T04:35:37.562Z–2026-10-06T04:35:40.830Z，[原始JSON](production-browser-results.json) / [日志](production-browser.log)，pageErrors=[] |
| Scope/diff | 实现diffcheck0，shared/root manifests/lock/plugin-management/plugins/session/Thread均无改动；只在正式七scope内写入 |

实际App检查初始与Settings未展开零registry/模块请求，首次展开一页10条personal；详情与versions/audit显式、版本分页与焦点保持；同名sample.notes注册仍unavailable，本地enable/disable只改host、没有registry mutation。折叠中止pending HTTP，Close/Escape回设置按钮；中心A/B同registration ID，旧HTTP已完成但测试fetch故意延后交付并忽略abort，关闭换中心后旧数据不能覆写B。503可见并手动重试；官方Thread与未发送草稿保留。开发第8项单独拦截lazy模块请求，错误局限管理区，折叠/关闭仍可用、草稿保留、明确先复制未发送文字再reload，不自动reload/clipboard。

截图最终由上述生产7项生成：[桌面浅色](integration-light.png)、[桌面深色](integration-dark.png)、[390浅色](integration-light-390.png)、[390深色](integration-dark-390.png)。四图同target源码；实测页面与Dialog无横向溢出，减少动画环境、summary键盘与Close/Escape焦点通过。作者已目视390浅色/桌面深色；root此前目视1280浅色/390深色是开发观察，不能当本批正式review。

## 保留失败与修复边界

- [首次报告](first-browser-results.json) / [日志](first-browser.log) / [截图](first-browser-failure.png)：前6项通过，第7项脚本假定初始深色并找Use light，实际初始浅色，30s timeout；只更正脚本按当前状态切主题，不是产品失败。
- [chunk retry red](chunk-retry-red-browser-results.json) / [日志](chunk-retry-red-browser.log)：专测证明浏览器缓存失败dynamic import，无效Retry不能恢复；删除伪retry，保留局部reload说明与草稿。browser-failure.png是该失败时主page现场快照，错误发生在额外isolated page，不能把图当错误节点截图。
- 初次测试fixture使用--preview触发被复用CHAT脚本自身preview分支，已结束仅新建session63813；新--app-preview避免重入。当前preview session96967，旧49922/55049/63743/55247未动。

## 未验证与输入复用

本批只有公共协议HTTP fixture与真实App组合：0真实中心/数据库/SDK/模型/语音调用；不重复已审X03独立模块12checks及数据库实验，不把那些当本批重跑。当前App没有项目选择，默认personal；模块project范围仍来自X03原独审，本轮不增加选择器。04:36:39 UTC root已独立APPROVED，见[正式结论](../../../plans/wpf-x03-plugin-integration/review.md)；其读源码/hash/报告与CUA观察，不声称独立重跑作者8/7。main尚未集成本挂载。注册记录不表示包已下载/验证/运行，完整npm安装/隔离/版本执行生命周期仍由X01后继管理。

04:37:33 UTC单次[dashboard观察](dashboard-observation.json)：本source current/clean/issues=[]，checks passed/review approved均绑定84、review proof unchanged，claim a1044bb0 v1 active matchesSource=true；main not-contained。该采样HEAD692eb7b，随后只提交本摘录与说明，不冒充采样到了后来的metadata SHA。实际运行Node24.20.0/pnpm9.15.4。
