# D06 固定架构快照交付

固定源码基线 `9c6fa9b100f04916f43b04280f05f497b28eeb0f`；实现 `2c857bdc83e4769c5099de2f37f4a7f2140e834b`；owner d01_owner / gpt-6-astra ultra。本轮沿D06唯一source迁到 dashboard-architecture-stream；主线后来前进不会倒灌到图。个人center/runner b54/v6来自Lead回执，本片未验证真实服务。

五视图保留，更新工具/思考活动已挂载、正文patch独立模块未挂App、原生指令持久接受不等生效且默认关闭、X05包下载worker不等安装/第三方隔离。runtime / 数据 / 依赖 / FSM边界保留，renderer/CSS未改。

[状态](../../../../plans/d06-architecture-refresh/status.md) · [审查](../../../../plans/d06-architecture-refresh/review.md) · [验证](validation.md) · [来源绑定](source-binding.json) · [质量](quality.md) · [历史](history.md)。

## 预览与验证

独立预览 `http://127.0.0.1:50039/#architecture`，exec session 98579。保留给review。启动命令（本worktree根）：

```sh
node docs/evidence/d06/stream/preview.mjs
node --test apps/execution-dashboard/test/architecture.test.mjs
node docs/evidence/d06/stream/source-audit.mjs
node docs/evidence/d06/stream/browser-check.mjs http://127.0.0.1:50039/
```

preview使用空tasks registry及动态端口，浏览器只读这个preview的空snapshot，不访问4320或产品中心。既有预览不操作。检查为13 Node、56节点来源/80策展源码行、五图Chrome实际键盘/双主题390/reduced-motion。浏览器原报告记录d8c0e4+dirty，不改写成实现SHA；五字节hash与fixed target全相等。[原报告](browser-checks.json)与[来源审计](source-audit.json)保留。

## 截图

[模块浅色](modules-light.png)、[状态浅色](states-light.png)、[状态深色](states-dark.png)、[数据深色](data-dark.png)、[390深色](data-dark-narrow.png)、[390浅色](data-light-narrow.png)。作者实际目视模块浅色与390深色，图局部可滚动/缩放，页面无横向溢出，固定源码提示和详情来源可达。不宣称真实provider或容量验证。

## 限制

原首次browser失败为断言将节点subtitle当作详情content的文案位置；只修检查locator期待并保留原log，最终检查通过。无真实产品DB/模型/registry/服务重启，未重跑全库。O09/CHAT09/正文App接线不在基线，维持后继状态；后续源迁移不表示此数据已main。独立审查与main接收仍待真实回执。
