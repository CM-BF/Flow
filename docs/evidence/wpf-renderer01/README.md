# WPF-RENDERER01 · 模块交付候选

实现 `747cbe616408dc3e44ab3587216c5753e6de3994`，base `fb906cb42391971a8b315dbd813f7633927d7265`；后续 metadata 不改变固定实现 target。独立 review 尚未执行。

新增受信 data type→React 注册模块，P01 是唯一生命周期权威。官方 Thread 双 provider 已通过模拟 HTTP 验证，真实 FlowClient 与 ConversationProjection 管理回复身份/digest/缓存。它尚未接入产品 App，也不完成 X01 npm、授权管理或第三方隔离。

## 启动

在本 worktree 根目录，以 Node24/pnpm9 运行：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/data-renderers.browser.ts --serve
```

当前独立预览：http://127.0.0.1:49415 。默认 registered 状态使用标准详情显示；Activate renderer 走现有 P01 activate；Disable/Broken/Change connection 为 fixture 控件。HTTP fixture，无模型/产品 DB。其他 owner 服务不受影响。

## 实际检查

- Node24 / Vitest4.0.18：14 个局部测试通过，384ms；[原始日志](module-tests.log)。目录原子冲突/namespace/版本与schema/P01清理、订阅错误隔离、读取身份/迟到、循环与有界摘要。
- Web typecheck 退出0：[日志](typecheck.log)。
- 10 组真实 Chromium fixture 行为通过，pageErrors=[]：[结果](browser-results.json)、[日志](browser-final.log)。双 provider + StrictMode，0→1→cache、Activity恢复/草稿、disable/throw fallback、非法数据无读取、单 pane关闭、浅深390键盘/reduced-motion、HTTP错误重试、迟到 HTTP跨连接不回填。
- 最终5条详情GET：A首次、B首次、连接2 A失败/重试、连接2 B迟到响应；不是5次自动读取。首次注册/激活/恢复/主题切换0详情，缓存 reopen无新请求。未调用发送/取消/模型。
- 作者已目视[浅色](renderers-light.png)和[深色390](renderers-dark-390.png)。fixture 使用正式主题和官方 Thread；不是实际产品 App 截图。
- 六实现文件 fixed diffcheck0；App/shared/P01/根manifest-lock相对base均0差异。源文件与截图/原报告绑定见[source-binding](source-binding.json)。

## 首轮失败与修复

[首轮](browser-first.log)捕获 Activity 清理注册导致 data 子树卸载后局部展开态丢失；已将纯disclosure归稳定provider，真实projection内容缓存仍是唯一来源。[第二轮](browser-second.log)在修复后仍按旧“停用会折叠”预期找按钮而失败；已改为检查已展开内容保留。未删除原日志。[第三轮](browser-third.log)9组通过；其后追加真实迟到响应并修fixture包裹布局/窄屏截图等待，最终10组均通过。

故障注入 renderer throw 被本地ErrorBoundary捕获，React开发日志会输出预期console.error；这不是 pageerror=0 就声称无任何console错误。没有生产全量build、真实中心/模型、Safari/Firefox/屏读或产品 App 接线验收。

[Interface](interface.md) · [技能/clean-code](quality.md) · [状态](../../../plans/wpf-renderer01-data-renderers/status.md) · [审查](../../../plans/wpf-renderer01-data-renderers/review.md)
