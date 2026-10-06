# WPF-PROFILEI01 验证

作者 workspace_panels_owner / Astra Ultra。固定实现 `2e4c5fe7d795e397ab1b1e492605562a847c5fb0`，base `698ffcd94ae073b23bcc67f6665fb19f707a93e4`。范围为4生产文件+4测试文件；执行配置模块本体、官方Thread primitive、CSS、contracts/client、manifest/lock均对base无差异。

## 实际检查

使用Node24.20.0、pnpm9.15.4、Vitest4.0.18、Chrome/Playwright现有锁定依赖；`pnpm install --frozen-lockfile`成功，未新增依赖或改lock。

- [60直接检查](direct-tests.log)：34 conversation-projection + 10 conversation-outbox + 16 execution-profiles直接依赖。命令 `pnpm exec vitest run apps/web/test/conversation-projection.test.ts apps/web/test/conversation-outbox.test.ts apps/web/test/execution-profiles.test.ts`。创建pin缺失/多出/三字段不同、后续GET/ACK不可repin、CREATE成功turn拒绝、深冻结与原键恢复，以及既有ACK重放/历史缺口回归均覆盖。
- [typecheck](typecheck.log)：`pnpm --filter @flow/web typecheck` exit0。
- [build](build.log)：`VITE_FLOW_FIXTURE=true pnpm --filter @flow/web build` exit0；此产物仅用于fixture生产冒烟。assistant-ui与App两chunk仍>500kB，保留警告。
- [开发实际App 9组](browser-results.json) / [开发日志](browser.log)：`pnpm exec tsx apps/web/test/execution-profile-integration.browser.ts`。
- [生产实际App 9组](production-browser-results.json) / [生产日志](production-browser.log)：同脚本追加`--production`。两者pageErrors=[]、failure=null。故意丢ACK的socket hang up属于注入场景，不能据此称真实中心失败。
- 实现八文件`git diff --check 698ffcd..2e4c5fe`通过。原始运行日志保持原样，不把metadata中的原始日志空白检查混作产品失败。

两browser报告的真实sourceCommit为`9fefee445567ee8d6e1f7b5a2a11d2378c79c23c` + working changes；没有重写原时间/commit。全部8源文件SHA256已逐一和2e4核对，见[source-binding](source-binding.json)。固定提交后无产品变化，所以复用这些已跑检查，不冒称在后来的metadata SHA重跑。

## 页面行为

1. 实际官方Thread首页每连接目录；同模型不同runner可辨，goal-tools/unknown禁选，合法邻项可选；明确分页。
2. 首Enter冻结完整pin/requested，CREATE pending立即锁；accepted迁移同view保持focus与新草稿；第二turn不再CREATE。
3. 丢CREATE ACK后新草稿独立，另草稿把共享目录刷为401/stale仍可恢复原CREATE同key/body，未确认前0turn。
4. 错runner pin ACK保持unknown，0turn；原key正确replay恢复。
5. CREATE已成功+turn ACK丢失只重试turn；后续409不解锁/重建会话。
6. stale阻止首次configured Send且保留草稿；刷新后选择不在已加载页仍保留，明确Load more重新确认后可发送。
7. 草稿跨tab选择/文本保留；旧无pin会话只读legacy，继续发送不会补pin。
8. A→B同profile IDs，迟到A目录不污染B，选择/draft按connection lifetime清理。
9. 桌面和390px双主题、减少动画、Dialog Escape回实际触发控件，无水平溢出；已创建窄屏状态截图保留。

## 保留的失败与修正

- [直接检查首次失败](direct-tests-initial-failure.log)：接口调用把完整ConversationSummary传给strict creation helper，17既有用例失败；修为唯一`creationFields`提取，再次60全部通过，未放宽schema/删断言。
- fixture起初model.description写null，typecheck拒绝；修为真实声明string。browser第一次typecheck又发现日志request.body为可选类型，JSON.parse调用加已有断言后的非空标记，仅专测类型修正。
- [首页面失败](browser-initial-failure.json)：8组通过后，390px保留展开侧栏遮住picker；脚本加入现成Hide chat list用户动作。
- [陈旧目录脚本失败](browser-stale-fixture-failure.json)：增加401实际刷新后，下一场景不能直接选禁用radio；脚本显式Refresh profiles恢复。
- [Dialog时序失败](browser-dialog-timing-failure.json)：Escape后未等待Radix return focus，紧接Enter重新打开触发器；脚本等待Dialog卸载+trigger焦点再输入。三次均保留原报告，最终9组通过。`browser-failure.png`为早期脚本失败现场，非当前仍失败。

0真实模型/DB/实际SVC调用。本地HTTP fixture只能验证消费端语义，不能代替provider在线能力、真实pin目录权限或真实执行结果。队列UI不在本片，既有boolean capability兼容保持，文案仅说明此Web版本不提供控制。
